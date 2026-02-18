# RestroSync - Architecture Decisions & Rules

Critical architectural rules that MUST be followed during implementation.
This document exists because these details are easy to miss and cause major bugs if skipped.

---

## 1. Tenant & Branch Isolation

Every database table that holds business data MUST have `restaurantId` (tenant) scoping.
Branch-specific data MUST also have `branchId`.

**Rules:**
- Every API query MUST be scoped: `WHERE restaurantId = <from JWT>`
- Auth JWT payload includes: `userId`, `restaurantId`, `branchId`, `role`
- A NestJS middleware/guard extracts tenant context from JWT and injects it into every query
- No raw SQL — always go through Prisma with tenant filters
- Branch-scoped data (orders, bills, stock, tables) MUST check `branchId` too
- Users with `branchId = null` have access to ALL branches (Owner/Manager)

```
// JWT payload structure
{
  userId: "uuid",
  restaurantId: "uuid",
  branchId: "uuid" | null,    // null = all branches
  role: "OWNER" | "MANAGER" | "BILLER" | "CAPTAIN" | "KITCHEN",
  deviceId: "uuid"            // for POS device binding
}
```

---

## 2. Permissions Model (RBAC)

Roles alone are NOT enough. Need granular permissions.

**Tables to add:**
```
permissions         - Individual permissions (e.g., "order:create", "discount:apply", "menu:edit")
role_permissions    - Maps role → permissions
```

**Permission examples:**
| Permission | Owner | Manager | Biller | Captain | Kitchen |
|-----------|-------|---------|--------|---------|---------|
| menu:view | Y | Y | Y | Y | Y |
| menu:edit | Y | Y | N | N | N |
| menu:toggle_availability | Y | Y | Y | N | N |
| order:create | Y | Y | Y | Y | N |
| order:cancel | Y | Y | N | N | N |
| order:apply_discount | Y | Y | N | N | N |
| order:price_override | Y | N | N | N | N |
| bill:generate | Y | Y | Y | N | N |
| bill:void | Y | Y | N | N | N |
| bill:reprint | Y | Y | Y | N | N |
| bill:refund | Y | Y | N | N | N |
| kot:view | Y | Y | Y | Y | Y |
| kot:mark_ready | Y | Y | N | N | Y |
| inventory:view | Y | Y | N | N | N |
| inventory:edit | Y | Y | N | N | N |
| reports:view | Y | Y | N | N | N |
| settings:edit | Y | N | N | N | N |
| staff:manage | Y | Y | N | N | N |

**Manager PIN override:**
- Some actions (price override, void bill, cancel order) require a Manager/Owner PIN
- UI shows a PIN prompt → validates against manager's PIN → allows action
- Logged in audit trail

---

## 3. Order State Machine

Orders MUST follow strict state transitions. Backend MUST reject invalid transitions.

```
                    ┌─────────────┐
                    │  CANCELLED  │
                    └──────▲──────┘
                           │ (from NEW or ACCEPTED only)
                           │
┌─────┐    ┌──────────┐    ┌───────────┐    ┌───────┐    ┌────────┐    ┌───────────┐
│ NEW │───→│ ACCEPTED │───→│ PREPARING │───→│ READY │───→│ SERVED │───→│  BILLED   │
└─────┘    └──────────┘    └───────────┘    └───────┘    └────────┘    └───────────┘
                                                                             │
                                                                             ▼
                                                                      ┌───────────┐
                                                                      │ COMPLETED │
                                                                      └───────────┘
```

**Transitions vary by operating mode:**

| Transition | COUNTER | TABLE_SIMPLE | FULL_SERVICE |
|-----------|---------|--------------|--------------|
| NEW → BILLED | Yes (instant billing) | No | No |
| NEW → ACCEPTED | No | Auto | Auto (dine-in/takeaway), Manual (online) |
| ACCEPTED → PREPARING | N/A | Manual (biller marks) | Auto (kitchen taps KDS) |
| PREPARING → READY | N/A | Manual (biller marks) | Kitchen marks on KDS |
| READY → SERVED | N/A | Manual (biller marks) | Captain confirms |
| SERVED → BILLED | N/A | Biller generates bill | Biller generates bill |
| BILLED → COMPLETED | Payment received | Payment received | Payment received |
| → CANCELLED | From NEW only | From NEW/ACCEPTED | From NEW/ACCEPTED |

**COUNTER mode simplified flow:**
```
NEW → BILLED → COMPLETED
       (order + bill created simultaneously)
NEW → CANCELLED
```

**TABLE_SIMPLE / FULL_SERVICE full flow:**
```
NEW → ACCEPTED → PREPARING → READY → SERVED → BILLED → COMPLETED
NEW/ACCEPTED → CANCELLED
```

**Backend implementation:**
```typescript
// Mode-aware transition map
const transitions = {
  COUNTER: {
    NEW: ['BILLED', 'CANCELLED'],
    BILLED: ['COMPLETED'],
  },
  TABLE_SIMPLE: {
    NEW: ['ACCEPTED', 'CANCELLED'],
    ACCEPTED: ['PREPARING', 'CANCELLED'],
    PREPARING: ['READY'],
    READY: ['SERVED'],
    SERVED: ['BILLED'],
    BILLED: ['COMPLETED'],
  },
  FULL_SERVICE: {
    // same as TABLE_SIMPLE
  }
};
// Backend reads restaurant.operatingMode → picks correct map
```

**Order item statuses (independent, TABLE_SIMPLE + FULL_SERVICE only):**
```
PENDING → PREPARING → READY → SERVED
```

### Order Edit Concurrency (Optimistic Locking)

Multiple devices (biller + captain) can edit the same order simultaneously.

**Solution:** Add `version` field to orders table.
```
// Orders table
version   Int   @default(1)   // incremented on every update
```

**Rules:**
- Every update request includes the current `version` the client has
- Backend: `UPDATE orders SET ..., version = version + 1 WHERE id = :id AND version = :clientVersion`
- If `affected rows = 0` → version mismatch → return `409 Conflict`
- Client receives 409 → refetches latest order → shows diff to user → retries
- Flutter/React must handle 409 gracefully: "This order was updated by another device. Refreshing..."

### Order Price Snapshot (Critical)

**Problem:** If a restaurant changes a menu item's price from ₹200 to ₹250, all historical orders referencing that item must NOT change. Old bills must show ₹200, not ₹250.

**Rule:** `order_items` stores a **snapshot** of the item at the time of ordering. It does NOT reference live menu data for price/tax.

**Fields stored in order_items (snapshot at order time):**
```
order_items
  ...
  itemName        TEXT        -- "Paneer Butter Masala" (frozen, even if menu item renamed later)
  itemShortName   TEXT        -- "PBM" (for KOT printing)
  variantName     TEXT        -- "Full" (frozen)
  unitPrice       DECIMAL     -- price at time of order (NOT a FK to menu_items.price)
  taxPercent      DECIMAL     -- tax rate at time of order
  taxGroupName    TEXT        -- "GST 5%" (frozen)
  discountAmount  DECIMAL     -- discount applied to this item
  addons          JSONB       -- [{ name: "Extra Cheese", price: 30 }] (frozen snapshot)
  priority        TEXT        -- "NORMAL" | "RUSH" | "VIP" (default NORMAL)
```

**Why JSONB for addons:** Addon names and prices can change. Storing as JSON snapshot preserves exact order history.

**Order Priority:**
- Each order has a `priority` field: `NORMAL` (default), `RUSH`, `VIP`
- `RUSH` = customer in a hurry, kitchen should prioritize
- `VIP` = important guest (owner's guest, influencer, regular high-spender)
- Priority is set by biller/captain at order time or edited later
- KDS displays priority with visual indicator: RUSH = orange badge, VIP = red badge
- KDS sorts orders: VIP first → RUSH → NORMAL (within same status)
- KOT prints priority at top: `*** RUSH ORDER ***` or `*** VIP ORDER ***`
- Only users with `order:set_priority` permission can set RUSH/VIP (Biller + Manager + Owner)

**Rules:**
- When creating an order item, read current price/tax from menu_items and COPY into order_items
- Never join order_items → menu_items for billing or reports
- Reports query order_items directly (self-contained data)
- If menu item is deleted, old order_items still have the name and price

### Menu Items Soft-Delete (Critical Rule)

**NEVER hard-delete menu items.** Menu items are referenced by historical order_items (via snapshot). Deleting a menu item breaks nothing (snapshots are self-contained), but we still need the item for:
- Analytics: "How many Paneer Tikka were sold last month?"
- Re-activation: Owner may want to bring back a seasonal item
- Audit trail: Complete menu history

**Rule:** Use `isArchived` flag instead of DELETE.
```
menu_items
  ...
  isAvailable     BOOLEAN     -- toggled daily (out of stock today)
  isArchived      BOOLEAN     -- soft-deleted (removed from menu permanently)
```

- `isAvailable = false` → temporarily out of stock (shown greyed out on POS, hidden from customer)
- `isArchived = true` → permanently removed from menu (hidden everywhere, only visible in "Archived Items" admin page)
- Owner can un-archive an item to bring it back
- Prisma queries filter `WHERE isArchived = false` by default
- Admin Dashboard → Menu → "Archived Items" tab shows all archived items with "Restore" button
- Backend: `DELETE /menu-items/:id` actually sets `isArchived = true` (soft-delete)
- **Never use `DELETE FROM menu_items` in any migration or API**

### Multi-Round Ordering & Bill Calculation

**Problem:** In TABLE_SIMPLE and FULL_SERVICE, customers order in multiple rounds (e.g., starters first, then main course, then desserts). Each round generates a new KOT. The final bill must include ALL rounds.

**How it works:**
- An order is a **single entity** for the entire table visit
- Each "round" is NOT a new order — it's adding items to the existing order
- Each round of new items generates a new KOT (KOT-001, KOT-002, KOT-003...)
- `order_items` has a `kotId` field linking items to which KOT they were printed on
- `order_items` also has a `roundNumber` field (1, 2, 3...) for display grouping

**Bill calculation (discount BEFORE tax — GST compliant):**
```
Bill = SUM(all order_items across all rounds for this order)
     - item-level discounts
     - bill-level discount
     = discounted subtotal
     + additional charges (service charge, packing — if taxable, included in tax base)
     + tax (GST on discounted subtotal + taxable charges)
     + round-off
     = Grand Total
```

**Rules:**
- Adding items to a running order: creates new order_items with next roundNumber, generates new KOT
- Removing items from a running order: only allowed if item status is PENDING (not yet prepared). Requires Manager PIN if item is already PREPARING.
- The bill is generated ONCE at the end, covering all rounds
- Running order total (displayed on POS) updates in real-time as items are added
- KOT number is sequential per order: KOT-001, KOT-002, etc. (not per business day — that's the global KOT sequence)
- Each KOT prints only the NEW items from that round, not the full order

### KOT Round Labeling (prevents kitchen confusion)

**Problem:** Kitchen receives 3 separate KOT slips for the same table across multiple rounds. Without clear labeling, they might think KOT #3 is a new full order.

**KOT header for multi-round orders:**
```
================================
  ** KOT **
================================
TABLE 5 — Order #142
Round 2 (ADDITION)
KOT: KOT-20260212-042
Time: 14:45
================================
1x  Idli
1x  Tea
================================
```

**Rules:**
- Round 1 KOT: prints normally (no "Round" label needed, or "Round 1" optional)
- Round 2+: KOT header shows "Round X (ADDITION)" prominently
- Order number printed on every KOT so kitchen can group slips for the same table
- Table number always visible at top
- Only NEW items from this round are printed (not the full order)

---

## 4. Offline Sync Strategy

**Source of truth:** Server is ALWAYS the source of truth.

### Offline Bill/KOT Numbering (prevents duplicates across devices)

**Problem:** Two devices billing offline will generate the same bill number (e.g., INV-001).

**Solution: Server pre-allocates number ranges per device.**

```
Device registers → Server assigns:
  Device A: bill range 001–100, KOT range 001–100
  Device B: bill range 101–200, KOT range 101–200
```

**Rules:**
- On device login / app start, device requests a number range from server
- Range stored locally in SQLite: `{ type: "BILL", start: 101, end: 200, current: 101 }`
- Each bill/KOT uses next number from local range
- When device reaches 80% of range (online), it requests a new batch in background
- If offline AND range exhausted → fallback format: `{BRANCH}-{DEVICE}-{LOCAL_SEQ}`
  - Example: `MN-D1-0042` (Main branch, Device 1, local sequence 42)
  - On sync, server assigns final official number and updates the bill record
- Bill number format: `INV-{YYYYMMDD}-{SEQ}` where SEQ comes from pre-allocated range
- KOT number format: `KOT-{YYYYMMDD}-{SEQ}`
- Financial year prefix (optional): `INV-2627-{BRANCH}-{SEQ}` (FY 2026–27)

**Number range table (server-side):**
```
number_ranges
  id            UUID
  branchId      UUID
  deviceId      UUID
  type          TEXT        -- "BILL" or "KOT"
  rangeStart    INT
  rangeEnd      INT
  currentNumber INT
  financialYear TEXT        -- "2026-27"
  createdAt     TIMESTAMP
```

**Sync rules:**
- Client generates a UUID + idempotency key for every order/KOT created offline
- Orders saved to local SQLite with `syncStatus: PENDING | SYNCING | SYNCED | FAILED`
- When online, sync engine processes queue in FIFO order
- Server checks idempotency key before creating — if already exists, returns existing record
- If server rejects (e.g., item no longer available), mark as FAILED with error reason
- UI shows failed syncs for manual resolution

**Sync queue table (SQLite - on device):**
```
sync_queue
  id              TEXT PRIMARY KEY
  entity          TEXT        -- "order", "kot", "payment"
  action          TEXT        -- "create", "update"
  payload         TEXT        -- JSON of the request body
  idempotencyKey  TEXT UNIQUE -- UUID generated client-side
  status          TEXT        -- PENDING, SYNCING, SYNCED, FAILED
  retryCount      INTEGER DEFAULT 0
  maxRetries      INTEGER DEFAULT 5
  lastError       TEXT
  createdAt       TEXT
  lastAttempt     TEXT
```

**Retry strategy:**
- Exponential backoff: 1s, 2s, 4s, 8s, 16s
- Max 5 retries, then mark FAILED
- Failed items shown in a "Sync Issues" screen for manual retry or discard

### Sync Throttling After Long Outage

**Problem:** Restaurant was offline for 2 hours during dinner rush. 50+ orders queued locally. Internet returns → sync engine pushes all at once → server overloaded.

**Rules:**
- Sync engine processes in batches of **5 items** with **500ms gap** between batches
- Show sync progress: "Syncing 12/50 orders..."
- Priority order: **payments first** (financial data) → **bills** → **orders** → **KOTs** → **updates**
- If any item in batch fails, continue with next batch (don't block the queue)
- After full sync, refetch server state to reconcile any missed updates

**Menu sync:**
- Full menu pulled on app start and cached in SQLite
- Incremental sync via `updatedAt` timestamp: `GET /menu?updatedSince=<timestamp>`
- Menu version number on server — client checks version on each sync

---

## 5. Idempotency

**Problem:** Network retry can cause duplicate orders/KOTs/payments.

**Solution:** Every create request includes an `X-Idempotency-Key` header.

**Rules:**
- Client generates UUID before sending request, **prefixed with deviceId:** `{deviceId}:{uuid}`
  - This guarantees uniqueness across devices even if UUID libraries have issues on cheap hardware
- Server stores idempotency keys in Redis with 24h TTL
- If key already exists, return the original response (no duplicate created)
- Applied to: order creation, KOT creation, payment recording, bill generation

```
// Server middleware
const existing = await redis.get(`idempotency:${key}`);
if (existing) return JSON.parse(existing);  // return cached response
// ... process request ...
await redis.set(`idempotency:${key}`, JSON.stringify(response), 'EX', 86400);
```

---

## 6. Pricing & Tax Logic

**WARNING:** GST rates are country-specific and change periodically (budget announcements, GST council decisions). All tax rates MUST be fully configurable via the admin dashboard — NEVER hardcode rates. Verify all tax logic with a Chartered Accountant (CA) before production deployment.

**GST rules for restaurants (as of 2026 — verify with CA):**
- Non-AC / takeaway: 5% GST (2.5% CGST + 2.5% SGST)
- AC dining: 5% GST (for most restaurants under Rs.7500 rent)
- Luxury / 5-star: 18% GST
- Alcohol: VAT (state-specific, NOT GST)
- Intra-state: CGST + SGST
- Inter-state: IGST (rare for restaurants, but handle it)

**Tables to add:**
```
tax_groups          - "GST 5%", "GST 18%", "VAT 20%"
  id, restaurantId, name, isActive

tax_components      - Individual tax lines within a group
  id, taxGroupId, name, rate, type (CGST/SGST/IGST/VAT/CESS)
```

**Rules:**
- Each menu item is assigned a `taxGroupId`
- Bill calculates tax per item, then sums
- Tax-inclusive vs tax-exclusive pricing (configurable per restaurant)
- **Rounding:** configurable direction (UP / DOWN / NEAREST), applied at bill level, stored as separate `roundOff` field
- Store tax breakdown in bill: CGST amount, SGST amount, IGST amount separately
- **Discount before tax:** GST is calculated on the discounted price. See Section 20 for correct bill calculation order.

---

## 7. Printer Robustness

**Problem:** ESC/POS printing fails silently. Printer disconnects, paper out, etc.

**Print queue (on device - SQLite):**
```
print_queue
  id              TEXT PRIMARY KEY
  type            TEXT        -- "KOT", "BILL", "REPORT"
  referenceId     TEXT        -- orderId or billId
  printerTarget   TEXT        -- "KITCHEN_1", "BAR", "BILLING"
  payload         TEXT        -- formatted print data
  status          TEXT        -- PENDING, PRINTING, PRINTED, FAILED
  retryCount      INTEGER DEFAULT 0
  createdAt       TEXT
  printedAt       TEXT
```

**Rules:**
- All prints go through the queue, never direct
- On failure: retry 3 times with 2s gap
- After 3 failures: show alert "Printer [name] unreachable" with options:
  - Retry
  - Switch to backup printer
  - Skip printing (mark as skipped)
- "Reprint" feature: any KOT or bill can be reprinted from order details
- Printer status check on app start (send test ESC/POS command)
- Support multiple printers: Kitchen Printer, Bar Printer, Bill Printer
- Each kitchen station maps to a printer in settings

### Unprinted Bills Recovery (Power Cut / App Crash)

**Problem:** Bill generated → payment recorded → printing starts → power cut / app crash. Bill is "paid" in system but customer has no receipt. On app restart, biller doesn't know which bills didn't print.

**Rules:**
- On app startup, print queue service scans for items with status PENDING or PRINTING
- Auto-retry all unfinished print jobs
- Show "Unprinted Bills" badge on POS home screen: "2 bills pending print"
- Tapping the badge shows list of unprinted bills → one-tap reprint each
- Print queue items with status PRINTING (interrupted mid-print) are reset to PENDING on app start
- This also handles KOTs that didn't print due to crash

### Printer Mapping Configuration (Flutter Settings Screen)

Restaurants have multiple printers. Each kitchen station, bar, and billing counter may have its own printer. The mapping MUST be configurable per device.

**Printer mapping table (SQLite on device):**
```
printer_mappings
  id              TEXT PRIMARY KEY
  printerName     TEXT        -- "Kitchen Printer", "Bar Printer", "Bill Printer"
  printerType     TEXT        -- "BLUETOOTH", "USB", "LAN"
  connectionInfo  TEXT        -- MAC address (BT), IP:port (LAN), or device path (USB)
  assignedTo      TEXT        -- "KITCHEN", "BAR", "DESSERT", "BILLING", "KITCHEN_COPY"
  isDefault       BOOLEAN     -- fallback if specific station printer not found
  isActive        BOOLEAN
```

**Rules:**
- On Flutter app first setup, user goes to Settings → Printer Setup
- "Scan for printers" button discovers Bluetooth/LAN printers
- User assigns each printer to a station: Kitchen, Bar, Dessert, Billing
- COUNTER mode: needs 2 printers (Bill Printer + Kitchen Copy Printer) or 1 printer that prints both sequentially
- TABLE_SIMPLE: needs Kitchen Printer + Bill Printer (can be same device)
- FULL_SERVICE: needs per-station printers + Bill Printer
- If assigned printer not found at print time, fall back to default printer
- "Test Print" button per printer (sends sample ESC/POS data)
- Mapping stored locally in SQLite (device-specific, not synced to server)
- Settings screen shows printer status: Connected (green) / Disconnected (red)

---

## 8. Audit & Compliance Logging

**Every sensitive action MUST be logged. Non-negotiable for restaurant accounting.**

**What to log:**
| Action | Details logged |
|--------|---------------|
| Order created | items, prices, table, staff |
| Order cancelled | reason, who cancelled, original amount |
| Order modified | what changed (items added/removed) |
| Discount applied | type, value, reason, who approved |
| Price override | original price, new price, who approved (manager PIN) |
| Bill generated | amount, tax breakdown |
| Bill voided | reason, who voided, refund amount |
| Bill reprinted | who reprinted, timestamp |
| Payment received | method, amount, reference |
| Refund issued | reason, amount, who approved |
| Item marked unavailable | which item, who toggled |
| Stock adjusted | ingredient, old qty, new qty, reason |
| User login/logout | device, IP, timestamp |
| Settings changed | what changed, old value, new value |

**Rules:**
- Audit logs are APPEND-ONLY. Never update or delete.
- Include `userId`, `branchId`, `timestamp`, `ipAddress`, `deviceId`
- Store old + new values as JSON for full traceability
- Retention: keep minimum 7 years (GST compliance in India)

---

## 9. Data Retention & Archival

**Problem:** Orders + order_items grow fast. 100 orders/day = 36,500/year per branch.

**Strategy:**
- Active data: last 90 days in main tables (fast queries)
- Archive: older data moved to `orders_archive`, `order_items_archive`
- PostgreSQL table partitioning by month on `createdAt` for orders
- Daily reports pre-computed and stored (no need to query raw orders for dashboards)
- Archival job: runs nightly, moves data older than 90 days
- Archived data still queryable but from archive tables (slower, acceptable)

---

## 10. Security

### Authentication
- Access token: 15 min expiry
- Refresh token: 7 days expiry, stored in DB, rotated on use
- On refresh: old refresh token invalidated, new one issued
- Max 3 active refresh tokens per user (oldest revoked)

### Silent Token Refresh (Never Lose an In-Progress Order)

**Problem:** Biller is building a complex 15-item order (10+ minutes). Access token expires. Biller taps "Place Order" → 401 Unauthorized → order lost.

**Solution: Dio/Axios interceptor handles token refresh transparently.**

**Rules:**
1. Dio interceptor catches 401 → automatically calls `/auth/refresh` with refresh token → gets new access token → retries the original request
2. User never sees the 401 — it's handled silently in the background
3. **If refresh token is ALSO expired** (biller didn't use app for 7+ days):
   - Save current in-progress order as a **local draft** in SQLite before redirecting to login
   - Draft includes: table, items, quantities, notes, customer info
   - After re-login → restore draft → show toast "Your draft order has been restored"
   - Never lose an in-progress order due to auth issues
4. Proactive refresh: refresh access token when it has <2 min remaining (not just on 401)
5. Queue concurrent requests during refresh — don't fire multiple refresh calls simultaneously

### POS Device Security
- POS tablets registered as "devices" in system
- Each device gets a `deviceId` stored in secure storage
- Login from unregistered device → requires Owner/Manager approval
- Owner can revoke device access remotely (invalidates all tokens on that device)
- 4-digit PIN login only works on registered devices

### PIN Security
- PINs stored **hashed** (bcrypt with salt), never plaintext
- PIN unique per restaurant (no two staff in same restaurant share a PIN)
- **Lockout:** 5 wrong PIN attempts → 15 min lockout on that device
- After lockout, must use full email/password login (not PIN)
- PIN change requires current PIN or Manager override
- Manager PIN (used for approvals) follows same hashing + lockout rules

### Rate Limiting
- Login: 5 attempts per 15 min per IP
- API: 100 requests/min per user (general)
- POS endpoints: 300 requests/min (higher limit for billing speed)
- After lockout: require full password (not PIN)

### Device Management Table
```
devices
  id              UUID
  restaurantId    UUID
  branchId        UUID
  name            TEXT        -- "Billing Counter 1", "Captain Phone - Raju"
  deviceFingerprint TEXT     -- hardware identifier
  isActive        BOOLEAN
  lastSeen        TIMESTAMP
  registeredBy    UUID       -- userId who approved
  createdAt       TIMESTAMP
```

---

## 11. Flutter State Management

**Decision: Riverpod**

Why Riverpod over BLoC:
- Less boilerplate than BLoC
- Better for dependency injection
- Compile-safe providers
- Easier testing
- Good fit for offline-first with repository pattern

**Architecture: Clean Architecture + Riverpod**
```
presentation (UI + Riverpod providers)
  ↓
domain (use cases, entities)
  ↓
data (repositories, datasources)
  ├── remote (API via Dio)
  └── local (SQLite via sqflite)
```

---

## 12. Socket.io Room Structure

```
Rooms:
  restaurant:{restaurantId}                    -- all events for a restaurant
  branch:{branchId}                            -- all events for a branch
  kitchen:{branchId}:{station}                 -- kitchen station specific
    e.g., kitchen:uuid:KITCHEN
    e.g., kitchen:uuid:BAR
    e.g., kitchen:uuid:DESSERT
  pos:{branchId}                               -- POS billing updates
  captain:{branchId}                           -- captain app updates
```

**Events:**
| Event | From | To | Payload |
|-------|------|-----|---------|
| order:new | POS/Captain | Kitchen rooms | order with items |
| order:updated | POS/Captain | Kitchen + POS | updated items |
| order:cancelled | POS | Kitchen + Captain | orderId, reason |
| kot:new | Server | Kitchen room | KOT details |
| kot:void | Server | Kitchen room | KOT void details (items removed) |
| item:ready | Kitchen | POS + Captain | orderId, itemId |
| order:ready | Kitchen | POS + Captain | orderId |
| table:status_changed | Server | POS + Captain | tableId, newStatus |
| menu:item_toggled | Admin | POS + Captain | itemId, isAvailable |

### Socket.io Reconnection Strategy

**Problem:** Mobile devices lose WiFi frequently (kitchen, walking around). On reconnect, the client's local state may be stale.

**Rules:**
1. **Auto-reconnect:** Socket.io client configured with exponential backoff (1s, 2s, 4s, 8s, max 30s)
2. **On reconnect event:**
   - Client re-joins all rooms (branch, kitchen station, etc.)
   - Client fetches full active orders for the branch: `GET /api/orders?branchId=X&status=ACTIVE`
   - Client replaces local order state with server data (server is source of truth)
   - KDS: refetch all pending/preparing orders and re-render
   - Captain app: refetch orders for assigned tables
   - POS: refetch running orders list
3. **Heartbeat:** Server pings every 25s, client responds. If 3 missed pings → server drops connection, client auto-reconnects
4. **Offline queue:** While disconnected, Socket.io events are NOT queued (they're transient). Instead, reconnection refetch handles state recovery.
5. **UI indicator:** Show "Reconnecting..." banner in Flutter/React when Socket.io is disconnected. Show "Connected" briefly on reconnect.

**Implementation (Flutter):**
```dart
socket.onReconnect((_) {
  // Re-join rooms
  socket.emit('join', { 'branchId': branchId, 'station': station });
  // Refetch active orders
  orderRepository.fetchActiveOrders(branchId);
});
```

**Implementation (React KDS):**
```typescript
socket.on('reconnect', () => {
  socket.emit('join', { branchId, station });
  fetchActiveOrders(branchId); // replace local state
});
```

---

## 13. Redis Usage Rules

**Use Redis for:**
- Caching: menu items, categories, tax groups (TTL: 5 min)
- Pub/Sub: Socket.io adapter for multi-server scaling
- Idempotency keys: store with 24h TTL
- Rate limiting: sliding window counters
- Session data: refresh token tracking

**Do NOT use Redis for:**
- Primary data storage
- Order state (always in PostgreSQL)
- Anything that needs durability

### Graceful Redis Degradation

**Problem:** If Redis crashes, Socket.io stops (no pub/sub), idempotency checks fail, rate limiting breaks, caches stale.

**Fallback behavior when Redis is unavailable:**
| Feature | Normal (Redis up) | Fallback (Redis down) |
|---------|-------------------|----------------------|
| Caching | Read from Redis | Read from PostgreSQL directly (slower, but works) |
| Idempotency | Check Redis key | **Skip check, log warning** — accept slight duplicate risk, deduplicate later |
| Rate limiting | Redis sliding window | **Disable temporarily** — log warning, re-enable when Redis recovers |
| Socket.io pub/sub | Redis adapter | **In-memory adapter** — works for single server, loses multi-server broadcast |
| Session tracking | Refresh tokens in Redis | Refresh tokens are also in PostgreSQL — use DB fallback |

**Rules:**
- NestJS wraps every Redis call in try-catch → on failure, use fallback, log error
- Redis health check endpoint: `GET /health/redis` → returns UP/DOWN
- Docker compose: `restart: always` on Redis container
- Monitoring: alert if Redis is down for >1 minute
- On Redis recovery: caches rebuild automatically via TTL expiry + lazy loading
- Socket.io connections auto-reconnect when Redis adapter comes back

---

## 14. Shift / Day-End Close Module

**Add to Phase 3 (POS):**

### Day-End Close Flow:
```
Manager opens "Close Day" screen
→ System checks: are there unbilled open orders?
  → If yes: warning "3 orders are still open (Table 5, 8, 12). Close anyway?"
  → Manager can: "Close & Carry Forward" or "Go Back to Bill Them"
  → Carried-forward orders roll into next business day
→ System shows: total sales, cash collected, card/UPI collected, refunds
→ Manager enters actual cash in drawer
→ System calculates difference (excess / shortage)
→ Manager adds notes for discrepancy
→ Submit → locks the day (no more billing for that date)
→ Generates Day Summary report (notes carried-forward orders count)
→ Next day starts fresh counters (bill number, KOT number)
```

### Day-End Close Locking (Prevent Concurrent Close)

**Problem:** Manager A starts day-end close on Tablet 1. Manager B also opens day-end close on Tablet 2. Both submit simultaneously → corrupted reports.

**Solution: Database lock flag.**
```
day_close_locks
  branchId        UUID
  businessDate    DATE
  status          TEXT        -- "IN_PROGRESS", "COMPLETED"
  initiatedBy     UUID        -- userId
  startedAt       TIMESTAMP
```

**Rules:**
- When Manager opens "Close Day" screen → backend sets lock: `status = IN_PROGRESS, initiatedBy = userId`
- Other devices trying to open close screen → see: "Day close in progress by [Manager A]. Please wait."
- Lock auto-expires after 10 minutes (in case Manager A abandoned without submitting)
- Only the user who initiated can submit or cancel the close
- After successful close: `status = COMPLETED`
- A completed day CANNOT be reopened (need Super Admin intervention for corrections)

### Cash Drawer:
- Opening balance entered at day start
- All cash transactions tracked
- Expected vs actual at close
- Discrepancy logged in audit

---

## 15. Naming Convention

**Project name:** RestroSync (use consistently everywhere)
**NOT:** "Hotel Management" (that's the folder name only)

Naming in code:
- Database: snake_case (restaurant_id, branch_id)
- API: camelCase (restaurantId, branchId)
- Flutter: camelCase (Dart convention)
- React: camelCase (JS convention)
- Files: kebab-case (order-service.ts, pos-screen.dart)
- Components: PascalCase (PosScreen, OrderCard)

---

## 16. Restaurant Operating Modes

Not every restaurant needs the full system. The software MUST support multiple operating modes that the owner selects during onboarding (and can change later in settings).

### Mode 1: Counter Billing (Quick Service)
**For:** Tea shops, dosa counters, small cafes, fast food, bakeries, juice shops

```
Customer comes to counter
→ Biller adds items on POS
→ Bill generated immediately (no table, no waiting)
→ 2 receipts print:
    Receipt 1 (Customer copy): Items, qty, price, GST breakdown, total, paid stamp
    Receipt 2 (Kitchen copy): Items, qty only (so kitchen knows what to prepare)
→ Customer pays at counter
→ Kitchen prepares and hands over
→ Done
```

**What's ENABLED:**
- POS Billing (Flutter)
- Menu management
- 2-receipt printing (customer copy + kitchen copy)
- Payments (cash/card/UPI)
- Reports & Analytics
- CRM (optional)
- Day-end close

**What's DISABLED/HIDDEN:**
- Table management (no tables)
- Captain app (no waiters)
- KDS kitchen display (kitchen copy receipt replaces it)
- Order states simplified: NEW → BILLED → COMPLETED (no PREPARING/READY/SERVED)
- No table selection screen — go straight to POS billing

**Bill flow:**
- Order + Bill created simultaneously (instant billing)
- No "running order" concept — everything is billed immediately
- Kitchen copy prints automatically alongside customer bill

### Mode 2: Table Service (Simple)
**For:** Small family restaurants, dhabas, mid-size restaurants without tech-savvy staff

```
Customer sits at table
→ Waiter takes order verbally/on paper
→ Biller enters order on POS against table number
→ KOT prints in kitchen (thermal printer)
→ Kitchen prepares from KOT (no KDS screen)
→ Food served
→ Customer asks for bill
→ Biller selects table → generates bill
→ Customer pays → table freed
```

**What's ENABLED:**
- POS Billing (Flutter)
- Table management (visual floor plan)
- Menu management
- KOT printing (thermal printer in kitchen)
- Running orders (per table)
- Payments (cash/card/UPI)
- Reports & Analytics
- Inventory (optional)
- CRM (optional)
- Day-end close

**What's DISABLED/HIDDEN:**
- Captain app (waiter doesn't use phone/tablet)
- KDS kitchen display screen (kitchen works from printed KOTs)
- Socket.io real-time updates to kitchen (not needed — KOT paper is enough)

**Order flow:**
- Biller creates order for a table
- Full order states: NEW → ACCEPTED → PREPARING → READY → SERVED → BILLED → COMPLETED
- But PREPARING/READY/SERVED are managed manually by biller (not by kitchen tapping KDS)
- "Mark as Served" button on POS for the biller after food is delivered

### Mode 3: Full Service (Complete System)
**For:** Large restaurants, chains, multi-outlet franchises, fine dining, cloud kitchens

```
Customer sits at table
→ Captain takes order on Flutter app (phone)
→ KOT auto-prints in kitchen + appears on KDS
→ Kitchen marks items ready on KDS
→ Captain gets notification, serves food
→ Biller generates bill on POS
→ Customer pays → table freed
```

**What's ENABLED:**
- Everything — all features, all modules

### How This Works in Code

**Database:**
```
// In restaurants table
operatingMode  String  @default("FULL_SERVICE")  // "COUNTER", "TABLE_SIMPLE", "FULL_SERVICE"
```

**Backend:**
- API endpoints exist for everything regardless of mode
- Mode only affects what the frontend/Flutter app shows or hides
- No feature-gating on backend — keeps it simple

**Flutter app behavior by mode:**

| Feature | COUNTER | TABLE_SIMPLE | FULL_SERVICE |
|---------|---------|--------------|--------------|
| Table selection screen | Hidden | Shown | Shown |
| Captain mode | Hidden | Hidden | Shown |
| KOT printing | Kitchen copy only | Full KOT | Full KOT |
| Order + Bill together | Yes (instant) | No (separate) | No (separate) |
| Running orders list | Hidden | Shown | Shown |
| KDS screen (React) | Hidden | Hidden | Shown |
| 2-receipt printing | Yes | No (KOT + Bill separate) | No (KOT + Bill separate) |
| Order state flow | NEW → BILLED → COMPLETED | Full (manual tracking) | Full (KDS tracking) |

**React dashboard behavior by mode:**
- KDS page: hidden in COUNTER and TABLE_SIMPLE modes
- Table management page: hidden in COUNTER mode
- Captain management: hidden in COUNTER and TABLE_SIMPLE modes
- Settings page shows mode switcher

**Onboarding flow:**
```
Owner signs up
→ "How does your restaurant work?"
   ○ Counter billing (customers order and pay at counter)
   ○ Table service - simple (waiters take orders, no devices in kitchen)
   ○ Full service (captain app + kitchen display)
→ Selection saved to restaurant.operatingMode
→ UI adapts accordingly
→ Can change anytime in Settings
```

### Token Number System (Counter Mode)

**Problem:** In counter-billing restaurants, customers need a way to know when their order is ready. There are no tables — so the system needs token numbers.

**Rules:**
- COUNTER mode only: each order gets a `tokenNumber` (auto-incremented per business day)
- Token number resets daily at business-day cutoff time (e.g., 5 AM)
- Token number is printed on both receipts (customer copy + kitchen copy)
- Token is simple sequential: 1, 2, 3... (not the bill number)
- **Order Ready Display** (React web page on a TV/monitor facing customers):
  - Shows currently ready token numbers: "Now Ready: 12, 14, 15"
  - Updated via Socket.io when kitchen marks order ready (or biller marks ready in COUNTER mode)
  - Large font, auto-scroll, optional audio chime
  - Route: `/display/counter/{branchId}` (can run on any browser)
- Token number stored in `orders` table: `tokenNumber INT NULL` (NULL for non-COUNTER modes)
- Sequence tracked in memory per branch per business day (reset on day-end close or cutoff)

**Token number on receipts:**
```
================================
  ** TOKEN: 15 **
================================
```
Printed prominently at top of both customer and kitchen copy.

### 2-Receipt Printing (Counter Mode)

**Customer Receipt:**
```
================================
        RESTAURANT NAME
      Address line 1, City
     GSTIN: 29XXXXXXXXXXXZ
================================
Receipt #: INV-20260212-001
Date: 12-Feb-2026  Time: 14:30
================================
Item            Qty    Amount
--------------------------------
Masala Dosa      1     ₹120.00
Filter Coffee    1      ₹60.00
--------------------------------
Subtotal               ₹180.00
CGST (2.5%)              ₹4.50
SGST (2.5%)              ₹4.50
================================
GRAND TOTAL            ₹189.00
================================
Payment: Cash
Received: ₹200.00
Change: ₹11.00
================================
     Thank you! Visit again
       FSSAI: XXXXXXXXX
================================
```

**Kitchen Copy:**
```
================================
  ** KITCHEN ORDER **
================================
#INV-20260212-001  14:30
================================
1x  Masala Dosa
1x  Filter Coffee
================================
```

Short, no prices, just what to prepare. Auto-prints alongside customer bill.

---

## 17. Super Admin (SaaS Platform Management)

The system has **two levels of administration**. The Super Admin is the platform owner (you) who manages all restaurants. Restaurant Owners only see their own data.

### Role Hierarchy
```
SUPER_ADMIN          ← You (platform owner). Sees ALL restaurants.
  └── OWNER          ← Restaurant owner. Sees only their restaurant.
        ├── MANAGER
        ├── BILLER
        ├── CAPTAIN
        └── KITCHEN
```

### Super Admin is NOT inside any restaurant
- Super Admin has NO `restaurantId` — they sit above all restaurants
- Super Admin JWT: `{ userId, role: "SUPER_ADMIN", restaurantId: null }`
- All restaurant-scoped endpoints return 403 for Super Admin (they use Super Admin-specific endpoints instead)
- Super Admin endpoints are prefixed: `/api/super-admin/*`

### Database additions
```
// User model — add SUPER_ADMIN to UserRole enum
enum UserRole {
  SUPER_ADMIN     // Platform owner — new
  OWNER
  MANAGER
  BILLER
  CAPTAIN
  KITCHEN
}

// Users with role SUPER_ADMIN have restaurantId = null
// Guard: isSuperAdmin() checks role === SUPER_ADMIN && restaurantId === null
```

### Super Admin API endpoints
```
GET    /api/super-admin/restaurants              — List all restaurants (with search, filter, pagination)
POST   /api/super-admin/restaurants              — Create new restaurant + owner account
GET    /api/super-admin/restaurants/:id          — View restaurant details + stats
PATCH  /api/super-admin/restaurants/:id          — Update restaurant (name, plan, status)
PATCH  /api/super-admin/restaurants/:id/suspend  — Suspend restaurant (disable all logins)
PATCH  /api/super-admin/restaurants/:id/activate — Re-activate suspended restaurant
DELETE /api/super-admin/restaurants/:id           — Soft-delete restaurant (data retained)

GET    /api/super-admin/stats                    — Platform-wide stats (total restaurants, orders, revenue)
GET    /api/super-admin/restaurants/:id/stats     — Single restaurant stats

POST   /api/super-admin/admins                   — Create another super admin (optional)
```

### Restaurant onboarding flow (Super Admin creates)
```
Super Admin logs into dashboard
→ Clicks "Add Restaurant"
→ Fills form:
    - Restaurant name
    - Owner name, phone, email
    - City, address (optional)
→ Clicks "Create"
→ Backend:
    1. Creates restaurant record (status: ACTIVE, operatingMode: null — owner picks later)
    2. Creates owner user with auto-generated temp password
    3. Creates default branch ("Main Branch")
    4. Sends SMS/email to owner with login credentials
→ Restaurant appears in Super Admin's list
→ Owner logs in with temp password → forced to change password
→ Owner completes onboarding (pick operating mode, add menu, etc.)
```

### Restaurant self-signup flow (alternative)
```
Restaurant owner visits signup page (public)
→ Fills: restaurant name, owner name, phone, email, password
→ Account created automatically (status: ACTIVE)
→ Owner completes onboarding (pick operating mode, add menu, etc.)
→ Restaurant appears in Super Admin's dashboard
→ Super Admin can see, manage, or suspend if needed
```

### Restaurant statuses
```
ACTIVE       — Normal operation, all logins work
SUSPENDED    — All logins blocked, data preserved (e.g., payment overdue)
DELETED      — Soft-deleted, hidden from lists, data retained for compliance
```

### Super Admin Dashboard screens (React Web)

**Screen: Super Admin Login**
- Separate login route: `/super-admin/login`
- Email + password (no PIN login)
- After login → redirect to Super Admin Dashboard (NOT restaurant dashboard)

**Screen: Restaurants List**
- Table: restaurant name, owner name, city, mode, status, branches count, created date
- Search by name / phone / email
- Filter by: status (Active/Suspended), mode (Counter/Table/Full), city
- Sort by: newest, most orders, highest revenue
- Action buttons: View, Suspend, Activate, Delete

**Screen: Add Restaurant**
- Form: restaurant name, owner name, phone, email, city, address
- On submit → creates restaurant + owner account + sends credentials

**Screen: Restaurant Detail (view-only)**
- Restaurant info (name, GSTIN, address, mode, branches)
- Owner info (name, phone, email, last login)
- Stats: total orders (today/month/all-time), total revenue, active devices
- Branches list
- Staff list
- Recent orders (last 10)
- Action: Suspend / Activate / Delete

**Screen: Platform Dashboard (home)**
- Total restaurants (active / suspended)
- Total orders today (across all restaurants)
- Total revenue today
- New restaurants this month
- Chart: restaurant signups over time
- Chart: platform-wide orders trend
- Top 5 restaurants by revenue

### Security rules
- Super Admin routes protected by `@SuperAdminGuard()`
- Super Admin CANNOT place orders, generate bills, or take any restaurant-level action
- Super Admin can only view restaurant data (read-only) + manage restaurant status
- Restaurant users CANNOT access `/api/super-admin/*` endpoints
- Super Admin credentials created via CLI seed command (first time) — not via public signup

### First Super Admin creation (CLI)
```bash
# Run once during initial deployment
npm run seed:super-admin -- --email admin@restrosync.com --password <secure>
```
This creates the first Super Admin account. Additional super admins can be created from the dashboard.

---

## 18. Refund / Partial Refund Flow

### When refunds happen
- Customer complains about food quality → partial refund
- Wrong item served → item-level refund
- Full order cancellation after payment → full refund
- Online order rejected after payment → full refund

### Refund model
```
refunds
  id              UUID
  billId          UUID        -- FK to bills
  orderId         UUID        -- FK to orders
  type            TEXT        -- "FULL" or "PARTIAL"
  amount          DECIMAL     -- refund amount
  reason          TEXT        -- "Food quality", "Wrong item", "Customer complaint", etc.
  refundMethod    TEXT        -- "CASH", "CARD_REVERSAL", "UPI", "WALLET_CREDIT"
  approvedBy      UUID        -- userId of manager/owner who approved
  createdBy       UUID        -- userId who initiated
  status          TEXT        -- "PENDING", "APPROVED", "COMPLETED", "REJECTED"
  notes           TEXT
  createdAt       TIMESTAMP
```

### Partial refund — item level
```
refund_items
  id              UUID
  refundId        UUID
  orderItemId     UUID
  quantity        INT         -- qty being refunded (can be less than ordered qty)
  amount          DECIMAL     -- refund amount for this item
  reason          TEXT
```

### Refund flow
```
Staff selects a billed order
→ Taps "Refund"
→ Selects: Full refund OR pick specific items
→ For partial: select items + qty to refund
→ Enters reason
→ **Manager PIN required** to approve
→ Select refund method (cash back / card reversal / credit)
→ Refund recorded
→ Prints refund receipt
→ Logged in audit trail
→ Reflected in daily reports (sales - refunds = net sales)
```

### Bill Void vs Refund — Important Distinction

| Action | What it means | When used |
|--------|--------------|-----------|
| **Void Bill** | Bill is invalid, should not have been generated | Wrong items billed, duplicate bill, billing error |
| **Refund** | Bill was valid but money needs to be returned | Food quality, customer complaint, wrong item served |

**Void bill after cash collected:**
- If customer already paid cash and bill is voided → system MUST create a **cash-return entry**
- `void_cash_returns` table: `{ billId, amount, returnedBy, verifiedBy (Manager PIN), timestamp }`
- Day-end cash reconciliation accounts for voids: `Expected cash = collections - void returns - cash refunds`
- Voided bills still appear in audit logs and tax reports (marked as VOID, not deleted)
- Voided bills are NOT counted in revenue but ARE visible in reports with strikethrough

### Rules
- Only BILLED or COMPLETED orders can be refunded
- Refund amount cannot exceed bill amount
- Requires `bill:refund` permission (Owner + Manager by default)
- All refunds logged in audit trail with before/after
- Reports show: gross sales, voids, refunds, net sales separately
- Day-end close report: `Net Cash = Cash collected - Void returns - Cash refunds`
- Inventory: refunded items are NOT auto-restocked (food already prepared/wasted)

### Refund screen (Flutter POS)
- Search order by order number or table
- Select items to refund (or full refund toggle)
- Reason dropdown + optional notes
- Manager PIN prompt
- Refund method selection
- Print refund receipt
- Confirmation: "Refund of ₹XXX processed"

---

## 19. Timezone & Financial Year

### Timezone
- Each restaurant stores `timezone` (default: "Asia/Kolkata")
- ALL time-based logic uses restaurant's timezone:
  - Day-end close boundary
  - Daily report generation
  - Bill date display
  - "Today's orders" filter
- Server stores all timestamps in UTC
- Conversion to local timezone happens at API response level + Flutter/React display
- Cron jobs (nightly reports, archival) run per-restaurant using their timezone

### Financial Year (India)
- Indian financial year: April 1 → March 31
- Invoice numbering resets per financial year, NOT per calendar year
- Format: `INV-{FY}-{BRANCH}-{SEQ}` → e.g., `INV-2627-MN-00142` (FY 2026-27, Main branch, seq 142)
- `financialYear` derived from current date:
  ```
  if month >= 4: FY = "YYNN" (e.g., "2627" for Apr 2026–Mar 2027)
  if month < 4:  FY = "PPYY" (e.g., "2526" for Jan 2026–Mar 2026)
  ```
- Sequence counter is per branch per financial year (not per day)
- Table: `bill_counters` keyed by `(branchId, financialYear)` instead of `(branchId, date)`

### Business-Day Cutoff Time

**Problem:** A restaurant that closes at 2 AM considers orders from 10 PM–2 AM as the "same day" as the evening shift. Without a cutoff, day-end reports split this into two calendar days.

**Solution:** Configurable `businessDayCutoffTime` per branch.

```
businessDayCutoffTime   "05:00"     // Default: 5 AM
```

**Rules:**
- A "business day" runs from cutoff time to cutoff time (e.g., 5 AM today → 5 AM tomorrow)
- An order at 1:30 AM on Feb 13 with cutoff 5 AM belongs to **business day Feb 12**
- Day-end close: "Close Day" locks the business day, not the calendar day
- Bill counters, daily reports, "today's orders" filter all use business day
- Calculation: `if currentTime < cutoffTime, businessDate = yesterday; else businessDate = today`
- Configurable in Settings per branch (late-night bar vs morning cafe)

### Settings table entries
```
timezone              "Asia/Kolkata"
business_day_cutoff   "05:00"           // business day boundary
financial_year_start  "04"              // April (configurable for non-India)
invoice_prefix        "INV"
invoice_format        "{PREFIX}-{FY}-{BRANCH}-{SEQ}"
```

---

## 20. Additional Charges (Service Charge, Packing, Delivery, Tips)

Restaurants need configurable extra charges beyond item prices + tax.

### Charge types
```
charge_configs (per restaurant)
  id              UUID
  restaurantId    UUID
  name            TEXT        -- "Service Charge", "Packing Charge", "Delivery Fee"
  type            TEXT        -- "PERCENTAGE" or "FLAT"
  value           DECIMAL     -- 10 (meaning 10% or ₹10)
  applicableTo    TEXT        -- "DINE_IN", "TAKEAWAY", "DELIVERY", "ALL"
  isTaxable       BOOLEAN     -- whether tax applies on this charge
  isOptional      BOOLEAN     -- customer can ask to remove (e.g., service charge)
  isActive        BOOLEAN
  sortOrder       INT
```

### Common configurations
| Charge | Type | Value | Applies to | Taxable | Optional |
|--------|------|-------|------------|---------|----------|
| Service Charge | Percentage | 10% | Dine-in | No (typically) | Yes (legally must be optional) |
| Packing Charge | Flat | ₹20–50 | Takeaway | Yes | No |
| Delivery Fee | Flat | ₹30–60 | Delivery | Yes | No |

### Tips
- Separate from charges — tips are NOT taxable and NOT revenue
- Optional field on payment screen: "Tip amount"
- Stored in `payments` table with method `TIP`
- Not included in sales reports (separate tip report)

### Bill calculation order (GST compliant — discount BEFORE tax)
```
Subtotal (sum of item prices)
- Item-level discounts (if any)
- Bill-level discount (if any)
= Discounted subtotal
+ Additional charges (service charge, packing, etc.)
= Taxable amount (discounted subtotal + taxable charges)
+ Tax (GST on taxable amount)
+ Round-off
= Grand Total
+ Tip (optional, separate)
= Amount collected
```
**CRITICAL:** Discount MUST come before tax calculation. GST law requires tax to be calculated on the discounted price when the discount is mentioned on the invoice. Verify with a CA.

### Rounding Rules
- **Direction:** Configurable per restaurant — round UP, round DOWN, or NEAREST rupee
- Default: round to nearest rupee
- Round-off applied at bill level (not per item)
- Round-off amount stored as a separate field on bill: `roundOff DECIMAL`
- GST calculated on the pre-roundoff amount
- Manual override: biller can adjust round-off (e.g., customer asks to round down)
- Settings: Owner selects rounding direction in Settings → Tax Settings
- **Cash only:** Rounding applies ONLY to cash payments. UPI/card/bank transfers are charged the exact amount (no rounding). When split payment includes cash + digital, only the cash portion is rounded.
- Display: Bill shows `Grand Total: ₹347.60` and `Rounded (Cash): ₹348.00` — digital payment shows exact ₹347.60

### In Settings UI
- Owner can configure which charges are active
- Set percentage/flat values
- Toggle per order type (dine-in/takeaway/delivery)
- Mark as optional/mandatory

---

## 21. Receipt & Invoice Customization

Every restaurant wants their receipt to look different. Make it configurable per branch.

### Receipt settings (per branch)
```
receipt_settings
  id              UUID
  branchId        UUID
  headerLine1     TEXT        -- Restaurant name (auto from restaurant.name)
  headerLine2     TEXT        -- "Pure Veg | Family Restaurant"
  headerLine3     TEXT        -- Address line
  gstin           TEXT        -- auto from restaurant.gstin
  fssaiNumber     TEXT        -- auto from restaurant.fssaiNumber
  footerLine1     TEXT        -- "Thank you! Visit again"
  footerLine2     TEXT        -- "For complaints: 9876543210"
  footerLine3     TEXT        -- "Follow us @restaurant_insta"
  showLogo        BOOLEAN     -- print logo on receipt (if printer supports)
  logoUrl         TEXT
  paperWidth      TEXT        -- "58mm" or "80mm"
  showGstBreakdown BOOLEAN   -- show CGST/SGST split on receipt
  showItemTax     BOOLEAN     -- show tax per item or just total
  showFssai       BOOLEAN
  showOrderNumber BOOLEAN
  showTableNumber BOOLEAN
  showCustomerName BOOLEAN
  showDateTime    BOOLEAN     @default(true)
  kotShowItemPrice BOOLEAN    @default(false)  -- some kitchens want prices on KOT
```

### Receipt Reprint — DUPLICATE COPY Marking
- When a receipt/bill is reprinted (already printed once), it MUST show `*** DUPLICATE COPY ***` at the top
- Track print count per bill: `bills.printCount INT DEFAULT 0` — increment on each print
- First print: normal receipt. Second+ print: adds "DUPLICATE COPY" header
- This prevents fraud: staff reprinting bills to collect double payment
- KOT reprint also marked: `*** KOT REPRINT ***` (not to be prepared again)
- Reprint audit: log who reprinted, when, and how many times

### In Settings UI (Admin Dashboard)
- "Receipt Settings" page under Settings
- Live preview of receipt as owner edits fields
- Separate config for Customer Receipt vs KOT format
- "Print Test Receipt" button

---

## 22. Staff / User Management

Restaurant owners MUST be able to manage their staff without coding.

### What owners need to do
- Add new staff member (name, phone, role, branch, PIN)
- Edit staff details
- Reset staff PIN
- Deactivate staff (disable login without deleting)
- Assign staff to specific branch
- View staff activity (last login, orders taken today)

### Staff table additions
```
// Already in User model, but ensure these are manageable:
name, phone, email, role, branchId, pin, isActive, lastLogin
```

### Permission management
- Default permissions are pre-set per role (from permission matrix in Section 2)
- Owner can customize: e.g., allow a specific biller to apply discounts
- UI: role-based defaults with toggle overrides per user

### PIN rules
- 4-digit numeric PIN
- Unique per restaurant (no two staff in same restaurant share a PIN)
- Owner/Manager can reset any staff PIN
- PIN only works on registered devices

---

## 23. SaaS Plan Limits

Super Admin assigns plans. Plans enforce limits.

### Plans table
```
plans
  id            UUID
  name          TEXT        -- "FREE", "BASIC", "PRO", "ENTERPRISE"
  maxBranches   INT         -- 1, 3, 10, unlimited (-1)
  maxDevices    INT         -- 1, 5, 20, unlimited
  maxStaff      INT         -- 3, 10, 50, unlimited
  maxMenuItems  INT         -- 50, 200, 1000, unlimited
  features      JSONB       -- { "inventory": false, "crm": true, "multiOutlet": false, ... }
  priceMonthly  DECIMAL     -- ₹0, ₹999, ₹2999, ₹9999
  isActive      BOOLEAN
```

### Restaurant → plan mapping
```
// In restaurants table
planId         UUID        -- FK to plans
planExpiresAt  TIMESTAMP   -- null = no expiry (free plan)
```

### Enforcement
- Backend middleware checks limits before allowing actions:
  - Creating a branch → check `maxBranches`
  - Registering a device → check `maxDevices`
  - Adding staff → check `maxStaff`
  - Adding menu item → check `maxMenuItems`
- Feature-gating: check `plan.features.inventory` before allowing inventory endpoints
- On limit hit: return `402 Payment Required` with message "Upgrade to PRO to add more branches"
- Flutter/React shows upgrade prompt

### Super Admin manages plans
- Create/edit plans in Super Admin Dashboard
- Assign plan to restaurant when creating
- Change restaurant's plan anytime

---

## 24. Backups & Restore

### Database backups
- **Automated daily backups** of PostgreSQL using `pg_dump`
- Retention: keep last 30 daily backups + last 12 monthly backups
- Store backups in cloud storage (S3 / Cloudflare R2)
- Backup includes: all schemas, all data
- Schedule: run at 2 AM UTC daily (low traffic)

### Backup verification
- Weekly automated restore test to a staging database
- Verify row counts match production
- Alert if backup fails or size drops unexpectedly

### Restore scenarios
| Scenario | Action |
|----------|--------|
| Single restaurant data corruption | Restore from backup to temp DB, extract restaurant data, merge back |
| Full database failure | Restore latest backup to new server |
| Accidental deletion by restaurant | Soft-deletes everywhere, so just reactivate. True deletes need backup restore. |

### Redis
- Redis is ephemeral (cache + pub/sub) — no backup needed
- On Redis restart: caches rebuild automatically, active Socket.io connections reconnect

### File storage (images)
- S3/R2 has built-in versioning — enable it
- Deleted images recoverable for 30 days

### Super Admin visibility
- Backup status shown in Super Admin Dashboard
- Last backup time, size, status (success/failed)
- Manual backup trigger button (on-demand)

---

## 25. Audit Log Viewer

Audit logs are written everywhere but need to be readable.

### Who sees what
| Viewer | What they see |
|--------|--------------|
| Restaurant Owner | Their restaurant's audit logs (all branches) |
| Restaurant Manager | Their branch's audit logs only |
| Super Admin | Any restaurant's audit logs (read-only) |

### Audit Log screen (Admin Dashboard)
- Table: timestamp, user name, action, entity, details
- Filters:
  - Date range
  - User (staff member)
  - Action type (order created, discount applied, bill voided, etc.)
  - Branch (if multi-branch)
- Search by order number or bill number
- Expandable row: shows old value vs new value (JSON diff)
- Export to CSV/PDF

### Key audit events (prioritized for display)
- Discount applied (who, how much, on which order)
- Price override (original vs new price, who approved)
- Bill voided / cancelled (reason, who)
- Order cancelled (reason, who)
- Stock adjusted manually (ingredient, old qty, new qty, reason)
- Settings changed (what, old value, new value)
- Staff created / deactivated
- Day-end close submitted (cash difference, who closed)

### Retention
- Minimum 7 years (GST compliance in India)
- After 7 years: archive to cold storage (S3 Glacier), remove from active DB
- Audit logs are APPEND-ONLY — no update, no delete, ever

---

## 26. KOT Modification & Void KOT

### Problem
After a KOT is printed and sent to the kitchen, items may need to be cancelled (customer changes mind, item unavailable). The kitchen MUST be notified — otherwise they prepare food nobody wants.

### Void KOT Flow
```
Biller/Captain removes item from running order
→ Backend checks: is this item already in a printed KOT?
  → If PENDING (not started): remove silently, no void KOT needed
  → If PREPARING or beyond: generate a VOID KOT
→ Void KOT prints on the SAME kitchen printer as the original KOT
→ Void KOT format is visually distinct (see below)
→ Socket.io emits `kot:void` event to kitchen rooms
→ KDS (if FULL_SERVICE): shows voided items with strikethrough
→ Audit log records: who voided, which items, reason
```

### Void KOT Print Format
```
================================
  *** VOID KOT ***
  *** CANCEL ***
================================
Table: 5       Time: 14:45
Original KOT: KOT-003
================================
CANCELLED ITEMS:
  1x  Paneer Tikka
  1x  Butter Naan (2 of 4)
================================
Reason: Customer changed order
Voided by: Raju (Biller)
================================
```

### Rules
- Void KOT MUST print on same printer as original KOT (same kitchen station)
- Void KOT uses different formatting: bold "VOID" / "CANCEL" header, dashes through items
- Manager PIN required if item is already PREPARING (food may already be started)
- No Manager PIN needed if item is still PENDING
- Partial void supported: cancel 2 out of 4 naans
- Void KOT triggers `kot:void` Socket.io event → KDS updates in real-time
- Voided items tracked: `order_items.status = "VOIDED"` with `voidedAt`, `voidedBy`, `voidReason`
- Voided items do NOT appear on the final bill
- Voided items ARE logged in audit trail for accountability
- Inventory: voided items that were PREPARING may or may not need stock adjustment (manual decision)

### order_items additions
```
voidedAt        TIMESTAMP NULL
voidedBy        UUID NULL          -- userId who voided
voidReason      TEXT NULL
```

---

## 27. Discount Types & Rules

### Problem
Restaurants need multiple types of discounts. A flat 10% discount is not enough — they need item-level, bill-level, coupons, happy hours, and loyalty redemption.

### Discount Types
| Type | Scope | How it works |
|------|-------|-------------|
| **Flat Amount** | Bill-level | ₹100 off the bill total |
| **Percentage** | Bill-level | 10% off the bill subtotal |
| **Item-level Flat** | Per item | ₹20 off on Paneer Tikka |
| **Item-level Percentage** | Per item | 15% off on all Starters category |
| **Coupon Code** | Bill-level | Enter code → validates → applies discount |
| **Happy Hour** | Time-based, auto-applied | 20% off beverages between 3–6 PM |
| **Loyalty Redemption** | Bill-level | Redeem 500 points = ₹50 off |

### Discount model
```
discounts (per restaurant — discount definitions, not instances)
  id              UUID
  restaurantId    UUID
  name            TEXT        -- "Diwali Special 20%", "Happy Hour Beverages"
  type            TEXT        -- "FLAT", "PERCENTAGE"
  scope           TEXT        -- "BILL", "ITEM", "CATEGORY"
  value           DECIMAL     -- 100 (₹100) or 20 (20%)
  maxDiscount     DECIMAL     -- cap: max ₹500 off (for percentage discounts)
  minOrderValue   DECIMAL     -- minimum order value to apply (e.g., ₹500)
  applicableTo    JSONB       -- { categories: ["uuid"], items: ["uuid"] } or null for all
  couponCode      TEXT NULL   -- if coupon-based, the code
  startTime       TIME NULL   -- happy hour start (e.g., "15:00")
  endTime         TIME NULL   -- happy hour end (e.g., "18:00")
  startDate       DATE NULL   -- campaign start
  endDate         DATE NULL   -- campaign end (null = no expiry)
  maxUsageTotal   INT NULL    -- max total uses (null = unlimited)
  maxUsagePerCustomer INT NULL
  usageCount      INT DEFAULT 0
  isActive        BOOLEAN
  requiresPin     BOOLEAN     -- requires Manager PIN to apply
  createdBy       UUID
```

### Discount applied on order
```
order_discounts
  id              UUID
  orderId         UUID
  discountId      UUID NULL   -- FK to discounts table (null for manual/ad-hoc)
  type            TEXT        -- "FLAT", "PERCENTAGE"
  scope           TEXT        -- "BILL", "ITEM"
  value           DECIMAL     -- the discount value applied
  amount          DECIMAL     -- actual discount amount in ₹ (calculated)
  reason          TEXT        -- "Diwali Special" or manual reason
  couponCode      TEXT NULL
  appliedBy       UUID        -- userId who applied
  approvedBy      UUID NULL   -- Manager userId if PIN was required
  orderItemId     UUID NULL   -- if item-level, which item
```

### Rules
- **Permission gated:** `order:apply_discount` required (Owner + Manager by default)
- **Manual discounts** (ad-hoc): biller enters flat/percentage + reason → may require Manager PIN
- **Predefined discounts:** Owner creates discount rules in Settings. Biller selects from dropdown.
- **Coupon validation:** Enter code → backend validates (active, not expired, usage limit not hit, min order met)
- **Happy Hour:** auto-suggested by the system when time matches. Biller can accept or skip.
- **Stacking:** Only ONE bill-level discount at a time. Item-level discounts can stack with bill-level.
- **Max discount cap:** Percentage discounts can have a maxDiscount (e.g., 20% off, max ₹500)
- **Discount on subtotal BEFORE tax** (discount reduces taxable amount)
- **Bill calculation with discounts:**
  ```
  Subtotal (item prices)
  - Item-level discounts
  = Adjusted subtotal
  - Bill-level discount
  = Net subtotal
  + Additional charges (service charge, packing)
  + Tax (on net subtotal + taxable charges)
  + Round-off
  = Grand Total
  ```
- **All discounts logged in audit trail** with who applied, who approved, amount

### Discount Abuse Prevention

**Problem:** Biller gives 50% discount to friends/family on every order.

**Rules:**
- **Max discount limit per role:** configurable per restaurant. E.g., Biller can apply max 10% without Manager PIN. Above 10% → Manager PIN required.
- **Discount frequency monitoring:** backend tracks discount rate per biller (% of orders with discounts)
- **Alert threshold:** if a biller applies discounts on >20% of their orders in a day → auto-alert to Owner (push notification / dashboard alert)
- **Mandatory reason:** every discount requires a reason from dropdown (Loyalty, Complaint, Promotion, Manager Approved, Other)
- **Daily discount report:** prominently shown in dashboard — not buried in audit logs
  - Which biller, how many discounts, total ₹ discounted, average discount %
- **Manager PIN threshold:** configurable in Settings. E.g., "Require Manager PIN for discounts above ₹200 or 15%"

```
discount_config (per restaurant)
  maxDiscountWithoutPin    DECIMAL     -- e.g., 10 (10%)
  maxFlatDiscountWithoutPin DECIMAL    -- e.g., 200 (₹200)
  alertThresholdPercent    INT         -- e.g., 20 (alert if >20% of orders have discounts)
```

### Settings UI (Admin Dashboard)
- "Discounts" page under Settings
- Create/edit discount rules (type, scope, value, conditions, schedule)
- Active/inactive toggle
- Usage stats (how many times used, total discount given)
- Coupon code management

---

## 28. Table Reservation (Simple)

### Scope
A simple manual reservation system — NOT an online booking engine. The biller/manager takes a phone call, reserves a table.

### Reservation model
```
reservations
  id              UUID
  branchId        UUID
  tableId         UUID
  customerName    TEXT
  customerPhone   TEXT
  partySize       INT
  reservationDate DATE
  reservationTime TIME
  endTime         TIME NULL   -- expected end (optional)
  status          TEXT        -- "CONFIRMED", "SEATED", "CANCELLED", "NO_SHOW"
  notes           TEXT NULL   -- "Birthday celebration", "Window seat preferred"
  createdBy       UUID        -- staff who created
  createdAt       TIMESTAMP
```

### Rules
- Available in TABLE_SIMPLE and FULL_SERVICE modes only (hidden in COUNTER mode)
- Reservation = hold a table for a future time
- Table status changes to "RESERVED" when reservation time is within 30 min
- When customer arrives, staff marks reservation as "SEATED" → table becomes OCCUPIED, order can start
- If customer doesn't show within 15 min past reservation time → auto-mark "NO_SHOW", table freed
- No double-booking: backend checks for overlapping reservations on same table
- Overlap check: new reservation must not conflict with existing CONFIRMED reservations (allow 2hr default slot)
- No online booking — all reservations created by staff via POS or Admin Dashboard

### Table Occupied But No Order Alert
- Track `table.occupiedSince` timestamp (set when table status → OCCUPIED)
- If a table is OCCUPIED for >30 minutes with no order created → auto-alert on POS
- Alert: "Table 5 occupied for 30 min with no order. [Create Order] [Dismiss]"
- Configurable threshold per restaurant (default 30 min, range 15–60 min)
- Alert sent via Socket.io to POS biller + captain devices
- Helps catch: forgotten tables, walk-ins who sat but weren't attended, tables marked occupied by mistake
- Dismiss auto-snoozes for another 15 min (doesn't spam)

### UI (Flutter POS)
- Table map shows reserved tables in yellow with reservation time
- Tap reserved table → see reservation details, option to "Seat" or "Cancel"
- "New Reservation" button → select table, enter name, phone, party size, date, time
- Today's reservations list (sorted by time)

### UI (Admin Dashboard)
- Reservations page (table view): date picker, list of reservations
- Create / edit / cancel reservations
- Calendar view (optional future enhancement)

---

## 29. Error & Failure UX

### Principle
Every error state MUST be handled gracefully. No blank screens, no silent failures, no generic "Something went wrong."

### Sync Issues Screen (Flutter — detailed spec)
```
Screen: Sync Issues (accessible from offline indicator or Settings)
─────────────────────────────────────────
Header: "Sync Issues (3 pending)"

Card 1:
  [!] Order #TMP-MN-D1-0042 — FAILED
  Error: "Item 'Paneer Tikka' is no longer available"
  Created: 12 Feb 2026, 14:30 (offline)
  Retries: 5/5 exhausted
  [Retry]  [Edit Order]  [Discard]

Card 2:
  [↻] Order #TMP-MN-D1-0043 — RETRYING (attempt 3/5)
  Next retry in: 4s
  Created: 12 Feb 2026, 14:35 (offline)

Card 3:
  [!] Payment for Bill INV-2627-MN-00142 — FAILED
  Error: "Bill already has a payment recorded"
  [Retry]  [View Bill]  [Discard]
─────────────────────────────────────────
[Retry All Failed]  [Discard All]
```

### Error states for common scenarios
| Scenario | UX |
|----------|-----|
| Network timeout on order create | Toast: "Saving offline. Will sync when connected." + orange indicator |
| 409 Conflict (optimistic locking) | Modal: "This order was updated by another device. Refreshing..." → refetch → show diff |
| Printer not found | Alert: "Printer [Kitchen] not reachable" + buttons: Retry / Switch Printer / Skip |
| Printer paper out | Alert: "Printer may be out of paper. Check printer." + Retry |
| Item out of stock (server reject) | Toast: "Paneer Tikka is now unavailable" → remove from order, highlight in menu |
| Menu sync failed | Banner: "Menu may be outdated. Tap to retry sync." |
| Login failed (wrong PIN) | Shake animation + "Incorrect PIN. X attempts remaining." |
| PIN lockout | Screen: "Too many attempts. Locked for 15 minutes. Use email/password login." |
| Permission denied | Toast: "You don't have permission. Ask manager for PIN override." → show PIN prompt |
| Plan limit hit | Modal: "Device limit reached (5/5). Contact admin to upgrade plan." |
| Socket.io disconnected | Subtle banner at top: "Real-time updates paused. Reconnecting..." |
| Day-end already closed | Alert: "Business day Feb 12 is already closed. Orders will be for Feb 13." |
| Refund exceeds bill | Inline error: "Refund amount (₹500) exceeds bill total (₹350)." |

### Rules
- NEVER show raw error messages or stack traces to users
- Every API error response has a `userMessage` field (human-readable) + `errorCode` (machine-readable)
- Flutter: centralized error handler in Dio interceptor → maps errorCode to user-friendly messages
- React: centralized error handler in Axios interceptor → same mapping
- Offline actions: always show "Saved locally" confirmation so user knows it worked
- Failed syncs: NEVER silently discard — always surface in Sync Issues screen
- Critical failures (payment, billing): show blocking modal, not dismissible toast

---

## 30. Complimentary / Staff Meals

### Problem
Restaurants regularly give free meals: staff meals, owner's guests, complimentary for VIP customers, food tasting. These MUST be tracked — not just discounted to ₹0 (that distorts discount reports).

### Solution: Separate order type
```
// In orders table
orderType   TEXT   -- "DINE_IN", "TAKEAWAY", "DELIVERY", "COMPLIMENTARY"
```

### Complimentary sub-types
```
complimentaryReason  TEXT NULL  -- "STAFF_MEAL", "OWNER_GUEST", "CUSTOMER_COMP", "FOOD_TASTING"
complimentaryNote    TEXT NULL  -- "Staff lunch - Raju, Priya", "VIP guest of owner"
```

### Flow
```
Biller creates order → selects order type "Complimentary"
→ Selects reason: Staff Meal / Owner's Guest / Customer Complaint / Food Tasting
→ Adds items normally (prices shown but will be zeroed)
→ **Manager PIN required** to confirm
→ KOT prints normally in kitchen (kitchen doesn't know it's free)
→ Bill generated with:
    Subtotal: ₹850 (original prices shown)
    Discount: -₹850 (100% — Complimentary: Staff Meal)
    Grand Total: ₹0.00
→ No payment required
→ Order marked COMPLETED
```

### Rules
- Manager/Owner PIN required to create complimentary order
- `order:complimentary` permission added (Owner + Manager by default)
- Complimentary orders ARE tracked in:
  - Inventory (ingredients still consumed)
  - Staff meal reports (separate report: who ate what, when, cost value)
  - Audit trail (who approved, reason)
- Complimentary orders are NOT counted in:
  - Revenue / sales reports (separated out)
  - Discount reports (not a "discount" — different category)
- Reports show: "Complimentary meals this month: 45 orders, ₹12,500 cost value"
- KOT format is the same as regular KOT (kitchen prepares the same way)
- Receipt shows "COMPLIMENTARY" stamp instead of payment info
- Staff meals can be limited per day per staff (configurable: e.g., 1 meal/shift, max ₹200)

### Staff meal limits (optional)
```
staff_meal_config (per restaurant)
  maxMealsPerShift    INT         -- 1
  maxAmountPerMeal    DECIMAL     -- ₹200
  allowedDuringShift  BOOLEAN     -- only during active shift
```

### In reports
- Separate "Complimentary Report" page
- Breakdown: by reason (staff meals vs owner's guests vs customer complaints)
- Cost tracking: actual cost value of complimentary orders
- Trend: complimentary meals over time

---

## 31. Split Payment

### Problem
Bill is ₹1000. Customer A pays ₹600 cash. Customer B pays ₹400 UPI. What if UPI fails? What about splitting by items?

### Payment model (supports split)
```
payments (multiple entries per bill)
  id              UUID
  billId          UUID
  orderId         UUID
  method          TEXT        -- "CASH", "CARD", "UPI", "WALLET", "TIP"
  amount          DECIMAL
  status          TEXT        -- "PENDING", "COMPLETED", "FAILED", "REFUNDED"
  reference       TEXT NULL   -- UPI transaction ID, card last 4 digits
  splitLabel      TEXT NULL   -- "Customer A", "Person 1" (optional label)
  createdBy       UUID
  createdAt       TIMESTAMP
```

### Split modes
1. **Split by amount:** Biller enters amount per person/payment method. Total must equal bill amount.
2. **Split by items:** "I'll pay for my dishes, he pays for his." Biller assigns items to split groups. Each group becomes a separate payment entry.
3. **Equal split:** Divide total equally among N people.

### Partial payment state
- Bill has a computed `paidAmount` = SUM(payments WHERE status = COMPLETED)
- Bill status:
  - `paidAmount = 0` → UNPAID
  - `0 < paidAmount < grandTotal` → PARTIALLY_PAID
  - `paidAmount >= grandTotal` → PAID
- **If one payment succeeds and another fails:**
  - Bill stays PARTIALLY_PAID
  - Biller sees: "₹600/₹1000 paid. ₹400 remaining."
  - Biller can retry failed payment or switch to a different method for remaining amount
  - **No rollback of successful cash payment** — cash is already in drawer
  - Card/UPI failures: show "Payment failed. Try again or use different method."
- Table is NOT freed until bill is fully PAID

### Rules
- Minimum split: 2 ways, maximum: 10 ways (configurable)
- Each payment entry has its own status (independent)
- Receipt shows all payment methods: "Cash: ₹600, UPI: ₹400"
- Day-end cash report only counts COMPLETED cash payments
- Split by items: each split group shows its own subtotal + proportional tax

---

## 32. Order Submission Safety

### Menu Version Check at Order Submission (#1)

**Problem:** Owner updates Butter Chicken price from ₹350 → ₹400. Biller has old cached menu. Biller creates order with ₹350 (from cache). Menu syncs — prices don't match.

**Solution:** Menu version check at order submission.

**Rules:**
- Server maintains a `menuVersion` counter (incremented on any menu change: price, availability, item add/delete)
- Client sends `menuVersion` it has along with order creation request
- Server compares: if `client.menuVersion < server.menuVersion` → return `warning` flag (not rejection)
- Response includes list of changes: `[ { item: "Butter Chicken", field: "price", old: 350, new: 400 } ]`
- Client shows warning: "Menu was updated since you loaded it. Butter Chicken is now ₹400 (was ₹350). Continue with updated prices?"
- **Not a hard block** — biller can proceed (price snapshot uses whatever biller confirms)
- After warning acknowledged, order is created with CURRENT server prices (not stale cache)
- Menu auto-syncs in background after this warning

### Item Unavailability During Order (#2)

**Problem:** Captain is adding Paneer Tikka. Meanwhile, biller marks it unavailable. Captain submits → what happens?

**Decision: Soft warning, not hard reject.**

**Rules:**
- Backend checks item availability at order submission time
- If item is now unavailable → return `409 Conflict` with `unavailableItems` list
- Client shows: "Paneer Tikka was marked unavailable. [Remove Item] [Submit Anyway — last portion?]"
- "Submit Anyway" requires `order:override_availability` permission (Manager/Owner) or Manager PIN
- "Remove Item" removes it and continues with rest of order
- Socket.io `menu:item_toggled` event should immediately update item cards in real-time on all devices (grey out + "Unavailable" badge)
- But cart items are NOT auto-removed — biller/captain decides

### 5-Second Undo After Order Submission (#21)

**Problem:** Biller accidentally taps "Place Order." KOT prints in kitchen. Chef starts cooking food nobody ordered.

**Solution: 5-second undo window.**

**Flow:**
```
Biller taps "Place Order"
→ Order created in backend with status NEW
→ KOT added to print queue BUT delayed by 5 seconds
→ Toast shown: "Order sent to kitchen. [UNDO] (5s)"
→ Countdown: 5... 4... 3... 2... 1...
→ If UNDO tapped within 5 seconds:
    → Cancel order (status → CANCELLED, no Manager PIN needed within undo window)
    → Remove KOT from print queue before it prints
    → Toast: "Order cancelled"
→ If 5 seconds pass:
    → KOT prints normally
    → Toast disappears
    → Normal cancellation flow applies (Manager PIN required)
```

**Rules:**
- Undo window: 5 seconds (configurable in settings, 3–10 seconds range)
- Only applies to NEW orders (not item additions to existing orders)
- KOT print is DELAYED, not sent immediately — this is the key mechanism
- After undo window closes, the KOT prints and normal cancel rules apply
- Undo does NOT require Manager PIN (it's immediate correction, not cancellation)
- Audit log still records the create + cancel (for transparency)

### Draft Order Per Table (#22)

**Problem:** Biller is adding items for Table 3. Customer at Table 7 urgently asks for bill. Biller switches to Table 7 → generates bill → switches back to Table 3. Items they were adding are gone.

**Solution: In-memory draft state per table.**

**Rules:**
- Unsaved/uncommitted items (not yet submitted as an order) are stored as a **draft** in app memory per table
- When biller switches tables, draft is preserved (not cleared)
- Visual indicator on table map: "Table 3 has unsaved items" (yellow dot or item count badge)
- Drafts are NOT persisted to SQLite (they're transient — if app restarts, drafts are lost, which is acceptable)
- Drafts have a 30-minute auto-expiry (clear stale drafts)
- Only one draft per table at a time
- When biller returns to Table 3, draft items are restored in the cart

---

## 33. Fraud Prevention & Alerts

### Problem
Restaurant billing fraud is extremely common. The #1 fraud: Biller collects ₹500 cash → cancels/voids the order → pockets the money.

### Fraud Detection Rules

**1. Void/Cancel After Payment Alert**
- If a bill is voided or order cancelled AFTER a cash payment was recorded → auto-alert to Owner
- Alert: push notification + dashboard alert: "Bill #INV-2627-MN-00142 (₹500, Cash) was voided by Raju at 14:30. Reason: [reason]"
- Configurable threshold: alert if daily voids exceed count or amount (e.g., >3 voids or >₹1000 voided per biller per day)

**2. Cash vs Digital Ratio Monitoring**
- Track per biller: what % of their payments are cash vs digital
- If a biller has significantly higher cash ratio than peers → flag (may be under-reporting digital payments)
- Report: "Biller-wise Payment Method Distribution"

**3. Void/Cancel Daily Report (Prominent)**
- NOT buried in audit logs — separate card on Owner's Dashboard Home
- "Today's Voids & Cancellations: 3 orders (₹1,200)" — clickable to see details
- Shows: who voided, when, amount, reason, was payment collected before void?

**4. Discount Frequency Alert** (see also Section 27)
- Alert if biller applies discounts on >20% of orders in a day

### Configuration
```
fraud_alert_config (per restaurant)
  maxVoidsPerDay          INT         -- alert threshold per biller (default: 3)
  maxVoidAmountPerDay     DECIMAL     -- alert threshold in ₹ (default: 1000)
  maxDiscountFrequency    INT         -- % of orders with discounts (default: 20)
  alertChannel            TEXT        -- "PUSH", "SMS", "DASHBOARD", "ALL"
```

### Rules
- All alerts logged in audit trail
- Owner can configure thresholds in Settings → Security
- Alerts are informational (don't block operations) — owner investigates
- Daily end-of-day summary SMS/push to owner includes: voids, cancellations, discount total, cash-digital ratio

---

## 34. SQLite Resilience (Flutter Devices)

### Problem
Cheap Android tablets crash more than you'd think. App crash during SQLite write → database corruption → all local data lost (orders, sync queue, menu cache).

### Protection Rules

**1. WAL Mode (Write-Ahead Logging)**
- Enable SQLite WAL mode on database open: `PRAGMA journal_mode=WAL;`
- WAL mode makes writes crash-safe — if app crashes mid-write, database recovers on next open
- Significantly better concurrent read/write performance

**2. Integrity Check on App Startup**
- On every app start, run: `PRAGMA integrity_check;`
- If result is not "ok" → database is corrupted
- Recovery flow:
  ```
  Corruption detected
  → Attempt recovery from daily local backup (see #3)
  → If backup exists and is valid → restore from backup
  → If no backup or backup also corrupt → wipe SQLite, full re-sync from server
  → Toast: "Local data was recovered. Please wait while we sync."
  ```

**3. Local SQLite Backup**
- Every 30 minutes (when online), create a copy of SQLite DB to app's internal storage
- Keep only the latest 2 backups (save space on cheap tablets)
- Backup file: `restrosync_backup_{timestamp}.db`
- On corruption → restore from latest valid backup

**4. Unsynced Data Protection**
- Before any SQLite wipe/restore, check sync queue for PENDING items
- If there are unsynced orders/payments → attempt to push them to server FIRST
- If push fails (no internet) → save sync queue as JSON file separately → restore after DB rebuild
- Critical: **never lose financial data** (orders, bills, payments) — sync queue is the safety net

### Implementation
```dart
// On app startup
final db = await openDatabase('restrosync.db');
await db.execute('PRAGMA journal_mode=WAL');
final result = await db.rawQuery('PRAGMA integrity_check');
if (result.first.values.first != 'ok') {
  await recoverFromBackup(db);
}
```

---

## 35. Legal Compliance (DPDPA + FSSAI)

### DPDPA — Digital Personal Data Protection Act, 2023 (India)

RestroSync stores customer phone numbers, names, order history, and location data. DPDPA is now law in India. **Penalties up to ₹250 crore for non-compliance.**

**You (RestroSync) are the Data Processor. Restaurants are the Data Controllers.**

**Required implementations:**

**1. Consent at data capture**
- When biller enters customer phone number at billing → one-time consent prompt on POS:
  - "Save this number for order history and loyalty rewards? [Yes] [No — don't save]"
- If customer says No → order proceeds but phone number is NOT stored in `customers` table
- Consent flag stored per customer: `consentGiven BOOLEAN`, `consentDate TIMESTAMP`
- Consent can be given later (e.g., when customer asks to join loyalty program)

**2. Data deletion request (Right to Erasure)**
- Customer can request deletion of their data
- Flow: customer calls restaurant → owner goes to CRM → searches customer → "Delete Customer Data"
- Deletion removes: name, phone, email, order history linkage, loyalty points
- Orders are NOT deleted (financial records must be retained for GST compliance) but are **anonymized**: customer reference set to null, name replaced with "Deleted Customer"
- API endpoint: `DELETE /api/customers/:id/data` — soft-anonymizes, does not hard-delete
- Audit log records the deletion request (who requested, when, what was deleted)

**3. Privacy Policy**
- Accessible from: Flutter app Settings, React Dashboard footer, public website
- Must explain: what data is collected, why, how it's used, retention period, how to request deletion
- Template to be provided by RestroSync — restaurants can customize

**4. Data Processing Agreement (DPA)**
- RestroSync provides a DPA template that restaurant owners agree to during signup
- States: RestroSync processes data on behalf of the restaurant, does not sell data, follows DPDPA
- Checkbox during registration: "I agree to the Data Processing Agreement"

**5. Tenant data isolation**
- Customer data is already scoped by `restaurantId` (tenant isolation)
- **Explicit rule:** customer data from Restaurant A MUST NEVER be visible to Restaurant B, even if same phone number
- No cross-restaurant customer merging or sharing

### FSSAI Display Requirements

FSSAI mandates that every bill/receipt from a food establishment must display the FSSAI license number.

**Rules:**
- `fssaiNumber` field in `restaurants` table — prompted during onboarding
- Onboarding prompt: "Enter your FSSAI License Number (required by law on every bill)"
- **NOT an optional toggle** — if FSSAI number is entered, it MUST appear on every receipt
- If FSSAI number is empty → show warning on dashboard: "FSSAI number is required by law. Please add it in Settings."
- Receipt prints FSSAI number at the bottom: `FSSAI: XXXXXXXXXXXXXXXXX`
- receipt_settings.showFssai should default to `true` and warn if toggled off: "FSSAI display is legally required"

---

## 36. Production Monitoring & Alerting

### Problem
When 200 restaurants use RestroSync and something breaks at 8 PM Saturday dinner rush, you need to know BEFORE restaurant owners call you.

### Monitoring Stack

| Layer | Tool | What it monitors |
|-------|------|-----------------|
| **Application errors** | Sentry (free tier) | Crashes in NestJS, React, AND Flutter. Stack traces, user context, breadcrumbs |
| **Server uptime** | BetterStack / UptimeRobot (free) | API endpoint health check every 1 min. Alert if down for 2 min. |
| **API performance** | Custom middleware + logging | P95 latency per endpoint. Alert if billing endpoint >2s. |
| **Database** | PostgreSQL slow query log | Queries taking >500ms. Connection pool usage (alert at 80%). |
| **Redis** | Redis INFO monitoring | Memory usage (alert at 80% maxmemory). Connection count. |
| **Business metrics** | Custom dashboard (Super Admin) | Orders/minute, active devices, sync failure rate, error rate |
| **Alerts** | Telegram/Slack bot | Critical: server down, DB connection errors, sync failure spike |

### Health check endpoints
```
GET /health              → { status: "ok", uptime, version }
GET /health/db           → { status: "ok", connectionPool: { used, available } }
GET /health/redis        → { status: "ok", memoryUsage, connectedClients }
GET /health/socket       → { status: "ok", connectedSockets, rooms }
```

### Alert severity levels
| Level | Examples | Channel | Response time |
|-------|---------|---------|--------------|
| **P1 Critical** | API down, DB unreachable, payment endpoint failing | Telegram + SMS + phone call | <15 min |
| **P2 High** | Redis down, sync failure rate >10%, Socket.io disconnected | Telegram + email | <1 hour |
| **P3 Medium** | Slow queries >2s, error rate >1%, disk space >80% | Email + dashboard | <4 hours |
| **P4 Low** | Deprecation warnings, non-critical feature errors | Dashboard only | Next business day |

### Sentry integration
- **NestJS:** `@sentry/node` — catches all unhandled exceptions, attaches restaurantId + branchId from JWT context
- **React:** `@sentry/react` — catches component errors, routing errors, API failures
- **Flutter:** `sentry_flutter` — catches crashes, unhandled exceptions, attaches deviceId + userId
- **Source maps/debug symbols:** uploaded to Sentry during CI/CD build for readable stack traces
- **Release tracking:** tag each Sentry event with app version + git commit hash

### Super Admin monitoring dashboard
- Real-time: active restaurants, active devices, orders/minute, API latency
- Sync health: sync failure rate across all restaurants, top failing restaurants
- Error rate: errors/minute trend chart
- Alerts log: recent triggered alerts with status

---

## 37. App Distribution & Force Update

### Problem
POS apps can't easily go on Google Play Store (Google has restrictions on financial apps). Need a distribution and update strategy.

### Distribution Strategy

| Stage | Method | How it works |
|-------|--------|-------------|
| **Early stage (0-50 restaurants)** | Firebase App Distribution | Upload APK → send install link to restaurant devices. Simple, fast. |
| **Growth stage (50-200)** | Direct APK from website | Restaurant downloads from `https://app.restrosync.com/download`. Requires "Allow unknown sources" on device. |
| **Scale stage (200+)** | Google Play private track | Restricted to enrolled devices/emails. More polished, auto-updates. |
| **Enterprise** | MDM (if providing tablets) | Pre-install on company-provided tablets. Full device control. |

### Force Update Mechanism (Critical)

**Problem:** You push a critical bug fix. Old app versions must update before continuing. You can't have a restaurant running a version with a billing bug.

**Implementation:**
```
// Server config (database or env)
minAppVersion: "1.2.0"    // minimum allowed version
latestAppVersion: "1.3.1" // latest available version
updateUrl: "https://app.restrosync.com/download"
```

**Flow on app launch:**
```
App starts → calls GET /api/config/app-version
→ Server returns: { minVersion: "1.2.0", latestVersion: "1.3.1", updateUrl: "..." }
→ App compares its version:
  → If app version < minVersion:
      FORCE UPDATE — block entire app
      Show: "A critical update is required. Please update to continue."
      Button: "Download Update" → opens updateUrl
      NO way to bypass — app is unusable until updated
  → If app version < latestVersion but >= minVersion:
      SOFT PROMPT — show banner "Update available. [Update Now] [Later]"
      App continues to work normally
  → If app version >= latestVersion:
      No action
```

**Rules:**
- `minAppVersion` is only bumped for critical/breaking changes (not every release)
- Version check happens on every app launch (before login screen)
- Version check is lightweight — single GET request, no auth required
- Offline: if version check fails (no internet), allow app to continue (can't block offline billing)
- After update: app restarts, SQLite data preserved, sync continues

### API Versioning

**Problem:** When backend API changes, old Flutter apps on restaurant tablets might break.

**Solution: URL-based API versioning.**
```
/api/v1/orders    — current version
/api/v2/orders    — next version (when breaking changes happen)
```

**Rules:**
- All API endpoints are prefixed with version: `/api/v1/`
- When introducing breaking changes, create `/api/v2/` — keep `/api/v1/` working for transition period
- Support at least 2 versions simultaneously (v1 + v2) for 3 months
- Deprecation: add `X-API-Deprecated: true` header to old version responses
- Flutter app sends version in header: `X-App-Version: 1.2.0` — server can log and track which versions are in use
- Combined with force update: bump `minAppVersion` when you're ready to sunset old API version
- This gives a safe, controlled upgrade path

---

## 38. Onboarding Experience

### Problem
A restaurant owner signs up. They have 200 menu items, 15 tables, 5 staff. If setup takes more than 30 minutes, they'll give up.

### Menu Templates (per cuisine type)

Pre-built menu templates massively speed up onboarding. Owner selects a template → gets a pre-populated menu → customizes prices and removes items they don't serve.

**Templates to provide:**
| Template | Categories | Example items |
|----------|-----------|---------------|
| South Indian | Dosa, Idli/Vada, Rice, Beverages | Masala Dosa, Idli, Vada, Sambar Rice, Filter Coffee |
| North Indian | Starters, Tandoor, Curries, Breads, Rice, Desserts | Paneer Tikka, Dal Makhani, Butter Naan, Biryani, Gulab Jamun |
| Chinese/Indo-Chinese | Soups, Starters, Noodles, Rice, Manchurian | Manchow Soup, Spring Roll, Hakka Noodles, Fried Rice |
| Cafe/Bakery | Coffee, Tea, Shakes, Snacks, Desserts | Cappuccino, Cold Coffee, Veg Sandwich, Brownie |
| Fast Food / QSR | Burgers, Wraps, Fries, Beverages | Veg Burger, Chicken Wrap, French Fries, Coke |
| Multi-cuisine | All of the above combined | Best of each category |
| Blank | Empty | Start from scratch |

**Rules:**
- Templates stored in a `menu_templates` table (seeded during deployment)
- During onboarding after mode selection: "Pick a menu template to get started (you can customize everything later)"
- Template import creates categories + items with placeholder prices (₹0 — owner must set real prices)
- Owner customizes: change prices, rename items, delete items they don't serve, add their specialties
- Template is a one-time import — no ongoing link to template

### Demo Mode

- After signup, before entering real data, owner can tap "Explore with Demo Data"
- Creates a temporary demo dataset: 30 menu items, 8 tables, 5 sample orders, fake reports
- Owner can tap through every screen to understand the system
- Banner at top: "DEMO MODE — data is not real. [Exit Demo & Start Setup]"
- On exit: all demo data is wiped, real setup begins
- Demo mode is optional — owner can skip straight to setup

### Setup Checklist (Dashboard)

After onboarding, dashboard shows a setup progress card until all steps are done:

```
┌─────────────────────────────────┐
│  Setup Your Restaurant          │
│  ━━━━━━━━━━━━━━━━━━━━━ 3/6     │
│  ✅ Operating mode selected     │
│  ✅ Menu items added (24 items) │
│  ✅ Tax settings configured     │
│  ❌ Tables configured           │
│  ❌ Staff added                 │
│  ❌ Printer set up              │
│  [Continue Setup →]             │
└─────────────────────────────────┘
```

**Rules:**
- Checklist items tracked per restaurant in `onboarding_progress` table
- Checklist is dismissible after Phase 1 completion (menu + tables + at least 1 staff)
- Each incomplete item links directly to the relevant settings page
- Printer setup step links to Flutter app instructions (since printers are configured on the device, not web)
- After all items complete → checklist auto-hides, replaced by normal dashboard

---

## 39. Cash Drawer Control (ESC/POS)

**Problem:** Cash drawers in restaurants are connected to the receipt printer via an RJ11 cable. The POS must send a specific ESC/POS command to "kick" the drawer open. Drawer must NOT open on digital payments (prevents theft).

**ESC/POS command:** `ESC p 0 25 250` (standard across most cash drawer models)

**Rules:**
- Cash drawer opens ONLY on:
  - Cash payment (after bill is printed)
  - Day-end close (to count cash)
  - Manual "Open Drawer" button (requires `drawer:manual_open` permission — Manager/Owner only)
- Cash drawer does NOT open on:
  - UPI / Card / Bank Transfer payments
  - Split payments where cash portion is ₹0
- For split payments with cash component: drawer opens once after all payment methods recorded
- Drawer command sent via the same printer connection (Bluetooth/USB/LAN) as receipt
- If cash drawer is not connected or command fails → silent fail (don't block billing)
- Settings: "Cash Drawer Connected" toggle per printer in Printer Setup

**Flutter implementation:**
- Add `openCashDrawer()` method in ESC/POS printer service
- Sends `[27, 112, 0, 25, 250]` bytes after bill print completes
- Called from payment screen after cash payment confirmation

---

## 40. Device Clock Drift Protection

**Problem:** Cheap Android tablets lose time sync when battery drains completely or is replaced. If tablet clock shows 2024 instead of 2026:
- JWT tokens fail validation (issued "in the future")
- Order timestamps are wrong → breaks daily reports
- Business day calculation fails → orders assigned to wrong day
- Sync conflicts with server (server rejects future timestamps)

**Solution: Server-time offset calculation on app start.**

**Flow:**
```
App starts → calls GET /api/time → server returns { serverTime: "2026-02-12T14:30:00Z" }
→ App calculates delta: serverTime - deviceTime = offset (e.g., +730 days)
→ Store offset in memory (recalculate on every app start / every server response)
→ ALL local timestamps use: DateTime.now() + offset
```

**Rules:**
- On app start (online): fetch server time, calculate offset, store in memory
- On app start (offline): use last known offset from SQLite (`device_config.clockOffset`)
- All SQLite writes use adjusted time: `DateTime.now().add(Duration(milliseconds: offset))`
- If offset > 5 minutes: show warning banner to biller: "Device clock is off by X hours. Please check Settings → Date & Time."
- JWT token validation uses server time (not device time) for expiry checks
- Every API response includes `Date` header → recalibrate offset silently
- Sync engine uses adjusted timestamps → server never receives stale dates

**device_config table (SQLite):**
```
device_config
  key             TEXT PRIMARY KEY
  value           TEXT
  updatedAt       TEXT
-- Entries: clockOffset, lastSyncTime, deviceId, assignedBranch, etc.
```

---

## 41. Customer Khata / Credit (Settle Later)

**Problem:** Many Indian restaurants (dhabas, cafes, corporate canteens, fine dining) have regular customers, owner's friends, or corporate accounts that don't pay immediately. They run a "khata" (tab/credit account) and settle weekly/monthly.

**Decision: Support "CREDIT" as a payment method tied to CRM.**

**Tables:**
```
customer_credit_accounts (per restaurant)
  id              UUID
  restaurantId    UUID
  customerId      UUID        -- FK to customers table
  creditLimit     DECIMAL     -- max allowed outstanding (set by owner, default: ₹5000)
  currentBalance  DECIMAL     -- outstanding amount (positive = customer owes)
  isActive        BOOLEAN
  createdBy       UUID        -- who approved this credit account
  createdAt       TIMESTAMP

credit_transactions (per restaurant)
  id              UUID
  creditAccountId UUID
  type            TEXT        -- "CHARGE" (added to tab) | "PAYMENT" (settled)
  orderId         UUID NULL   -- linked order (for CHARGE type)
  amount          DECIMAL
  paymentMethod   TEXT NULL   -- how they settled (Cash/UPI/Card) — only for PAYMENT type
  notes           TEXT        -- "Monthly settlement", "Owner's guest"
  createdBy       UUID
  createdAt       TIMESTAMP
```

**Rules:**
- "Credit / Settle Later" appears as a payment method on POS payment screen
- Only available for customers with an active credit account (not for walk-ins)
- Biller selects customer → if credit account exists → "Credit" payment option shown
- If `currentBalance + newBill > creditLimit` → warning: "Credit limit exceeded (₹5000). Proceed anyway?" — requires Manager PIN
- Credit payment creates a `CHARGE` transaction → increases `currentBalance`
- Settlement: Owner/Manager goes to CRM → Customer Profile → "Settle Credit" → enter amount → select payment method → creates `PAYMENT` transaction → decreases `currentBalance`
- Partial settlement allowed (₹2000 of ₹5000 outstanding)
- Credit accounts need `crm:manage_credit` permission (Owner + Manager)
- Day-end report shows: "Outstanding Credit: ₹X across Y customers"
- Monthly credit aging report: customers with balances >30 days highlighted

**UI (Flutter POS — Payment screen):**
- If customer is linked and has credit account → show "Credit / Settle Later" button
- Tap → confirmation: "Add ₹XXX to [Customer Name]'s credit? Outstanding will be ₹YYYY."
- Manager PIN if over limit

**UI (React Dashboard — CRM):**
- Customer profile shows credit tab: current balance, transaction history, settle button
- Credit accounts page: all active credit accounts, balances, last payment date
- "Create Credit Account" form: select customer, set limit
- Settlement form: enter amount, payment method, notes

---

## 42. Split Payment Refund Flow

**Problem:** Customer paid ₹1000 split as ₹500 Cash + ₹500 UPI. Now wants ₹200 partial refund. Which payment method should the refund go to?

**Decision: Refund targets a specific payment method. Staff selects.**

**Rules:**
- When refunding a split-payment bill, refund screen shows all payment methods used
- Staff selects which payment method to refund against
- Refund amount per method cannot exceed original amount for that method
  - Example: ₹500 paid by Cash → max refund against Cash = ₹500
- Default suggestion: refund via the same method as last payment (convenience)
- If refund amount > any single method: must split the refund across methods
  - Example: ₹800 refund on ₹500 Cash + ₹500 UPI → staff can do ₹500 Cash refund + ₹300 UPI refund
- Each refund entry records: `{ paymentId, method, amount }`
- Refund receipt shows: "Refund: ₹500 (Cash), ₹300 (UPI reversal)"
- Day-end reconciliation: cash refunds reduce expected cash, UPI refunds are separate

**Refund UI additions (Flutter POS):**
```
Refund flow for split-payment bills:
→ Select items to refund (or full refund)
→ Shows: "This bill was paid via: Cash ₹500, UPI ₹500"
→ "How to refund ₹200?"
→ Options:
   [Cash: ₹200] [UPI: ₹200] [Split Refund]
→ If Split Refund → enter amount per method (must total refund amount)
→ Manager PIN → process → print refund receipt
```

---

## 43. Platform-Specific Pricing (Order Type Pricing)

**Problem:** Restaurants charge different prices based on order type:
- Dine-in: ₹200 (base price)
- Takeaway: ₹210 (packing cost baked in)
- Delivery: ₹230 (aggregator commission baked in)
- Zomato/Swiggy: ₹250 (higher commission)

**Decision: Support optional price overrides per order type.**

**Table:**
```
item_price_overrides (per restaurant)
  id              UUID
  menuItemId      UUID
  variantId       UUID NULL   -- if null, applies to base item
  orderType       TEXT        -- "DINE_IN", "TAKEAWAY", "DELIVERY"
  price           DECIMAL     -- override price for this order type
  isActive        BOOLEAN
```

**Rules:**
- Price overrides are OPTIONAL. If no override exists for an order type → use base `menu_items.price`
- Override lookup order: `item_price_overrides WHERE menuItemId AND orderType` → if found, use it; else use base price
- Order item snapshot stores the resolved price (whichever was applicable at order time)
- Admin Dashboard: Menu item edit form → "Advanced Pricing" section → toggle per order type, enter override price
- CSV import supports optional columns: `takeaway_price`, `delivery_price`
- This does NOT affect Zomato/Swiggy integration (Phase 10) — those platforms have their own pricing set on their portals. This is for in-house orders only.
- Reports: item-wise sales report can filter by order type to show revenue at different price points
- **Scope:** This is a Phase 2 enhancement (menu module). Simple restaurants can ignore it completely.

---

## 44. Android Background Sync & WorkManager

**Problem:** Android aggressively kills background processes. If internet drops, 50 orders queue in sync engine, and biller minimizes app or turns off screen → Android kills the app → sync engine dies → orders never push to server.

**Solution: Use Android WorkManager for critical sync operations.**

**Rules:**
- Sync engine has TWO modes:
  1. **Foreground sync** (normal): runs while app is open, processes queue immediately
  2. **Background sync** (WorkManager): scheduled periodic sync when app is in background
- WorkManager setup (via `workmanager` Flutter plugin):
  - Periodic task: every 15 minutes, check SQLite sync_queue for PENDING items
  - Constraint: requires network connectivity
  - Retry policy: exponential backoff on failure
- **Critical:** Payment data sync uses a **foreground service with notification** (not just WorkManager):
  - Shows persistent notification: "Syncing 5 pending orders..."
  - Keeps process alive until financial data is synced
  - Notification dismissed when queue is empty
- App lifecycle handling:
  - `onPause` → if sync_queue has PENDING items → schedule WorkManager task
  - `onResume` → cancel WorkManager task, switch to foreground sync
- Battery optimization: prompt user on first launch to disable battery optimization for RestroSync (required for reliable background execution on Chinese OEM devices like Xiaomi, Oppo, Vivo)

**Flutter implementation:**
- `workmanager` package for periodic background tasks
- `flutter_foreground_task` package for persistent sync with notification
- `disable_battery_optimization` package to request whitelist

---

## 45. Dynamic UPI QR on Receipts

**Problem:** In India, it's now common to print a dynamic UPI QR code on the physical receipt. Customer scans the QR at their table and pays the exact amount. No need for separate QR display.

**UPI Deep Link format:**
```
upi://pay?pa={merchant_upi_id}&pn={restaurant_name}&am={exact_amount}&cu=INR&tn=Order-{order_number}
```

**Rules:**
- Restaurant owner enters their UPI ID in Settings → Payment Settings (e.g., `restaurant@upi`)
- When bill is printed, QR code generated from UPI deep link with exact bill amount
- QR encodes: merchant UPI ID + amount + order reference
- ESC/POS printers that support QR (most 80mm printers do): print QR directly on receipt
- 58mm printers: QR may be too small to scan — disable on 58mm, show only on 80mm
- QR printed after the bill total line, before footer
- After payment, biller marks as "Paid via UPI" (manual confirmation — auto-verification is Phase 10 integration)
- If UPI ID not configured → QR not printed (graceful skip)

**Settings (Admin Dashboard):**
- Payment Settings → "UPI Merchant ID" text field
- Toggle: "Print UPI QR on receipts" (default: off until UPI ID is entered)
- Preview of QR on receipt preview page

**Flutter implementation:**
- `qr_flutter` package to generate QR bitmap
- Convert to ESC/POS raster image for thermal printing
- Only generate if `receipt_settings.showUpiQr == true && restaurant.upiMerchantId != null`

---

## 46. Staff Attendance (Clock-in / Clock-out)

**Problem:** Restaurant owners always ask: "What time did the biller arrive? How long did the waiter work today?" Staff PINs are already used for POS login — extend this to track attendance.

**Table:**
```
staff_attendance (per branch)
  id              UUID
  branchId        UUID
  userId          UUID
  clockIn         TIMESTAMP
  clockOut        TIMESTAMP NULL   -- null if shift still active
  totalHours      DECIMAL NULL     -- calculated on clock-out
  autoClockOut    BOOLEAN DEFAULT false  -- true if system auto-closed
  createdAt       TIMESTAMP
```

**Rules:**
- When staff logs in to POS via PIN → auto clock-in (if not already clocked in today)
- "Clock Out" button in app menu / profile section
- If staff forgets to clock out → auto clock-out at day-end close
- `autoClockOut = true` flags these for manager review
- Owner/Manager can view attendance in Admin Dashboard → Staff → Attendance tab
- Simple report: date, clock-in time, clock-out time, total hours, late flag
- Late flag: configurable "expected start time" per role (e.g., biller expected by 10 AM)
- No complex shift scheduling — just clock-in/out tracking
- Data retained for 90 days (configurable)

**UI (Admin Dashboard):**
- Staff page → "Attendance" tab
- Date range picker → table of attendance records
- Filter by staff member, role
- Summary: total hours this week/month per staff
- Export to CSV

**UI (Flutter POS):**
- After PIN login → toast: "Clocked in at 10:02 AM"
- App menu → "Clock Out" option
- On clock out → "Shift: 10:02 AM – 6:15 PM (8h 13m)"

---

## 47. Barcode Scanner Support (Flutter POS)

**Problem:** Bakeries, QSRs, and restaurants selling packaged items (bottled water, chips, sodas) use barcode scanners. Biller scans barcode → item auto-adds to cart.

**How barcode scanners work with tablets:**
- USB/Bluetooth barcode scanners act as a keyboard (HID device)
- They "type" the barcode number followed by Enter key
- Flutter needs to capture this keyboard input and match it to a menu item

**Implementation:**
- Add `barcode` field to `menu_items` table (TEXT, nullable, unique per restaurant)
- Flutter POS screen has a hidden `RawKeyboardListener` / `KeyboardListener` always active
- When rapid key input detected (barcode scanners type full number in <100ms) → treat as barcode scan
- Look up `menu_items WHERE barcode = scannedValue AND restaurantId = X`
- If found → add item to cart (quantity +1 if already in cart)
- If not found → toast: "Item not found for barcode: {value}"
- Admin Dashboard: Menu item edit form → "Barcode" text field (manual entry or scan from browser if webcam barcode scanning is added later)
- CSV import supports `barcode` column

**Rules:**
- Barcode is optional — most items won't have one
- Same barcode cannot be assigned to two different items (unique constraint)
- Works for EAN-13, UPC-A, Code 128 (most common)
- Scanning adds item at its current price (standard price snapshot applies)
- This is a Phase 3 enhancement (POS billing). No separate phase needed.

---

## 48. Inventory — Sub-Recipes, Yield, Batch Expiry (Phase 6 Notes)

**These are Phase 6 complexity notes. Not needed for initial launch but must be planned for.**

### Sub-Recipes (Batch Prep)

**Problem:** Tomatoes + onions + spices → "Makhani Gravy" (sub-recipe). Makhani Gravy → "Paneer Butter Masala" (final item). Recipe must support nesting.

**Schema approach:**
```
recipes
  id              UUID
  menuItemId      UUID NULL   -- NULL for sub-recipes, set for final menu items
  name            TEXT        -- "Makhani Gravy" or "Paneer Butter Masala"
  isSubRecipe     BOOLEAN     -- true for intermediate preparations
  yieldQuantity   DECIMAL     -- how much this recipe produces (e.g., 5 litres of gravy)
  yieldUnit       TEXT        -- "LITRE", "KG", "PIECE"

recipe_ingredients
  id              UUID
  recipeId        UUID
  ingredientId    UUID NULL   -- FK to ingredients (for raw materials)
  subRecipeId     UUID NULL   -- FK to recipes (for sub-recipes) — one of these must be set
  quantity        DECIMAL     -- how much is needed
  unit            TEXT
```

- Sub-recipes can reference other sub-recipes (max 3 levels deep — prevent circular refs)
- Stock deduction cascades: ordering PBM → deducts Makhani Gravy → deducts tomatoes, onions, spices

### Yield Variance

**Problem:** 1 kg raw chicken ≠ 1 kg usable meat after cleaning/trimming.

- Add `yieldPercent DECIMAL DEFAULT 100` to ingredients table
- Example: Chicken `yieldPercent = 65` → 1 kg purchased = 0.65 kg usable
- Stock reports use yield-adjusted quantities for cost calculations
- Without yield tracking, reports show artificial ingredient shortages

### Batch Expiry (FIFO)

**Problem:** Bakeries and cloud kitchens must track expiry dates for FSSAI compliance.

```
stock_batches
  id              UUID
  ingredientId    UUID
  branchId        UUID
  batchNumber     TEXT
  purchaseDate    DATE
  expiryDate      DATE NULL
  quantityIn      DECIMAL     -- amount received
  quantityUsed    DECIMAL     -- amount consumed
  quantityRemaining DECIMAL   -- computed
  supplierId      UUID NULL
  costPerUnit     DECIMAL
```

- Auto-deduction uses FIFO: oldest batch (nearest expiry) consumed first
- Alert: "Paneer Batch #12 expires in 2 days (3 kg remaining)"
- Expired batches auto-flagged, require manual write-off or disposal log
- Reports: waste from expired items, FIFO compliance

---

## 49. Cross-Branch Loyalty Scope

**Problem:** If a restaurant has 2 branches (Koramangala and Indiranagar), can a customer earn loyalty points at Branch A and redeem at Branch B?

**Decision: Loyalty is restaurant-scoped, NOT branch-scoped.**

**Rules:**
- Loyalty points are earned and redeemed across ALL branches of the same restaurant
- `loyalty_points` table uses `restaurantId` (not `branchId`) for scope
- Customer's point balance is restaurant-wide
- Earning: configurable points per ₹100 spent (restaurant-level setting)
- Redemption: configurable conversion rate (e.g., 100 points = ₹10 off) — same across all branches
- Reports show loyalty activity per branch (where earned, where redeemed)
- **No cross-restaurant sharing** — points from Restaurant A cannot be used at Restaurant B (different tenant)
- Owner can disable loyalty per branch if needed (e.g., new branch in trial period)

---

*This document captures decisions that prevent production bugs. Reference during every phase.*
