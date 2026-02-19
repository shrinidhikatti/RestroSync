/// Print Queue Service — simulates ESC/POS print queue with retry logic.
/// Real implementation would integrate with a Bluetooth/LAN printer SDK.
/// This provides the queue mechanism: retry up to 3 times with backoff.

import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum PrintJobStatus { pending, printing, done, failed }

class PrintJob {
  final String id;
  final String type;     // RECEIPT, KOT, TEST
  final String content;  // Formatted print content
  final int retryCount;
  final PrintJobStatus status;
  final DateTime createdAt;

  const PrintJob({
    required this.id,
    required this.type,
    required this.content,
    this.retryCount = 0,
    this.status = PrintJobStatus.pending,
    required this.createdAt,
  });

  PrintJob copyWith({PrintJobStatus? status, int? retryCount}) => PrintJob(
    id:         id,
    type:       type,
    content:    content,
    retryCount: retryCount ?? this.retryCount,
    status:     status ?? this.status,
    createdAt:  createdAt,
  );
}

class PrintService extends StateNotifier<List<PrintJob>> {
  static const int _maxRetries = 3;
  static const List<int> _retryDelays = [1000, 2000, 4000]; // ms
  bool _printerConnected = false;

  PrintService() : super([]);

  bool get isPrinterConnected => _printerConnected;

  /// Simulate printer connection
  Future<bool> connect(String printerIp) async {
    await Future.delayed(const Duration(milliseconds: 800));
    // In production: use flutter_blue_plus or esc_pos_printer
    _printerConnected = printerIp.isNotEmpty;
    return _printerConnected;
  }

  void disconnect() {
    _printerConnected = false;
  }

  /// Queue a print job. Processing starts immediately.
  Future<void> enqueuePrint({required String id, required String type, required String content}) async {
    final job = PrintJob(id: id, type: type, content: content, createdAt: DateTime.now());
    state = [...state, job];
    _processJob(job);
  }

  Future<void> _processJob(PrintJob job) async {
    _updateJob(job.id, status: PrintJobStatus.printing);

    for (int attempt = 0; attempt <= _maxRetries; attempt++) {
      if (attempt > 0) {
        final delay = _retryDelays[attempt - 1 < _retryDelays.length ? attempt - 1 : _retryDelays.length - 1];
        await Future.delayed(Duration(milliseconds: delay));
      }

      final success = await _sendToPrinter(job.content);
      if (success) {
        _updateJob(job.id, status: PrintJobStatus.done, retryCount: attempt);
        return;
      }
      _updateJob(job.id, retryCount: attempt + 1);
    }

    _updateJob(job.id, status: PrintJobStatus.failed, retryCount: _maxRetries);
  }

  Future<bool> _sendToPrinter(String content) async {
    // Simulate print attempt — in production, write ESC/POS bytes to printer socket
    await Future.delayed(const Duration(milliseconds: 300));
    return _printerConnected; // Succeeds only if connected
  }

  void _updateJob(String id, {PrintJobStatus? status, int? retryCount}) {
    state = state.map((j) => j.id == id ? j.copyWith(status: status, retryCount: retryCount) : j).toList();
  }

  void clearCompleted() {
    state = state.where((j) => j.status != PrintJobStatus.done).toList();
  }

  int get pendingCount => state.where((j) => j.status == PrintJobStatus.pending || j.status == PrintJobStatus.printing).length;
  int get failedCount => state.where((j) => j.status == PrintJobStatus.failed).length;

  /// Format a bill for printing (plain text ESC/POS style)
  static String formatBill({
    required String billNumber,
    required String restaurantName,
    required List<Map<String, dynamic>> items,
    required double subtotal,
    required double tax,
    required double total,
    required String paymentMethod,
  }) {
    final sb = StringBuffer();
    sb.writeln('================================');
    sb.writeln('  $restaurantName');
    sb.writeln('================================');
    sb.writeln('Bill: $billNumber');
    sb.writeln('Date: ${DateTime.now().toString().substring(0, 16)}');
    sb.writeln('--------------------------------');
    for (final item in items) {
      final name = (item['name'] as String).padRight(20);
      final qty  = 'x${item['qty']}';
      final price = '₹${item['total']}';
      sb.writeln('$name $qty  $price');
    }
    sb.writeln('--------------------------------');
    sb.writeln('Subtotal:'.padRight(28) + '₹${subtotal.toStringAsFixed(2)}');
    sb.writeln('Tax:'.padRight(28) + '₹${tax.toStringAsFixed(2)}');
    sb.writeln('TOTAL:'.padRight(28) + '₹${total.toStringAsFixed(2)}');
    sb.writeln('Payment: $paymentMethod');
    sb.writeln('================================');
    sb.writeln('Thank you! Visit again.');
    sb.writeln('================================');
    return sb.toString();
  }

  /// Format a KOT for printing
  static String formatKot({
    required String kotNumber,
    required String tableInfo,
    required List<Map<String, dynamic>> items,
  }) {
    final sb = StringBuffer();
    sb.writeln('======= KOT =======');
    sb.writeln('KOT: $kotNumber');
    sb.writeln('Table: $tableInfo');
    sb.writeln('Time: ${TimeOfDayHelper.now()}');
    sb.writeln('-------------------');
    for (final item in items) {
      sb.writeln('${item['qty']}x ${item['name']}');
      if (item['notes'] != null) sb.writeln('   >> ${item['notes']}');
    }
    sb.writeln('===================');
    return sb.toString();
  }
}

class TimeOfDayHelper {
  static String now() {
    final t = DateTime.now();
    return '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
  }
}

final printServiceProvider = StateNotifierProvider<PrintService, List<PrintJob>>((ref) => PrintService());
