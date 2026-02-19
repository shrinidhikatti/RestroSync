/// Table Selection Screen — Color-coded grid showing table availability.
/// AVAILABLE=green, OCCUPIED=amber, RESERVED=blue. Tap occupied → billing screen.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../data/datasources/remote_datasource.dart';

class TableSelectionScreen extends ConsumerStatefulWidget {
  const TableSelectionScreen({super.key});

  @override
  ConsumerState<TableSelectionScreen> createState() => _TableSelectionScreenState();
}

class _TableSelectionScreenState extends ConsumerState<TableSelectionScreen> {
  List<dynamic> _tables = [];
  bool _loading = true;
  String _filter = 'ALL'; // ALL, AVAILABLE, OCCUPIED

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ref.read(dioProvider).get('/tables');
      setState(() { _tables = res.data as List<dynamic>? ?? []; });
    } catch (_) {}
    setState(() => _loading = false);
  }

  List<dynamic> get _filtered {
    if (_filter == 'ALL') return _tables;
    return _tables.where((t) => (t as Map)['status'] == _filter).toList();
  }

  Color _tableColor(String status) {
    switch (status) {
      case 'OCCUPIED':  return const Color(0xFFF59E0B);
      case 'RESERVED':  return const Color(0xFF3B82F6);
      case 'CLEANING':  return const Color(0xFF8B5CF6);
      default:          return const Color(0xFF10B981);
    }
  }

  IconData _tableIcon(String status) {
    switch (status) {
      case 'OCCUPIED':  return Icons.people;
      case 'RESERVED':  return Icons.bookmark;
      case 'CLEANING':  return Icons.cleaning_services;
      default:          return Icons.check_circle_outline;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text('Tables', style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
          PopupMenuButton<String>(
            initialValue: _filter,
            onSelected: (v) => setState(() => _filter = v),
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'ALL', child: Text('All Tables')),
              const PopupMenuItem(value: 'AVAILABLE', child: Text('Available')),
              const PopupMenuItem(value: 'OCCUPIED', child: Text('Occupied')),
            ],
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(_filter, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primary)),
                  const Icon(Icons.expand_more, size: 16, color: AppColors.primary),
                ],
              ),
            ),
          ),
        ],
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
        : _filtered.isEmpty
          ? const Center(child: Text('No tables found', style: TextStyle(color: AppColors.textMuted)))
          : RefreshIndicator(
              onRefresh: _load,
              child: GridView.builder(
                padding: const EdgeInsets.all(16),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  childAspectRatio: 1,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                ),
                itemCount: _filtered.length,
                itemBuilder: (context, i) {
                  final table = _filtered[i] as Map;
                  final status = table['status'] as String? ?? 'AVAILABLE';
                  final color = _tableColor(status);
                  final tableNum = table['number'] as int? ?? 0;
                  final capacity = table['capacity'] as int? ?? 4;

                  return GestureDetector(
                    onTap: () {
                      if (status == 'OCCUPIED' && table['currentOrderId'] != null) {
                        // Go to billing screen for existing order
                        context.push('/biller/billing/${table['currentOrderId']}');
                      } else if (status == 'AVAILABLE') {
                        // Create new order for this table
                        context.push('/biller/billing/new', extra: {
                          'tableId':   table['id'],
                          'tableNumber': tableNum,
                          'orderType': 'DINE_IN',
                        });
                      }
                    },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: color, width: 2),
                      ),
                      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        Icon(_tableIcon(status), color: color, size: 26),
                        const SizedBox(height: 6),
                        Text(
                          'T$tableNum',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: color),
                        ),
                        Text(
                          '${table['section'] ?? ''} • $capacity pax',
                          style: TextStyle(fontSize: 9, color: color.withValues(alpha: 0.8)),
                          overflow: TextOverflow.ellipsis,
                        ),
                        Container(
                          margin: const EdgeInsets.only(top: 4),
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: color.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(6)),
                          child: Text(status, style: TextStyle(fontSize: 8, color: color, fontWeight: FontWeight.w700)),
                        ),
                      ]),
                    ),
                  );
                },
              ),
            ),
      // FAB for takeaway order
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.black,
        icon: const Icon(Icons.add_shopping_cart),
        label: const Text('Takeaway', style: TextStyle(fontWeight: FontWeight.w700)),
        onPressed: () => context.push('/biller/billing/new', extra: {'orderType': 'TAKEAWAY'}),
      ),
    );
  }
}
