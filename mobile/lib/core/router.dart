import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../presentation/auth/login_screen.dart';
import '../presentation/captain/captain_shell.dart';
import '../presentation/captain/order_taking_screen.dart';
import '../presentation/captain/order_detail_screen.dart';
import 'constants.dart';

// ─── Router provider ───────────────────────────────────────────────────────────

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) async {
      const storage = FlutterSecureStorage();
      final token = await storage.read(key: AppConstants.keyAccessToken);
      final onAuth = state.matchedLocation == '/login';

      if (token == null && !onAuth) return '/login';
      if (token != null && onAuth) return '/captain';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) => CaptainShell(child: child),
        routes: [
          GoRoute(
            path: '/captain',
            name: 'captain',
            builder: (context, state) => const SizedBox.shrink(),
          ),
          GoRoute(
            path: '/captain/new-order',
            name: 'new-order',
            builder: (context, state) {
              final extra = state.extra as Map<String, dynamic>? ?? {};
              return OrderTakingScreen(
                tableId:     extra['tableId'] as String?,
                tableName:   extra['tableName'] as String?,
                orderType:   (extra['orderType'] as String?) ?? 'DINE_IN',
              );
            },
          ),
          GoRoute(
            path: '/captain/order/:orderId',
            name: 'order-detail',
            builder: (context, state) => OrderDetailScreen(
              orderId: state.pathParameters['orderId']!,
            ),
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Text('Page not found: ${state.uri}'),
      ),
    ),
  );
});
