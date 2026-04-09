# GearItUp — AutoSpace ⚙️

> **The OS for India's Auto Parts Industry.**  
> A hyper-modern B2B2C SaaS platform bridging the gap between traditional auto part retailers (ERP/POS) and the digital consumer market (Marketplace).

[![Version](https://img.shields.io/badge/version-2.1.0-amber.svg)](https://github.com/shivakumar-07/GearItUp_Exp)
[![Tech](https://img.shields.io/badge/Tech-React%2019%20%2B%20Vite%20%2B%20Node.js-blue.svg)](https://vitejs.dev/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20(Supabase)-emerald.svg)](https://supabase.com/)

---

## 🌟 The Core Value Proposition

AutoSpace is designed for the 98% of Indian auto parts retailers who still rely on manual registers or outdated offline software. 

1.  **For Shop Owners**: A lightning-fast, keyboard-driven ERP that handles multi-item GST billing, instant stock tracking, party ledgers (Udhaar), and staff management.
2.  **For Customers**: A hyperlocal marketplace to find parts with a **Fitment Guarantee** based on their specific vehicle (Make → Model → Year → Variant).
3.  **For Workshops**: A dedicated job-card system with Kanban-based workflow tracking, checklists, and automated WhatsApp invoicing.

---

## 🛡️ Key Modules & Capabilities

### 🏢 1. ERP & POS (Retail Intelligence)
*   **Keyboard-First POS**: Bulletproof billing with `Ctrl+K` command palette, `Ctrl+N` new bill, and barcode scanner integration (`Ctrl+B`).
*   **Smart Inventory**: Detailed stock tracking with reorder alerts (shimmering UI indicators), bulk stock-in via master catalog search, and dead stock analysis.
*   **Audit & Ledger**: Immutable transaction ledgers for every movement (Sale, Purchase, Return, Damage, Theft, Audit).
*   **Party Management**: Digital *Khata* book with aging analysis (Green to Red buckets) and automated WhatsApp payment reminders for Udhaar.
*   **One-Click GST**: Automated CGST/SGST/IGST calculation, GSTR-1 JSON export (Portal ready), and GSTR-3B worksheets.

### 🔧 2. Workshop Management
*   **Visual Job Cards**: Kanban-based workflow (Draft → Diagnosed → In Progress → Waiting Parts → Ready → Invoiced).
*   **Time Tracking**: Real-time elapsed time monitoring for active jobs.
*   **Service Checklists**: Standardized inspection and repair tasks to ensure quality control.
*   **Integrated Billing**: Convert completed job cards directly into POS invoices with parts & labour breakdown.

### 🌐 3. B2C Marketplace
*   **Fitment Engine**: Search parts by OEM Number or Vehicle Fitment (Maruti, Hyundai, Tata, etc.).
*   **Multi-Vendor Cart**: Shop from multiple local stores in a single checkout flow.
*   **Reviews & Trust**: Verified purchase reviews with star ratings and helpfulness counts.
*   **Real-Time Tracking**: Live order status updates (Placed → Accepted → Out for Delivery → Delivered).

---

## 🛠️ Technology Stack

| Layer | Recommended | Why |
| :--- | :--- | :--- |
| **Frontend** | React 19 + Vite | State-of-the-art performance, tiny bundle size, and ultra-fast HMR. |
| **Backend** | Node.js + Express | Unified JS ecosystem. High concurrency for API requests. |
| **Database** | PostgreSQL (Supabase) | Strict ACID compliance for financial integrity & relational fitment data. |
| **ORM** | Prisma | Type-safe queries and automated schema migrations. |
| **Auth** | Firebase + JWT | Phone OTP (primary) + Google login with sliding JWT session rotation. |
| **Styling** | Vanilla CSS + Tokens | Zero runtime overhead. Custom design system with "Outfit" & "JetBrains Mono" fonts. |
| **Notifications** | Resend + WhatsApp | Transactional emails and Business API integration (WATI/Interakt). |

---

## 📂 Project Structure

```
├── src/                        # React frontend (Vite)
│   ├── pages/                  # Core modules (Dashboard, Inventory, Workshop, etc.)
│   ├── components/             # Reusable UI system (Btn, Input, Modal, StatCard)
│   ├── marketplace/            # Independent B2C Storefront sub-app
│   ├── api/                    # Networking (Axios client + background Sync engine)
│   ├── theme.js                # Semantic design system (Colors, FONT, Global CSS)
│   └── store.js                # Global state persistence & Business logic
│
├── backend/                    # Node.js Express server
│   ├── prisma/                 # Schema & Migrations (PostgreSQL)
│   ├── src/
│   │   ├── routes/             # Feature-based API (Auth, Catalog, Billing, Staff)
│   │   └── services/           # Business logic (Email, Firebase, OTP, PDF Gen)
│   └── scripts/                # Database maintenance & migration tools
│
└── 📜 AutoMobile_DevGuide.md    # 90KB technical blueprint & roadmap
```

---

## 📘 Engineering Documentation

For future developers and team onboarding, use these docs as the source of truth:

- `docs/DEVELOPER_HANDBOOK.md` — architecture, module map, data model, and end-to-end flow diagrams
- `docs/MVP_AND_FEATURE_ROADMAP.md` — MVP completion plan and gradual feature integration strategy
- `docs/DATA_TABLE_PURPOSE_AND_CONNECTIONS.md` — table-by-table purpose, column definitions, and relationship rationale

---

## 🚀 Getting Started

### 1. Prerequisites
*   Node.js (v18+)
*   A Supabase project (for PostgreSQL)
*   A Firebase project (for Auth)

### 2. Setup Environment
Clone the repo and create `.env` files:

```bash
# Root .env (Frontend)
VITE_FIREBASE_API_KEY=your_key
VITE_API_URL=http://localhost:3001

# backend/.env (Backend)
DATABASE_URL="postgres://..."
DIRECT_URL="postgres://..."
JWT_SECRET="your_secret"
FIREBASE_PROJECT_ID="..."
RESEND_API_KEY="..."
```

### 3. Install & Start
```bash
# Install everything
npm install
cd backend && npm install && cd ..

# Run Backend
cd backend
npm run dev

# Run Frontend (New Terminal)
npm run dev
```

---

## 🚀 Production Deployment (Render + Vercel)

### 1. Deploy Backend on Render

This repo now includes [render.yaml](render.yaml) for a one-service backend blueprint.

1. In Render Dashboard, create a new **Blueprint** from this repository.
2. Select the `autospace-backend` service.
3. Fill required env vars from [backend/.env.example](backend/.env.example).
4. Deploy and note your live backend URL, for example:

```text
https://autospace-backend.onrender.com
```

### 2. First Live Backend Smoke Check

Run the authenticated write-flow smoke test against the Render URL:

```bash
SMOKE_BASE_URL="https://your-backend.onrender.com" \
SMOKE_FIREBASE_TOKEN="<real-firebase-id-token-or-dev-token>" \
npm run smoke:api
```

What it verifies end-to-end:
- Auth via `/api/auth/firebase`
- Inventory write via `/api/shop/inventory/purchase`
- POS write via `/api/billing/invoice`
- Inventory adjustment via `/api/shop/inventory/adjust`

### 3. Wire Frontend Env in Vercel

Set frontend API base URL to your Render backend for both Preview and Production:

```bash
echo "https://your-backend.onrender.com" | vercel env add VITE_API_URL production
echo "https://your-backend.onrender.com" | vercel env add VITE_API_URL preview
```

If this is a new Vercel project:

```bash
vercel project add autospace-mvp
```

Deploy:

```bash
npm run deploy:vercel:prod
```

### 4. Frontend Live Smoke Check

1. Open the production URL from Vercel output.
2. Login and complete one POS invoice.
3. Confirm stock is decremented in Inventory page.
4. Confirm sale appears in Reports/Dashboard metrics.

---

## 🏛️ API Quick Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/request-otp` | Request Phone OTP (Rate limited) |
| `POST` | `/api/billing/invoice` | Generate GST Invoice & deduct stock |
| `GET` | `/api/catalog/search` | Master catalog search with fitment filters |
| `GET` | `/api/shop/inventory` | Get shop inventory with recent movements |
| `GET` | `/api/shop/staff` | List staff members and permissions |
| `POST` | `/api/marketplace/orders` | Create marketplace order(s), grouped by shop |
| `GET` | `/api/shop/dashboard` | KPI metrics for shop owner dashboard |

---

## 📅 Roadmap: Three-Phase Vision

*   **Phase 1 (Pilot)**: Prototype to real-world use with 10 shops in Hyderabad. (Current Status: ✅ **90% Complete**)
*   **Phase 2 (Scale)**: Delivery partner integration (Dunzo/Porter), Advanced GST filing, and Shop Mobile App.
*   **Phase 3 (Expansion)**: Multi-city launch, OEM cross-reference engine, and AI-powered reorder suggestions.

---

## ⚖️ License & Contributions

Proprietary Software — Developed by [Shiva Kumar](https://github.com/shivakumar-07). Internal use and authorized partners only.

---
*Built with ❤️ for the Indian Auto Parts Market.*
