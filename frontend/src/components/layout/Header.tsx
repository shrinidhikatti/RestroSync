import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useUIStore } from '../../stores/ui.store';
import { useAuthStore } from '../../stores/auth.store';
import { BarsIcon, ChevronRightIcon } from '../ui/Icons';
import { RoleBadge } from '../ui/Badge';
import { ShiftHandoverModal } from '../shift/ShiftHandoverModal';

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

const CAPTAIN_ROLES = ['CAPTAIN', 'WAITER', 'CASHIER'];

export function Header() {
  const { toggleSidebar } = useUIStore();
  const { user } = useAuthStore();
  const location = useLocation();
  const [showHandover, setShowHandover] = useState(false);

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

        {/* End Shift button — only for floor staff */}
        {user?.role && CAPTAIN_ROLES.includes(user.role) && (
          <button
            onClick={() => setShowHandover(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold font-display text-slate-600 hover:bg-slate-50 hover:border-red-300 hover:text-red-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            End Shift
          </button>
        )}

        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-xs font-bold text-red-600 font-display">
          {initials}
        </div>
      </div>

      <ShiftHandoverModal open={showHandover} onClose={() => setShowHandover(false)} />
    </header>
  );
}
