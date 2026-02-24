import api from './axios';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (data: { email?: string; phone?: string; password: string }) =>
    api.post('/auth/login', data),
  register: (data: {
    restaurantName: string;
    name: string;
    email?: string;
    phone?: string;
    password: string;
    dpdpaConsentGiven?: boolean;
  }) => api.post('/auth/register', data),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
};

// ─── Restaurant ───────────────────────────────────────────────────────────────
export const restaurantApi = {
  getMe: () => api.get('/restaurants/me'),
  update: (data: any) => api.patch('/restaurants/me', data),
  setMode: (operatingMode: string) =>
    api.patch('/restaurants/me/operating-mode', { operatingMode }),
};

// ─── Categories ───────────────────────────────────────────────────────────────
export const categoryApi = {
  getAll: () => api.get('/categories'),
  getOne: (id: string) => api.get(`/categories/${id}`),
  create: (data: { name: string; color?: string; sortOrder?: number }) =>
    api.post('/categories', data),
  update: (id: string, data: any) => api.patch(`/categories/${id}`, data),
  remove: (id: string) => api.delete(`/categories/${id}`),
  reorder: (items: { id: string; sortOrder: number }[]) =>
    api.patch('/categories/reorder', { items }),
};

// ─── Menu Items ───────────────────────────────────────────────────────────────
export const menuApi = {
  getAll: (categoryId?: string) =>
    api.get('/menu-items', { params: categoryId ? { categoryId } : {} }),
  getOne: (id: string) => api.get(`/menu-items/${id}`),
  create: (data: any) => api.post('/menu-items', data),
  update: (id: string, data: any) => api.patch(`/menu-items/${id}`, data),
  toggleAvailability: (id: string, isAvailable: boolean) =>
    api.patch(`/menu-items/${id}/availability`, { isAvailable }),
  archive: (id: string) => api.delete(`/menu-items/${id}`),
  importCsv: (rows: any[]) => api.post('/menu-items/import-csv', { rows }),
  createVariant: (itemId: string, data: any) =>
    api.post(`/menu-items/${itemId}/variants`, data),
  updateVariant: (itemId: string, variantId: string, data: any) =>
    api.patch(`/menu-items/${itemId}/variants/${variantId}`, data),
  deleteVariant: (itemId: string, variantId: string) =>
    api.delete(`/menu-items/${itemId}/variants/${variantId}`),
  createAddon: (itemId: string, data: any) =>
    api.post(`/menu-items/${itemId}/addons`, data),
  updateAddon: (itemId: string, addonId: string, data: any) =>
    api.patch(`/menu-items/${itemId}/addons/${addonId}`, data),
  deleteAddon: (itemId: string, addonId: string) =>
    api.delete(`/menu-items/${itemId}/addons/${addonId}`),
  upsertPriceOverride: (itemId: string, data: any) =>
    api.post(`/menu-items/${itemId}/price-overrides`, data),
};

// ─── Tables ───────────────────────────────────────────────────────────────────
export const tableApi = {
  getAll: () => api.get('/tables'),
  getOne: (id: string) => api.get(`/tables/${id}`),
  create: (data: any) => api.post('/tables', data),
  update: (id: string, data: any) => api.patch(`/tables/${id}`, data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/tables/${id}/status`, { status }),
  remove: (id: string) => api.delete(`/tables/${id}`),
};

// ─── Reservations ─────────────────────────────────────────────────────────────
export const reservationApi = {
  getAll: (date?: string) =>
    api.get('/reservations', { params: date ? { date } : {} }),
  create: (data: any) => api.post('/reservations', data),
  update: (id: string, data: any) => api.patch(`/reservations/${id}`, data),
  cancel: (id: string) => api.patch(`/reservations/${id}/cancel`),
  seat: (id: string) => api.patch(`/reservations/${id}/seat`),
};

// ─── Tax ─────────────────────────────────────────────────────────────────────
export const taxApi = {
  getGroups: () => api.get('/tax-groups'),
  createGroup: (data: any) => api.post('/tax-groups', data),
  updateGroup: (id: string, data: any) => api.patch(`/tax-groups/${id}`, data),
  deleteGroup: (id: string) => api.delete(`/tax-groups/${id}`),
  updateSettings: (taxInclusive: boolean) =>
    api.patch('/tax/settings', { taxInclusive }),
  getCharges: () => api.get('/charges'),
  createCharge: (data: any) => api.post('/charges', data),
  updateCharge: (id: string, data: any) => api.patch(`/charges/${id}`, data),
  deleteCharge: (id: string) => api.delete(`/charges/${id}`),
};

// ─── Discounts ────────────────────────────────────────────────────────────────
export const discountApi = {
  getAll: () => api.get('/discounts'),
  create: (data: any) => api.post('/discounts', data),
  update: (id: string, data: any) => api.patch(`/discounts/${id}`, data),
  remove: (id: string) => api.delete(`/discounts/${id}`),
  validate: (data: any) => api.post('/discounts/validate', data),
  getConfig: () => api.get('/discount-config'),
  updateConfig: (data: any) => api.patch('/discount-config', data),
};

// ─── Branches ─────────────────────────────────────────────────────────────────
export const branchApi = {
  getAll: () => api.get('/branches'),
  create: (data: any) => api.post('/branches', data),
  update: (id: string, data: any) => api.patch(`/branches/${id}`, data),
};

// ─── Users (Staff) ────────────────────────────────────────────────────────────
export const staffApi = {
  getAll: () => api.get('/restaurants/me/staff'),
  create: (data: any) => api.post('/restaurants/me/staff', data),
  remove: (userId: string) => api.delete(`/restaurants/me/staff/${userId}`),
};

// ─── Orders ───────────────────────────────────────────────────────────────────
export const orderApi = {
  create: (data: {
    type: string;
    tableId?: string;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    notes?: string;
    priority?: string;
  }) => api.post('/orders', data),

  getAll: (params?: { status?: string; type?: string; tableId?: string; date?: string; limit?: number; offset?: number }) =>
    api.get('/orders', { params }),

  getOne: (id: string) => api.get(`/orders/${id}`),

  update: (id: string, data: any) => api.patch(`/orders/${id}`, data),

  cancel: (id: string, reason: string) =>
    api.patch(`/orders/${id}/cancel`, { reason }),

  addItems: (id: string, items: any[]) =>
    api.post(`/orders/${id}/items`, items),

  updateItem: (orderId: string, itemId: string, data: any) =>
    api.patch(`/orders/${orderId}/items/${itemId}`, data),

  voidItem: (orderId: string, itemId: string, reason: string) =>
    api.delete(`/orders/${orderId}/items/${itemId}`, { data: { reason } }),

  generateKot: (orderId: string, orderItemIds?: string[]) =>
    api.post(`/orders/${orderId}/kot`, orderItemIds ? { orderItemIds } : {}),

  getKots: (orderId: string) => api.get(`/orders/${orderId}/kots`),

  reprintKot: (kotId: string) => api.post(`/kots/${kotId}/reprint`),

  updateItemStatus: (itemId: string, status: string) =>
    api.patch(`/order-items/${itemId}/status`, { status }),

  generateBill: (orderId: string, data?: { discounts?: any[]; tipAmount?: number }) =>
    api.post(`/orders/${orderId}/bill`, data ?? {}),
};

// ─── Bills ────────────────────────────────────────────────────────────────────
export const billApi = {
  getOne: (billId: string) => api.get(`/bills/${billId}`),

  void: (billId: string, data: { reason: string; cashReturned?: boolean; verifiedBy?: string }) =>
    api.post(`/bills/${billId}/void`, data),

  print: (billId: string) => api.post(`/bills/${billId}/print`),

  recordPayment: (billId: string, payments: { method: string; amount: number; reference?: string; splitLabel?: string }[]) =>
    api.post(`/bills/${billId}/payments`, { payments }),

  getPayments: (billId: string) => api.get(`/bills/${billId}/payments`),

  createRefund: (billId: string, data: { type: string; amount: number; reason: string; refundMethod: string; items?: any[] }) =>
    api.post(`/bills/${billId}/refunds`, data),

  getRefunds: (billId: string) => api.get(`/bills/${billId}/refunds`),

  updateRefundStatus: (refundId: string, status: string, notes?: string) =>
    api.patch(`/refunds/${refundId}`, { status, notes }),
};

// ─── Inventory API ─────────────────────────────────────────────────────────────

export const ingredientApi = {
  list:   ()                        => api.get('/inventory/ingredients'),
  get:    (id: string)              => api.get(`/inventory/ingredients/${id}`),
  create: (data: { name: string; unit: string; minStockLevel?: number; yieldPercent?: number }) =>
    api.post('/inventory/ingredients', data),
  update: (id: string, data: any)   => api.patch(`/inventory/ingredients/${id}`, data),
  delete: (id: string)              => api.delete(`/inventory/ingredients/${id}`),
};

export const recipeApi = {
  list:   ()           => api.get('/inventory/recipes'),
  get:    (id: string) => api.get(`/inventory/recipes/${id}`),
  create: (data: any)  => api.post('/inventory/recipes', data),
  update: (id: string, data: any) => api.patch(`/inventory/recipes/${id}`, data),
  delete: (id: string) => api.delete(`/inventory/recipes/${id}`),
};

export const stockApi = {
  levels:        ()                    => api.get('/inventory/stock'),
  lowStockAlerts: ()                   => api.get('/inventory/stock/alerts/low-stock'),
  expiryAlerts:  (days?: number)       => api.get('/inventory/stock/alerts/expiry', { params: { days } }),
  batches:       (ingredientId: string) => api.get(`/inventory/stock/batches/${ingredientId}`),
  transactions:  (ingredientId?: string, limit?: number) =>
    api.get('/inventory/stock/transactions', { params: { ingredientId, limit } }),
  stockIn:       (data: { ingredientId: string; quantity: number; costPerUnit: number; batchNumber?: string; purchaseDate: string; expiryDate?: string; supplierId?: string }) =>
    api.post('/inventory/stock/in', data),
  stockOut:      (data: { ingredientId: string; quantity: number; type: 'WASTAGE' | 'ADJUSTMENT'; reason?: string }) =>
    api.post('/inventory/stock/out', data),
  writeOffBatch: (batchId: string) => api.post(`/inventory/stock/batches/${batchId}/write-off`),
};

export const supplierApi = {
  list:   ()           => api.get('/inventory/suppliers'),
  get:    (id: string) => api.get(`/inventory/suppliers/${id}`),
  create: (data: any)  => api.post('/inventory/suppliers', data),
  update: (id: string, data: any) => api.patch(`/inventory/suppliers/${id}`, data),
  delete: (id: string) => api.delete(`/inventory/suppliers/${id}`),
};

export const purchaseOrderApi = {
  list:    ()            => api.get('/inventory/purchase-orders'),
  get:     (id: string)  => api.get(`/inventory/purchase-orders/${id}`),
  create:  (data: any)   => api.post('/inventory/purchase-orders', data),
  update:  (id: string, data: any) => api.patch(`/inventory/purchase-orders/${id}`, data),
  receive: (id: string, items: any[]) =>
    api.post(`/inventory/purchase-orders/${id}/receive`, { items }),
  cancel:  (id: string) => api.post(`/inventory/purchase-orders/${id}/cancel`),
};

// ─── Reports API ────────────────────────────────────────────────────────────────

export const reportsApi = {
  summary:          (from?: string, to?: string) =>
    api.get('/reports/summary', { params: { from, to } }),
  dailyTrend:       (from?: string, to?: string) =>
    api.get('/reports/daily-trend', { params: { from, to } }),
  hourly:           (from?: string, to?: string) =>
    api.get('/reports/hourly', { params: { from, to } }),
  items:            (from?: string, to?: string, limit = 20) =>
    api.get('/reports/items', { params: { from, to, limit } }),
  payments:         (from?: string, to?: string) =>
    api.get('/reports/payments', { params: { from, to } }),
  tax:              (from?: string, to?: string) =>
    api.get('/reports/tax', { params: { from, to } }),
  voids:            (from?: string, to?: string) =>
    api.get('/reports/voids', { params: { from, to } }),
  discounts:        (from?: string, to?: string) =>
    api.get('/reports/discounts', { params: { from, to } }),
  computeDaily:     (date: string) => api.post(`/reports/compute/${date}`),
  auditLogs:        (params: {
    userId?: string; action?: string; entity?: string; entityId?: string;
    from?: string; to?: string; search?: string; page?: number; limit?: number;
  }) => api.get('/reports/audit', { params }),
  auditActors:      () => api.get('/reports/audit/actors'),
  auditActions:     () => api.get('/reports/audit/actions'),
};

// ─── CRM API ─────────────────────────────────────────────────────────────────

export const customerApi = {
  list:       (params?: { search?: string; tag?: string; page?: number; limit?: number }) =>
    api.get('/crm/customers', { params }),
  get:        (id: string) => api.get(`/crm/customers/${id}`),
  create:     (data: any)  => api.post('/crm/customers', data),
  update:     (id: string, data: any) => api.patch(`/crm/customers/${id}`, data),
  anonymize:  (id: string) => api.delete(`/crm/customers/${id}/data`),
  segments:   ()           => api.get('/crm/customers/segments'),
};

export const loyaltyApi = {
  config:       ()          => api.get('/crm/loyalty/config'),
  updateConfig: (data: any) => api.patch('/crm/loyalty/config', data),
  upcomingEvents: (days?: number) => api.get('/crm/loyalty/events', { params: { days } }),
  balance:      (customerId: string) => api.get(`/crm/customers/${customerId}/loyalty`),
  history:      (customerId: string) => api.get(`/crm/customers/${customerId}/loyalty/history`),
  adjust:       (customerId: string, data: { points: number; description: string; orderId?: string }) =>
    api.post(`/crm/customers/${customerId}/loyalty/adjust`, data),
  redeem:       (customerId: string, data: { points: number; orderId?: string }) =>
    api.post(`/crm/customers/${customerId}/loyalty/redeem`, data),
};

export const creditApi = {
  list:    ()              => api.get('/crm/credit-accounts'),
  aging:   ()              => api.get('/crm/credit-accounts/aging'),
  get:     (customerId: string) => api.get(`/crm/credit-accounts/customer/${customerId}`),
  create:  (data: any)     => api.post('/crm/credit-accounts', data),
  update:  (id: string, data: any) => api.patch(`/crm/credit-accounts/${id}`, data),
  charge:  (id: string, data: { amount: number; orderId?: string; notes?: string }) =>
    api.post(`/crm/credit-accounts/${id}/charge`, data),
  settle:  (id: string, data: { amount: number; paymentMethod: string; notes?: string }) =>
    api.post(`/crm/credit-accounts/${id}/settle`, data),
};

export const attendanceApi = {
  list:     (params?: { userId?: string; from?: string; to?: string; page?: number; limit?: number }) =>
    api.get('/crm/attendance', { params }),
  summary:  (from: string, to: string) =>
    api.get('/crm/attendance/summary', { params: { from, to } }),
  onDuty:   () => api.get('/crm/attendance/on-duty'),
  clockIn:  (userId: string, branchId?: string) =>
    api.post('/crm/attendance/clock-in', { userId, branchId }),
  clockOut: (attendanceId: string) =>
    api.post(`/crm/attendance/clock-out/${attendanceId}`),
};

// ─── Multi-Outlet API ─────────────────────────────────────────────────────────

export const multiOutletApi = {
  overview:    (from?: string, to?: string) =>
    api.get('/multi-outlet/overview', { params: { from, to } }),
  comparison:  (from?: string, to?: string) =>
    api.get('/multi-outlet/comparison', { params: { from, to } }),
  topItems:    (from?: string, to?: string, limit = 20) =>
    api.get('/multi-outlet/top-items', { params: { from, to, limit } }),
  payments:    (from?: string, to?: string) =>
    api.get('/multi-outlet/payments', { params: { from, to } }),

  pushMenu:    (branchIds: string[], categoryIds?: string[]) =>
    api.post('/multi-outlet/menu/push', { branchIds, categoryIds }),
  getBranchMenu: (branchId: string) =>
    api.get(`/multi-outlet/branches/${branchId}/menu`),
  getOverrides:  (branchId: string) =>
    api.get(`/multi-outlet/branches/${branchId}/overrides`),
  upsertOverride: (branchId: string, data: { menuItemId: string; isAvailable?: boolean; priceOverride?: number }) =>
    api.post(`/multi-outlet/branches/${branchId}/overrides`, data),
  bulkOverrides:  (branchId: string, overrides: any[]) =>
    api.post(`/multi-outlet/branches/${branchId}/overrides/bulk`, { overrides }),
  deleteOverride: (branchId: string, menuItemId: string) =>
    api.delete(`/multi-outlet/branches/${branchId}/overrides/${menuItemId}`),

  listTransfers:   (branchId?: string) =>
    api.get('/multi-outlet/stock-transfers', { params: { branchId } }),
  createTransfer:  (data: { toBranchId: string; ingredientId: string; quantity: number; unit: string; notes?: string }) =>
    api.post('/multi-outlet/stock-transfers', data),
  updateTransfer:  (id: string, status: 'COMPLETED' | 'CANCELLED') =>
    api.patch(`/multi-outlet/stock-transfers/${id}/status`, { status }),
};

// ─── Complaints API ───────────────────────────────────────────────────────────

export const complaintsApi = {
  file: (orderId: string, data: { orderItemId: string; reason: string; notes?: string }) =>
    api.post(`/orders/${orderId}/complaints`, data),

  list: (params?: { from?: string; to?: string; page?: number; limit?: number }) =>
    api.get('/complaints', { params }),

  analytics: (params?: { from?: string; to?: string }) =>
    api.get('/complaints/analytics', { params }),

  resolve: (id: string, resolution: string) =>
    api.patch(`/complaints/${id}/resolve`, { resolution }),
};

// ─── Advanced POS API ─────────────────────────────────────────────────────────

export const advancedPosApi = {
  transferTable: (data: { orderId: string; toTableId: string }) =>
    api.post('/integrations/pos/transfer-table', data),

  mergeOrders: (data: { orderIds: string[] }) =>
    api.post('/integrations/pos/merge-orders', data),

  splitBill: (data: { orderId: string; splitType: 'EQUAL' | 'BY_ITEM'; splitCount?: number; itemGroups?: { itemIds: string[] }[] }) =>
    api.post('/integrations/pos/split-bill', data),
};

// ─── Shift Handover API ───────────────────────────────────────────────────────

export const handoverApi = {
  myOrders:       () => api.get('/orders/handover/my-orders'),
  activeCaptains: () => api.get('/orders/handover/active-captains'),
  reassign:       (toCaptainId: string, orderIds?: string[]) =>
    api.post('/orders/handover/reassign', { toCaptainId, orderIds }),
};

// ─── Day Close API ────────────────────────────────────────────────────────────

export const dayCloseApi = {
  getStatus:    () => api.get('/day-close/status'),
  getUnbilled:  () => api.get('/day-close/unbilled'),
  initiate:     () => api.post('/day-close/initiate'),
  carryForward: () => api.post('/day-close/carry-forward'),
  complete:     (data: { cashInDrawer: number; notes?: string }) =>
    api.post('/day-close/complete', data),
};

// ─── Receipt Settings API ─────────────────────────────────────────────────────

export const receiptApi = {
  get:    () => api.get('/receipt-settings'),
  update: (data: any) => api.put('/receipt-settings', data),
};

// ─── Combo Items API ──────────────────────────────────────────────────────────

export const comboApi = {
  list:   () => api.get('/combo-items'),
  create: (data: { name: string; price: number; description?: string; entries: { menuItemId: string; quantity: number }[] }) =>
    api.post('/combo-items', data),
  update: (id: string, data: any) => api.patch(`/combo-items/${id}`, data),
  remove: (id: string) => api.delete(`/combo-items/${id}`),
};
