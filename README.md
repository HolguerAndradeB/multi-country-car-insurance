# Multi-Country Car Insurance Quoting Wizard (`CO` / `CL`)

Single-build **Angular 21+** quoting wizard backed by **Strapi 5+**, serving **Colombia (`CO`)** and **Chile (`CL`)** from one codebase and one command (`docker compose up`), developed through a traceable, human-gated Spec-Driven Development (SDD) hybrid workflow (**Antigravity** + **OpenCode**).

---

## 1. Quick Start (Single Command)

### Prerequisites
- **Docker Desktop** (with Docker Compose v2)
- *(Optional, for running front-end unit/E2E tests directly on host)* **Node.js 22+** and **npm**

### Start the Full Stack
From the repository root:

```bash
docker compose up --build
```

Once both containers are healthy:

| Service | URL | Notes |
| --- | --- | --- |
| **Angular 21+ Wizard** | `http://localhost:4200` | `/` automatically redirects to `/co/quote` (Colombia). Switch to Chile via the header selector or visit `http://localhost:4200/cl/quote`. |
| **Strapi 5+ Admin Panel** | `http://localhost:1337/admin` | Create a local administrator account on first visit. All Colombia & Chile seed data is already populated automatically on startup. |
| **Strapi Public Read-Only API** | `http://localhost:1337/api/form-fields?filters[country][$eq]=CO&sort=order:asc&pagination[pageSize]=100` | Read-only public endpoints (`CO` returns 9 fields; `CL` returns 8 fields; `country-configs` returns 1 record per country). |

### Stop or Reset Data
- Stop containers:
  ```bash
  docker compose down
  ```
- Stop containers and wipe the SQLite volume (to test a clean fresh seed on next `up`):
  ```bash
  docker compose down -v
  ```

---

## 2. Verifying Zero-Redeploy Configurability

Non-technical business editors can modify form fields without changing code or rebuilding Angular:

1. Start the stack with `docker compose up --build`.
2. Open `http://localhost:1337/admin` and sign in with your local admin account.
3. Go to **Content Manager → Form Field**, click **Create new entry** (for example, `key: contactEmail`, `label: Correo electrónico`, `type: text`, `country: CO`, `section: policyholder`, `order: 10`), and click **Save** then **Publish**.
4. Reload `http://localhost:4200/co/quote` in your browser.
5. The new field renders immediately in the configured order while preserving any valid in-progress draft in `sessionStorage`.

---

## 3. Running Automated Tests & Quality Guards

With Node.js 22+ installed locally, run from `frontend/`:

```bash
cd frontend
npm ci
```

1. **Static API-boundary guard (`US01-U22`):** confirms zero `/api/` literals exist outside `core/catalogue/catalogue.api.ts`:
   ```bash
   npm run lint:api-guard
   ```
2. **Unit tests (Vitest — 79 tests across 8 spec files):**
   ```bash
   npm test -- --watch=false
   ```
3. **Production & development builds:**
   ```bash
   npm run build
   npx ng build --configuration development
   ```
4. **Playwright E2E suite (6 specs against the running Docker Compose stack on `:4200` and `:1337`):**
   ```bash
   npx playwright install chromium   # first time only
   npm run e2e
   ```

---

## 4. Architecture, Multi-Country Strategy & Security

| Concern | Decision | Reference |
| --- | --- | --- |
| **Multi-Country Strategy** | Explicit `country` enum (`CO` \| `CL`) in Strapi + REST query filtering (`filters[country][$eq]=...&sort=order:asc`) paired with path-based Angular routing (`/:country/quote` -> `/co/quote`, `/cl/quote`) and a single `CatalogueApi` choke point. | [`ADR-001`](docs/adrs/ADR-001-multi-country-content-strategy.md) |
| **Security & Permissions** | **Zero Strapi API tokens in the browser.** Strapi bootstrap programmatically locks the `Public` role to read-only `find` and `findOne` on strictly required public content types and revokes all write/plugin permissions (`POST`/`PUT`/`DELETE` return `401`/`403`). Ephemeral local Docker secrets are generated at runtime inside the container volume—no `.env` files or secrets are committed to Git. | [`ADR-002`](docs/adrs/ADR-002-strapi-security-and-permissions.md) |
| **Front-End Persistence & SDD** | Country-scoped `sessionStorage` (`wizard:state:v1:<CO\|CL>`, 2-hour idle TTL) backed by an Angular Signal store (`WizardStore`). Custom lightweight Spec-Driven Development (SDD) without external SDD frameworks, operated via Antigravity + OpenCode (using free OpenCode models `opencode/deepseek-v4.1-flash-free` and `opencode/big-pickle`) with unedited session exports. | [`ADR-003`](docs/adrs/ADR-003-frontend-persistence-and-sdd-workflow.md) |
| **Global Agent Conventions** | Mandatory Angular 21+ (`standalone`, `signals`, `@if`/`@for`/`@switch`, `OnPush`, `inject()`, strict TS), Strapi 5+ flattened responses, accessibility, and traceability rules. | [`AGENTS.md`](AGENTS.md) |

---

## 5. Repository Structure & Traceability

```text
.
├── AGENTS.md                        # Global rules governing all AI agents & subagents
├── README.md                        # Setup instructions, verification & status checklist
├── docker-compose.yml               # Single-command startup (Strapi 5 + Angular 21 Nginx)
├── .env.example                     # Optional port/CORS/secret override template (no secrets)
├── .opencode/
│   ├── agents/                      # Versioned subagents (spec-analyst, strapi-dev, angular-dev, tester-dev, code-reviewer)
│   └── skills/                      # Versioned domain skills (strapi-multi-country, angular-dynamic-wizard)
├── docs/
│   ├── user-stories/                # Functional user stories (US-01, US-02, US-03)
│   ├── adrs/                        # Accepted MADR Architecture Decision Records (ADR-001..003)
│   ├── reviews/                     # Independent code review reports and resolution logs
│   └── session-logs/                # Unedited OpenCode session JSON exports
├── specs/                           # Approved SDD specifications per user story
├── backend/                         # Strapi 5+ TypeScript project, schemas, and idempotent bootstrap seed
└── frontend/                        # Angular 21+ standalone/signals app, unit tests, and Playwright E2E tests
```

Traceability chain enforced per increment:
`User Story` → `Spec` → `ADR` → `Code` → `Tests (Unit + E2E)` → `Code Review` → `Fix Commits`

---

## 6. Requirements Status & Requirements Not Yet Met

### Completed & Verified (`US-01`)
- **Single-build Angular 21+ app:** standalone components, signals, `@if`/`@for`/`@switch`, `OnPush`, `inject()`, strict TypeScript, zero `NgModule`s.
- **Strapi 5+ CMS (`backend/`):** `form-field` and `country-config` content types (`localeCode` used instead of Strapi 5 reserved `locale`), idempotent bootstrap seed (`9` CO fields, `8` CL fields, `2` country configs), programmatic read-only `Public` permissions (`403` verified on unauthenticated writes).
- **Step 1 Dynamic Wizard (`US-01`):** country-scoped form rendering (`CO` vs `CL`), typed validations (required, regex, `legalAge`, `vehicleYear`, Chilean RUT módulo-11, Colombian CC/CE rules), reload reconciliation, `sessionStorage` draft isolation, keyboard-only navigation, ARIA semantics, responsive `375px` / `1280px+` layout.
- **Verification:** `79/79` unit tests passing, `US01-U22` static guard passing, `6/6` Playwright E2E specs passing against live Docker Compose, and [`US-01-review.md`](docs/reviews/US-01-review.md) approved after resolving all findings in commit `2e514b4`.

### Requirements Not Yet Met (Pending Upcoming Increments)
- **`US-02` — Plan List Screen:** Strapi `insurance-plan` content type and CO/CL seed, active/published filtering, recommended badge, documented simulated price adjustment rule, single-plan selection, and empty-plans state are not yet implemented. Route `/:country/quote/plans` currently renders a temporary placeholder shell (`PlansPlaceholderPageComponent`) solely to verify `US-01` Step 2 → Step 1 back-navigation.
- **`US-03` — Summary & Simulated Payment Screen:** Summary display with partially masked identity document, country-specific Strapi `termsAndConditions` acceptance gating the Pay button, double-submit lock, simulated confirmation with quote number, and simulated failure + retry without data loss are not yet implemented (`/:country/quote/summary` is not yet routed).
- **Full 3-Step E2E Flow Test:** Current Playwright E2E suite verifies `US-01` (Step 1 → Step 2 placeholder → Back); full Steps 1–3 checkout E2E coverage will be completed upon `US-03` delivery.
- **`FLOW.md`:** Full workflow table, Mermaid diagram, and reflection answers will be finalized once `US-02` and `US-03` are completed so the documented flow reflects every real session and adjustment.

### Deferred Beyond MVP Scope (Justified in ADRs)
- **Public API Rate Limiting:** Deferred to reverse-proxy / hosting infrastructure ([`ADR-002`](docs/adrs/ADR-002-strapi-security-and-permissions.md) §8.4).
- **Paid LLM Providers:** Not used; free OpenCode models (`opencode/deepseek-v4.1-flash-free` and fallback `opencode/big-pickle`) are used per test rules.
