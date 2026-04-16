# Data Table Purpose and Connections

Generated from backend/prisma/schema.prisma on 2026-04-09.

## Scope

This document explains, for every database table:

- why the table exists
- what each column is for
- what other tables it connects to
- why each relationship exists

## Notation

- PK: primary key
- FK: foreign key enforced by Prisma relation
- Logical FK: reference used by application logic but not declared as a Prisma relation

---

## 1) vehicles

Why this table exists:
Canonical vehicle catalog for fitment matching and customer garage linking.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| vehicle_id (PK) | uuid/string | No | Stable ID for each vehicle record. |
| make | string | No | Vehicle manufacturer for filtering and search. |
| model | string | No | Vehicle model for fitment resolution. |
| variant | string | Yes | Trim/variant level precision. |
| year_from | int | No | Start of compatibility range. |
| year_to | int | Yes | End of compatibility range (null means open-ended). |
| fuel_type | string | Yes | Fuel-specific fitment constraints. |
| engine_cc | int | Yes | Engine displacement matching where required. |
| engine_code | string | Yes | Exact engine mapping for precision fitment. |
| transmission | string | Yes | Transmission-specific compatibility. |
| body_type | string | Yes | Body style filtering and compatibility. |
| abs_equipped | boolean | No | Variant safety-package compatibility checks. |
| vehicle_type | string | No | Segment split: Car, Motorcycle, Commercial, Tractor. |

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| part_fitments | 1 to many (FK part_fitments.vehicle_id -> vehicles.vehicle_id) | Each vehicle can be linked to many part fitment records. |
| customer_vehicle_garage | 1 to many optional (FK customer_vehicle_garage.vehicle_id -> vehicles.vehicle_id) | Customer saved vehicles can link to canonical vehicle definitions. |

---

## 2) master_parts

Why this table exists:
Global parts catalog (platform-level source of truth) used by all shops.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| master_part_id (PK) | uuid/string | No | Stable ID for platform-level part identity. |
| oem_number | string | Yes | Primary OEM lookup key. |
| oem_numbers | string[] | No | Additional OEM aliases for search and matching. |
| barcodes | string[] | No | Barcode lookup support. |
| part_name | string | No | Human-readable part name. |
| brand | string | Yes | Brand metadata for search and merchandising. |
| category_l1 | string | Yes | Primary category grouping. |
| category_l2 | string | Yes | Secondary category grouping. |
| hsn_code | string | Yes | GST classification code. |
| gst_rate | decimal | No | Tax calculation default. |
| unit_of_sale | string | No | Standard selling unit. |
| description | string | Yes | Product details for UI and search. |
| specifications | json | Yes | Flexible technical specs without schema churn. |
| image_url | string | Yes | Primary image URL. |
| images | string[] | No | Gallery images. |
| is_universal | boolean | No | Indicates part can be shown regardless of vehicle. |
| requires_fitment | boolean | No | Indicates part must have explicit fitment to be shown for a vehicle. |
| status | string | No | Catalog quality state: VERIFIED/PENDING/REJECTED. |
| source | string | No | Catalog source provenance: MANUAL/CONTRIBUTED/etc. |
| created_at | datetime | No | Creation audit timestamp. |
| updated_at | datetime | No | Update audit timestamp. |

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| part_fitments | 1 to many (FK part_fitments.master_part_id -> master_parts.master_part_id) | A part can fit many vehicle records. |
| shop_inventory | 1 to many (FK shop_inventory.master_part_id -> master_parts.master_part_id) | Shops sell inventory rows derived from global catalog parts. |
| marketplace_reviews | 1 to many (FK marketplace_reviews.master_part_id -> master_parts.master_part_id) | Reviews are anchored to canonical part identity, not only a shop listing. |

---

## 3) part_fitments

Why this table exists:
Join table that expresses vehicle-part compatibility with fitment type metadata.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| fitment_id (PK) | uuid/string | No | Unique ID for each compatibility rule row. |
| master_part_id | uuid/string | No | Points to the part being mapped. |
| vehicle_id | uuid/string | No | Points to the vehicle being mapped. |
| fit_type | string | No | Match confidence/type: EXACT/COMPATIBLE/UNIVERSAL. |
| position | string | Yes | Side/position specificity for applicable parts. |
| source | string | No | Provenance of fitment claim. |
| notes | string | Yes | Manual clarifications and context. |

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| master_parts | many to 1 (FK part_fitments.master_part_id) | Multiple fitment rows belong to one part. |
| vehicles | many to 1 (FK part_fitments.vehicle_id) | Multiple fitment rows belong to one vehicle. |

---

## 4) shops

Why this table exists:
Tenant root entity for shop-specific ERP data and ownership boundaries.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| shop_id (PK) | uuid/string | No | Tenant identifier for shop-level data isolation. |
| name | string | No | Shop display and legal identifier. |
| owner_name | string | Yes | Operator/contact identity. |
| phone | string (unique) | No | Primary contact and unique shop lookup key. |
| gstin | string | Yes | Tax registration for invoicing/compliance. |
| address | string | Yes | Physical address for billing and discovery. |
| city | string | Yes | City-level operations and filtering. |
| pincode | string | Yes | Delivery/service region metadata. |
| latitude | decimal(9,6) | Yes | Geo-distance calculations for marketplace. |
| longitude | decimal(9,6) | Yes | Geo-distance calculations for marketplace. |
| shop_description | string | Yes | Public profile and marketplace context. |
| logo_url | string | Yes | Branding asset. |
| is_verified | boolean | No | Marketplace trust flag. |
| is_active | boolean | No | Operational status flag. |
| created_at | datetime | No | Creation audit timestamp. |

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| users | 1 to many (FK users.shop_id) | Owner/staff users can belong to a shop tenant. |
| shop_inventory | 1 to many (FK shop_inventory.shop_id) | Inventory is tenant-scoped. |
| movements | 1 to many (FK movements.shop_id) | Ledger events are tenant-scoped. |
| invoices | 1 to many (FK invoices.shop_id) | Invoices are tenant-scoped financial records. |
| parties | 1 to many (FK parties.shop_id) | Customer/supplier ledgers are tenant-scoped. |
| shop_users | 1 to many (FK shop_users.shop_id) | Shop staff roster and permissions are tenant-scoped. |
| marketplace_orders | Logical FK via marketplace_orders.shop_id | Marketplace order rows include shop ownership, even though no Prisma relation is declared yet. |
| refresh_tokens | Logical FK via refresh_tokens.shop_id | Session context can store tenant scope for auth/session flows. |

---

## 5) users

Why this table exists:
Single identity record for every person across all roles and auth methods.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| user_id (PK) | uuid/string | No | Global user identity key. |
| firebase_uid | string (unique) | Yes | Firebase-linked account identity. |
| google_id | string (unique) | Yes | Google OAuth identity key. |
| phone | string (unique) | Yes | Phone-based login and contact key. |
| email | string (unique) | Yes | Email-based login and contact key. |
| name | string | Yes | Display/legal name. |
| avatar_url | string | Yes | Profile image metadata. |
| password_hash | string | Yes | Password auth secret storage. |
| email_verified | boolean | No | Email trust status for auth/security. |
| phone_verified | boolean | No | Phone trust status for auth/security. |
| is_verified | boolean | No | Aggregated verification state. |
| failed_logins | int | No | Brute-force control counter. |
| locked_until | datetime | Yes | Account lockout timeout. |
| role | string | No | Role-based authorization basis. |
| shop_id | uuid/string | Yes | Tenant association for shop-scoped users. |
| login_count | int | No | Activity metric. |
| last_login_at | datetime | Yes | Security/activity audit. |
| is_active | boolean | No | Account active/inactive state. |
| created_at | datetime | No | Creation audit timestamp. |
| updated_at | datetime | No | Update audit timestamp. |

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| shops | many to 1 optional (FK users.shop_id) | Links user to tenant context when applicable. |
| auth_providers | 1 to many (FK auth_providers.user_id) | A user can link multiple sign-in methods. |
| refresh_tokens | 1 to many (FK refresh_tokens.user_id) | A user can have many sessions/devices. |
| user_profiles | 1 to 1 (FK user_profiles.user_id, unique) | Stores extended profile fields separately from auth core. |
| user_settings | 1 to 1 (FK user_settings.user_id, unique) | Stores preference settings per user. |
| customer_profiles | 1 to 1 (FK customer_profiles.user_id, unique) | Customer-only metrics and wallet state. |
| customer_addresses | 1 to many (FK customer_addresses.user_id) | Marketplace delivery addresses for a user. |
| customer_vehicle_garage | 1 to many (FK customer_vehicle_garage.user_id) | Saved vehicles for fitment experience. |
| shop_users | 1 to many (FK shop_users.user_id) | User memberships in shop staff rosters. |
| admin_profiles | 1 to 1 (FK admin_profiles.user_id, unique) | Internal platform admin extension. |
| marketplace_orders | Logical FK via marketplace_orders.customer_id | Order ownership by customer identity. |
| password_reset_tokens | Logical FK via password_reset_tokens.user_id | Password recovery tokens belong to a user. |

---

## 6) otp_codes

Why this table exists:
Stores OTP challenge records and attempt tracking for phone/email verification flows.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| id (PK) | uuid/string | No | Unique challenge row ID. |
| phone | string | Yes | Phone target for OTP verification. |
| email | string | Yes | Email target for OTP verification. |
| code | string | No | OTP value/hash storage. |
| type | string | No | OTP context, such as PHONE_OTP or EMAIL_VERIFY. |
| attempts | int | No | Attempt count for abuse control. |
| ip_address | string | Yes | Abuse/risk auditing. |
| expires_at | datetime | No | OTP validity window. |
| verified_at | datetime | Yes | Timestamp when challenge was successfully verified. |
| used | boolean | No | Single-use enforcement. |
| created_at | datetime | No | Challenge creation audit. |

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| users | Logical linkage by phone/email | OTPs are used to verify identities before or during user account lifecycle. |

---

## 7) shop_inventory

Why this table exists:
Tenant-specific inventory and pricing state for each catalog part in each shop.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| inventory_id (PK) | uuid/string | No | Unique ID for a shop-specific listing/stock row. |
| shop_id | uuid/string | No | Tenant ownership. |
| master_part_id | uuid/string | No | Link to global catalog identity. |
| selling_price | decimal(10,2) | No | Retail sale price. |
| buying_price | decimal(10,2) | Yes | Last/typical procurement cost. |
| stock_qty | int | No | Cached available stock count. |
| reserved_qty | int | No | Reserved stock for pending marketplace orders. |
| min_stock_alert | int | No | Reorder threshold. |
| rack_location | string | Yes | Physical shelf/bin location. |
| shop_specific_notes | string | Yes | Shop-local metadata. |
| is_marketplace_listed | boolean | No | Publish control for marketplace. |
| last_purchased_at | datetime | Yes | Procurement recency analytics. |
| last_sold_at | datetime | Yes | Sales recency analytics. |
| created_at | datetime | No | Creation audit timestamp. |
| updated_at | datetime | No | Update audit timestamp. |

Key constraints:

- Unique composite: (shop_id, master_part_id)

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| shops | many to 1 (FK shop_inventory.shop_id) | Inventory must be tenant-scoped. |
| master_parts | many to 1 (FK shop_inventory.master_part_id) | Inventory derives from canonical part definition. |
| movements | 1 to many (FK movements.inventory_id) | Ledger history for stock changes by inventory row. |
| invoice_items | 1 to many (FK invoice_items.inventory_id) | Sales line items point to sold inventory rows. |
| marketplace_reviews | 1 to many optional (FK marketplace_reviews.inventory_id) | Review can optionally reference specific shop listing context. |
| marketplace_order_items | Logical FK via marketplace_order_items.inventory_id | Marketplace order lines point to inventory items though Prisma relation is not declared. |

---

## 8) movements

Why this table exists:
Immutable stock and value ledger for all inventory-affecting and financial adjustment events.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| movement_id (PK) | uuid/string | No | Unique ledger event ID. |
| shop_id | uuid/string | No | Tenant ownership and partition key. |
| inventory_id | uuid/string | No | Inventory row affected by this event. |
| type | string | No | Event type, such as PURCHASE/SALE/RETURN. |
| qty | int | No | Quantity delta basis. |
| unit_price | decimal(10,2) | Yes | Unit valuation for this movement. |
| total_amount | decimal(10,2) | Yes | Total monetary value of event. |
| gst_amount | decimal(10,2) | Yes | Tax amount recorded for event. |
| profit | decimal(10,2) | Yes | Profit or margin estimate for event. |
| invoice_id | uuid/string | Yes | Links movement to invoice context when applicable. |
| party_id | uuid/string | Yes | Links movement to customer/supplier party context. |
| notes | string | Yes | Freeform operational context. |
| created_at | datetime | No | Event audit timestamp. |

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| shops | many to 1 (FK movements.shop_id) | Ledger is tenant-scoped. |
| shop_inventory | many to 1 (FK movements.inventory_id) | Ledger event belongs to one inventory row. |
| invoices | Logical FK via movements.invoice_id | Sales and billing events tie to invoice documents. |
| parties | Logical FK via movements.party_id | Credit and supplier/customer accounting context. |

---

## 9) invoices

Why this table exists:
Header-level GST-compliant billing record for POS and ERP transactions.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| invoice_id (PK) | uuid/string | No | Unique invoice document ID. |
| invoice_number | string (unique) | No | Human/business invoice identifier. |
| shop_id | uuid/string | No | Tenant owner of invoice. |
| party_id | uuid/string | Yes | Optional linked customer/supplier ledger account. |
| party_name | string | Yes | Name snapshot for immutable document display. |
| party_phone | string | Yes | Contact snapshot for invoice and delivery. |
| party_gstin | string | Yes | GST snapshot for tax document. |
| subtotal | decimal(10,2) | No | Pre-tax subtotal. |
| discount_amount | decimal(10,2) | No | Total discount applied. |
| taxable_amount | decimal(10,2) | No | Taxable base amount. |
| cgst | decimal(10,2) | No | CGST component. |
| sgst | decimal(10,2) | No | SGST component. |
| igst | decimal(10,2) | No | IGST component. |
| total_amount | decimal(10,2) | No | Final payable amount. |
| payment_mode | string | No | Settlement mode metadata. |
| cash_amount | decimal(10,2) | Yes | Cash component for split tenders. |
| upi_amount | decimal(10,2) | Yes | UPI component for split tenders. |
| credit_amount | decimal(10,2) | Yes | Credit component for split tenders. |
| pdf_url | string | Yes | Generated PDF link if stored externally. |
| status | string | No | Invoice lifecycle state. |
| notes | string | Yes | Operator notes. |
| created_at | datetime | No | Creation audit timestamp. |

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| shops | many to 1 (FK invoices.shop_id) | Invoice ownership and tenancy. |
| parties | many to 1 optional (FK invoices.party_id) | Credit and ledger linkage with business counterparty. |
| invoice_items | 1 to many (FK invoice_items.invoice_id) | Header-detail invoice structure. |
| movements | Logical linkage via movements.invoice_id | Stock and accounting events tie back to invoice. |

---

## 10) invoice_items

Why this table exists:
Line-level breakdown of sold items for each invoice.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| item_id (PK) | uuid/string | No | Unique line item row ID. |
| invoice_id | uuid/string | No | Parent invoice link. |
| inventory_id | uuid/string | No | Specific inventory row sold. |
| part_name | string | No | Name snapshot retained on document. |
| hsn_code | string | Yes | Tax code snapshot. |
| qty | int | No | Quantity sold on line. |
| unit_price | decimal(10,2) | No | Line unit sale price. |
| discount | decimal | No | Line discount value. |
| taxable_amt | decimal(10,2) | No | Line taxable value. |
| gst_rate | decimal(5,2) | No | Tax rate for line. |
| cgst | decimal(10,2) | No | CGST line component. |
| sgst | decimal(10,2) | No | SGST line component. |
| total | decimal(10,2) | No | Final line total. |

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| invoices | many to 1 (FK invoice_items.invoice_id) | Detail rows belong to a single invoice header. |
| shop_inventory | many to 1 (FK invoice_items.inventory_id) | Identifies exact stock source of sold item. |

---

## 11) parties

Why this table exists:
Business counterpart ledger entities for customers and suppliers, including credit tracking.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| party_id (PK) | uuid/string | No | Unique business counterparty ID. |
| shop_id | uuid/string | No | Tenant scope for this party record. |
| name | string | No | Party legal/display name. |
| phone | string | Yes | Contact metadata. |
| gstin | string | Yes | Tax identity for B2B billing. |
| address | string | Yes | Billing/location context. |
| type | string | No | CUSTOMER, SUPPLIER, or BOTH. |
| credit_limit | decimal(10,2) | No | Allowed credit exposure threshold. |
| outstanding | decimal(10,2) | No | Current outstanding balance. |
| notes | string | Yes | Operational context. |
| is_active | boolean | No | Soft-active status. |
| created_at | datetime | No | Creation audit timestamp. |

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| shops | many to 1 (FK parties.shop_id) | Party records are tenant-specific. |
| invoices | 1 to many (FK invoices.party_id) | Invoices can be linked to a party ledger account. |
| movements | Logical linkage via movements.party_id | Ledger events can reference party accounting context. |

---

## 12) marketplace_reviews

Why this table exists:
Customer review and rating records for marketplace catalog items.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| review_id (PK) | uuid/string | No | Unique review row ID. |
| master_part_id | uuid/string | No | Review target at canonical part level. |
| inventory_id | uuid/string | Yes | Optional shop listing context. |
| order_id | uuid/string | Yes | Optional order proof linkage. |
| customer_name | string | No | Display name for review attribution. |
| customer_phone | string | Yes | Optional reviewer contact/proof context. |
| rating | int | No | Numeric score for ranking and quality signals. |
| title | string | Yes | Short review heading. |
| body | string | Yes | Review content text. |
| verified_purchase | boolean | No | Trust signal for review quality. |
| helpful_count | int | No | Community feedback ranking. |
| is_hidden | boolean | No | Moderation control. |
| created_at | datetime | No | Review creation timestamp. |

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| master_parts | many to 1 (FK marketplace_reviews.master_part_id) | Reviews are primarily about canonical part identity. |
| shop_inventory | many to 1 optional (FK marketplace_reviews.inventory_id) | Optional context for the exact listing bought/reviewed. |
| marketplace_orders | Logical linkage via marketplace_reviews.order_id | Optional purchase proof relation for trust signals. |

---

## 13) marketplace_orders

Why this table exists:
Marketplace order header records for customer purchases, grouped by shop.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| order_id (PK) | uuid/string | No | Unique order ID. |
| order_number | string (unique) | No | Business-facing order identifier. |
| customer_id | uuid/string | Yes | User ownership link for customer. |
| customer_phone | string | No | Contact and fallback identity. |
| customer_name | string | Yes | Display identity snapshot. |
| shop_id | uuid/string | No | Fulfillment shop owner. |
| subtotal | decimal(10,2) | No | Item subtotal. |
| delivery_fee | decimal(10,2) | No | Delivery charge amount. |
| total | decimal(10,2) | No | Final order total. |
| delivery_address | string | Yes | Address snapshot for fulfillment. |
| status | string | No | Order lifecycle state. |
| razorpay_order_id | string | Yes | Payment gateway order reference. |
| razorpay_payment_id | string | Yes | Payment gateway payment reference. |
| notes | string | Yes | Support/operations notes. |
| created_at | datetime | No | Creation timestamp. |
| updated_at | datetime | No | Last update timestamp. |

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| marketplace_order_items | 1 to many (FK marketplace_order_items.order_id) | Header-detail order structure. |
| users | Logical FK via marketplace_orders.customer_id | Associates order to customer account. |
| shops | Logical FK via marketplace_orders.shop_id | Associates order to fulfilling shop. |
| marketplace_reviews | Logical linkage via marketplace_reviews.order_id | Enables verified purchase signals. |

---

## 14) marketplace_order_items

Why this table exists:
Line-level items for each marketplace order.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| item_id (PK) | uuid/string | No | Unique marketplace order line ID. |
| order_id | uuid/string | No | Parent marketplace order reference. |
| inventory_id | uuid/string | No | Inventory item sold. |
| part_name | string | No | Immutable line item label snapshot. |
| qty | int | No | Quantity ordered. |
| unit_price | decimal(10,2) | No | Unit sale price at order time. |
| total | decimal(10,2) | No | Line total amount. |

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| marketplace_orders | many to 1 (FK marketplace_order_items.order_id) | Line item belongs to order header. |
| shop_inventory | Logical FK via marketplace_order_items.inventory_id | Identifies exact inventory source for reservation and fulfillment. |

---

## 15) refresh_tokens

Why this table exists:
Persistent session table for refresh token rotation, revocation, and device tracking.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| id (PK) | uuid/string | No | Unique session token row ID. |
| user_id | uuid/string | No | Owner user of this session. |
| shop_id | uuid/string | Yes | Tenant session scope for shop contexts. |
| token_hash | string (unique) | No | Secure lookup key for refresh token. |
| token | string | No | Legacy compatibility column. |
| device_info | json | No | User-agent/device metadata. |
| ip_address | string | Yes | Security auditing and anomaly checks. |
| expires_at | datetime | No | Session expiration boundary. |
| last_used_at | datetime | Yes | Last refresh activity timestamp. |
| revoked_at | datetime | Yes | Soft revocation marker. |
| created_at | datetime | No | Session creation timestamp. |

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| users | many to 1 (FK refresh_tokens.user_id) | Multiple device sessions per user. |
| shops | Logical FK via refresh_tokens.shop_id | Optional tenant context attached to session. |

---

## 16) auth_providers

Why this table exists:
Maps each user to one or more login providers and provider-specific IDs.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| id (PK) | uuid/string | No | Unique provider link row ID. |
| user_id | uuid/string | No | Owner user. |
| provider | string | No | Provider type: EMAIL, PHONE, GOOGLE. |
| provider_id | string | No | Provider-side unique account ID/value. |
| linked_at | datetime | No | Linking audit timestamp. |

Key constraints:

- Unique composite: (provider, provider_id)

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| users | many to 1 (FK auth_providers.user_id) | A single user can have multiple linked auth methods. |

---

## 17) password_reset_tokens

Why this table exists:
One-time tokens for password recovery flows.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| id (PK) | uuid/string | No | Unique reset request row ID. |
| user_id | uuid/string | No | User account targeted for password reset. |
| token | string (unique) | No | Unique secret token used in reset link. |
| expires_at | datetime | No | Token validity limit. |
| used | boolean | No | Single-use enforcement. |
| created_at | datetime | No | Request audit timestamp. |

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| users | Logical FK via password_reset_tokens.user_id | Reset token must map to one user account. |

---

## 18) user_profiles

Why this table exists:
Optional extended user profile fields kept outside auth-core table.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| id (PK) | uuid/string | No | Profile row identifier. |
| user_id | uuid/string (unique) | No | Owner user reference. |
| gender | string | Yes | Optional profile detail. |
| date_of_birth | date | Yes | Optional profile detail. |
| addresses | json | Yes | Flexible address payload storage for profile use cases. |
| created_at | datetime | No | Creation audit timestamp. |
| updated_at | datetime | No | Update audit timestamp. |

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| users | 1 to 1 (FK user_profiles.user_id, unique) | Exactly one extended profile per user. |

---

## 19) user_settings

Why this table exists:
Per-user preference settings and notification toggles.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| id (PK) | uuid/string | No | Settings row identifier. |
| user_id | uuid/string (unique) | No | Owner user reference. |
| notifications_enabled | boolean | No | Master notification toggle. |
| email_notifications | boolean | No | Email channel toggle. |
| sms_notifications | boolean | No | SMS channel toggle. |
| dark_mode | boolean | No | UI theme preference. |

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| users | 1 to 1 (FK user_settings.user_id, unique) | Exactly one settings row per user. |

---

## 20) customer_profiles

Why this table exists:
Customer-only extension table for loyalty, wallet, and order summary metrics.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| id (PK) | uuid/string | No | Customer profile row ID. |
| user_id | uuid/string (unique) | No | Owner user reference. |
| wallet_balance | decimal(10,2) | No | Stored-value balance tracking. |
| loyalty_points | int | No | Rewards/retention metric. |
| notification_prefs | json | No | Fine-grained customer notification settings. |
| total_orders | int | No | Aggregate order count metric. |
| total_spent | decimal(12,2) | No | Aggregate spend metric. |
| created_at | datetime | No | Creation timestamp. |
| updated_at | datetime | No | Update timestamp. |

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| users | 1 to 1 (FK customer_profiles.user_id, unique) | Exactly one customer profile extension per customer user. |

---

## 21) customer_addresses

Why this table exists:
Stores delivery addresses for marketplace checkout and fulfillment.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| address_id (PK) | uuid/string | No | Address row identifier. |
| user_id | uuid/string | No | Owner user. |
| label | string | No | Address tag such as Home/Work. |
| full_name | string | No | Recipient name for delivery. |
| phone | string | No | Recipient contact number. |
| line1 | string | No | Primary street address line. |
| line2 | string | Yes | Secondary address details. |
| landmark | string | Yes | Wayfinding helper. |
| city | string | No | City for routing and delivery. |
| state | string | No | State for logistics and tax context. |
| pincode | string | No | Postal code for serviceability. |
| latitude | decimal(9,6) | Yes | Geo-precision for delivery optimization. |
| longitude | decimal(9,6) | Yes | Geo-precision for delivery optimization. |
| is_default | boolean | No | Default checkout address selection. |
| created_at | datetime | No | Creation timestamp. |

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| users | many to 1 (FK customer_addresses.user_id) | A customer can maintain many addresses. |

---

## 22) customer_vehicle_garage

Why this table exists:
Stores customer-saved vehicles used to prefill fitment-aware browsing.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| garage_id (PK) | uuid/string | No | Saved vehicle row identifier. |
| user_id | uuid/string | No | Owner user. |
| vehicle_id | uuid/string | Yes | Optional canonical vehicle reference. |
| nickname | string | Yes | User-friendly label for saved vehicle. |
| make | string | No | Snapshot make field for display/filtering. |
| model | string | No | Snapshot model field for display/filtering. |
| variant | string | Yes | Snapshot variant field for fitment precision. |
| year | int | No | Snapshot year field for fitment precision. |
| fuel_type | string | Yes | Snapshot fuel type field. |
| registration_no | string | Yes | Optional registration identifier. |
| year_of_purchase | int | Yes | Lifecycle metadata. |
| is_default | boolean | No | Default selected vehicle for browsing. |
| created_at | datetime | No | Creation timestamp. |

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| users | many to 1 (FK customer_vehicle_garage.user_id) | A customer can save multiple vehicles. |
| vehicles | many to 1 optional (FK customer_vehicle_garage.vehicle_id) | Optional linkage to canonical vehicle catalog for exact fitment mapping. |

---

## 23) shop_users

Why this table exists:
Join table for staff membership between users and shops with role and permissions.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| id (PK) | uuid/string | No | Staff membership row ID. |
| shop_id | uuid/string | No | Target shop tenant. |
| user_id | uuid/string | No | Staff user account. |
| role | string | No | Staff role inside shop operations. |
| permissions | json | No | Per-role or custom permission map. |
| invited_by | uuid/string | Yes | Who invited this staff member. |
| is_active | boolean | No | Soft-active membership state. |
| joined_at | datetime | No | Membership creation timestamp. |
| last_active_at | datetime | Yes | Last activity metric for admin oversight. |

Key constraints:

- Unique composite: (shop_id, user_id)

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| shops | many to 1 (FK shop_users.shop_id) | Shop can have many staff memberships. |
| users | many to 1 (FK shop_users.user_id) | User can be linked into staff roster context. |

---

## 24) admin_profiles

Why this table exists:
Platform-internal admin extension table for ops/support permissions and controls.

Columns:

| Column | Type | Null | Why it exists |
| --- | --- | --- | --- |
| id (PK) | uuid/string | No | Admin profile row ID. |
| user_id | uuid/string (unique) | No | Admin user account reference. |
| admin_role | string | No | Internal admin role classification. |
| department | string | Yes | Organizational grouping. |
| permissions | json | No | Fine-grained admin permission set. |
| ip_whitelist | string[] | No | Optional IP allowlist security control. |
| created_at | datetime | No | Creation timestamp. |
| updated_at | datetime | No | Update timestamp. |

Connections and why they exist:

| Related table | Connection | Why relationship exists |
| --- | --- | --- |
| users | 1 to 1 (FK admin_profiles.user_id, unique) | Exactly one admin extension row per admin user. |

---

## Cross-table design rationale summary

- Global catalog and fitment are normalized in master_parts, vehicles, and part_fitments to avoid duplicating technical metadata per shop.
- Shop operating state is tenant-scoped via shop_id across shop_inventory, movements, invoices, and parties.
- Financial documents and stock ledger are separated into invoice headers/items and movements so accounting records remain auditable and stock logic remains explicit.
- Marketplace order and review entities are separated from ERP invoice entities because customer commerce lifecycle differs from in-store billing lifecycle.
- Identity is centralized in users, while provider links, sessions, profile extensions, and role-specific tables keep auth and domain concerns separated.
- Some references are currently logical (not Prisma FK relations), which preserves migration flexibility but requires careful application-level validation.
