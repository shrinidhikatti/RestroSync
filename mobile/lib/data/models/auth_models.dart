class AuthUser {
  final String userId;
  final String name;
  final String? email;
  final String? phone;
  final String role;
  final String? restaurantId;
  final String? branchId;

  const AuthUser({
    required this.userId,
    required this.name,
    this.email,
    this.phone,
    required this.role,
    this.restaurantId,
    this.branchId,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
        userId:       json['userId'] as String,
        name:         json['name'] as String,
        email:        json['email'] as String?,
        phone:        json['phone'] as String?,
        role:         json['role'] as String,
        restaurantId: json['restaurantId'] as String?,
        branchId:     json['branchId'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'userId':       userId,
        'name':         name,
        'email':        email,
        'phone':        phone,
        'role':         role,
        'restaurantId': restaurantId,
        'branchId':     branchId,
      };

  bool get isCaptain  => role == 'CAPTAIN';
  bool get isBiller   => role == 'BILLER';
  bool get isManager  => role == 'MANAGER' || role == 'OWNER';
}

class AuthTokens {
  final String accessToken;
  final String refreshToken;

  const AuthTokens({required this.accessToken, required this.refreshToken});

  factory AuthTokens.fromJson(Map<String, dynamic> json) => AuthTokens(
        accessToken:  json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
      );
}
