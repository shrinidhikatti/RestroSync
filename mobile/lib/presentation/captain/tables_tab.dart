import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../data/datasources/remote_datasource.dart';
import '../../data/models/table_models.dart';
import '../common/widgets.dart';

// ─── Tables provider ───────────────────────────────────────────────────────────

final tablesProvider = FutureProvider<List<RestaurantTable>>((ref) async {
  return ref.watch(remoteDataSourceProvider).getTables();
});

// ─── Tables tab ────────────────────────────────────────────────────────────────

class TablesTab extends ConsumerStatefulWidget {
  const TablesTab({super.key});

  @override
  ConsumerState<TablesTab> createState() => _TablesTabState();
}

class _TablesTabState extends ConsumerState<TablesTab> {
  String _filter = 'ALL'; // ALL | AVAILABLE | OCCUPIED | RESERVED | BILLING

  Color _statusColor(String status) {
    switch (status) {
      case 'AVAILABLE':    return AppColors.success;
      case 'OCCUPIED':     return AppColors.danger;
      case 'RESERVED':     return const Color(0xFF6366F1); // indigo
      case 'BILLING':      return AppColors.warning;
      case 'MAINTENANCE':  return AppColors.textMuted;
      default:             return AppColors.textMuted;
    }
  }

  @override
  Widget build(BuildContext context) {
    final tablesAsync = ref.watch(tablesProvider);

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text(
          'Tables',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(tablesProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Filter chips ────────────────────────────────────────────────────
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              children: ['ALL', 'AVAILABLE', 'OCCUPIED', 'RESERVED', 'BILLING']
                  .map((f) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: FilterChip(
                          label: Text(
                            f == 'ALL' ? 'All' : _capitalize(f),
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: _filter == f
                                  ? Colors.black
                                  : AppColors.textSecondary,
                            ),
                          ),
                          selected: _filter == f,
                          selectedColor: AppColors.primary,
                          checkmarkColor: Colors.black,
                          backgroundColor: Colors.white,
                          side: BorderSide(
                            color: _filter == f
                                ? AppColors.primary
                                : AppColors.border,
                          ),
                          onSelected: (_) => setState(() => _filter = f),
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                        ),
                      ))
                  .toList(),
            ),
          ),

          // ── Grid ────────────────────────────────────────────────────────────
          Expanded(
            child: tablesAsync.when(
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
                      onPressed: () => ref.invalidate(tablesProvider),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              data: (tables) {
                final filtered = _filter == 'ALL'
                    ? tables
                    : tables.where((t) => t.status == _filter).toList();

                if (filtered.isEmpty) {
                  return Center(
                    child: Text(
                      'No ${_filter == 'ALL' ? '' : _capitalize(_filter)} tables',
                      style: const TextStyle(color: AppColors.textMuted),
                    ),
                  );
                }

                return GridView.builder(
                  padding: const EdgeInsets.all(16),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.9,
                  ),
                  itemCount: filtered.length,
                  itemBuilder: (context, i) => _TableCard(
                    table:       filtered[i],
                    statusColor: _statusColor(filtered[i].status),
                    onTap:       () => _onTableTap(filtered[i]),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _onTableTap(RestaurantTable table) {
    if (table.isAvailable) {
      // Start new order on this table
      context.push('/captain/new-order', extra: {
        'tableId':   table.id,
        'tableName': 'Table ${table.number}',
        'orderType': 'DINE_IN',
      });
    } else if (table.isOccupied || table.isBilling) {
      // Go to order detail — need to find active order for this table
      _showOccupiedSheet(table);
    }
  }

  void _showOccupiedSheet(RestaurantTable table) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Table ${table.number}',
              style: const TextStyle(
                fontSize: 18, fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            StatusBadge(
              label: table.status,
              color: table.isOccupied ? AppColors.danger : AppColors.warning,
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.receipt_long_outlined),
                label: const Text('View Running Order'),
                onPressed: () {
                  Navigator.pop(context);
                  // Navigate to orders tab filtered by table
                  // (orders tab shows all; user can filter)
                },
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                icon: const Icon(Icons.add_circle_outline),
                label: const Text('Add Items to Order'),
                onPressed: () {
                  Navigator.pop(context);
                  context.push('/captain/new-order', extra: {
                    'tableId':   table.id,
                    'tableName': 'Table ${table.number}',
                    'orderType': 'DINE_IN',
                  });
                },
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  String _capitalize(String s) =>
      s.isEmpty ? s : s[0] + s.substring(1).toLowerCase();
}

// ─── Table card ────────────────────────────────────────────────────────────────

class _TableCard extends StatelessWidget {
  final RestaurantTable table;
  final Color statusColor;
  final VoidCallback onTap;

  const _TableCard({
    required this.table,
    required this.statusColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: statusColor.withValues(alpha: 0.4),
            width: 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: statusColor.withValues(alpha: 0.08),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Status dot
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: statusColor,
                ),
              ),
              const SizedBox(height: 8),
              // Table number
              Text(
                table.number,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              // Capacity
              Text(
                '${table.capacity} seats',
                style: const TextStyle(
                  fontSize: 10,
                  color: AppColors.textMuted,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              // Status label
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _shortStatus(table.status),
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: statusColor,
                    letterSpacing: 0.3,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _shortStatus(String s) {
    switch (s) {
      case 'AVAILABLE':   return 'OPEN';
      case 'OCCUPIED':    return 'BUSY';
      case 'RESERVED':    return 'RSVD';
      case 'BILLING':     return 'BILL';
      case 'MAINTENANCE': return 'MAINT';
      default:            return s;
    }
  }
}
