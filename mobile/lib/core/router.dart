import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../presentation/auth/login_screen.dart';
import '../presentation/captain/captain_shell.dart';
import '../presentation/captain/order_taking_screen.dart';
import '../presentation/captain/order_detail_screen.dart';
import '../presentation/biller/biller_login_screen.dart';
import '../presentation/biller/biller_shell.dart';
import '../presentation/biller/pos_home_screen.dart';
import '../presentation/biller/table_selection_screen.dart';
import '../presentation/biller/pos_billing_screen.dart';
import '../presentation/biller/payment_screen.dart';
import '../presentation/biller/running_orders_screen.dart';
import '../presentation/biller/refund_screen.dart';
import '../presentation/biller/day_close_screen.dart';
import '../presentation/biller/sync_screen.dart';
import '../presentation/biller/printer_setup_screen.dart';
import 'constants.dart';

// ─── Router provider ───────────────────────────────────────────────────────────

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/biller/login',
    redirect: (context, state) async {
      const storage = FlutterSecureStorage();
      final token = await storage.read(key: AppConstants.keyAccessToken);
      final loc = state.matchedLocation;

      // Public routes — no auth needed
      if (loc == '/biller/login' || loc == '/login') {
        if (token != null) return '/biller';
        return null;
      }

      // Protected routes
      if (token == null) return '/biller/login';
      return null;
    },
    routes: [
      // ─── Captain App (legacy) ─────────────────────────────────────────────
      GoRoute(
        path: '/login',
        name: 'captain-login',
        builder: (context, state) => const LoginScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) => CaptainShell(child: child),
        routes: [
          GoRoute(path: '/captain', name: 'captain', builder: (context, state) => const SizedBox.shrink()),
          GoRoute(
            path: '/captain/new-order',
            name: 'new-order',
            builder: (context, state) {
              final extra = state.extra as Map<String, dynamic>? ?? {};
              return OrderTakingScreen(
                tableId:   extra['tableId'] as String?,
                tableName: extra['tableName'] as String?,
                orderType: (extra['orderType'] as String?) ?? 'DINE_IN',
              );
            },
          ),
          GoRoute(
            path: '/captain/order/:orderId',
            name: 'order-detail',
            builder: (context, state) => OrderDetailScreen(orderId: state.pathParameters['orderId']!),
          ),
        ],
      ),

      // ─── Biller / POS App ─────────────────────────────────────────────────
      GoRoute(
        path: '/biller/login',
        name: 'biller-login',
        builder: (context, state) => const BillerLoginScreen(),
      ),

      // Full-screen overlays (no shell)
      GoRoute(
        path: '/biller/billing/:orderId',
        name: 'pos-billing',
        builder: (context, state) => PosBillingScreen(
          orderId: state.pathParameters['orderId'],
          extra:   state.extra as Map<String, dynamic>?,
        ),
      ),
      GoRoute(
        path: '/biller/payment/:orderId',
        name: 'payment',
        builder: (context, state) => PaymentScreen(orderId: state.pathParameters['orderId']!),
      ),
      GoRoute(
        path: '/biller/refund',
        name: 'refund',
        builder: (context, state) => const RefundScreen(),
      ),
      GoRoute(
        path: '/biller/sync',
        name: 'sync',
        builder: (context, state) => const SyncScreen(),
      ),
      GoRoute(
        path: '/biller/printer',
        name: 'printer',
        builder: (context, state) => const PrinterSetupScreen(),
      ),

      // Shell routes (with bottom nav)
      ShellRoute(
        builder: (context, state, child) => BillerShell(child: child),
        routes: [
          GoRoute(
            path: '/biller',
            name: 'biller-home',
            builder: (context, state) => const PosHomeScreen(),
          ),
          GoRoute(
            path: '/biller/tables',
            name: 'table-selection',
            builder: (context, state) => const TableSelectionScreen(),
          ),
          GoRoute(
            path: '/biller/orders',
            name: 'running-orders',
            builder: (context, state) => const RunningOrdersScreen(),
          ),
          GoRoute(
            path: '/biller/day-close',
            name: 'day-close',
            builder: (context, state) => const DayCloseScreen(),
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(child: Text('Page not found: ${state.uri}')),
    ),
  );
});
