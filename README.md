# Hotel Ekdant Family Restaurant — Restaurant Management Platform

A complete, production-ready, full-stack restaurant management system and QR-based digital ordering ecosystem built for **Hotel Ekdant Family Restaurant (AC & Non-AC)**.

---

## 🌟 Ecosystem Architecture

1. **Customer QR Ordering Website** (`/menu?table=05`)
   - Scans QR stand at any of the 11 tables.
   - Automatically detects table number with zero cross-table ordering risk.
   - Clean Indian hospitality design with Deep Maroon (`#641C24`), Warm Ivory (`#FFF9F0`), and Champagne Gold (`#C49A52`).
   - Veg & Non-Veg indicators (FSSAI green circle & red triangle compliant).
   - Strict religious branding compliance (devotional Ganesha motifs on welcome & header, 100% neutral food-focused Non-Veg section).
   - Cart, custom spice level selection, add-ons, kitchen notes, and real-time tracking.
   - Table waiter calling & fresh water assistance.

2. **Table Booking & Reservation System**
   - Direct online reservation for AC Hall (Tables 01-05) and Non-AC Family Hall (Tables 06-11).
   - WhatsApp confirmation deep-linking to manager's official WhatsApp.
   - Reference code tracking and admin acceptance/rejection workflow.

3. **Live Restaurant Order Management Dashboard** (`/staff`)
   - Web Audio synthesizer notification bell with toggle & volume.
   - Multi-stage order workflow: Received → Accepted → Preparing → Ready → Served → Completed.
   - Real-time Socket.IO broadcasts and 11-table visual occupancy grid.
   - One-click GST billing and printable invoice generator.

4. **Kitchen Display System (KDS)** (`/kitchen`)
   - High-contrast, distance-readable dark interface for head chefs and cooks.
   - Food tickets showing table number, dish quantity, spice preferences, addons, and preparation elapsed time.
   - Immediate "Start Preparing" and "Mark Ready to Serve" controls.

5. **Owner & Manager Admin Suite** (`/admin`)
   - Live revenue analytics, daily order counts, and AOV.
   - Menu catalog manager: Add/Edit dishes, change prices, descriptions, and diets.
   - 11 Table QR stand generator with download button for table printing.
   - Legal GSTIN and CGST/SGST tax settings.
   - Downloadable Excel sales reports (`.xlsx`).

6. **Automatic Billing & GST Tax Invoicing**
   - Sequential GST invoices (`INV-EKD-YYYYMMDD-XXX`).
   - Computes CGST (2.5%) + SGST (2.5%) for 5% restaurant GST.
   - Downloadable A4 PDF invoices and 80mm thermal receipt formats via ReportLab.

---

## 🚀 Running the Project

### Prerequisites
- Python 3.9+
- Node.js 18+ & npm

### Backend Setup (Flask + SQLite/PostgreSQL + SocketIO)
```bash
# In the project root:
source venv/bin/activate
cd backend
python app/main.py
```
Backend runs on `http://127.0.0.1:5001`.

### Frontend Setup (React 19 + TypeScript + Vite + Tailwind CSS)
```bash
cd frontend
npm run dev
```
Frontend runs on `http://localhost:3000`.

---

## 🔑 Default Staff & Demo Accounts

| Role | Username | Password |
|---|---|---|
| **Proprietor / Owner** | `owner` | `ekdant123` |
| **Restaurant Manager** | `manager` | `ekdant123` |
| **Lead Waiter** | `waiter` | `ekdant123` |
| **Head Chef** | `chef1` | `ekdant123` |
| **Kitchen Cook** | `cook1` | `ekdant123` |

---

## 📍 Direct Links
- **Table 05 QR Menu**: `http://localhost:3000/?table=05`
- **Table Booking**: `http://localhost:3000/` (click "Book a Table")
- **Staff Order Desk**: Click "Staff Login" at the top-right of the screen
- **Kitchen KDS**: Accessible via Staff Desk top navigation
- **Admin Suite**: Accessible via Staff Desk top navigation when signed in as Manager or Owner
