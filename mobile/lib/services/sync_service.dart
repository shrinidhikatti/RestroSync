import 'dart:async';
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as p;
import '../core/constants.dart';
import '../data/datasources/remote_datasource.dart';

// ─── Sync service provider ─────────────────────────────────────────────────────

final syncServiceProvider = Provider<SyncService>((ref) {
  return SyncService(ref.watch(remoteDataSourceProvider));
});

// ─── Pending operation model ───────────────────────────────────────────────────

class PendingOperation {
  final int? id;
  final String type;      // create_order | add_items | generate_kot | cancel_order
  final String payload;   // JSON string
  int retryCount;
  final int createdAt;

  PendingOperation({
    this.id,
    required this.type,
    required this.payload,
    this.retryCount = 0,
    required this.createdAt,
  });

  factory PendingOperation.fromMap(Map<String, dynamic> map) => PendingOperation(
        id:         map['id'] as int?,
        type:       map['type'] as String,
        payload:    map['payload'] as String,
        retryCount: map['retry_count'] as int,
        createdAt:  map['created_at'] as int,
      );

  Map<String, dynamic> toMap() => {
        if (id != null) 'id': id,
        'type':        type,
        'payload':     payload,
        'retry_count': retryCount,
        'created_at':  createdAt,
      };
}

// ─── Sync service ──────────────────────────────────────────────────────────────

class SyncService {
  final RemoteDataSource _remote;
  Database? _db;
  Timer? _timer;
  bool _syncing = false;

  SyncService(this._remote);

  // ── DB init ──────────────────────────────────────────────────────────────────

  Future<Database> _getDb() async {
    if (_db != null) return _db!;
    final path = p.join(await getDatabasesPath(), 'restrosync.db');
    _db = await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE pending_ops (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            type        TEXT NOT NULL,
            payload     TEXT NOT NULL,
            retry_count INTEGER NOT NULL DEFAULT 0,
            created_at  INTEGER NOT NULL
          )
        ''');
      },
    );
    return _db!;
  }

  // ── Queue operation (offline) ────────────────────────────────────────────────

  Future<int> enqueue(String type, Map<String, dynamic> payload) async {
    final db = await _getDb();
    return db.insert('pending_ops', PendingOperation(
      type:      type,
      payload:   jsonEncode(payload),
      createdAt: DateTime.now().millisecondsSinceEpoch,
    ).toMap());
  }

  // ── Start periodic sync ──────────────────────────────────────────────────────

  void startAutoSync() {
    _timer?.cancel();
    _timer = Timer.periodic(
      const Duration(seconds: 10),
      (_) => _processQueue(),
    );
  }

  void stopAutoSync() {
    _timer?.cancel();
    _timer = null;
  }

  // ── Process queue ────────────────────────────────────────────────────────────

  Future<void> _processQueue() async {
    if (_syncing) return;
    _syncing = true;
    try {
      final db  = await _getDb();
      final ops = (await db.query('pending_ops', orderBy: 'created_at ASC'))
          .map(PendingOperation.fromMap)
          .toList();

      for (final op in ops) {
        // Back-off: skip if max retries exceeded
        if (op.retryCount >= AppConstants.syncRetryDelays.length) {
          continue;
        }
        final success = await _executeOp(op);
        if (success) {
          await db.delete('pending_ops', where: 'id = ?', whereArgs: [op.id]);
        } else {
          await db.update(
            'pending_ops',
            {'retry_count': op.retryCount + 1},
            where: 'id = ?',
            whereArgs: [op.id],
          );
          // Delay before next batch
          final delay = AppConstants.syncRetryDelays[
              op.retryCount.clamp(0, AppConstants.syncRetryDelays.length - 1)];
          await Future.delayed(Duration(milliseconds: delay));
        }
      }
    } finally {
      _syncing = false;
    }
  }

  Future<bool> _executeOp(PendingOperation op) async {
    try {
      final payload = jsonDecode(op.payload) as Map<String, dynamic>;
      switch (op.type) {
        case 'create_order':
          await _remote.createOrder(
            type:         payload['type'] as String,
            tableId:      payload['tableId'] as String?,
            customerName: payload['customerName'] as String?,
            notes:        payload['notes'] as String?,
          );
          return true;
        case 'add_items':
          await _remote.addOrderItems(
            payload['orderId'] as String,
            (payload['items'] as List<dynamic>).cast<Map<String, dynamic>>(),
          );
          return true;
        case 'generate_kot':
          await _remote.generateKot(payload['orderId'] as String);
          return true;
        case 'cancel_order':
          await _remote.cancelOrder(
            payload['orderId'] as String,
            payload['reason'] as String,
          );
          return true;
        default:
          return false; // unknown type — discard eventually
      }
    } catch (_) {
      return false;
    }
  }

  /// Force-flush the queue immediately (called when connectivity restores).
  Future<void> flush() => _processQueue();

  Future<int> pendingCount() async {
    final db = await _getDb();
    final result = await db.rawQuery('SELECT COUNT(*) as cnt FROM pending_ops');
    return (result.first['cnt'] as int?) ?? 0;
  }
}
