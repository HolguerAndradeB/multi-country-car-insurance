# Multi-Country Car Insurance Quoting Wizard (`CO` / `CL`)

Single-build **Angular 21+** quoting wizard backed by **Strapi 5+**, serving **Colombia (`CO`)** and **Chile (`CL`)** from one codebase and one command (`docker compose up --build`), built through a traceable, human-gated Spec-Driven Development (SDD) hybrid workflow (**Antigravity** + **OpenCode CLI**). See [`FLOW.md`](FLOW.md) for the complete AI-driven workflow diagram, step-by-step table, traceability links, and engineering reflection.

---

## 1. Quick Start (Single Command)

### Prerequisites
- **Docker Desktop** (with Docker Compose v2)
- *(Optional, for running front-end unit/E2E tests locally on host)* **Node.js 22+** and **npm**

### Start the Full Stack
From the repository root:

```bash
docker compose up --build
```

Once both containers are healthy (`multi-country-car-insurance-strapi-1` healthy and `multi-country-car-insurance-frontend-1` running):

| Service | URL | Notes |
| --- | --- | --- |
| **Angular 21+ Wizard** | `http://localhost:4200` | `/` automatically redirects to `/co/quote` (Colombia). Switch to Chile via the header selector or visit `http://localhost:4200/cl/quote`. |
| **Strapi 5+ Admin Panel** | `http://localhost:1337/admin` | Create a local administrator account on first visit. All Colombia & Chile seed data (`country-config`, `form-field`, `insurance-plan`) is populated idempotently on startup. |
| **Strapi Public Read-Only API (`CO` / `CL`)** | `http://localhost:1337/api/form-fields?filters[country][$eq]=CO&sort=order:asc&pagination[pageSize]=100`<br>`http://localhost:1337/api/insurance-plans?filters[country][$eq]=CO&filters[active][$eq]=true&sort=order:asc&pagination[pageSize]=100`<br>`http://localhost:1337/api/country-configs?filters[country][$eq]=CO` | Read-only public endpoints (`CO`: 9 form fields, 3 active + 1 inactive plans, 1 country config; `CL`: 8 form fields, 3 active + 1 inactive plans, 1 country config). Unauthenticated writes and `/api/users` return `401`/`403`. |

### Stop or Reset Data
- Stop containers:
  ```bash
  docker compose down
  ```
- Stop containers and wipe the SQLite volume (to verify fresh idempotent seeding on next startup):
  ```bash
  docker compose down -v
  ```

---

## 2. Verifying Zero-Redeploy Configurability & Simulated Rules

### Zero-Redeploy CMS Edits (`Strapi` → `Angular`)
Non-technical editors can update all three wizard steps from Strapi (`http://localhost:1337/admin`) without modifying Angular code or redeploying containers:

1. **Step 1 — Form Fields (`Form Field`):** Create, edit, reorder (`order`), or unpublish a field for `CO` or `CL`, save and **Publish**, then reload `/co/quote` or `/cl/quote` to see the updated form immediately while keeping valid in-progress drafts in `sessionStorage`.
2. **Step 2 — Insurance Plans (`Insurance Plan`):** Edit prices, coverages, benefits, toggle `recommended` (`"Recomendado"` badge), toggle `active`, or change `order`, save and **Publish**, then enter or reload `/:country/quote/plans` to reflect changes immediately.
3. **Step 3 — Terms & Masking (`Country Config`):** Edit `termsAndConditions` or `documentMaskVisibleEnd` (`min: 0`), save and **Publish**, then enter or reload `/:country/quote/summary` (`getCountryConfig` runs live on every Step 3 entry).

### Simulated Pricing Rule (Step 2 — `calculateAdjustedPrice`)
Price calculation is simulated cleanly client-side using integer arithmetic (`frontend/src/app/core/pricing/pricing.helper.ts`), relative to an injectable `QuoteClock` (`today`, `currentYear`), using only keys currently present in the Strapi field catalogue (`vehicleYear`, `birthDate`):
- **Vehicle age surcharge:** vehicles `> 5` years old add `+2%` per year over `5`, capped at `+30%` (vehicle age clamped `0..20`).
- **Driver age surcharge:** policyholder `< 25` years old adds `+10%`; policyholder `>= 60` years old adds `+5%`.
- **Total & rounding:** `adjustmentPercent = agePercent + driverPercent` (`0%..40%`), rounded half up to nearest integer COP/CLP (`Math.floor((basePrice * (100 + adjustmentPercent) + 50) / 100)`). Both base price and estimated final price are always displayed.

### Simulated Payment & Testing Failure Recovery (Step 3)
Payment is 100% simulated in the browser (`frontend/src/app/core/payment/simulated-payment.service.ts`) with zero network calls, zero card inputs, a synchronous double-submit lock, and deterministic quote numbers (`COT-<CO|CL>-<YYYYMMDD>-<XXXXXX>`).
- Per Checkpoint 3 (**Q2 Option A**), the production UI stays clean without extra failure-simulation buttons.
- To manually test payment rejection + retry recovery in the browser DevTools console on `/:country/quote/summary`:
  1. Run `window.__WIZARD_SIMULATE_PAYMENT_FAILURE__ = true`, accept terms, and click **Pagar** → displays a clear error alert while preserving all form data, chosen plan, and terms acceptance.
  2. Run `window.__WIZARD_SIMULATE_PAYMENT_FAILURE__ = false` and click **Reintentar pago** → payment completes cleanly with a simulated quote number.

---

## 3. Running Automated Tests & Quality Guards

With **Node.js 22+** installed locally (and the Docker Compose stack running on `:4200` and `:1337` for E2E):

```bash
cd frontend
npm ci
```

1. **Static API-boundary guard (`US01-U22`):** confirms zero `/api/` literals exist outside `core/catalogue/catalogue.api.ts`:
   ```bash
   npm run lint:api-guard
   ```
2. **Unit tests (Vitest — 170 tests across 15 spec files):**
   ```bash
   npm test -- --watch=false
   ```
3. **Production & development builds:**
   ```bash
   npm run build
   npx ng build --configuration development
   ```
4. **Playwright E2E suite (37 Chromium E2E tests across `us01-wizard.spec.ts`, `us02-plans.spec.ts`, and `us03-summary-payment.spec.ts` against Docker `:4200` & `:1337`):**
   ```bash
   npx playwright install chromium   # first time only
   npm run e2e
   ```

---

## 4. Architecture, Multi-Country Strategy & Security

| Concern | Decision | Reference |
| --- | --- | --- |
| **Multi-Country Strategy** | Explicit `country` enum (`CO` \| `CL`) in Strapi + canonical REST filtering paired with path-based Angular routing (`/:country/quote` → `/co/quote`, `/cl/quote`, `/plans`, `/summary`) and a single `CatalogueApi` choke point. | [`ADR-001`](docs/adrs/ADR-001-multi-country-content-strategy.md) |
| **Security & Permissions** | **Zero Strapi API tokens in the browser.** Strapi bootstrap programmatically locks the `Public` role to exactly 6 read-only actions (`find` and `findOne` on `form-field`, `country-config`, `insurance-plan`) and revokes all write/plugin permissions (`POST`/`PUT`/`DELETE` and `/api/users` return `401`/`403`). Ephemeral Docker secrets are generated at runtime inside the container volume—no `.env` files or secrets exist in Git. | [`ADR-002`](docs/adrs/ADR-002-strapi-security-and-permissions.md) |
| **Front-End Persistence & SDD** | Country-scoped `sessionStorage` (`wizard:state:v1:<CO\|CL>`, 2-hour idle TTL) backed by `WizardStore` signals. Payment confirmation and terms acceptance stay in-memory only (`schemaVersion: 1`). Operated via custom lightweight SDD using Antigravity + OpenCode (`opencode/deepseek-v4.1-flash-free` initially, switching to `opencode/big-pickle` after free quota exhaustion). | [`ADR-003`](docs/adrs/ADR-003-frontend-persistence-and-sdd-workflow.md) |
| **Global Agent Conventions** | Mandatory Angular 21+ (`standalone`, `signals`, `@if`/`@for`/`@switch`, `OnPush`, `inject()`, strict TS), Strapi 5+ flattened responses, accessibility, and traceability rules. | [`AGENTS.md`](AGENTS.md) |

---

## 5. Repository Structure & Traceability

```text
.
├── AGENTS.md                        # Global conventions governing all AI agents & subagents
├── FLOW.md                          # Complete agentic flow docs, Mermaid diagram, table & reflections
├── README.md                        # Setup instructions, verification & requirements status
├── docker-compose.yml               # Single-command startup (Strapi 5 + Angular 21 Nginx)
├── .env.example                     # Optional port/CORS/secret override template (no secrets)
├── .opencode/
│   ├── agents/                      # Versioned subagents (spec-analyst, strapi-dev, angular-dev, tester-dev, code-reviewer)
│   └── skills/                      # Versioned domain skills (strapi-multi-country, angular-dynamic-wizard)
├── docs/
│   ├── user-stories/                # Functional user stories (US-01, US-02, US-03)
│   ├── adrs/                        # Accepted MADR Architecture Decision Records (ADR-001..003)
│   ├── reviews/                     # Approved independent code review reports (US-01..03)
│   └── session-logs/                # 16 unedited OpenCode session JSON exports (01..16)
├── specs/                           # Approved SDD specifications per user story (US-01..03)
├── backend/                         # Strapi 5+ TypeScript project, schemas & idempotent CO/CL bootstrap seed
└── frontend/                        # Angular 21+ standalone/signals app, Vitest unit tests & Playwright E2E tests
```

---

## 6. Requirements Status & Explicit Scope Notes

### Met & Verified Requirements (`US-01` through `US-03`)
- **`US-01` — Dynamic Policyholder & Vehicle Form:** Country-scoped CO (`9` fields) / CL (`8` fields) Strapi rendering, typed validations (`required`, `regex`, `legalAge`, `vehicleYear`, Chilean RUT módulo-11, Colombian CC/CE rules), zero-redeploy Strapi edits, back-navigation & `sessionStorage` draft isolation (`wizard:state:v1:<CO|CL>`). Verified in [`US-01-review.md`](docs/reviews/US-01-review.md) (`2e514b4`).
- **`US-02` — Plan List & Simulated Pricing:** Strapi `insurance-plan` content type (`active` boolean + CO/CL seeds of 3 active + 1 inactive plans), single-select radio cards, `"Recomendado"` badge, integer simulated price adjustment + `COP`/`CLP` formatting, empty-plans blocking panel, stale-plan recovery, and back-edit recalculation. Verified in [`US-02-review.md`](docs/reviews/US-02-review.md) (`ab2cb67`).
- **`US-03` — Summary & Simulated Payment:** Read-only `Tomador`, `Vehículo`, and `Plan elegido` sections resolved from Strapi labels/options, partial document masking (`documentMaskVisibleEnd` + RUT `-K` protection), live country-specific `termsAndConditions` refresh gating the Pay button, synchronous double-submit lock, deterministic quote number (`COT-<CO|CL>-<YYYYMMDD>-<XXXXXX>`), simulated rejection + retry without losing data, and `"Nueva cotización"` clearing country drafts. Verified in [`US-03-review.md`](docs/reviews/US-03-review.md) (`34579e8`).
- **Full Technical, Security, Accessibility & Responsive Suite:** `15` Vitest files / `170` unit tests passing, `37` Playwright E2E specs passing (`6` US-01 + `15` US-02 + `16` US-03) including full CO/CL 3-step flows, keyboard-only operation, ARIA wiring, `375px` / `768px` / `1280px` responsiveness, static `/api/` guard (`US01-U22`), and Strapi `Public` role security (`401`/`403` on writes & `/api/users`).
- **Agentic Flow & Artifacts (`65%` weight):** `AGENTS.md`, `FLOW.md`, 5 versioned subagents, 2 custom skills, 3 MADR ADRs, 3 approved specs, 3 approved code review reports with verified fixes, and 16 unedited OpenCode session JSON logs.

### Requirements Intentionally Deferred / Constrained
- **Public API Rate Limiting:** Deferred to reverse-proxy / hosting infrastructure ([`ADR-002`](docs/adrs/ADR-002-strapi-security-and-permissions.md) §8.4) rather than hardcoded inside Strapi middleware.
- **Paid LLM Providers:** Not used; free OpenCode models (`opencode/deepseek-v4.1-flash-free`, then `opencode/big-pickle` upon free-tier limit) were used transparently in accordance with the assessment rules.
