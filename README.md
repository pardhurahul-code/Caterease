# CaterEase – AI-Powered Catering Service Management System

**Tagline:** *Smart Catering. Seamless Celebrations.*

CaterEase is a full-stack production-grade Catering Service Management System built with **React 19 + Vite + TypeScript + Tailwind CSS v4**, **Node.js + Express**, **PostgreSQL (Cloud SQL / Neon compatible via Drizzle ORM + `pg`)**, **Firebase Authentication + JWT/bcryptjs RBAC**, **Google Gemini AI (`@google/genai`)**, **PDFKit**, **QRCode**, **Recharts**, and **Razorpay / Demo Payment Mode**.

---

## 1. Demo Account Credentials

| Role | Email | Password | Portal Route |
| :--- | :--- | :--- | :--- |
| **Customer** | `customer@caterease.com` | `Customer@123` | `/dashboard/customer` |
| **Admin** | `admin@caterease.com` | `Admin@123` | `/dashboard/admin` |
| **Staff** | `staff@caterease.com` | `Staff@123` | `/dashboard/staff` |

*Demo Coupon Codes:* `CELEBRATE15` (15% off), `WELCOME500` (₹500 off), `CORPORATE10` (10% off), `FESTIVE20` (20% off).

---

## 2. System Architecture

```text
Frontend (React 19 + Vite + Tailwind v4 + Recharts + Framer Motion)
   │  REST over Axios (/api/*) + Bearer Token (JWT or Firebase ID Token)
   ▼
Backend (Express.js on Port 3000 + Helmet + CORS + Rate Limiter + Zod)
   ├── /api/auth        → bcryptjs + JWT + Firebase Admin Google Sync + Password Reset
   ├── /api/catalog     → Food Categories, Food Items, Packages, Services
   ├── /api/bookings    → Server-recalculated pricing, Conflict Checks, Workflow, QR Verify
   ├── /api/payments    → Razorpay Live / Demo Payment Mode, Refunds, PDFKit Invoices
   ├── /api/inventory   → Suppliers, Stock-In/Out/Adjustment Transactions, Expiry Alerts
   ├── /api/analytics   → 8 Admin KPIs + 7 Recharts Telemetry Series + CSV Export
   └── /api/ai          → Server-only @google/genai (Quantity, Menu, Budget, Chat, Reviews, Event)
   │
   ▼
PostgreSQL Database (25 Normalized Relational Tables via Drizzle ORM)
```

---

## 3. Database Schema (25 Tables)

Defined in `src/db/schema.ts` and exported as standalone SQL in `database/schema.sql` & `database/seed.sql`:

1. `users` (RBAC identity, bcrypt hash, Firebase UID, reset tokens)
2. `customers` (profile, city, address, loyalty points)
3. `customer_preferences` (dietary, cuisine, spice, budget tier)
4. `staff` (staff code, title, specialization, shift schedule)
5. `admins` (department, privilege scope)
6. `catering_services` (service tiers)
7. `food_categories` (Breakfast, Lunch, Dinner, Snacks, Desserts, Beverages)
8. `food_items` (pricing, Veg/Non-Veg/Vegan/Jain, GF, allergens, calories)
9. `catering_packages` (per-guest pricing, min/max guests, included courses)
10. `bookings` (event metadata, server pricing totals, coupon, QR token, status)
11. `booking_details` (itemized quantities and locked unit prices)
12. `booking_timeline` (immutable audit trail of status transitions)
13. `events` (operational event schedule + lead staff reference)
14. `payments` (transaction ID, method, Razorpay IDs, demo flag, refund tracking)
15. `invoices` (billing breakdowns linked to bookings and payments)
16. `coupons` (percentage/fixed rules, validity dates, usage limits)
17. `suppliers` (vendor contacts and ratings)
18. `inventory` (stock levels, minimum thresholds, expiry tracking)
19. `stock_transactions` (`STOCK_IN`, `STOCK_OUT`, `ADJUSTMENT` audit log)
20. `staff_assignments` (event assignments + prep/delivery status)
21. `reviews` (customer ratings on completed events + sentiment tags)
22. `notifications` (in-app notifications + optional Nodemailer dispatch)
23. `support_tickets` (customer inquiries + priority + workflow status)
24. `support_messages` (threaded replies between Customer and Admin)
25. `newsletter_subscribers` & `business_settings` (newsletter emails & global configuration)

---

## 4. Core Features & Modules

- **Public Storefront (`/`, `/menu`, `/packages`, `/ai`)**:
  - Dietary & category filtering (`Veg`, `Non-Veg`, `Vegan`, `Jain`, `Gluten-Free`), ingredient/allergen inspection, and persistent shopping cart.
  - **CaterEase AI Suite (7 Gemini Features)**:
    1. Food Quantity Estimator
    2. AI Menu Recommendation (grounded in live PostgreSQL catalog)
    3. AI Budget Planner (authoritative backend pricing + Gemini cost-saving tips)
    4. AI Catering Concierge Chatbot (grounded in live packages, coupons, and user bookings)
    5. Admin AI Review Sentiment & Insights
    6. Personalized Food Recommendations
    7. AI Event Timeline & Staffing Planner
- **Customer Portal (`/dashboard/customer`, `/checkout`, `/verify/:token`)**:
  - Full event booking & checkout with coupon validation, backend price recalculation, schedule conflict checks, **Demo Payment Mode** (with optional failure simulation) / **Razorpay Live**, **PDFKit Invoice download**, **QR Code Verification Pass**, booking editing/cancellation, completed-event reviews, and support tickets.
- **Admin Operations Console (`/dashboard/admin`)**:
  - 8 KPIs, low-stock banners, CSV report export, **7 interactive Recharts analytics visualizations**, Booking confirmation & Staff Assignment, Menu/Categories/Packages CRUD, Inventory Stock-In/Out/Adjustment & Suppliers CRUD, Payments/Refunds & Coupons CRUD, Customer/Staff roster, Review moderation + AI Sentiment Analysis, Support Tickets, and Broadcast Notifications.
- **Staff Kitchen & Service Portal (`/dashboard/staff`)**:
  - Assigned events list, food prep checklists, dietary notes, prep & delivery status controls, and stage advancement (`Preparing` → `Ready for Delivery` → `Event in Progress` → `Completed`).

---

## 5. Local Development Setup (Windows 10/11 VS Code + PowerShell / macOS / Linux)

### Prerequisites
- Node.js `v20+`
- PostgreSQL `15+` (or Neon PostgreSQL connection)
- Google Gemini API key (`GEMINI_API_KEY`)

### Setup Steps
1. **Install dependencies**:
   ```powershell
   npm install
   ```
2. **Configure environment variables**:
   Copy `.env.example` to `.env` and populate your PostgreSQL credentials (`SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`) along with `GEMINI_API_KEY` and `JWT_SECRET`.
3. **Create & seed the local PostgreSQL database**:
   ```powershell
   psql -U postgres -c "CREATE DATABASE caterease;"
   psql -U postgres -d caterease -f database/schema.sql
   psql -U postgres -d caterease -f database/seed.sql
   ```
4. **Run unit tests**:
   ```powershell
   npx tsx --test src/utils/pricing.test.ts src/utils/bookingWorkflow.test.ts src/utils/inventoryLogic.test.ts
   ```
5. **Start the full-stack server (Port 3000)**:
   ```powershell
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

---

## 6. Troubleshooting

- **AI features return "Gemini API key is missing"**: Add a valid `GEMINI_API_KEY` in `.env` (or AI Studio Secrets) and restart the server. Core catalog, booking, payment, and inventory modules continue working normally without it.
- **Payment mode**: When `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are omitted, checkout operates in **DEMO PAYMENT MODE** for safe end-to-end testing without real charges.
- **SMTP emails**: If `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` are omitted, notifications are recorded in PostgreSQL and logged gracefully without failing requests.
