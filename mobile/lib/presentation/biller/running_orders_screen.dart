/// Running Orders Screen — Live list of active orders with quick actions

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../../data/datasources/remote_datasource.dart';
import '../../data/models/biller_models.dart';
import '../../services/socket_service.dart';

class RunningOrdersScreen extends ConsumerStatefulWidget {
  const RunningOrdersScreen({super.key});

  @override
  ConsumerState<RunningOrdersScreen> createState() => _RunningOrdersScreenState();
}

class _RunningOrdersScreenState extends ConsumerState<RunningOrdersScreen> {
  List<BillerOrder> _orders = [];
  bool _loading = true;

  static const _activeStatuses = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'BILLED'];

  @override
  void initState() {
    super.initState();
    _load();
    _listenSocket();
  }

  void _listenSocket() {
    final socket = ref.read(socketServiceProvider);
    socket.on('order:updated', (_) => _load());
    socket.on('order:created', (_) => _load());
  }

  Future<void> _load() async {
    try {
      final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
      final res = await ref.read(dioProvider).get('/orders', queryParameters: {
        'date': today,
        'limit': '100',
      });
      final all = (res.data as List<dynamic>? ?? [])
        .map((o) => BillerOrder.fromJson(o as Map<String, dynamic>))
        .where((o) => _activeStatuses.contains(o.status))
        .toList()
        ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
      setState(() { _orders = all; });
    } catch (_) {}
    setState(() => _loading = false);
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'NEW':       return const Color(0xFF3B82F6);
      case 'ACCEPTED':  return const Color(0xFF8B5CF6);
      case 'PREPARING': return const Color(0xFFF59E0B);
      case 'READY':     return const Color(0xFF10B981);
      case 'SERVED':    return const Color(0xFF06B6D4);
      case 'BILLED':    return const Color(0xFF64748B);
      default:          return const Color(0xFF94A3B8);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: Row(children: [
          const Text('Running Orders', style: TextStyle(fontWeight: FontWeight.w800)),
          if (_orders.isNotEmpty) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(10)),
              child: Text('${_orders.length}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.black)),
            ),
          ],
        ]),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _load)],
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
        : _orders.isEmpty
          ? const Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.receipt_long_outlined, size: 48, color: Color(0xFFCBD5E1)),
              SizedBox(height: 12),
              Text('No active orders', style: TextStyle(color: AppColors.textMuted, fontSize: 15)),
            ]))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: _orders.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final order = _orders[i];
                  final color = _statusColor(order.status);
                  final elapsed = DateTime.now().difference(order.createdAt);
                  final elapsedStr = elapsed.inMinutes > 0 ? '${elapsed.inMinutes}m ago' : 'just now';

                  return GestureDetector(
                    onTap: () => context.push('/biller/billing/${order.id}'),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: color.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          // Status indicator
                          Container(
                            width: 4, height: 50,
                            decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2)),
                          ),
                          const SizedBox(width: 12),
                          // Order info
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Row(children: [
                                Text(
                                  order.orderType == 'DINE_IN' && order.tableNumber != null
                                    ? 'Table ${order.tableNumber}'
                                    : order.orderType == 'TAKEAWAY'
                                      ? 'Takeaway ${order.tokenNumber != null ? '#${order.tokenNumber}' : ''}'
                                      : order.orderType,
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                  decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
                                  child: Text(order.status, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
                                ),
                              ]),
                              const SizedBox(height: 4),
                              Text('${order.items.length} items • ₹${order.grandTotal.toStringAsFixed(0)}', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                              Text(elapsedStr, style: TextStyle(fontSize: 11, color: elapsed.inMinutes > 20 ? Colors.red : AppColors.textMuted)),
                            ]),
                          ),
                          // Quick action
                          if (order.status == 'BILLED')
                            TextButton(
                              onPressed: () => context.push('/biller/payment/${order.id}'),
                              style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6)),
                              child: const Text('Pay', style: TextStyle(fontWeight: FontWeight.w700)),
                            )
                          else
                            const Icon(Icons.chevron_right, color: AppColors.textMuted),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }
}
