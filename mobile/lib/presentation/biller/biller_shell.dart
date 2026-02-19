/// Biller Shell — Bottom navigation for the POS app
/// Tabs: Home | Billing | Orders | Day Close

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../services/print_service.dart';

class BillerShell extends ConsumerWidget {
  final Widget child;
  const BillerShell({super.key, required this.child});

  static const _tabs = [
    (label: 'Home',      icon: Icons.home_outlined,       path: '/biller'),
    (label: 'Billing',   icon: Icons.point_of_sale,        path: '/biller/tables'),
    (label: 'Orders',    icon: Icons.receipt_long_outlined, path: '/biller/orders'),
    (label: 'Day Close', icon: Icons.lock_clock_outlined,   path: '/biller/day-close'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = GoRouterState.of(context).matchedLocation;
    final printJobs = ref.watch(printServiceProvider);
    final failedPrints = printJobs.where((j) => j.status == PrintJobStatus.failed).length;

    int currentIndex = 0;
    for (int i = 0; i < _tabs.length; i++) {
      if (location.startsWith(_tabs[i].path) && (_tabs[i].path != '/biller' || location == '/biller')) {
        currentIndex = i;
      }
    }

    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 60,
            child: Row(
              children: List.generate(_tabs.length, (i) {
                final tab = _tabs[i];
                final active = currentIndex == i;
                return Expanded(
                  child: InkWell(
                    onTap: () => context.go(tab.path),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Icon(tab.icon, size: 22, color: active ? AppColors.primary : AppColors.textMuted),
                            if (tab.label == 'Billing' && failedPrints > 0)
                              Positioned(
                                right: -6, top: -4,
                                child: Container(
                                  width: 14, height: 14,
                                  decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                                  alignment: Alignment.center,
                                  child: Text('$failedPrints', style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold)),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 3),
                        Text(tab.label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: active ? AppColors.primary : AppColors.textMuted)),
                      ],
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
    );
  }
}
