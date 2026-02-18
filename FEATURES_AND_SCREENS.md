# RestroSync - Features & Screens Reference

All screens and features needed, organized by phase.

---

## Restaurant Operating Modes
The software supports 3 operating modes. Owner selects during onboarding, can change anytime in Settings.

| Mode | For whom | What's active |
|------|----------|---------------|
| **COUNTER** | Tea shops, cafes, bakeries, fast food, juice shops | POS billing only. No tables, no captain, no KDS. Instant bill + kitchen copy (2 receipts). |
| **TABLE_SIMPLE** | Small restaurants, dhabas, family restaurants | POS + Tables + KOT printing. No captain app, no KDS. Biller enters orders, KOT prints in kitchen. |
| **FULL_SERVICE** | Large restaurants, chains, fine dining, cloud kitchens | Everything. Captain app + KDS + POS + all modules. |

**See ARCHITECTURE_DECISIONS.md Section 16 for full details, feature matrix, and receipt formats.**

---

## User Levels
| Role | Who | Access |
|------|-----|--------|
| **Super Admin** | You (platform owner) | Manages ALL restaurants. Onboards new ones. No coding needed. |
| **Restaurant Owner** | Your client | Manages their own restaurant only. Picks operating mode. |
| **Staff** | Manager, Biller, Captain, Kitchen | Assigned by restaurant owner. Permission-gated. |

---

## App-Platform Mapping
| App | Platform | Tech | Modes |
|-----|----------|------|-------|
| **Super Admin Dashboard** | Web browser | **React.js** (separate layout) | N/A — platform level |
| Biller / POS App | Android tablet | **Flutter** + SQLite + ESC/POS printer | All modes |
| Captain / Waiter App | Android phone | **Flutter** (same app, Captain mode) | FULL_SERVICE only |
| Restaurant Admin Dashboard | Web browser | **React.js** (desktop/laptop) | All modes |
| Kitchen Display (KDS) | Web on TV/tablet | **React.js** + Socket.io | FULL_SERVICE only |
| Backend API | Cloud server | **NestJS** + PostgreSQL + Redis | All modes |

---

## PHASE 1: Foundation Setup
Just project setup, no screens.

- [ ] Initialize backend (NestJS) + frontend (React) + mobile (Flutter + Riverpod) projects
- [ ] Setup database (PostgreSQL + Redis via Docker)
- [ ] Create Prisma schema with `restaurantId` + `branchId` scoping on all tables
- [ ] Create permissions + role_permissions tables (granular RBAC)
- [ ] Create tax_groups + tax_components tables
- [ ] Create devices table (POS device registration + binding)
- [ ] Configure authentication (JWT: access 15min + refresh 7days, rotation)
- [ ] 4-digit PIN login for POS staff (registered devices only)
- [ ] Permission-based guards ("order:create", "discount:apply", etc.)
- [ ] Idempotency middleware (X-Idempotency-Key → Redis)
- [ ] Setup role-based access (Owner, Manager, Biller, Captain, Kitchen)
- [ ] Setup real-time engine (Socket.io — rooms by branch + kitchen station)
- [ ] Rate limiting (5 login attempts/15min, 100 req/min general, 300 req/min POS)

---

## PHASE 2: Admin Dashboard + Menu Management (React Web)

### --- SUPER ADMIN SCREENS (separate layout, `/super-admin/*` routes) ---

### Screen: Super Admin Login
- Route: `/super-admin/login`
- Email + password only (no PIN)
- After login → Super Admin Dashboard (NOT restaurant dashboard)

### Screen: Super Admin - Platform Dashboard (home)
- Total active restaurants
- Total suspended restaurants
- Total orders today (all restaurants combined)
- Total revenue today (all restaurants combined)
- New restaurants this month
- Chart: restaurant signups over time
- Chart: platform-wide daily orders trend
- Top 5 restaurants by revenue this month

### Screen: Super Admin - Restaurants List
- Table: restaurant name, owner name, phone, city, mode, status, branches, created date
- Search by name / phone / email
- Filter by: status (Active / Suspended), mode (Counter / Table Simple / Full Service), city
- Sort by: newest, most orders, highest revenue
- Action buttons per row: View | Suspend | Activate

### Screen: Super Admin - Add Restaurant
- Form: restaurant name, owner name, owner phone, owner email, city, address
- **Plan selection** (Free / Basic / Pro / Enterprise)
- On submit:
  - Creates restaurant + default branch
  - Creates owner account with auto-generated temp password
  - Assigns selected plan
  - Sends SMS/email to owner with credentials
  - Owner forced to change password on first login
- Success message: "Restaurant created. Credentials sent to owner."

### Screen: Super Admin - Restaurant Detail (read-only)
- Restaurant info: name, GSTIN, FSSAI, address, operating mode, **plan**, created date
- Owner info: name, phone, email, last login
- **Plan info:** current plan, limits usage (devices: 3/5, branches: 1/3, etc.)
- Stats: total orders (today / this month / all-time), total revenue, active devices count
- Branches list
- Staff list (names, roles)
- Recent 10 orders
- Actions: Suspend / Activate / Delete

### Screen: Super Admin - System Monitoring
- **Real-time metrics:** active restaurants, active devices, orders/minute, API latency (P95)
- **Sync health:** sync failure rate across all restaurants, top 5 failing restaurants
- **Error rate:** errors/minute trend chart (last 24 hours)
- **Server health:** CPU, memory, disk usage, PostgreSQL connections, Redis memory
- **Recent alerts:** triggered alerts log with severity + status
- **Uptime:** API uptime percentage (last 7 days, 30 days)
- Links to: Sentry dashboard, server logs

### --- RESTAURANT ADMIN SCREENS (regular layout, for restaurant owners) ---

### Screen: Login Page (React Web)
- Email/phone + password login
- Forgot password flow
- For Owner / Manager roles (web access)
- If first login with temp password → forced password change

### Screen: Register Page
- Restaurant owner signup
- Restaurant name, owner name, phone, email, password
- **Data Processing Agreement checkbox:** "I agree to the [Data Processing Agreement]" (link to full text)
- **Privacy Policy link** in footer
- After signup → goes to onboarding

### Screen: Onboarding - Mode Selection (after signup)
- **"How does your restaurant work?"**
  - **Counter billing** — "Customers order and pay at the counter" (tea shop, cafe, bakery)
  - **Table service (simple)** — "Waiters take orders, bill at end, no devices in kitchen" (small restaurant, dhaba)
  - **Full service** — "Captain app on phone + kitchen display screen" (large restaurant, chain)
- Visual illustration for each option (icon + 1-line description)
- Selection saves `operatingMode` to restaurant
- Can be changed anytime in Settings

### Screen: Onboarding - Menu Template (after mode selection)
- **"Pick a menu template to get started"** (you can customize everything later)
  - South Indian (Dosa, Idli/Vada, Rice, Beverages...)
  - North Indian (Starters, Tandoor, Curries, Breads, Rice, Desserts...)
  - Chinese / Indo-Chinese (Soups, Starters, Noodles, Rice...)
  - Cafe / Bakery (Coffee, Tea, Shakes, Snacks, Desserts...)
  - Fast Food / QSR (Burgers, Wraps, Fries, Beverages...)
  - Multi-cuisine (combination of above)
  - **Start from scratch** (blank — enter everything manually)
- Template import creates categories + items with ₹0 placeholder prices
- After import → "Now set your prices and remove items you don't serve"
- One-time import — no ongoing link to template

### Screen: Onboarding - FSSAI & Legal
- **FSSAI License Number** input — "Required by law on every bill"
- **GSTIN** input (optional but recommended for tax compliance)
- **Data Processing Agreement** checkbox — "I agree to the DPA" (link to full text)
- Can be filled later in Settings, but dashboard will show warning until complete

### Screen: Setup Checklist (Dashboard — until setup complete)
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
- Each incomplete item links to relevant settings page
- Dismissible after menu + tables + at least 1 staff added
- Auto-hides when all items complete

### Feature: Demo Mode (optional during onboarding)
- "Explore with Demo Data" button during onboarding
- Creates temporary demo dataset: 30 menu items, 8 tables, 5 sample orders, fake reports
- Owner taps through every screen to understand the system
- Banner at top: "DEMO MODE — data is not real. [Exit Demo & Start Setup]"
- On exit: all demo data wiped, real setup begins

### Screen: Dashboard Home
- Today's summary cards:
  - Total Sales (with % change from yesterday)
  - Total Orders
  - Average Order Value
  - Top Selling Item
- **Fraud alert card (prominent):** "Today's Voids & Cancellations: X orders (₹Y)" — click to see details
- **Discount summary:** total discounts given today (₹ amount, % of revenue)
- Quick action buttons: New Order, View Reports, Manage Menu

### Screen: Menu Management
- **Categories page**
  - List all categories (Starters, Main Course, Beverages...)
  - Add/Edit category (name, color, image)
  - Drag to reorder
  - Enable/disable category
- **Items page**
  - Grid/list view of all menu items
  - Search + filter by category
  - Each item card shows: name, price, veg/non-veg badge, availability toggle
  - Quick toggle: Mark item available / unavailable (one click)
  - **"Import Menu" button** → upload CSV → preview → confirm → bulk create items
  - **"Export Menu" button** → download full menu as CSV
  - CSV template download link ("Download sample CSV")
- **Add/Edit Item form**
  - Item name, short name (for KOT)
  - Category selection
  - Price, tax group assignment (from configurable tax_groups)
  - Food type (Veg / Non-Veg / Egg)
  - Item image upload
  - Variants (Half/Full, S/M/L) with different prices
  - Add-ons (Extra cheese, Extra gravy) with extra price
  - Kitchen station assignment (Kitchen / Bar / Dessert)
  - **Barcode field** (optional, for barcode scanner support at POS — see Section 47)
  - **Advanced Pricing section** (optional): override price per order type (dine-in / takeaway / delivery). If not set → uses base price. (see Section 43)
- **Archived Items tab**
  - Shows soft-deleted (archived) menu items
  - "Restore" button to un-archive and bring back to active menu
  - Items are never hard-deleted — `isArchived` flag used instead (see ARCHITECTURE_DECISIONS.md Section 3)

### Screen: Table Management
- Visual floor plan (grid layout)
- Add tables: number, capacity, floor, section
- Color-coded status: Green=Available, Red=Occupied, Yellow=Reserved, Blue=Billing
- Edit/delete tables
- **Reservations tab:** today's reservations list (sorted by time), create/edit/cancel
- Create reservation: select table, enter name, phone, party size, date, time, notes
- Calendar date picker to view reservations on any date
- *(Hidden in COUNTER mode)*

### Screen: Settings - Discounts
- Create/edit discount rules
- Types: Flat Amount, Percentage, Item-level, Bill-level, Coupon, Happy Hour
- Per discount: name, type, value, max cap, min order, applicable items/categories
- Coupon code management (create codes, track usage)
- Happy hour: set time window + applicable categories
- Active/inactive toggle
- Usage stats per discount (times used, total ₹ discounted)

### Screen: Staff Management
- Staff list: name, phone, role, branch, status (active/inactive), last login
- Add staff: name, phone, role, branch assignment, set 4-digit PIN
- Edit staff / reset PIN / deactivate (disable login without deleting)
- Permission overrides: toggle individual permissions beyond role defaults
  - e.g., allow a specific biller to apply discounts

### Screen: Settings - Printer Setup (Flutter POS only, not web)
- "Scan for Printers" button (discovers Bluetooth / LAN printers)
- List of discovered + saved printers
- Per printer: name, type (Bluetooth/USB/LAN), connection info
- Assign printer to station: Kitchen, Bar, Dessert, Billing, Kitchen Copy
- Mark one as default (fallback)
- "Test Print" button per printer
- Status indicator: Connected (green) / Disconnected (red)
- COUNTER mode: assign Bill Printer + Kitchen Copy Printer
- TABLE_SIMPLE / FULL_SERVICE: assign per kitchen station + Bill Printer
- **Cash drawer toggle:** "Cash Drawer Connected" per printer (opens on cash payment + day-end close only — see Section 39)
- *(Stored locally in SQLite, not synced to server — each device has own mapping)*

### Screen: Settings - Legal & Privacy (DPDPA Compliance)
- **FSSAI License Number** — if empty, shows warning "Required by law"
- **GSTIN** — for tax compliance
- **Privacy Policy link** — editable URL or use default RestroSync policy
- **Data Processing Agreement** — view signed DPA
- **Customer consent setting:** enable/disable consent prompt at billing ("Save this number for loyalty?")
- **Customer data deletion:** accessible from CRM → Customer Profile → "Delete Customer Data"
  - Anonymizes order history, removes name/phone/email, deletes loyalty points
  - Cannot be undone — confirmation modal required
- See ARCHITECTURE_DECISIONS.md Section 35

### Screen: Settings - Security & Fraud Prevention
- **Discount limits:** max discount % a biller can apply without Manager PIN (default: 10%)
- **Discount limits (flat):** max flat ₹ discount without Manager PIN (default: ₹200)
- **Void alert threshold:** alert owner if daily voids exceed count (default: 3) or amount (default: ₹1000) per biller
- **Discount frequency alert:** alert if biller applies discounts on >X% of orders (default: 20%)
- **Alert channels:** push notification, SMS, dashboard only — toggle each
- **Rounding direction:** round UP / DOWN / NEAREST (default: nearest)

### Screen: Settings - Additional Charges
- Configure charges: Service Charge, Packing Charge, Delivery Fee
- Per charge: name, type (percentage/flat), value, applies to (dine-in/takeaway/delivery/all)
- Toggle: taxable, optional (customer can ask to remove), active
- Tip handling: enable/disable tip prompt at payment screen

### Screen: Settings - Receipt Customization
- Header: restaurant name, tagline, address (editable)
- Display toggles: GSTIN, FSSAI, order number, table number, customer name
- Footer: thank you message, complaints contact, social media
- Logo upload
- Paper width: 58mm / 80mm
- GST display: show per-item tax or total only
- **UPI QR toggle:** "Print UPI QR on receipts" + UPI Merchant ID field (see Section 45). Only on 80mm.
- **Live receipt preview** (updates as you edit, shows QR if enabled)
- "Print Test Receipt" button

### Screen: Settings - Payment Methods
- Enable/disable payment methods: Cash, Card, UPI, Credit/Settle Later
- **UPI Merchant ID** (also shown in Receipt Settings for QR)
- **Default credit limit** for new credit accounts (default: ₹5000)
- **Cash drawer settings:** link to Printer Setup for cash drawer configuration

### Screen: Sidebar Navigation (adapts to operating mode)
- Dashboard
- POS / New Order
- Orders
- Menu Management
- Tables & Reservations *(hidden in COUNTER mode)*
- Staff Management
- Inventory (Phase 6)
- Customers (Phase 8)
- Reports & Audit Log (Phase 7)
- Settings *(operating mode, tax, charges, discounts, receipts, printer setup)*
- Logout

---

## PHASE 3: POS Billing System (Flutter App - Android Tablet)

### Screen: POS Home (Flutter - after login)
- Quick action buttons: New Order, Running Orders, Day-End Close
- **"Unprinted Bills" badge** — if any bills/KOTs failed to print (power cut, printer error), shows count. Tap to see list + one-tap reprint each.
- Online/Offline status indicator
- **Clock drift warning banner** (persistent, if device clock off by >5 min)
- **Sync progress** bar (when syncing after long outage: "Syncing 12/50 orders...")
- Today's quick stats: orders, revenue, cash collected
- App menu → **"Clock Out"** option → shows shift summary: "10:02 AM – 6:15 PM (8h 13m)"

### Screen: POS Login (Flutter)
- Quick 4-digit PIN login for Biller staff
- Or email/password login
- Remember device (auto-login)
- **Auto clock-in** on successful PIN login → toast: "Clocked in at 10:02 AM" (see Section 46)
- **If draft order exists** from token-expired session → restore after login, show toast "Your draft order has been restored"
- **Clock drift check:** on login, fetch server time → if device clock off by >5 min → warning banner: "Device clock is off by X hours. Check Settings → Date & Time." (see Section 40)

### Screen: POS Billing (Flutter - Tablet Optimized)
**Layout adapts to operating mode:**
- **COUNTER mode:** No table selection step. Add items → Bill instantly → 2 receipts print (customer + kitchen copy)
- **TABLE_SIMPLE mode:** Select table first → add items → KOT prints → bill later
- **FULL_SERVICE mode:** Full flow with real-time captain sync + KDS

**Layout: Split screen on Android tablet (landscape mode)**

- **Left Side (70%) - Menu**
  - Category tabs at top (color-coded, horizontally scrollable)
  - Items grid below (large touch-friendly cards, 3-4 columns)
  - Each card: item name, price, veg/non-veg dot, image
  - Quick search bar at top
  - **Barcode scanner support:** hidden keyboard listener captures barcode scan → auto-adds matching item to cart (see Section 47)
  - Tap item → adds to cart (right side)
  - Long press → shows variant & addon selection bottom sheet

- **Right Side (30%) - Current Order / Cart**
  - Table number / Order type at top
  - **Order type selector:** Dine-in / Takeaway / Delivery / **Complimentary** (Manager PIN required)
  - **Priority selector:** NORMAL (default) / RUSH / VIP — requires `order:set_priority` permission
  - List of added items with qty (+/- buttons)
  - Swipe left on item to remove (generates **Void KOT** if item was already sent to kitchen)
  - Item-wise subtotal
  - Subtotal, Tax, Discount, Grand Total at bottom
  - Buttons: Apply Discount (dropdown of predefined discounts + manual option), Add Customer, Clear All
  - **Coupon Code input** field (validates on enter)
  - **Happy Hour badge** shown if active (auto-suggested discount)
  - Big button: "Place Order & Print KOT" → **5-second undo toast:** "Order sent to kitchen. [UNDO] (5s)" — KOT delayed until undo window passes
  - Big button: "Generate Bill"
  - **Draft indicator:** yellow dot on table map if current table has unsaved items (preserved when switching tables)
  - **Menu version warning:** if menu was updated since cache → "Prices updated. Butter Chicken is now ₹400 (was ₹350). Continue?"
  - **COUNTER mode:** shows **Token Number** prominently after order placed

### Screen: Table Selection (Flutter)
- Visual table map showing all tables
- Color-coded by status (green=available, red=occupied, **yellow=reserved** with time, blue=billing)
- Tap available table → opens POS for that table
- Tap occupied table → shows running order, can add items (new round)
- **Tap reserved table → see reservation details, "Seat" or "Cancel" buttons**
- Quick buttons: "Takeaway" and "Delivery" (skip table selection)
- **"New Reservation" button** → select table, enter name/phone/party size/date/time
- **Today's reservations** collapsible list at bottom (sorted by time)
- **No-order alert:** if a table is OCCUPIED >30 min with no order → alert badge on table: "No order for 30 min" + [Create Order] [Dismiss]. Configurable threshold (15–60 min in Settings)

### Screen: Order Type Selection (Flutter)
- Dine-In (requires table selection)
- Takeaway (customer name + phone)
- Delivery (customer address + phone)

### Screen: Bill / Payment (Flutter)
- Bill preview: all items, qty, price
- **Bill calculation (GST compliant):** discounts applied BEFORE tax. Subtotal → discounts → discounted subtotal → charges → tax → round-off → grand total
- **Additional charges** auto-applied: service charge, packing, delivery (based on order type + config)
- Toggle to remove optional charges (e.g., customer declines service charge)
- Tax breakdown (CGST/SGST)
- Discounts (shown before tax line)
- **Rounding:** configurable direction (up/down/nearest), shown as separate line. **Cash only** — UPI/card charged exact amount, no rounding
- Grand total
- **Tip prompt** (optional, if enabled in settings)
- Payment mode buttons: Cash | Card | UPI | **Split** | **Credit/Settle Later** (only if customer has credit account)
- **Credit payment:** shown only when customer with credit account is linked. Tap → "Add ₹XXX to [Name]'s credit? Outstanding: ₹YYYY." Manager PIN if over credit limit.
- **Split payment screen:**
  - Split by amount: enter ₹ per person/method
  - Split by items: assign items to groups (each group = separate payment)
  - Equal split: divide by N people
  - Shows partial payment state: "₹600/₹1000 paid. ₹400 remaining."
  - Each payment method has independent status (one can fail while other succeeds)
  - Receipt shows all methods: "Cash: ₹600, UPI: ₹400"
- For Cash: enter received amount → shows change to return. **Cash drawer auto-opens** via ESC/POS command (see Section 39)
- For UPI: **dynamic UPI QR printed on receipt** with exact amount + order ID (80mm printers only). Customer scans paper bill at table. (see Section 45)
- **Print Bill on thermal printer** (uses receipt_settings for formatting — logo, GSTIN, footer)
- **Reprint Bill** button on order details — reprinted receipts auto-marked `*** DUPLICATE COPY ***` header. Tracks `printCount` per bill. KOT reprint marked `*** KOT REPRINT ***`
- Send via SMS / WhatsApp (future)
- After **full payment** → table freed automatically (not freed on partial payment)

### Screen: Running Orders (Flutter)
- List of all active orders (not yet billed)
- Filter: Dine-in / Takeaway / Delivery
- Each order: table no, items count, total, time elapsed
- Tap to view details / add items / generate bill

### Screen: Refund (Flutter)
- Search completed/billed order by order number or table
- Two options: Full Refund | Partial Refund
- Partial: select specific items + qty to refund
- Reason dropdown (Food quality / Wrong item / Customer complaint / Other)
- Optional notes
- Manager PIN prompt (required)
- Refund method: Cash back / Card reversal / Credit to customer
- **Split payment refund:** if original bill was split-paid → shows all payment methods used with amounts. Staff selects which method(s) to refund against. Refund per method ≤ original payment. Can split refund across methods. (see Section 42)
- Print refund receipt (shows refund per method: "Cash: ₹500, UPI: ₹300")
- Confirmation: "Refund of ₹XXX processed"

### Feature: KOT Printing (Flutter + ESC/POS + Print Queue)
- Auto-generates when order is placed
- **All prints go through print queue** (never direct) — retry 3x on failure
- Prints on thermal printer via Bluetooth/USB/LAN
- Groups items by kitchen station (Kitchen KOT, Bar KOT)
- Shows: table no, items, qty, special instructions, time
- If new items added to existing order → prints only new items as new KOT (multi-round)
- **Void KOT:** when items removed from active order, Void KOT prints on same kitchen printer
  - Bold "VOID / CANCEL" header, cancelled items list, reason, who voided
  - Manager PIN required if item already PREPARING
  - KDS shows voided items with strikethrough (FULL_SERVICE mode)
- **"Reprint KOT" button** on order details
- **"Reprint Bill" button** on order details
- **Printer mapping:** configured in Settings → Printer Setup screen (assign printers to stations)
- Printer status indicator (connected / disconnected)
- On 3 failures: alert with options (Retry / Switch printer / Skip)

### Feature: Complimentary / Staff Meals (Flutter)
- Order type selector includes "Complimentary" option
- On selecting Complimentary → Manager PIN required
- Reason sub-type: Staff Meal / Owner's Guest / Customer Complaint / Food Tasting
- Items added normally (prices shown for tracking, bill total = ₹0)
- KOT prints normally in kitchen (kitchen doesn't know it's free)
- Bill shows: Subtotal ₹850, Discount -₹850 (Complimentary: Staff Meal), Grand Total ₹0
- Receipt stamped "COMPLIMENTARY" instead of payment info
- Staff meal limits configurable (e.g., 1 meal/shift, max ₹200)
- Tracked separately in reports (not counted as revenue, not counted as discount)
- See ARCHITECTURE_DECISIONS.md Section 30

### Feature: Manager PIN Override (Flutter)
- Discount apply → requires `order:apply_discount` permission
- Price override → requires Manager PIN + `order:price_override` permission
- Void bill → requires Manager PIN + audit log
- Cancel order → requires Manager PIN (only from NEW or ACCEPTED status)
- **Void KOT (item removal after PREPARING)** → requires Manager PIN
- **Complimentary order** → requires Manager PIN
- All overrides logged in audit trail

### Feature: Order State Machine
- Transitions are **mode-aware** (backend reads restaurant.operatingMode):
  - COUNTER: NEW → BILLED → COMPLETED (instant billing, no kitchen states)
  - TABLE_SIMPLE / FULL_SERVICE: NEW → ACCEPTED → PREPARING → READY → SERVED → BILLED → COMPLETED
- CANCELLED only allowed from NEW or ACCEPTED
- Backend rejects invalid transitions for the restaurant's mode
- UI shows status badges with appropriate colors

### Feature: Offline Mode (Flutter + SQLite + Sync Engine)
- Full menu cached in SQLite on device (incremental sync via updatedAt)
- Orders saved to SQLite with idempotency keys when internet drops
- Sync queue: PENDING → SYNCING → SYNCED / FAILED
- Retry: exponential backoff (1s, 2s, 4s, 8s, 16s), max 5 retries
- **"Sync Issues" screen** — detailed cards per failed item:
  - Shows: order number, error message (human-readable), created time, retry count
  - Actions per item: Retry / Edit Order / Discard
  - Bulk actions: "Retry All Failed" / "Discard All"
  - See ARCHITECTURE_DECISIONS.md Section 29 for full spec
- Visual indicator: green dot (online) / red dot (offline)
- **Socket.io reconnection:** on reconnect → re-join rooms, refetch active orders, show "Connected" briefly
- **Server is source of truth** — on conflict, server wins
- **Billing and KOT printing work fully offline**

### Feature: Error & Failure UX
- **No raw errors shown to users** — all API errors mapped to user-friendly messages
- Network timeout: "Saving offline. Will sync when connected." + orange indicator
- 409 Conflict: modal "Order updated by another device. Refreshing..." → auto-refetch
- Printer failure: alert with Retry / Switch Printer / Skip
- Item out of stock: toast + remove from order + highlight in menu
- Wrong PIN: shake animation + "X attempts remaining"
- PIN lockout: "Locked for 15 min. Use email/password login."
- Permission denied: "Ask manager for PIN override" → PIN prompt
- Plan limit hit: modal "Device limit reached. Contact admin to upgrade."
- Socket.io disconnected: subtle banner "Real-time updates paused. Reconnecting..."
- See ARCHITECTURE_DECISIONS.md Section 29 for full error state table

### Screen: Day-End Close (Flutter)
- **Concurrent close check:** if another device is closing → "Day close in progress by [Manager A]. Please wait."
- **Unbilled orders warning:** "3 orders still open (Table 5, 8, 12). [Close & Carry Forward] or [Go Back to Bill]"
- Opening cash balance entry (start of shift)
- Show: total sales, cash collected, card/UPI collected, refunds, **voids, void cash returns**
- **Expected cash formula:** cash collections - void returns - cash refunds
- Enter actual cash in drawer
- Show difference (excess / shortage)
- **Fraud summary card:** voids today (count + ₹), discounts given (count + ₹)
- Notes for discrepancy
- Submit → locks **business day** (not calendar day — uses configurable cutoff time, e.g., 5 AM)
- Generates day summary report (gross sales - voids - refunds = net sales, carried-forward orders noted)
- Resets bill/KOT counters for next business day
- **Note:** An order at 1:30 AM belongs to the previous business day if cutoff is 5 AM

---

## PHASE 4: Kitchen Display System (KDS) — React Web

### Screen: Kitchen Display (React Web - Full screen for TV/tablet browser)
- Card-based layout, each card = one order
- Card shows: Order #, Table #, items list, qty, special notes
- Timer on each card (how long since order placed)
- Color changes: Blue (new) → Yellow (preparing) → Red (>15 min delayed)
- **Priority badges:** RUSH = orange badge, VIP = red badge. Cards sorted: VIP first → RUSH → NORMAL (within same status). Different audio alert for RUSH/VIP orders.
- Tap card → mark as "Preparing"
- Tap item → mark individual item as "Ready"
- **Voided items:** shown with strikethrough + red "VOIDED" badge (via `kot:void` Socket.io event)
- When all items ready → card moves to "Ready" section or disappears
- Audio beep / bell sound on new order
- **Auto-refreshes via WebSocket/Socket.io** (no page reload needed)
- **Reconnection:** on Socket.io reconnect → refetch all active orders, re-render (see Section 12)
- Dark mode optimized (kitchen environment)

### Screen: Order Ready Display / Token Display (React Web — COUNTER mode)
- **Route:** `/display/counter/{branchId}` (runs on any browser, meant for TV/monitor facing customers)
- Shows token numbers that are ready for pickup
- "Now Ready: **Token 12, 14, 15**"
- Large font, high contrast, auto-scroll if many tokens
- Updated via Socket.io when order is marked ready
- Optional audio chime on new ready token
- Auto-removes tokens after 5 minutes (configurable)
- Used for counter-service restaurants (tea shops, cafes, fast food)

---

## PHASE 5: Captain / Waiter App (Flutter - Same App, Captain Mode)
**Same Flutter app as POS, switches to phone-optimized Captain mode based on user role.**

### Screen: Captain Login (Flutter - Phone)
- Simple 4-digit PIN login
- Select which floor/section they're serving
- App detects phone screen → auto-switches to Captain layout

### Screen: Captain - Table View (Flutter - Phone)
- See all tables in their section (list or compact grid)
- Status: Available, Occupied (with order details), Reserved
- Tap table → take new order or view existing order
- Bottom navigation bar (Tables | Orders | Menu | Profile)

### Screen: Captain - Take Order (Flutter - Phone)
- Browse menu by category (single column, scrollable)
- Add items with quantity (+/- buttons)
- Select variants / add-ons via bottom sheet
- Add special instructions per item ("no onion", "extra spicy")
- Submit → **5-second undo toast** → then KOT auto-prints on kitchen thermal printer
- **Item availability warning:** if item was marked unavailable mid-order → soft warning "Paneer Tikka unavailable. Remove or submit anyway?"
- Can add more items to running order later (prints new KOT with "Round X (ADDITION)")
- Works offline (queues orders in SQLite)

### Screen: Captain - My Orders (Flutter - Phone)
- List of orders they've taken today
- Status of each: Preparing / Ready / Served
- **Push notification when food is ready** (from kitchen)
- Button: "Request Bill" → notifies biller to print bill

---

## PHASE 6: Inventory Management

### Screen: Ingredients
- List all raw materials (name, unit, current stock, min level, **yield %**)
- Add/edit ingredient — includes **yield percent** field (e.g., chicken 65% usable after cleaning)
- Low stock highlighted in red
- Quick stock update (adjust current stock)

### Screen: Recipes
- Select a menu item → define ingredients needed
- Example: Paneer Butter Masala needs 200g paneer, 100g tomato, 20ml cream...
- **Sub-recipes supported:** recipes can use other recipes as ingredients (e.g., Makhani Gravy → PBM). Max 3 levels deep. (see Section 48)
- This enables auto-deduction when order is placed (cascading through sub-recipes)

### Screen: Stock Entry
- Record stock purchase (which ingredient, qty, price, supplier, **batch number, expiry date**)
- **Batch tracking:** each purchase creates a batch with expiry date (for FSSAI compliance)
- Record wastage (what was wasted, qty, reason)
- **Write-off expired batches:** expired batches flagged, require disposal log
- Stock adjustment (physical count correction)

### Screen: Suppliers
- Supplier directory (name, phone, email, address)
- Add/edit/delete suppliers

### Screen: Purchase Orders
- Create PO → select supplier, add ingredients with qty
- Send PO to supplier (future: email/WhatsApp)
- Mark PO as received → auto updates stock

### Feature: Low Stock Alerts
- Dashboard notification when any ingredient drops below minimum level
- **Batch expiry alerts:** "Paneer Batch #12 expires in 2 days (3 kg remaining)"
- Auto-deduction uses **FIFO:** oldest batch (nearest expiry) consumed first
- Daily stock summary
- **Expired item waste report:** total waste from expired batches

---

## PHASE 7: Reports & Analytics

### Screen: Sales Report
- Date range picker (Today, Yesterday, This Week, This Month, Custom)
- Total sales, total orders, avg order value
- Line chart: sales trend over selected period
- Bar chart: sales by category
- Table: item-wise sales (name, qty sold, revenue)

### Screen: Payment Report
- Breakdown by payment method (Cash / Card / UPI)
- Pie chart visualization
- Biller-wise collection summary

### Screen: Tax Report
- GST summary (CGST + SGST breakdown)
- Date range filter
- Export for GST filing

### Screen: Item Performance
- Best sellers (top 10 items by qty and revenue)
- Slow movers (bottom 10)
- Category-wise performance

### Screen: Hourly Analysis
- Sales by hour (identify peak hours)
- Orders by hour
- Helps in staff planning

### Feature: Export
- Export any report to PDF
- Export to Excel/CSV
- Print report

### Screen: Daily Summary (End of Day)
- Total sales, total orders
- Cash in hand
- Card/UPI collections
- Discounts given
- Cancellations
- Opening vs closing stock (Phase 6)

### Screen: Fraud & Void Report (prominent — NOT buried in audit)
- **Dashboard card:** "Today's Voids & Cancellations: X orders (₹Y)" — click for detail
- Void/cancel list: who voided, when, amount, reason, was cash collected before void?
- **Biller-wise discount report:** discounts per biller, total ₹ discounted, % of orders with discounts
- **Cash vs digital payment ratio per biller:** flag unusual patterns
- **Alerts triggered today:** thresholds hit (>3 voids, >₹1000 voided, >20% discount rate)
- Date range filter
- Owner gets push notification / SMS for threshold breaches

### Screen: Audit Log Viewer
- Table: timestamp, user name, action, entity, details
- Filters: date range, user (staff), action type, branch
- Search by order number or bill number
- Expandable row: shows old value vs new value (what changed)
- Export to CSV / PDF
- Key events highlighted: discounts, price overrides, voids, cancellations
- Owner sees all branches, Manager sees own branch only

---

## PHASE 8: CRM & Customers

### Screen: Customer List
- Search by phone number or name
- Table: name, phone, total orders, total spend, last visit
- Sort by: recent visit, highest spend, most orders

### Screen: Customer Profile
- Customer details (name, phone, birthday, anniversary)
- Order history (all past orders with items and amounts)
- Total lifetime spend
- Loyalty points balance (**restaurant-scoped** — earn at Branch A, redeem at Branch B)
- **Credit tab** (if credit account exists):
  - Current outstanding balance
  - Credit limit
  - Transaction ledger: charges (orders) + settlements (payments)
  - "Settle Credit" button → enter amount, payment method, notes → partial settlement OK
  - "Edit Credit Limit" button
- Tags (VIP, Regular, Corporate)
- Notes

### Screen: Loyalty Program Settings
- Enable/disable loyalty
- Points per Rs.100 spent
- Redemption rate (e.g., 100 points = Rs.10 discount)
- Bonus points on birthday
- Note: loyalty is **restaurant-scoped** (cross-branch within same restaurant, NOT cross-restaurant)

### Screen: Credit Accounts (Khata)
- List of all active credit accounts: customer name, phone, outstanding balance, credit limit, last payment date
- Create credit account: select existing customer → set credit limit → activate
- Quick settle: enter payment amount + method for any account
- **Credit aging report:** highlight balances >30 days in red
- Day-end summary shows: "Outstanding Credit: ₹X across Y customers"
- Filter by: all / overdue / recently settled

### Screen: Staff Attendance (Admin Dashboard)
- Date range picker
- Table: staff name, role, date, clock-in time, clock-out time, total hours, late flag
- Late flag: configurable expected start time per role (e.g., Biller expected by 10 AM)
- Filter by staff member, role, branch
- Summary cards: total hours this week/month per staff, average hours
- Auto clock-out entries marked with "Auto" badge (staff forgot to clock out)
- Export to CSV

### Feature: At Billing
- Enter customer phone → auto-fetch / create profile
- **DPDPA consent prompt** (first time only): "Save this number for order history and loyalty rewards? [Yes] [No — don't save]"
  - If No → order proceeds but phone number not stored in CRM
  - If Yes → consent flag saved, customer profile created
- Show loyalty points, suggest redemption
- After bill → auto-add earned points

### Feature: Customer Data Deletion (DPDPA Right to Erasure)
- Accessible from CRM → Customer Profile → "Delete Customer Data"
- Anonymizes: name → "Deleted Customer", phone/email removed, loyalty points deleted
- Order history preserved but de-linked (for financial/GST compliance)
- Confirmation modal: "This cannot be undone. Customer's data will be permanently anonymized."
- Audit logged: who deleted, when, customer reference

---

## PHASE 9: Multi-Outlet Management

### Screen: Branch Management
- List all branches with status
- Add new branch
- Branch-wise settings (timings, taxes)

### Screen: Branch Switcher
- Dropdown in header to switch between branches
- "All Branches" view for consolidated data

### Screen: Consolidated Dashboard
- Combined sales across all branches
- Branch comparison chart
- Top performing branch

### Feature: Central Menu
- Edit menu centrally → push to all branches
- Override prices per branch
- Override availability per branch

---

## PHASE 10: Integrations

### Feature: Payment Gateway (Razorpay)
- UPI QR code at billing
- Card payment via gateway
- Auto-reconciliation

### Feature: Online Order Sync (Zomato / Swiggy)
- Auto-accept orders from aggregators
- Show in POS as "Online Order"
- Auto-print KOT
- Update status back to platform

### Feature: Accounting Export
- Tally-compatible export
- Daily P&L summary
- GST report for filing

### Feature: Notifications
- SMS: bill to customer, promotional messages
- WhatsApp: send bill, order updates
- Push: low stock alert, daily summary to owner

### Feature: Advanced POS
- Split bill (by item or equal split)
- Merge tables (combine two tables into one order)
- Transfer table (move order from one table to another)
- Hold order (save for later)
- Cancel order with reason (Manager PIN required, only from NEW/ACCEPTED)

### Feature: Device Management (Admin Dashboard)
- Register POS devices (name, branch, device fingerprint)
- View active devices + last seen timestamp
- Revoke device access remotely (invalidates all tokens on device)
- Unregistered device login → requires Owner/Manager approval

---

## PHASE 11: Polish & Deploy

- [ ] Consistent design system across all screens
- [ ] Dark mode for Kitchen Display
- [ ] Loading states, empty states, error states for all screens
- [ ] Multi-language support (English + Hindi + Kannada)
- [ ] Keyboard shortcuts for POS (speed billing)
- [ ] Unit tests for backend
- [ ] End-to-end tests for critical flows
- [ ] **Load testing** with k6/Artillery — simulate 50 restaurants at peak (2500+ API calls/min)
- [ ] Performance optimization (PostgreSQL connection pool tuning, Socket.io capacity)
- [ ] Docker deployment
- [ ] SSL + Domain setup
- [ ] **Production monitoring:** Sentry (NestJS + React + Flutter), uptime monitoring, alert channels (Telegram/Slack)
- [ ] **Super Admin monitoring page:** real-time metrics, error rate, sync health, server status
- [ ] **Flutter app distribution:** Firebase App Distribution (early) → direct APK → Play Store private track
- [ ] **Force update mechanism:** `minAppVersion` check on app launch, block outdated versions
- [ ] **API versioning:** all endpoints under `/api/v1/`, support 2 versions during transitions
- [ ] **Privacy Policy** page accessible from app + dashboard + public URL
- [ ] **FSSAI warning** on dashboard if license number not entered

---

## User Flows (Key Journeys)

### Flow 1: Counter Billing (COUNTER mode)
```
Customer comes to counter
→ Biller adds items on POS (no table selection)
→ Biller taps "Bill & Print"                     [Order: NEW → BILLED]
→ 2 receipts print simultaneously:
    Receipt 1 (Customer): Items, GST, total, paid stamp
    Receipt 2 (Kitchen): Items + qty only (what to prepare)
→ Customer pays (cash/card/UPI)                  [Order: COMPLETED]
→ Kitchen prepares from their receipt copy
→ Customer collects food
→ Done — no running orders, no table management
```

### Flow 2: Table Service Simple (TABLE_SIMPLE mode)
```
Customer sits at table
→ Waiter tells biller "Table 5 wants 2 dosa 1 coffee"
→ Biller enters order on POS for Table 5         [Order: NEW → ACCEPTED]
→ KOT prints in kitchen (thermal printer)
→ Kitchen prepares from printed KOT
→ Waiter serves food                             [Biller marks: SERVED]
→ Customer asks for bill
→ Biller taps Table 5 → "Generate Bill"          [Order: BILLED]
→ Customer pays (cash/card/UPI)                  [Order: COMPLETED]
→ Bill prints, table freed
```

### Flow 3: Full Service Dine-In (FULL_SERVICE mode)
```
Customer arrives
→ Captain selects table on Flutter app (phone)
→ Captain browses menu, adds items
→ Captain submits order                          [Order: NEW]
→ Order auto-accepted                            [Order: ACCEPTED]
→ KOT prints in kitchen (via print queue)
→ Kitchen sees order on KDS (React, via Socket.io)
→ Kitchen taps "Preparing"                       [Order: PREPARING]
→ Kitchen marks items ready                      [Order: READY]
→ Captain gets notified (Socket.io push), serves food  [Order: SERVED]
→ Customer asks for bill
→ Biller generates bill on Flutter POS           [Order: BILLED]
→ Customer pays (cash/card/UPI)                  [Order: COMPLETED]
→ Bill printed on thermal printer, table freed
```

### Flow 4: Takeaway Order (any mode)
```
Customer comes to counter
→ Biller selects "Takeaway" on Flutter POS
→ Enters customer phone (auto-creates CRM profile)
→ Adds items to order                            [Order: NEW → ACCEPTED]
→ KOT prints in kitchen (via print queue)
→ Biller generates bill immediately              [Order: BILLED]
→ Customer pays                                  [Order: COMPLETED]
→ Kitchen prepares                               [Order items: PREPARING → READY]
→ Order ready, customer picks up
```

### Flow 5: Online Order (Zomato/Swiggy — any mode)
```
Order received from Zomato API
→ Auto-accepted, appears in POS                  [Order: NEW → ACCEPTED]
→ KOT auto-prints in kitchen (via print queue)
→ Kitchen prepares                               [Order: PREPARING]
→ Marks ready on KDS (FULL_SERVICE) or manually  [Order: READY]
→ Delivery partner picks up                      [Order: SERVED → COMPLETED]
→ Status updated back to Zomato via API
```

### Flow 6: Offline Billing (any mode)
```
Internet drops (red indicator on POS)
→ Biller continues normally on Flutter POS
→ Orders saved to SQLite with idempotency keys
→ KOT/receipts print on local thermal printer (works offline)
→ Bills generated locally, bill numbers assigned
→ Internet restores (green indicator)
→ Sync engine pushes pending orders to server (FIFO)
→ Server checks idempotency keys, deduplicates
→ Any failures shown in "Sync Issues" screen
```

---

## Priority Order (What matters most)
1. POS Billing (Phase 3) - Revenue generating, daily use
2. KDS (Phase 4) - Kitchen efficiency
3. Menu Management (Phase 2) - Setup requirement
4. Captain App (Phase 5) - Order speed
5. Reports (Phase 7) - Business insights
6. Inventory (Phase 6) - Cost control
7. CRM (Phase 8) - Customer retention
8. Multi-outlet (Phase 9) - Scale
9. Integrations (Phase 10) - Ecosystem

---

*This document describes WHAT to build. See IMPLEMENTATION_PLAN.md for HOW and tech details.*
*Stack: Flutter (POS/Captain) + React (Dashboard/KDS) + NestJS + PostgreSQL*
