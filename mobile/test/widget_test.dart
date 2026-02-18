import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:restrosync/main.dart';

void main() {
  testWidgets('App launches without error', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(child: RestroSyncApp()),
    );
    // Just verify the app starts
    expect(find.byType(ProviderScope), findsOneWidget);
  });
}
