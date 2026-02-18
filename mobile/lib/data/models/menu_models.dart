class MenuCategory {
  final String id;
  final String name;
  final String? color;
  final int sortOrder;
  final bool isActive;

  const MenuCategory({
    required this.id,
    required this.name,
    this.color,
    this.sortOrder = 0,
    this.isActive = true,
  });

  factory MenuCategory.fromJson(Map<String, dynamic> json) => MenuCategory(
        id:        json['id'] as String,
        name:      json['name'] as String,
        color:     json['color'] as String?,
        sortOrder: (json['sortOrder'] as int?) ?? 0,
        isActive:  (json['isActive'] as bool?) ?? true,
      );
}

class ItemVariant {
  final String id;
  final String name;
  final double price;
  final bool isActive;

  const ItemVariant({
    required this.id,
    required this.name,
    required this.price,
    this.isActive = true,
  });

  factory ItemVariant.fromJson(Map<String, dynamic> json) => ItemVariant(
        id:       json['id'] as String,
        name:     json['name'] as String,
        price:    double.parse(json['price'].toString()),
        isActive: (json['isActive'] as bool?) ?? true,
      );
}

class ItemAddon {
  final String id;
  final String name;
  final double price;
  final bool isActive;

  const ItemAddon({
    required this.id,
    required this.name,
    required this.price,
    this.isActive = true,
  });

  factory ItemAddon.fromJson(Map<String, dynamic> json) => ItemAddon(
        id:       json['id'] as String,
        name:     json['name'] as String,
        price:    double.parse(json['price'].toString()),
        isActive: (json['isActive'] as bool?) ?? true,
      );
}

class MenuItem {
  final String id;
  final String name;
  final String? shortName;
  final String? description;
  final double price;
  final String? foodType; // VEG, NON_VEG, EGG
  final String categoryId;
  final String? kitchenStation;
  final bool isAvailable;
  final bool isArchived;
  final List<ItemVariant> variants;
  final List<ItemAddon> addons;

  const MenuItem({
    required this.id,
    required this.name,
    this.shortName,
    this.description,
    required this.price,
    this.foodType,
    required this.categoryId,
    this.kitchenStation,
    this.isAvailable = true,
    this.isArchived = false,
    this.variants = const [],
    this.addons = const [],
  });

  factory MenuItem.fromJson(Map<String, dynamic> json) => MenuItem(
        id:             json['id'] as String,
        name:           json['name'] as String,
        shortName:      json['shortName'] as String?,
        description:    json['description'] as String?,
        price:          double.parse(json['price'].toString()),
        foodType:       json['foodType'] as String?,
        categoryId:     json['categoryId'] as String,
        kitchenStation: json['kitchenStation'] as String?,
        isAvailable:    (json['isAvailable'] as bool?) ?? true,
        isArchived:     (json['isArchived'] as bool?) ?? false,
        variants: (json['variants'] as List<dynamic>? ?? [])
            .map((v) => ItemVariant.fromJson(v as Map<String, dynamic>))
            .toList(),
        addons: (json['addons'] as List<dynamic>? ?? [])
            .map((a) => ItemAddon.fromJson(a as Map<String, dynamic>))
            .toList(),
      );
}
