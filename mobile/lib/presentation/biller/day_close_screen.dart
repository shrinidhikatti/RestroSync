/// Day-End Close Screen — Guided flow: check unbilled → carry forward → reconcile → complete

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import '../../data/datasources/remote_datasource.dart';

enum _DayCloseStep { status, unbilled, reconcile, done }

class DayCloseScreen extends ConsumerStatefulWidget {
  const DayCloseScreen({super.key});

  @override
  ConsumerState<DayCloseScreen> createState() => _DayCloseScreenState();
}

class _DayCloseScreenState extends ConsumerState<DayCloseScreen> {
  _DayCloseStep _step = _DayCloseStep.status;
  Map<String, dynamic>? _status;
  Map<String, dynamic>? _unbilled;
  bool _loading = true;
  bool _acting = false;
  String _error = '';
  final _cashCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  Map<String, dynamic>? _result;

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  Future<void> _loadStatus() async {
    setState(() { _loading = true; _error = ''; });
    try {
      final res = await ref.read(dioProvider).get('/day-close/status');
      setState(() => _status = res.data as Map<String, dynamic>);
      if (_status?['status'] == 'COMPLETED') {
        setState(() => _step = _DayCloseStep.done);
      }
    } catch (e) {
      setState(() => _error = 'Failed to load status: $e');
    }
    setState(() => _loading = false);
  }

  Future<void> _loadUnbilled() async {
    setState(() { _acting = true; _error = ''; });
    try {
      final res = await ref.read(dioProvider).get('/day-close/unbilled');
      final data = res.data as Map<String, dynamic>;
      setState(() { _unbilled = data; _step = _DayCloseStep.unbilled; });
    } catch (e) {
      setState(() => _error = 'Error: $e');
    }
    setState(() => _acting = false);
  }

  Future<void> _carryForward() async {
    setState(() { _acting = true; _error = ''; });
    try {
      await ref.read(dioProvider).post('/day-close/carry-forward', data: {});
      await _loadUnbilled();
    } catch (e) {
      setState(() => _error = 'Carry forward failed: $e');
    }
    setState(() => _acting = false);
  }

  Future<void> _initiate() async {
    setState(() { _acting = true; _error = ''; });
    try {
      await ref.read(dioProvider).post('/day-close/initiate', data: {});
      setState(() => _step = _DayCloseStep.reconcile);
    } catch (e) {
      final msg = (e is Exception) ? e.toString() : 'Error initiating day close';
      setState(() => _error = msg.contains('UNBILLED') ? 'Open orders still exist. Carry them forward first.' : msg);
    }
    setState(() => _acting = false);
  }

  Future<void> _complete() async {
    final cash = double.tryParse(_cashCtrl.text) ?? 0;
    setState(() { _acting = true; _error = ''; });
    try {
      final res = await ref.read(dioProvider).post('/day-close/complete', data: {
        'cashInDrawer': cash,
        if (_notesCtrl.text.isNotEmpty) 'notes': _notesCtrl.text,
      });
      setState(() { _result = res.data as Map<String, dynamic>; _step = _DayCloseStep.done; });
    } catch (e) {
      setState(() => _error = 'Complete failed: $e');
    }
    setState(() => _acting = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text('Day-End Close', style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _loadStatus)],
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
        : SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Progress steps
                _StepBar(current: _step),
                const SizedBox(height: 20),

                if (_error.isNotEmpty)
                  Container(
                    margin: const EdgeInsets.only(bottom: 14),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFFCA5A5))),
                    child: Text(_error, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13)),
                  ),

                if (_step == _DayCloseStep.status) _buildStatusStep(),
                if (_step == _DayCloseStep.unbilled) _buildUnbilledStep(),
                if (_step == _DayCloseStep.reconcile) _buildReconcileStep(),
                if (_step == _DayCloseStep.done) _buildDoneStep(),
              ],
            ),
          ),
    );
  }

  Widget _buildStatusStep() {
    final isCompleted = _status?['status'] == 'COMPLETED';
    final isLocked = _status?['isLocked'] == true;
    final date = _status?['businessDate'] as String? ?? '';

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _InfoCard(
        icon: isCompleted ? Icons.check_circle : isLocked ? Icons.lock : Icons.today,
        color: isCompleted ? const Color(0xFF10B981) : isLocked ? const Color(0xFFF59E0B) : const Color(0xFF3B82F6),
        title: 'Business Date: $date',
        subtitle: isCompleted ? 'Day close completed.' : isLocked ? 'Day close in progress.' : 'Day is open. Ready to close.',
      ),
      const SizedBox(height: 20),
      if (!isCompleted) SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: _acting ? null : _loadUnbilled,
          icon: _acting ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2)) : const Icon(Icons.arrow_forward),
          label: const Text('Start Day Close'),
        ),
      ),
    ]);
  }

  Widget _buildUnbilledStep() {
    final count = _unbilled?['count'] as int? ?? 0;
    final orders = _unbilled?['orders'] as List<dynamic>? ?? [];

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _InfoCard(
        icon: count > 0 ? Icons.warning_amber : Icons.check_circle,
        color: count > 0 ? const Color(0xFFF59E0B) : const Color(0xFF10B981),
        title: count > 0 ? '$count Unbilled Order(s)' : 'No Open Orders',
        subtitle: count > 0 ? 'These orders must be billed or carried forward.' : 'All orders are closed. Ready to proceed.',
      ),

      if (orders.isNotEmpty) ...[
        const SizedBox(height: 12),
        ...orders.map((o) {
          final m = o as Map;
          return ListTile(
            dense: true,
            leading: const Icon(Icons.receipt_outlined, color: AppColors.textMuted, size: 18),
            title: Text(m['tableNumber'] != null ? 'Table ${m['tableNumber']}' : 'Token #${m['tokenNumber'] ?? '?'}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            subtitle: Text('${m['status']} • ${m['itemCount']} items', style: const TextStyle(fontSize: 11)),
            contentPadding: EdgeInsets.zero,
          );
        }),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: _acting ? null : _carryForward,
          icon: const Icon(Icons.next_plan_outlined, size: 18),
          label: const Text('Carry Forward to Tomorrow'),
          style: OutlinedButton.styleFrom(foregroundColor: AppColors.primary, side: const BorderSide(color: AppColors.primary)),
        ),
        const SizedBox(height: 8),
      ],

      const SizedBox(height: 16),
      SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          onPressed: (_acting || count > 0) ? null : _initiate,
          child: const Text('Initiate Day Close →'),
        ),
      ),
    ]);
  }

  Widget _buildReconcileStep() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const _InfoCard(
        icon: Icons.account_balance_wallet,
        color: Color(0xFF8B5CF6),
        title: 'Cash Reconciliation',
        subtitle: 'Count the cash in your drawer and enter the amount below.',
      ),
      const SizedBox(height: 16),
      const Text('Cash in Drawer (₹)', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
      const SizedBox(height: 8),
      TextField(
        controller: _cashCtrl,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: const InputDecoration(prefixText: '₹ ', hintText: '0.00'),
        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 20),
      ),
      const SizedBox(height: 12),
      const Text('Notes (optional)', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
      const SizedBox(height: 8),
      TextField(controller: _notesCtrl, decoration: const InputDecoration(hintText: 'Any variance explanation...'), maxLines: 2),
      const SizedBox(height: 20),
      SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          onPressed: (_acting || _cashCtrl.text.isEmpty) ? null : _complete,
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981), foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 16)),
          child: _acting
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
            : const Text('Complete Day Close', style: TextStyle(fontWeight: FontWeight.w800)),
        ),
      ),
    ]);
  }

  Widget _buildDoneStep() {
    final recon = _result?['reconciliation'] as Map<dynamic, dynamic>?;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const _InfoCard(
        icon: Icons.check_circle,
        color: Color(0xFF10B981),
        title: 'Day Close Complete!',
        subtitle: 'The business day has been successfully closed.',
      ),
      if (recon != null) ...[
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
          child: Column(children: [
            _SummaryRow('Expected Cash', '₹${recon['expectedCash']}'),
            _SummaryRow('Actual Cash', '₹${recon['actualCash']}'),
            _SummaryRow('Variance', '₹${recon['variance']}', color: (recon['variance'] as num) < 0 ? Colors.red : Colors.green),
            if (recon['notes'] != null) _SummaryRow('Notes', recon['notes'] as String),
          ]),
        ),
      ],
    ]);
  }

  @override
  void dispose() {
    _cashCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }
}

class _StepBar extends StatelessWidget {
  final _DayCloseStep current;
  const _StepBar({required this.current});

  @override
  Widget build(BuildContext context) {
    final steps = ['Status', 'Unbilled', 'Reconcile', 'Done'];
    final ci = _DayCloseStep.values.indexOf(current);
    return Row(
      children: List.generate(steps.length * 2 - 1, (i) {
        if (i.isOdd) return Expanded(child: Container(height: 2, color: i ~/ 2 < ci ? AppColors.primary : const Color(0xFFE2E8F0)));
        final si = i ~/ 2;
        final done = si < ci;
        final active = si == ci;
        return Container(
          width: 28, height: 28,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: done ? AppColors.primary : active ? AppColors.primary.withValues(alpha: 0.15) : const Color(0xFFF1F5F9),
            border: Border.all(color: (done || active) ? AppColors.primary : const Color(0xFFE2E8F0), width: 2),
          ),
          alignment: Alignment.center,
          child: done
            ? const Icon(Icons.check, size: 14, color: Colors.black)
            : Text('${si + 1}', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: active ? AppColors.primary : AppColors.textMuted)),
        );
      }),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  const _InfoCard({required this.icon, required this.color, required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12), border: Border.all(color: color.withValues(alpha: 0.25))),
    child: Row(children: [
      Icon(icon, color: color, size: 28),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: color)),
        const SizedBox(height: 2),
        Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
      ])),
    ]),
  );
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? color;
  const _SummaryRow(this.label, this.value, {this.color});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
      Text(value, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: color ?? AppColors.textPrimary)),
    ]),
  );
}
