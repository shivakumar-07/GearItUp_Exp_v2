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

## 🏛️ API Quick Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/request-otp` | Request Phone OTP (Rate limited) |
| `POST` | `/api/billing/invoice` | Generate GST Invoice & deduct stock |
| `GET` | `/api/catalog/search` | Master catalog search with fitment filters |
| `GET` | `/api/shop/staff` | List staff members and permissions |
| `POST` | `/api/marketplace/order`| Create multi-vendor marketplace order |
| `GET` | `/api/dashboard/stats` | Pre-computed KPI metrics for shop owner |

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
