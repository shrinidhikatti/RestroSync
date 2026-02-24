import { NavLink } from 'react-router-dom';
import { useUIStore } from '../../stores/ui.store';
import { useAuthStore } from '../../stores/auth.store';
import { ClockIcon, GridIcon, EyeIcon, BarsIcon } from '../ui/Icons';

function MobileNavItem({
  to,
  icon: Icon,
  label,
  end,
}: {
  to: string;
  icon: React.FC<{ className?: string }>;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors ${
          isActive ? 'text-red-500' : 'text-slate-400'
        }`
      }
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-semibold font-display">{label}</span>
    </NavLink>
  );
}

export function MobileNav() {
  const { toggleMobileSidebar } = useUIStore();
  const { activeModules } = useAuthStore();

  const hasModule = (m: string) =>
    activeModules.length === 0 || activeModules.includes(m);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex items-stretch mobile-safe-bottom"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <MobileNavItem to="/orders" icon={ClockIcon} label="Orders" />
      {hasModule('TABLES') && (
        <MobileNavItem to="/tables" icon={GridIcon} label="Tables" />
      )}
      {hasModule('KDS') && (
        <MobileNavItem to="/kitchen" icon={EyeIcon} label="Kitchen" />
      )}

      {/* More — opens full sidebar drawer */}
      <button
        onClick={toggleMobileSidebar}
        className="flex flex-col items-center justify-center gap-1 flex-1 py-2 text-slate-400 active:text-red-500 transition-colors"
      >
        <BarsIcon className="w-5 h-5" />
        <span className="text-[10px] font-semibold font-display">More</span>
      </button>
    </nav>
  );
}
