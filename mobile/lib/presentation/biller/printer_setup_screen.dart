/// Printer Setup Screen — Configure receipt printer IP, test connection, manage print queue

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/theme.dart';
import '../../services/print_service.dart';
import 'package:uuid/uuid.dart';

class PrinterSetupScreen extends ConsumerStatefulWidget {
  const PrinterSetupScreen({super.key});

  @override
  ConsumerState<PrinterSetupScreen> createState() => _PrinterSetupScreenState();
}

class _PrinterSetupScreenState extends ConsumerState<PrinterSetupScreen> {
  final _ipCtrl   = TextEditingController();
  final _portCtrl = TextEditingController(text: '9100');
  bool _connecting = false;
  bool _connected = false;
  String _status = '';
  String _printerName = '';

  static const _kPrinterIp   = 'printer_ip';
  static const _kPrinterPort = 'printer_port';
  static const _kPrinterName = 'printer_name';

  @override
  void initState() {
    super.initState();
    _loadSaved();
  }

  Future<void> _loadSaved() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _ipCtrl.text = prefs.getString(_kPrinterIp) ?? '';
      _portCtrl.text = prefs.getString(_kPrinterPort) ?? '9100';
      _printerName = prefs.getString(_kPrinterName) ?? '';
      _connected = _ipCtrl.text.isNotEmpty && _printerName.isNotEmpty;
    });
  }

  Future<void> _connect() async {
    final ip = _ipCtrl.text.trim();
    if (ip.isEmpty) return;
    setState(() { _connecting = true; _status = ''; });

    final printSvc = ref.read(printServiceProvider.notifier);
    final ok = await printSvc.connect('$ip:${_portCtrl.text}');

    if (ok) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kPrinterIp, ip);
      await prefs.setString(_kPrinterPort, _portCtrl.text);
      await prefs.setString(_kPrinterName, 'Printer @ $ip');
      setState(() { _connected = true; _printerName = 'Printer @ $ip'; _status = 'Connected!'; });
    } else {
      setState(() { _status = 'Could not connect to printer at $ip.'; });
    }
    setState(() => _connecting = false);
  }

  Future<void> _testPrint() async {
    final printSvc = ref.read(printServiceProvider.notifier);
    await printSvc.enqueuePrint(
      id: const Uuid().v4(),
      type: 'TEST',
      content: '''================================
  TEST PRINT — RestroSync POS
================================
If you can read this, the printer
is connected and working correctly.
================================
${DateTime.now().toString().substring(0, 19)}
================================''',
    );
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Test print queued.'), duration: Duration(seconds: 2)),
      );
    }
  }

  Future<void> _disconnect() async {
    ref.read(printServiceProvider.notifier).disconnect();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kPrinterName);
    setState(() { _connected = false; _printerName = ''; _status = 'Disconnected.'; });
  }

  @override
  Widget build(BuildContext context) {
    final jobs = ref.watch(printServiceProvider);
    final pending = jobs.where((j) => j.status == PrintJobStatus.pending || j.status == PrintJobStatus.printing).length;
    final failed  = jobs.where((j) => j.status == PrintJobStatus.failed).length;

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text('Printer Setup', style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          if (jobs.isNotEmpty)
            TextButton.icon(
              onPressed: () => ref.read(printServiceProvider.notifier).clearCompleted(),
              icon: const Icon(Icons.clear_all, size: 16),
              label: const Text('Clear done', style: TextStyle(fontSize: 12)),
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Connection card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Icon(Icons.print, color: _connected ? const Color(0xFF10B981) : AppColors.textMuted),
                    const SizedBox(width: 8),
                    Text(_connected ? _printerName : 'No printer connected', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: _connected ? const Color(0xFF10B981) : AppColors.textMuted)),
                    const Spacer(),
                    Container(
                      width: 10, height: 10,
                      decoration: BoxDecoration(shape: BoxShape.circle, color: _connected ? const Color(0xFF10B981) : const Color(0xFFEF4444)),
                    ),
                  ]),
                  const SizedBox(height: 16),
                  Row(children: [
                    Expanded(
                      flex: 3,
                      child: TextField(
                        controller: _ipCtrl,
                        decoration: const InputDecoration(labelText: 'Printer IP', hintText: '192.168.1.100', isDense: true),
                        keyboardType: TextInputType.number,
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      width: 70,
                      child: TextField(
                        controller: _portCtrl,
                        decoration: const InputDecoration(labelText: 'Port', isDense: true),
                        keyboardType: TextInputType.number,
                      ),
                    ),
                  ]),
                  if (_status.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Text(_status, style: TextStyle(fontSize: 12, color: _connected ? const Color(0xFF16A34A) : Colors.red)),
                    ),
                  const SizedBox(height: 16),
                  Row(children: [
                    ElevatedButton(
                      onPressed: _connecting ? null : (_connected ? _disconnect : _connect),
                      style: _connected ? ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444), foregroundColor: Colors.white) : null,
                      child: _connecting
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2))
                        : Text(_connected ? 'Disconnect' : 'Connect'),
                    ),
                    if (_connected) ...[
                      const SizedBox(width: 10),
                      OutlinedButton.icon(
                        onPressed: _testPrint,
                        icon: const Icon(Icons.print, size: 16),
                        label: const Text('Test Print'),
                        style: OutlinedButton.styleFrom(foregroundColor: AppColors.primary, side: const BorderSide(color: AppColors.primary)),
                      ),
                    ],
                  ]),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Print queue
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const Text('Print Queue', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              Row(children: [
                Container(width: 8, height: 8, decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFF3B82F6))),
                const SizedBox(width: 4),
                Text('$pending pending', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                if (failed > 0) ...[
                  const SizedBox(width: 8),
                  Container(width: 8, height: 8, decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFFEF4444))),
                  const SizedBox(width: 4),
                  Text('$failed failed', style: const TextStyle(fontSize: 12, color: Color(0xFFEF4444))),
                ],
              ]),
            ]),

            const SizedBox(height: 10),

            if (jobs.isEmpty)
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
                child: const Center(child: Text('No print jobs', style: TextStyle(color: AppColors.textMuted, fontSize: 13))),
              )
            else
              ...jobs.map((job) {
                final icon = switch (job.status) {
                  PrintJobStatus.done     => Icons.check_circle,
                  PrintJobStatus.failed   => Icons.error_outline,
                  PrintJobStatus.printing => Icons.hourglass_top,
                  PrintJobStatus.pending  => Icons.queue,
                };
                final color = switch (job.status) {
                  PrintJobStatus.done     => const Color(0xFF10B981),
                  PrintJobStatus.failed   => const Color(0xFFEF4444),
                  PrintJobStatus.printing => const Color(0xFFF59E0B),
                  PrintJobStatus.pending  => const Color(0xFF3B82F6),
                };
                return Container(
                  margin: const EdgeInsets.only(bottom: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFE2E8F0))),
                  child: Row(children: [
                    Icon(icon, color: color, size: 20),
                    const SizedBox(width: 10),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(job.type, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                      Text('Retry ${job.retryCount}/3 • ${job.status.name}', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                    ])),
                    if (job.status == PrintJobStatus.done)
                      const Icon(Icons.check, color: Color(0xFF10B981), size: 16),
                  ]),
                );
              }),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _ipCtrl.dispose();
    _portCtrl.dispose();
    super.dispose();
  }
}
