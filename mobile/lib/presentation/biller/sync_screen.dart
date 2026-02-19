/// Sync Issues Screen — Shows offline queue status, retry/clear failed items

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../../data/datasources/remote_datasource.dart';
import '../../services/offline_queue_service.dart';
import '../../services/background_sync_service.dart';

class SyncScreen extends ConsumerStatefulWidget {
  const SyncScreen({super.key});

  @override
  ConsumerState<SyncScreen> createState() => _SyncScreenState();
}

class _SyncScreenState extends ConsumerState<SyncScreen> {
  List<QueueItem> _items = [];
  bool _loading = true;
  bool _syncing = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final svc = ref.read(offlineQueueProvider);
    _items = await svc.getAll();
    setState(() => _loading = false);
  }

  Future<void> _syncNow() async {
    setState(() => _syncing = true);
    final svc = ref.read(offlineQueueProvider);
    final dio = ref.read(dioProvider);
    final pending = await svc.getPending();

    // Show foreground notification for financial data sync
    if (pending.isNotEmpty) {
      await BackgroundSyncService.syncWithNotification(pending.length);
    }

    for (final item in pending) {
      await svc.markSyncing(item.id);
      try {
        switch (item.method) {
          case 'POST':  await dio.post(item.path, data: item.body); break;
          case 'PATCH': await dio.patch(item.path, data: item.body); break;
          case 'DELETE': await dio.delete(item.path); break;
        }
        await svc.markDone(item.id);
      } catch (_) {
        await svc.markFailed(item.id);
      }
    }

    await _load();
    setState(() => _syncing = false);
  }

  Future<void> _retryFailed() async {
    await ref.read(offlineQueueProvider).retryFailed();
    await _load();
  }

  Future<void> _clearFailed() async {
    await ref.read(offlineQueueProvider).clearFailed();
    await _load();
  }

  Color _statusColor(QueueStatus s) {
    switch (s) {
      case QueueStatus.pending:  return const Color(0xFF3B82F6);
      case QueueStatus.syncing:  return const Color(0xFFF59E0B);
      case QueueStatus.failed:   return const Color(0xFFEF4444);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pending = _items.where((i) => i.status == QueueStatus.pending).length;
    final failed  = _items.where((i) => i.status == QueueStatus.failed).length;

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text('Sync Issues', style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _load)],
      ),
      body: Column(
        children: [
          // Status bar
          Container(
            margin: const EdgeInsets.all(12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFE2E8F0))),
            child: Row(children: [
              _StatusBadge('Pending', pending, const Color(0xFF3B82F6)),
              const SizedBox(width: 12),
              _StatusBadge('Failed', failed, const Color(0xFFEF4444)),
              const Spacer(),
              if (pending > 0)
                ElevatedButton.icon(
                  onPressed: _syncing ? null : _syncNow,
                  icon: _syncing ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2)) : const Icon(Icons.sync, size: 16),
                  label: Text(_syncing ? 'Syncing...' : 'Sync Now', style: const TextStyle(fontSize: 12)),
                  style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
                ),
            ]),
          ),

          // Action row
          if (failed > 0)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(children: [
                TextButton.icon(onPressed: _retryFailed, icon: const Icon(Icons.replay, size: 16), label: const Text('Retry Failed', style: TextStyle(fontSize: 12))),
                const SizedBox(width: 8),
                TextButton.icon(
                  onPressed: _clearFailed,
                  icon: const Icon(Icons.delete_outline, size: 16, color: Colors.red),
                  label: const Text('Clear Failed', style: TextStyle(color: Colors.red, fontSize: 12)),
                ),
              ]),
            ),

          // List
          Expanded(
            child: _loading
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : _items.isEmpty
                ? const Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.check_circle_outline, size: 48, color: Color(0xFF10B981)),
                    SizedBox(height: 12),
                    Text('All synced!', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    Text('No pending offline operations.', style: TextStyle(color: AppColors.textMuted)),
                  ]))
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    itemCount: _items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 6),
                    itemBuilder: (_, i) {
                      final item = _items[i];
                      final color = _statusColor(item.status);
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFE2E8F0))),
                        child: Row(children: [
                          Container(
                            width: 6, height: 36,
                            decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3)),
                          ),
                          const SizedBox(width: 10),
                          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('${item.method} ${item.path}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, fontFamily: 'monospace'), maxLines: 1, overflow: TextOverflow.ellipsis),
                            Text(
                              DateFormat('HH:mm:ss').format(item.createdAt),
                              style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                            ),
                          ])),
                          if (item.retryCount > 0)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
                              child: Text('retry ${item.retryCount}', style: TextStyle(fontSize: 9, color: color, fontWeight: FontWeight.w700)),
                            ),
                        ]),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String label;
  final int count;
  final Color color;
  const _StatusBadge(this.label, this.count, this.color);

  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
    Container(width: 8, height: 8, decoration: BoxDecoration(shape: BoxShape.circle, color: color)),
    const SizedBox(width: 5),
    Text('$count $label', style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600)),
  ]);
}
