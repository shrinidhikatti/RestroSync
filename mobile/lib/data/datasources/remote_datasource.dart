import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';
import '../models/auth_models.dart';
import '../models/menu_models.dart';
import '../models/table_models.dart';

import '../../core/constants.dart';

// ─── Dio provider ──────────────────────────────────────────────────────────────

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl: AppConstants.baseUrl,
    connectTimeout: const Duration(milliseconds: AppConstants.connectTimeout),
    receiveTimeout: const Duration(milliseconds: AppConstants.receiveTimeout),
    headers: {'Content-Type': 'application/json'},
  ));

  // Request interceptor: inject JWT + idempotency key
  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) async {
      const storage = FlutterSecureStorage();
      final token = await storage.read(key: AppConstants.keyAccessToken);
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      // Add idempotency key for mutating requests
      if (['POST', 'PUT', 'PATCH'].contains(options.method)) {
        final deviceId = await storage.read(key: AppConstants.keyDeviceId) ?? 'web';
        options.headers['X-Idempotency-Key'] = '$deviceId:${const Uuid().v4()}';
      }
      handler.next(options);
    },
    onError: (error, handler) async {
      // Silent token refresh on 401
      if (error.response?.statusCode == 401) {
        try {
          const storage = FlutterSecureStorage();
          final refreshToken = await storage.read(key: AppConstants.keyRefreshToken);
          if (refreshToken != null) {
            final refreshDio = Dio(BaseOptions(baseUrl: AppConstants.baseUrl));
            final res = await refreshDio.post('/auth/refresh', data: {'refreshToken': refreshToken});
            final tokens = AuthTokens.fromJson(res.data as Map<String, dynamic>);
            await storage.write(key: AppConstants.keyAccessToken, value: tokens.accessToken);
            await storage.write(key: AppConstants.keyRefreshToken, value: tokens.refreshToken);

            // Retry original request with new token
            error.requestOptions.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
            final retryRes = await dio.fetch(error.requestOptions);
            return handler.resolve(retryRes);
          }
        } catch (_) {
          // Refresh failed — clear tokens, caller handles redirect
          const storage = FlutterSecureStorage();
          await storage.deleteAll();
        }
      }
      handler.next(error);
    },
  ));

  return dio;
});

// ─── Remote data source ────────────────────────────────────────────────────────

final remoteDataSourceProvider = Provider<RemoteDataSource>(
  (ref) => RemoteDataSource(ref.watch(dioProvider)),
);

class RemoteDataSource {
  final Dio _dio;

  RemoteDataSource(this._dio);

  // ── Auth ────────────────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> login({
    String? email,
    String? phone,
    required String password,
  }) async {
    final res = await _dio.post('/auth/login', data: {
      if (email != null) 'email': email,
      if (phone != null) 'phone': phone,
      'password': password,
    });
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> pinLogin({
    required String pin,
    required String deviceId,
  }) async {
    final res = await _dio.post('/auth/pin-login', data: {
      'pin':      pin,
      'deviceId': deviceId,
    });
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> refreshToken(String refreshToken) async {
    final res = await _dio.post('/auth/refresh', data: {'refreshToken': refreshToken});
    return res.data as Map<String, dynamic>;
  }

  // ── Menu ─────────────────────────────────────────────────────────────────────

  Future<List<MenuCategory>> getCategories() async {
    final res = await _dio.get('/categories');
    return (res.data as List<dynamic>)
        .map((c) => MenuCategory.fromJson(c as Map<String, dynamic>))
        .toList();
  }

  Future<List<MenuItem>> getMenuItems({String? categoryId}) async {
    final res = await _dio.get(
      '/menu-items',
      queryParameters: categoryId != null ? {'categoryId': categoryId} : null,
    );
    return (res.data as List<dynamic>)
        .map((i) => MenuItem.fromJson(i as Map<String, dynamic>))
        .toList();
  }

  // ── Tables ───────────────────────────────────────────────────────────────────

  Future<List<RestaurantTable>> getTables() async {
    final res = await _dio.get('/tables');
    return (res.data as List<dynamic>)
        .map((t) => RestaurantTable.fromJson(t as Map<String, dynamic>))
        .toList();
  }

  // ── Orders ───────────────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> getOrders({
    String? status,
    String? tableId,
    int limit = 50,
  }) async {
    final res = await _dio.get('/orders', queryParameters: {
      if (status != null) 'status': status,
      if (tableId != null) 'tableId': tableId,
      'limit': limit,
    });
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getOrder(String orderId) async {
    final res = await _dio.get('/orders/$orderId');
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> createOrder({
    required String type,
    String? tableId,
    String? customerName,
    String? customerPhone,
    String? notes,
    String priority = 'NORMAL',
  }) async {
    final res = await _dio.post('/orders', data: {
      'type':      type,
      if (tableId != null) 'tableId': tableId,
      if (customerName != null) 'customerName': customerName,
      if (customerPhone != null) 'customerPhone': customerPhone,
      if (notes != null) 'notes': notes,
      'priority':  priority,
    });
    return res.data as Map<String, dynamic>;
  }

  Future<List<dynamic>> addOrderItems(
    String orderId,
    List<Map<String, dynamic>> items,
  ) async {
    final res = await _dio.post('/orders/$orderId/items', data: items);
    return res.data as List<dynamic>;
  }

  Future<List<dynamic>> generateKot(
    String orderId, {
    List<String>? orderItemIds,
  }) async {
    final res = await _dio.post('/orders/$orderId/kot', data: {
      if (orderItemIds != null) 'orderItemIds': orderItemIds,
    });
    return res.data as List<dynamic>;
  }

  Future<void> cancelOrder(String orderId, String reason) async {
    await _dio.patch('/orders/$orderId/cancel', data: {'reason': reason});
  }

  // ── Bills ─────────────────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> generateBill(String orderId) async {
    final res = await _dio.post('/orders/$orderId/bill', data: {});
    return res.data as Map<String, dynamic>;
  }
}
