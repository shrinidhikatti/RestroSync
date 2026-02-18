class OrderItem {
  final String id;
  final String itemName;
  final String? variantName;
  final double unitPrice;
  final int quantity;
  final List<Map<String, dynamic>>? addons;
  final String? specialInstructions;
  final String status;
  final String? kotId;
  final String priority;

  const OrderItem({
    required this.id,
    required this.itemName,
    this.variantName,
    required this.unitPrice,
    required this.quantity,
    this.addons,
    this.specialInstructions,
    this.status = 'PENDING',
    this.kotId,
    this.priority = 'NORMAL',
  });

  factory OrderItem.fromJson(Map<String, dynamic> json) => OrderItem(
        id:                  json['id'] as String,
        itemName:            json['itemName'] as String,
        variantName:         json['variantName'] as String?,
        unitPrice:           double.parse(json['unitPrice'].toString()),
        quantity:            json['quantity'] as int,
        addons:              (json['addons'] as List<dynamic>?)
            ?.map((a) => a as Map<String, dynamic>)
            .toList(),
        specialInstructions: json['specialInstructions'] as String?,
        status:              (json['status'] as String?) ?? 'PENDING',
        kotId:               json['kotId'] as String?,
        priority:            (json['priority'] as String?) ?? 'NORMAL',
      );

  double get lineTotal {
    final addonTotal = (addons ?? []).fold<double>(
      0.0,
      (sum, a) => sum + (double.tryParse(a['price'].toString()) ?? 0),
    );
    return (unitPrice + addonTotal) * quantity;
  }
}

class Order {
  final String id;
  final String orderType;
  final String status;
  final String priority;
  final int? tokenNumber;
  final String? customerName;
  final String? customerPhone;
  final String? notes;
  final double subtotal;
  final double grandTotal;
  final String? tableId;
  final Map<String, dynamic>? table;
  final List<OrderItem> items;
  final List<Map<String, dynamic>> bills;
  final DateTime createdAt;

  const Order({
    required this.id,
    required this.orderType,
    required this.status,
    this.priority = 'NORMAL',
    this.tokenNumber,
    this.customerName,
    this.customerPhone,
    this.notes,
    this.subtotal = 0,
    this.grandTotal = 0,
    this.tableId,
    this.table,
    this.items = const [],
    this.bills = const [],
    required this.createdAt,
  });

  factory Order.fromJson(Map<String, dynamic> json) => Order(
        id:            json['id'] as String,
        orderType:     (json['orderType'] as String?) ?? 'DINE_IN',
        status:        (json['status'] as String?) ?? 'NEW',
        priority:      (json['priority'] as String?) ?? 'NORMAL',
        tokenNumber:   json['tokenNumber'] as int?,
        customerName:  json['customerName'] as String?,
        customerPhone: json['customerPhone'] as String?,
        notes:         json['notes'] as String?,
        subtotal:      double.tryParse(json['subtotal']?.toString() ?? '0') ?? 0,
        grandTotal:    double.tryParse(json['grandTotal']?.toString() ?? '0') ?? 0,
        tableId:       json['tableId'] as String?,
        table:         json['table'] as Map<String, dynamic>?,
        items: (json['items'] as List<dynamic>? ?? [])
            .map((i) => OrderItem.fromJson(i as Map<String, dynamic>))
            .toList(),
        bills: (json['bills'] as List<dynamic>? ?? [])
            .map((b) => b as Map<String, dynamic>)
            .toList(),
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      );

  bool get hasUnsentItems => items.any((i) => i.status == 'PENDING' && i.kotId == null);
  bool get hasActiveBill  => bills.any((b) => ['UNPAID', 'PARTIALLY_PAID'].contains(b['status']));
  bool get isPaid         => bills.any((b) => b['status'] == 'PAID');

  String get tableNumber => (table?['number'] as String?) ?? '';
}

// ─── Cart (local state for order-taking screen) ────────────────────────────────

class CartAddon {
  final String addonId;
  final String name;
  final double price;

  const CartAddon({
    required this.addonId,
    required this.name,
    required this.price,
  });

  Map<String, dynamic> toJson() => {
        'addonId': addonId,
        'name':    name,
        'price':   price,
      };
}

class CartItem {
  final String menuItemId;
  final String itemName;
  final String? variantId;
  final String? variantName;
  final double unitPrice;
  int quantity;
  final List<CartAddon> addons;
  String? specialInstructions;
  String priority;

  CartItem({
    required this.menuItemId,
    required this.itemName,
    this.variantId,
    this.variantName,
    required this.unitPrice,
    this.quantity = 1,
    this.addons = const [],
    this.specialInstructions,
    this.priority = 'NORMAL',
  });

  double get lineTotal {
    final addonTotal = addons.fold<double>(0, (s, a) => s + a.price);
    return (unitPrice + addonTotal) * quantity;
  }

  Map<String, dynamic> toApiJson() => {
        'menuItemId': menuItemId,
        if (variantId != null) 'variantId': variantId,
        'quantity':   quantity,
        if (addons.isNotEmpty) 'addons': addons.map((a) => a.toJson()).toList(),
        if (specialInstructions != null) 'specialInstructions': specialInstructions,
        'priority': priority,
      };
}
