import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../services/socket_service.dart';
import '../../services/sync_service.dart';
import 'tables_tab.dart';
import 'orders_tab.dart';

// ─── Bottom nav index provider ─────────────────────────────────────────────────

final captainNavIndexProvider = StateProvider<int>((ref) => 0);

// ─── Captain shell (hosts bottom nav + tabs) ───────────────────────────────────

class CaptainShell extends ConsumerStatefulWidget {
  final Widget child;

  const CaptainShell({super.key, required this.child});

  @override
  ConsumerState<CaptainShell> createState() => _CaptainShellState();
}

class _CaptainShellState extends ConsumerState<CaptainShell> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _connectSocket();
      ref.read(syncServiceProvider).startAutoSync();
    });
  }

  Future<void> _connectSocket() async {
    try {
      const storage = FlutterSecureStorage();
      final branchId = await storage.read(key: AppConstants.keyBranchId);
      if (branchId != null && mounted) {
        await ref.read(socketServiceProvider).connect(branchId);
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    ref.read(syncServiceProvider).stopAutoSync();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final navIndex = ref.watch(captainNavIndexProvider);

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: IndexedStack(
        index: navIndex,
        children: const [TablesTab(), OrdersTab()],
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 12,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                _NavItem(
                  icon:   Icons.grid_view_rounded,
                  label:  'Tables',
                  active: navIndex == 0,
                  onTap:  () => ref.read(captainNavIndexProvider.notifier).state = 0,
                ),
                _NavItem(
                  icon:   Icons.receipt_long_outlined,
                  label:  'My Orders',
                  active: navIndex == 1,
                  onTap:  () => ref.read(captainNavIndexProvider.notifier).state = 1,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Nav item ──────────────────────────────────────────────────────────────────

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 6),
              decoration: BoxDecoration(
                color: active
                    ? AppColors.primary.withValues(alpha: 0.12)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Icon(
                icon,
                size: 22,
                color: active ? AppColors.primary : AppColors.textMuted,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: active ? AppColors.primary : AppColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
