import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <label className={`toggle-wrap gap-3 select-none ${disabled ? 'opacity-50' : ''}`}>
      <input
        type="checkbox"
        className="toggle-input"
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="toggle-track" />
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
    </label>
  );
}
