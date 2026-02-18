import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../data/datasources/remote_datasource.dart';
import '../common/widgets.dart';

// ─── Login mode enum ───────────────────────────────────────────────────────────

enum _LoginMode { password, pin }

// ─── Login screen ──────────────────────────────────────────────────────────────

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  _LoginMode _mode = _LoginMode.pin;

  // Password form
  final _emailCtrl    = TextEditingController();
  final _passwordCtrl = TextEditingController();

  // PIN form
  final _pinCtrl = TextEditingController();
  String _pin    = '';

  bool   _loading = false;
  String _error   = '';

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _pinCtrl.dispose();
    super.dispose();
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  Future<void> _loginWithPassword() async {
    setState(() { _loading = true; _error = ''; });
    try {
      final remote = ref.read(remoteDataSourceProvider);
      final data   = await remote.login(
        email:    _emailCtrl.text.trim(),
        password: _passwordCtrl.text,
      );
      await _saveSessionAndNavigate(data);
    } catch (e) {
      setState(() => _error = _parseError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loginWithPin() async {
    if (_pin.length < AppConstants.pinLength) {
      setState(() => _error = 'Enter your ${AppConstants.pinLength}-digit PIN');
      return;
    }
    setState(() { _loading = true; _error = ''; });
    try {
      const storage  = FlutterSecureStorage();
      var   deviceId = await storage.read(key: AppConstants.keyDeviceId);
      if (deviceId == null) {
        deviceId = const Uuid().v4();
        await storage.write(key: AppConstants.keyDeviceId, value: deviceId);
      }

      final remote = ref.read(remoteDataSourceProvider);
      final data   = await remote.pinLogin(pin: _pin, deviceId: deviceId);
      await _saveSessionAndNavigate(data);
    } catch (e) {
      setState(() => _error = _parseError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _saveSessionAndNavigate(Map<String, dynamic> data) async {
    const storage = FlutterSecureStorage();
    await storage.write(
        key: AppConstants.keyAccessToken,
        value: data['accessToken'] as String);
    await storage.write(
        key: AppConstants.keyRefreshToken,
        value: data['refreshToken'] as String);
    await storage.write(
        key: AppConstants.keyUser,
        value: jsonEncode(data['user']));
    if (data['branchId'] != null) {
      await storage.write(
          key: AppConstants.keyBranchId,
          value: data['branchId'] as String);
    }
    if (mounted) context.go('/captain');
  }

  String _parseError(Object e) {
    final str = e.toString();
    if (str.contains('401') || str.contains('credentials') ||
        str.contains('Unauthorized')) { return 'Invalid credentials'; }
    if (str.contains('SocketException') || str.contains('Connection refused')) {
      return 'Cannot reach server. Check your connection.';
    }
    return 'Login failed. Please try again.';
  }

  void _appendPin(String digit) {
    if (_pin.length >= AppConstants.pinLength) return;
    setState(() {
      _pin += digit;
      _error = '';
    });
    if (_pin.length == AppConstants.pinLength) _loginWithPin();
  }

  void _deletePin() {
    if (_pin.isEmpty) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  // ── Build ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppColors.surfaceDark,
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Logo / Brand
                Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.restaurant_menu,
                          color: Colors.black, size: 22),
                    ),
                    const SizedBox(width: 12),
                    const Text(
                      'RestroSync',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                        letterSpacing: -0.3,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 40),

                const Text(
                  'Sign in',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Captain & Biller access',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.white.withOpacity(0.5),
                  ),
                ),

                const SizedBox(height: 28),

                // Mode switcher
                _ModeToggle(
                  mode: _mode,
                  onChanged: (m) => setState(() { _mode = m; _error = ''; _pin = ''; }),
                ),

                const SizedBox(height: 24),

                if (_error.isNotEmpty) ErrorBanner(_error),

                if (_mode == _LoginMode.pin)
                  _PinPad(
                    pin:          _pin,
                    onDigit:      _appendPin,
                    onDelete:     _deletePin,
                    loading:      _loading,
                  )
                else
                  _PasswordForm(
                    emailCtrl:    _emailCtrl,
                    passwordCtrl: _passwordCtrl,
                    loading:      _loading,
                    onSubmit:     _loginWithPassword,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Mode toggle ───────────────────────────────────────────────────────────────

class _ModeToggle extends StatelessWidget {
  final _LoginMode mode;
  final void Function(_LoginMode) onChanged;

  const _ModeToggle({required this.mode, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          _tab('PIN Login', _LoginMode.pin),
          _tab('Password', _LoginMode.password),
        ],
      ),
    );
  }

  Widget _tab(String label, _LoginMode value) {
    final active = mode == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => onChanged(value),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: active ? AppColors.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: active ? Colors.black : Colors.white60,
            ),
          ),
        ),
      ),
    );
  }
}

// ─── PIN pad ───────────────────────────────────────────────────────────────────

class _PinPad extends StatelessWidget {
  final String pin;
  final void Function(String) onDigit;
  final VoidCallback onDelete;
  final bool loading;

  const _PinPad({
    required this.pin,
    required this.onDigit,
    required this.onDelete,
    required this.loading,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Dots
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(AppConstants.pinLength, (i) {
            final filled = i < pin.length;
            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 20),
              width: 16,
              height: 16,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: filled ? AppColors.primary : Colors.transparent,
                border: Border.all(
                  color: filled ? AppColors.primary : Colors.white30,
                  width: 2,
                ),
              ),
            );
          }),
        ),

        // Numpad
        GridView.count(
          crossAxisCount: 3,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.6,
          children: [
            ...'123456789'.split('').map((d) => _PinButton(digit: d, onTap: () => onDigit(d))),
            const SizedBox.shrink(),
            _PinButton(digit: '0', onTap: () => onDigit('0')),
            _PinButton(
              icon: loading
                  ? const CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white54),
                    )
                  : const Icon(Icons.backspace_outlined, color: Colors.white60, size: 22),
              onTap: loading ? () {} : onDelete,
            ),
          ],
        ),
      ],
    );
  }
}

class _PinButton extends StatelessWidget {
  final String? digit;
  final Widget? icon;
  final VoidCallback onTap;

  const _PinButton({this.digit, this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surfaceCard,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white10),
        ),
        child: Center(
          child: digit != null
              ? Text(
                  digit!,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                )
              : icon,
        ),
      ),
    );
  }
}

// ─── Password form ─────────────────────────────────────────────────────────────

class _PasswordForm extends StatelessWidget {
  final TextEditingController emailCtrl;
  final TextEditingController passwordCtrl;
  final bool loading;
  final VoidCallback onSubmit;

  const _PasswordForm({
    required this.emailCtrl,
    required this.passwordCtrl,
    required this.loading,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _input(
          controller: emailCtrl,
          label:       'Email',
          icon:        Icons.email_outlined,
          keyboard:    TextInputType.emailAddress,
        ),
        const SizedBox(height: 14),
        _input(
          controller: passwordCtrl,
          label:       'Password',
          icon:        Icons.lock_outlined,
          obscure:     true,
        ),
        const SizedBox(height: 24),
        PrimaryButton(
          label:     'Sign In',
          onPressed: onSubmit,
          loading:   loading,
          icon:      Icons.arrow_forward,
        ),
      ],
    );
  }

  Widget _input({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    TextInputType keyboard = TextInputType.text,
    bool obscure = false,
  }) {
    return TextField(
      controller:  controller,
      keyboardType: keyboard,
      obscureText: obscure,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText:    label,
        labelStyle:   const TextStyle(color: Colors.white54),
        prefixIcon:   Icon(icon, color: Colors.white38, size: 20),
        filled:       true,
        fillColor:    AppColors.surfaceCard,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppConstants.buttonRadius),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppConstants.buttonRadius),
          borderSide: BorderSide(color: AppColors.primary, width: 1.5),
        ),
      ),
    );
  }
}
