import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useUIStore } from '../../stores/ui.store';
import { useAuthStore } from '../../stores/auth.store';
import {
  DashboardIcon, MenuIcon, FolderIcon, GridIcon, CalendarIcon,
  UsersIcon, SettingsIcon, TagIcon, TaxIcon, ReceiptIcon,
  LogOutIcon, ChevronDownIcon, ChevronRightIcon, BuildingIcon, ClockIcon, EyeIcon,
  PackageIcon, TruckIcon,
  BarChartIcon, ShieldIcon, FileTextIcon, TrendingUpIcon, GridIcon as BranchIcon,
  LinkIcon, MonitorIcon, DollarIcon, ShoppingBagIcon, SettingsIcon as SystemIcon,
  AlertIcon,
} from '../ui/Icons';

interface NavItem {
  label: string;
  path?: string;
  icon: React.FC<{ className?: string }>;
  children?: { label: string; path: string; icon: React.FC<{ className?: string }> }[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: DashboardIcon },
  {
    label: 'Menu',
    icon: MenuIcon,
    children: [
      { label: 'Categories', path: '/menu/categories', icon: FolderIcon },
      { label: 'Items',      path: '/menu/items',      icon: MenuIcon },
      { label: 'Combos',     path: '/menu/combos',     icon: TagIcon  },
    ],
  },
  { label: 'Orders',       path: '/orders',       icon: ClockIcon },
  { label: 'Kitchen (KDS)', path: '/kitchen',     icon: EyeIcon },
  { label: 'Tables',       path: '/tables',       icon: GridIcon },
  { label: 'Reservations', path: '/reservations', icon: CalendarIcon },
  { label: 'Day Close',    path: '/day-close',    icon: DollarIcon },
  { label: 'Staff',        path: '/staff',        icon: UsersIcon },
  {
    label: 'Multi-Outlet',
    icon: BranchIcon,
    children: [
      { label: 'All Branches',   path: '/multi-outlet/overview',   icon: BarChartIcon   },
      { label: 'Menu Overrides', path: '/multi-outlet/menu',       icon: MenuIcon       },
      { label: 'Stock Transfers',path: '/multi-outlet/transfers',  icon: TruckIcon      },
    ],
  },
  {
    label: 'CRM',
    icon: UsersIcon,
    children: [
      { label: 'Customers',       path: '/crm/customers',       icon: UsersIcon       },
      { label: 'Credit (Khata)',  path: '/crm/credit-accounts', icon: FileTextIcon    },
      { label: 'Loyalty',         path: '/crm/loyalty',         icon: TrendingUpIcon  },
      { label: 'Attendance',      path: '/crm/attendance',      icon: ClockIcon       },
    ],
  },
  {
    label: 'Reports',
    icon: BarChartIcon,
    children: [
      { label: 'Sales & Analytics', path: '/reports/sales',       icon: BarChartIcon },
      { label: 'Audit Log',         path: '/reports/audit',       icon: FileTextIcon },
      { label: 'Fraud & Risk',      path: '/reports/fraud',       icon: ShieldIcon   },
      { label: 'Dish Complaints',   path: '/reports/complaints',  icon: AlertIcon    },
    ],
  },
  {
    label: 'Inventory',
    icon: PackageIcon,
    children: [
      { label: 'Ingredients',      path: '/inventory/ingredients',     icon: PackageIcon },
      { label: 'Recipes',          path: '/inventory/recipes',         icon: MenuIcon },
      { label: 'Stock',            path: '/inventory/stock',           icon: GridIcon },
      { label: 'Suppliers',        path: '/inventory/suppliers',       icon: BuildingIcon },
      { label: 'Purchase Orders',  path: '/inventory/purchase-orders', icon: TruckIcon },
    ],
  },
  { label: 'Online Orders',   path: '/online-orders',   icon: ShoppingBagIcon },
  { label: 'Devices',        path: '/devices',          icon: MonitorIcon },
  { label: 'System Monitor', path: '/system/monitor',   icon: SystemIcon },
  {
    label: 'Settings',
    icon: SettingsIcon,
    children: [
      { label: 'Restaurant',   path: '/settings/restaurant',   icon: BuildingIcon },
      { label: 'Tax',          path: '/settings/tax',          icon: TaxIcon },
      { label: 'Charges',      path: '/settings/charges',      icon: DollarIcon },
      { label: 'Payments',     path: '/settings/payments',     icon: DollarIcon },
      { label: 'Discounts',    path: '/settings/discounts',    icon: TagIcon },
      { label: 'Receipt',      path: '/settings/receipt',      icon: ReceiptIcon },
      { label: 'Security',     path: '/settings/security',     icon: ShieldIcon },
      { label: 'Integrations', path: '/settings/integrations', icon: LinkIcon },
    ],
  },
  {
    label: 'Accounting',
    icon: DollarIcon,
    children: [
      { label: 'P&L Report',  path: '/accounting/pnl',    icon: BarChartIcon },
    ],
  },
];

function NavSection({
  item,
  collapsed,
}: {
  item: NavItem;
  collapsed: boolean;
}) {
  const location = useLocation();
  const isChildActive = item.children?.some((c) => location.pathname.startsWith(c.path));
  const [open, setOpen] = useState(isChildActive ?? false);

  if (!item.children) {
    return (
      <NavLink
        to={item.path!}
        end={item.path === '/'}
        className={({ isActive }) =>
          `relative flex items-center gap-3 px-3 py-2.5 rounded-xl mx-2 transition-all duration-150 group
          ${isActive
            ? 'bg-red-500 text-white shadow-sm'
            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          }`
        }
        title={collapsed ? item.label : undefined}
      >
        {({ isActive }) => (
          <>
            <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
            <span
              className="label-transition text-sm font-medium font-display"
              style={{ maxWidth: collapsed ? 0 : 180, opacity: collapsed ? 0 : 1 }}
            >
              {item.label}
            </span>
          </>
        )}
      </NavLink>
    );
  }

  // Group with children
  return (
    <div>
      <button
        onClick={() => !collapsed && setOpen((v) => !v)}
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl mx-2 w-[calc(100%-16px)] transition-all duration-150
          ${isChildActive && !open ? 'text-red-400' : 'text-slate-400'}
          hover:text-white hover:bg-slate-700/50`}
        title={collapsed ? item.label : undefined}
      >
        <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
        <span
          className="label-transition flex-1 text-left text-sm font-medium font-display"
          style={{ maxWidth: collapsed ? 0 : 180, opacity: collapsed ? 0 : 1 }}
        >
          {item.label}
        </span>
        {!collapsed && (
          <span className="flex-shrink-0 transition-transform duration-200" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
            <ChevronDownIcon className="w-4 h-4" />
          </span>
        )}
      </button>

      {!collapsed && open && (
        <div className="ml-4 mt-0.5 border-l border-slate-700 pl-2 space-y-0.5">
          {item.children.map((child) => (
            <NavLink
              key={child.path}
              to={child.path}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg mx-1 text-sm transition-all duration-150
                ${isActive
                  ? 'text-red-400 bg-red-500/10 font-medium'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/30'
                }`
              }
            >
              <child.icon className="w-4 h-4 flex-shrink-0" />
              <span className="font-display">{child.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { user, logout } = useAuthStore();

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'RS';

  return (
    <aside
      className="sidebar-transition flex flex-col h-full overflow-hidden flex-shrink-0"
      style={{
        width: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
        background: 'var(--sidebar-bg)',
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 h-16 flex-shrink-0 border-b border-slate-800">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-white text-sm bg-red-500"
        >
          RS
        </div>
        <span
          className="label-transition font-display font-bold text-white text-lg tracking-tight"
          style={{ maxWidth: sidebarCollapsed ? 0 : 160, opacity: sidebarCollapsed ? 0 : 1 }}
        >
          RestroSync
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-0.5">
        {navItems.map((item) => (
          <NavSection key={item.label} item={item} collapsed={sidebarCollapsed} />
        ))}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-slate-800 p-3 flex-shrink-0">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-200 flex-shrink-0 font-display">
            {initials}
          </div>
          <div
            className="label-transition min-w-0"
            style={{ maxWidth: sidebarCollapsed ? 0 : 140, opacity: sidebarCollapsed ? 0 : 1 }}
          >
            <p className="text-xs font-semibold text-slate-200 truncate font-display">{user?.name ?? 'User'}</p>
            <p className="text-xs text-slate-500 truncate">{user?.role ?? 'OWNER'}</p>
          </div>
          {!sidebarCollapsed && (
            <button
              onClick={logout}
              className="ml-auto p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              title="Logout"
            >
              <LogOutIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
