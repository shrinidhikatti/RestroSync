/// Clock Drift Detection
/// POS devices must have their clock within 5 minutes of server time.
/// If drift > 5 min, billing is blocked.

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/constants.dart';

class ClockDriftService {
  static const int _maxDriftMinutes = 5;
  static Duration? _lastKnownDrift;
  static DateTime? _lastChecked;

  /// Fetch server time and compute drift. Returns drift duration.
  static Future<Duration> checkDrift() async {
    final localBefore = DateTime.now();
    try {
      final dio = Dio(BaseOptions(
        baseUrl: AppConstants.baseUrl,
        connectTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 5),
      ));
      final res = await dio.get('/time');
      final localAfter = DateTime.now();
      final latency = localAfter.difference(localBefore);
      final serverTime = DateTime.parse(res.data['serverTime'] as String);
      // Adjust for network latency (half round-trip)
      final adjustedServer = serverTime.add(latency ~/ 2);
      final drift = localAfter.difference(adjustedServer).abs();
      _lastKnownDrift = drift;
      _lastChecked = DateTime.now();
      return drift;
    } catch (_) {
      // If we can't reach server, return last known drift or zero
      return _lastKnownDrift ?? Duration.zero;
    }
  }

  /// Returns true if billing should be blocked due to clock drift
  static Future<bool> isBillingBlocked() async {
    // Re-check if last check was > 10 minutes ago
    if (_lastChecked == null || DateTime.now().difference(_lastChecked!).inMinutes > 10) {
      await checkDrift();
    }
    final drift = _lastKnownDrift ?? Duration.zero;
    return drift.inMinutes >= _maxDriftMinutes;
  }

  static Duration? get lastKnownDrift => _lastKnownDrift;
  static int get maxDriftMinutes => _maxDriftMinutes;
}

// Provider for reactive drift state
class DriftState {
  final Duration drift;
  final bool isBlocking;
  final bool isChecking;

  const DriftState({
    this.drift = Duration.zero,
    this.isBlocking = false,
    this.isChecking = false,
  });

  DriftState copyWith({Duration? drift, bool? isBlocking, bool? isChecking}) => DriftState(
    drift: drift ?? this.drift,
    isBlocking: isBlocking ?? this.isBlocking,
    isChecking: isChecking ?? this.isChecking,
  );

  String get driftLabel {
    final s = drift.inSeconds;
    if (s < 60) return '${s}s';
    return '${drift.inMinutes}m ${s % 60}s';
  }
}

class DriftNotifier extends StateNotifier<DriftState> {
  DriftNotifier() : super(const DriftState());

  Future<void> check() async {
    state = state.copyWith(isChecking: true);
    final d = await ClockDriftService.checkDrift();
    state = DriftState(drift: d, isBlocking: d.inMinutes >= 5, isChecking: false);
  }
}

final driftProvider = StateNotifierProvider<DriftNotifier, DriftState>((ref) => DriftNotifier());
