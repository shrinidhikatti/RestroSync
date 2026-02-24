# RestroSync — Demo Testing Guide

## 🔐 Login Credentials

### Super Admin Dashboard
- **URL:** http://localhost:5173/super-admin/login
- **Email:** `admin@restrosync.com`
- **Password:** `Admin@123`
- **Access:** Platform-level management, view all restaurants, suspend/activate accounts

---

## 🍽️ Restaurant Accounts

### 1️⃣ Gangaprabha Cafe — COUNTER Mode
**Best for:** Quick-service cafes, bakeries, fast food counters

**Login:**
- **URL:** http://localhost:5173/login
- **Email:** `gangaprabha@demo.com`
- **Password:** `Demo@123`

**Menu:** 20 items
- Beverages: Filter Coffee, Masala Tea, Badam Milk, Cold Coffee
- Breakfast: Idli, Vada, Masala Dosa, Plain Dosa, Onion Dosa, Set Dosa, Upma, Pongal
- Snacks: Bonda, Bajji Mix, Samosa, Veg Puff
- Sweets: Gulab Jamun, Jalebi, Mysore Pak, Laddu

**Key Features to Test:**
- ✅ Token-based ordering (no tables)
- ✅ Auto-incrementing token numbers per business day
- ✅ Fast counter billing workflow
- ✅ Direct bill generation (no KOT)
- ✅ Print token receipt
- ✅ Day-end close with token report

**Test Flow:**
1. Login → Dashboard
2. Create New Order → Select items → Generate Bill
3. Verify token number is assigned (e.g., Token #1, #2, #3...)
4. Complete payment (Cash/Card/UPI)
5. Check running orders screen
6. Test day-end close

---

### 2️⃣ Gurukrupa — TABLE_SIMPLE Mode
**Best for:** Family restaurants, casual dining with basic table service

**Login:**
- **URL:** http://localhost:5173/login
- **Email:** `gurukrupa@demo.com`
- **Password:** `Demo@123`

**Menu:** 25 items
- Main Course: Paneer Butter Masala, Dal Tadka, Dal Makhani, Veg Kolhapuri, Mix Veg, Palak Paneer, Chole
- Breads: Butter Naan, Garlic Naan, Tandoori Roti, Laccha Paratha, Kulcha
- Rice: Jeera Rice, Veg Pulao, Veg Biryani, Curd Rice
- Sides: Raita, Green Salad, Papad
- Beverages: Lassi, Buttermilk, Fresh Lime Soda
- Desserts: Ice Cream, Gulab Jamun, Rasmalai

**Tables:** 12 (numbered 1-12, capacities: 2/4/6)

**Key Features to Test:**
- ✅ Table-based ordering
- ✅ Table status (Available/Occupied/Reserved)
- ✅ Direct billing from table (no captain/KOT workflow)
- ✅ Table transfer
- ✅ Split bill by item
- ✅ Running orders by table

**Test Flow:**
1. Login → Tables View
2. Select an available table (e.g., Table 5)
3. Add items to order → Save
4. Table status changes to "Occupied"
5. Generate bill → Apply discount/charge if needed
6. Complete payment
7. Table returns to "Available"
8. Test merge tables feature

---

### 3️⃣ Cosmo Kadai — FULL_SERVICE Mode
**Best for:** Fine dining, full-service restaurants with kitchen coordination

**Login:**
- **URL:** http://localhost:5173/login
- **Email:** `cosmo@demo.com`
- **Password:** `Demo@123`

**Menu:** 40 items
- Biryani: Chicken, Mutton, Veg, Egg
- Starters: Chicken 65, Lollipop, Paneer Tikka, Gobi Manchurian, Mushroom Fry, Fish Finger, Prawn Fry
- Main Course: Butter Chicken, Chicken Curry, Mutton Rogan Josh, Fish Curry, Prawn Masala, Paneer Butter Masala, Dal Makhani, Veg Kolhapuri
- Breads: Garlic Naan, Butter Naan, Tandoori Roti, Kulcha
- Rice: Jeera Rice, Veg Fried Rice, Chicken Fried Rice, Schezwan Fried Rice
- Noodles: Hakka Veg, Hakka Chicken, Schezwan
- Sides: Green Salad, Raita, Papad
- Beverages: Coke, Fresh Lime Soda, Watermelon Juice, Mango Lassi
- Desserts: Gulab Jamun, Ice Cream, Brownie with Ice Cream

**Tables:** 20 (numbered 1-20, capacities: 2/4/6)

**Key Features to Test:**
- ✅ Full KOT (Kitchen Order Ticket) workflow
- ✅ Captain app for order taking
- ✅ Kitchen stations (assign items to stations)
- ✅ KOT print with station grouping
- ✅ Kitchen Display System (KDS)
- ✅ Item status tracking (New → Preparing → Ready → Served)
- ✅ Table reservations
- ✅ Priority orders (NORMAL/HIGH/URGENT)
- ✅ Round ordering (multiple KOT rounds per table)
- ✅ Void items (pre-KOT and post-KOT)
- ✅ Running KOT report

**Test Flow (Full Service):**
1. Login → Tables View
2. Select table → Create new order
3. Add items with special instructions
4. Submit KOT → KOT printed and sent to kitchen
5. View KDS screen → Mark items as Preparing → Ready
6. Captain marks items as Served
7. Add Round 2 items (second KOT for same table)
8. Generate bill when all items served
9. Complete payment
10. Test table transfer during active order
11. Test void item (before and after KOT)

---

## 🧪 Common Testing Scenarios

### Billing & Payments
- **Cash payment:** Full amount
- **Card payment:** Full amount + tip
- **UPI payment:** Scan QR code (test mode)
- **Split payment:** Multiple methods (Cash + Card)
- **Split bill:** Equal split / By items
- **Complimentary:** Full/partial discount with reason

### Discounts
- Percentage discount (e.g., 10% off)
- Fixed amount discount (e.g., ₹50 off)
- Happy hour (time-based)
- Coupon code
- Max usage limits

### Taxes & Charges
- CGST/SGST (split tax display on bill)
- Service charge (percentage-based)
- Packaging charge (for takeaway)

### Reports
- Daily sales report
- Hourly sales trend
- Tax summary report
- Void/cancellation report
- Discount usage report
- Audit log (track all actions)

### Day-End Operations
- Check unbilled orders
- Carry forward open orders to next day
- Cash reconciliation
- View variance (expected vs actual cash)
- Complete day close

### Multi-Branch (if enabled)
- Switch between branches
- Branch-level reports
- Menu push to other branches
- Stock transfer between branches

---

## 🚀 Quick Start Commands

### Backend (runs on port 3000)
```bash
cd backend
npm run start:dev
```

### Frontend (runs on port 5173)
```bash
cd frontend
npm run dev
```

### Database Management
```bash
cd backend
npm run prisma:studio   # GUI for database
npm run prisma:migrate  # Run migrations
```

### Re-seed Demo Restaurants
```bash
cd backend
npm run seed:demo-restaurants
```

---

## 📱 Mobile Apps (Flutter)

### Captain/Waiter App
- **Route:** `/captain`
- For: FULL_SERVICE mode (Cosmo Kadai)
- Features: Take orders, view table status, send KOT

### Biller/POS App
- **Route:** `/biller`
- For: All modes (Counter/Table/Full Service)
- Features: Billing, payment, offline sync, printer setup, day-end close

**Build APK:**
```bash
cd mobile
flutter build apk --debug
```

---

## 🎯 Testing Checklist

### Gangaprabha Cafe (COUNTER)
- [ ] Create order with token number
- [ ] Print token receipt
- [ ] Multiple orders in sequence (tokens auto-increment)
- [ ] Day-end close with token summary
- [ ] Payment methods (Cash/Card/UPI)

### Gurukrupa (TABLE_SIMPLE)
- [ ] Occupy table → Add items → Bill
- [ ] Table status changes (Available ↔ Occupied)
- [ ] Transfer order to different table
- [ ] Split bill by items
- [ ] Merge 2 tables into one order

### Cosmo Kadai (FULL_SERVICE)
- [ ] Create order → Print KOT
- [ ] Kitchen receives KOT on KDS
- [ ] Mark items Preparing → Ready → Served
- [ ] Round 2 ordering (add items after initial KOT)
- [ ] Void item before KOT (hard delete)
- [ ] Void item after KOT (soft void, shows on bill)
- [ ] Table reservation (book for future time)
- [ ] Priority order (mark as HIGH/URGENT)

---

## 🆘 Troubleshooting

**Cannot login?**
- Check backend is running on port 3000
- Verify email/password (case-sensitive)
- Check browser console for errors

**Database empty?**
- Run: `npm run seed:demo-restaurants` from backend folder

**Port already in use?**
- Backend: Change PORT in `.env` file
- Frontend: Change port in `vite.config.ts`

**Tables not showing?**
- Verify operating mode is set correctly
- Check branch is created and active

---

## 📞 Support

For issues or questions, check:
- `ARCHITECTURE_DECISIONS.md` — Technical rules
- `IMPLEMENTATION_PLAN.md` — Feature roadmap
- `FEATURES_AND_SCREENS.md` — Screen specifications

Happy Testing! 🎉

















All 3 demo restaurants are seeded. Here's a summary of all demo credentials:                                                      
                                                                                                                                    
  ---                                                                                                                               
  Demo Login Credentials                                                                                                            
                                                                                                                                    
  Password for all accounts: Demo@1234                                                                                              
                                                                                                                                    
  🏪 COUNTER MODE — QuickBite Counter (Delhi)
                                                                                                                                    
  Modules: KDS, Inventory, CRM, Online Orders, Devices, Accounting, Day Close                                                       
  No tables — counter billing only, 20 menu items                                                                                   
                                                                                                                                    
  ┌─────────┬──────────────────────┐
  │  Role   │        Email         │
  ├─────────┼──────────────────────┤
  │ Owner   │ owner@counter.demo   │
  ├─────────┼──────────────────────┤
  │ Biller  │ cashier@counter.demo │
  ├─────────┼──────────────────────┤
  │ Kitchen │ kitchen@counter.demo │
  └─────────┴──────────────────────┘

  ---
  🍽️  TABLE_SIMPLE MODE — Udupi Café (Bangalore)

  Modules: Tables, KDS, Inventory, CRM, Online Orders, Devices, Accounting, Day Close
  8 tables (T1–T8), no reservations, 21 menu items

  ┌─────────┬────────────────────┐
  │  Role   │       Email        │
  ├─────────┼────────────────────┤
  │ Owner   │ owner@table.demo   │
  ├─────────┼────────────────────┤
  │ Captain │ captain@table.demo │
  ├─────────┼────────────────────┤
  │ Kitchen │ kitchen@table.demo │
  └─────────┴────────────────────┘

  ---
  🍾 FULL_SERVICE MODE — Grand Spice (Mumbai)

  All modules enabled — Tables, Reservations, KDS, Inventory, CRM, Multi-Outlet, etc.
  12 tables across 3 sections (Main Hall, Balcony, Private Room), 30 menu items

  ┌─────────┬──────────────────────────┐
  │  Role   │          Email           │
  ├─────────┼──────────────────────────┤
  │ Owner   │ owner@fullservice.demo   │
  ├─────────┼──────────────────────────┤
  │ Manager │ manager@fullservice.demo │
  ├─────────┼──────────────────────────┤
  │ Captain │ captain@fullservice.demo │
  ├─────────┼──────────────────────────┤
  │ Biller  │ cashier@fullservice.demo │
  ├─────────┼──────────────────────────┤
  │ Kitchen │ kitchen@fullservice.demo │
  └─────────┴──────────────────────────┘

  ---
  🔐 Super Admin

  ┌──────────────────────┬───────────┐
  │        Email         │ Password  │
  ├──────────────────────┼───────────┤
  │ admin@restrosync.com │ Admin@123 │
  └──────────────────────┴───────────┘

  Each login will only show the sidebar modules relevant to their restaurant's mode (e.g., the Counter owner won't see Tables or
  Reservations in the sidebar).
