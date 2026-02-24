import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';

// Super Admin
const SuperAdminLoginPage     = lazy(() => import('./pages/super-admin/SuperAdminLoginPage'));
const SuperAdminLayout        = lazy(() => import('./pages/super-admin/SuperAdminLayout'));
const SuperAdminDashboard     = lazy(() => import('./pages/super-admin/SuperAdminDashboard'));
const RestaurantsListPage     = lazy(() => import('./pages/super-admin/RestaurantsListPage'));
const AddRestaurantPage       = lazy(() => import('./pages/super-admin/AddRestaurantPage'));
const RestaurantDetailPage    = lazy(() => import('./pages/super-admin/RestaurantDetailPage'));
const SuperAdminSystemPage    = lazy(() => import('./pages/super-admin/SuperAdminSystemPage'));

// Lazy-load pages for code splitting
const LoginPage            = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage         = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage   = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage    = lazy(() => import('./pages/auth/ResetPasswordPage'));
const DashboardPage      = lazy(() => import('./pages/dashboard/DashboardPage'));
const CategoriesPage     = lazy(() => import('./pages/menu/CategoriesPage'));
const MenuItemsPage      = lazy(() => import('./pages/menu/MenuItemsPage'));
const MenuItemFormPage   = lazy(() => import('./pages/menu/MenuItemFormPage'));
const CombosPage         = lazy(() => import('./pages/menu/CombosPage'));
const TablesPage         = lazy(() => import('./pages/tables/TablesPage'));
const ReservationsPage   = lazy(() => import('./pages/reservations/ReservationsPage'));
const StaffPage          = lazy(() => import('./pages/staff/StaffPage'));
const RestaurantSettings  = lazy(() => import('./pages/settings/RestaurantSettingsPage'));
const TaxSettings         = lazy(() => import('./pages/settings/TaxSettingsPage'));
const DiscountsPage       = lazy(() => import('./pages/settings/DiscountsPage'));
const ReceiptSettings     = lazy(() => import('./pages/settings/ReceiptSettingsPage'));
const PaymentSettings     = lazy(() => import('./pages/settings/PaymentSettingsPage'));
const ChargesPage         = lazy(() => import('./pages/settings/ChargesPage'));
const SecuritySettings    = lazy(() => import('./pages/settings/SecuritySettingsPage'));
const OrdersPage         = lazy(() => import('./pages/orders/OrdersPage'));
const KitchenDisplay     = lazy(() => import('./pages/kitchen/KitchenDisplay'));

// Onboarding
const OnboardingPage       = lazy(() => import('./pages/onboarding/OnboardingPage'));

// Counter Token Display (public, no layout)
const CounterTokenDisplay  = lazy(() => import('./pages/display/CounterTokenDisplay'));

// Multi-Outlet
const ConsolidatedDashboardPage = lazy(() => import('./pages/multi-outlet/ConsolidatedDashboardPage'));
const BranchMenuOverridePage    = lazy(() => import('./pages/multi-outlet/BranchMenuOverridePage'));
const StockTransfersPage        = lazy(() => import('./pages/multi-outlet/StockTransfersPage'));

// CRM
const CustomersPage      = lazy(() => import('./pages/crm/CustomersPage'));
const CustomerProfilePage = lazy(() => import('./pages/crm/CustomerProfilePage'));
const CreditAccountsPage = lazy(() => import('./pages/crm/CreditAccountsPage'));
const LoyaltySettingsPage = lazy(() => import('./pages/crm/LoyaltySettingsPage'));
const StaffAttendancePage = lazy(() => import('./pages/crm/StaffAttendancePage'));

// Reports
const ReportsPage        = lazy(() => import('./pages/reports/ReportsPage'));
const AuditLogPage       = lazy(() => import('./pages/reports/AuditLogPage'));
const FraudReportsPage   = lazy(() => import('./pages/reports/FraudReportsPage'));
const ComplaintsPage     = lazy(() => import('./pages/reports/ComplaintsPage'));

// Phase 11
const SystemMonitorPage  = lazy(() => import('./pages/dashboard/SystemMonitorPage'));

// Phase 10
const IntegrationsPage   = lazy(() => import('./pages/settings/IntegrationsPage'));
const DevicesPage        = lazy(() => import('./pages/devices/DevicesPage'));
const OnlineOrdersPage   = lazy(() => import('./pages/orders/OnlineOrdersPage'));
const PnLPage            = lazy(() => import('./pages/reports/PnLPage'));

// Operations
const DayClosePage       = lazy(() => import('./pages/operations/DayClosePage'));

// Inventory
const IngredientsPage    = lazy(() => import('./pages/inventory/IngredientsPage'));
const RecipesPage        = lazy(() => import('./pages/inventory/RecipesPage'));
const StockPage          = lazy(() => import('./pages/inventory/StockPage'));
const SuppliersPage      = lazy(() => import('./pages/inventory/SuppliersPage'));
const PurchaseOrdersPage = lazy(() => import('./pages/inventory/PurchaseOrdersPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full py-20">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-red-500 animate-bounce"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/login"           element={<LoginPage />} />
          <Route path="/register"        element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password"  element={<ResetPasswordPage />} />
          <Route path="/onboarding"      element={<OnboardingPage />} />

          {/* Counter Token Display — full-screen, no auth required */}
          <Route path="/display/counter/:branchId" element={<CounterTokenDisplay />} />

          {/* Super Admin — separate layout, session-based auth */}
          <Route path="/super-admin/login" element={<SuperAdminLoginPage />} />
          <Route element={<SuperAdminLayout />}>
            <Route path="/super-admin/dashboard"           element={<SuperAdminDashboard />} />
            <Route path="/super-admin/restaurants"         element={<RestaurantsListPage />} />
            <Route path="/super-admin/restaurants/new"     element={<AddRestaurantPage />} />
            <Route path="/super-admin/restaurants/:id"     element={<RestaurantDetailPage />} />
            <Route path="/super-admin/system"              element={<SuperAdminSystemPage />} />
          </Route>

          {/* Kitchen Display — full-screen, no layout chrome */}
          <Route path="/kitchen" element={<KitchenDisplay />} />

          {/* Protected — wrapped in Layout */}
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />

            {/* Menu */}
            <Route path="/menu/categories"  element={<CategoriesPage />} />
            <Route path="/menu/items"        element={<MenuItemsPage />} />
            <Route path="/menu/items/new"    element={<MenuItemFormPage />} />
            <Route path="/menu/items/:id"    element={<MenuItemFormPage />} />
            <Route path="/menu/combos"       element={<CombosPage />} />

            {/* Operations */}
            <Route path="/orders"       element={<OrdersPage />} />
            <Route path="/tables"       element={<TablesPage />} />
            <Route path="/reservations" element={<ReservationsPage />} />
            <Route path="/day-close"    element={<DayClosePage />} />

            {/* People */}
            <Route path="/staff" element={<StaffPage />} />

            {/* Multi-Outlet */}
            <Route path="/multi-outlet/overview"   element={<ConsolidatedDashboardPage />} />
            <Route path="/multi-outlet/menu"       element={<BranchMenuOverridePage />} />
            <Route path="/multi-outlet/transfers"  element={<StockTransfersPage />} />

            {/* CRM */}
            <Route path="/crm/customers"          element={<CustomersPage />} />
            <Route path="/crm/customers/:id"      element={<CustomerProfilePage />} />
            <Route path="/crm/credit-accounts"    element={<CreditAccountsPage />} />
            <Route path="/crm/loyalty"            element={<LoyaltySettingsPage />} />
            <Route path="/crm/attendance"         element={<StaffAttendancePage />} />

            {/* Reports */}
            <Route path="/reports/sales"       element={<ReportsPage />} />
            <Route path="/reports/audit"       element={<AuditLogPage />} />
            <Route path="/reports/fraud"       element={<FraudReportsPage />} />
            <Route path="/reports/complaints"  element={<ComplaintsPage />} />

            {/* Inventory */}
            <Route path="/inventory/ingredients"     element={<IngredientsPage />} />
            <Route path="/inventory/recipes"         element={<RecipesPage />} />
            <Route path="/inventory/stock"           element={<StockPage />} />
            <Route path="/inventory/suppliers"       element={<SuppliersPage />} />
            <Route path="/inventory/purchase-orders" element={<PurchaseOrdersPage />} />

            {/* System Monitor */}
            <Route path="/system/monitor" element={<SystemMonitorPage />} />

            {/* Online orders & devices */}
            <Route path="/online-orders"       element={<OnlineOrdersPage />} />
            <Route path="/devices"             element={<DevicesPage />} />

            {/* Accounting */}
            <Route path="/accounting/pnl"      element={<PnLPage />} />

            {/* Settings */}
            <Route path="/settings/restaurant"   element={<RestaurantSettings />} />
            <Route path="/settings/tax"          element={<TaxSettings />} />
            <Route path="/settings/discounts"    element={<DiscountsPage />} />
            <Route path="/settings/receipt"      element={<ReceiptSettings />} />
            <Route path="/settings/integrations" element={<IntegrationsPage />} />
            <Route path="/settings/payments"     element={<PaymentSettings />} />
            <Route path="/settings/charges"      element={<ChargesPage />} />
            <Route path="/settings/security"     element={<SecuritySettings />} />

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
