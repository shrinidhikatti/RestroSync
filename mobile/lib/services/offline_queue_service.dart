/// Offline Order Queue — SQLite WAL mode
/// Stores pending API calls when device is offline. Background sync picks them up.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

enum QueueStatus { pending, syncing, failed }

class QueueItem {
  final String id;
  final String method;  // POST/PATCH/DELETE
  final String path;
  final String? body;   // JSON string
  final int retryCount;
  final QueueStatus status;
  final DateTime createdAt;

  const QueueItem({
    required this.id,
    required this.method,
    required this.path,
    this.body,
    required this.retryCount,
    required this.status,
    required this.createdAt,
  });

  factory QueueItem.fromMap(Map<String, dynamic> m) => QueueItem(
    id:         m['id'] as String,
    method:     m['method'] as String,
    path:       m['path'] as String,
    body:       m['body'] as String?,
    retryCount: m['retry_count'] as int,
    status:     QueueStatus.values.byName(m['status'] as String),
    createdAt:  DateTime.parse(m['created_at'] as String),
  );
}

class OfflineQueueService {
  /// Singleton instance for use in background isolates (no Riverpod available)
  static final OfflineQueueService instance = OfflineQueueService();

  static Database? _db;

  Future<Database> get db async {
    _db ??= await _open();
    return _db!;
  }

  Future<Database> _open() async {
    final dbPath = await getDatabasesPath();
    return openDatabase(
      join(dbPath, 'restrosync_queue.db'),
      version: 1,
      onCreate: (db, _) async {
        // WAL mode for concurrent reads
        await db.execute('PRAGMA journal_mode=WAL');
        await db.execute('''
          CREATE TABLE IF NOT EXISTS sync_queue (
            id           TEXT PRIMARY KEY,
            method       TEXT NOT NULL,
            path         TEXT NOT NULL,
            body         TEXT,
            retry_count  INTEGER DEFAULT 0,
            status       TEXT DEFAULT 'pending',
            created_at   TEXT NOT NULL
          )
        ''');
        // Draft orders per table (offline billing)
        await db.execute('''
          CREATE TABLE IF NOT EXISTS draft_orders (
            table_id     TEXT PRIMARY KEY,
            data         TEXT NOT NULL,
            updated_at   TEXT NOT NULL
          )
        ''');
        // Pre-allocated number ranges for offline bill/KOT numbers
        await db.execute('''
          CREATE TABLE IF NOT EXISTS number_ranges (
            id           TEXT PRIMARY KEY,
            type         TEXT NOT NULL,
            range_start  INTEGER NOT NULL,
            range_end    INTEGER NOT NULL,
            current_num  INTEGER NOT NULL,
            financial_yr TEXT NOT NULL,
            synced_at    TEXT
          )
        ''');
      },
    );
  }

  /// Add a new item to the sync queue
  Future<void> enqueue({
    required String id,
    required String method,
    required String path,
    String? body,
  }) async {
    final database = await db;
    await database.insert('sync_queue', {
      'id':         id,
      'method':     method,
      'path':       path,
      'body':       body,
      'retry_count': 0,
      'status':     'pending',
      'created_at': DateTime.now().toIso8601String(),
    }, conflictAlgorithm: ConflictAlgorithm.ignore);
  }

  /// Get all pending items (oldest first)
  Future<List<QueueItem>> getPending() async {
    final database = await db;
    final rows = await database.query(
      'sync_queue',
      where: 'status = ?',
      whereArgs: ['pending'],
      orderBy: 'created_at ASC',
    );
    return rows.map(QueueItem.fromMap).toList();
  }

  /// Get all items (for the sync screen display)
  Future<List<QueueItem>> getAll() async {
    final database = await db;
    final rows = await database.query('sync_queue', orderBy: 'created_at DESC', limit: 50);
    return rows.map(QueueItem.fromMap).toList();
  }

  Future<int> getPendingCount() async {
    final database = await db;
    final result = await database.rawQuery(
      "SELECT COUNT(*) as c FROM sync_queue WHERE status = 'pending'",
    );
    return (result.first['c'] as int?) ?? 0;
  }

  Future<void> markSyncing(String id) async {
    final database = await db;
    await database.update('sync_queue', {'status': 'syncing'}, where: 'id = ?', whereArgs: [id]);
  }

  Future<void> markDone(String id) async {
    final database = await db;
    await database.delete('sync_queue', where: 'id = ?', whereArgs: [id]);
  }

  Future<void> markFailed(String id) async {
    final database = await db;
    await database.rawUpdate(
      "UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1 WHERE id = ?",
      [id],
    );
  }

  Future<void> retryFailed() async {
    final database = await db;
    await database.update('sync_queue', {'status': 'pending'}, where: "status = 'failed'");
  }

  Future<void> clearFailed() async {
    final database = await db;
    await database.delete('sync_queue', where: "status = 'failed'");
  }

  // ─── Draft orders (offline table cart state) ───────────────────────────────

  Future<void> saveDraft(String tableId, String jsonData) async {
    final database = await db;
    await database.insert('draft_orders', {
      'table_id':   tableId,
      'data':       jsonData,
      'updated_at': DateTime.now().toIso8601String(),
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<String?> getDraft(String tableId) async {
    final database = await db;
    final rows = await database.query('draft_orders', where: 'table_id = ?', whereArgs: [tableId]);
    return rows.isEmpty ? null : rows.first['data'] as String;
  }

  Future<void> deleteDraft(String tableId) async {
    final database = await db;
    await database.delete('draft_orders', where: 'table_id = ?', whereArgs: [tableId]);
  }

  // ─── Number ranges ─────────────────────────────────────────────────────────

  Future<void> saveRange(Map<String, dynamic> range) async {
    final database = await db;
    await database.insert('number_ranges', {
      'id':          range['rangeId'],
      'type':        range['type'],
      'range_start': range['rangeStart'],
      'range_end':   range['rangeEnd'],
      'current_num': range['rangeStart'],
      'financial_yr': range['financialYear'],
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  /// Get next available number for BILL or KOT offline usage
  Future<int?> getNextNumber(String type) async {
    final database = await db;
    final rows = await database.rawQuery(
      "SELECT * FROM number_ranges WHERE type = ? AND current_num <= range_end ORDER BY range_start ASC LIMIT 1",
      [type],
    );
    if (rows.isEmpty) return null;
    final row = rows.first;
    final current = row['current_num'] as int;
    await database.rawUpdate(
      "UPDATE number_ranges SET current_num = current_num + 1 WHERE id = ?",
      [row['id']],
    );
    return current;
  }
}

final offlineQueueProvider = Provider<OfflineQueueService>((ref) => OfflineQueueService());
