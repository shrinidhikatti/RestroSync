class RestaurantTable {
  final String id;
  final String number;
  final int capacity;
  final String? floor;
  final String? section;
  final String status; // AVAILABLE, OCCUPIED, RESERVED, BILLING
  final DateTime? occupiedSince;
  final bool isActive;

  const RestaurantTable({
    required this.id,
    required this.number,
    this.capacity = 4,
    this.floor,
    this.section,
    this.status = 'AVAILABLE',
    this.occupiedSince,
    this.isActive = true,
  });

  factory RestaurantTable.fromJson(Map<String, dynamic> json) => RestaurantTable(
        id:           json['id'] as String,
        number:       json['number'] as String,
        capacity:     (json['capacity'] as int?) ?? 4,
        floor:        json['floor'] as String?,
        section:      json['section'] as String?,
        status:       (json['status'] as String?) ?? 'AVAILABLE',
        occupiedSince: json['occupiedSince'] != null
            ? DateTime.tryParse(json['occupiedSince'] as String)
            : null,
        isActive: (json['isActive'] as bool?) ?? true,
      );

  bool get isAvailable => status == 'AVAILABLE';
  bool get isOccupied  => status == 'OCCUPIED';
  bool get isReserved  => status == 'RESERVED';
  bool get isBilling   => status == 'BILLING';
}
