/// Background Sync Service
/// - WorkManager: 15-min periodic sync when app is backgrounded
/// - ForegroundTask: persistent notification during financial data sync
/// - Battery optimization whitelist prompt on first launch (Xiaomi/Oppo/Vivo)

import 'package:flutter/material.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:workmanager/workmanager.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:dio/dio.dart';
import '../core/constants.dart';
import 'offline_queue_service.dart';

// ─── WorkManager task name ────────────────────────────────────────────────────
const _kBgSyncTask   = 'restrosync.background_sync';
const _kFirstLaunch  = 'background_sync_first_launch';

// ─── Top-level callback (must be a top-level function for WorkManager) ────────

@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((taskName, inputData) async {
    if (taskName == _kBgSyncTask) {
      await _runBackgroundSync();
    }
    return true;
  });
}

Future<void> _runBackgroundSync() async {
  const storage = FlutterSecureStorage();
  final token = await storage.read(key: AppConstants.keyAccessToken);
  if (token == null) return; // not logged in — skip

  final baseUrl = AppConstants.baseUrl;
  final dio = Dio(BaseOptions(
    baseUrl: baseUrl,
    headers: {'Authorization': 'Bearer $token'},
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
  ));

  final queueSvc = OfflineQueueService.instance;
  final pending  = await queueSvc.getPending();
  if (pending.isEmpty) return;

  for (final item in pending) {
    await queueSvc.markSyncing(item.id);
    try {
      switch (item.method) {
        case 'POST':   await dio.post(item.path, data: item.body);  break;
        case 'PATCH':  await dio.patch(item.path, data: item.body); break;
        case 'DELETE': await dio.delete(item.path);                 break;
      }
      await queueSvc.markDone(item.id);
    } catch (_) {
      await queueSvc.markFailed(item.id);
    }
  }
}

// ─── ForegroundTask handler ───────────────────────────────────────────────────

class _SyncTaskHandler extends TaskHandler {
  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {
    await _runBackgroundSync();
    await FlutterForegroundTask.stopService();
  }

  @override
  void onRepeatEvent(DateTime timestamp) {}

  @override
  Future<void> onDestroy(DateTime timestamp) async {}
}

// ─── Public API ───────────────────────────────────────────────────────────────

class BackgroundSyncService {
  BackgroundSyncService._();

  /// Call once from main() before runApp()
  static Future<void> initialize() async {
    await Workmanager().initialize(callbackDispatcher, isInDebugMode: false);
    await Workmanager().registerPeriodicTask(
      _kBgSyncTask,
      _kBgSyncTask,
      frequency: const Duration(minutes: 15),
      constraints: Constraints(
        networkType: NetworkType.connected,
        requiresBatteryNotLow: false,
      ),
      existingWorkPolicy: ExistingWorkPolicy.keep,
    );

    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'restrosync_sync',
        channelName: 'RestroSync Sync',
        channelDescription: 'Syncing pending orders and offline data.',
        channelImportance: NotificationChannelImportance.LOW,
        priority: NotificationPriority.LOW,
      ),
      iosNotificationOptions: const IOSNotificationOptions(
        showNotification: true,
        playSound: false,
      ),
      foregroundTaskOptions: ForegroundTaskOptions(
        eventAction: ForegroundTaskEventAction.nothing(),
        autoRunOnBoot: false,
        allowWifiLock: true,
      ),
    );
  }

  /// Show foreground notification and run sync (for when user explicitly triggers sync
  /// or when the app detects pending items on resume).
  static Future<void> syncWithNotification(int pendingCount) async {
    if (await FlutterForegroundTask.isRunningService) return;

    await FlutterForegroundTask.startService(
      notificationTitle: 'RestroSync — Syncing…',
      notificationText: 'Syncing $pendingCount pending order${pendingCount != 1 ? "s" : ""}…',
      callback: _startForegroundSyncTask,
    );
  }

  /// Prompt battery optimization whitelist on first launch (needed for Xiaomi/Oppo/Vivo).
  static Future<void> requestBatteryOptimizationIfNeeded(BuildContext context) async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_kFirstLaunch) == true) return;
    await prefs.setBool(_kFirstLaunch, true);

    final canIgnore = await FlutterForegroundTask.canDrawOverlays;
    if (!canIgnore && context.mounted) {
      showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Background Sync'),
          content: const Text(
            'For reliable offline sync, RestroSync needs to run in the background.\n\n'
            'Please tap "Allow" and disable battery optimization for this app.',
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Later')),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(context);
                await FlutterForegroundTask.openSystemAlertWindowSettings();
              },
              child: const Text('Allow'),
            ),
          ],
        ),
      );
    }
  }
}

@pragma('vm:entry-point')
void _startForegroundSyncTask() {
  FlutterForegroundTask.setTaskHandler(_SyncTaskHandler());
}
