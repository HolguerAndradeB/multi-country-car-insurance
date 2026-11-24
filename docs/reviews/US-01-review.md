# US-01 Code Review — Policyholder & Vehicle Data Capture

## Review Metadata

| Field | Value |
| --- | --- |
| Story | `US-01` — Policyholder & Vehicle Data Capture |
| Spec | [`specs/US-01-policyholder-vehicle-form.md`](../../specs/US-01-policyholder-vehicle-form.md) |
| Review date | 2026-11-23 |
| Reviewer | `code-reviewer` (Independent Code Reviewer) |
| Verdict | **APPROVED (All findings resolved in `2e514b4`)** |

## Scope & Inputs Reviewed

- `AGENTS.md`
- `specs/US-01-policyholder-vehicle-form.md`
- `docs/adrs/ADR-001-multi-country-content-strategy.md`
- `docs/adrs/ADR-002-strapi-security-and-permissions.md`
- `docs/adrs/ADR-003-frontend-persistence-and-sdd-workflow.md`
- `backend/src/**` (bootstrap, seed, content-type schemas, routes/controllers)
- `frontend/src/**` (app shell, routing, core, features/quote, shared, styles, env, specs)
- `frontend/package.json`, `frontend/angular.json`
- Git state: `git status --short` and `git diff --stat` (both empty)

## Automated Checks Executed

| Check | Command / Method | Result | Notes |
| --- | --- | --- | --- |
| Git working tree | `git status --short`; `git diff --stat` | PASS | No modified/staged files at review time. |
| Env hygiene | `git ls-files -- .env backend/.env frontend/.env .env.local backend/.env.local frontend/.env.local`; `git check-ignore -v backend/.env frontend/.env .env` | PASS | No tracked `.env` files; ignore rules present. |
| Frontend unit tests | `cd frontend; npm test -- --watch=false` | PASS | `55 passed (55)`, `9` test files, Vitest/Angular unit-test builder. |
| Frontend production build | `cd frontend; npm run build` | PASS | Build completed successfully; initial total `315.38 kB` raw / `85.05 kB` estimated transfer. |
| Static security scan | PowerShell `Select-String` over `frontend/src`, `backend/src` for `.attributes`, `Authorization`, `Bearer`, `apiToken`, `api_token` | PASS with note | Matches were comments/doc text only (`frontend/src/app/core/models/strapi.models.ts:25`, `backend/src/bootstrap/public-permissions.ts:5`), not runtime credential/header usage. |
| Angular standards scan | PowerShell `Select-String` for `NgModule`, `*ngIf`, `*ngFor`, `*ngSwitch`, `: any` / `as any` / `<any>` in non-spec TS/HTML | PASS | No forbidden Angular/template patterns or explicit `any` usage found in production code. |
| OnPush / DI scan | PowerShell checks for `ChangeDetectionStrategy.OnPush` on components; manual review for `inject()` | PASS | All components declare `OnPush`; services/components use `inject()`/field injection patterns. |
| Strapi flattened response scan | PowerShell `Select-String` for `.attributes` in backend/frontend src | PASS | No `.attributes` access; DTO/comment only. |
| US01 unit ID coverage scan | `Select-String` for `US01-U*` in frontend specs | PARTIAL | Found `US01-U02,U03,U04,U05,U06,U07,U08,U09,U10,U11,U12,U13,U14,U17,U18,U19,U20,U21`. Missing explicit `US01-U22`; no `US01-U15/U16` IDs exist in spec matrix. |
| E2E suite presence | Glob for `frontend/e2e/**/*`, `frontend/playwright.config.*`; package script inspection | FAIL / GAP | No E2E directory/config/scripts found; no `US01-E*` automated tests present. |

## Findings Summary

| ID | Severity | Area | File(s) | Finding |
| --- | --- | --- | --- | --- |
| F-01 | MAJOR | Spec compliance / Test coverage | `frontend/src/app/core/catalogue/catalogue.api.ts`, `frontend/src/app/core/catalogue/catalogue.api.spec.ts` | Duplicate `key` de-duplication keeps lowest `id`, but spec requires lowest `order`, then lowest `id`. The existing `US01-U18` test encodes the wrong contract. |
| F-02 | MAJOR | Test coverage / Spec verification | `frontend/package.json`, repository (missing `frontend/e2e/**`, Playwright config) | US-01 E2E suite (`US01-E01`..`US01-E22`) is not implemented; there is no Playwright setup or command. Automated checks cannot verify keyboard, responsive, network, focus, or reload flows required by the spec. |
| F-03 | MINOR | Test traceability | `frontend/src/**` (no static check/test) | Spec auxiliary check `US01-U22` (no `/api/` literal outside `CatalogueApi`/environments) has no explicit automated test/static lint check in the codebase. |

## Detailed Findings

### F-01 — Duplicate field-key de-duplication violates US-01 contract (MAJOR)

**Files / lines**
- `frontend/src/app/core/catalogue/catalogue.api.ts:79-92`
- `frontend/src/app/core/catalogue/catalogue.api.spec.ts:200-213`
- Spec reference: `specs/US-01-policyholder-vehicle-form.md:421-428`, `728-733` (`US01-U18`)

**Evidence**
- Spec §4.3.1 requires: "de-duplicate by `key`, keep the copy with the lowest `order`; on an `order` tie keep the lowest `id`; log a dev warning naming the duplicated key".
- `CatalogueApi.mapFields` sorts by `key` then `id` and keeps the first entry per key (`frontend/src/app/core/catalogue/catalogue.api.ts:80-90`), then sorts retained fields by `order,id` for rendering (`:92`). This keeps lowest `id`, not lowest `order`.
- The unit test named `de-duplicates a repeated key keeping the lowest id` asserts the same incorrect behavior (`frontend/src/app/core/catalogue/catalogue.api.spec.ts:200-213`).

**Impact**
- If Strapi contains duplicate keys with different `order` values, Angular can keep the wrong field metadata/order contract, diverging from the approved spec and from editor expectations. Because the test codifies the wrong behavior, regressions toward the correct contract would be blocked.

**Required fix**
- Change deduplication to select the candidate with lowest `order`, then lowest `id`, per `key`; retain dev warning with duplicated key.
- Update `US01-U18` to assert the spec contract (lowest `order`, tie on `id`) and add a case where lower `id` has higher `order`.
- Keep final rendering order as `order asc, id asc` after dedup.

### F-02 — US-01 Playwright/E2E verification suite is missing (MAJOR)

**Files / evidence**
- `frontend/package.json:4-10` — scripts include `start`, `build`, `test`; no `e2e`/Playwright script.
- Repository scan: no `frontend/e2e/**`, no `frontend/playwright.config.*`, no `*.e2e.*` files.
- Spec reference: `specs/US-01-policyholder-vehicle-form.md:713-753` defines `US01-E01`..`US01-E22` as Playwright/manual verification.

**Evidence detail**
- Unit tests cover many domain/store/catalogue rules (`55 passed`), but there is no automated browser-level coverage for route rendering, keyboard-only completion, focus management, ARIA behavior in DOM, responsive layout, network write-protection assertions, retry/empty/loading UI behavior, or draft reload/navigation flows.
- AGENTS.md requires "Test Coverage: Meaningful unit tests and E2E verification without mocked-away core logic."

**Impact**
- Critical US-01 acceptance criteria are only partially verified. Accessibility, focus, responsiveness, and "no write requests / no auth header" behaviors can regress without detection. The increment cannot be considered fully verified against the approved spec matrix.

**Required fix**
- Add Playwright (or agreed E2E framework) configuration and `frontend/e2e` tests covering at minimum the spec's automatable `US01-E01`..`US01-E21` cases, with `US01-E22` visual/responsive assertions/snapshots as feasible.
- Add an npm script for E2E execution and document how it runs in README/CI notes as appropriate for the repo workflow.
- Ensure network assertions verify `GET`-only `/api/**` requests and absence of `Authorization` headers; do not mock away core routing/catalogue/persistence logic.

### F-03 — Missing explicit `US01-U22` static guard (MINOR)

**Files / evidence**
- Spec reference: `specs/US-01-policyholder-vehicle-form.md:752` (`US01-U22`).
- Current scan result: no test/spec ID `US01-U22`; broad grep found no `/api/` literals outside catalogue/api-related files in production code, but there is no dedicated automated guard.

**Impact**
- The rule "no `/api/` literal outside `CatalogueApi` and `environments/`" is currently satisfied by observation but not protected by an explicit automated check. Future changes could violate ADR-001 C5 without a clear failing test.

**Required fix**
- Add a lightweight unit/static test (Vitest or lint script) named/tagged `US01-U22` that fails if `/api/` appears in `frontend/src/app/**` excluding `frontend/src/app/core/catalogue/catalogue.api.ts` and environment files.

## Checklist Assessment

| Checklist Area | Result | Notes |
| --- | --- | --- |
| 1. Spec & ADR compliance | **FAIL** | Core routing, country scoping, sessionStorage persistence, dynamic form rendering, and Strapi seed/bootstrap are largely aligned. F-01 is a spec deviation in catalogue deduplication. |
| 2. Security (ADR-002) | **PASS** | `backend/src/bootstrap/public-permissions.ts` enforces an allowlist of only `find/findOne` for `form-field` and `country-config`, revokes other Public permissions, and fails closed if Public role is missing. Frontend uses `HttpClient` GET requests with no auth headers/tokens; no credential-bearing code found. |
| 3. Angular 21+ standards | **PASS** | Standalone components, `ChangeDetectionStrategy.OnPush`, `inject()`, signals/computed/effect, built-in control flow, typed models/validators; no `NgModule`, no `*ngIf/*ngFor/*ngSwitch`, no explicit `any` found in production code. |
| 4. Strapi 5+ standards | **PASS** | Flattened DTO handling in `CatalogueApi`; no `.attributes` usage. Bootstrap seed is idempotent and checks draft+published before create; creates published records. Public permissions configured programmatically. |
| 5. Accessibility & Responsiveness | **PASS (code review/static)** | Labels/`for`, `aria-invalid`, `aria-describedby`, `aria-live`/`role="alert"`, `aria-busy`, `aria-current`, sr-only text, focus-visible outline, heading focus management, native controls, and 768/1280 responsive rules present. E2E/browser verification is missing (F-02), so this is not fully verified. |
| 6. Test Coverage | **FAIL** | Unit tests pass (55/55) and cover many US01-U cases, including validators, persistence, catalogue mapping, store reconciliation, and dynamic form behavior. Missing explicit `US01-U22` guard and missing all `US01-E*` Playwright coverage. |

## Verification Re-check Section

_Status: **APPROVED** — All findings (F-01, F-02, F-03) and the `tester-dev`-reported `environment.development.ts` circular import defect were resolved in commit `2e514b4` and verified cleanly._

| Finding | Fix commit(s) | Re-check result | Notes |
| --- | --- | --- | --- |
| F-01 | `2e514b4` | **RESOLVED** | `CatalogueApi` now sorts by `key`, `order`, `id` so duplicate keys retain lowest `order` (tie-broken by lowest `id`); `US01-U18` updated and passing. |
| F-02 | `2e514b4` | **RESOLVED** | Added Playwright config (`frontend/playwright.config.ts`) and `frontend/e2e/us01-wizard.spec.ts` (`6/6` E2E specs passing against live Docker Compose: CO/CL field sets, validations/ARIA/focus, keyboard navigation, Back/reload persistence, error+retry, empty catalogue, dynamic field addition on reload, `375px`/`1280px` zero horizontal overflow, GET-only zero-auth requests, and `403` Strapi write protection). |
| F-03 | `2e514b4` | **RESOLVED** | Added `US01-U22` static guard (`frontend/scripts/check-api-literals.mjs`, `npm run lint:api-guard`) passing with zero `/api/` literals outside `CatalogueApi`. |
| Env defect (`tester-dev`) | `2e514b4` | **RESOLVED** | Removed circular `./environment` import from `frontend/src/environments/environment.development.ts` and deleted `environment.test-shim.spec.ts`; `ng build --configuration development`, `ng build` (prod), and `npm test -- --watch=false` (`79/79` across 8 files) all pass cleanly. |
