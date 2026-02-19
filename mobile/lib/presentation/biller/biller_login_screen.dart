/// Biller Login Screen — PIN (fast) + Email/Password (fallback)
/// Supports device registration for first-time setup.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:dio/dio.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../services/clock_drift_service.dart';
import '../../services/background_sync_service.dart';

enum _LoginMode { pin, email }

class BillerLoginScreen extends ConsumerStatefulWidget {
  const BillerLoginScreen({super.key});

  @override
  ConsumerState<BillerLoginScreen> createState() => _BillerLoginScreenState();
}

class _BillerLoginScreenState extends ConsumerState<BillerLoginScreen> {
  _LoginMode _mode = _LoginMode.pin;
  final _pinController    = TextEditingController();
  final _emailController  = TextEditingController();
  final _passController   = TextEditingController();
  final _deviceIdController = TextEditingController();
  bool _loading = false;
  String _error = '';
  String _enteredPin = '';

  @override
  void initState() {
    super.initState();
    _checkExistingToken();
    // Check clock drift on startup
    ref.read(driftProvider.notifier).check();
    // Request battery optimization whitelist if first launch (Xiaomi/Oppo/Vivo)
    WidgetsBinding.instance.addPostFrameCallback((_) {
      BackgroundSyncService.requestBatteryOptimizationIfNeeded(context);
    });
  }

  Future<void> _checkExistingToken() async {
    const storage = FlutterSecureStorage();
    final token = await storage.read(key: AppConstants.keyAccessToken);
    if (token != null && mounted) {
      context.go('/biller');
    }
  }

  Future<void> _loginWithPin() async {
    if (_enteredPin.length != 4) return;
    setState(() { _loading = true; _error = ''; });

    const storage = FlutterSecureStorage();
    final deviceId = await storage.read(key: AppConstants.keyDeviceId) ?? '';
    if (deviceId.isEmpty) {
      setState(() { _error = 'Device not registered. Use email login to register.'; _loading = false; });
      return;
    }

    try {
      final dio = Dio(BaseOptions(baseUrl: AppConstants.baseUrl));
      final res = await dio.post('/auth/pin-login', data: {'pin': _enteredPin, 'deviceId': deviceId});
      await _saveTokens(res.data as Map<String, dynamic>);
      if (mounted) context.go('/biller');
    } on DioException catch (e) {
      setState(() { _error = (e.response?.data as Map?)?.containsKey('userMessage') == true
        ? e.response!.data['userMessage'] as String
        : 'Invalid PIN. ${e.response?.data?['attemptsLeft'] != null ? "${e.response!.data['attemptsLeft']} attempts left." : ""}'; });
    } finally {
      setState(() { _loading = false; _enteredPin = ''; });
    }
  }

  Future<void> _loginWithEmail() async {
    if (_emailController.text.isEmpty || _passController.text.isEmpty) return;
    setState(() { _loading = true; _error = ''; });
    try {
      final dio = Dio(BaseOptions(baseUrl: AppConstants.baseUrl));
      final res = await dio.post('/auth/login', data: {
        'email':    _emailController.text.trim(),
        'password': _passController.text,
      });
      await _saveTokens(res.data as Map<String, dynamic>);

      // If device ID provided, register the device
      final devId = _deviceIdController.text.trim();
      if (devId.isNotEmpty) {
        const storage = FlutterSecureStorage();
        final token = await storage.read(key: AppConstants.keyAccessToken);
        await storage.write(key: AppConstants.keyDeviceId, value: devId);
        final branchId = await storage.read(key: AppConstants.keyBranchId);
        if (branchId != null) {
          try {
            final authDio = Dio(BaseOptions(
              baseUrl: AppConstants.baseUrl,
              headers: {'Authorization': 'Bearer $token'},
            ));
            await authDio.post('/auth/register-device', data: {
              'name':     'POS Biller - $devId',
              'branchId': branchId,
              'deviceFingerprint': devId,
            });
            await storage.write(key: AppConstants.keyDeviceId, value: devId);
          } catch (_) {}
        }
      }

      if (mounted) context.go('/biller');
    } on DioException catch (e) {
      setState(() { _error = (e.response?.data as Map?)?.containsKey('userMessage') == true
        ? e.response!.data['userMessage'] as String
        : 'Login failed. Check credentials.'; });
    } finally {
      setState(() { _loading = false; });
    }
  }

  Future<void> _saveTokens(Map<String, dynamic> data) async {
    const storage = FlutterSecureStorage();
    await storage.write(key: AppConstants.keyAccessToken, value: data['accessToken'] as String);
    await storage.write(key: AppConstants.keyRefreshToken, value: data['refreshToken'] as String);
    if (data['user'] != null) {
      final user = data['user'] as Map;
      if (user['branchId'] != null) {
        await storage.write(key: AppConstants.keyBranchId, value: user['branchId'] as String);
      }
    }
  }

  void _onPinKey(String digit) {
    if (_enteredPin.length >= 4) return;
    setState(() { _enteredPin += digit; });
    if (_enteredPin.length == 4) {
      HapticFeedback.lightImpact();
      _loginWithPin();
    }
  }

  void _onPinDelete() {
    if (_enteredPin.isEmpty) return;
    setState(() { _enteredPin = _enteredPin.substring(0, _enteredPin.length - 1); });
  }

  @override
  Widget build(BuildContext context) {
    final drift = ref.watch(driftProvider);
    return Scaffold(
      backgroundColor: AppColors.surfaceDark,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 32, 24, 0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(
                      width: 44, height: 44,
                      decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(12)),
                      alignment: Alignment.center,
                      child: const Text('RS', style: TextStyle(fontWeight: FontWeight.w800, color: Colors.black, fontSize: 16)),
                    ),
                    const SizedBox(height: 12),
                    const Text('RestroSync', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 22)),
                    const Text('Biller / POS', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
                  ]),
                  // Clock drift indicator
                  if (!drift.isChecking && drift.drift > Duration.zero)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: drift.isBlocking ? const Color(0x33EF4444) : const Color(0x2210B981),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: drift.isBlocking ? const Color(0xFFEF4444) : const Color(0xFF10B981), width: 1),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.access_time, size: 12, color: drift.isBlocking ? const Color(0xFFEF4444) : const Color(0xFF10B981)),
                          const SizedBox(width: 4),
                          Text(
                            drift.isBlocking ? '⚠ Clock drift ${drift.driftLabel}' : '✓ Sync OK',
                            style: TextStyle(fontSize: 11, color: drift.isBlocking ? const Color(0xFFEF4444) : const Color(0xFF10B981)),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),

            const Spacer(),

            // Login mode tabs
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(12)),
                child: Row(
                  children: [_LoginMode.pin, _LoginMode.email].map((m) {
                    final active = _mode == m;
                    return Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() { _mode = m; _error = ''; _enteredPin = ''; }),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: active ? AppColors.primary : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            m == _LoginMode.pin ? 'PIN Login' : 'Email Login',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                              color: active ? Colors.black : const Color(0xFF94A3B8),
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),

            const SizedBox(height: 32),

            if (_mode == _LoginMode.pin) _buildPinLogin() else _buildEmailLogin(),

            const Spacer(),
          ],
        ),
      ),
    );
  }

  Widget _buildPinLogin() {
    return Column(
      children: [
        // PIN dots
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(4, (i) {
            final filled = i < _enteredPin.length;
            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 10),
              width: 18, height: 18,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: filled ? AppColors.primary : const Color(0xFF334155),
                border: Border.all(color: filled ? AppColors.primary : const Color(0xFF475569), width: 2),
              ),
            );
          }),
        ),
        const SizedBox(height: 8),
        if (_error.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 4),
            child: Text(_error, style: const TextStyle(color: Color(0xFFEF4444), fontSize: 13), textAlign: TextAlign.center),
          ),
        const SizedBox(height: 24),
        // Numpad
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3, childAspectRatio: 1.6, mainAxisSpacing: 12, crossAxisSpacing: 12,
            ),
            itemCount: 12,
            itemBuilder: (context, i) {
              final digits = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
              final d = digits[i];
              if (d.isEmpty) return const SizedBox();
              return GestureDetector(
                onTap: () { HapticFeedback.selectionClick(); d == '⌫' ? _onPinDelete() : _onPinKey(d); },
                child: Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF334155)),
                  ),
                  alignment: Alignment.center,
                  child: _loading && d != '⌫'
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2))
                    : Text(d, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w600)),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildEmailLogin() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          _DarkInput(controller: _emailController, hint: 'Email', keyboardType: TextInputType.emailAddress),
          const SizedBox(height: 12),
          _DarkInput(controller: _passController, hint: 'Password', obscure: true),
          const SizedBox(height: 12),
          _DarkInput(controller: _deviceIdController, hint: 'Device ID (optional, for PIN setup)'),
          if (_error.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(_error, style: const TextStyle(color: Color(0xFFEF4444), fontSize: 13), textAlign: TextAlign.center),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _loading ? null : _loginWithEmail,
              child: _loading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2))
                : const Text('Sign In'),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _pinController.dispose();
    _emailController.dispose();
    _passController.dispose();
    _deviceIdController.dispose();
    super.dispose();
  }
}

class _DarkInput extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final bool obscure;
  final TextInputType? keyboardType;

  const _DarkInput({required this.controller, required this.hint, this.obscure = false, this.keyboardType});

  @override
  Widget build(BuildContext context) => TextField(
    controller: controller,
    obscureText: obscure,
    keyboardType: keyboardType,
    style: const TextStyle(color: Colors.white),
    decoration: InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: Color(0xFF64748B)),
      filled: true,
      fillColor: const Color(0xFF1E293B),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF334155))),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF334155))),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary, width: 2)),
    ),
  );
}
