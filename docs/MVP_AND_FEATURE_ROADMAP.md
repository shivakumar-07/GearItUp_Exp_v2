# MVP and Incremental Feature Roadmap

Last updated: 2026-04-09
Owner: Engineering lead

## 1) Product delivery strategy

We ship in controlled layers:

- Layer A: reliability of current core flows
- Layer B: complete MVP feature set for real pilot operations
- Layer C: growth features behind flags
- Layer D: scale features and automation

The rule is simple:

- no new major feature until prior layer has monitoring, rollback, and data migration safety

## 2) What counts as MVP for this repository

MVP is considered complete when these are true in production-like pilot:

- Auth works for shop owners and customers (phone/email/google variants)
- Shop owner can onboard a shop and run daily POS + inventory + parties
- Invoice generation, stock deduction, and movement ledger are consistent
- Catalog lookup (name/OEM/barcode) is usable for stock-in
- Marketplace browse and order creation work with fitment-aware filtering
- Core support flows exist: password reset, basic profile settings, session refresh

Current codebase status:

- Most MVP surfaces are implemented
- Remaining work is primarily hardening, observability, quality gates, and rollout controls

## 3) Phased plan

## Phase 0: Stabilize the current core (2-4 weeks)

Goals:

- eliminate data inconsistencies between local-first state and backend state
- lock down auth/session correctness
- establish baseline observability and operational runbooks

Deliverables:

- API contract freeze for existing ERP and auth endpoints
- migration audit for all current Prisma models
- one-click local bootstrap script and env checklist
- request logging + error classification dashboard
- smoke test scripts for auth, inventory, invoice, marketplace browse/order

Exit criteria:

- no P0 data corruption bugs for 2 consecutive weeks
- all critical flows pass smoke suite daily

## Phase 1: Pilot-grade MVP (4-8 weeks)

Goals:

- make MVP safe for real pilot shops
- close known ERP operational gaps

Deliverables:

- strict reconciliation job: stock_qty vs movement-derived stock
- party/payment ledger reconciliation report
- stronger idempotency for invoice/order submission
- feature flags for risky flows (bulk stock-in, marketplace reserve logic)
- role enforcement review for SHOP_OWNER vs SHOP_STAFF

Exit criteria:

- 5-10 pilot shops run daily workflows with acceptable support load
- invoice and stock reconciliation variance near zero

## Phase 2: Controlled marketplace expansion (6-10 weeks)

Goals:

- increase customer-facing adoption without destabilizing ERP core

Deliverables:

- order lifecycle reliability improvements (status transitions + audit)
- review moderation tooling
- better shop listing quality controls (price freshness, stock freshness)
- delivery partner abstraction layer (start with one provider)

Exit criteria:

- stable order success rate in pilot city
- manageable cancellation/refund support volume

## Phase 3: Scale and platformization (ongoing)

Goals:

- move from feature completion to platform discipline

Deliverables:

- eventing for key domain events (invoice created, stock adjusted, order status changed)
- analytics warehouse feed
- staff permissions hardening and policy engine
- deprecation of legacy local-only assumptions in frontend

Exit criteria:

- onboarding new shops/cities does not require custom engineering work

## 4) How we integrate new features slowly

Use this rollout pipeline for every new feature:

1. Problem framing
- Define exact user pain, target persona, and measurable success metric.

2. Contract first
- Add or update API contract and data model notes before UI work.

3. Flagged implementation
- Build behind a feature flag that defaults OFF.

4. Shadow mode
- Run feature logic in background (no user impact) and compare outputs vs current behavior.

5. Internal enablement
- Enable for internal users only and observe logs/metrics.

6. Pilot cohort rollout
- Enable for 1-2 pilot shops or a small customer segment.

7. Gradual ramp
- Ramp in steps (5 percent, 20 percent, 50 percent, 100 percent) with rollback checkpoints.

8. Clean-up
- Remove dead code paths and retire flags after stability window.

## 5) Required engineering guardrails for all new features

- Schema changes must be backward compatible for at least one release.
- Every stock-impacting workflow must create a movement row.
- Financial updates and stock updates must remain transactionally safe.
- Endpoint auth and tenant isolation checks are mandatory.
- Any new async integration must have retry policy, timeout, and dead-letter plan.

## 6) Feature intake scorecard (prioritization)

Score each candidate 1-5 on:

- revenue impact
- pilot shop demand frequency
- implementation risk
- support complexity
- dependency readiness

Prioritize high revenue + high demand + low/medium risk features first.

## 7) Suggested release cadence

- weekly: patch and bugfix release window
- bi-weekly: feature release window
- monthly: architecture and debt review

Each release should include:

- changelog
- migration notes
- rollback plan
- pilot impact note

## 8) Immediate next sprint recommendation

Sprint focus:

- finish Phase 0 hardening

Top tasks:

- add reconciliation command for ledger vs cached stock
- add basic API smoke tests and CI run target
- add feature-flag wrapper for marketplace order reserve logic
- document incident response for auth/session failures
