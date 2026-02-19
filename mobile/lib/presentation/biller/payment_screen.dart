/// Bill & Payment Screen — Shows bill summary with split payment + UPI QR

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../../data/datasources/remote_datasource.dart';
import '../../data/models/biller_models.dart';
import '../../services/print_service.dart';
import 'package:uuid/uuid.dart';

const _methods = ['CASH', 'CARD', 'UPI', 'WALLET'];

class PaymentScreen extends ConsumerStatefulWidget {
  final String orderId;
  const PaymentScreen({super.key, required this.orderId});

  @override
  ConsumerState<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends ConsumerState<PaymentScreen> {
  BillSummary? _bill;
  bool _loading = true;
  bool _processing = false;

  // Split payment
  List<PaymentSplit> _splits = [PaymentSplit(method: 'CASH', amount: 0)];
  bool _splitMode = false;
  String _upiVpa = 'restrosync@upi';

  @override
  void initState() {
    super.initState();
    _loadBill();
  }

  Future<void> _loadBill() async {
    try {
      final res = await ref.read(dioProvider).get('/orders/${widget.orderId}');
      final order = res.data as Map<String, dynamic>;
      final bills = order['bills'] as List<dynamic>? ?? [];
      final bill = bills.where((b) => (b as Map)['status'] != 'VOIDED').firstOrNull;
      if (bill != null) {
        setState(() { _bill = BillSummary.fromJson(bill as Map<String, dynamic>); });
        // Pre-fill single payment
        _splits = [PaymentSplit(method: 'CASH', amount: _bill!.grandTotal)];
      }
    } catch (_) {}
    setState(() => _loading = false);
  }

  double get _totalSplit => _splits.fold(0, (s, p) => s + p.amount);
  double get _remaining => (_bill?.grandTotal ?? 0) - _totalSplit;

  Future<void> _recordPayment() async {
    if (_bill == null) return;
    setState(() => _processing = true);
    try {
      await ref.read(dioProvider).post('/bills/${_bill!.billId}/payments', data: {
        'payments': _splits.where((s) => s.amount > 0).map((s) => {
          'method': s.method,
          'amount': s.amount,
        }).toList(),
      });

      // Print receipt
      final printSvc = ref.read(printServiceProvider.notifier);
      await printSvc.enqueuePrint(
        id: const Uuid().v4(),
        type: 'RECEIPT',
        content: PrintService.formatBill(
          billNumber:     _bill!.billNumber,
          restaurantName: 'RestroSync Restaurant',
          items:          [],
          subtotal:       _bill!.subtotal,
          tax:            _bill!.taxTotal,
          total:          _bill!.grandTotal,
          paymentMethod:  _splits.map((s) => '${s.method}: ₹${s.amount.toStringAsFixed(0)}').join(', '),
        ),
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Payment recorded! Bill closed.'), backgroundColor: Color(0xFF10B981)),
        );
        context.go('/biller');
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Payment failed: $e'), backgroundColor: Colors.red),
      );
    } finally {
      setState(() => _processing = false);
    }
  }

  String _buildUpiUrl(double amount) =>
    'upi://pay?pa=$_upiVpa&pn=RestroSync&am=${amount.toStringAsFixed(2)}&cu=INR&tn=${_bill?.billNumber ?? ""}';

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator(color: AppColors.primary)));
    if (_bill == null) return Scaffold(appBar: AppBar(), body: const Center(child: Text('Bill not found')));

    final currency = NumberFormat.currency(symbol: '₹', decimalDigits: 2, locale: 'en_IN');

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: Text(_bill!.billNumber, style: const TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          TextButton.icon(
            onPressed: () => setState(() => _splitMode = !_splitMode),
            icon: Icon(_splitMode ? Icons.call_merge : Icons.call_split, size: 16),
            label: Text(_splitMode ? 'Single' : 'Split', style: const TextStyle(fontSize: 12)),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Bill summary card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
              child: Column(
                children: [
                  _BillRow('Subtotal', currency.format(_bill!.subtotal)),
                  if (_bill!.discountTotal > 0) _BillRow('Discount', '- ${currency.format(_bill!.discountTotal)}', color: const Color(0xFF10B981)),
                  if (_bill!.chargesTotal > 0) _BillRow('Charges', currency.format(_bill!.chargesTotal)),
                  _BillRow('Tax', currency.format(_bill!.taxTotal)),
                  if (_bill!.roundOff != 0) _BillRow('Round Off', '${_bill!.roundOff >= 0 ? '+' : ''}${_bill!.roundOff.toStringAsFixed(2)}'),
                  const Divider(height: 20),
                  Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    const Text('TOTAL', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                    Text(currency.format(_bill!.grandTotal), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22, color: AppColors.primary)),
                  ]),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Payment section
            const Align(alignment: Alignment.centerLeft, child: Text('Payment', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15))),
            const SizedBox(height: 10),

            if (!_splitMode)
              _buildSinglePayment()
            else
              _buildSplitPayment(),

            const SizedBox(height: 16),

            // UPI QR code
            if (_splits.any((s) => s.method == 'UPI' && s.amount > 0))
              _buildUpiQr(),

            const SizedBox(height: 24),

            // Remaining amount
            if (_remaining.abs() > 0.5)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: _remaining > 0 ? const Color(0xFFFEF2F2) : const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: _remaining > 0 ? const Color(0xFFFCA5A5) : const Color(0xFF86EFAC)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(_remaining > 0 ? 'Remaining to pay' : 'Change to return', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                    Text(currency.format(_remaining.abs()), style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: _remaining > 0 ? Colors.red : const Color(0xFF16A34A))),
                  ],
                ),
              ),

            const SizedBox(height: 24),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _processing || _remaining > 0.5 ? null : _recordPayment,
                style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
                child: _processing
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2))
                  : const Text('Record Payment & Print Bill', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSinglePayment() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: _methods.map((m) {
          final selected = _splits[0].method == m;
          return FilterChip(
            label: Text(m),
            selected: selected,
            onSelected: (_) => setState(() {
              _splits = [PaymentSplit(method: m, amount: _bill!.grandTotal)];
            }),
            selectedColor: AppColors.primary.withValues(alpha: 0.2),
            checkmarkColor: Colors.black,
            labelStyle: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: selected ? Colors.black : const Color(0xFF64748B)),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildSplitPayment() {
    return Column(
      children: [
        ..._splits.asMap().entries.map((entry) {
          final i = entry.key;
          final split = entry.value;
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
            child: Row(children: [
              DropdownButton<String>(
                value: split.method,
                underline: const SizedBox(),
                items: _methods.map((m) => DropdownMenuItem(value: m, child: Text(m, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)))).toList(),
                onChanged: (v) => setState(() => _splits[i].method = v!),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  decoration: const InputDecoration(prefixText: '₹ ', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 8)),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  controller: TextEditingController(text: split.amount.toStringAsFixed(0))
                    ..selection = TextSelection.fromPosition(TextPosition(offset: split.amount.toStringAsFixed(0).length)),
                  onChanged: (v) => setState(() => _splits[i].amount = double.tryParse(v) ?? 0),
                ),
              ),
              if (_splits.length > 1)
                IconButton(
                  icon: const Icon(Icons.remove_circle_outline, color: Colors.red, size: 20),
                  onPressed: () => setState(() => _splits.removeAt(i)),
                ),
            ]),
          );
        }),
        TextButton.icon(
          onPressed: () => setState(() => _splits.add(PaymentSplit(method: 'UPI', amount: _remaining.clamp(0, double.infinity)))),
          icon: const Icon(Icons.add, size: 16),
          label: const Text('Add payment method', style: TextStyle(fontSize: 12)),
        ),
      ],
    );
  }

  Widget _buildUpiQr() {
    final upiAmount = _splits.where((s) => s.method == 'UPI').fold<double>(0, (sum, s) => sum + s.amount);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(children: [
        const Text('UPI QR Code', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
        const SizedBox(height: 12),
        QrImageView(data: _buildUpiUrl(upiAmount), version: QrVersions.auto, size: 180),
        const SizedBox(height: 8),
        Text('₹${upiAmount.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AppColors.primary)),
        Text(_upiVpa, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
      ]),
    );
  }
}

class _BillRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? color;
  const _BillRow(this.label, this.value, {this.color});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Color(0xFF64748B), fontSize: 13)),
        Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: color ?? const Color(0xFF0F172A))),
      ],
    ),
  );
}
