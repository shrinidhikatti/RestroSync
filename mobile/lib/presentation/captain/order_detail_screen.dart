import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../../data/datasources/remote_datasource.dart';
import '../../data/models/order_models.dart';
import '../common/widgets.dart';

// ─── Order detail provider ─────────────────────────────────────────────────────

final orderDetailProvider =
    FutureProvider.family<Order, String>((ref, orderId) async {
  final data = await ref.watch(remoteDataSourceProvider).getOrder(orderId);
  return Order.fromJson(data);
});

// ─── Order detail screen ───────────────────────────────────────────────────────

class OrderDetailScreen extends ConsumerStatefulWidget {
  final String orderId;

  const OrderDetailScreen({super.key, required this.orderId});

  @override
  ConsumerState<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends ConsumerState<OrderDetailScreen> {
  bool _sendingKot  = false;
  bool _genBill     = false;
  String _error     = '';

  // ── Actions ──────────────────────────────────────────────────────────────────

  Future<void> _sendKot() async {
    setState(() { _sendingKot = true; _error = ''; });
    try {
      await ref.read(remoteDataSourceProvider).generateKot(widget.orderId);
      ref.invalidate(orderDetailProvider(widget.orderId));
    } catch (e) {
      setState(() => _error = _parseError(e));
    } finally {
      if (mounted) setState(() => _sendingKot = false);
    }
  }

  Future<void> _generateBill() async {
    setState(() { _genBill = true; _error = ''; });
    try {
      await ref.read(remoteDataSourceProvider).generateBill(widget.orderId);
      ref.invalidate(orderDetailProvider(widget.orderId));
    } catch (e) {
      setState(() => _error = _parseError(e));
    } finally {
      if (mounted) setState(() => _genBill = false);
    }
  }

  String _parseError(Object e) {
    final s = e.toString();
    if (s.contains('SocketException')) return 'No connection — will retry when online';
    return 'Action failed. Please try again.';
  }

  // ── Build ─────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final orderAsync = ref.watch(orderDetailProvider(widget.orderId));

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text(
          'Order Details',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(orderDetailProvider(widget.orderId)),
          ),
        ],
      ),
      body: orderAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
          ),
        ),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: AppColors.textMuted),
              const SizedBox(height: 12),
              Text('$e', textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.textSecondary)),
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: () => ref.invalidate(orderDetailProvider(widget.orderId)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (order) => _buildContent(order),
      ),
    );
  }

  Widget _buildContent(Order order) {
    final fmt    = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
    final timeFmt = DateFormat('dd MMM, hh:mm a');

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Header card ─────────────────────────────────────────────────────
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    order.tableNumber.isNotEmpty
                        ? 'Table ${order.tableNumber}'
                        : order.orderType.replaceAll('_', ' '),
                    style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary),
                  ),
                  const Spacer(),
                  StatusBadge(
                    label: order.status,
                    color: _statusColor(order.status),
                  ),
                ],
              ),
              if (order.tokenNumber != null) ...[
                const SizedBox(height: 4),
                Text(
                  'Token #${order.tokenNumber}',
                  style: const TextStyle(
                    fontSize: 13, color: AppColors.textSecondary),
                ),
              ],
              const SizedBox(height: 4),
              Text(
                timeFmt.format(order.createdAt.toLocal()),
                style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
              ),
              if (order.customerName != null) ...[
                const SizedBox(height: 4),
                Text(
                  'Customer: ${order.customerName}',
                  style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
              ],
            ],
          ),
        ),

        const SizedBox(height: 12),

        if (_error.isNotEmpty) ErrorBanner(_error),

        // ── Items list ──────────────────────────────────────────────────────
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Text(
                    'Items',
                    style: TextStyle(
                      fontSize: 15, fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary),
                  ),
                  const Spacer(),
                  if (order.hasUnsentItems)
                    GestureDetector(
                      onTap: _sendKot,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: _sendingKot
                            ? const SizedBox(
                                width: 14, height: 14,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.black),
                                ))
                            : const Text(
                                'Send KOT',
                                style: TextStyle(
                                  fontSize: 12, fontWeight: FontWeight.w700,
                                  color: Colors.black),
                              ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              const Divider(height: 1),
              ...order.items.map((item) => _ItemRow(item: item, fmt: fmt)),
            ],
          ),
        ),

        const SizedBox(height: 12),

        // ── Totals ──────────────────────────────────────────────────────────
        _Card(
          child: Column(
            children: [
              _TotalsRow(label: 'Subtotal', value: fmt.format(order.subtotal)),
              if (order.grandTotal != order.subtotal)
                _TotalsRow(
                  label: 'Grand Total',
                  value: fmt.format(order.grandTotal),
                  bold: true,
                ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // ── Action buttons ───────────────────────────────────────────────────
        if (order.hasUnsentItems && !_sendingKot)
          PrimaryButton(
            label:     'Send KOT to Kitchen',
            icon:      Icons.send_outlined,
            onPressed: _sendKot,
            loading:   _sendingKot,
          ),

        if (!order.hasActiveBill && !order.isPaid &&
            order.status != 'CANCELLED') ...[
          const SizedBox(height: 12),
          SecondaryButton(
            label:     'Generate Bill',
            icon:      Icons.receipt_outlined,
            onPressed: _genBill ? null : _generateBill,
          ),
        ],

        if (order.hasActiveBill) ...[
          const SizedBox(height: 12),
          _BillInfoBanner(bills: order.bills),
        ],

        // ── Add more items ───────────────────────────────────────────────────
        if (!order.isPaid && order.status != 'CANCELLED') ...[
          const SizedBox(height: 12),
          OutlinedButton.icon(
            icon: const Icon(Icons.add),
            label: const Text('Add More Items'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(double.infinity, 48),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            onPressed: () => context.push('/captain/new-order', extra: {
              'tableId':   order.tableId,
              'tableName': order.tableNumber.isNotEmpty
                  ? 'Table ${order.tableNumber}'
                  : 'Order',
              'orderType': order.orderType,
            }),
          ),
        ],

        const SizedBox(height: 32),
      ],
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'NEW':          return const Color(0xFF6366F1);
      case 'KOT_SENT':
      case 'IN_PROGRESS':  return AppColors.warning;
      case 'READY':        return AppColors.success;
      case 'SERVED':
      case 'BILLING':      return AppColors.textSecondary;
      case 'COMPLETED':    return AppColors.success;
      case 'CANCELLED':    return AppColors.danger;
      default:             return AppColors.textMuted;
    }
  }
}

// ─── Item row ──────────────────────────────────────────────────────────────────

class _ItemRow extends StatelessWidget {
  final OrderItem item;
  final NumberFormat fmt;

  const _ItemRow({required this.item, required this.fmt});

  @override
  Widget build(BuildContext context) {
    Color statusDotColor = item.kotId != null
        ? AppColors.success
        : AppColors.warning;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // KOT status dot
          Padding(
            padding: const EdgeInsets.only(top: 5, right: 10),
            child: Container(
              width: 8, height: 8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: statusDotColor,
              ),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.itemName,
                  style: const TextStyle(
                    fontSize: 14, fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary),
                ),
                if (item.variantName != null)
                  Text(
                    item.variantName!,
                    style: const TextStyle(
                      fontSize: 11, color: AppColors.textMuted),
                  ),
                if (item.addons != null && item.addons!.isNotEmpty)
                  Text(
                    '+ ${item.addons!.map((a) => a['name']).join(', ')}',
                    style: const TextStyle(
                      fontSize: 11, color: AppColors.textMuted),
                  ),
              ],
            ),
          ),
          Text(
            '× ${item.quantity}',
            style: const TextStyle(
              fontSize: 13, color: AppColors.textSecondary),
          ),
          const SizedBox(width: 12),
          Text(
            fmt.format(item.lineTotal),
            style: const TextStyle(
              fontSize: 14, fontWeight: FontWeight.w700,
              color: AppColors.textPrimary),
          ),
        ],
      ),
    );
  }
}

// ─── Totals row ────────────────────────────────────────────────────────────────

class _TotalsRow extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;

  const _TotalsRow({
    required this.label,
    required this.value,
    this.bold = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Text(label, style: TextStyle(
            fontSize: bold ? 15 : 13,
            fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
            color: bold ? AppColors.textPrimary : AppColors.textSecondary,
          )),
          const Spacer(),
          Text(value, style: TextStyle(
            fontSize: bold ? 16 : 14,
            fontWeight: bold ? FontWeight.w700 : FontWeight.w600,
            color: bold ? AppColors.primary : AppColors.textPrimary,
          )),
        ],
      ),
    );
  }
}

// ─── Bill info banner ──────────────────────────────────────────────────────────

class _BillInfoBanner extends StatelessWidget {
  final List<Map<String, dynamic>> bills;

  const _BillInfoBanner({required this.bills});

  @override
  Widget build(BuildContext context) {
    final activeBill = bills.firstWhere(
      (b) => ['UNPAID', 'PARTIALLY_PAID'].contains(b['status']),
      orElse: () => {},
    );
    if (activeBill.isEmpty) return const SizedBox.shrink();

    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
    final total = double.tryParse(activeBill['grandTotal']?.toString() ?? '0') ?? 0;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.receipt_outlined, color: AppColors.success, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Bill Generated',
                    style: TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w700,
                      color: AppColors.success)),
                Text(
                  '${activeBill['billNumber'] ?? ''} • ${fmt.format(total)}',
                  style: const TextStyle(
                    fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          StatusBadge(
            label: activeBill['status'] as String? ?? '',
            color: AppColors.warning,
          ),
        ],
      ),
    );
  }
}

// ─── Card wrapper ──────────────────────────────────────────────────────────────

class _Card extends StatelessWidget {
  final Widget child;

  const _Card({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: child,
    );
  }
}
