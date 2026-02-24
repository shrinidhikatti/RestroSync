import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { useUIStore } from '../../stores/ui.store';
import { restaurantApi } from '../../lib/api';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';

export function Layout() {
  const { isAuthenticated, user, setRestaurantConfig } = useAuthStore();
  const { mobileSidebarOpen, closeMobileSidebar } = useUIStore();

  useEffect(() => {
    if (!user?.restaurantId) return;
    restaurantApi.getMe().then((res) => {
      const enabled = res.data.enabledModules ?? [];
      const active = res.data.activeModules?.length > 0 ? res.data.activeModules : enabled;
      setRestaurantConfig(res.data.operatingMode ?? null, enabled, active);
    }).catch(() => {});
  }, [user?.restaurantId]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--content-bg)' }}>
      {/* Mobile sidebar backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header />
        {/* pb-16 on mobile to clear the bottom nav bar */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <MobileNav />
    </div>
  );
}
