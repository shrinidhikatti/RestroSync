import React from 'react';

type RoleType = 'OWNER' | 'MANAGER' | 'BILLER' | 'CAPTAIN' | 'KITCHEN' | string;
type StatusType = string;

const roleStyles: Record<string, string> = {
  OWNER:   'bg-purple-100 text-purple-700 border border-purple-200',
  MANAGER: 'bg-blue-100 text-blue-700 border border-blue-200',
  BILLER:  'bg-cyan-100 text-cyan-700 border border-cyan-200',
  CAPTAIN: 'bg-orange-100 text-orange-700 border border-orange-200',
  KITCHEN: 'bg-slate-100 text-slate-600 border border-slate-200',
};

const tableStatusStyles: Record<string, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  OCCUPIED:  'bg-rose-100 text-rose-700 border border-rose-200',
  RESERVED:  'bg-amber-100 text-amber-700 border border-amber-200',
  BILLING:   'bg-blue-100 text-blue-700 border border-blue-200',
};

const reservationStatusStyles: Record<string, string> = {
  CONFIRMED: 'bg-blue-100 text-blue-700 border border-blue-200',
  SEATED:    'bg-emerald-100 text-emerald-700 border border-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-500 border border-slate-200',
  NO_SHOW:   'bg-rose-100 text-rose-600 border border-rose-200',
};

const genericStyles: Record<string, string> = {
  active:   'bg-emerald-100 text-emerald-700 border border-emerald-200',
  inactive: 'bg-slate-100 text-slate-500 border border-slate-200',
  expired:  'bg-rose-100 text-rose-600 border border-rose-200',
  pending:  'bg-amber-100 text-amber-700 border border-amber-200',
};

interface BadgeProps {
  label: string;
  type?: 'role' | 'table' | 'reservation' | 'generic';
  className?: string;
}

export function Badge({ label, type = 'generic', className = '' }: BadgeProps) {
  let styles = 'bg-slate-100 text-slate-600 border border-slate-200';

  if (type === 'role') {
    styles = roleStyles[label] ?? styles;
  } else if (type === 'table') {
    styles = tableStatusStyles[label] ?? styles;
  } else if (type === 'reservation') {
    styles = reservationStatusStyles[label] ?? styles;
  } else {
    styles = genericStyles[label.toLowerCase()] ?? styles;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium font-display ${styles} ${className}`}
    >
      {label}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  return <Badge label={role} type="role" />;
}

export function TableStatusBadge({ status }: { status: string }) {
  return <Badge label={status} type="table" />;
}

export function ReservationStatusBadge({ status }: { status: string }) {
  return <Badge label={status} type="reservation" />;
}
