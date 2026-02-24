import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../../core/constants.dart';
import '../../data/datasources/remote_datasource.dart';
import '../../data/models/menu_models.dart';
import '../../data/models/order_models.dart';
import '../common/widgets.dart';

// ─── Providers ─────────────────────────────────────────────────────────────────

final categoriesProvider = FutureProvider<List<MenuCategory>>((ref) async {
  return ref.watch(remoteDataSourceProvider).getCategories();
});

final menuItemsProvider =
    FutureProvider.family<List<MenuItem>, String?>((ref, categoryId) async {
  return ref.watch(remoteDataSourceProvider).getMenuItems(categoryId: categoryId);
});

// Local cart state
final cartProvider = StateProvider<List<CartItem>>((ref) => []);
final selectedCategoryProvider = StateProvider<String?>((ref) => null);

// ─── Order taking screen ────────────────────────────────────────────────────────

class OrderTakingScreen extends ConsumerStatefulWidget {
  final String? tableId;
  final String? tableName;
  final String orderType;

  const OrderTakingScreen({
    super.key,
    this.tableId,
    this.tableName,
    this.orderType = 'DINE_IN',
  });

  @override
  ConsumerState<OrderTakingScreen> createState() => _OrderTakingScreenState();
}

class _OrderTakingScreenState extends ConsumerState<OrderTakingScreen> {
  bool _submitting = false;
  String _error    = '';

  @override
  void initState() {
    super.initState();
    // Clear cart on entry
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(cartProvider.notifier).state = [];
      ref.read(selectedCategoryProvider.notifier).state = null;
    });
  }

  // ── Cart helpers ─────────────────────────────────────────────────────────────

  void _addToCart(MenuItem item, {ItemVariant? variant, List<CartAddon> addons = const []}) {
    final cart = ref.read(cartProvider);
    final price = variant?.price ?? item.price;
    final existing = cart.indexWhere(
      (c) => c.menuItemId == item.id && c.variantId == variant?.id,
    );
    if (existing >= 0) {
      final updated = List<CartItem>.from(cart);
      updated[existing].quantity++;
      ref.read(cartProvider.notifier).state = updated;
    } else {
      ref.read(cartProvider.notifier).state = [
        ...cart,
        CartItem(
          menuItemId: item.id,
          itemName:   item.name,
          variantId:  variant?.id,
          variantName: variant?.name,
          unitPrice:  price,
          addons:     addons,
        ),
      ];
    }
  }

  void _changeQty(int index, int delta) {
    final cart    = List<CartItem>.from(ref.read(cartProvider));
    final newQty  = cart[index].quantity + delta;
    if (newQty <= 0) {
      cart.removeAt(index);
    } else {
      cart[index].quantity = newQty;
    }
    ref.read(cartProvider.notifier).state = cart;
  }

  double get _cartTotal => ref.read(cartProvider)
      .fold(0.0, (s, i) => s + i.lineTotal);

  // ── Submit ────────────────────────────────────────────────────────────────────

  Future<void> _placeOrder() async {
    final cart = ref.read(cartProvider);
    if (cart.isEmpty) {
      setState(() => _error = 'Cart is empty');
      return;
    }
    setState(() { _submitting = true; _error = ''; });
    try {
      final remote = ref.read(remoteDataSourceProvider);

      // 1. Create order
      final orderData = await remote.createOrder(
        type:     widget.orderType,
        tableId:  widget.tableId,
      );
      final orderId = orderData['id'] as String;

      // 2. Add items
      await remote.addOrderItems(orderId, cart.map((c) => c.toApiJson()).toList());

      // 3. Generate KOT immediately
      await remote.generateKot(orderId);

      // 4. Clear cart & navigate to order detail
      ref.read(cartProvider.notifier).state = [];
      if (mounted) {
        context.go('/captain/order/$orderId');
      }
    } catch (e) {
      setState(() => _error = _parseError(e));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String _parseError(Object e) {
    final s = e.toString();
    if (s.contains('SocketException') || s.contains('Connection refused')) {
      return 'Offline — order will sync when connection restores';
    }
    return 'Failed to place order. Please try again.';
  }

  // ── Build ─────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.tableName ?? 'New Order',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
            ),
            Text(
              widget.orderType.replaceAll('_', ' '),
              style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
            ),
          ],
        ),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
        actions: [
          if (cart.isNotEmpty)
            TextButton.icon(
              icon: const Icon(Icons.shopping_cart_outlined, size: 18),
              label: Text('${cart.length}'),
              style: TextButton.styleFrom(foregroundColor: AppColors.primary),
              onPressed: _showCartSheet,
            ),
        ],
      ),
      body: Column(
        children: [
          // ── Category bar ───────────────────────────────────────────────────
          _CategoryBar(),

          if (_error.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: ErrorBanner(_error),
            ),

          // ── Menu grid ──────────────────────────────────────────────────────
          Expanded(child: _MenuGrid(onAdd: _addToCart)),
        ],
      ),
      bottomNavigationBar: cart.isEmpty
          ? null
          : _CartBar(
              itemCount: cart.length,
              total:     _cartTotal,
              onViewCart: _showCartSheet,
              onPlaceOrder: _placeOrder,
              loading: _submitting,
            ),
    );
  }

  void _showCartSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _CartSheet(
        onChangeQty:  _changeQty,
        onPlaceOrder: _placeOrder,
        submitting:   _submitting,
      ),
    );
  }
}

// ─── Category bar ──────────────────────────────────────────────────────────────

class _CategoryBar extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categoriesAsync = ref.watch(categoriesProvider);
    final selected = ref.watch(selectedCategoryProvider);

    return categoriesAsync.when(
      loading: () => const SizedBox(
        height: 44,
        child: Center(
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
      error: (_, __) => const SizedBox.shrink(),
      data: (cats) => SizedBox(
        height: 44,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          children: [
            _CatChip(label: 'All', selected: selected == null,
                onTap: () => ref.read(selectedCategoryProvider.notifier).state = null),
            ...cats.map((c) => _CatChip(
                  label:    c.name,
                  selected: selected == c.id,
                  onTap: () =>
                      ref.read(selectedCategoryProvider.notifier).state = c.id,
                )),
          ],
        ),
      ),
    );
  }
}

class _CatChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _CatChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.border,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.black : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}

// ─── Menu grid ─────────────────────────────────────────────────────────────────

class _MenuGrid extends ConsumerWidget {
  final void Function(MenuItem, {ItemVariant? variant, List<CartAddon> addons}) onAdd;

  const _MenuGrid({required this.onAdd});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categoryId = ref.watch(selectedCategoryProvider);
    final itemsAsync = ref.watch(menuItemsProvider(categoryId));

    return itemsAsync.when(
      loading: () => const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
        ),
      ),
      error: (e, _) => Center(child: Text('$e')),
      data: (items) {
        final available = items.where((i) => i.isAvailable).toList();
        if (available.isEmpty) {
          return const Center(
            child: Text('No items in this category', style: TextStyle(color: AppColors.textMuted)),
          );
        }
        return GridView.builder(
          padding: const EdgeInsets.all(12),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 0.82,
          ),
          itemCount: available.length,
          itemBuilder: (context, i) => _MenuItemCard(
            item:  available[i],
            onAdd: (variant, addons) => onAdd(available[i], variant: variant, addons: addons),
          ),
        );
      },
    );
  }
}

// ─── Menu item card ────────────────────────────────────────────────────────────

class _MenuItemCard extends StatelessWidget {
  final MenuItem item;
  final void Function(ItemVariant? variant, List<CartAddon> addons) onAdd;

  const _MenuItemCard({required this.item, required this.onAdd});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    return GestureDetector(
      onTap: () => _handleTap(context),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppConstants.cardRadius),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image placeholder / color block
            Expanded(
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.06),
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
                ),
                child: Center(
                  child: Icon(
                    item.foodType == 'VEG'
                        ? Icons.eco_outlined
                        : Icons.lunch_dining_outlined,
                    size: 36,
                    color: item.foodType == 'VEG'
                        ? AppColors.vegGreen
                        : AppColors.nonVegRed,
                  ),
                ),
              ),
            ),

            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.name,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          fmt.format(item.price),
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                      GestureDetector(
                        onTap: () => _handleTap(context),
                        child: Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.add, size: 18, color: Colors.black),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _handleTap(BuildContext context) {
    if (item.variants.isNotEmpty) {
      _showVariantSheet(context);
    } else {
      onAdd(null, []);
    }
  }

  void _showVariantSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _VariantSheet(item: item, onSelect: onAdd),
    );
  }
}

// ─── Variant bottom sheet ──────────────────────────────────────────────────────

class _VariantSheet extends StatefulWidget {
  final MenuItem item;
  final void Function(ItemVariant? variant, List<CartAddon> addons) onSelect;

  const _VariantSheet({required this.item, required this.onSelect});

  @override
  State<_VariantSheet> createState() => _VariantSheetState();
}

class _VariantSheetState extends State<_VariantSheet> {
  ItemVariant? _selectedVariant;
  final Set<String> _selectedAddonIds = {};

  @override
  void initState() {
    super.initState();
    if (widget.item.variants.isNotEmpty) {
      _selectedVariant = widget.item.variants.first;
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.item.name,
                style: const TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary)),
            const SizedBox(height: 16),

            if (widget.item.variants.isNotEmpty) ...[
              const Text('Choose variant',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600,
                      color: AppColors.textMuted, letterSpacing: 0.8)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: widget.item.variants.map((v) {
                  final selected = _selectedVariant?.id == v.id;
                  return GestureDetector(
                    onTap: () => setState(() => _selectedVariant = v),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: selected ? AppColors.primary : Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: selected ? AppColors.primary : AppColors.border,
                        ),
                      ),
                      child: Column(
                        children: [
                          Text(v.name,
                              style: TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w600,
                                color: selected ? Colors.white : AppColors.textPrimary,
                              )),
                          Text(fmt.format(v.price),
                              style: TextStyle(
                                fontSize: 11,
                                color: selected ? Colors.black87 : AppColors.textMuted,
                              )),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
            ],

            if (widget.item.addons.isNotEmpty) ...[
              const Text('Add-ons (optional)',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600,
                      color: AppColors.textMuted, letterSpacing: 0.8)),
              const SizedBox(height: 8),
              ...widget.item.addons.map((a) => CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    title: Text(a.name,
                        style: const TextStyle(fontSize: 13, color: AppColors.textPrimary)),
                    subtitle: Text(fmt.format(a.price),
                        style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                    value: _selectedAddonIds.contains(a.id),
                    activeColor: AppColors.primary,
                    onChanged: (v) => setState(() {
                      if (v == true) {
                        _selectedAddonIds.add(a.id);
                      } else {
                        _selectedAddonIds.remove(a.id);
                      }
                    }),
                  )),
              const SizedBox(height: 8),
            ],

            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: () {
                  final addons = widget.item.addons
                      .where((a) => _selectedAddonIds.contains(a.id))
                      .map((a) => CartAddon(addonId: a.id, name: a.name, price: a.price))
                      .toList();
                  widget.onSelect(_selectedVariant, addons);
                  Navigator.pop(context);
                },
                child: const Text('Add to Order'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Cart bottom bar ───────────────────────────────────────────────────────────

class _CartBar extends StatelessWidget {
  final int itemCount;
  final double total;
  final VoidCallback onViewCart;
  final VoidCallback onPlaceOrder;
  final bool loading;

  const _CartBar({
    required this.itemCount,
    required this.total,
    required this.onViewCart,
    required this.onPlaceOrder,
    required this.loading,
  });

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    return Container(
      padding: EdgeInsets.fromLTRB(
        16, 12, 16, 12 + MediaQuery.of(context).padding.bottom,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 12,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: onViewCart,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.shopping_cart_outlined,
                      size: 18, color: AppColors.primary),
                  const SizedBox(width: 6),
                  Text(
                    '$itemCount',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700, color: AppColors.primary),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: SizedBox(
              height: 48,
              child: ElevatedButton(
                onPressed: loading ? null : onPlaceOrder,
                child: loading
                    ? const SizedBox(
                        width: 20, height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.black),
                        ))
                    : Text(
                        'Place Order • ${fmt.format(total)}',
                        style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 15),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Cart sheet ────────────────────────────────────────────────────────────────

class _CartSheet extends ConsumerWidget {
  final void Function(int index, int delta) onChangeQty;
  final VoidCallback onPlaceOrder;
  final bool submitting;

  const _CartSheet({
    required this.onChangeQty,
    required this.onPlaceOrder,
    required this.submitting,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartProvider);
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final total = cart.fold(0.0, (s, i) => s + i.lineTotal);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40, height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const Text(
              'Your Cart',
              style: TextStyle(
                fontSize: 18, fontWeight: FontWeight.w700,
                color: AppColors.textPrimary),
            ),
            const SizedBox(height: 16),
            ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.4,
              ),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: cart.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (_, i) {
                  final item = cart[i];
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(item.itemName,
                                  style: const TextStyle(
                                    fontSize: 14, fontWeight: FontWeight.w600,
                                    color: AppColors.textPrimary)),
                              if (item.variantName != null)
                                Text(item.variantName!,
                                    style: const TextStyle(
                                      fontSize: 11, color: AppColors.textMuted)),
                            ],
                          ),
                        ),
                        QuantityStepper(
                          value:       item.quantity,
                          onDecrement: () => onChangeQty(i, -1),
                          onIncrement: () => onChangeQty(i, 1),
                        ),
                        const SizedBox(width: 12),
                        Text(
                          fmt.format(item.lineTotal),
                          style: const TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            const Divider(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Subtotal',
                    style: TextStyle(fontSize: 15, color: AppColors.textSecondary)),
                Text(fmt.format(total),
                    style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary)),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: submitting
                    ? null
                    : () {
                        Navigator.pop(context);
                        onPlaceOrder();
                      },
                child: submitting
                    ? const SizedBox(
                        width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Place Order & Send KOT',
                        style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
