/// Refund Screen — Search by bill number → select items → process refund

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../data/datasources/remote_datasource.dart';

class RefundScreen extends ConsumerStatefulWidget {
  const RefundScreen({super.key});

  @override
  ConsumerState<RefundScreen> createState() => _RefundScreenState();
}

class _RefundScreenState extends ConsumerState<RefundScreen> {
  final _searchCtrl = TextEditingController();
  Map<String, dynamic>? _bill;
  List<String> _selectedItemIds = [];
  String _reason = '';
  bool _searching = false;
  bool _processing = false;
  String _error = '';

  Future<void> _searchBill() async {
    final query = _searchCtrl.text.trim();
    if (query.isEmpty) return;
    setState(() { _searching = true; _error = ''; _bill = null; });

    try {
      final res = await ref.read(dioProvider).get('/bills', queryParameters: {'billNumber': query, 'limit': '1'});
      final list = res.data as List<dynamic>? ?? [];
      if (list.isEmpty) {
        setState(() => _error = 'Bill "$query" not found.');
      } else {
        setState(() => _bill = list.first as Map<String, dynamic>);
      }
    } catch (_) {
      setState(() => _error = 'Search failed. Check the bill number.');
    }
    setState(() => _searching = false);
  }

  Future<void> _processRefund() async {
    if (_bill == null || _selectedItemIds.isEmpty || _reason.isEmpty) return;
    setState(() { _processing = true; _error = ''; });

    try {
      final orderId = _bill!['orderId'] as String? ?? _bill!['order']?['id'] as String? ?? '';
      await ref.read(dioProvider).post('/orders/$orderId/refund', data: {
        'billId':    _bill!['id'],
        'itemIds':   _selectedItemIds,
        'reason':    _reason,
        'refundType': 'PARTIAL',
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Refund processed successfully.'), backgroundColor: Color(0xFF10B981)),
        );
        context.pop();
      }
    } catch (e) {
      setState(() => _error = 'Refund failed: $e');
    }
    setState(() => _processing = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(title: const Text('Refund', style: TextStyle(fontWeight: FontWeight.w800))),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Search
            const Text('Find Bill', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(
                child: TextField(
                  controller: _searchCtrl,
                  decoration: const InputDecoration(hintText: 'Enter bill number (e.g. INV/20252026/00001)', prefixIcon: Icon(Icons.search, size: 18)),
                  onSubmitted: (_) => _searchBill(),
                ),
              ),
              const SizedBox(width: 10),
              ElevatedButton(
                onPressed: _searching ? null : _searchBill,
                child: _searching ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2)) : const Text('Find'),
              ),
            ]),

            if (_error.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(top: 10),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFFCA5A5))),
                child: Text(_error, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13)),
              ),

            if (_bill != null) ...[
              const SizedBox(height: 20),
              const Text('Select Items to Refund', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              const SizedBox(height: 8),

              // Bill summary
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Text(_bill!['billNumber'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: (_bill!['status'] == 'PAID') ? const Color(0xFFDCFCE7) : const Color(0xFFFEF9C3),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(_bill!['status'] as String? ?? '', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: (_bill!['status'] == 'PAID') ? const Color(0xFF16A34A) : const Color(0xFFCA8A04))),
                      ),
                    ]),
                    const SizedBox(height: 4),
                    Text('Total: ₹${_bill!['grandTotal']}', style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.textMuted, fontSize: 13)),
                  ],
                ),
              ),

              const SizedBox(height: 10),

              // Order items
              ...(_bill!['order']?['items'] as List<dynamic>? ?? []).map((item) {
                final m = item as Map;
                final id = m['id'] as String;
                final selected = _selectedItemIds.contains(id);
                return CheckboxListTile(
                  value: selected,
                  onChanged: (v) => setState(() { v! ? _selectedItemIds.add(id) : _selectedItemIds.remove(id); }),
                  title: Text(m['menuItem']?['name'] as String? ?? '?', style: const TextStyle(fontSize: 13)),
                  subtitle: Text('Qty: ${m['qty']} × ₹${m['unitPrice']}', style: const TextStyle(fontSize: 11)),
                  secondary: Text('₹${((m['qty'] as int) * (m['unitPrice'] as num)).toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w700)),
                  activeColor: AppColors.primary,
                  controlAffinity: ListTileControlAffinity.leading,
                  contentPadding: EdgeInsets.zero,
                );
              }),

              const SizedBox(height: 16),

              // Reason
              const Text('Reason for Refund', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              const SizedBox(height: 8),
              TextField(
                decoration: const InputDecoration(hintText: 'e.g. Wrong item, Customer complaint'),
                maxLines: 2,
                onChanged: (v) => setState(() => _reason = v),
              ),

              const SizedBox(height: 20),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: (_selectedItemIds.isEmpty || _reason.isEmpty || _processing) ? null : _processRefund,
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444), foregroundColor: Colors.white),
                  child: _processing
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : Text('Process Refund (${_selectedItemIds.length} item${_selectedItemIds.length != 1 ? 's' : ''})'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }
}
