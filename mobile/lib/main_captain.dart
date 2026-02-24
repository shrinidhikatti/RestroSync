import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/router.dart';
import 'core/theme.dart';
import 'services/background_sync_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await BackgroundSyncService.initialize();

  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor:           Colors.transparent,
    statusBarBrightness:      Brightness.dark,
    statusBarIconBrightness:  Brightness.dark,
  ));

  runApp(
    ProviderScope(
      overrides: [
        // Use the captain router (starts at /login instead of /biller/login)
        routerProvider.overrideWith((ref) => ref.watch(captainRouterProvider)),
      ],
      child: const CaptainApp(),
    ),
  );
}

class CaptainApp extends ConsumerWidget {
  const CaptainApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title:           'RestroSync Captain',
      debugShowCheckedModeBanner: false,
      theme:           buildAppTheme(),
      routerConfig:    router,
    );
  }
}
