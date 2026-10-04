# CHANGELOG — Hotel Ekdant Hardening & Enterprise Architecture

All notable changes, architectural refactorings, security hardenings, and engineering assumptions are recorded here.

---

## [2.1.0] - 2026-10-04 (Dual Billing & Internal Management System)

### 🧾 1. Dual Billing System (Customer Bill vs. Internal Management Bill)
- **Separate Customer Bill:** Official customer-facing tax invoice receipt (thermal 80mm & A4 PDF) displaying restaurant header, GSTIN, FSSAI, item names, prices, GST tax breakdown, final payable, UPI QR code, and thank-you footer. Internal food costs, margins, and management notes are strictly excluded.
- **Internal Management Bill:** Separate management document clearly watermarked `INTERNAL COPY – NOT A CUSTOMER TAX INVOICE`. Features original customer bill amounts alongside item-wise preparation/raw material costs, gross profit calculations, margin percentages, authorized discounts, and internal adjustment audit notes.
- **Dual Printing Engine:** Built 3 printing pathways:
  1. *Print Customer Bill* (Thermal ESC/POS or A4 PDF)
  2. *Print Internal Bill* (Thermal 80mm management breakdown)
  3. *Print Both Bills* (Single-pass sequenced thermal print job separating both bills cleanly via `@page` break-after without creating duplicate database orders or invoice transactions).

### 🔒 2. Role-Based Access Control (RBAC) & Backend Enforcement
- **Backend Permissions:**
  - `owner` & `manager`: Full access to internal billing data, preparation costs, profit dashboards, and authorized post-bill adjustments.
  - `cashier` & `waiter`: Can only view and print customer bills. All internal billing endpoints (`/api/invoices/<id>/internal`, `/api/invoices/<id>/adjustment`, `/api/invoices/<id>/internal-receipt/html`, `/api/invoices/<id>/both-receipts/html`, `/api/reports/internal-financial`) return `403 Forbidden` if accessed by non-management roles.
- **Menu Preparation Cost Visibility:** `GET /api/menu` only includes `preparation_cost` when requested by authenticated `owner` or `manager`. Public customers and waitstaff never see COGS figures.

### 📊 3. Internal Financial & P&L Dashboard
- **Management Tab in Admin Suite:** Added `Financial & P&L` tab in the Owner/Manager admin suite with real-time financial reporting:
  - Total Revenue vs. Aggregated Food Preparation Costs
  - Gross Profit in rupees and percentage margins
  - Post-adjustment Net Profit
  - Tax liabilities (CGST, SGST) and discounts authorized
  - Payment channel breakdown (Cash, UPI, Card)
  - Period filters: Today, Past 7 Days, This Month, This Year
- **Invoice & Adjustment Inspector:** Detailed view of any historical invoice with itemized profit breakdown, live print history audit logs, and an authorized adjustment/remark creator.

### 📝 4. Audit Trail & Adjustments
- **Immutable Adjustments:** Created `InternalBillNote` model for appending remarks, authorized adjustments, refunds, and ledger corrections without modifying the original customer tax invoice.
- **Print History Tracking:** Created `PrintHistory` model logging print type, user ID, IP address, and timestamp to prevent duplicate billing accidents and track cashier activity.

---

## [2.0.0] - 2026-10-04 (Master Hardening Release)

### 🔐 1. Security & Authentication
- **Deleted Backdoor Passwords:** Permanently wiped hardcoded dev passwords (`ekdant123`, `admin123`, `hotel123`).
- **Cryptographic JWT Sessions:** Replaced plain client state with signed 12-hour JWT tokens containing user ID and normalized role.
- **Route Guards & Decorators:** Built `@require_auth` and `@require_role('owner', 'manager', 'cashier', 'waiter', 'chef')`.
- **Prevented Customer Data Leaks:** Closed open `GET /api/orders` list to customers. Customer order status is accessed strictly via signed `order_token` or staff JWT.
- **Secure Table QR Tokens:** Table URL format updated to `/?t=<qr_code_token>`. Public verification issues a short-lived signed 4-hour `table_session_token`.
- **Server-Side Price Validation:** `POST /api/orders` ignores all client-sent prices, resolving catalog prices directly from DB.
- **DPDP Act Notice:** Added statutory privacy consent notice under phone numbers across all checkout forms.

### 💰 2. Integer Paise & Financial Compliance
- **Paise Precision:** All money columns stored as integers in **paise** (1 INR = 100 paise), eliminating floating-point rounding drifts.
- **Standard Indian Restaurant GST Math:** Taxable calculation strictly on post-discount amount, rounding taxes to nearest rupee and calculating `round_off_paise`.
- **Financial Year Invoice Numbering:** Concurrency-safe sequential invoice numbers (`EK/26-27/000123`) using database atomic counter rows.
- **Credit Notes:** Paid invoice cancellations issue an immutable Credit Note (`CN/26-27/000001`) rather than deleting financial records.
- **Thermal & A4 Invoices:** ReportLab PDF and 80mm thermal receipts include UPI QR codes (`upi://pay`), HSN/SAC `9963`, and GST breakdowns.

### 🍽️ 3. Sessions, Tables & Lifecycle
- **Unified TableSession Model:** Multiple orders from a single customer sitting attach to one `TableSession`, billed in a single invoice.
- **Dynamic Table Status:** Derived from active session status rather than manual toggling.
- **Session Operations:** Full session shifting and merging across dining tables.
- **Item-Level Status:** Kitchen screens can mark individual items READY, deriving order status automatically.

### 🖥️ 4. Modular Frontend & React Router
- **React Router Integration:** Migrated from state-machine routing to React Router DOM with protected route guards.
- **Component Decomposition:** Broken down monolithic files into small feature modules (`features/orders`, `features/billing`, `features/tables`, `features/menu`, `features/inventory`, `features/staff`, `features/reviews`, `features/settings`, `features/reports`).
- **Replaced `prompt()` / `alert()`:** Clean accessible custom modals used for all interactions.
- **Waiter Manual Order Taking:** Staff can enter orders for phone-less walk-ins and takeaway parcels.
- **Bilingual i18n:** Marathi / English localization toggle with persistent state.

### 🐳 5. Deployment & Infrastructure
- **Hardened Dockerfile:** Multi-stage build (Node 20 Alpine -> Python 3.11 Slim), running as unprivileged `ekdantuser` with `/healthz` check and Gunicorn.
- **Database Support:** Seamless PostgreSQL compatibility with SQLite dev fallback.
- **Zero Polling Spam:** Eliminated 3s polling, utilizing authenticated WebSockets with a 25s fallback heartbeat.
- **CI & Automated Tests:** 14 backend Pytest tests, Vitest frontend tests, and GitHub Actions CI workflow.

---

## 📌 Engineering Assumptions Made
1. **Financial Year Cutoff:** Computed using Indian financial year calendar (April 1 to March 31).
2. **Cashier Discount Limit:** Defaulted to ₹100 (10,000 paise) unless altered by Owner in Settings.
3. **Dining Session Window:** Table sessions auto-expire after 4 hours of inactivity or upon invoice settlement.
4. **Dev QR Token Fallback:** The legacy `?table=` parameter remains active in development mode for easy testing.
