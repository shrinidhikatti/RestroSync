/** All available feature modules */
export const ALL_MODULES = [
  'TABLES',
  'RESERVATIONS',
  'KDS',
  'INVENTORY',
  'CRM',
  'ONLINE_ORDERS',
  'MULTI_OUTLET',
  'DEVICES',
  'ACCOUNTING',
  'DAY_CLOSE',
] as const;

export type Module = (typeof ALL_MODULES)[number];

/** Default enabled modules per operating mode */
export const MODULE_DEFAULTS: Record<string, string[]> = {
  COUNTER: [
    'KDS', 'INVENTORY', 'CRM', 'ONLINE_ORDERS',
    'DEVICES', 'ACCOUNTING', 'DAY_CLOSE',
  ],
  TABLE_SIMPLE: [
    'TABLES', 'KDS', 'INVENTORY', 'CRM', 'ONLINE_ORDERS',
    'DEVICES', 'ACCOUNTING', 'DAY_CLOSE',
  ],
  FULL_SERVICE: [
    'TABLES', 'RESERVATIONS', 'KDS', 'INVENTORY', 'CRM',
    'ONLINE_ORDERS', 'MULTI_OUTLET', 'DEVICES', 'ACCOUNTING', 'DAY_CLOSE',
  ],
};
