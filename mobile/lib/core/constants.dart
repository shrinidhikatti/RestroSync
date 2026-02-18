/// App-wide constants for RestroSync mobile app
class AppConstants {
  // ─── API ──────────────────────────────────────────────────────────────────────
  /// Change this to your server IP when running on a physical device.
  /// For emulator: http://10.0.2.2:3000/api/v1
  /// For physical device: http://<your-machine-ip>:3000/api/v1
  static const String baseUrl = 'http://10.0.2.2:3000/api/v1';
  static const String socketUrl = 'http://10.0.2.2:3000';
  static const int connectTimeout = 15000; // ms
  static const int receiveTimeout = 15000; // ms

  // ─── Storage keys ─────────────────────────────────────────────────────────────
  static const String keyAccessToken  = 'access_token';
  static const String keyRefreshToken = 'refresh_token';
  static const String keyUser         = 'user_json';
  static const String keyDeviceId     = 'device_id';
  static const String keyBranchId     = 'branch_id';

  // ─── Business rules ───────────────────────────────────────────────────────────
  static const int businessDayCutoffHour = 5; // 5 AM
  static const int pinLength = 4;
  static const int maxPinAttempts = 5;
  static const int pinLockoutMinutes = 15;

  // ─── Sync ─────────────────────────────────────────────────────────────────────
  static const int syncBatchSize = 5;
  static const int syncIntervalMs = 500; // between batches
  static const List<int> syncRetryDelays = [1000, 2000, 4000, 8000, 16000]; // ms

  // ─── UI ───────────────────────────────────────────────────────────────────────
  static const double cardRadius = 16.0;
  static const double buttonRadius = 14.0;
}
