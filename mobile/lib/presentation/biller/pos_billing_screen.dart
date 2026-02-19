/// POS Billing Screen — Split-screen: Menu (left) + Cart (right)
/// Features: category tabs, search, barcode scan, cart with 5s undo, qty control

import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../core/theme.dart';
import '../../data/datasources/remote_datasource.dart';
import '../../data/models/biller_models.dart';
import '../../services/offline_queue_service.dart';
import '../../services/clock_drift_service.dart';

class PosBillingScreen extends ConsumerStatefulWidget {
  final String? orderId;   // null = new order
  final Map<String, dynamic>? extra;

  const PosBillingScreen({super.key, this.orderId, this.extra});

  @override
  ConsumerState<PosBillingScreen> createState() => _PosBillingScreenState();
}

class _PosBillingScreenState extends ConsumerState<PosBillingScreen> with SingleTickerProviderStateMixin {
  // Menu state
  List<dynamic> _categories = [];
  List<dynamic> _menuItems = [];
  String? _selectedCategoryId;
  String _search = '';
  bool _loadingMenu = true;

  // Cart state
  List<CartItem> _cart = [];
  String? _currentOrderId;
  bool _savingCart = false;

  // Undo stack for item removes
  CartItem? _lastRemoved;
  Timer? _undoTimer;

  // Barcode scanner
  bool _scannerOpen = false;
  MobileScannerController? _scannerCtrl;

  @override
  void initState() {
    super.initState();
    _currentOrderId = widget.orderId != 'new' ? widget.orderId : null;
    _loadMenu();
    if (_currentOrderId != null) _loadExistingOrder();
    else _loadDraft();
  }

  Future<void> _loadMenu() async {
    try {
      final [catRes, menuRes] = await Future.wait([
        ref.read(dioProvider).get('/categories'),
        ref.read(dioProvider).get('/menu-items', queryParameters: {'limit': '500'}),
      ]);
      setState(() {
        _categories = catRes.data as List<dynamic>? ?? [];
        _menuItems = menuRes.data as List<dynamic>? ?? [];
        if (_categories.isNotEmpty) _selectedCategoryId = _categories.first['id'] as String;
      });
    } catch (_) {}
    setState(() => _loadingMenu = false);
  }

  Future<void> _loadExistingOrder() async {
    try {
      final res = await ref.read(dioProvider).get('/orders/${_currentOrderId!}');
      final order = BillerOrder.fromJson(res.data as Map<String, dynamic>);
      setState(() {
        _cart = order.items.where((i) => i.status != 'VOIDED').map((i) => CartItem(
          menuItemId: '',
          name: i.name,
          price: i.unitPrice,
          isVeg: true,
          qty: i.qty,
        )).toList();
      });
    } catch (_) {}
  }

  Future<void> _loadDraft() async {
    final tableId = widget.extra?['tableId'] as String?;
    if (tableId == null) return;
    final queueSvc = ref.read(offlineQueueProvider);
    final draft = await queueSvc.getDraft(tableId);
    if (draft != null) {
      final items = jsonDecode(draft) as List;
      setState(() {
        _cart = items.map((m) => CartItem(
          menuItemId: m['menuItemId'] as String,
          name:       m['name'] as String,
          price:      (m['price'] as num).toDouble(),
          isVeg:      m['isVeg'] as bool? ?? true,
          qty:        m['qty'] as int,
          notes:      m['notes'] as String?,
        )).toList();
      });
    }
  }

  Future<void> _saveDraft() async {
    final tableId = widget.extra?['tableId'] as String?;
    if (tableId == null) return;
    final queueSvc = ref.read(offlineQueueProvider);
    final data = _cart.map((c) => {
      'menuItemId': c.menuItemId, 'name': c.name, 'price': c.price,
      'isVeg': c.isVeg, 'qty': c.qty, 'notes': c.notes,
    }).toList();
    await queueSvc.saveDraft(tableId, jsonEncode(data));
  }

  void _addToCart(Map<String, dynamic> item) {
    final id = item['id'] as String;
    final existing = _cart.indexWhere((c) => c.menuItemId == id);
    setState(() {
      if (existing >= 0) {
        _cart[existing] = _cart[existing].copyWith(qty: _cart[existing].qty + 1);
      } else {
        _cart.add(CartItem(
          menuItemId: id,
          name:       item['name'] as String,
          price:      (item['price'] as num).toDouble(),
          isVeg:      (item['foodType'] as String? ?? 'VEG') == 'VEG',
        ));
      }
    });
    _saveDraft();
  }

  void _removeFromCart(int index) {
    _lastRemoved = _cart[index];
    setState(() => _cart.removeAt(index));
    _saveDraft();
    _undoTimer?.cancel();
    _undoTimer = Timer(const Duration(seconds: 5), () => setState(() => _lastRemoved = null));
  }

  void _undoRemove() {
    _undoTimer?.cancel();
    if (_lastRemoved != null) {
      setState(() { _cart.add(_lastRemoved!); _lastRemoved = null; });
      _saveDraft();
    }
  }

  void _changeQty(int index, int delta) {
    final item = _cart[index];
    if (item.qty + delta <= 0) {
      _removeFromCart(index);
    } else {
      setState(() => _cart[index] = item.copyWith(qty: item.qty + delta));
      _saveDraft();
    }
  }

  double get _cartTotal => _cart.fold(0, (sum, i) => sum + i.lineTotal);

  Future<void> _proceedToPayment() async {
    if (_cart.isEmpty) return;

    // Check clock drift before billing
    if (await ClockDriftService.isBillingBlocked()) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Billing blocked: device clock drift > 5 minutes. Sync clock first.'), backgroundColor: Colors.red),
      );
      return;
    }

    setState(() => _savingCart = true);
    try {
      final dio = ref.read(dioProvider);
      String orderId = _currentOrderId ?? '';

      if (orderId.isEmpty) {
        // Create new order
        final tableId   = widget.extra?['tableId'] as String?;
        final orderType = widget.extra?['orderType'] as String? ?? 'DINE_IN';
        final res = await dio.post('/orders', data: {
          'orderType': orderType,
          if (tableId != null) 'tableId': tableId,
        });
        orderId = (res.data as Map)['id'] as String;
        setState(() => _currentOrderId = orderId);
      }

      // Add all cart items
      for (final item in _cart) {
        await dio.post('/orders/$orderId/items', data: item.toAddItemDto());
      }

      // Generate bill
      await dio.post('/orders/$orderId/bill', data: {});

      // Navigate to payment screen
      if (mounted) context.push('/biller/payment/$orderId');

    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: ${e.toString()}'), backgroundColor: Colors.red),
      );
    } finally {
      setState(() => _savingCart = false);
    }
  }

  List<dynamic> get _filteredItems {
    var items = _selectedCategoryId != null
      ? _menuItems.where((i) => (i as Map)['categoryId'] == _selectedCategoryId).toList()
      : _menuItems;
    if (_search.isNotEmpty) {
      items = items.where((i) => (i as Map)['name'].toString().toLowerCase().contains(_search.toLowerCase())).toList();
    }
    return items;
  }

  @override
  Widget build(BuildContext context) {
    final isLandscape = MediaQuery.of(context).size.width > 600;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          _currentOrderId != null ? 'Order Billing' :
          'New ${widget.extra?['orderType'] == 'TAKEAWAY' ? 'Takeaway' : 'Table ${widget.extra?['tableNumber'] ?? ''}'} Order',
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
        ),
        actions: [
          // Barcode scan
          IconButton(
            icon: const Icon(Icons.qr_code_scanner),
            onPressed: () => setState(() => _scannerOpen = !_scannerOpen),
          ),
        ],
      ),
      body: Column(
        children: [
          if (_scannerOpen) _buildScanner(),
          Expanded(
            child: isLandscape
              ? Row(children: [
                  Expanded(flex: 3, child: _buildMenuPanel()),
                  Container(width: 1, color: const Color(0xFFE2E8F0)),
                  SizedBox(width: 300, child: _buildCartPanel()),
                ])
              : _buildMenuPanel(),
          ),
          if (!isLandscape) _buildCartBottom(),
        ],
      ),
    );
  }

  Widget _buildScanner() {
    _scannerCtrl ??= MobileScannerController();
    return SizedBox(
      height: 150,
      child: MobileScanner(
        controller: _scannerCtrl,
        onDetect: (capture) {
          final barcode = capture.barcodes.firstOrNull?.rawValue;
          if (barcode != null) {
            setState(() => _scannerOpen = false);
            _scannerCtrl?.stop();
            // Search menu items by barcode
            final match = _menuItems.where((i) => (i as Map)['barcode'] == barcode).firstOrNull;
            if (match != null) {
              _addToCart(match as Map<String, dynamic>);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Added: ${(match)['name']}'), duration: const Duration(seconds: 1)),
              );
            } else {
              setState(() => _search = barcode);
            }
          }
        },
      ),
    );
  }

  Widget _buildMenuPanel() {
    return Column(
      children: [
        // Search bar
        Padding(
          padding: const EdgeInsets.all(10),
          child: TextField(
            decoration: InputDecoration(
              hintText: 'Search menu...',
              prefixIcon: const Icon(Icons.search, size: 18),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              isDense: true,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
            ),
            onChanged: (v) => setState(() => _search = v),
          ),
        ),
        // Category tabs
        if (_categories.isNotEmpty)
          SizedBox(
            height: 36,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              itemCount: _categories.length,
              itemBuilder: (_, i) {
                final cat = _categories[i] as Map;
                final active = cat['id'] == _selectedCategoryId;
                return GestureDetector(
                  onTap: () => setState(() => _selectedCategoryId = cat['id'] as String),
                  child: Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: active ? AppColors.primary : Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: active ? AppColors.primary : const Color(0xFFE2E8F0)),
                    ),
                    child: Text(cat['name'] as String, style: TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w600,
                      color: active ? Colors.black : const Color(0xFF64748B),
                    )),
                  ),
                );
              },
            ),
          ),
        const SizedBox(height: 8),
        // Menu items grid
        Expanded(
          child: _loadingMenu
            ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
            : GridView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3, childAspectRatio: 0.85,
                  crossAxisSpacing: 8, mainAxisSpacing: 8,
                ),
                itemCount: _filteredItems.length,
                itemBuilder: (_, i) {
                  final item = _filteredItems[i] as Map;
                  final isVeg = (item['foodType'] as String? ?? 'VEG') == 'VEG';
                  return GestureDetector(
                    onTap: () => _addToCart(item as Map<String, dynamic>),
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      padding: const EdgeInsets.all(8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(children: [
                            Container(
                              width: 10, height: 10,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isVeg ? const Color(0xFF22C55E) : const Color(0xFFEF4444),
                              ),
                            ),
                            const Spacer(),
                            if (!(item['isAvailable'] as bool? ?? true))
                              const Icon(Icons.block, size: 12, color: Colors.grey),
                          ]),
                          Text(
                            item['name'] as String,
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 11),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            '₹${item['price']}',
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: AppColors.primary),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
        ),
      ],
    );
  }

  Widget _buildCartPanel() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Cart', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
              if (_cart.isNotEmpty)
                TextButton(
                  onPressed: () => setState(() => _cart.clear()),
                  child: const Text('Clear', style: TextStyle(color: Colors.red, fontSize: 12)),
                ),
            ],
          ),
        ),
        Expanded(
          child: _cart.isEmpty
            ? const Center(child: Text('Add items from menu', style: TextStyle(color: AppColors.textMuted, fontSize: 13)))
            : ListView.builder(
                padding: EdgeInsets.zero,
                itemCount: _cart.length,
                itemBuilder: (_, i) {
                  final item = _cart[i];
                  return Dismissible(
                    key: Key('${item.menuItemId}$i'),
                    direction: DismissDirection.endToStart,
                    background: Container(color: Colors.red, alignment: Alignment.centerRight, padding: const EdgeInsets.only(right: 16), child: const Icon(Icons.delete, color: Colors.white)),
                    onDismissed: (_) => _removeFromCart(i),
                    child: ListTile(
                      dense: true,
                      title: Text(item.name, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                      subtitle: Text('₹${item.price.toStringAsFixed(0)}', style: const TextStyle(fontSize: 11)),
                      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                        IconButton(icon: const Icon(Icons.remove, size: 16), padding: EdgeInsets.zero, constraints: const BoxConstraints(minWidth: 28, minHeight: 28), onPressed: () => _changeQty(i, -1)),
                        Text('${item.qty}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                        IconButton(icon: const Icon(Icons.add, size: 16), padding: EdgeInsets.zero, constraints: const BoxConstraints(minWidth: 28, minHeight: 28), onPressed: () => _changeQty(i, 1)),
                      ]),
                    ),
                  );
                },
              ),
        ),
        // Undo snackbar
        if (_lastRemoved != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            color: const Color(0xFF1E293B),
            child: Row(children: [
              Text('Removed "${_lastRemoved!.name}"', style: const TextStyle(color: Colors.white, fontSize: 12)),
              const Spacer(),
              TextButton(onPressed: _undoRemove, child: const Text('UNDO', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800))),
            ]),
          ),
        // Total + checkout
        Container(
          padding: const EdgeInsets.all(12),
          decoration: const BoxDecoration(border: Border(top: BorderSide(color: Color(0xFFE2E8F0)))),
          child: Column(children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const Text('Total', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              Text('₹${_cartTotal.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AppColors.primary)),
            ]),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _cart.isEmpty || _savingCart ? null : _proceedToPayment,
                child: _savingCart
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2))
                  : const Text('Generate Bill →'),
              ),
            ),
          ]),
        ),
      ],
    );
  }

  Widget _buildCartBottom() {
    if (_cart.isEmpty) return const SizedBox();
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10)],
      ),
      child: Row(children: [
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${_cart.length} items', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
          Text('₹${_cartTotal.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AppColors.primary)),
        ]),
        const Spacer(),
        ElevatedButton(
          onPressed: _cart.isEmpty || _savingCart ? null : _proceedToPayment,
          child: const Text('Bill →'),
        ),
      ]),
    );
  }

  @override
  void dispose() {
    _undoTimer?.cancel();
    _scannerCtrl?.dispose();
    super.dispose();
  }
}
