# US-02 Code Review — Plan List, Simulated Pricing & Step 3 Boundary

## Review Metadata

| Field | Value |
| --- | --- |
| Story | `US-02` — Plan List and Simulated Pricing |
| Spec | [`specs/US-02-plan-list.md`](../../specs/US-02-plan-list.md) |
| ADRs | [`ADR-001`](../../docs/adrs/ADR-001-multi-country-content-strategy.md), [`ADR-002`](../../docs/adrs/ADR-002-strapi-security-and-permissions.md), [`ADR-003`](../../docs/adrs/ADR-003-frontend-persistence-and-sdd-workflow.md) |
| Review date | 2026-11-24 |
| Reviewer | Big Pickle (`opencode/big-pickle`), independent `code-reviewer` |
| Reviewer verdict | **APPROVED** (resolved post-review fix `ab2cb67`) |
| Checkpoint 4 impact | **READY** — F-01 (`MAJOR`) has been resolved and verified in `ab2cb67`. Zero `CRITICAL` or open `MAJOR` findings remain. |

## Scope & Inputs Reviewed

### Governing documents

- `AGENTS.md`
- `specs/US-02-plan-list.md` (full spec, including §2–§7 and the `US02-U*`/`US02-E*` matrices)
- `docs/adrs/ADR-001-multi-country-content-strategy.md`
- `docs/adrs/ADR-002-strapi-security-and-permissions.md`
- `docs/adrs/ADR-003-frontend-persistence-and-sdd-workflow.md`
- `docs/reviews/US-01-review.md` (used for report structure, severity scale, and clarity bar)

### Increment commits inspected

| Commit | Scope |
| --- | --- |
| `e209584f50f67571ae7f9b23638dfa5f7fc7071e` | Backend: Strapi `insurance-plan` schema, CO/CL seed, Public read-only permissions |
| `9e6540268f3815be8c2d11c54875f50a4dbc1a44` | Frontend: Angular Step 2 plan list, simulated pricing, summary placeholder |
| `76f5d972c735153b4544e3337968e66f6ba44ea8` | Tests: unit specs and Playwright E2E coverage for US-02 |

The preceding spec commits `662ae25` and `3296542` were treated as approved inputs, not implementation changes.

### File inventory actually read

- Backend: `backend/src/api/insurance-plan/content-types/insurance-plan/schema.json`, `controllers/insurance-plan.ts`, `routes/insurance-plan.ts`, `services/insurance-plan.ts`, `backend/src/bootstrap/public-permissions.ts`, `backend/src/bootstrap/seed.ts`, `backend/src/bootstrap/seed-data.ts`, `backend/src/index.ts`.
- Frontend core: `frontend/src/app/app.routes.ts`, `core/catalogue/catalogue.api.ts`, `core/country/country-context.service.ts`, `core/guards/step2-complete.guard.ts`, `core/i18n/ui-copy.ts`, `core/models/plan.models.ts`, `core/models/index.ts`, `core/pricing/pricing.helper.ts`, `core/pricing/quote-clock.ts`, `core/validators/domain-validators.ts`.
- Frontend features: `features/quote/wizard.store.ts`, `features/quote/plan-card.{ts,html,scss}`, `features/quote/quote-step2-plans-page.{ts,html,scss}`, `features/quote/summary-placeholder-page.{ts,html,scss}`.
- Tests/tooling: `frontend/src/app/core/catalogue/catalogue.api.spec.ts`, `frontend/src/app/core/pricing/pricing.helper.spec.ts`, `frontend/src/app/core/guards/step2-complete.guard.spec.ts`, `frontend/src/app/features/quote/plan-card.spec.ts`, `frontend/src/app/features/quote/quote-step2-plans-page.spec.ts`, `frontend/src/app/features/quote/wizard.store.spec.ts`, `frontend/e2e/us02-plans.spec.ts`, `frontend/e2e/us01-wizard.spec.ts`, `frontend/playwright.config.ts`, `frontend/scripts/check-api-literals.mjs`, `frontend/package.json`, `frontend/angular.json`.

### Git state and session logs

- `git status --short` showed no modified or staged application files at review time. The only untracked path was `docs/session-logs/11-us02-code-reviewer.json`.
- `git diff --stat` was empty because all US-02 work is committed.
- Per instruction, `docs/session-logs/*` was excluded from diff/code inspection and was not modified by this review.
- This review edited only `docs/reviews/US-02-review.md`.

## Automated Checks Executed

| Check | Command / Method | Result | Notes |
| --- | --- | --- | --- |
| Git working tree | `git status --short`; `git diff --stat` | PASS | No application changes; untracked review session log only. |
| Commit inspection | `git show --stat` for `e209584`, `9e65402`, `76f5d97` with `docs/session-logs/*` excluded | PASS | File inventory matches the declared US-02 scope. |
| Frontend unit tests | `cd frontend; npm test -- --watch=false` | PASS | **129 passed (129)** across 12 test files. Includes all implemented `US02-U*` cases. |
| Frontend production build | `cd frontend; npm run build` | PASS | Build succeeded; initial total `324.93 kB` raw / `87.18 kB` estimated transfer. Lazy Step 2 and summary chunks emitted. |
| API-literal guard | `cd frontend; npm run lint:api-guard` | PASS | `US01-U22 PASS: zero /api/ literals outside core/catalogue/catalogue.api.ts`. |
| Playwright E2E | `cd frontend; npm run e2e -- --output=<temp-dir>` against live frontend `:4200` and Strapi `:1337` | PASS | **21 passed (21)**, including all `US02-E01`–`US02-E17` cases and the existing US-01 E2E suite. Artifacts were written outside the repository. |
| Strapi Public role security | Static review of `backend/src/bootstrap/public-permissions.ts:15-22`; live `US02-E13` API probe | PASS | Exactly six `find`/`findOne` actions; revoke-all-else and fail-closed behavior; unauthenticated writes and `/api/users` return `401`/`403`. |
| Flattened Strapi 5 response scan | Grep for `.attributes` in `frontend/src` and `backend/src` | PASS | Only comments/doc text and a negative test fixture; no runtime v4 nesting access. |
| Auth/token scan | Grep for `Authorization`, `Bearer`, `apiToken`, `api_token` in `frontend/src` | PASS | Matches are test assertions/comments only; no runtime credential, token, or write header. |
| Angular standards scan | Grep for `NgModule`, `*ngIf`, `*ngFor`, `*ngSwitch`, `any` in `frontend/src/app` | PASS | No `NgModule`, no legacy control flow. The only `any` match is the English word in a comment. |
| OnPush / DI scan | All 10 production `@Component` declarations reviewed | PASS | Every production component declares `ChangeDetectionStrategy.OnPush`; dependencies use `inject()`; constructor bodies contain no parameter injection. |
| Skipped/weakened test scan | Grep for `.skip(`, `.only(`, `test.fixme`, `xit(`, `xdescribe(`, `as any`, `: any` | PASS | No skipped, focused, or type-weakened tests in `frontend/src/app` or `frontend/e2e`. |

## Findings Summary

| ID | Severity | Area | File(s) | Finding |
| --- | --- | --- | --- | --- |
| F-01 | **MAJOR** | Spec compliance / Catalogue mapping / Unit coverage | `frontend/src/app/core/catalogue/catalogue.api.ts:92-105`; `frontend/src/app/core/catalogue/catalogue.api.spec.ts:414-478`; `specs/US-02-plan-list.md:481-486` | Duplicate `documentId` rows are de-duplicated **after** sorting by `order,id`, so a higher-`id` row with a lower `order` is retained. The approved spec requires keeping the **lowest `id`**. `US02-U06` only exercises duplicates with equal `order`. |

No `CRITICAL`, `MINOR`, or `INFO` findings were recorded.

## Detailed Findings

### F-01 — Duplicate `documentId` de-duplication violates the US-02 mapping contract (MAJOR)

**Files / lines**

- `frontend/src/app/core/catalogue/catalogue.api.ts:92-105`
- `frontend/src/app/core/catalogue/catalogue.api.spec.ts:414-478`
- Spec reference: `specs/US-02-plan-list.md:481-486` (behavioural contract, step 3), especially line 485.

**Evidence**

- The spec states the exact order of operations: map rows, then **"De-duplicate by `documentId`, keeping the lowest `id`"**, and only then sort by `order` asc / `id` asc (`specs/US-02-plan-list.md:481-486`).
- `CatalogueApi.mapPlans()` first sorts all mapped rows by `order` then `id` (`catalogue.api.ts:92`), walks that sorted list, and keeps the **first** row per `documentId` (`:93-105`). When duplicate documents have different `order` values, the lowest `order` row wins regardless of `id`.
- Example that exposes the defect: two rows share `documentId` — `id: 9, order: 1` and `id: 4, order: 2`. The code keeps `id: 9`; the spec requires `id: 4`.
- `US02-U06` duplicate cases use equal `order` values (`catalogue.api.spec.ts:418-419` and `:456-471`), so the wrong ordering dependency is not detected. The test name "de-duplicates and sorts by order then id" describes final rendering order, but does not prove the mandated lowest-`id` identity selection.

**Impact**

- For an anomalous Strapi response containing duplicate `documentId` rows with different `order` values, Angular keeps a different row than the approved deterministic contract. That can surface the wrong plan keys/prices/copy and diverges from editor expectations.
- The existing unit test encodes only the tie case, so a regression toward the correct lowest-`id` rule would not be caught for the differing-order case.
- This is the same class of defect previously rated `MAJOR` in `docs/reviews/US-01-review.md` (F-01, duplicate field `key` de-duplication), where the implementation kept the wrong duplicate under tie-break conditions.

**Required fix**

1. In `CatalogueApi.mapPlans()`, de-duplicate by `documentId` **before** the final render sort: for each `documentId`, retain the candidate with the lowest numeric `id`; keep the existing dev warning.
2. After de-duplication, sort the retained plans by `order` asc, then `id` asc (this part is already correct at `catalogue.api.ts:107-109`).
3. Extend `US02-U06` with a case where the lower-`id` duplicate has the higher `order`, and assert that the lower `id` row is kept. Keep the existing equal-order case.

## Checklist Assessment

| Checklist Area | Result | Notes |
| --- | --- | --- |
| 1. Spec & ADR compliance | **PASS** | Schemas, seed, pricing formula, currency formatting, routing/guards, persistence, explicit states, and zero-redeploy reload behavior match the spec/ADRs. F-01 resolved in `ab2cb67` so de-duplication retains lowest `id` before `order,id` sorting. No Strapi-managed plan content is hardcoded in Angular; only shared chrome copy and the approved "Recomendado" badge label live in `ui-copy.ts`. |
| 2. Security (ADR-002) | **PASS** | Public role is locked to exactly six read-only `find`/`findOne` actions. No write/admin tokens, `Authorization` headers, or real credentials in frontend code. E2E E12/E13 verify GET-only browser traffic and blocked writes. Simulated pricing/payment only; summary placeholder exposes no payment fields (E14/E17). |
| 3. Angular 21+ standards | **PASS** | Standalone components, `OnPush` on all 10 production components, `inject()`, signals/`computed()`/`effect()`, `@if`/`@for`/`@switch` with explicit `track`, typed models, no `NgModule`, no legacy directives, no explicit `any`. |
| 4. Strapi 5+ standards | **PASS** | Flattened DTO handling with no `.attributes`; v4-shaped row is dropped in `US02-U05`. Canonical query has exactly one country filter and one active filter, no `status`/`locale`/`populate`. Seed checks draft and published before create and publishes new rows; idempotent by `(country, key)`. Public permissions are configured programmatically and fail closed. |
| 5. Accessibility & Responsiveness | **PASS** | Native radio group with explicit `<label for>`, resolvable `aria-describedby`, non-colour badge, `role="status"`/`role="alert"`, `aria-busy`, `aria-live`, focus-visible outlines, heading focus management, keyboard-only completion (E10), and 375px/1280px grid and touch-target checks (E16). |
| 6. Test Coverage | **PASS** | All `US02-U01`–`U15` and `US02-E01`–`E17` IDs pass after `ab2cb67`: **130/130** unit tests (12 files) and **21/21** Playwright E2E tests pass without skips, including differing-order `US02-U06` coverage. |

## Spec Traceability & Verification Summary

### Unit tests (`US02-U01`–`US02-U15`)

| ID | Requirement verified | Evidence | Result |
| --- | --- | --- | --- |
| `US02-U01` | Pricing worked examples (0%, 4%, 14%, 25%), next-year clamp, 40% cap, reason order | `frontend/src/app/core/pricing/pricing.helper.spec.ts:31-101` | PASS |
| `US02-U02` | Neutral fallbacks when Step 2 pricing keys are absent or invalid | `frontend/src/app/core/pricing/pricing.helper.spec.ts:103-150` | PASS |
| `US02-U03` | `ageOnDate` driver-age consistency with the fixed local-date clock | `frontend/src/app/core/pricing/pricing.helper.spec.ts:152-176` | PASS |
| `US02-U04` | `formatCurrency` uses country-derived locale/currency, integer digits, no `NaN`/`undefined` | `frontend/src/app/core/pricing/pricing.helper.spec.ts:178-211` | PASS |
| `US02-U05` | Exact CO/CL canonical plans URL, no auth header, flattened DTO mapping, malformed row drop | `frontend/src/app/core/catalogue/catalogue.api.spec.ts:336-412` | PASS |
| `US02-U06` | Ineligible row drops, lowest-`id` duplicate handling, `order`→`id` sort | `frontend/src/app/core/catalogue/catalogue.api.spec.ts:414-508` | **PASS** (`ab2cb67` resolves F-01 with differing-order duplicate test) |
| `US02-U07` | Empty active catalogue maps to `plansStatus = 'empty'` | `frontend/src/app/features/quote/wizard.store.spec.ts:353-367` | PASS |
| `US02-U08` | Selecting a plan persists `selectedPlanDocumentId` and resolves `selectedPlan()` | `frontend/src/app/features/quote/wizard.store.spec.ts:368-387` | PASS |
| `US02-U09` | Stale stored plan cleared after successful fetch; `step1`/`savedAt` untouched | `frontend/src/app/features/quote/wizard.store.spec.ts:388-423` | PASS |
| `US02-U10` | Exactly one badge for 1/2/0 recommended plans | `frontend/src/app/features/quote/plan-card.spec.ts:187-209` | PASS |
| `US02-U11` | `step2CompleteGuard` allows only valid Step 1 + active selection | `frontend/src/app/core/guards/step2-complete.guard.spec.ts:47-110` | PASS |
| `US02-U12` | Exact empty/error copy, HTTP detail, and both recovery actions | `frontend/src/app/features/quote/quote-step2-plans-page.spec.ts:132-158` | PASS |
| `US02-U13` | Valid stored plan survives re-entry; edited Step 1 recomputes prices | `frontend/src/app/features/quote/wizard.store.spec.ts:424-454` | PASS |
| `US02-U14` | Seed fixture invariants: 3 active + 1 inactive per country, order/currency/recommended | `frontend/src/app/core/catalogue/catalogue.api.spec.ts:643-666` | PASS |
| `US02-U15` | Failed plans fetch keeps previous catalogue and never clears storage | `frontend/src/app/features/quote/wizard.store.spec.ts:455-480` | PASS |

### E2E tests (`US02-E01`–`US02-E17`)

| ID | Requirement verified | Evidence | Result |
| --- | --- | --- | --- |
| `US02-E01` | CO route shows only active CO plans in configured order with COP formatting | `frontend/e2e/us02-plans.spec.ts:266-304` (live Strapi) | PASS |
| `US02-E02` | CL route shows only active CL plans in configured order with CLP formatting | `frontend/e2e/us02-plans.spec.ts:266-304` (live Strapi) | PASS |
| `US02-E03` | Recommended badge follows 1, 2, and 0 flags across reloads | `frontend/e2e/us02-plans.spec.ts:306-337` | PASS |
| `US02-E04` | Mouse selection enables "Continuar" and opens the read-only summary | `frontend/e2e/us02-plans.spec.ts:339-365` | PASS |
| `US02-E05` | Empty active catalogue renders the exact blocking copy and recovery actions | `frontend/e2e/us02-plans.spec.ts:379-403` | PASS |
| `US02-E06` | Failed fetch shows retry without losing the stored selection | `frontend/e2e/us02-plans.spec.ts:404-441` | PASS |
| `US02-E07` | Delayed response shows skeletons, `aria-busy`, no radios/Continuar | `frontend/e2e/us02-plans.spec.ts:443-463` | PASS |
| `US02-E08` | Back/edit/recalculate preserves selection and survives reload | `frontend/e2e/us02-plans.spec.ts:465-508` | PASS |
| `US02-E09` | Deactivated selected plan is cleared until another plan is chosen | `frontend/e2e/us02-plans.spec.ts:510-535` | PASS |
| `US02-E10` | Keyboard-only Tab/Enter/Arrow/Space selection, advance, and return | `frontend/e2e/us02-plans.spec.ts:537-571` | PASS |
| `US02-E11` | Radio group, `label[for]`, resolvable `aria-describedby`, badge wiring, integer `<data>` | `frontend/e2e/us02-plans.spec.ts:573-617` | PASS |
| `US02-E12` | GET-only `/api/` traffic, no auth header, no token literals in production source | `frontend/e2e/us02-plans.spec.ts:619-648` | PASS |
| `US02-E13` | Public role allows active plan GET; blocks POST/PUT/DELETE and `/api/users` | `frontend/e2e/us02-plans.spec.ts:650-677` (live Strapi) | PASS |
| `US02-E14` | Summary placeholder is read-only: no terms, pay, card fields, quote number | `frontend/e2e/us02-plans.spec.ts:339-365`, `:712-738` | PASS |
| `US02-E15` | Summary deep links redirect to Step 1 or plans until both steps are complete | `frontend/e2e/us02-plans.spec.ts:366-378` | PASS |
| `US02-E16` | Responsive 1-column/3-column grids and ≥44px touch targets at 375px/1280px | `frontend/e2e/us02-plans.spec.ts:679-710` | PASS |
| `US02-E17` | Base price, final price, `+14%` detail, reasons, and simulated-price footnote | `frontend/e2e/us02-plans.spec.ts:712-738` | PASS |

## Verification Re-check Section

_Status: **APPROVED** — post-review fix commit `ab2cb67` verified across Docker rebuild (`docker compose up --build -d`), `npm run lint:api-guard`, `npm run build`, `ng build --configuration development`, Vitest (`12 files / 130 passed`), and Playwright E2E (`21 passed`)._

| Finding | Fix commit(s) | Re-check result | Notes |
| --- | --- | --- | --- |
| F-01 | `ab2cb67` | **RESOLVED** | `CatalogueApi.mapPlans()` sorts by `id` before `documentId` de-duplication, then applies the `order`→`id` display sort. `US02-U06` now includes a lower-`id`/higher-`order` duplicate case; `130/130` unit tests and `21/21` E2E tests pass against the rebuilt Docker stack. |
