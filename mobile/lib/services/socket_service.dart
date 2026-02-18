import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../core/constants.dart';

// ─── Socket service provider ───────────────────────────────────────────────────

final socketServiceProvider = Provider<SocketService>((ref) => SocketService());

// ─── Socket service ────────────────────────────────────────────────────────────

class SocketService {
  io.Socket? _socket;
  String? _currentBranchId;

  bool get isConnected => _socket?.connected ?? false;

  /// Connect to branch room. Call after login.
  Future<void> connect(String branchId) async {
    if (_socket != null && _socket!.connected && _currentBranchId == branchId) {
      return; // already connected to same branch
    }
    await disconnect();

    const storage = FlutterSecureStorage();
    final token = await storage.read(key: AppConstants.keyAccessToken);

    _socket = io.io(
      AppConstants.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .enableAutoConnect()
          .setAuth({'token': token ?? ''})
          .build(),
    );

    _socket!.onConnect((_) {
      _socket!.emit('join-branch', branchId);
      _currentBranchId = branchId;
    });

    _socket!.onDisconnect((_) {
      _currentBranchId = null;
    });

    _socket!.connect();
  }

  /// Disconnect and clean up.
  Future<void> disconnect() async {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _currentBranchId = null;
  }

  /// Listen for an event. Returns a cleanup function.
  void Function() on(String event, void Function(dynamic) handler) {
    _socket?.on(event, handler);
    return () => _socket?.off(event, handler);
  }

  /// Emit an event.
  void emit(String event, [dynamic data]) {
    _socket?.emit(event, data);
  }
}
