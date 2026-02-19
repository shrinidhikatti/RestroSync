import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/router.dart';
import 'core/theme.dart';
import 'services/background_sync_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize WorkManager + ForegroundTask for background sync
  await BackgroundSyncService.initialize();

  // Force portrait orientation for phone
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Status bar style
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor:      Colors.transparent,
    statusBarBrightness: Brightness.dark,
    statusBarIconBrightness: Brightness.dark,
  ));

  runApp(
    // ProviderScope makes all Riverpod providers available
    const ProviderScope(child: RestroSyncApp()),
  );
}

class RestroSyncApp extends ConsumerWidget {
  const RestroSyncApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title:           'RestroSync',
      debugShowCheckedModeBanner: false,
      theme:           buildAppTheme(),
      routerConfig:    router,
    );
  }
}
