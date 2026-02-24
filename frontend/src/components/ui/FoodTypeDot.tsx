import React from 'react';

type FoodType = 'VEG' | 'NON_VEG' | 'EGG' | string;

const config: Record<string, { dot: string; label: string; border: string }> = {
  VEG:     { dot: 'bg-emerald-500', label: 'Veg',     border: 'border-emerald-500' },
  NON_VEG: { dot: 'bg-rose-500',    label: 'Non-Veg', border: 'border-rose-500' },
  EGG:     { dot: 'bg-red-500',   label: 'Egg',     border: 'border-red-500' },
};

interface FoodTypeDotProps {
  type: FoodType;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function FoodTypeDot({ type, showLabel = false, size = 'sm' }: FoodTypeDotProps) {
  const c = config[type];
  if (!c) return null;

  const dotSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5';
  const boxSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center justify-center ${boxSize} rounded border ${c.border} bg-white flex-shrink-0`}
        title={c.label}
      >
        <span className={`${dotSize} rounded-full ${c.dot}`} />
      </span>
      {showLabel && (
        <span className="text-xs text-slate-500">{c.label}</span>
      )}
    </span>
  );
}
