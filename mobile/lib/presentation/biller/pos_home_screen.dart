/// POS Home Screen — Overview: day status, quick stats, offline queue badge

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../data/datasources/remote_datasource.dart';
import '../../services/offline_queue_service.dart';
import '../../services/clock_drift_service.dart';

class PosHomeScreen extends ConsumerStatefulWidget {
  const PosHomeScreen({super.key});

  @override
  ConsumerState<PosHomeScreen> createState() => _PosHomeScreenState();
}

class _PosHomeScreenState extends ConsumerState<PosHomeScreen> {
  Map<String, dynamic>? _stats;
  bool _loading = true;
  int _pendingSync = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    const storage = FlutterSecureStorage();
    try {
      final dio = ref.read(dioProvider);
      final branchId = await storage.read(key: AppConstants.keyBranchId);
      final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
      final res = await dio.get('/orders', queryParameters: {'date': today, 'limit': '500'});
      final orders = res.data as List<dynamic>? ?? [];
      final totalSales = orders.where((o) => (o as Map)['status'] == 'COMPLETED').fold<double>(
        0, (sum, o) => sum + ((o as Map)['grandTotal'] as num? ?? 0).toDouble());
      setState(() {
        _stats = {
          'totalOrders': orders.length,
          'completed': orders.where((o) => (o as Map)['status'] == 'COMPLETED').length,
          'open': orders.where((o) => !['COMPLETED','CANCELLED'].contains((o as Map)['status'])).length,
          'totalSales': totalSales,
          'branchId': branchId,
        };
      });
    } catch (_) {}

    final queueSvc = ref.read(offlineQueueProvider);
    _pendingSync = await queueSvc.getPendingCount();
    setState(() => _loading = false);

    // Check clock drift
    ref.read(driftProvider.notifier).check();
  }

  Future<void> _logout() async {
    const storage = FlutterSecureStorage();
    await storage.deleteAll();
    if (mounted) context.go('/biller/login');
  }

  @override
  Widget build(BuildContext context) {
    final drift = ref.watch(driftProvider);
    final currency = NumberFormat.currency(symbol: '₹', decimalDigits: 0, locale: 'en_IN');

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text('POS Dashboard', style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          IconButton(icon: const Icon(Icons.wifi_off, size: 18), tooltip: 'Sync Issues', onPressed: () => context.push('/biller/sync')),
          IconButton(icon: const Icon(Icons.print_outlined, size: 18), tooltip: 'Printer', onPressed: () => context.push('/biller/printer')),
          IconButton(icon: const Icon(Icons.logout, size: 18), onPressed: _logout),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Clock drift warning
            if (drift.isBlocking)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber, color: Color(0xFFEF4444), size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Text('Clock Drift Detected', style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFFDC2626), fontSize: 13)),
                        Text('Drift: ${drift.driftLabel}. Billing is blocked until clock is synced.', style: const TextStyle(color: Color(0xFF7F1D1D), fontSize: 12)),
                      ]),
                    ),
                  ],
                ),
              ),

            // Pending sync badge
            if (_pendingSync > 0)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFDE68A)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.sync, color: Color(0xFFD97706), size: 18),
                    const SizedBox(width: 8),
                    Text('$_pendingSync item(s) pending sync', style: const TextStyle(color: Color(0xFF92400E), fontSize: 13, fontWeight: FontWeight.w600)),
                    const Spacer(),
                    TextButton(onPressed: () => context.push('/biller/sync'), child: const Text('View', style: TextStyle(fontSize: 12))),
                  ],
                ),
              ),

            // Today's date
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text(
                DateFormat('EEEE, d MMM yyyy').format(DateTime.now()),
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
              ),
            ),

            // Stats grid
            if (_loading)
              const Center(child: CircularProgressIndicator(color: AppColors.primary))
            else
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                childAspectRatio: 1.5,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                children: [
                  _StatCard(label: "Today's Sales", value: currency.format(_stats?['totalSales'] ?? 0), color: AppColors.primary),
                  _StatCard(label: 'Total Orders', value: '${_stats?['totalOrders'] ?? 0}', color: const Color(0xFF3B82F6)),
                  _StatCard(label: 'Completed', value: '${_stats?['completed'] ?? 0}', color: const Color(0xFF10B981)),
                  _StatCard(label: 'Open Orders', value: '${_stats?['open'] ?? 0}', color: const Color(0xFFF59E0B)),
                ],
              ),

            const SizedBox(height: 20),

            // Quick actions
            const Text('Quick Actions', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            const SizedBox(height: 10),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 3,
              childAspectRatio: 1.2,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              children: [
                _QuickAction(icon: Icons.table_restaurant, label: 'Tables', onTap: () => context.go('/biller/tables')),
                _QuickAction(icon: Icons.receipt_long, label: 'Orders', onTap: () => context.go('/biller/orders')),
                _QuickAction(icon: Icons.replay, label: 'Refund', onTap: () => context.push('/biller/refund')),
                _QuickAction(icon: Icons.lock_clock, label: 'Day Close', onTap: () => context.go('/biller/day-close')),
                _QuickAction(icon: Icons.sync, label: 'Sync', onTap: () => context.push('/biller/sync')),
                _QuickAction(icon: Icons.print, label: 'Printer', onTap: () => context.push('/biller/printer')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _StatCard({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: const Color(0xFFE2E8F0)),
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label, style: const TextStyle(color: Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.w500)),
      Text(value, style: TextStyle(color: color, fontSize: 22, fontWeight: FontWeight.w800)),
    ]),
  );
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _QuickAction({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(icon, color: AppColors.primary, size: 26),
        const SizedBox(height: 6),
        Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
      ]),
    ),
  );
}
