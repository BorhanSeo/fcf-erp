# ============================================================
# FCF STATIONERY HOUSE — FULL ERP DEVELOPER GUIDELINE PROMPT
# Version: 1.0 | May 2025
# Use this prompt with: Claude, Cursor, ChatGPT, or any AI Coding Tool
# ============================================================

---

## 🧠 SYSTEM ROLE (Paste this first when starting a new AI session)

You are a senior full-stack developer building a complete, production-ready ERP system for
"FCF Stationery House" — a wholesale stationery business in Bangladesh. You must follow every
instruction in this guideline exactly. Never skip a module. Never simplify a feature. Build
everything as described. Ask for clarification only if something is truly ambiguous.

---

## 📦 PROJECT IDENTITY

- **Project Name:** FCF Stationery House ERP
- **Business:** Wholesale Stationery Dokan (খাতা/নোটবুক পাইকারি বিক্রয়)
- **Location:** Bangladesh
- **Currency:** BDT (৳)
- **Language:** Bilingual — Bangla (primary UI labels) + English (technical fields & code)
- **Users:** Admin, Staff (2 roles only)
- **Platform:** Web-based, Desktop-first, Mobile Responsive

---

## 🛠️ TECH STACK — MANDATORY (Do not change without asking)

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| UI Library | Tailwind CSS + shadcn/ui components |
| State Management | Zustand or React Context |
| Backend / DB | Supabase (Auth + PostgreSQL + Storage + Realtime) |
| PDF Generation | @react-pdf/renderer (client) or Puppeteer (server) |
| Charts | Recharts |
| WhatsApp | WhatsApp Business API (via 360dialog or WATI) |
| Form Handling | React Hook Form + Zod validation |
| Date Handling | date-fns |
| Hosting | Vercel (frontend) + Supabase (backend) |

---

## 🗄️ DATABASE — ALREADY CREATED IN SUPABASE

The Supabase database schema is already set up. It contains these tables:

### Tables:
1. `profiles` — Admin & Staff user accounts (linked to Supabase Auth)
2. `product_categories` — Standard, Kidz
3. `products` — 13 FCF products with pricing & stock
4. `customers` — Customer profiles with running `total_due` balance
5. `suppliers` — Supplier profiles with `total_due` (what we owe them)
6. `orders` — Order header (status, payment_method, totals)
7. `order_items` — Line items per order
8. `invoices` — Auto-generated invoice per order
9. `payments` — Customer payments received (reduces `total_due`)
10. `purchases` — Stock purchase from suppliers
11. `purchase_items` — Line items per purchase
12. `supplier_payments` — Payments made to suppliers
13. `stock_movements` — Complete audit log of every stock change
14. `notification_logs` — WhatsApp/SMS send history
15. `notification_templates` — Bangla message templates
16. `settings` — System config (invoice prefix, currency, etc.)

### Auto Triggers (already in DB — do NOT re-implement in frontend):
- Order status → `delivered`: stock auto-deducted, logged in `stock_movements`
- Purchase status → `received`: stock auto-added, logged in `stock_movements`
- New payment inserted: `customers.total_due` auto-reduced
- New order with due: `customers.total_due` auto-increased

### Views (use these for reports & dashboard):
- `vw_today_summary` → today's sales, collections, orders count
- `vw_low_stock` → products below threshold
- `vw_monthly_pl` → monthly revenue, purchase cost, gross profit
- `vw_customer_ledger` → customer-wise totals & balances
- `vw_overdue_customers` → customers with outstanding dues
- `vw_price_list` → all product prices with margin %

### Row Level Security:
- Admin: full access to ALL tables
- Staff: can create orders/customers/invoices; can READ products, stock, payments; CANNOT access purchases, suppliers, reports, settings, user management

---

## 🔐 MODULE 1 — AUTHENTICATION

### Pages:
- `/login` — Email + Password login form
- No public registration. Admin creates Staff accounts from User Management.

### Behavior:
- After login, check `profiles.role`:
  - `admin` → redirect to `/dashboard`
  - `staff` → redirect to `/dashboard` (limited view)
- Persist session using Supabase Auth
- Protected routes: all pages require login
- Logout button in sidebar

### UI Requirements:
- FCF Stationery House logo/name on login page
- Bangla label: "লগইন করুন"
- Show error in Bangla: "ইমেইল বা পাসওয়ার্ড ভুল হয়েছে"

---

## 📊 MODULE 2 — DASHBOARD

### Route: `/dashboard`

### Cards (top row):
| Card | Data Source | Label (Bangla) |
|---|---|---|
| Today's Sales | `vw_today_summary.today_sales` | আজকের বিক্রয় |
| Today's Orders | `vw_today_summary.today_orders` | আজকের অর্ডার |
| Total Due | SUM of `customers.total_due` | মোট বাকি পাওনা |
| Low Stock Count | COUNT from `vw_low_stock` | কম স্টক পণ্য |

### Charts:
- **Bar Chart:** Last 6 months — Revenue vs Purchase Cost (from `vw_monthly_pl`)
- **Line Chart:** Last 30 days daily sales

### Tables on Dashboard:
- Recent 5 orders (order_number, customer name, total, status, date)
- Low Stock Alert list (product name, stock_quantity, unit, threshold)

### Quick Action Buttons:
- "নতুন অর্ডার" → `/orders/new`
- "নতুন ক্রয়" → `/purchases/new`
- "স্টক দেখুন" → `/stock`

### Role Difference:
- Staff sees: Today's Sales, Today's Orders, Recent Orders, Low Stock
- Staff does NOT see: Total Due card, Charts, Quick Action for purchases

---

## 📋 MODULE 3 — ORDER MANAGEMENT

### Routes:
- `/orders` — Order list
- `/orders/new` — Create new order
- `/orders/[id]` — Order detail & status update
- `/orders/[id]/invoice` — View/print invoice

---

### 3A. NEW ORDER PAGE (`/orders/new`)

#### Step 1 — Select Customer:
- Searchable dropdown (search by name or phone)
- If not found → inline "নতুন Customer যোগ করুন" button → mini modal with: Name, Phone, Address, Area
- Show customer's current `total_due` below the selector

#### Step 2 — Add Products:
- Searchable product selector (search by name or product_code)
- Show: product name, subject, category, current stock, unit price
- Fields per line item: Quantity, Unit Price (pre-filled, editable), Discount per item
- Line Total = (Unit Price - Discount) × Quantity (auto-calculated)
- "+ পণ্য যোগ করুন" button to add more rows
- Show current stock next to each product — warn if quantity > stock

#### Step 3 — Payment:
- Subtotal (sum of line totals)
- Order-level Discount field
- Total Amount = Subtotal - Order Discount
- Payment Method: নগদ (cash) / বাকি (due) / আংশিক (partial)
  - If "cash": Paid Amount = Total Amount, Due = 0
  - If "due": Paid Amount = 0, Due = Total Amount
  - If "partial": Enter Paid Amount manually, Due = Total - Paid
- Note/Remarks field (optional)

#### On Submit:
1. Create row in `orders` table
2. Create rows in `order_items` table
3. Auto-generate `invoices` row (invoice_number = "INV-YYYY-NNNN")
4. Update `customers.total_due` via trigger (automatic)
5. Show success toast: "অর্ডার সফলভাবে তৈরি হয়েছে"
6. Redirect to order detail page with Invoice preview

---

### 3B. ORDER LIST PAGE (`/orders`)

#### Filters:
- Date range picker
- Customer search
- Status dropdown: All / Pending / Confirmed / Delivered / Cancelled
- Payment Method filter

#### Table Columns:
- Order Number | Customer Name | Date | Items Count | Total | Paid | Due | Status | Actions

#### Actions per row:
- View detail
- Change status (Admin only): Pending → Confirmed → Delivered → Cancelled
- Download Invoice PDF
- Send Invoice via WhatsApp

#### Status Color Coding:
- Pending: Yellow badge
- Confirmed: Blue badge
- Delivered: Green badge
- Cancelled: Red badge (strikethrough row)

---

### 3C. INVOICE PAGE (`/orders/[id]/invoice`)

#### Invoice Layout (PDF-ready):
```
[FCF Stationery House Logo]         Invoice #: INV-2025-0001
FCF Stationery House                Date: 10 May 2025
Wholesale Stationery Dokan          

Bill To:
[Customer Name]
[Phone] | [Area]

---------------------------------------------------------
| # | Product       | Subject | Qty | Price | Total    |
---------------------------------------------------------
| 1 | Fcf 124       | Bangla  |  10 | 120   | 1,200    |
| 2 | Fcf 84        | Math    |   5 | 100   |   500    |
---------------------------------------------------------
                              Subtotal:        1,700 ৳
                              Discount:           50 ৳
                              Total:           1,650 ৳
                              Paid:            1,000 ৳
                              Due:               650 ৳

Payment: Partial | Note: [note here]

Thank you for your business!
```

#### Buttons:
- "PDF Download" — generates downloadable PDF
- "Print" — browser print dialog
- "WhatsApp-এ পাঠান" — sends via WhatsApp API

---

## 📦 MODULE 4 — STOCK MANAGEMENT

### Route: `/stock`

#### Main View — Stock Table:
| Column | Notes |
|---|---|
| Product Code | e.g. FCF-124-BN |
| Product Name | Bangla + English |
| Subject | Bangla/Math/English/General |
| Category | Standard/Kidz |
| Unit | Dozen/Rim/Piece |
| Current Stock | Color coded: Red if ≤ threshold |
| Low Stock Threshold | Editable inline (Admin only) |
| Purchase Price | |
| Selling Price | |
| Actions | View history, Adjust |

#### Manual Stock Adjustment (Admin only):
- Modal: Select product → Type (Add/Remove) → Quantity → Reason → Submit
- Inserts row in `stock_movements` with type `manual_in` or `manual_out`

#### Stock History (per product):
- `/stock/[product_id]/history`
- Table: Date | Movement Type | Quantity | Stock Before | Stock After | Reference | Note
- Movement types translated: purchase_in=ক্রয়, sale_out=বিক্রয়, manual_in=ম্যানুয়াল যোগ, manual_out=ম্যানুয়াল বাদ

#### Export:
- Export full stock table to Excel (XLSX)
- Export to PDF

#### Filters:
- Category filter (Standard / Kidz)
- Low stock only toggle
- Subject filter

---

## 🛒 MODULE 5 — PURCHASE MANAGEMENT (Admin Only)

### Routes:
- `/purchases` — Purchase list
- `/purchases/new` — New purchase entry
- `/purchases/[id]` — Purchase detail

---

### 5A. NEW PURCHASE (`/purchases/new`)

#### Fields:
- Supplier selector (searchable) — show supplier's `total_due` below
- Purchase Date
- Add product rows: Product | Quantity | Unit Price | Line Total
- Total Amount (auto-sum)
- Payment: নগদ / বাকি / আংশিক
- Paid Amount → Due Amount auto-calculated
- Note

#### On Submit:
1. Create `purchases` row with status = `received`
2. Create `purchase_items` rows
3. Trigger fires → stock auto-updated
4. If due > 0: `suppliers.total_due` increases
5. Toast: "ক্রয় সফলভাবে রেকর্ড হয়েছে"

---

### 5B. PURCHASE LIST (`/purchases`)

- Filter: Date range, Supplier, Status
- Columns: Purchase# | Supplier | Date | Total | Paid | Due | Status | Actions
- Actions: View, Mark as returned (Purchase Return)

### 5C. PURCHASE RETURN:
- Select items to return → quantity to return
- Inserts `stock_movements` with type `return_out`
- Reduces stock accordingly
- Updates purchase status to `returned` or `partial`

---

## 👥 MODULE 6 — CUSTOMER MANAGEMENT

### Routes:
- `/customers` — Customer list
- `/customers/new` — Add customer
- `/customers/[id]` — Customer profile & ledger

---

### Customer List:
- Search by name or phone
- Filter by area
- Filter: Has Due / No Due
- Columns: Name | Phone | Area | Total Orders | Total Purchase | Total Paid | Due Balance | Actions
- Sort by: Due (highest first) by default

### Customer Profile (`/customers/[id]`):
#### Tabs:
1. **Overview:** Basic info, Edit button (Admin), total stats
2. **Order History:** All orders table with status & amounts
3. **Ledger:** Chronological list of all transactions (orders + payments)
4. **Payments:** List of payments received, + "নতুন পেমেন্ট রেকর্ড" button

#### Receive Payment Modal:
- Amount field
- Payment Method: Cash / bKash / Nagad / Bank
- Date (default today)
- Note
- On Submit: inserts into `payments` table → trigger reduces `customers.total_due`

#### WhatsApp Due Reminder (Admin only):
- Button: "বাকি রিমাইন্ডার পাঠান"
- Uses `notification_templates` where type = `due_reminder`
- Replaces: `{{customer_name}}`, `{{due_amount}}`
- Logs to `notification_logs`

---

## 🏭 MODULE 7 — SUPPLIER MANAGEMENT (Admin Only)

### Routes:
- `/suppliers` — Supplier list
- `/suppliers/new` — Add supplier
- `/suppliers/[id]` — Supplier profile

### Supplier List:
- Columns: Name | Company | Phone | Address | Total Purchased | Total Paid | We Owe (due) | Actions

### Supplier Profile:
- Tabs: Overview | Purchase History | Payments Made
- "পেমেন্ট করুন" button → modal → inserts into `supplier_payments` → reduces `suppliers.total_due`

---

## 💰 MODULE 8 — PAYMENT & DUE TRACKING (Admin Only)

### Route: `/payments`

#### Tabs:
1. **Customer Payments** — All payments received (filter by customer, date, method)
2. **Overdue Customers** — From `vw_overdue_customers` view; shows days since last order
3. **Supplier Dues** — What we owe each supplier

#### Overdue Customer Actions:
- "WhatsApp পাঠান" per customer
- "পেমেন্ট রেকর্ড করুন" — quick payment modal

#### Summary Cards (top of page):
- Total Customer Due (মোট পাওনা)
- Total Supplier Due (মোট দেনা)
- Collected Today
- Net Position = Customer Due - Supplier Due

---

## 📈 MODULE 9 — PROFIT & LOSS REPORT (Admin Only)

### Route: `/reports`

#### Sub-pages / Tabs:
1. **Daily Report** (`/reports/daily`)
2. **Monthly Report** (`/reports/monthly`)
3. **Yearly Report** (`/reports/yearly`)
4. **Product-wise Report** (`/reports/products`)

---

### Daily Report:
- Date picker (default: today)
- Cards: Total Sales | Total Collection | Total Due Added | Orders Count
- Table: Each order of the day with totals
- Export to PDF

### Monthly Report:
- Month + Year selector
- Cards: Revenue | Purchase Cost | Gross Profit | Profit Margin %
- Bar chart: Daily sales within the month
- Table: All orders of the month
- Export to PDF / Excel

### Yearly Report:
- Year selector
- Cards: Annual Revenue | Annual Purchase | Annual Profit
- Bar chart: Monthly breakdown (Revenue vs Cost vs Profit)
- Table: Month-by-month summary

### Product-wise Report:
- Date range picker
- Table: Product | Units Sold | Revenue | Purchase Cost | Gross Profit | Margin %
- Sort by profit (highest first)

---

## 💬 MODULE 10 — WHATSAPP NOTIFICATIONS

### Route: `/notifications` (Admin only)

#### Tabs:
1. **Send Message** — Custom or template-based
2. **Templates** — View/Edit Bangla templates
3. **History** — All sent messages log

---

### Send Message:
- Select recipient type: Customer / Supplier / Custom Number
- If Customer: searchable dropdown
- Select template OR type custom message
- Preview message before sending
- Send button → calls WhatsApp API → logs in `notification_logs`

### Auto Notifications (triggered by system events):
| Event | Trigger | Template Used |
|---|---|---|
| Order confirmed | Order status → confirmed | `order_confirm` |
| Invoice created | After order submit | `invoice` |
| Payment overdue | Manual send from customer page | `due_reminder` |
| Stock low | Daily cron or on stock update | `low_stock` |

### Templates Page:
- List all templates from `notification_templates` table
- Edit template body (Admin only)
- Show available variables: `{{customer_name}}`, `{{order_number}}`, `{{total_amount}}`, `{{due_amount}}`, `{{product_name}}`, `{{stock_quantity}}`

### Notification History:
- Table: Date | Channel | Recipient | Type | Status | Message Preview
- Filter by status: Sent / Failed / Pending
- Retry button for failed messages

---

## 💲 MODULE 11 — PRODUCT PRICE LIST

### Route: `/price-list`

- Available to: Admin (full) + Staff (read-only)
- Uses `vw_price_list` view
- Table: Product Code | Name | Subject | Category | Pages | Unit | Purchase Price | Selling Price | Margin %
- Admin can edit prices inline (updates `products` table)
- Export to PDF — printable price list format

---

## ⚙️ MODULE 12 — USER MANAGEMENT (Admin Only)

### Route: `/settings/users`

#### User List:
- Table: Name | Email | Phone | Role | Status | Created | Actions
- Actions: Edit, Deactivate/Activate, Reset Password

#### Create New Staff:
- Modal: Full Name, Email, Phone, Role (staff), Temporary Password
- Creates Supabase Auth user + `profiles` row
- Sends welcome email (optional)

#### Edit User:
- Change name, phone
- Change role (admin ↔ staff)
- Toggle is_active

---

## 🔧 MODULE 13 — SYSTEM SETTINGS (Admin Only)

### Route: `/settings`

#### Sections:
1. **Business Info:** Company name, Phone, Address (updates `settings` table)
2. **Invoice Settings:** Invoice prefix, Order prefix, Purchase prefix
3. **Stock Settings:** Default low stock threshold
4. **Notification Settings:** WhatsApp enabled toggle, API key config
5. **Currency:** Symbol display (৳)

---

## 🎨 UI / UX DESIGN RULES

### Layout:
- Left sidebar navigation (collapsible on mobile)
- Top header: current user name + role badge + logout
- Main content area with breadcrumbs

### Sidebar Navigation Items:
```
📊 Dashboard
📋 অর্ডার ব্যবস্থাপনা   (Orders)
📦 স্টক ব্যবস্থাপনা    (Stock)
🛒 ক্রয় ব্যবস্থাপনা   (Purchases)  [Admin only]
👥 কাস্টমার             (Customers)
🏭 সরবরাহকারী          (Suppliers)  [Admin only]
💰 পেমেন্ট ও বাকি      (Payments)   [Admin only]
📈 লাভ-ক্ষতি রিপোর্ট  (Reports)    [Admin only]
💲 মূল্য তালিকা        (Price List)
💬 নোটিফিকেশন          (Notifications) [Admin only]
⚙️ সেটিংস              (Settings)   [Admin only]
```

### Color Scheme:
- Primary: Blue (#1A56DB)
- Success: Green (#16A34A)
- Warning: Amber (#D97706)
- Danger: Red (#DC2626)
- Background: Gray-50 (#F9FAFB)
- Card Background: White

### Typography:
- Use `font-family: 'Hind Siliguri', sans-serif` for Bangla text
- Import from Google Fonts
- English: Inter or system-ui

### Components (use shadcn/ui):
- All modals → `Dialog` component
- Tables → custom table with pagination
- Forms → `Form` + `Input` + `Select` + `Button`
- Toast notifications → `Sonner` or shadcn `Toast`
- Date pickers → shadcn `Calendar` + `Popover`
- Charts → Recharts wrapped in shadcn Card

### Responsive Rules:
- Sidebar collapses to hamburger on mobile
- Tables scroll horizontally on small screens
- Cards stack vertically on mobile
- Invoice/PDF pages: desktop-optimized (A4 layout)

---

## 🔢 BUSINESS LOGIC — CRITICAL RULES

### Order Numbers:
- Format: `ORD-YYYY-NNNN` (e.g. ORD-2025-0001)
- Auto-increment per year, reset each year
- Generate in frontend before insert, or use a Supabase function

### Invoice Numbers:
- Format: `INV-YYYY-NNNN`
- One invoice per order (1:1 relationship)

### Purchase Numbers:
- Format: `PUR-YYYY-NNNN`

### Payment Numbers:
- Format: `PAY-YYYY-NNNN`

### Stock Rules:
- Never allow stock to go below 0 — show validation error
- When placing order: check stock availability before submit
- If stock < quantity ordered: show warning modal, block submit

### Due Calculation:
- Order due = Total Amount - Paid Amount
- Customer total_due = SUM of all order dues - SUM of all payments received
- Supplier total_due = SUM of all purchase dues - SUM of payments made to supplier

### Profit Calculation:
- Gross Profit = Total Revenue - Total Purchase Cost
- Revenue = SUM(orders.total_amount) WHERE status != 'cancelled'
- Purchase Cost = SUM(purchases.total_amount) WHERE status = 'received'
- Profit Margin % = (Gross Profit / Revenue) × 100

---

## 🗂️ FOLDER STRUCTURE (Next.js App Router)

```
/app
  /login                    → Login page
  /dashboard                → Dashboard
  /orders
    /page.tsx               → Order list
    /new/page.tsx           → New order form
    /[id]/page.tsx          → Order detail
    /[id]/invoice/page.tsx  → Invoice view
  /stock
    /page.tsx               → Stock list
    /[id]/history/page.tsx  → Stock history
  /purchases
    /page.tsx               → Purchase list
    /new/page.tsx           → New purchase
    /[id]/page.tsx          → Purchase detail
  /customers
    /page.tsx               → Customer list
    /new/page.tsx           → Add customer
    /[id]/page.tsx          → Customer profile
  /suppliers
    /page.tsx               → Supplier list
    /[id]/page.tsx          → Supplier profile
  /payments/page.tsx        → Payment & due tracking
  /reports
    /daily/page.tsx
    /monthly/page.tsx
    /yearly/page.tsx
    /products/page.tsx
  /price-list/page.tsx      → Price list
  /notifications/page.tsx   → WhatsApp notifications
  /settings
    /page.tsx               → System settings
    /users/page.tsx         → User management

/components
  /layout
    Sidebar.tsx
    Header.tsx
    Layout.tsx
  /ui                       → shadcn/ui components
  /orders
    OrderForm.tsx
    OrderTable.tsx
    InvoicePDF.tsx
  /customers
    CustomerSelector.tsx
    PaymentModal.tsx
    LedgerTable.tsx
  /stock
    StockTable.tsx
    StockAdjustModal.tsx
  /dashboard
    SummaryCards.tsx
    RevenueChart.tsx
    LowStockAlert.tsx
  /notifications
    WhatsAppSender.tsx
    TemplateEditor.tsx

/lib
  supabase.ts               → Supabase client
  supabase-server.ts        → Server-side Supabase client
  utils.ts                  → Formatters, helpers
  whatsapp.ts               → WhatsApp API wrapper

/hooks
  useAuth.ts
  useOrders.ts
  useCustomers.ts
  useStock.ts
  useReports.ts

/types
  index.ts                  → All TypeScript types matching DB schema
```

---

## 🚀 DEVELOPMENT ORDER — BUILD IN THIS SEQUENCE

```
Phase 1 — Foundation (Week 1-3)
  ✅ Step 1: Supabase project setup, run schema SQL
  ✅ Step 2: Next.js project init with Tailwind + shadcn/ui
  ✅ Step 3: Supabase Auth integration + login page
  ✅ Step 4: Sidebar layout + role-based route protection
  ✅ Step 5: Dashboard page (static first, then live data)
  ✅ Step 6: Product Price List page (simplest data display)

Phase 2 — Core ERP (Week 4-7)
  ✅ Step 7:  Customer list + add customer
  ✅ Step 8:  New Order form (most complex — take time)
  ✅ Step 9:  Order list + status management
  ✅ Step 10: Invoice PDF generation + download
  ✅ Step 11: Stock list page + low stock view
  ✅ Step 12: Manual stock adjustment modal

Phase 3 — Finance (Week 8-10)
  ✅ Step 13: Customer profile + order history tab
  ✅ Step 14: Customer ledger + receive payment modal
  ✅ Step 15: Purchase form + purchase list
  ✅ Step 16: Supplier management
  ✅ Step 17: Payment & Due tracking page
  ✅ Step 18: Daily / Monthly / Yearly P&L reports

Phase 4 — Notifications (Week 11-12)
  ✅ Step 19: WhatsApp API integration
  ✅ Step 20: Send invoice via WhatsApp
  ✅ Step 21: Due reminder from customer page
  ✅ Step 22: Template management page
  ✅ Step 23: Notification history log

Phase 5 — Polish (Week 13-14)
  ✅ Step 24: User management (Admin creates Staff)
  ✅ Step 25: System settings page
  ✅ Step 26: Export all reports to PDF & Excel
  ✅ Step 27: Mobile responsiveness audit
  ✅ Step 28: Performance optimization + error handling
  ✅ Step 29: Final testing + deployment to Vercel
```

---

## ⚠️ CRITICAL REQUIREMENTS — NEVER SKIP THESE

1. **All money values** must display with `৳` symbol and 2 decimal places
2. **All dates** must display in `DD MMM YYYY` format in Bangla-friendly style
3. **Stock can never go below 0** — enforce in frontend validation AND DB constraint
4. **Every order must generate an invoice** — no order without invoice
5. **Role-based access** must be enforced on EVERY page and API call — not just UI hiding
6. **All WhatsApp messages** must be logged in `notification_logs` (even if failed)
7. **Invoice PDF** must include: company name, logo placeholder, customer info, itemized list, totals, due amount, payment method
8. **Pagination** on all list pages — default 20 rows per page
9. **Loading states** on all data-fetching operations
10. **Error handling** — show user-friendly Bangla error messages
11. **Confirm dialogs** before: Cancel Order, Delete anything, Mark as Delivered
12. **Auto-save draft** for new order form (localStorage) so data isn't lost on refresh

---

## 💡 HOW TO USE THIS PROMPT WITH AI TOOLS

### With Claude or ChatGPT:
```
Paste this entire document at the start of a new session, then say:

"Start with Phase 1, Step 3: Build the Supabase Auth integration 
and login page for the FCF ERP. Follow all UI rules and use the 
tech stack specified."

Then continue step by step.
```

### With Cursor IDE:
```
1. Add this file as `GUIDELINES.md` in your project root
2. In Cursor chat: "@GUIDELINES.md Build the new order form from Module 3A"
3. Cursor will reference the file automatically
```

### With v0.dev (Vercel):
```
Paste Module 2 (Dashboard) requirements into v0 prompt to generate 
the initial UI, then paste into your Next.js project and connect to Supabase.
```

---

## 📌 QUICK REFERENCE — SUPABASE TABLE NAMES

```typescript
// Use these exact names in all Supabase queries:
'profiles'             // users
'product_categories'   // Standard, Kidz
'products'             // all 13 FCF products
'customers'            // buyer profiles
'suppliers'            // seller/vendor profiles
'orders'               // sale orders
'order_items'          // order line items
'invoices'             // auto-generated invoices
'payments'             // customer payments received
'purchases'            // stock purchase from suppliers
'purchase_items'       // purchase line items
'supplier_payments'    // payments made to suppliers
'stock_movements'      // stock audit log
'notification_logs'    // WhatsApp/SMS history
'notification_templates' // message templates
'settings'             // system config

// Views (read-only, use for reports):
'vw_today_summary'
'vw_low_stock'
'vw_monthly_pl'
'vw_customer_ledger'
'vw_overdue_customers'
'vw_price_list'
```

---

*End of FCF Stationery House ERP Developer Guideline Prompt v1.0*
*Total Modules: 13 | Total Pages: 30+ | Estimated Build Time: 14 Weeks*
