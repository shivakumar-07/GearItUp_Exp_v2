================================================================================
  AUTOPARTS PLATFORM — COMPLETE DEVELOPMENT GUIDE
  Next Steps, Feature Modifications & High-Level Architecture
  From Prototype to Production-Ready Product
================================================================================

  Document Type   :  Working Blueprint for AI & Human Development Teams
  Version         :  1.0 — June 2025
  Phases Covered  :  Phase 1 through Phase 3
  Status          :  READY TO EXECUTE
  Prepared for    :  Full-Stack Developers, AI Agents, and Technical Leads

--------------------------------------------------------------------------------
  HOW TO READ THIS DOCUMENT
--------------------------------------------------------------------------------

This document is written specifically for the current situation:

  - There is a working React prototype already built
  - The seed data comes from an uncle's OEM catalogue (a 30-year auto parts shop)
  - The target launch city is Hyderabad
  - The team is small (2–3 developers, or a solo developer)

Every section is actionable. Read it from start to finish once, then use each
section as a checklist during execution. The document is organized in the exact
order work should be done. Do not skip phases or reorder steps.

================================================================================
  TABLE OF CONTENTS
================================================================================

  Section 1   —  Current State Audit (What Exists vs. What Is Missing)
  Section 2   —  Three-Phase Roadmap
  Section 3   —  Feature Modifications (What to Change, Keep, or Remove)
  Section 4   —  Backend Architecture (Complete Technical Specification)
  Section 5   —  Uncle's OEM Data (How to Capture and Use It)
  Section 6   —  Week-by-Week Execution Plan (Weeks 1–10)
  Section 7   —  What to Remove or Postpone
  Section 8   —  Success Metrics per Phase
  Section 9   —  Immediate To-Do List (Next 7 Days)
  Section 10  —  Team Structure and Monthly Cost Estimate
  Section 11  —  High-Level Architecture (Added for Development Team)

================================================================================
  SECTION 1 — CURRENT STATE AUDIT
  What the Prototype Has and What It Lacks
================================================================================

Before writing a single line of new code or making any changes, there must be a
crystal-clear picture of what already exists versus what is missing. Every
decision in this document flows from this audit.


1.1  WHAT THE PROTOTYPE GETS RIGHT
------------------------------------
These are production-grade decisions. Do NOT change them.

  [+]  Dual-product architecture — ERP and Marketplace coexisting in one system
       This is the core differentiator. Keep it exactly as is.

  [+]  State management pattern using React Context with localStorage
       Correct for a prototype. Maps cleanly to a real backend.

  [+]  Theme system (theme.js with color tokens and typography)
       Outfit font for UI, JetBrains Mono for financial figures.
       This is production quality. Keep it exactly as is.

  [+]  Two-layer data concept — Master Catalog vs. Shop Inventory
       Already embedded in the data model even if not formally separated
       in a database yet. The architecture thinking is correct.

  [+]  Vehicle compatibility logic in vehicleData.js
       Make → Model → Year hierarchy is the correct structure for
       fitment-based search.

  [+]  GST logic — HSN codes, correct rate assignment, CGST + SGST split
       Already implemented correctly in the seed data.

  [+]  Immutable transaction ledger concept
       Stock derived from transactions, not manually set.
       This is the right accounting principle.

  [+]  Barcode generation in barcode.js using SVG output
       Practical and correct for the target hardware environment.


1.2  CRITICAL GAPS — WHAT MUST BE BUILT
-----------------------------------------

  GAP AREA               CURRENT STATE                 WHAT IS NEEDED
  --------------------   ---------------------------   ---------------------------------
  Authentication         No login system. All shops    Per-shop JWT-based login. Each
                         share one state.              shop sees only their own data.

  Backend / API          No server. Everything is      Node.js + Express REST API or
                         client-side JavaScript.       Next.js API routes connecting
                                                       to PostgreSQL.

  Real Database          localStorage in the browser.  PostgreSQL with proper schema,
                         Clears if user clears         indexes, and foreign key
                         browser data.                 constraints.

  Master Catalog         Master product data mixed     Separate MASTER_PARTS table and
  Separation             with shop inventory in one    SHOP_INVENTORY table with FK
                         array.                        relationship.

  Multi-Shop Data        All 3 seed shops share one    Row-level security in database.
  Isolation              React state. Shop A can see   Each API call scoped to
                         Shop B's data.                authenticated shop.

  WhatsApp               Simulated. No actual message  WhatsApp Business API via Meta
  Integration            is sent.                      or third-party (Interakt/WATI).

  Payment Gateway        No real payment processing.   Razorpay integration for UPI,
                                                       cards, and marketplace settlement.

  Real-Time Inventory    Simulated with setTimeout     WebSocket or polling-based sync
  Sync                   delays.                       when marketplace order deducts
                                                       ERP stock.

  OEM Search with        OEM numbers exist in seed     A dedicated catalog search
  Uncle's Data           data but no real catalog      endpoint backed by real OEM data.
                         search.

  Image Upload           Emoji icons used as product   File upload to cloud storage
                         images.                       (AWS S3 or Cloudflare R2) with
                                                       CDN delivery.

  Delivery               No integration. Status        Dunzo / Porter API for hyperlocal
  Integration            manually updated.             delivery order creation and
                                                       tracking.

  GST Export             Mentioned in spec but not     Working GSTR-1 and GSTR-3B data
                         functional in prototype.      export as properly formatted
                                                       Excel files.

  Shop Onboarding        Hardcoded seed shops. No way  Full shop registration flow:
  Flow                   to register a new shop.       details, GST verification, bank
                                                       account, KYC.


================================================================================
  SECTION 2 — THE MASTER PLAN: THREE PHASES
================================================================================

Everything to be done fits into three distinct phases. Each phase has a clear
goal, a specific output, and a decision point before moving to the next phase.
Do NOT start Phase 2 until Phase 1 is complete and validated with real users.


PHASE 1 — PROTOTYPE TO PILOT (Make It Real)
Timeline: Weeks 1 to 10
---------------------------------------------------------------------------

Goals:
  - Build the real backend and database, replacing localStorage
  - Add authentication so each shop has a secure login
  - Properly separate Master Catalog from Shop Inventory at database level
  - Enter uncle's OEM numbers into the real catalog database
  - Onboard 5 to 10 real shops in Hyderabad and have them use it daily
  - Connect WhatsApp Business API for invoice sending
  - Integrate Razorpay for marketplace payments
  - Fix the 12 critical feature modifications listed in Section 3

Success Definition:
  5 real shops using the ERP daily AND 10 real customer orders on the
  marketplace.


PHASE 2 — PILOT TO CITY LAUNCH (Scale Within Hyderabad)
Timeline: Weeks 11 to 24
---------------------------------------------------------------------------

Goals:
  - Onboard 50 to 100 shops across Hyderabad
  - Launch marketplace publicly in Hyderabad — real customers, real orders
  - Integrate one delivery partner (start with Dunzo or Swiggy Genie)
  - Build the working GST export feature
  - Launch the community catalog contribution flow
  - Add supplier/distributor catalog imports from Afzal Gunj distributors
  - Build the shop mobile app (React Native using existing logic)

Success Definition:
  ₹5 Lakh monthly GMV, 100 active shops, 500 catalogue contributions
  from shops.


PHASE 3 — CITY TO MULTI-CITY (Expand and Fundraise)
Timeline: Month 7 onwards
---------------------------------------------------------------------------

Goals:
  - Expand to Bangalore, Chennai, and Pune with learnings from Hyderabad
  - Launch TecDoc catalog license for international vehicle coverage
  - Build analytics dashboard for shop owners with AI-powered reorder
    suggestions
  - Build the OEM cross-reference engine linking genuine numbers to
    aftermarket equivalents
  - Add fleet and insurance company B2B portal
  - Raise Series A using Hyderabad traction metrics

Success Definition:
  1,000 shops across 4 cities, ₹50 Lakh monthly GMV, Series A fundraise.


================================================================================
  SECTION 3 — FEATURE MODIFICATIONS
  Exactly What to Change in the Prototype
================================================================================

Priority levels used throughout this section:
  CRITICAL  — Do before anything else
  HIGH      — Do in Phase 1
  MEDIUM    — Do in Phase 2
  LOW       — Do in Phase 3 or later


3.1  STATE MANAGEMENT AND DATA LAYER
--------------------------------------

  Feature: localStorage as Database
  Priority: CRITICAL  |  Effort: 2 Weeks

  Current State:
    All data stored in browser localStorage. Works fine for a demo. Breaks
    the moment two people use the app on different devices or browsers.

  What to Change:
    - Replace localStorage completely with API calls to the backend
    - Keep the same data shapes — product, movement, order, and shop data
      models are correct. Just move them to PostgreSQL tables.
    - The useStore hook pattern is good. Convert each saveProducts,
      saveOrders, saveShops call to an async API call:
        await api.put('/products', data)
    - Add loading states and error states to every data operation —
      currently the prototype assumes everything succeeds instantly
    - Add optimistic updates: update UI immediately, then confirm with
      server response. This keeps the app feeling fast.


  Feature: Single Global State for All Shops
  Priority: CRITICAL  |  Effort: 1 Week

  Current State:
    One React Context holds data for all shops together. Shop 1, Shop 2,
    Shop 3 all share the same state. This is a serious security problem
    for a real product.

  What to Change:
    - Add an authentication layer that establishes which shop is logged in
    - Every API call must include the shop's auth token and the backend
      must return only that shop's data
    - The activeShopId variable in store.js is the right concept — it just
      needs to be tied to real authentication instead of a hardcoded 's1'
    - Remove the shop switcher UI from the prototype — in the real product
      each shop has its own login and sees only their own data
    - The multi-shop admin view (seeing all shops) becomes a separate
      platform admin portal accessible only to the internal team


3.2  AUTHENTICATION SYSTEM
----------------------------

  Feature: No Login System
  Priority: CRITICAL  |  Effort: 1.5 Weeks

  Current State:
    The prototype has no login screen, no session management, and no
    access control. Any person who opens the app sees all data.

  What to Build:
    - Login screen as the first screen — phone number + OTP (preferred for
      India) or email + password
    - Use OTP via SMS (Twilio or MSG91) as primary login method — shop
      owners in India are more comfortable with OTP than passwords
    - After OTP verification, issue a JWT token stored in memory (not
      localStorage — security risk)
    - Two user roles to start:
        SHOP_OWNER    — Full ERP access to their shop only
        CUSTOMER      — Marketplace access only
    - Add a PLATFORM_ADMIN role for the internal team to access all shops
      and the catalog management panel
    - Build shop registration flow:
        phone OTP → shop name, address, GSTIN → bank account for payouts
        → approval by team → access granted
    - Session timeout: auto-logout after 8 hours of inactivity on ERP side


3.3  INVENTORY AND MASTER CATALOG
------------------------------------

  Feature: Products Array — No Separation of Master Catalog vs. Shop Inventory
  Priority: CRITICAL  |  Effort: 2 Weeks

  Current State:
    The products array currently mixes master product data (OEM number,
    fitment, HSN code) with shop-specific data (price, stock, rack
    location) in one object. This breaks the platform architecture at scale.

  What to Change:
    - Split the products array into two database tables:
        MASTER_PARTS     — Global catalog records
        SHOP_INVENTORY   — Per-shop stock and pricing records

    - MASTER_PARTS contains:
        master_part_id, oem_number, part_name, brand, category,
        hsn_code, gst_rate, fitment data

    - SHOP_INVENTORY contains:
        inventory_id, shop_id, master_part_id (FK), selling_price,
        buying_price, stock_qty, rack_location, is_marketplace_listed

    - Uncle's OEM catalogue goes directly into MASTER_PARTS — these are
      the first real catalog records

    - When a shop adds a new product, they search MASTER_PARTS first.
      If found, they only enter price and stock. This is the auto-fill
      feature.

    - If not found in MASTER_PARTS, they create a draft master record
      (PENDING status) and simultaneously create their shop inventory
      record

    - The globalSku field already in the product objects is effectively
      the master_part_id — the architecture thinking is already correct


  Feature: Stock Count — Manual vs. Computed
  Priority: HIGH  |  Effort: 1 Week

  Current State:
    Stock is stored as a number in the product object and updated directly.
    This is incorrect for a production financial system.

  What to Change:
    - Stock quantity must be computed from the movements ledger at all
      times — never stored as a mutable field

    - The formula is:
        opening_stock
        + SUM(PURCHASE movements)
        - SUM(SALE movements)
        - SUM(DAMAGE movements)
        + SUM(RETURN movements)

    - A cached stock value can be stored in SHOP_INVENTORY for performance,
      but it must be recomputed and validated against the ledger on every
      transaction

    - Add a nightly reconciliation job that verifies cached stock values
      match the ledger and alerts the team if discrepancies are found

    - The movements array already has this concept — SALE, PURCHASE,
      DAMAGE, ADJUSTMENT types are all there. The architecture is right.
      Just enforce immutability strictly.


  Feature: OEM Search — Not Connected to Real Data
  Priority: HIGH  |  Effort: 1.5 Weeks

  Current State:
    OEM numbers exist in seed data but there is no real catalog search that
    pulls from a structured database. The shop onboarding flow does not
    demonstrate the auto-fill feature.

  What to Build:
    - A dedicated /api/catalog/search endpoint that accepts an OEM number
      or part name and returns matching master catalog records

    - This endpoint must support fuzzy matching — if a shop types
      '04465-0222' (missing last digit) it should still find '04465-02220'

    - Enter all of uncle's OEM numbers into the real master_parts table as
      seed data for this endpoint

    - The ProductModal.jsx already has a Global SKU search section — wire
      this to the real catalog search endpoint

    - Add an OEM format validator — check that the number entered matches
      the pattern for known manufacturer formats (Toyota, Maruti, Hyundai
      all have different OEM number formats)

    - Show a confidence score:
        EXACT MATCH     — Full OEM match
        PARTIAL MATCH   — Similar number found
        NO MATCH        — Show contribution form


3.4  POS BILLING AND INVOICING
---------------------------------

  Feature: Bill Generation — No Real PDF or WhatsApp Send
  Priority: HIGH  |  Effort: 2 Weeks

  Current State:
    The prototype calculates totals and GST correctly but cannot generate
    a real PDF invoice or send it to WhatsApp. It shows a success toast
    and simulates the send.

  What to Build:
    - Use pdfmake or puppeteer library on the backend to generate proper
      GST invoices as PDFs

    - Invoice must contain:
        - Seller GSTIN
        - Buyer GSTIN (if B2B)
        - HSN codes for each line item
        - CGST + SGST breakdown per line item
        - Invoice serial number in YYYYMM-0001 format (required by GST law)

    - Invoice serial numbering must be sequential and gapless — GST law
      requires this. Generate server-side, never client-side.

    - Integrate WhatsApp Business API (use Interakt or WATI as providers —
      simpler than Meta's direct API for a startup). Send invoice PDF as
      attachment.

    - Add a fallback: if WhatsApp fails, offer to send via SMS link to the
      PDF on the CDN

    - The split payment mode (Cash + UPI) in seed data — make sure the POS
      UI supports entering split amounts and the invoice records both
      payment methods

    - Add a reprint button in the History page — shops frequently need to
      resend invoices when customers ask


  Feature: GST Calculation — Correct But Not Exported
  Priority: MEDIUM  |  Effort: 2 Weeks

  Current State:
    The prototype correctly calculates CGST + SGST and stores gstAmount per
    transaction. But there is no way to export this data for filing.

  What to Build:
    - GSTR-1 export: outward supplies aggregated by HSN code, separated
      into B2B and B2C, formatted as the government-specified Excel template

    - GSTR-3B summary: total taxable value, total CGST, total SGST, total
      IGST for the month

    - The movements array already has all the data needed — this is a
      reporting query, not new data collection

    - Add an inter-state sale flag on each transaction — if buyer's GSTIN
      state code differs from shop's state code, apply IGST instead of
      CGST + SGST

    - Add HSN-wise summary report showing quantity and value sold per HSN
      code — required for GSTR-1 for shops with turnover above ₹5 Crore


3.5  CREDIT AND PARTIES MODULE
---------------------------------

  Feature: Parties Module — Exists But Not Fully Functional
  Priority: HIGH  |  Effort: 1.5 Weeks

  Current State:
    PartiesPage and parties data exist in the prototype with customers and
    suppliers. The credit tracking concept is there but payment recording
    and WhatsApp reminders are not connected to real flows.

  What to Build:
    - Payment recording flow completely:
        open party → see outstanding balance → record payment (amount, mode,
        date, reference) → generate receipt → update balance

    - Credit limit enforcement in POS: when a customer is selected in
      billing, check their outstanding balance. If above credit limit,
      show a warning and optionally block the transaction.

    - WhatsApp reminder automation: daily job at 9 AM checks all
      receivables. For any account with dues within 3 days of the due date,
      send a WhatsApp reminder with the exact amount and UPI QR code.

    - Aging buckets in the parties list view — color-code each party by
      how overdue their outstanding is:
        Green   — Current (not yet due)
        Yellow  — 1 to 30 days overdue
        Orange  — 31 to 60 days overdue
        Red     — 60+ days overdue

    - Ledger view per party: complete transaction history showing every
      invoice and every payment in chronological order — same format as a
      traditional khata book but digital


3.6  MARKETPLACE AND CUSTOMER EXPERIENCE
------------------------------------------

  Feature: Vehicle Selector — Works But Data Is Limited
  Priority: HIGH  |  Effort: 1 Week

  Current State:
    VehicleSelectorModal and vehicleData.js have 20 manufacturers and
    approximately 100 models. Enough for a demo but insufficient for real
    customer use. Key Indian variants and year ranges are missing.

  What to Change:
    - Expand vehicle data to cover:
        All Maruti Suzuki models, 2010 to present
        All Hyundai models, 2010 to present
        All Tata models, 2012 to present
        All Mahindra models, 2012 to present
        All Honda and Toyota models, 2010 to present
        These 6 brands cover 75% of cars on Hyderabad roads

    - Add two-wheeler support:
        Hero, Bajaj, TVS, Honda Motorcycles, Royal Enfield
        Two-wheelers are 60% of vehicles in India and a huge auto parts
        market

    - Add variant-level selection (VXI, ZXI, SX, EX) — fitment can differ
      between variants even of the same model and year

    - Store the selected vehicle in the user's profile (not just
      localStorage) so it persists across devices

    - Allow customers to save a garage with up to 5 vehicles — a household
      often has one car and one bike


  Feature: Product Search — Keyword Only, No Real Fitment Filtering
  Priority: HIGH  |  Effort: 2 Weeks

  Current State:
    The marketplace search currently filters products by text matching
    vehicle string. A shop types 'Swift, i20' as the compatible vehicles
    field and search checks if the customer's vehicle name appears in that
    text. This is fragile and will not scale.

  What to Build:
    - Replace text-based fitment matching with structured fitment table
      lookups using the PART_FITMENTS table

    - Search flow:
        customer searches 'brake pad'
        → system queries MASTER_PARTS for matching parts
        → filters by PART_FITMENTS where vehicle matches
        → queries SHOP_INVENTORY for stock at nearby shops

    - Add Elasticsearch or use PostgreSQL full-text search with pg_trgm
      extension for fuzzy search — typing 'brak pad' should still find
      'brake pad'

    - Add search suggestions as customer types — show popular searches like
      'oil filter Swift 2019' and 'brake pad i20'

    - Add a 'No results found' flow that is helpful:
        "No shops near you stock this part right now. We will notify you
        when it becomes available." — collect the demand signal and notify
        the shop.

    - Add filters:
        Price range
        Brand (Bosch, NGK, Denso)
        Condition (New, Refurbished)
        Delivery time
        Shop rating


  Feature: Cart and Checkout — Simulated Payment Only
  Priority: CRITICAL  |  Effort: 2 Weeks

  Current State:
    CheckoutPage and CartDrawer exist and look good. But payment is
    simulated — no real Razorpay integration and no actual order creation
    flow.

  What to Build:
    - Integrate Razorpay:
        create an order on the backend → pass order_id to Razorpay SDK on
        frontend → handle payment success and failure callbacks

    - On payment success:
        create order records for each shop in the cart
        trigger stock reservation (add to reserved_qty in SHOP_INVENTORY)
        send WhatsApp notification to shop owner

    - Implement multi-vendor cart handling: one Razorpay transaction for
      full cart amount, backend splits and records as separate orders per
      shop

    - Add stock validation at checkout: if between adding to cart and
      clicking pay the product goes out of stock, show an error and remove
      that item from cart before Razorpay is opened

    - Add address management: customer enters delivery address, system
      validates it is within shop's delivery radius before allowing checkout

    - Store payment transaction ID from Razorpay on every order — required
      for dispute resolution and refunds


  Feature: Order Tracking Page — Static UI
  Priority: HIGH  |  Effort: 1 Week

  Current State:
    OrderTrackingPage exists and shows order status. But status updates are
    static — there is no real update mechanism from shop to customer.

  What to Build:
    - Real-time order status update system:
        shop owner taps a button in their Orders page
        → order status changes
        → customer's tracking page updates

    - Use WebSocket (Socket.io) or simple polling every 30 seconds to
      update the tracking page without requiring a manual refresh

    - Add WhatsApp notifications at each status transition:
        order placed, accepted, packed, out for delivery, delivered

    - When Dunzo or Porter integration is added in Phase 2, map their
      tracking status to the order states and show the delivery partner's
      live map

    - Add an estimated delivery time that counts down in real time once
      the order is out for delivery

    - Add a 'Rate this order' flow that appears 30 minutes after the
      delivered status — shop rating is critical for marketplace trust


3.7  DASHBOARD AND REPORTS
-----------------------------

  Feature: Dashboard — Works on Seed Data, Needs Real Computed Metrics
  Priority: HIGH  |  Effort: 1.5 Weeks

  Current State:
    DashboardPage looks good and shows KPIs. But these are computed from
    in-memory seed data. When connecting a real database, calculations
    need to move server-side.

  What to Change:
    - Move all KPI calculations to the backend as pre-computed views or
      materialized queries — do NOT send all movements to the frontend and
      compute in JavaScript

    - Revenue, profit, margin: computed as SQL aggregates on the movements
      table filtered by date range and shop_id

    - Top products report: SQL GROUP BY product ordered by SUM(total) or
      SUM(profit) — do not compute this in JavaScript on the frontend

    - Dead stock alert:
        SELECT products WHERE last_sale_date < NOW() - INTERVAL '30 days'
        AND stock_qty > 0
        — server-side query, not frontend filter

    - Add date range picker to all dashboard widgets:
        Today / This Week / This Month / Last Month / Custom Range

    - The Recharts charts are good — keep them. Just replace the seed
      data with real API responses.

    - Add a daily summary WhatsApp message to shop owner every morning at
      8 AM: "Yesterday you sold ₹X, profit ₹Y, 3 products are low on
      stock"


================================================================================
  SECTION 4 — BACKEND ARCHITECTURE
  Complete Technical Specification
================================================================================

The prototype is pure frontend. This section tells the backend developer
exactly what to build. If you are a solo developer doing both, follow this
as the technical specification.


4.1  TECHNOLOGY STACK
------------------------

  LAYER              RECOMMENDED           WHY                         ALTERNATIVE
  -----------------  --------------------  --------------------------  -------------------
  Backend Runtime    Node.js + Express.js  Same language as React      Python FastAPI
                                           frontend. Reduces cognitive  (if team has
                                           load for full-stack devs.   Python experience)

  Database           PostgreSQL 15+        Relational data, complex    MySQL
                                           joins between parts and     (acceptable
                                           vehicles. ACID transactions  alternative)
                                           for financial data. NoSQL
                                           is wrong here.

  ORM                Prisma                Type-safe queries,          Sequelize
                                           automatic migrations,       (older but
                                           excellent developer         widely used)
                                           experience with Node.js.

  Authentication     JWT + Bcrypt          Stateless, scales well.     Passport.js
                                           JWT tokens for API auth.
                                           Bcrypt for password hashing.

  OTP Service        MSG91 or Twilio       MSG91: India-specific,      Fast2SMS
                                           cheaper. Twilio: global,    (cheapest for
                                           better reliability.         India)

  File Storage       Cloudflare R2         S3-compatible, much cheaper AWS S3
                                           than AWS S3, free egress.   (more expensive
                                           For product images and       but more
                                           invoice PDFs.               ecosystem)

  Search             PostgreSQL Full-Text  Good enough for Phase 1     Elasticsearch
                     + pg_trgm extension   and 2. No additional        (add in Phase 3
                                           infrastructure needed.      for better search)

  Caching            Redis                 Cache catalog search         In-memory cache
                                           results, session data,      (simpler but not
                                           and frequently accessed     distributed)
                                           shop dashboards.

  WhatsApp           WATI or Interakt      Managed WhatsApp Business   Meta Cloud API
                                           API. No need to deal with   (direct, cheaper
                                           Meta's complex approval     at scale)
                                           process directly.

  Payments           Razorpay              Best in India. Supports     Cashfree
                                           UPI, cards, netbanking,     (good alternative)
                                           and marketplace payouts
                                           (Razorpay Route).

  Deployment         Railway or Render     Simplest deployment for     AWS ECS
                     (Phase 1)             early-stage startup.        (Phase 3 when
                                           Push to git, it deploys.    more control
                                                                       is needed)

  CDN                Cloudflare            Free plan covers Phase 1    AWS CloudFront
                                           and 2. Fast global delivery
                                           for invoice PDFs and
                                           product images.


4.2  API DESIGN — ALL ENDPOINTS THE FRONTEND NEEDS
-----------------------------------------------------

AUTHENTICATION APIs

  METHOD  ENDPOINT                        WHAT IT DOES
  ------  ------------------------------  --------------------------------------------
  POST    /api/auth/request-otp           Sends OTP to phone number. Rate limited
                                          to 3 attempts per 10 minutes.
  POST    /api/auth/verify-otp            Verifies OTP, returns JWT access token
                                          and refresh token.
  POST    /api/auth/refresh               Issues new access token using refresh token.
  POST    /api/auth/logout                Invalidates refresh token.
  POST    /api/auth/register-shop         Creates new shop record with details,
                                          GSTIN, bank account.


MASTER CATALOG APIs

  METHOD  ENDPOINT                                     WHAT IT DOES
  ------  -------------------------------------------  -----------------------------------
  GET     /api/catalog/search                          Searches master catalog. Accepts
          ?q={query}&vehicle_id={id}                   q (query text) and vehicle_id.
                                                       Returns parts with fitment match.
  GET     /api/catalog/parts/{master_part_id}          Full detail of one master catalog
                                                       record including all fitment data.
  GET     /api/catalog/oem/{oem_number}                Looks up a specific OEM number.
                                                       Returns exact match and
                                                       cross-references.
  POST    /api/catalog/contribute                      Shop contributes a new part not in
                                                       catalog. Creates PENDING record.
  GET     /api/catalog/vehicles                        Returns full vehicle master list
                                                       for vehicle selector UI.
  GET     /api/catalog/vehicles/{make}/models          Returns models for a specific make.


SHOP INVENTORY APIs

  METHOD  ENDPOINT                                WHAT IT DOES
  ------  --------------------------------------  -----------------------------------------
  GET     /api/shop/inventory                     Returns all inventory records for the
                                                  authenticated shop with computed stock.
  POST    /api/shop/inventory                     Creates new inventory record linked to
                                                  a master_part_id.
  PUT     /api/shop/inventory/{id}                Updates price, rack location, min stock
                                                  threshold, marketplace listing toggle.
  GET     /api/shop/inventory/{id}/movements      Returns full movement history for one
                                                  product in this shop.
  POST    /api/shop/inventory/purchase            Records a purchase — adds stock, records
                                                  supplier payment, creates movement.
  POST    /api/shop/inventory/adjust              Records a stock adjustment — damage,
                                                  correction, or opening balance entry.


BILLING AND POS APIs

  METHOD  ENDPOINT                                 WHAT IT DOES
  ------  ---------------------------------------  ------------------------------------------
  POST    /api/billing/invoice                     Creates a new sale invoice. Deducts
                                                   stock, records movements, creates
                                                   receivable if credit sale.
  GET     /api/billing/invoice/{id}/pdf            Returns generated PDF for an invoice.
                                                   Cached after first generation.
  POST    /api/billing/invoice/{id}/send-whatsapp  Sends invoice PDF to customer's WhatsApp.
  GET     /api/billing/invoices                    Returns invoice history with filters:
                                                   date range, customer, payment mode.
  POST    /api/billing/return                      Records a sales return. Adds stock back,
                                                   creates credit note.


MARKETPLACE APIs

  METHOD  ENDPOINT                                          WHAT IT DOES
  ------  ------------------------------------------------  -----------------------------------
  GET     /api/marketplace/search                           Main marketplace search. Returns
          ?q={}&vehicle_id={}&lat={}&lng={}                 products in stock at nearby shops
                                                            with fitment badge. Geo-filtered.
  GET     /api/marketplace/product/{master_part_id}/shops   All shops within radius stocking
                                                            this product, with prices and
                                                            ratings.
  POST    /api/marketplace/orders                           Creates marketplace order. Reserves
                                                            stock. Triggers Razorpay order
                                                            creation.
  POST    /api/marketplace/orders/{id}/payment-confirm      Razorpay webhook handler. Confirms
                                                            payment, notifies shop.
  PUT     /api/marketplace/orders/{id}/status               Shop updates order status: accepted,
                                                            packed, dispatched, delivered.
  GET     /api/marketplace/orders/{id}/track                Customer tracking. Returns current
                                                            status and delivery partner info.


4.3  DATABASE SCHEMA — THE FINAL TABLES
-----------------------------------------

  NOTE: Run these CREATE TABLE statements in this order.
  Foreign key constraints require parent tables to exist before child tables.

  -----------------------------------------------------------------------

  -- TABLE 1: VEHICLES
  -- The foundation. Build this first. All fitment data references this.

  CREATE TABLE vehicles (
    vehicle_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    make            VARCHAR(100) NOT NULL,    -- 'Maruti Suzuki'
    model           VARCHAR(100) NOT NULL,    -- 'Swift'
    variant         VARCHAR(100),             -- 'ZXI Plus'
    year_from       INTEGER NOT NULL,
    year_to         INTEGER,
    fuel_type       VARCHAR(50),              -- 'Petrol', 'Diesel', 'CNG', 'EV'
    engine_cc       INTEGER,
    engine_code     VARCHAR(50),
    transmission    VARCHAR(50),
    body_type       VARCHAR(50)
  );

  -----------------------------------------------------------------------

  -- TABLE 2: MASTER_PARTS
  -- Global parts catalog. Uncle's OEM numbers go here.
  -- Status: PENDING = submitted, not yet verified
  --         VERIFIED = approved, visible in search
  --         REJECTED = not approved, not visible

  CREATE TABLE master_parts (
    master_part_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oem_number      VARCHAR(100),
    part_name       VARCHAR(255) NOT NULL,
    brand           VARCHAR(100),
    category_l1     VARCHAR(100),
    category_l2     VARCHAR(100),
    hsn_code        VARCHAR(20),
    gst_rate        DECIMAL(5,2) DEFAULT 18.00,
    unit_of_sale    VARCHAR(50) DEFAULT 'Piece',
    description     TEXT,
    status          VARCHAR(50) DEFAULT 'PENDING',  -- VERIFIED, PENDING, REJECTED
    source          VARCHAR(50) DEFAULT 'MANUAL',   -- SUPPLIER, CONTRIBUTED, LICENSED
    created_at      TIMESTAMPTZ DEFAULT NOW()
  );

  -----------------------------------------------------------------------

  -- TABLE 3: PART_FITMENTS
  -- Vehicle-to-part compatibility map. Many parts fit many vehicles.
  -- fit_type: EXACT = confirmed for this exact variant
  --           COMPATIBLE = tested compatible but not OEM spec
  --           UNIVERSAL = fits all vehicles of this type

  CREATE TABLE part_fitments (
    fitment_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_part_id  UUID NOT NULL REFERENCES master_parts(master_part_id),
    vehicle_id      UUID NOT NULL REFERENCES vehicles(vehicle_id),
    fit_type        VARCHAR(50) NOT NULL,  -- EXACT, COMPATIBLE, UNIVERSAL
    notes           TEXT
  );

  -----------------------------------------------------------------------

  -- TABLE 4: SHOPS
  -- Each auto parts shop on the platform.

  CREATE TABLE shops (
    shop_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    owner_name      VARCHAR(255),
    phone           VARCHAR(20) UNIQUE NOT NULL,
    gstin           VARCHAR(20),
    address         TEXT,
    city            VARCHAR(100),
    pincode         VARCHAR(10),
    latitude        DECIMAL(9,6),
    longitude       DECIMAL(9,6),
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  );

  -----------------------------------------------------------------------

  -- TABLE 5: SHOP_INVENTORY
  -- Each shop's specific stock. Child of both shops and master_parts.
  -- stock_qty is CACHED — always recompute from movements for accuracy.
  -- reserved_qty = units held for pending marketplace orders.
  -- UNIQUE constraint: one record per shop per product.

  CREATE TABLE shop_inventory (
    inventory_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id               UUID NOT NULL REFERENCES shops(shop_id),
    master_part_id        UUID NOT NULL REFERENCES master_parts(master_part_id),
    selling_price         DECIMAL(10,2) NOT NULL,
    buying_price          DECIMAL(10,2),
    stock_qty             INTEGER DEFAULT 0,       -- CACHED: recompute from movements
    reserved_qty          INTEGER DEFAULT 0,       -- Reserved for pending orders
    min_stock_alert       INTEGER DEFAULT 5,
    rack_location         VARCHAR(50),
    is_marketplace_listed BOOLEAN DEFAULT false,
    UNIQUE(shop_id, master_part_id)                -- One record per shop per product
  );

  -----------------------------------------------------------------------

  -- TABLE 6: MOVEMENTS
  -- THE most important table. IMMUTABLE LEDGER.
  -- NEVER update or delete rows from this table.
  -- Stock = SUM(qty) grouped by type, per inventory_id.
  -- Types: PURCHASE (adds stock), SALE (removes stock),
  --        RETURN (adds stock back), DAMAGE (removes stock),
  --        ADJUSTMENT (can be positive or negative)

  CREATE TABLE movements (
    movement_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id       UUID NOT NULL REFERENCES shops(shop_id),
    inventory_id  UUID NOT NULL REFERENCES shop_inventory(inventory_id),
    type          VARCHAR(50) NOT NULL,    -- PURCHASE, SALE, RETURN, DAMAGE, ADJUSTMENT
    qty           INTEGER NOT NULL,
    unit_price    DECIMAL(10,2),
    total_amount  DECIMAL(10,2),
    gst_amount    DECIMAL(10,2),
    profit        DECIMAL(10,2),
    invoice_id    UUID,
    created_at    TIMESTAMPTZ DEFAULT NOW()
  );

  -----------------------------------------------------------------------

  -- RECOMMENDED INDEXES (add after tables are created)

  CREATE INDEX idx_movements_inventory    ON movements(inventory_id, created_at DESC);
  CREATE INDEX idx_movements_shop         ON movements(shop_id, created_at DESC);
  CREATE INDEX idx_inventory_shop         ON shop_inventory(shop_id);
  CREATE INDEX idx_fitments_vehicle       ON part_fitments(vehicle_id);
  CREATE INDEX idx_fitments_part          ON part_fitments(master_part_id);
  CREATE INDEX idx_parts_oem              ON master_parts(oem_number);
  CREATE INDEX idx_shops_location         ON shops USING GIST(
                                              ST_MakePoint(longitude, latitude)
                                            );  -- Requires PostGIS extension

  -- Full-text search index for part names (requires pg_trgm extension)
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX idx_parts_name_trgm        ON master_parts
                                              USING GIN(part_name gin_trgm_ops);


4.4  THE MASTER CATALOG ADMIN PANEL
--------------------------------------

This is the internal tool the catalog team uses daily. Not visible to shops
or customers. Needs the following screens built as a simple web interface:

  SCREEN               WHAT IT DOES
  -------------------  ---------------------------------------------------------
  Dashboard            Total records by status: VERIFIED / PENDING / REJECTED.
                       Records added this week. Pending review count.

  Pending Review Queue List all PENDING records sorted by submission date.
                       Each row shows part name, OEM, submitting shop, and
                       Approve / Reject / Edit buttons.

  Part Editor          Full form to edit any master part record — name, OEM,
                       category, HSN code, fitment assignments, images.

  Fitment Manager      For a given part, show all vehicle assignments. Add or
                       remove fitment entries. Set fit type (EXACT / COMPATIBLE).

  OEM Import Tool      Upload an Excel file from a supplier or the uncle's
                       catalogue. System parses each row and creates PENDING
                       master part records in bulk for review.

  Duplicate Detector   Show pairs of master part records that might be the same
                       product (similar OEM numbers or identical part names).
                       Allow merging of duplicates.

  Vehicle Master Ed.   Manage the vehicles table — add new models, update year
                       ranges, add variants.


================================================================================
  SECTION 5 — UNCLE'S OEM DATA: HOW TO USE IT
================================================================================

This is the biggest immediate competitive advantage. A 30-year shop's
top-selling OEM numbers is exactly the right seed data. Here is how to
convert that raw data into catalog records correctly.


5.1  WHAT TO COLLECT — THE EXACT TEMPLATE
-------------------------------------------

When sitting with the uncle, do not just write down OEM numbers. For each
product, capture these fields. Even rough notes are fine — the catalog team
will clean and verify later.

  FIELD                  EXAMPLE                  HOW TO GET IT                REQUIRED?
  ---------------------  -----------------------  ---------------------------  ---------
  OEM Number             04465-02220              From box, sticker, or        YES
                                                  order records
  Part Name              Front Brake Pad Set      Common name the uncle uses   YES
  Brand He Stocks        Bosch, TVS, or Genuine   Look at the physical product YES
  Which Vehicles It Fits Swift, i20, Baleno        The uncle knows from         YES
                         2015–2023                30 years of experience
  Category               Brakes                   Ask the uncle to group them  YES
  How It Is Sold         Per Set / Per Piece /    Check the packaging           YES
                         Per Pair
  Any Alternative        Another brand's          The uncle likely knows these  Optional
  Numbers                equivalent number
  Approximate Selling    ₹1,800                   His current counter price    Optional
  Price


5.2  THE DATA COLLECTION SESSION — HOW TO RUN IT
--------------------------------------------------

Do NOT try to do this in one day. It will be overwhelming and data quality
will suffer. Structure it as three sessions:

  SESSION 1
  ---------
  - Focus only on the top 3 categories by sales volume.
    Ask: "What are the 3 types of parts you sell the most?"
    Likely answer: filters, brake pads, and spark plugs.
  - Go through each physical product on those shelves.
    Take the box, read the OEM number, photograph it, fill the template.
  - Target: 100 to 150 product records.
  - Do NOT worry about completeness. Depth in top categories beats
    coverage of everything.

  SESSION 2
  ---------
  - Ask the uncle to show you his top 20 customers — the garages and
    mechanics who buy from him regularly.
  - For each major customer, ask: "What are the 5 parts they order most
    frequently?"
  - This reveals demand-driven data: the parts that actually move, not
    just what is on the shelf.
  - Target: 100 additional records driven by customer demand patterns.

  SESSION 3
  ---------
  - Cover remaining categories: electrical parts, suspension, belts, lights.
  - Ask about cross-references the uncle knows from experience:
    "When someone asks for this Toyota part, I give them this Bosch
    equivalent."
  - These cross-references are gold — they build the OEM cross-reference
    table which is the biggest competitive moat.
  - Target: 100 additional records and 50 cross-reference pairs.


5.3  PROCESSING THE DATA — FROM NOTES TO CATALOG RECORDS
----------------------------------------------------------

  Step 1:  Create an Excel file with these columns:
             oem_number, alternate_oem, part_name, brand, category,
             vehicles_compatible, unit_of_sale, notes

  Step 2:  Fill one row per product from session notes. Keep it rough —
           spelling mistakes and incomplete vehicle lists are fine at this
           stage.

  Step 3:  Upload the Excel file to the Catalog Admin Panel using the
           OEM Import Tool. The system creates PENDING records for each row.

  Step 4:  The catalog team reviews each PENDING record:
           - Verifies the OEM number format
           - Standardizes the part name
           - Assigns the correct HSN code
           - Maps vehicle compatibility to vehicle_ids in the vehicles table

  Step 5:  Approved records become VERIFIED and are immediately available
           for shop search and auto-fill.

REALISTIC TARGET FROM THREE SESSIONS WITH THE UNCLE:

  - Three sessions should yield 300 to 400 raw product records
  - After cleaning and verification: 200 to 300 high-quality VERIFIED records
  - These 200 to 300 records will cover the most-searched parts for the
    most common vehicles in Hyderabad
  - This is more than enough to make the platform feel complete and useful
    to the first 20 pilot shops
  - Every additional shop onboarded will add to this count through the
    contribution flow


================================================================================
  SECTION 6 — WEEK-BY-WEEK EXECUTION PLAN (Weeks 1–10)
================================================================================

This is the working schedule. It is aggressive but realistic for a focused team
of 2 to 3 developers. Solo developers should extend each week by 30 to 50
percent. Do NOT reorder steps — each week builds on the previous one.


WEEK 1 — DATABASE AND AUTHENTICATION FOUNDATION
-------------------------------------------------

  [ ]  Set up PostgreSQL locally and on a cloud server
       (Railway or Render — free tier is fine to start)

  [ ]  Create all database tables from Section 4.3 in this order:
       VEHICLES → MASTER_PARTS → PART_FITMENTS → SHOPS
       → SHOP_INVENTORY → MOVEMENTS

  [ ]  Set up Node.js + Express project structure. Connect Prisma to
       the database.

  [ ]  Build the /api/auth/request-otp and /api/auth/verify-otp
       endpoints with MSG91 OTP sending.

  [ ]  Build JWT token generation and a middleware that validates auth
       tokens on every protected route.

  [ ]  Write a database seed script that imports existing prototype seed
       data (products, shops, movements) into the real PostgreSQL tables.


WEEK 2 — CORE INVENTORY APIs
------------------------------

  [ ]  Build all Shop Inventory endpoints:
       GET /inventory, POST /inventory, PUT /inventory/{id}

  [ ]  Build the Purchase recording endpoint:
       POST /inventory/purchase — adds stock, creates movement record,
       handles supplier credit

  [ ]  Build the catalog search endpoint:
       GET /catalog/search — searches master_parts by OEM number or
       part name, returns fitment matches

  [ ]  Update the React frontend: replace every localStorage read/write
       with API calls for inventory data

  [ ]  Test with Postman: every endpoint should return correct data for a
       test shop. Fix any authentication or data shape issues.

  [ ]  Enter uncle's first 100 OEM records into the master_parts table
       using a SQL insert script or the admin panel.


WEEK 3 — BILLING AND INVOICING
---------------------------------

  [ ]  Build the invoice creation endpoint:
       POST /billing/invoice — validates stock, creates movement records,
       generates invoice number, returns invoice data

  [ ]  Set up pdfmake or puppeteer on the backend. Build the invoice PDF
       template with proper GST formatting:
       - CGST + SGST breakdown
       - HSN code per line item
       - Seller GSTIN
       - Sequential invoice number

  [ ]  Set up WATI or Interakt WhatsApp Business API account. Build the
       send-whatsapp endpoint.

  [ ]  Update the POS page in React: billing flow now calls the real API,
       gets a real invoice PDF link, triggers the real WhatsApp send.

  [ ]  Test the complete billing flow end to end:
       scan product → add to bill → select payment mode → generate invoice
       → PDF appears → WhatsApp message received on test phone


WEEK 4 — MARKETPLACE SEARCH AND LISTINGS
------------------------------------------

  [ ]  Build the marketplace search endpoint:
       GET /marketplace/search with vehicle fitment filter and
       geolocation radius filter

  [ ]  Add PostGIS extension to PostgreSQL. Add latitude and longitude
       columns to shops table with spatial index.

  [ ]  Build the search query:
       text search on master_parts
       → fitment filter
       → stock filter on shop_inventory
       → geolocation filter on shops
       → sort results by distance

  [ ]  Update the MarketplaceHome React component to call the real search
       API instead of the local getHomeData function.

  [ ]  Update the VehicleSelectorModal to load vehicle data from
       /api/catalog/vehicles instead of the hardcoded vehicleData.js file.

  [ ]  Expand the vehicles table: add all missing Indian makes, models,
       and variants. Two-wheelers (Hero Splendor, Honda Activa, Bajaj
       Pulsar) are mandatory.


WEEK 5 — RAZORPAY AND ORDER FLOW
-----------------------------------

  [ ]  Create a Razorpay account. Enable Razorpay Route for marketplace
       payouts to shops.

  [ ]  Build the order creation flow:
       POST /marketplace/orders
       → validate stock
       → create Razorpay order
       → return order_id to frontend
       → customer pays
       → Razorpay webhook confirms payment

  [ ]  Build the Razorpay webhook handler:
       On payment.captured event:
       - confirm the order
       - reserve stock (increase reserved_qty)
       - send WhatsApp notification to shop owner

  [ ]  Build the shop order acceptance endpoint:
       PUT /marketplace/orders/{id}/status with status=accepted
       → converts reserved stock to sale movement

  [ ]  Update the CheckoutPage React component: integrate Razorpay SDK,
       handle payment success and failure, redirect to tracking page.

  [ ]  Test complete purchase flow end to end:
       add to cart → checkout → pay ₹1 test amount → webhook fires
       → order confirmed → shop notified on WhatsApp


WEEK 6 — PARTIES, CREDIT, AND KHATA
--------------------------------------

  [ ]  Build the parties APIs:
       create customer, record payment, get outstanding balance, get
       aging report

  [ ]  Build credit enforcement in billing: when a customer is selected,
       check their outstanding and credit limit before allowing credit sale

  [ ]  Build WhatsApp reminder automation: a scheduled job (cron) that
       runs daily at 9 AM and sends reminders for dues approaching in 3
       days

  [ ]  Update the PartiesPage React component: wire all party operations
       to real API endpoints

  [ ]  Build the party ledger view: complete transaction history for one
       customer or supplier showing every invoice and every payment


WEEK 7 — DASHBOARD AND REPORTS
---------------------------------

  [ ]  Build the dashboard API:
       GET /shop/dashboard?period=today|week|month
       — returns pre-computed KPIs as SQL aggregates

  [ ]  Build the reports APIs:
       - revenue by date
       - profit by product
       - GST summary (GSTR-3B data)
       - top products
       - dead stock list

  [ ]  Build the GSTR-1 export endpoint: returns Excel file with outward
       supplies formatted as government template.

  [ ]  Update the DashboardPage and ReportsPage in React: all charts and
       KPIs now pull from real API data.

  [ ]  Add date range picker to dashboard — shops need to compare this
       month vs last month.


WEEK 8 — SHOP ONBOARDING AND ADMIN PANEL
------------------------------------------

  [ ]  Build the shop registration flow:
       phone OTP → shop details form → GSTIN verification → bank account
       entry → pending approval state

  [ ]  Build the platform admin panel (internal tool):
       - list of shops pending approval
       - approve or reject a shop
       - view all orders
       - manage master catalog

  [ ]  Build the catalog admin panel:
       - pending review queue
       - part editor
       - fitment manager
       - OEM import tool from Excel

  [ ]  Enter all of uncle's OEM data through the admin import tool and
       verify each record.

  [ ]  Onboard the uncle's shop as the first real user. Have him use the
       ERP for one full working day. Note every friction point.


WEEK 9 — BUG FIXES AND POLISH
---------------------------------

  [ ]  Go through every UI screen in ERP and Marketplace on a MOBILE
       PHONE. Fix any layout issues — shop owners will use this on
       Android phones, not desktop.

  [ ]  Add loading states to every API call:
       - skeleton loaders
       - spinner buttons
       - human-readable error messages
         ('Could not load inventory. Check your connection.')

  [ ]  Add offline handling: if the ERP loses internet connection during
       billing, queue the transaction locally and sync when connection
       returns.

  [ ]  Performance test: can the inventory page load 500 products in
       under 2 seconds? If not, add pagination and server-side search.

  [ ]  Fix all known bugs from Week 8 feedback from uncle's shop.

  [ ]  Security review: ensure every API endpoint validates the auth
       token and returns only data belonging to the authenticated shop.


WEEK 10 — PILOT LAUNCH WITH 5 REAL SHOPS
------------------------------------------

  [ ]  Identify 5 auto parts shops in Hyderabad (Afzal Gunj or Jubilee
       Hills area) willing to try the ERP.

  [ ]  Visit each shop in person. Spend 2 hours onboarding:
       - register their shop
       - add their top 20 products
       - walk them through the billing flow

  [ ]  Give each shop owner a direct phone number for support. Expect to
       fix things in real time during the first week.

  [ ]  Track the one metric that matters most in Week 10:
       Did each shop successfully complete at least one sale using the
       ERP billing module?

  [ ]  Collect feedback after 5 days of use. Ask:
       - What is confusing?
       - What is missing?
       - What do you use every day vs. never?

  [ ]  Do NOT add new features yet. Fix what is broken based on real
       feedback first.


================================================================================
  SECTION 7 — WHAT TO REMOVE OR POSTPONE FROM THE PROTOTYPE
================================================================================

The prototype has several features that are premature for Phase 1. Trying to
build everything at once is the most common startup mistake. These features
should be removed from the active codebase or pushed to a 'coming soon' state.

  FEATURE IN PROTOTYPE         RECOMMENDATION         WHEN TO BUILD    REASON
  ---------------------------  ---------------------  ---------------  -------------------------
  AdminPage in marketplace     Remove from            Phase 1          Customers and shop owners
                               user-facing app.       (internal only)  should not see admin
                               Move to internal                        functionality.
                               admin panel only.

  GlobalCatalogPage and        Replace with better    Phase 2          Build search depth first.
  BrandCatalogPage             search. These browse-                   Browse pages work only
                               mode pages are wrong                    when catalog is rich enough
                               UX for intent-driven                    to browse.
                               shoppers.

  Pricing Page                 Simplify to a single   Simplify now,    Early shops need simple
                               clear pricing card.    expand Phase 2   pricing. Complexity comes
                               Current version is                      after product-market fit.
                               too complex.

  ProductComparisonModal       Keep but wire to       Phase 1          Core differentiator.
                               real data.             completion       Must work correctly.
                               Currently shows fake
                               comparison data.

  Workshop / Job Card module   Postpone to Phase 2.   Phase 2          Premium feature. Basic
                               Focus on core ERP                       billing must be perfected
                               billing first.                          first.

  Multiple delivery partner    Start with ONE only    Phase 2          Integration complexity.
  integrations                 (Dunzo). Add Porter    (one partner)    Master one before adding
                               and Shadowfax later.                    others.

  Dead Stock Flash Sale        Implement only after   Phase 2          Cannot identify dead stock
  feature                      shops have 3+ months                    without historical sales
                               of sales data.                          data first.

  Barcode printing with        Keep but make it work  Phase 1          Functional feature. Test
  custom label sheets          reliably before        (already built)  on real thermal printers
                               promoting it.                           used by shops.

  PWA offline functionality    Keep vite-plugin-pwa   Phase 1          Critical for shops with
                               but test thoroughly                     intermittent internet.
                               on Android devices.                     India-specific requirement.


================================================================================
  SECTION 8 — SUCCESS METRICS PER PHASE
================================================================================

Every phase has specific metrics that determine whether to continue to the next
phase or go back and fix something. Do NOT move to Phase 2 until every Phase 1
metric is met.


8.1  PHASE 1 SUCCESS METRICS (Weeks 1–10)
-------------------------------------------

  METRIC                        TARGET                   HOW TO MEASURE
  ----------------------------  -----------------------  --------------------------------
  Shops using ERP daily         5 shops making at        Count daily active sessions per
                                least 3 bills per day    shop in backend logs

  Billing time                  Under 90 seconds from    Time it during shop visits
                                product scan to
                                WhatsApp invoice sent

  Data entry — new product      Under 3 minutes to add   Time it with a real shop owner
                                a new product using      who has never used the app
                                OEM auto-fill

  WhatsApp invoice delivery     Invoice received on      Test with real transactions
                                customer's WhatsApp
                                within 10 seconds of
                                bill completion

  App crash rate                Zero crashes during      Monitor frontend error logs
                                normal billing flow

  OEM auto-fill hit rate        60%+ of products shops   Track catalog search: hits vs
                                try to add should find   misses in backend logs
                                a catalog match

  Marketplace orders            At least 10 real paid    Order count in dashboard
                                orders through the
                                marketplace

  Shop owner NPS                4 out of 5 pilot shops   Weekly check-in call
                                say they would
                                recommend this to
                                another shop owner


8.2  PHASE 2 SUCCESS METRICS (Weeks 11–24)
--------------------------------------------

  METRIC                        TARGET                   WHAT IT PROVES
  ----------------------------  -----------------------  --------------------------------
  Active shops                  100 shops using ERP      Product-market fit for ERP
                                at least 5 days per
                                week

  Monthly GMV                   ₹5 Lakh through          Marketplace is generating
                                marketplace              real commerce

  Monthly recurring revenue     ₹1 Lakh from SaaS        Shops are paying, not just
                                subscriptions            using free tier

  Catalog size                  10,000 VERIFIED master   Catalog is usable for broad
                                catalog records          search

  Churn rate                    Less than 5% of shops    Shops find it valuable enough
                                leaving per month        to keep paying

  Customer return rate          30% of marketplace       Marketplace experience is good
                                customers placing a      enough for repeat use
                                second order within
                                30 days

  Average billing time          Under 60 seconds         ERP is faster than paper for
                                                         all use cases


================================================================================
  SECTION 9 — IMMEDIATE TO-DO LIST: NEXT 7 DAYS
================================================================================

This is the most important section. Everything above is planning. This section
is action. Complete these items in the next 7 days before doing anything else.

  DAY    TASK                                          TIME        OUTPUT
  -----  --------------------------------------------  ----------  --------------------------
  Day 1  Read this entire document and highlight       2 hours     Developer has read and
  Today  anything unclear. Share it with the                       understood the plan.
         developer.

  Day 1  Set up the PostgreSQL database on Railway     2 hours     Empty database with
  Today  (free tier). Run the CREATE TABLE scripts                 correct schema is live.
         from Section 4.3.

  Day 2  Set up the Node.js + Express project.         3 hours     Backend server running
         Connect Prisma. Verify connection to                      and connected to database.
         database.

  Day 2  Create a MSG91 account. Get the API key.      1 hour      OTP sending works on
         Test sending one OTP to your own phone.                   a real phone.

  Day 3  Session 1 with uncle. Collect 100 to 150      3–4 hours   Excel sheet with 100+
         OEM records using the template from                       raw OEM records.
         Section 5.1. Photograph every product box.

  Day 4  Clean the Excel data from Session 1.          3 hours     Clean Excel file ready
         Verify each OEM number format. Standardize               for database import.
         part names. Assign categories.

  Day 4  Write a SQL seed script that imports the      2 hours     First real catalog
         cleaned Excel data into the master_parts                  records in the database.
         table.

  Day 5  Build the /api/auth endpoints (OTP request    3 hours     Login flow works on
         and verify). Test end to end.                             mobile browser.

  Day 6  Build the /api/catalog/search endpoint.       3 hours     OEM search returns
         Test: search 'brake pad' and see uncle's                  real data from the
         products return.                                          database.

  Day 7  Review everything built so far. Fix bugs.     2 hours     Week 1 complete.
         Write down what is unclear or blocked.                    Week 2 plan ready.
         Plan Week 2 in detail.


  ╔═══════════════════════════════════════════════════════════════════════════╗
  ║  THE SINGLE MOST IMPORTANT THING                                         ║
  ║                                                                          ║
  ║  Do NOT add new features to the prototype before completing Week 1 of    ║
  ║  the backend build.                                                      ║
  ║                                                                          ║
  ║  Every hour spent polishing the React frontend before the backend        ║
  ║  exists is wasted time.                                                  ║
  ║                                                                          ║
  ║  The prototype has proven the concept. Now build the real thing          ║
  ║  underneath it.                                                          ║
  ║                                                                          ║
  ║  The fastest path to the first real paying shop is:                      ║
  ║  database → auth → inventory APIs → billing → WhatsApp                   ║
  ║  In that exact order.                                                    ║
  ╚═══════════════════════════════════════════════════════════════════════════╝


================================================================================
  SECTION 10 — TEAM STRUCTURE AND MONTHLY COSTS
================================================================================

10.1  MINIMUM TEAM FOR PHASE 1
---------------------------------

  ROLE                  RESPONSIBILITY                           FT/PT     WHO FILLS THIS
  --------------------  ---------------------------------------  --------  -----------------------
  Founder               Product decisions, shop relationships,   Full-time  You
                        testing, OEM data collection, investor
                        conversations

  Full-Stack Developer  Backend API, database, frontend API       Full-time  Hire or co-founder.
                        integration, deployment                             Most critical hire.

  Catalog Data          OEM data entry, cleaning supplier         Part-time  Hire locally.
  Operator              catalogs, verifying fitment records,      (4 hrs/day) Automotive domain
                        review queue management                             knowledge preferred.
                                                                            Ex-parts shop employee
                                                                            is ideal.

  Customer Support      Respond to shop owner queries during      Part-time  Can be the founder
                        pilot phase, collect feedback                        in Phase 1.


10.2  MONTHLY COST ESTIMATE — PHASE 1
----------------------------------------

  COST ITEM             PROVIDER               ESTIMATED MONTHLY     NOTES
  --------------------  ---------------------  --------------------  ------------------------
  Cloud Server          Railway or Render       Free to ₹2,000        Free tier sufficient
                                                                      for 5 pilot shops

  PostgreSQL Database   Railway or Supabase     Free to ₹1,500        Free tier sufficient
                                                                      for Phase 1

  WhatsApp Business     WATI or Interakt        ₹2,500 to ₹5,000      Based on message volume.
  API                                                                 1,000 messages free on
                                                                      WATI trial.

  SMS OTP Service       MSG91                   ₹500 to ₹1,500        ₹0.15 to ₹0.25 per OTP.
                                                                      3,000 to 5,000 OTPs per
                                                                      month estimated.

  Razorpay              Razorpay                0% setup. 2% per      Only charged when orders
                                                transaction           happen. Zero fixed cost.

  Cloudflare R2         Cloudflare              Free to ₹500          10 GB free. Invoice PDFs
  Storage                                                             and product images.

  Domain Name           Any registrar           ₹1,000 per year       One-time annual cost.
                                                (one-time)

  TOTAL PHASE 1 MONTHLY                         ₹5,000 to ₹11,000     Extremely lean. Most
                                                                      costs only trigger with
                                                                      actual usage.


10.3  ESSENTIAL TOOLS — FREE OR NEAR-FREE
-------------------------------------------

  TOOL                        PURPOSE                                    COST
  --------------------------  -----------------------------------------  ------------------
  Postman                     API testing during development             Free
  GitHub                      Code repository and version control        Free
  Figma                       UI design for new screens                  Free tier
  Notion or Google Docs        Project documentation, bug tracking        Free
  Sentry                      Frontend and backend error monitoring       Free tier
  Google Analytics + Hotjar   Track how shops navigate the app           Free tier
  Loom                        Record bug/UX videos to share with dev     Free
  WhatsApp Business App        Customer support channel for pilot shops   Free


================================================================================
  SECTION 11 — HIGH-LEVEL ARCHITECTURE
  Added for Development Team Reference
================================================================================

This section translates the product requirements above into a clear technical
architecture that both AI agents and human developers can implement from.


11.1  SYSTEM OVERVIEW
-----------------------

The platform has four distinct surfaces, all backed by one API and one
database:

  Surface 1:  Shop ERP (Web + PWA)
              Used by: Shop owners, managers, cashiers
              Key flows: Billing, inventory, GRN, udhaar, reports, online orders

  Surface 2:  Customer Marketplace (Web + PWA)
              Used by: End customers buying auto parts
              Key flows: Search, cart, checkout, order tracking, reviews

  Surface 3:  Platform Admin Panel (Internal web tool)
              Used by: Founding team only
              Key flows: Shop approvals, catalog management, platform analytics

  Surface 4:  Catalog Admin Panel (Internal web tool)
              Used by: Catalog data operators
              Key flows: OEM import, fitment management, pending review queue


11.2  REQUEST FLOW — HOW DATA MOVES
--------------------------------------

Every request in the system follows this exact path:

  Client (React PWA)
      ↓ HTTPS
  Cloudflare CDN & DDoS Protection
      ↓
  Node.js + Express API Server
      ↓ JWT Auth Middleware (validates token, extracts shop_id)
      ↓ Route Handler (calls domain service)
      ↓
  ┌─────────────────────────────────────────────────────────┐
  │  Prisma ORM                                             │
  │    ↓ Queries scoped to authenticated shop_id            │
  ├──────────────────┬──────────────────────────────────────┤
  │  PostgreSQL       │  Redis Cache                         │
  │  (Source of truth)│  (Catalog search, sessions, stock   │
  │                   │   cache, rate limiting)              │
  └──────────────────┴──────────────────────────────────────┘
      ↓
  Response: { success, data, error? }
      ↓
  Client renders result


11.3  DATA OWNERSHIP MODEL
----------------------------

  DATA TYPE                  OWNER          SCOPE        NOTES
  -------------------------  -------------  -----------  ------------------------------
  Vehicle master list        Platform       Global        Admin-managed. All shops share.
  Master parts catalog       Platform       Global        Uncle's OEM data goes here.
  Part fitments              Platform       Global        Maps parts to vehicles.
  Shop profile               Individual     Per-shop      Each shop sees only their own.
  Shop inventory             Individual     Per-shop      Price + stock per shop.
  Movements ledger           Individual     Per-shop      Immutable. Never edit.
  Invoices                   Individual     Per-shop      7-year retention (GST law).
  Customer parties / khata   Individual     Per-shop      Private to each shop.
  Marketplace orders         Platform       Shared        Shop + customer + platform see.
  Customer profile           Customer       Per-user      Vehicle garage, order history.


11.4  SECURITY BOUNDARIES
---------------------------

  BOUNDARY                   ENFORCEMENT MECHANISM
  -------------------------  -------------------------------------------------------
  Shop can only see own data  Every API query includes WHERE shop_id = ? using the
                              authenticated shop_id from the JWT token. Not from URL.
  Customer cannot see ERP     Role check: CUSTOMER role JWT cannot access /shop/ routes.
  Admin panel is internal     Separate route prefix /admin/ with PLATFORM_ADMIN role
                              check. Ideally IP-whitelisted to office network.
  Payments are server-side    Razorpay order created on backend only. Frontend only
                              receives order_id. Amount cannot be manipulated by client.
  OTPs are single-use         OTP deleted from cache immediately after verification.
                              5-attempt limit per OTP before lockout.


11.5  OFFLINE ARCHITECTURE (PWA — ERP ONLY)
---------------------------------------------

The ERP must work without internet. Marketplace does not need offline support.

  Normal mode (online):
    All reads → API → PostgreSQL
    All writes → API → PostgreSQL → movement ledger updated immediately

  Offline mode (ERP only):
    Reads → IndexedDB (cached product list, last 7 days movements)
    Writes → IndexedDB mutation queue (pending operations stored locally)
    Invoice number → locally generated temporary ID with 'OFFLINE-' prefix

  Re-connection:
    App detects internet restored → flush mutation queue in order
    → Server processes each queued operation in sequence
    → Temporary invoice IDs replaced with real sequential numbers
    → If conflict detected (e.g., product was deleted while offline):
       surface a human-readable resolution prompt to the shop owner

  What works offline:
    ✓ Create sale invoice
    ✓ Add purchase (GRN)
    ✓ Record payment from customer
    ✓ View product list (cached)
    ✗ Marketplace search (requires server)
    ✗ PDF generation (requires server)
    ✗ WhatsApp send (requires internet)


11.6  STOCK COMPUTATION RULE (CRITICAL — READ CAREFULLY)
----------------------------------------------------------

This is the most important data integrity rule in the system.

  RULE: Stock is NEVER stored as a mutable number. It is ALWAYS computed.

  CORRECT APPROACH:
    stock_qty = (
      SUM(qty) WHERE type = 'PURCHASE'
      - SUM(qty) WHERE type = 'SALE'
      - SUM(qty) WHERE type = 'DAMAGE'
      + SUM(qty) WHERE type = 'RETURN'
      + SUM(qty) WHERE type = 'ADJUSTMENT'
    ) for a given inventory_id

  PERFORMANCE OPTIMIZATION:
    The computed value can be cached in shop_inventory.stock_qty as a
    running total. But this cache must be:
    a) Updated atomically in the same transaction as every movement write
    b) Verified against the full ledger computation in a nightly job
    c) NEVER trusted alone — always check movements for reconciliation

  MOVEMENTS ARE IMMUTABLE:
    If a stock entry is wrong, the correction is a new movement (ADJUSTMENT
    type with a note explaining the reason). The original wrong movement is
    NEVER deleted or modified.

  WHY THIS MATTERS:
    GST law requires an auditable record of all stock movements. A system
    that allows editing stock numbers has no audit trail and exposes the
    business owner to tax liability.


11.7  MULTI-TENANCY RULE
--------------------------

Every database query for shop-specific data must include the shop_id filter.
This is enforced at the application layer, not the database layer in Phase 1.

  CORRECT pattern:
    const inventory = await prisma.shopInventory.findMany({
      where: {
        shop_id: req.user.shop_id,   // From JWT — never from URL params
        is_active: true
      }
    });

  WRONG pattern (security vulnerability):
    const inventory = await prisma.shopInventory.findMany({
      where: {
        shop_id: req.params.shopId   // Client-controlled — can be spoofed
      }
    });

  IMPLEMENTATION:
    Create an Express middleware that extracts shop_id from the verified JWT
    and attaches it to req.shopId. All route handlers use req.shopId. No
    route should accept shop_id from the URL or body for tenant-scoped data.


11.8  PHASE-BY-PHASE INFRASTRUCTURE EVOLUTION
------------------------------------------------

  PHASE 1 (5–50 shops, Weeks 1–10):
    - Single Node.js process on Railway free tier
    - Single PostgreSQL instance on Railway
    - No Redis yet — use in-memory caching where needed
    - Cloudflare R2 for file storage
    - Direct Cloudflare proxy for SSL and CDN
    - Cost: ₹5,000 to ₹11,000/month

  PHASE 2 (50–200 shops, Weeks 11–24):
    - Add Redis for: session cache, catalog search cache, stock cache
    - Add database connection pooling (PgBouncer) if connection limits hit
    - Move from Railway free tier to Railway paid ($20–50/month)
    - Add Typesense for search if PostgreSQL full-text becomes slow
    - Add Bull job queue for: PDF generation, WhatsApp sends, cron jobs
    - Cost: ₹15,000 to ₹40,000/month

  PHASE 3 (200–2,000+ shops, Month 7+):
    - Migrate to AWS (ECS Fargate + RDS PostgreSQL Multi-AZ)
    - ElastiCache for Redis cluster
    - Horizontal scaling: 2–4 API instances behind Application Load Balancer
    - S3 for invoice PDF archive (7-year GST retention requirement)
    - CloudFront CDN for product images
    - Cost: ₹80,000 to ₹2,50,000/month depending on load


11.9  API RESPONSE STANDARDS
------------------------------

Every API endpoint must return responses in this exact envelope format.
No exceptions. Frontend components depend on this contract.

  SUCCESS RESPONSE:
  {
    "success": true,
    "data": { ... },             // The actual payload
    "meta": {                    // For list endpoints only
      "page": 1,
      "limit": 25,
      "total": 148
    }
  }

  ERROR RESPONSE:
  {
    "success": false,
    "error": {
      "code": "STOCK_INSUFFICIENT",       // Machine-readable code for frontend
      "message": "Only 3 units available, 5 requested",  // Human-readable
      "field": "quantity"                 // Which form field caused it (optional)
    }
  }

  HTTP STATUS CODE STANDARDS:
    200  — Success (GET, PUT)
    201  — Created (POST for new resources)
    400  — Bad request (validation failed, missing required field)
    401  — Unauthorized (missing or expired JWT token)
    403  — Forbidden (valid token but insufficient role/permissions)
    404  — Not found
    409  — Conflict (duplicate OEM number, duplicate phone)
    422  — Unprocessable (business rule violation — e.g., below credit limit)
    429  — Rate limited (OTP too many requests)
    500  — Internal server error (never expose stack trace in production)


11.10  ENVIRONMENT CONFIGURATION
----------------------------------

  REQUIRED ENVIRONMENT VARIABLES (never commit to git — use .env):

  # Database
  DATABASE_URL=postgresql://user:password@host:5432/autoparts

  # Auth
  JWT_SECRET=<32-character random string>
  JWT_EXPIRY=15m
  REFRESH_TOKEN_EXPIRY=30d

  # OTP
  MSG91_API_KEY=<from MSG91 dashboard>
  MSG91_SENDER_ID=AUTPRT

  # WhatsApp
  WATI_API_KEY=<from WATI dashboard>
  WATI_BASE_URL=https://live-mt-server.wati.io

  # Payments
  RAZORPAY_KEY_ID=<from Razorpay dashboard>
  RAZORPAY_KEY_SECRET=<from Razorpay dashboard>
  RAZORPAY_WEBHOOK_SECRET=<set when creating webhook in Razorpay>

  # File Storage
  R2_ACCOUNT_ID=<from Cloudflare dashboard>
  R2_ACCESS_KEY_ID=<from Cloudflare R2 API tokens>
  R2_SECRET_ACCESS_KEY=<from Cloudflare R2 API tokens>
  R2_BUCKET_NAME=autoparts-files
  R2_PUBLIC_URL=https://files.yourplatform.in

  # App
  NODE_ENV=production
  PORT=3001
  FRONTEND_URL=https://yourplatform.in
  ADMIN_URL=https://admin.yourplatform.in


================================================================================
  CLOSING NOTE FOR THE DEVELOPMENT TEAM
================================================================================

The prototype is well-structured and the architectural thinking is sound. The
core patterns — dual ERP/Marketplace architecture, immutable movements ledger,
two-layer catalog model, vehicle-fitment hierarchy — are all correct and should
be preserved as the real system is built.

The work ahead is not a rewrite. It is the translation of working frontend
concepts into a real backend with real data persistence, real authentication,
and real integrations.

The order of priority, from highest to lowest, is:

  1.  Database schema and connection (Week 1)
  2.  Authentication — OTP + JWT (Week 1)
  3.  Inventory and catalog APIs (Week 2)
  4.  Billing and invoice PDF (Week 3)
  5.  WhatsApp integration (Week 3)
  6.  Marketplace search and geolocation (Week 4)
  7.  Razorpay payments (Week 5)
  8.  Parties / credit / khata (Week 6)
  9.  Dashboard and GST reports (Week 7)
  10. Admin panel and shop onboarding (Week 8)

Do not build out of this order. Each step is a dependency for the next.
The first paying customer is reachable by Week 10. Everything beyond that is
growth, not survival.

================================================================================
  END OF DOCUMENT
  AutoMobile Space — Development Guide v1.0
  From Prototype to Production-Ready Product
================================================================================
