import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useUIStore } from '../../stores/ui.store';
import { useAuthStore } from '../../stores/auth.store';
import { BarsIcon, ChevronRightIcon } from '../ui/Icons';
import { RoleBadge } from '../ui/Badge';

const breadcrumbMap: Record<string, string> = {
  '':           'Dashboard',
  'menu':       'Menu',
  'categories': 'Categories',
  'items':      'Items',
  'new':        'New Item',
  'tables':     'Tables',
  'reservations': 'Reservations',
  'staff':      'Staff',
  'settings':   'Settings',
  'restaurant': 'Restaurant',
  'tax':        'Tax & Charges',
  'discounts':  'Discounts',
  'receipt':    'Receipt Settings',
};

export function Header() {
  const { toggleSidebar } = useUIStore();
  const { user } = useAuthStore();
  const location = useLocation();

  const segments = location.pathname.split('/').filter(Boolean);
  const crumbs = [
    { label: 'Dashboard', path: '/' },
    ...segments.map((seg, i) => ({
      label: breadcrumbMap[seg] ?? seg,
      path: '/' + segments.slice(0, i + 1).join('/'),
    })),
  ];
  if (crumbs.length > 1 && crumbs[crumbs.length - 1].path === '/') crumbs.pop();

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'RS';

  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center px-4 gap-4 flex-shrink-0 z-10">
      {/* Hamburger */}
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <BarsIcon className="w-5 h-5" />
      </button>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm flex-1 min-w-0">
        {crumbs.map((crumb, i) => (
          <React.Fragment key={crumb.path}>
            {i > 0 && <ChevronRightIcon className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
            {i === crumbs.length - 1 ? (
              <span className="font-semibold text-slate-800 font-display truncate">{crumb.label}</span>
            ) : (
              <Link
                to={crumb.path}
                className="text-slate-400 hover:text-slate-600 transition-colors font-display truncate"
              >
                {crumb.label}
              </Link>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Right: role + avatar */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {user?.role && <RoleBadge role={user.role} />}
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700 font-display">
          {initials}
        </div>
      </div>
    </header>
  );
}
