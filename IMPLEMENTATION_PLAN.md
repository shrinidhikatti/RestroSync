# RestroSync - Petpooja-Like Restaurant Management System
## Complete Implementation Plan (Phase-wise)

---

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Biller/POS App | **Flutter (Dart)** — Android tablet/phone, offline + thermal printer |
| Captain/Waiter App | **Flutter (Dart)** — Android phone, order taking |
| Admin Dashboard | React.js + TypeScript + Tailwind CSS + Vite (Web) |
| Kitchen Display (KDS) | React.js + Socket.io (Web — runs on TV/tablet browser) |
| Backend API | NestJS (Node.js + TypeScript) |
| Database | PostgreSQL (primary) + Redis (cache/realtime) |
| Local/Offline DB | **SQLite (sqflite)** on Flutter devices |
| Real-time | Socket.io (via NestJS Gateway) |
| ORM | Prisma |
| Auth | JWT (access + refresh tokens) |
| API Docs | Swagger (auto-generated) |
| Thermal Printing | **ESC/POS via Flutter plugins** (Bluetooth / USB / LAN) |
| Deployment | Docker + Nginx |

### Why Flutter for POS & Captain?
- **Thermal printer ecosystem** — `esc_pos_printer`, `esc_pos_utils` plugins work with 95% of restaurant printers (Epson, TVS, Bixolon, generic 58mm/80mm)
- **Offline-first** — SQLite (sqflite/Hive) stores orders locally, syncs when online
- **Cheap tablet support** — Consistent performance on budget Android tablets used in restaurants
- **Single codebase** — Same code runs on Android phone (Captain) and Android tablet (Biller)
- **Touch-optimized** — Native feel with large tap targets, smooth scrolling

---

## Database Schema Overview

### Core Tables
```
restaurants        - Multi-tenant: each restaurant is a tenant
branches           - Multiple outlets per restaurant
users              - Staff (owner, manager, biller, captain, kitchen)
roles              - Role definitions + permissions
```

### Menu & Items
```
categories         - Food categories (Starters, Main Course, Beverages...)
menu_items         - Individual dishes with price, tax, variants
item_variants      - Size/type variants (Half/Full, Small/Medium/Large)
item_addons        - Extra toppings, sides
combo_items        - Combo meal definitions
combo_item_entries - Items inside a combo
```

### Orders & Billing
```
tables             - Restaurant tables with floor/section mapping
orders             - Master order (table, type, status, timestamps)
order_items        - Individual items in an order (qty, price, addons)
kot                - Kitchen Order Tickets (linked to order_items)
bills              - Final bill (subtotal, tax, discount, total, payment)
payments           - Payment records (cash, card, UPI, split payments)
refunds            - Full/partial refund records (amount, reason, method, approval)
refund_items       - Item-level refund details (which items, qty, amount)
```

### Discounts, Reservations & Fraud
```
discounts          - Discount definitions (flat, %, coupon, happy hour, item/bill level)
order_discounts    - Discount instances applied to specific orders
discount_config    - Discount abuse thresholds (max % without PIN, alert threshold)
reservations       - Table reservations (name, phone, date, time, status)
day_close_locks    - Prevents concurrent day-end close (branchId, status, initiatedBy)
void_cash_returns  - Cash return entries when bill voided after cash collected
fraud_alert_config - Fraud detection thresholds (max voids, alert channels)
```

### Inventory
```
ingredients        - Raw materials (tomato, cheese, oil...) + yieldPercent
recipes            - Recipe mapping (menu_item -> ingredients with qty, supports sub-recipes)
recipe_ingredients - Ingredients or sub-recipes used in a recipe
stock              - Current stock levels per branch
stock_batches      - Batch tracking with expiry dates (FIFO for FSSAI)
stock_transactions - Stock in/out log (purchase, consumption, wastage)
suppliers          - Supplier directory
purchase_orders    - PO management
```

### CRM & Analytics
```
customers          - Customer database (phone, name, orders count)
customer_credit_accounts - Khata/credit accounts (credit limit, balance)
credit_transactions - Credit charges & settlements ledger
loyalty_points     - Points earned/redeemed (restaurant-scoped, cross-branch)
staff_attendance   - Clock-in/clock-out records per staff per day
daily_reports      - Pre-computed daily sales summaries
audit_logs         - All actions logged for accountability (APPEND-ONLY)
```

### Security, Permissions & Config
```
permissions        - Granular permissions (e.g., "order:create", "discount:apply")
role_permissions   - Maps role → permissions
devices            - Registered POS devices (tablet/phone)
tax_groups         - Tax group definitions ("GST 5%", "GST 18%", "VAT")
tax_components     - Tax lines within a group (CGST, SGST, IGST, VAT, CESS)
charge_configs     - Additional charges (service charge, packing, delivery fee)
receipt_settings   - Per-branch receipt customization (header, footer, logo, format, UPI QR toggle)
item_price_overrides - Order-type-specific pricing (dine-in/takeaway/delivery overrides)
device_config      - Per-device config (clock offset, device ID, assigned branch)
number_ranges      - Pre-allocated bill/KOT number ranges per device (offline support)
plans              - SaaS plan definitions (FREE, BASIC, PRO, ENTERPRISE)
```

### Legal & Onboarding
```
menu_templates     - Pre-built menu templates per cuisine (South Indian, North Indian, etc.)
onboarding_progress - Setup checklist tracking per restaurant
```

### Offline Sync (SQLite on device, not in PostgreSQL)
```
sync_queue         - Pending sync items with idempotency keys + retry logic
print_queue        - Pending print jobs with retry + reprint support
```

---

## PHASE 1: Project Setup & Foundation
**Goal:** Get the project structure, database, auth, and basic backend running.

### Tasks:
1.1. **Initialize monorepo structure**
     - `/backend` - NestJS app
     - `/frontend` - React app (Vite + TypeScript + Tailwind) — Admin Dashboard + KDS
     - `/mobile` - Flutter app (Riverpod + Clean Architecture) — Biller POS + Captain
     - `/shared` - Shared types/interfaces
     - `docker-compose.yml` - PostgreSQL + Redis containers

1.2. **Backend: NestJS project setup**
     - Initialize NestJS with TypeScript
     - Configure Prisma ORM + PostgreSQL connection
     - Setup environment config (.env handling)
     - Setup CORS, helmet, rate limiting
     - Setup Swagger for auto API docs
     - Setup Socket.io gateway (rooms by branch + kitchen station)
     - Idempotency middleware (X-Idempotency-Key header → Redis check, key format: `{deviceId}:{uuid}`)
     - **Redis graceful degradation:** try-catch all Redis calls, fallback to PostgreSQL/skip on failure (see Section 13)
     - Centralized error response format: `{ errorCode, userMessage, details }` for all API errors

1.3. **Database: Create Prisma schema**
     - All tables with `restaurantId` + `branchId` scoping
     - Restaurant table: `operatingMode`, `timezone`, `planId`, `planExpiresAt`
     - Orders table: `version` field for optimistic locking, `tokenNumber` for COUNTER mode
     - Payments table: supports **multiple entries per bill** (split payment), individual status per payment
     - Permissions + role_permissions tables
     - Tax groups + tax components tables
     - Charge configs table (service charge, packing, delivery fee)
     - **Discount configs table** (flat, %, coupon, happy hour, item/bill level — see Section 27)
     - **Discount abuse config** (max discount without PIN, alert threshold)
     - **Fraud alert config** (max voids per day, alert channels — see Section 33)
     - Receipt settings table (per branch customization)
     - Devices table (POS device registration)
     - Number ranges table (pre-allocated bill/KOT numbers per device)
     - **Day-close locks table** (prevents concurrent day-end close — see Section 14)
     - Plans table (SaaS plan definitions + limits)
     - Seed script with sample data (demo restaurant, menu, tables, permissions, default plan)
     - Migration setup

1.4. **Auth module**
     - **Super Admin login** (separate route: `/super-admin/login`, email + password)
     - Restaurant owner signup (public) OR created by Super Admin
     - Login with JWT (access token 15min + refresh token 7days)
     - Refresh token rotation (old token invalidated on use)
     - 4-digit PIN login for POS (registered devices only)
     - Role-based guards (**SUPER_ADMIN**, Owner, Manager, Biller, Captain, Kitchen)
     - SuperAdminGuard — protects `/api/super-admin/*` endpoints
     - Permission-based guards (granular: "order:create", "discount:apply", etc.)
     - Password hashing (bcrypt)
     - Rate limiting: 5 login attempts per 15 min per IP
     - Device registration + binding for POS tablets
     - CLI seed command to create first Super Admin account

1.5. **Restaurant & Branch module**
     - CRUD for restaurant profile
     - CRUD for branches (multi-outlet)
     - Tenant isolation middleware (all queries scoped by restaurantId from JWT)
     - Branch context middleware (queries scoped by branchId from JWT)
     - Operating mode API (get/set: COUNTER, TABLE_SIMPLE, FULL_SERVICE)

1.6. **Super Admin module (backend)**
     - CRUD restaurants (create + owner account, suspend, activate, soft-delete)
     - Platform-wide stats API (total restaurants, total orders, revenue)
     - Per-restaurant stats API (view-only)
     - Restaurant status management (ACTIVE / SUSPENDED / DELETED)
     - Suspended restaurant → all logins blocked

1.7. **Onboarding flow (backend)**
     - Two paths: Super Admin creates restaurant OR owner self-registers
     - After owner first login → forced password change (if created by Super Admin)
     - Then: "How does your restaurant work?" → 3 choices → saves `operatingMode`
     - **Menu template selection:** "Pick a starting template" → South Indian / North Indian / Cafe / Chinese / Multi-cuisine / Blank
     - Template import creates categories + items with ₹0 placeholder prices → owner customizes
     - **FSSAI prompt:** "Enter your FSSAI License Number (required by law on every bill)"
     - **DPDPA consent checkbox** during signup: "I agree to the Data Processing Agreement"
     - Can be changed anytime via Settings

1.8. **Legal compliance (backend)**
     - **DPDPA:** customer consent flag (`consentGiven`, `consentDate`) on customer creation
     - Customer data deletion API: `DELETE /api/customers/:id/data` → anonymizes, does not hard-delete
     - Privacy Policy page accessible from app + dashboard + public URL
     - Data Processing Agreement checkbox during restaurant signup
     - Customer data strictly scoped by restaurantId — no cross-restaurant sharing
     - **FSSAI:** mandatory display on receipts if number is entered. Warning if missing.
     - See ARCHITECTURE_DECISIONS.md Section 35 for full details

1.9. **App version & health endpoints (backend)**
     - `GET /health` — server status, uptime, version
     - `GET /health/db` — PostgreSQL connection pool status
     - `GET /health/redis` — Redis memory usage, connection count
     - `GET /api/config/app-version` — returns `minAppVersion`, `latestAppVersion`, `updateUrl`
     - API versioning: all endpoints under `/api/v1/` prefix
     - `X-App-Version` header logging from Flutter/React clients

**Deliverable:** Backend running with Super Admin APIs, auth, permissions, device registration, operating modes, legal compliance, health endpoints, DB ready, API docs at /api/docs
**Ref:** See ARCHITECTURE_DECISIONS.md for JWT structure, permission matrix, rate limiting, DPDPA, FSSAI, app versioning

---

## PHASE 2: Menu Management + Admin Dashboard (Web)
**Goal:** Build the admin dashboard where owners manage their restaurant.

### Backend Tasks:
2.1. **Menu module** (scoped by restaurantId)
     - CRUD categories
     - CRUD menu items (with image upload)
     - Item variants management
     - Item addons management
     - Combo items management
     - Toggle item availability (in stock / out of stock)
     - **Soft-delete only:** menu items use `isArchived` flag, never hard-delete. `DELETE` API sets `isArchived = true`. Archived Items tab in admin for restore. (see Section 3)
     - Assign tax group per item/category
     - **Menu templates:** seed 6 cuisine templates (South Indian, North Indian, Chinese, Cafe, Fast Food, Multi-cuisine). Import during onboarding. See Section 38.
     - **Barcode field** on menu_items (nullable, unique per restaurant) — for barcode scanner support at POS (see Section 47)
     - **Platform-specific pricing:** optional price overrides per order type (dine-in/takeaway/delivery) via `item_price_overrides` table. If no override → use base price. (see Section 43)
     - **Menu version counter:** incremented on any menu change (price, availability, add/delete item) — used for order submission version check (Section 32)

2.2. **Tax configuration module** (scoped by restaurantId)
     - CRUD tax groups ("GST 5%", "GST 18%", "VAT")
     - CRUD tax components within group (CGST 2.5%, SGST 2.5%)
     - Tax-inclusive vs tax-exclusive toggle (per restaurant setting)
     - Rounding rules (round at bill level, not per item)
     - **NOTE:** GST rates are country-specific and change periodically. All rates MUST be configurable (not hardcoded). Verify with a CA before production.

2.3. **Table management module** (scoped by branchId)
     - CRUD tables (number, capacity, floor/section)
     - Table status tracking (available, occupied, reserved, billing)
     - **Simple table reservation:** create/edit/cancel reservations (name, phone, party size, date, time)
     - Overlap detection (no double-booking same table same time)
     - Auto-mark reserved tables 30 min before reservation time
     - Auto-mark NO_SHOW if 15 min past reservation with no seating
     - Reservation statuses: CONFIRMED → SEATED / CANCELLED / NO_SHOW
     - **Table occupied no-order alert:** if table OCCUPIED >30 min with no order → Socket.io alert to POS/captain. Configurable threshold (15–60 min). (see Section 28)

2.3b. **Discount module** (scoped by restaurantId)
     - CRUD discount rules (flat, percentage, item-level, bill-level, coupon, happy hour)
     - Coupon code validation (active, not expired, usage limits, min order)
     - Happy hour configuration (time-based, auto-apply)
     - Discount stacking rules (one bill-level + multiple item-level)
     - Usage tracking (how many times used, total discount given)
     - See ARCHITECTURE_DECISIONS.md Section 27 for full model

### Frontend Tasks:
2.4. **React project setup**
     - Vite + React + TypeScript + Tailwind CSS
     - React Router setup (auth routes, dashboard routes)
     - Axios API client with JWT interceptor + idempotency key injection
     - Global state management (Zustand)
     - Toast notifications system
     - Responsive sidebar layout

2.5. **Auth pages**
     - Login page (clean, professional design)
     - Register page (restaurant owner signup)
     - Forgot password flow

2.6. **Admin Dashboard - Layout**
     - Sidebar navigation (collapsible)
     - Top bar (restaurant name, branch selector, user menu)
     - Dashboard home (today's summary cards: sales, orders, popular items)

2.7. **Menu Management pages**
     - Categories list + add/edit modal
     - Menu items list with search/filter
     - Add/edit item form (name, price, category, tax group, image, variants, addons)
     - Toggle availability with one click
     - Drag-and-drop reordering
     - **CSV import:** upload CSV with columns (name, category, price, tax, food type, variants) → bulk-create items
     - **CSV export:** download full menu as CSV (for backup, compliance, or switching systems)
     - Import validation: preview rows, highlight errors, confirm before saving
     - **Archived Items tab:** shows soft-deleted items with "Restore" button (never hard-delete — see Section 3)
     - **Barcode field** on item edit form (manual entry). CSV import supports `barcode` column.
     - **"Advanced Pricing" section** on item edit form: toggle per order type (dine-in/takeaway/delivery), enter override price (see Section 43)

2.8. **Table Management page**
     - Visual floor plan grid
     - Add/edit/delete tables
     - Color-coded status indicators
     - **Reservations section:** today's reservations list, create/edit/cancel, calendar date picker

2.8b. **Discount Settings page (React Dashboard)**
     - Create/edit discount rules (type, scope, value, conditions, time window)
     - Coupon code management (create codes, view usage stats)
     - Happy hour configuration (time slots, applicable categories/items)
     - Active/inactive toggle per discount
     - Usage analytics (how many times used, total ₹ discounted)

2.9. **Tax Settings page**
     - Tax groups list + add/edit
     - Tax components within each group
     - Tax-inclusive/exclusive toggle

2.10. **Staff Management pages (React Dashboard)**
      - Staff list (name, role, branch, status, last login)
      - Add staff form (name, phone, role, branch, 4-digit PIN)
      - Edit staff / reset PIN / deactivate
      - Permission overrides per user (toggle individual permissions beyond role defaults)

2.11. **Additional Charges Settings page (React Dashboard)**
      - Configure charges: service charge, packing charge, delivery fee
      - Set type (percentage / flat), value, applicable order types
      - Toggle taxable / optional / active
      - Tip handling setting (enable/disable tip prompt at payment)

2.12. **Receipt Settings page (React Dashboard)**
      - Header lines (restaurant name, tagline, address)
      - GSTIN, FSSAI display toggles
      - Footer lines (thank you message, contact, social media)
      - Logo upload
      - Paper width (58mm / 80mm)
      - **UPI QR settings:** UPI Merchant ID text field, "Print UPI QR on receipts" toggle (see Section 45)

2.12b. **Payment Settings page (React Dashboard)**
      - UPI Merchant ID configuration
      - Payment methods enable/disable (Cash, Card, UPI, Credit/Settle Later)
      - **Credit account defaults:** default credit limit for new credit accounts
      - GST breakdown display options
      - Live receipt preview as owner edits
      - "Print Test Receipt" button

2.13. **Super Admin Dashboard (React — separate layout)**
      - Super Admin login page (`/super-admin/login`)
      - Platform home: total restaurants, total orders today, total revenue, signup chart
      - Restaurants list: search, filter (status/mode/city), sort, pagination
      - Add Restaurant form → creates restaurant + owner + sends credentials
      - Restaurant detail page: info, stats, branches, staff, recent orders (read-only)
      - Suspend / Activate / Delete actions on restaurant
      - Super Admin sees completely different layout (no POS, no menu mgmt — only platform management)

**Deliverable:** Super Admin can onboard restaurants without any coding. Restaurant owners can login, manage menu, configure taxes, manage tables via web dashboard.

---

## PHASE 3: POS Billing System (Flutter App)
**Goal:** Build the core billing/POS app in Flutter for Android tablets.

### Backend Tasks:
3.1. **Order module** (scoped by branchId)
     - Create order (dine-in, takeaway, delivery, **complimentary**) with idempotency key check
     - **Price snapshot:** order_items stores item name, price, tax rate, addons as frozen copy at order time (never references live menu prices — see ARCHITECTURE_DECISIONS.md)
     - **Price resolution:** check `item_price_overrides` for order type (dine-in/takeaway/delivery) → if found, use override price; else use base `menu_items.price` → snapshot the resolved price (see Section 43)
     - Add/remove/modify items in order
     - **Multi-round ordering:** adding items to existing order creates new order_items with next roundNumber + new KOT
     - **KOT modification:** removing items from a running order → generates Void KOT for kitchen (see ARCHITECTURE_DECISIONS.md Section 26)
     - **Menu version check at order submission:** compare client menuVersion vs server → warn if stale, apply server prices (see Section 32)
     - **Item availability check at submission:** soft warning if item marked unavailable mid-order (see Section 32)
     - **5-second undo window** after order submission: delay KOT print, allow instant cancel without PIN (see Section 32)
     - **Discounts:** flat, percentage, item-level, bill-level, coupon, happy hour, loyalty (see Section 27)
       - `order:apply_discount` permission required
       - Coupon validation (active, not expired, usage limit, min order)
       - Happy hour auto-suggestion based on time
       - **Discount abuse prevention:** max % without PIN, frequency alert to owner (see Section 27)
     - Price override — requires Manager PIN + `order:price_override` permission
     - Auto-calculate taxes using tax groups (CGST + SGST split)
     - **Order state machine** — transitions are MODE-AWARE (see ARCHITECTURE_DECISIONS.md Section 3)
       - COUNTER: NEW → BILLED → COMPLETED (instant billing)
       - TABLE_SIMPLE / FULL_SERVICE: NEW → ACCEPTED → PREPARING → READY → SERVED → BILLED → COMPLETED
       - CANCELLED only from NEW or ACCEPTED
       - Backend reads `restaurant.operatingMode` to pick the correct transition map
     - **Token number** for COUNTER mode: auto-increment per business day, printed on receipts
     - **Complimentary orders:** separate orderType, Manager PIN required, tracked in cost reports (see Section 30)
     - **Order priority:** NORMAL / RUSH / VIP flag per order. RUSH/VIP requires `order:set_priority` permission. KOT prints priority header. (see Section 3)
     - KOT generation (group by kitchen station)
     - **Void KOT generation** when items removed from active order (prints on same kitchen printer)

3.2. **Billing module** (scoped by branchId)
     - Generate bill from order (with idempotency)
     - Tax breakdown: CGST, SGST, IGST amounts stored separately
     - **Additional charges**: auto-apply configured charges (service charge, packing, delivery fee) based on order type
     - Tip recording (optional, separate from revenue)
     - **Split payment:** multiple payment entries per bill, partial payment state, split by amount/items/equal (see Section 31)
     - **Split payment refund flow:** when refunding a split-payment bill, staff selects which payment method to refund against. Refund per method ≤ original payment amount. (see Section 42)
     - **Credit / Settle Later payment:** for customers with credit accounts (khata). Creates charge transaction, increases outstanding balance. Manager PIN if over limit. (see Section 41)
     - **Dynamic UPI QR on receipt:** generates QR code with `upi://pay?pa={upi_id}&am={amount}` → printed on 80mm receipts. Skip on 58mm. (see Section 45)
     - **Bill calculation order:** discount BEFORE tax (GST compliant — see Section 20)
     - **Configurable rounding:** UP / DOWN / NEAREST, stored as separate `roundOff` field on bill. **Cash only:** rounding applies only to cash payments; UPI/card charged exact amount (see Section 20)
     - Bill numbering: `INV-{FY}-{BRANCH}-{SEQ}` (per financial year, not per day)
     - **Financial year logic**: April–March, auto-detect FY from date + restaurant timezone
     - Invoice generation (GST compliant, uses receipt_settings for formatting)
     - Void bill — requires Manager PIN + audit log + **creates cash-return entry if cash was collected** (see Section 18)
     - **Refunds:** full or partial (item-level), Manager PIN required, reason + method, audit logged
     - **Fraud detection:** auto-alert to owner on void/cancel after payment, daily void report, discount frequency alert (see Section 33)
     - **Business-day cutoff:** configurable per branch (default 5 AM). Orders at 1 AM belong to previous business day. Affects reports, bill counters, day-end close.
     - **Day-end close**: lock business day (with DB lock to prevent concurrent close), warn if unbilled orders exist, cash reconciliation accounts for voids + refunds (see Section 14)

### Flutter App Tasks:
3.3. **Flutter project setup**
     - Initialize Flutter project with Clean Architecture + Riverpod
     - Dio HTTP client with JWT interceptor + idempotency key injection (`{deviceId}:{uuid}`)
     - **Silent token refresh:** Dio interceptor catches 401, auto-refreshes, retries. On full expiry → save draft → redirect to login → restore draft after re-login (see Section 10)
     - SQLite (sqflite) for offline local database
     - **SQLite resilience:** WAL mode, integrity check on startup, local backup every 30 min, corruption recovery (see Section 34)
     - ESC/POS printer plugins setup (esc_pos_printer, esc_pos_utils)
     - Socket.io client for real-time updates + **reconnection handler** (re-join rooms, refetch active orders on reconnect — see Section 12)
     - Sync engine service (queue → retry → backoff → **batch throttling: 5 items/500ms on long outage recovery** — see Section 4)
     - Print queue service (queue → retry → reprint → **auto-retry pending prints on app restart** — see Section 7)
     - **Cash drawer control:** `openCashDrawer()` method sends ESC/POS command `[27,112,0,25,250]` after cash payment. Opens on Cash + Day-End Close only, NOT on UPI/Card (see Section 39)
     - **Clock drift protection:** on app start → fetch server time → calculate offset → store in `device_config` table. ALL local timestamps use adjusted time. Warn if offset >5 min. (see Section 40)
     - **Android background sync:** WorkManager for periodic sync (15 min) when app backgrounded. Foreground service with notification for financial data sync. Battery optimization whitelist prompt. (see Section 44)
     - **Barcode scanner listener:** hidden `RawKeyboardListener` on POS screen captures rapid key input (barcode scan), looks up `menu_items.barcode`, auto-adds to cart (see Section 47)
     - **Centralized error handler** in Dio interceptor (maps errorCode to user-friendly messages — see Section 29)
     - **Draft order state per table:** unsaved items preserved in memory when switching tables (see Section 32)
     - **Operating mode provider** — fetches restaurant mode, controls which screens/features are visible
     - **Staff attendance:** auto clock-in on PIN login, "Clock Out" in app menu. Auto clock-out at day-end close if forgotten. (see Section 46)

3.4. **POS Billing Screen** (adapts to operating mode)
     - Left panel: Menu categories (tabs/grid) + items grid with images
     - Right panel: Current order (items, qty +/-, price, total)
     - Quick search for items
     - Large touch-friendly buttons (designed for tablets)
     - Color-coded categories (like Petpooja)
     - Apply discount button (permission-gated, shows predefined discounts + manual option)
     - Customer phone number input (for CRM)
     - **5-second undo toast** after "Place Order" — delay KOT, allow instant cancel (see Section 32)
     - **Draft state per table** — unsaved items preserved when switching tables, yellow dot indicator
     - **"Unprinted Bills" badge** on home screen — shows count, one-tap reprint (see Section 7)
     - **COUNTER mode:** No table selection, instant bill, 2-receipt print (customer + kitchen copy)
     - **TABLE_SIMPLE mode:** Table selection shown, KOT prints, bill generated later
     - **FULL_SERVICE mode:** Full flow with captain sync, KDS updates

3.5. **Table selection flow**
     - Visual table map to select table (dine-in)
     - Or quick buttons for Takeaway / Delivery
     - Show occupied tables with running order amount

3.6. **Bill & Payment screen**
     - Bill preview with all line items, tax breakdown (CGST/SGST), discounts (discount BEFORE tax)
     - **Bill calculation:** discounted subtotal + taxable charges → tax → round-off → grand total
     - Payment mode selection (Cash / Card / UPI / **Split**)
     - **Split payment UI:** split by amount, by items, or equal split. Shows partial payment state. (see Section 31)
     - For Cash: enter received amount → shows change
     - Print bill on thermal printer via print queue (Bluetooth / USB / LAN)
     - "Reprint Bill" button on order details — reprinted receipts auto-marked `*** DUPLICATE COPY ***`, tracks `printCount` per bill (see Section 21)
     - Send bill via SMS/WhatsApp (optional)

3.7. **KOT printing (via print queue)**
     - Auto-generate KOT when order is placed (**5s delay for undo window** — see Section 32)
     - **Multi-round KOT labeling:** "Round 2 (ADDITION)" header on subsequent KOTs for same order (see Section 3)
     - **Void KOT:** auto-print when items removed from active order (same printer as original KOT)
     - Print KOT through print queue (retry on failure, alert on 3 failures)
     - Format: table no, order #, round number, items, qty, time, special instructions
     - **Void KOT format:** bold "VOID/CANCEL" header, cancelled items, reason, who voided
     - Support for multiple printers per kitchen station (Bar KOT, Kitchen KOT)
     - **Printer mapping settings screen:** scan printers, assign to stations, test print (see Section 7)
     - **Unprinted bills/KOTs recovery:** auto-retry PENDING/PRINTING items on app restart (see Section 7)
     - "Reprint KOT" button on order details
     - Printer status indicator (connected / disconnected)

3.8. **Offline support (SQLite + sync engine)**
     - Cache full menu locally in SQLite (incremental sync via updatedAt)
     - Store orders offline with idempotency keys
     - **Bill/KOT number ranges:** request range from server on login, use locally, request new batch at 80%
     - Fallback if range exhausted offline: `{BRANCH}-{DEVICE}-{LOCAL_SEQ}`, reconciled on sync
     - Sync queue: PENDING → SYNCING → SYNCED / FAILED
     - Retry: exponential backoff (1s, 2s, 4s, 8s, 16s), max 5 retries
     - **"Sync Issues" screen** with detailed cards per failed item: error message, retry/edit/discard actions (see Section 29)
     - Visual indicator (online/offline status bar)
     - **Socket.io reconnection:** re-join rooms + refetch active orders on reconnect (see Section 12)
     - **Server is source of truth** — on conflict, server wins
     - Handle 409 Conflict (optimistic locking) — refetch order, show diff, retry
     - **Error UX:** user-friendly messages for all failure states, no raw errors (see Section 29)

3.9. **Day-End Close screen (Flutter)**
     - **Concurrent close prevention:** DB lock check — if another device is closing, show "Close in progress by [name]" (see Section 14)
     - **Unbilled orders warning:** "3 orders still open. Close & carry forward, or go back to bill them?" (see Section 14)
     - Opening cash balance entry
     - Show: total sales, cash collected, card/UPI collected, **voids, refunds, void cash returns**
     - Enter actual cash in drawer
     - **Expected cash formula:** cash collections - void returns - cash refunds
     - Show difference (excess / shortage)
     - Notes for discrepancy
     - Submit → locks day, generates summary (notes carried-forward orders), resets counters

**Deliverable:** Fully functional Flutter POS app — take order, print KOT, generate bill, accept payment, works offline, day-end close, reprint support
**Ref:** See ARCHITECTURE_DECISIONS.md for state machine, sync rules, printer queue, idempotency

---

## PHASE 4: Kitchen Display System (KDS)
**Goal:** Real-time kitchen screen showing incoming orders.

### Backend Tasks:
4.1. **WebSocket gateway (Socket.io)**
     - Real-time events: order:new, order:updated, kot:new, item:ready, order:ready
     - Rooms: branch:{branchId}, kitchen:{branchId}:{station}, pos:{branchId}, captain:{branchId}
     - See ARCHITECTURE_DECISIONS.md for full room structure + event list

### Frontend Tasks (React Web):
4.2. **Kitchen Display Screen**
     - Full-screen mode (for TV/tablet browser in kitchen)
     - Card-based layout: each order is a card
     - Shows: table number, items, qty, time elapsed
     - Color coding: new (blue), in-progress (yellow), delayed (red >15min)
     - **Order priority display:** RUSH = orange badge, VIP = red badge. Sort: VIP first → RUSH → NORMAL within same status (see Section 3)
     - Click/tap to mark items as "ready"
     - Audio alert on new order (different sound for RUSH/VIP)
     - Auto-removes completed orders
     - Timer showing how long each order has been waiting
     - Dark mode default (kitchen environment)

**Deliverable:** Kitchen staff sees live orders, marks items ready, syncs back to POS

---

## PHASE 5: Captain/Waiter Ordering (Flutter - Same App)
**Goal:** Waiters take orders from their Android phone using the Flutter app in Captain mode.

### Flutter Tasks:
5.1. **Captain mode in Flutter app**
     - Same Flutter app, different UI mode based on user role (Captain vs Biller)
     - Phone-optimized layout (single column, bottom nav)
     - Table selection (visual map or list)
     - Browse menu by category
     - Add items to order with quantity
     - Select variants / add-ons per item
     - Special instructions per item
     - Submit order → KOT auto-prints in kitchen
     - View running orders for their assigned tables
     - Get push notification when food is ready (via Socket.io)
     - Call for bill / request bill print
     - Works offline (orders queue and sync later)
     - Permission-gated: captain can add items but NOT edit prices or apply discounts

**Deliverable:** Waiter opens Flutter app on phone, selects table, takes order, kitchen gets KOT instantly

---

## PHASE 6: Inventory Management
**Goal:** Track ingredients, stock, and wastage.

### Backend Tasks:
6.1. **Ingredients module** (scoped by restaurantId)
     - CRUD ingredients (name, unit, min stock level, **yieldPercent** — e.g., chicken 65% usable after cleaning)
     - Recipe mapping (menu item → ingredients with quantities)
     - **Sub-recipes:** recipes can contain other recipes (e.g., Makhani Gravy → Paneer Butter Masala). Max 3 levels deep. (see Section 48)
     - **Yield-adjusted cost:** stock reports use yield % for accurate cost calculations

6.2. **Stock module** (scoped by branchId)
     - Stock-in (purchase entry) with **batch tracking** (batch number, purchase date, expiry date, cost per unit)
     - Auto stock-out (when order is placed, deduct ingredients via recipe) — **FIFO: deduct from oldest batch first** (see Section 48)
     - Manual stock-out (wastage, staff meals) — logged in audit
     - Stock alerts (when below minimum level)
     - **Batch expiry alerts:** "Paneer Batch #12 expires in 2 days (3 kg remaining)" — for FSSAI compliance
     - Expired batches auto-flagged, require manual write-off or disposal log
     - Stock reports (consumption, wastage analysis, **expired item waste report**)

6.3. **Supplier & Purchase Order module**
     - Supplier directory
     - Create purchase orders
     - Mark PO as received (auto stock-in)

### Frontend Tasks (React Dashboard):
6.4. **Inventory pages in Admin Dashboard**
     - Ingredients list with current stock levels
     - Recipe builder (map ingredients to menu items)
     - Stock entry form (purchase / wastage)
     - Low stock alerts dashboard
     - Supplier management page
     - Purchase order creation and tracking

**Deliverable:** Track what goes in and out, auto-deduct on orders, get low stock alerts

---

## PHASE 7: Reports & Analytics
**Goal:** Comprehensive business insights.

### Backend Tasks:
7.1. **Reports module**
     - Daily sales summary (total sales, order count, avg order value)
     - Item-wise sales report (best sellers, slow movers)
     - Category-wise sales breakdown
     - Hourly sales pattern (peak hours)
     - Payment mode breakdown (cash vs card vs UPI)
     - Biller-wise collection report
     - Tax report (GST summary with CGST/SGST/IGST breakdown for filing)
     - Inventory cost report (food cost percentage)
     - Customer reports (new vs returning, top customers)
     - Pre-compute daily reports nightly (store in daily_reports table)

### Frontend Tasks (React Dashboard):
7.2. **Reports & Analytics pages**
     - Dashboard home with today's KPIs (cards + sparklines)
     - Sales reports with date range picker
     - Charts: bar, line, pie (using Recharts or Chart.js)
     - Export to PDF / Excel
     - Comparative reports (this week vs last week)

7.3. **Audit Log viewer (React Dashboard)**
     - Table: timestamp, user, action, entity, details
     - Filters: date range, user, action type, branch
     - Search by order/bill number
     - Expandable row: old value vs new value (JSON diff)
     - Export to CSV/PDF
     - Owner sees all branches, Manager sees own branch only

7.4. **Fraud & Void Reports (React Dashboard)**
     - **Dashboard card:** "Today's Voids & Cancellations: X orders (₹Y)" — prominent, not buried
     - Void/cancel report: who voided, when, amount, reason, was payment collected before void
     - **Biller-wise discount report:** how many discounts per biller, total ₹ discounted, % of orders
     - **Cash vs digital ratio per biller:** flag unusual cash-heavy patterns
     - **Fraud alerts log:** alerts triggered, thresholds hit
     - Owner push notification / SMS for voids exceeding threshold (configurable)

**Deliverable:** Owner can see business analytics + full audit trail from the dashboard

---

## PHASE 8: CRM & Customer Management
**Goal:** Build customer relationships and loyalty.

### Backend Tasks:
8.1. **Customer module** (scoped by restaurantId)
     - Auto-capture customer from phone number at billing
     - Order history per customer
     - Customer segmentation (new, regular, VIP)

8.2. **Loyalty module**
     - Points system (earn X points per Rs.100 spent)
     - **Restaurant-scoped:** points earned at Branch A redeemable at Branch B of same restaurant. NOT cross-restaurant. (see Section 49)
     - Redeem points for discounts
     - Birthday/anniversary offers

8.2b. **Customer Credit / Khata module** (scoped by restaurantId)
     - Create credit accounts for regular customers (credit limit, active/inactive)
     - Charge transactions (linked to orders) + settlement transactions (linked to payment method)
     - Partial settlement supported
     - Credit aging report: balances >30 days highlighted
     - `crm:manage_credit` permission for Owner + Manager (see Section 41)

### Frontend Tasks (React Dashboard):
8.3. **CRM pages in Dashboard**
     - Customer directory with search
     - Customer profile (order history, total spend, visits, **credit balance**, **loyalty points**)
     - **Credit account management:** create/edit credit accounts, settle balances, transaction ledger
     - **Credit accounts list page:** all active credit accounts, outstanding balances, last payment date
     - Loyalty program settings
     - **Staff Attendance page:** date range picker, attendance records per staff, total hours, late flags, CSV export (see Section 46)
     - Send promotional SMS (integration ready)

**Deliverable:** Know your customers, reward loyalty, drive repeat visits

---

## PHASE 9: Multi-Outlet & Franchise Support
**Goal:** Manage multiple branches from one dashboard.

### Backend Tasks:
9.1. **Multi-outlet module**
     - Central menu management (push menu to all branches)
     - Branch-level overrides (pricing, availability)
     - Consolidated reports across branches
     - Central kitchen module (one kitchen serves multiple outlets)
     - Inter-branch stock transfer

### Frontend Tasks (React Dashboard):
9.2. **Multi-outlet pages**
     - Branch switcher in header
     - Consolidated dashboard (all branches overview)
     - Branch comparison reports
     - Central menu editor with branch overrides

**Deliverable:** Restaurant chains can manage all outlets from one place

---

## PHASE 10: Integrations & Advanced Features
**Goal:** Connect with external services.

### Tasks:
10.1. **Payment gateway integration**
      - Razorpay / Stripe for digital payments
      - UPI QR code generation at billing

10.2. **Food aggregator integration**
      - Zomato order sync (accept/reject from dashboard)
      - Swiggy order sync
      - Auto-print KOT for online orders

10.3. **Accounting integration**
      - Export data in Tally-compatible format
      - Daily P&L auto-generation

10.4. **Notification system**
      - SMS notifications (OTP, bill, promotions)
      - WhatsApp Business API (send bills)
      - Push notifications (low stock, high sales alert)

10.5. **Advanced POS features (Flutter)**
      - Split bill (by item or by person)
      - Merge tables
      - Table transfer (move order to different table)
      - Hold & recall orders

10.6. **Device management (Admin Dashboard)**
      - Register POS devices (name, branch, fingerprint)
      - View active devices + last seen
      - Revoke device access remotely

**Deliverable:** Fully integrated system matching Petpooja's capabilities

---

## PHASE 11: Polish, Testing & Deployment
**Goal:** Production-ready quality.

### Tasks:
11.1. **UI/UX polish**
      - Consistent design system
      - Dark mode for KDS (kitchen)
      - Animations and micro-interactions
      - Multi-language support (English, Hindi, Kannada)

11.2. **Testing**
      - Unit tests for backend (Jest)
      - API integration tests
      - Frontend component tests (React Testing Library)
      - Flutter widget tests + integration tests
      - End-to-end tests (Playwright for web)

11.3. **Performance optimization + data management**
      - Database query optimization + indexing
      - PostgreSQL partitioning on orders by month (see ARCHITECTURE_DECISIONS.md)
      - Redis caching for menu, tax groups (TTL: 5 min)
      - Data archival job: move orders older than 90 days to archive tables
      - Audit log retention: append-only, minimum 7 years (GST compliance)
      - Image optimization (menu item photos)
      - Bundle optimization (code splitting)

11.4. **Automated backups**
      - Daily PostgreSQL backup via `pg_dump` at 2 AM UTC
      - Store backups in S3 / Cloudflare R2
      - Retention: 30 daily + 12 monthly backups
      - Weekly automated restore verification to staging
      - Backup status visible in Super Admin Dashboard
      - S3 versioning enabled for image storage

11.5. **Production monitoring & alerting** (see ARCHITECTURE_DECISIONS.md Section 36)
      - **Sentry** integration: NestJS (`@sentry/node`), React (`@sentry/react`), Flutter (`sentry_flutter`)
      - Upload source maps + debug symbols during CI/CD build
      - **Uptime monitoring:** BetterStack / UptimeRobot — ping health endpoints every 1 min
      - **PostgreSQL:** enable slow query logging (>500ms), monitor connection pool usage
      - **Redis:** monitor memory usage, alert at 80% maxmemory
      - **Custom API latency tracking:** middleware logs P95 per endpoint, alert if billing >2s
      - **Alert channels:** Telegram/Slack bot for P1/P2, email for P3, dashboard for P4
      - **Super Admin monitoring page:** real-time orders/min, active devices, sync failure rate, error rate

11.6. **Load testing** (before onboarding restaurants)
      - Use **k6** or **Artillery** to simulate 50 restaurants at peak
      - Target load: 2500+ API calls/min, 500+ Socket.io connections, 250 orders/min
      - Test: order creation, KOT generation, bill generation, Socket.io events
      - **PostgreSQL:** tune connection pool (default 100 is too low — test at 200-300)
      - **Socket.io:** test 500+ concurrent connections with room joins/events
      - Identify bottlenecks before they hit production
      - Document: max capacity per server, scaling thresholds

11.7. **Deployment**
      - Dockerize all services
      - Setup CI/CD (GitHub Actions)
      - Deploy to AWS / DigitalOcean
      - SSL certificate setup
      - Domain configuration
      - PM2 for process management, Winston for structured logging
      - **API versioning:** all endpoints under `/api/v1/` prefix

11.8. **Flutter app distribution** (see ARCHITECTURE_DECISIONS.md Section 37)
      - **Early stage:** Firebase App Distribution — upload APK, send install link
      - **Growth stage:** Direct APK download from `https://app.restrosync.com/download`
      - **Scale stage:** Google Play private track (restricted to enrolled devices)
      - **Force update mechanism:** check `minAppVersion` on every app launch, block if outdated
      - **Soft update prompt:** show "Update available" banner for non-critical updates
      - CI/CD: auto-build APK on release tag, upload to Firebase App Distribution

**Deliverable:** Production-deployed, tested, monitored application

---

## Quick Reference: File Structure
```
hotel-management/
├── backend/                    # NestJS — API server
│   ├── src/
│   │   ├── auth/               # Login, JWT, guards (Super Admin + Restaurant)
│   │   ├── super-admin/        # Super Admin: restaurant CRUD, platform stats
│   │   ├── restaurant/         # Restaurant & branch management
│   │   ├── menu/               # Categories, items, variants, addons
│   │   ├── orders/             # Order lifecycle
│   │   ├── billing/            # Bills, payments, invoices
│   │   ├── tables/             # Table management
│   │   ├── kot/                # Kitchen order tickets
│   │   ├── inventory/          # Stock, ingredients, recipes
│   │   ├── customers/          # CRM, loyalty
│   │   ├── reports/            # Analytics, summaries
│   │   ├── gateway/            # WebSocket (Socket.io) gateway
│   │   ├── common/             # Shared decorators, pipes, filters
│   │   └── prisma/             # Schema, migrations, seed
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── .env
│   └── package.json
│
├── frontend/                   # React — Admin Dashboard + KDS (web)
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/
│   │   │   ├── super-admin/    # Super Admin: login, restaurants list, add, detail, platform stats
│   │   │   ├── auth/           # Restaurant Login, Register
│   │   │   ├── dashboard/      # Restaurant Home, KPIs
│   │   │   ├── menu/           # Menu management
│   │   │   ├── tables/         # Table management
│   │   │   ├── kitchen/        # KDS display (Socket.io)
│   │   │   ├── inventory/      # Stock management
│   │   │   ├── customers/      # CRM
│   │   │   ├── reports/        # Analytics
│   │   │   └── settings/       # Restaurant settings
│   │   ├── hooks/              # Custom React hooks
│   │   ├── store/              # Zustand state management
│   │   ├── services/           # API client functions
│   │   ├── types/              # TypeScript interfaces
│   │   └── utils/              # Helper functions
│   └── package.json
│
├── mobile/                     # Flutter — Biller POS + Captain App
│   ├── lib/
│   │   ├── core/               # App config, theme, constants
│   │   ├── data/
│   │   │   ├── models/         # Data models (Order, MenuItem, etc.)
│   │   │   ├── repositories/   # API + local DB repositories
│   │   │   └── datasources/    # Remote (API) + Local (SQLite)
│   │   ├── domain/             # Business logic, use cases
│   │   ├── presentation/
│   │   │   ├── pos/            # POS billing screens
│   │   │   ├── captain/        # Captain order-taking screens
│   │   │   ├── tables/         # Table selection
│   │   │   ├── auth/           # Login, PIN entry
│   │   │   └── common/         # Shared widgets
│   │   ├── services/
│   │   │   ├── printer/        # ESC/POS thermal printer service
│   │   │   ├── sync/           # Offline sync engine
│   │   │   └── socket/         # Socket.io real-time client
│   │   └── main.dart
│   ├── pubspec.yaml
│   └── android/
│
├── shared/
│   └── types/                  # Shared TS types (backend + frontend)
├── docker-compose.yml
├── IMPLEMENTATION_PLAN.md
├── FEATURES_AND_SCREENS.md
└── README.md
```

---

## Estimated Effort Per Phase
| Phase | Description | Complexity |
|-------|-------------|------------|
| 1 | Setup & Foundation | Medium |
| 2 | Menu + Admin Dashboard | Medium |
| 3 | POS Billing System | High (core feature) |
| 4 | Kitchen Display (KDS) | Medium |
| 5 | Captain/Waiter App | Low-Medium |
| 6 | Inventory Management | Medium-High |
| 7 | Reports & Analytics | Medium |
| 8 | CRM & Customers | Low-Medium |
| 9 | Multi-Outlet Support | Medium-High |
| 10 | Integrations | High |
| 11 | Polish & Deployment | Medium |

---

## How to Use This Plan
1. Tell me "Start Phase 1" and I'll build everything in that phase
2. We'll test and verify each phase before moving to the next
3. Each phase builds on the previous one
4. You can skip or reorder phases based on your priority
5. After Phase 3, you'll have a usable POS system

---

---

## Naming Convention
- **Project name:** RestroSync (used in all code, UI, docs)
- **Folder name:** `hotel management` (local dev folder only — not the product name)
- **Code conventions:** See ARCHITECTURE_DECISIONS.md Section 15

---

---

## Product Positioning (Business Note)

**Competitors:** Petpooja, Posist, DotPe, Torqus, EasyEat

**Potential differentiators to consider (not technical decisions — business decisions):**
- **Offline reliability** — "works even without internet" (strongest technical differentiator)
- **Simple onboarding** — "setup in 15 minutes with menu templates" (vs Petpooja's complex onboarding)
- **No hardware lock-in** — works on any Android tablet, any ESC/POS printer
- **Price** — undercut Petpooja (₹999-₹9999/month) for SMB restaurants
- **3 operating modes** — one product serves tea shops to fine dining (flexibility)

*This is a business decision. Choose 2-3 differentiators and make them the messaging focus.*

---

*Plan created: Feb 12, 2026*
*Last updated: Feb 12, 2026 — aligned with ARCHITECTURE_DECISIONS.md (38 sections)*
*Stack: Flutter + Riverpod (POS/Captain) + React + Zustand (Dashboard/KDS) + NestJS + PostgreSQL + Prisma*
