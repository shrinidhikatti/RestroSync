import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../../data/datasources/remote_datasource.dart';
import '../../data/models/order_models.dart';
import '../common/widgets.dart';

// ─── Active orders provider ────────────────────────────────────────────────────

final activeOrdersProvider = FutureProvider<List<Order>>((ref) async {
  final remote = ref.watch(remoteDataSourceProvider);
  final data   = await remote.getOrders(status: 'ACTIVE', limit: 100);
  final list   = (data['data'] as List<dynamic>? ?? []);
  return list.map((j) => Order.fromJson(j as Map<String, dynamic>)).toList();
});

// ─── Orders tab ────────────────────────────────────────────────────────────────

class OrdersTab extends ConsumerWidget {
  const OrdersTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(activeOrdersProvider);

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text(
          'My Orders',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(activeOrdersProvider),
          ),
        ],
      ),
      body: ordersAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
          ),
        ),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off_rounded, size: 48, color: AppColors.textMuted),
              const SizedBox(height: 12),
              Text('$e', style: const TextStyle(color: AppColors.textSecondary)),
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: () => ref.invalidate(activeOrdersProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (orders) {
          if (orders.isEmpty) {
            return const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.receipt_long_outlined, size: 64, color: AppColors.textMuted),
                  SizedBox(height: 16),
                  Text(
                    'No active orders',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  SizedBox(height: 6),
                  Text(
                    'Tap a table to start a new order',
                    style: TextStyle(color: AppColors.textMuted),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async => ref.invalidate(activeOrdersProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: orders.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) => _OrderCard(
                order: orders[i],
                onTap: () => context.push('/captain/order/${orders[i].id}'),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ─── Order card ────────────────────────────────────────────────────────────────

class _OrderCard extends StatelessWidget {
  final Order order;
  final VoidCallback onTap;

  const _OrderCard({required this.order, required this.onTap});

  Color get _statusColor {
    switch (order.status) {
      case 'NEW':        return const Color(0xFF6366F1);
      case 'KOT_SENT':
      case 'IN_PROGRESS':return AppColors.warning;
      case 'READY':      return AppColors.success;
      case 'SERVED':     return AppColors.textMuted;
      case 'COMPLETED':  return AppColors.success;
      default:           return AppColors.textMuted;
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('hh:mm a');

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row
            Row(
              children: [
                // Table / type badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    order.tableNumber.isNotEmpty
                        ? 'T-${order.tableNumber}'
                        : order.orderType == 'TAKEAWAY'
                            ? 'Takeaway'
                            : 'Counter',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                ),
                if (order.tokenNumber != null) ...[
                  const SizedBox(width: 8),
                  Text(
                    '#${order.tokenNumber}',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
                const Spacer(),
                StatusBadge(
                  label: _humanStatus(order.status),
                  color: _statusColor,
                ),
              ],
            ),

            const SizedBox(height: 12),

            // Items summary
            Text(
              '${order.items.length} item${order.items.length == 1 ? '' : 's'}'
              '${order.customerName != null ? ' • ${order.customerName}' : ''}',
              style: const TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
              ),
            ),

            const SizedBox(height: 8),

            // Footer: time + amount
            Row(
              children: [
                Icon(Icons.schedule, size: 13, color: AppColors.textMuted),
                const SizedBox(width: 4),
                Text(
                  fmt.format(order.createdAt.toLocal()),
                  style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                ),
                const Spacer(),
                Text(
                  '₹${order.subtotal.toStringAsFixed(0)}',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),

            // Unsent items chip
            if (order.hasUnsentItems) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.orange.shade50,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: Colors.orange.shade200),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.warning_amber_rounded,
                            size: 12, color: Colors.orange.shade700),
                        const SizedBox(width: 4),
                        Text(
                          'Unsent items — tap to send KOT',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.orange.shade800,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _humanStatus(String s) {
    switch (s) {
      case 'NEW':         return 'New';
      case 'KOT_SENT':   return 'KOT Sent';
      case 'IN_PROGRESS':return 'Cooking';
      case 'READY':      return 'Ready';
      case 'SERVED':     return 'Served';
      case 'BILLING':    return 'Billing';
      case 'COMPLETED':  return 'Paid';
      default:           return s;
    }
  }
}
