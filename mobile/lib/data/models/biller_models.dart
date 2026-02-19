/// Data models for the Biller/POS app

class CartItem {
  final String menuItemId;
  final String name;
  final double price;
  final bool isVeg;
  int qty;
  String? notes;
  String? variantId;
  String? variantName;

  CartItem({
    required this.menuItemId,
    required this.name,
    required this.price,
    required this.isVeg,
    this.qty = 1,
    this.notes,
    this.variantId,
    this.variantName,
  });

  CartItem copyWith({int? qty, String? notes}) => CartItem(
    menuItemId:  menuItemId,
    name:        name,
    price:       price,
    isVeg:       isVeg,
    qty:         qty ?? this.qty,
    notes:       notes ?? this.notes,
    variantId:   variantId,
    variantName: variantName,
  );

  double get lineTotal => price * qty;

  Map<String, dynamic> toAddItemDto() => {
    'menuItemId': menuItemId,
    'qty':        qty,
    if (notes != null) 'notes': notes,
    if (variantId != null) 'variantId': variantId,
  };
}

class BillerOrder {
  final String id;
  final String? tableId;
  final int? tableNumber;
  final String orderType;
  final String status;
  final int? tokenNumber;
  final double grandTotal;
  final DateTime createdAt;
  final List<BillerOrderItem> items;
  final String? billId;

  const BillerOrder({
    required this.id,
    this.tableId,
    this.tableNumber,
    required this.orderType,
    required this.status,
    this.tokenNumber,
    required this.grandTotal,
    required this.createdAt,
    required this.items,
    this.billId,
  });

  factory BillerOrder.fromJson(Map<String, dynamic> j) => BillerOrder(
    id:          j['id'] as String,
    tableId:     j['tableId'] as String?,
    tableNumber: j['table']?['number'] as int?,
    orderType:   j['orderType'] as String? ?? 'DINE_IN',
    status:      j['status'] as String,
    tokenNumber: j['tokenNumber'] as int?,
    grandTotal:  (j['grandTotal'] as num?)?.toDouble() ?? 0,
    createdAt:   DateTime.parse(j['createdAt'] as String),
    items:       (j['items'] as List<dynamic>? ?? [])
        .map((i) => BillerOrderItem.fromJson(i as Map<String, dynamic>))
        .toList(),
    billId:      (j['bills'] as List<dynamic>?)
        ?.where((b) => (b as Map)['status'] != 'VOIDED')
        .map((b) => (b as Map)['id'] as String)
        .firstOrNull,
  );
}

class BillerOrderItem {
  final String id;
  final String name;
  final int qty;
  final double unitPrice;
  final String status;

  const BillerOrderItem({
    required this.id,
    required this.name,
    required this.qty,
    required this.unitPrice,
    required this.status,
  });

  factory BillerOrderItem.fromJson(Map<String, dynamic> j) => BillerOrderItem(
    id:        j['id'] as String,
    name:      j['menuItem']?['name'] as String? ?? j['name'] as String? ?? '?',
    qty:       j['qty'] as int? ?? 1,
    unitPrice: (j['unitPrice'] as num?)?.toDouble() ?? 0,
    status:    j['status'] as String? ?? 'ACTIVE',
  );
}

class BillSummary {
  final String billId;
  final String billNumber;
  final double subtotal;
  final double discountTotal;
  final double taxTotal;
  final double chargesTotal;
  final double roundOff;
  final double grandTotal;
  final String status;

  const BillSummary({
    required this.billId,
    required this.billNumber,
    required this.subtotal,
    required this.discountTotal,
    required this.taxTotal,
    required this.chargesTotal,
    required this.roundOff,
    required this.grandTotal,
    required this.status,
  });

  factory BillSummary.fromJson(Map<String, dynamic> j) => BillSummary(
    billId:        j['id'] as String,
    billNumber:    j['billNumber'] as String? ?? '',
    subtotal:      (j['subtotal'] as num?)?.toDouble() ?? 0,
    discountTotal: (j['discountTotal'] as num?)?.toDouble() ?? 0,
    taxTotal:      (j['taxTotal'] as num?)?.toDouble() ?? 0,
    chargesTotal:  (j['chargesTotal'] as num?)?.toDouble() ?? 0,
    roundOff:      (j['roundOff'] as num?)?.toDouble() ?? 0,
    grandTotal:    (j['grandTotal'] as num?)?.toDouble() ?? 0,
    status:        j['status'] as String? ?? 'PENDING',
  );

  double get payable => grandTotal + roundOff;
}

class PaymentSplit {
  String method;
  double amount;

  PaymentSplit({required this.method, required this.amount});
}
