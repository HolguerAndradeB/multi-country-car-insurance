# Spec US-02 — Plan List and Simulated Pricing (Colombia `CO` / Chile `CL`)

**Story ID:** `US-02`

**Status:** Approved (Checkpoint 3 — 2026-11-23)

**Date:** 2026-11-23

**Author:** `spec-analyst`

---

## 1. Traceability & Status

### 1.1 Traceability header

| Item | Value |
| --- | --- |
| User story | [`docs/user-stories/US-02.md`](../docs/user-stories/US-02.md) |
| Spec (this document) | `specs/US-02-plan-list.md` |
| Accepted ADRs | [`ADR-001` — Multi-country content strategy](../docs/adrs/ADR-001-multi-country-content-strategy.md) (Accepted, Checkpoint 2) · [`ADR-002` — Strapi security & permissions](../docs/adrs/ADR-002-strapi-security-and-permissions.md) (Accepted, Checkpoint 2) · [`ADR-003` — Front-end persistence & SDD workflow](../docs/adrs/ADR-003-frontend-persistence-and-sdd-workflow.md) (Accepted, Checkpoint 2) |
| Governing skills | [`.opencode/skills/strapi-multi-country/SKILL.md`](../.opencode/skills/strapi-multi-country/SKILL.md) §1–§5 · [`.opencode/skills/angular-dynamic-wizard/SKILL.md`](../.opencode/skills/angular-dynamic-wizard/SKILL.md) §1–§5 |
| Global conventions | [`AGENTS.md`](../AGENTS.md) §1, §2, §4.1, §4.2, §4.3, §4.4, §5, §8 |
| Predecessor spec (contract source) | [`specs/US-01-policyholder-vehicle-form.md`](./US-01-policyholder-vehicle-form.md) (Approved, Checkpoint 3 — 2026-11-23) |
| Implemented by | `strapi-dev` (`backend/`), `angular-dev` (`frontend/`) |
| Verified by | `tester-dev` (unit + Playwright E2E), `code-reviewer` (`docs/reviews/US-02-review.md`), human Checkpoint 4 |
| Status | **Approved (Checkpoint 3 — 2026-11-23)** |

No new ADR is introduced by this increment. `ADR-001` §4.1 already declares the `insurance-plan` collection type and its country-filtered query; `ADR-002` §4.1 already grants Public `find`/`findOne` on `insurance-plan` (dormant until US-02); `ADR-003` §4.2 already reserves `selectedPlanDocumentId` and §4.3 already defines the "plan disappeared" restore matrix. This spec activates and makes those decisions testable — it does not amend them. All derivations below that would change an ADR are listed as Checkpoint 3 open questions in §7.4.

### 1.2 US-01 handoff contract (must be preserved verbatim in shape)

US-02 consumes — and must not redefine — these US-01 artifacts:

| US-01 artifact | Contract used by US-02 |
| --- | --- |
| Reserved Step 1 keys | `vehicleYear` (type `number`, integer, valid range `currentYear−20 … currentYear+1`) and `birthDate` (type `date`, ISO `YYYY-MM-DD`, legal-age checked) exist in **both** countries per US-01 G16. They are the only Step 1 inputs to simulated pricing (§2.2). `documentNumber`, `licensePlate` are reserved for US-03 and are **not** read by US-02. |
| `PersistedWizardStateV1` | Already contains `step1: Readonly<Record<string, FormValue>>` and `selectedPlanDocumentId: string \| null` (US-01 §5.1). US-02 only **writes** the latter; it never changes the persisted shape, key `wizard:state:v1:<CO\|CL>`, 2 h TTL, or `schemaVersion: 1`. |
| `WizardStore` | Root signal store with `load()`, `retry()`, `persist(step)`, `patchValues()`, `reset()`; in-memory authority, storage is a recoverable snapshot (`ADR-003` §4.1). US-02 **extends this same store** with Step 2 signals (§5.3) — no second store, no RxJS side channel. |
| `CatalogueApi` | The **only** class allowed to build a `'/api/'` URL (`ADR-001` §4.4 C5). US-02 adds one method, `getInsurancePlans(country)`, to this service; no component builds a URL. |
| `COUNTRY_CATALOG` | Static metadata only — `locale` (`es-CO`/`es-CL`) and `currency` (`COP`/`CLP`) drive formatting (§2.3). Never extended with plan names, prices, or copy. |
| `CountryContextService` | Route-derived `country` signal and `quotePath()` are the only source of country context. |
| `step1CompleteGuard` | Already protects `/:country/quote/plans`. US-02 keeps it and adds `step2CompleteGuard` for `/:country/quote/summary`. |
| `PlansPlaceholderPageComponent` | US-01's read-only Step 2 shell. US-02 **replaces it wholesale** with `QuoteStep2PlansPageComponent` (US-01 Checkpoint 3 Resolution 1). |
| `CatalogueStatus` | `'idle' \| 'loading' \| 'ready' \| 'empty' \| 'error'` is reused for the plans lifecycle. |
| `ageOnDate` semantics | The local-calendar-date anniversary rule, including the 29-Feb → 28-Feb convention (US-01 G1/G2, Checkpoint 3 Resolution 2), is shared with pricing so the two features cannot disagree (§2.2). |

### 1.3 Scope of this increment

In scope (US-02 only):

- Strapi `insurance-plan` collection type, idempotent seed for `CO`/`CL`, and the canonical country+active-filtered read.
- Step 2 at `/:country/quote/plans`: plan cards, recommended badge, single-select radios, localized base/final prices, coverages and benefits.
- Deterministic, transparently displayed **simulated** price adjustment from Step 1 reserved keys.
- Selection persistence, invalid-selection recovery, back-edit-recalculate flow, loading/empty/error states.
- A read-only `SummaryPlaceholderPageComponent` at `/:country/quote/summary` so AC3 ("I can move on to the summary") is verifiable inside US-02.

Out of scope (owned by later stories, listed only as boundaries):

| Concern | Owner | US-02 boundary |
| --- | --- | --- |
| Terms display/acceptance, document masking, simulated payment, rejection trigger, quote number | `US-03` | The summary route renders a **read-only placeholder**: no terms, no checkbox, no Pay button, no card fields, no document numbers. `US-03` replaces the component wholesale. |
| Real payment gateway, real card data, backend quote persistence | Never (`AGENTS.md` §4.1, §4.3) | Zero write requests from the browser; prices and payment are simulated. |
| Editing field definitions or validations | `US-01` | US-02 reads `step1` values and reuses the existing form; it does not change Step 1 rendering. |

---

## 2. Gap & Ambiguity Analysis

The user story is business-level. Each row below is a **gap, edge case, or implicit assumption** in `US-02` and the concrete decision this spec imposes. Every decision is traceable to `AGENTS.md`, an accepted ADR, a skill, the US-01 contract, or is flagged in §7.4 for Checkpoint 3.

### 2.1 Recommended flag, ordering and catalogue anomalies

| # | Gap / edge case | Decision in this spec |
| --- | --- | --- |
| G1 | **The story says the business "wants to highlight one plan as recommended" but never defines zero or multiple `recommended: true` rows.** Editors can leave every flag off, or flag several. | The UI is **defensive, not corrective**: render the visible badge on **every** plan whose `recommended === true` (no cap, no "pick only one" client rule). If **zero** plans are flagged, render **no badge anywhere** and the list still reaches `ready` normally — no placeholder badge, no warning to the visitor, no empty state. If **multiple** are flagged, every flagged card gets the identical badge. The single badge copy is **"Recomendado"** (es-CO and es-CL share the word), stored once in neutral shared `ui-copy.ts` — not in Strapi, not duplicated per country (US-01 G18). Editorial guidance "mark exactly one" belongs in the Strapi admin, not in runtime code. Confirmation requested in §7.4 Q2. |
| G2 | **"Visually distinguished" is undefined and colour-only highlighting fails accessibility.** | The badge is a text label "Recomendado" plus a non-colour cue (a distinct border style and a decorative icon with `aria-hidden="true"`). The text is referenced by the radio's `aria-describedby`, so the distinction is announced, not merely seen. The selected plan additionally shows the literal text "Seleccionado" next to the label — never colour alone. |
| G3 | **`order` ties and inactive/unpublished rows.** | Sort is `order` ascending with `id` ascending tie-break, applied once in `CatalogueApi` (`ADR-001` §4.1); components never re-sort. Published-only is guaranteed by the Public role (`ADR-002` §4.1); `active: true` is guaranteed by the canonical query filter **and** re-checked defensively client-side (§5.2). An unpublished active row is invisible without extra code. |
| G4 | **`pagination[pageSize]=100` can truncate a large plan catalogue.** | As in US-01 G20: render the received rows and emit a non-blocking dev-console warning when `meta.pagination.total > data.length`. No pagination UI in scope; >100 active plans per country is an editorial error. |
| G5 | **Malformed `coverages` / `benefits` JSON or a wrong currency on a row.** | Defensive mapping in `CatalogueApi`: drop a row (dev warning) if `basePrice` is not a finite non-negative integer after coercion, if `currency` ≠ the country's currency from `COUNTRY_CATALOG`, or if `documentId`/`key` is missing. Within a kept row, drop invalid coverage entries (missing `name` or non-finite `limit`) and non-string benefits with a dev warning; normalize `deductible` to `number \| null`. One bad row never blanks the whole list. |

### 2.2 Simulated price adjustment rule (exact, deterministic)

| # | Gap / edge case | Decision in this spec |
| --- | --- | --- |
| G6 | **"The final price may be adjusted by a simulated rule based on the step 1 data. The rule is documented."** — no formula, no inputs, no rounding, no display rule exists yet. | Adopt the rule below, computed by the pure helper `calculateAdjustedPrice(basePrice, pricingStep1, clock)` (§5.4). It uses **only** the reserved keys `vehicleYear` and `birthDate`. All arithmetic is **integer-only** so results are byte-identical across browsers, Node versions and reloads. |
| G7 | **Which Step 1 snapshot is authoritative, and what happens when Strapi removes a reserved key?** | Pricing reads `pricingStep1 = computed(() => pickKeys(store.step1Values(), store.fields()))` — a value is used **only if its key is still present in the freshly fetched Strapi field catalogue**. A removed key is ignored even if a stale in-memory value survives until the next save (`ADR-003` §4.3 "removed field key" rule). A key absent from the draft, non-finite/non-integer `vehicleYear`, or an unparseable `birthDate` falls back to that factor's neutral value (`0%`). With both factors neutral, `finalPrice === basePrice`. No error, no blocked Step 2 — pricing degrades silently to base price. |
| G8 | **Time dependence.** | `today` and `currentYear` come from an injectable `QuoteClock` captured **once per Step 2 entry** (local calendar date, consistent with US-01 G1: no UTC conversion). Unit tests inject a fixed clock. A quote open across midnight keeps its captured date until re-entry, so prices never change mid-view. |
| G9 | **Rounding of COP/CLP.** | Round **half up to the nearest integer** using integer arithmetic: `finalPrice = Math.floor((basePrice * (100 + adjustmentPercent) + 50) / 100)`. Seed `basePrice` values are non-negative integers well below `Number.MAX_SAFE_INTEGER`; `biginteger` JSON strings are coerced with `Number()` in `CatalogueApi` before this formula runs (§4.4). No decimals, no `toFixed`, no locale-dependent rounding. |

**Authoritative formula** (pseudocode, exactly one implementation in `pricing.helper.ts`):

```text
INPUT  basePrice (integer ≥ 0), pricingStep1 (current-key Step 1 snapshot), clock (local today/currentYear)

// Vehicle factor
vehicleValue = pricingStep1['vehicleYear']
vehicleYear  = (typeof vehicleValue === 'number' && Number.isInteger(vehicleValue)) ? vehicleValue : null
vehicleAge   = vehicleYear === null ? 0 : clamp(clock.currentYear - vehicleYear, 0, 20)
// 0 for next-year vehicles; max 20 mirrors US-01's currentYear-20 floor
agePercent   = vehicleAge <= 5 ? 0 : (vehicleAge - 5) * 2        // +2% per year over 5 → max 30%

// Driver factor
birthValue   = pricingStep1['birthDate']
birthIso     = typeof birthValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(birthValue) ? birthValue : null
driverAge    = birthIso === null ? null : ageOnDate(birthIso, clock.today)   // shared US-01 rule; null if impossible date
driverPercent = driverAge === null ? 0
              : driverAge < 25 ? 10
              : driverAge >= 60 ? 5
              : 0

adjustmentPercent = agePercent + driverPercent                    // 0 … 40
finalPrice = floor((basePrice * (100 + adjustmentPercent) + 50) / 100)
reasons = [
  ...(agePercent   > 0 ? ['por antigüedad del vehículo'] : []),
  ...(driverPercent > 0 ? ['por edad del conductor'] : []),
]
```

Worked examples (for review — tests assert these tables):

| `basePrice` | `vehicleYear` (clock year 2026) | `birthDate` | `%` | `finalPrice` |
| --- | --- | --- | --- | --- |
| `350000` | `2021` (age 5) | `1990-06-15` (36) | 0 | `350000` |
| `350000` | `2019` (age 7) | `1990-06-15` (36) | 4 | `364000` |
| `620000` | `2019` (age 7) | `2004-11-23` (22) | 14 | `706800` |
| `620000` | `2011` (age 15) | `1960-11-23` (66) | 25 | `775000` |
| `101` | key removed from Strapi | key removed from Strapi | 0 | `101` |
| `101` | `2021` | `1990-06-15` | 0 | `101` |

**Transparency display contract (every card, always):** primary `Precio final estimado: <formattedFinalPrice>`; secondary `Precio base: <formattedBasePrice>`; then either `Ajuste simulado: +<adjustmentPercent>% · <reasons joined with ' · '>` when `adjustmentPercent > 0`, or `Sin ajuste simulado aplicado` when it is `0`. One page-level footnote (not per card): "Los precios son simulados y no constituyen una oferta comercial." No hidden adjustment: the base price is never shown alone as the price.

### 2.3 Currency formatting

| # | Gap / edge case | Decision in this spec |
| --- | --- | --- |
| G10 | **"Shown in the country's currency and format" is not an exact contract; browser default locale would leak the tester's machine locale.** | `formatCurrency(value, locale, currency)` wraps exactly `new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 })`. `locale`/`currency` come from `COUNTRY_CATALOG` via `CountryContextService`, never from `navigator.language` and never from the plan row alone (rows are validated against the country at map time, G5). Formatters are cached by `locale|currency`. |
| G11 | **Exact spacing/NaN symbol varies across ICU builds.** | Tests assert structural properties (grouping of thousands, presence of the currency symbol or ISO code, absence of a decimal separator, and `NaN`/`undefined` never rendered) rather than exact non-breaking-space placement. COP and CLP both have ISO exponent 0, so `maximumFractionDigits: 0` is a deliberate, explicit guard, not a workaround. |

### 2.4 Selection persistence, recovery and navigation

| # | Gap / edge case | Decision in this spec |
| --- | --- | --- |
| G12 | **Business deactivates, unpublishes, or deletes a previously selected plan while `selectedPlanDocumentId` is in `sessionStorage`** (`ADR-003` §4.3). | Recovery happens **only after a successful 2xx plans fetch** (never on a network error, where no fresh catalogue exists to compare). If the stored id is not present in the freshly fetched active list — for any reason (inactive, unpublished, deleted, foreign-country id) — `selectPlan(null)` clears the store signal **and** persists `selectedPlanDocumentId: null` (keeping `step1` and `savedAt` untouched), sets `invalidSelectionNotice = true`, and `canAdvance` becomes `false`. A polite live notice is shown: "El plan que habías elegido ya no está disponible. Selecciona uno de los planes actuales para continuar." (`role="status"`, `aria-live="polite"` — not an alarming `role="alert"`). The notice clears when the visitor selects any active plan. Advancing to the summary is blocked until then (`step2CompleteGuard`). |
| G13 | **Returning from Step 2 to Step 1 and editing `vehicleYear`/`birthDate`.** | Back navigation does **not** clear anything (`ADR-003` §4.4). Step 1 reuses the in-memory form; editing a reserved key updates `step1Values()` and re-persists on the existing 400 ms debounce. Forward again calls `loadPlans(country)` **every time** (re-fetch, so Strapi edits are visible without a rebuild), recomputes `quotedPlans` from the new Step 1 snapshot, and **preserves `selectedPlanDocumentId`** if that document is still in the fresh active list. If it is gone, G12 applies. No cached prices survive the round trip. |
| G14 | **"Only one plan can be selected" needs an enforced mechanism.** | Native `<input type="radio" name="selectedPlan">` gives single-select semantics for free. The single source of truth is `WizardStore.selectedPlanDocumentId`; cards hold no local selection state. `selectPlan(documentId)` writes one id (or `null` for G12) — there is no array of selections. |
| G15 | **Draft `country` ≠ route country / direct deep links.** | Storage keys embed the country and `WizardPersistenceService` ignores mismatches (`ADR-003` §4.3). `step1CompleteGuard` keeps the existing "no valid Step 1 → redirect to Step 1" rule on the plans route; `step2CompleteGuard` (new) redirects to Step 1 when Step 1 is invalid, or back to plans when Step 1 is valid but no active plan is selected. |
| G16 | **Step 3 route boundary until `US-03` exists.** | Register `/:country/quote/summary` in US-02 as a **read-only `SummaryPlaceholderPageComponent`** protected by `step2CompleteGuard`: stepper step 3 active, `<h1 data-testid="summary-placeholder">` "Resumen de tu cotización", one explanatory paragraph, and a "Volver a planes" button. It fetches no extra Strapi data and renders no terms, payment controls, card fields, masked documents, or quote number. This makes AC3 ("And I can move on to the summary") verifiable **within US-02**; US-03 replaces this component wholesale, exactly as US-02 replaces `PlansPlaceholderPageComponent`. Confirmation in §7.4 Q3. |

### 2.5 Strapi attribute naming and async states

| # | Gap / edge case | Decision in this spec |
| --- | --- | --- |
| G17 | **Reserved Strapi 5 attribute names.** | The business "active status" is the custom boolean **`active`** (filtered with `filters[active][$eq]=true`). **NEVER use `status`** — Strapi 5 reserves it for `draftAndPublish`; a `filters[status]` query or a `status` attribute would collide with the publish lifecycle. Likewise `locale` stays reserved (US-01 uses `localeCode`). The canonical query contains **no** `status` parameter; published-only comes from the Public role. |
| G18 | **Loading state is not in the story but `AGENTS.md` §4.4 requires it.** | `plansStatus === 'loading'` → 3 skeleton cards (`aria-hidden="true"`), `aria-busy="true"` region, polite "Cargando los planes…"; no radios and no "Continuar". |
| G19 | **0 active published plans (AC4) is distinct from error and loading.** | `plansStatus === 'empty'` → blocking panel with the exact copy "No hay planes disponibles para este país en este momento", an explanation, **"Volver a mis datos"** and **"Reintentar"**; no cards, no radios, no "Continuar". `role="status"`; heading receives focus. |
| G20 | **Network failure / non-2xx and retry.** | `plansStatus === 'error'` → `role="alert"` panel: "No pudimos cargar los planes." plus "Reintentar" (and "Volver a mis datos"). Any thrown `HttpErrorResponse`, including `401`/`403` from a permission regression, maps to `error` — never silently to `empty`. `sessionStorage` is **never** cleared on error; a previously selected id is kept until a successful fetch allows revalidation (G12). Retry reuses `loadPlans(country)` once, with no backoff loop. |
| G21 | **`sessionStorage` may throw** (Safari private mode, disabled storage). | Same as US-01 G25: `WizardPersistenceService` swallows storage errors; selection still works in memory, no blocking notice, dev-console warning only. |

### 2.6 Assumptions taken as given

1. Strapi on `http://localhost:1337`, Angular on `http://localhost:4200`; `frontend/src/environments/*` contains only `apiBaseUrl` — **no token, ever** (`ADR-002` §4.4).
2. `draftAndPublish: true` on `insurance-plan`; unauthenticated `find` returns published rows only (`ADR-002` §4.1).
3. All seed data is strictly fictitious (`AGENTS.md` §4.3, §5); all user-facing copy is localized Spanish, all identifiers English.
4. Pricing is simulated and front-end-only; there is no call to a payment provider and no quote POST (`AGENTS.md` §4.1).
5. The 2026 local-calendar clock used in examples is illustrative only; the formula is relative to `QuoteClock`.

---

## 3. Multi-Country Seed Contract (`CO` & `CL`)

All rows are created by the idempotent `backend/src/index.ts` bootstrap with `status: 'published'`, using the natural key **`(country, key)`**. Running the stack twice must neither duplicate nor mutate business-edited rows (`strapi-multi-country` §3). Keys are English slugs; `name`, `shortDescription`, coverage names and benefits are localized Spanish (`es-CO` / `es-CL`, `AGENTS.md` §5). `basePrice` values are fictitious integers in the country's currency.

- **Plan natural key:** `(country, key)`; `key` is immutable once published (same governance as US-01 G16).
- **Seed idempotency:** `findMany({ filters: { country, key }, status: 'published' })` → create only when `length === 0`; never delete or overwrite an existing row.
- **Visibility contract:** 3 active published plans (`order` 1–3) + 1 **inactive published** plan (`order` 4) per country. Step 2 must show exactly the 3 active ones — this is the empirical proof of US-02 AC1 and of the `filters[active][$eq]=true` filter.
- **Recommended contract:** exactly one active plan per country is flagged (`Plan Estándar`, `order: 2`); the inactive plan is never flagged.

### 3.1 `insurance-plan` seed records — Colombia (`CO`, `COP`, `es-CO`)

| `order` | `key` | `name` | `basePrice` (COP) | `recommended` | `active` |
| --- | --- | --- | --- | --- | --- |
| 1 | `basico` | Plan Básico | `350000` | false | true |
| 2 | `estandar` | Plan Estándar | `620000` | **true** | true |
| 3 | `todo-riesgo` | Plan Todo Riesgo | `1150000` | false | true |
| 4 | `basico-ahorro-inactivo` | Plan Básico Ahorro | `240000` | false | **false** |

`shortDescription`, `coverages`, `benefits` (localized copy):

| Plan | `shortDescription` | `coverages` — `{ name, limit, deductible }` (COP) | `benefits` |
| --- | --- | --- | --- |
| Plan Básico | "Protección esencial para tu vehículo: daños a terceros y asistencia vial básica." | `{ "Responsabilidad civil extracontractual", 100000000, null }`, `{ "Asistencia vial", 2000000, null }` | "Asistencia vial 24 horas"; "Trámite de siniestros en línea"; "Cobertura en todo el territorio nacional" |
| Plan Estándar | "Equilibrio entre cobertura y precio, con protección ante robo y daños propios." | `{ "Responsabilidad civil extracontractual", 200000000, null }`, `{ "Daños propios y robo", 40000000, 1500000 }`, `{ "Asistencia vial", 5000000, null }` | "Asistencia vial 24 horas"; "Auto reemplazo por 5 días"; "Descuento en talleres aliados"; "Reporte de siniestros desde la app" |
| Plan Todo Riesgo | "Máxima tranquilidad: cobertura amplia sin deducible para daños propios." | `{ "Responsabilidad civil extracontractual", 400000000, null }`, `{ "Daños propios, robo e incendio", 90000000, 0 }`, `{ "Asistencia vial premium", 10000000, null }` | "Asistencia vial 24 horas sin límite de eventos"; "Vehículo de reemplazo por 15 días"; "Cobertura de cristales y espejos"; "Atención prioritaria de siniestros" |
| Plan Básico Ahorro (inactive) | "Plan de demostración retirado del catálogo: cobertura limitada a asistencia vial." | `{ "Asistencia vial", 1000000, null }` | "Asistencia telefónica 24 horas" |

### 3.2 `insurance-plan` seed records — Chile (`CL`, `CLP`, `es-CL`)

| `order` | `key` | `name` | `basePrice` (CLP) | `recommended` | `active` |
| --- | --- | --- | --- | --- | --- |
| 1 | `basico` | Plan Básico | `280000` | false | true |
| 2 | `estandar` | Plan Estándar | `490000` | **true** | true |
| 3 | `full` | Plan Full | `890000` | false | true |
| 4 | `basico-economico-inactivo` | Plan Básico Económico | `190000` | false | **false** |

`shortDescription`, `coverages`, `benefits` (localized copy — note *asistencia en carretera* / *convenidos* instead of the Colombian wording):

| Plan | `shortDescription` | `coverages` — `{ name, limit, deductible }` (CLP) | `benefits` |
| --- | --- | --- | --- |
| Plan Básico | "Cobertura esencial de responsabilidad civil y asistencia en carretera." | `{ "Responsabilidad civil", 60000000, null }`, `{ "Asistencia en carretera", 1500000, null }` | "Asistencia en carretera 24 horas"; "Trámite de siniestros en línea"; "Cobertura en todo Chile" |
| Plan Estándar | "Protección equilibrada frente a robo, daños propios y asistencia ampliada." | `{ "Responsabilidad civil", 120000000, null }`, `{ "Robo y daños propios", 30000000, 1000000 }`, `{ "Asistencia en carretera", 4000000, null }` | "Asistencia en carretera 24 horas"; "Vehículo reemplazo por 5 días"; "Descuento en talleres convenidos"; "Seguimiento de siniestro en línea" |
| Plan Full | "Cobertura completa con asistencia premium y sin deducible en daños propios." | `{ "Responsabilidad civil", 250000000, null }`, `{ "Daños propios, robo e incendio", 70000000, 0 }`, `{ "Asistencia en carretera premium", 8000000, null }` | "Asistencia en carretera 24 horas sin límite de eventos"; "Vehículo de reemplazo por 15 días"; "Cobertura de vidrios y espejos"; "Atención prioritaria de siniestros" |
| Plan Básico Económico (inactive) | "Plan de demostración retirado del catálogo: solo asistencia en carretera." | `{ "Asistencia en carretera", 800000, null }` | "Asistencia telefónica 24 horas" |

### 3.3 Seed coverage and invariants

| Invariant | `CO` | `CL` |
| --- | --- | --- |
| Total published plan rows | 4 | 4 |
| Active plans visible in Step 2 (AC1) | 3 (`order` 1–3) | 3 (`order` 1–3) |
| Inactive published plans never visible | 1 (`order` 4) | 1 (`order` 4) |
| Recommended active plans | 1 (`estandar`) | 1 (`estandar`) |
| Currency on every row | `COP` | `CLP` |
| Distinct coverage sets | yes (3 distinct sets + inactive) | yes (3 distinct sets + inactive) |
| Distinct benefits arrays | yes | yes |
| All data fictitious | yes | yes |

---

## 4. Strapi 5 Content Model & REST API Contract

### 4.1 `insurance-plan` content type (`api::insurance-plan.insurance-plan`)

| Attribute | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `key` | `string` | required, `^[a-z][a-z0-9-]*$` | Stable technical slug; immutable once published. Unique per `(country, key)`; seed natural key. |
| `name` | `string` | required, max 120 | Localized user-facing plan name. |
| `shortDescription` | `text` | required, max 500 | Localized summary shown under the plan name. |
| `basePrice` | `biginteger` | required, `>= 0`, integer | Strapi serialises `biginteger` as a **JSON string** (e.g. `"350000"`); `CatalogueApi` coerces with `Number()`. Values stay below `Number.MAX_SAFE_INTEGER`. |
| `currency` | `enumeration` | required; `COP \| CLP` | Must equal `COUNTRY_CATALOG` currency for the row's `country` (validated client-side, G5). |
| `coverages` | `json` | required | `readonly { name: string; limit: number; deductible?: number \| null }[]` — typed shape in §5.1; `limit`/`deductible` are money amounts in the plan's currency. |
| `benefits` | `json` | required | `readonly string[]`. |
| `order` | `integer` | required, `>= 1` | Only sort key; ties broken by `id` asc. |
| `recommended` | `boolean` | default `false` | Zero or multiple `true` rows are legal (G1). |
| `active` | `boolean` | default `true` | Business visibility flag. **NEVER name this `status`** — `status` is reserved by `draftAndPublish` (G17). |
| `country` | `enumeration` | required; `CO \| CL` | Country scoping dimension (`ADR-001` Q1-A). |

Options: `draftAndPublish: true`; no relations, no media, no i18n, no components. No `status` attribute, no `locale` attribute (US-01's `localeCode` convention applies to `country-config`).

### 4.2 Canonical query URLs (exact strings)

```http
GET {apiBaseUrl}/api/insurance-plans?filters[country][$eq]=CO&filters[active][$eq]=true&sort=order:asc&pagination[pageSize]=100
GET {apiBaseUrl}/api/insurance-plans?filters[country][$eq]=CL&filters[active][$eq]=true&sort=order:asc&pagination[pageSize]=100
```

Rules:

- `CatalogueApi.getInsurancePlans(country)` is the **only** builder of these URLs; exactly one `filters[country][$eq]` and one `filters[active][$eq]=true` per request.
- No `populate`, no `locale`, no `status` parameter: the Public role returns published rows only (`ADR-002` §4.1).
- Unauthenticated `GET`, **no `Authorization` header**, no cookies, no credentials mode (`ADR-002` §4.1, §4.3).
- `pagination[pageSize]=100` fixed at Checkpoint 2; oversized catalogues warn in dev only (G4).

### 4.3 Flattened Strapi 5 response shapes (no `.attributes`)

`GET /api/insurance-plans?filters[country][$eq]=CO&filters[active][$eq]=true&sort=order:asc&pagination[pageSize]=100` → `200`. The seeded catalogue has 4 rows but the active filter returns 3 — the empirical AC1 proof:

```json
{
  "data": [
    {
      "id": 1,
      "documentId": "planco00000000000000001",
      "key": "basico",
      "name": "Plan Básico",
      "shortDescription": "Protección esencial para tu vehículo: daños a terceros y asistencia vial básica.",
      "basePrice": "350000",
      "currency": "COP",
      "coverages": [
        { "name": "Responsabilidad civil extracontractual", "limit": 100000000, "deductible": null },
        { "name": "Asistencia vial", "limit": 2000000, "deductible": null }
      ],
      "benefits": ["Asistencia vial 24 horas", "Trámite de siniestros en línea", "Cobertura en todo el territorio nacional"],
      "order": 1,
      "recommended": false,
      "active": true,
      "country": "CO",
      "publishedAt": "2026-11-23T10:00:00.000Z"
    },
    {
      "id": 2,
      "documentId": "planco00000000000000002",
      "key": "estandar",
      "name": "Plan Estándar",
      "shortDescription": "Equilibrio entre cobertura y precio, con protección ante robo y daños propios.",
      "basePrice": "620000",
      "currency": "COP",
      "coverages": [
        { "name": "Responsabilidad civil extracontractual", "limit": 200000000, "deductible": null },
        { "name": "Daños propios y robo", "limit": 40000000, "deductible": 1500000 },
        { "name": "Asistencia vial", "limit": 5000000, "deductible": null }
      ],
      "benefits": ["Asistencia vial 24 horas", "Auto reemplazo por 5 días", "Descuento en talleres aliados", "Reporte de siniestros desde la app"],
      "order": 2,
      "recommended": true,
      "active": true,
      "country": "CO",
      "publishedAt": "2026-11-23T10:00:00.000Z"
    }
  ],
  "meta": { "pagination": { "page": 1, "pageSize": 100, "pageCount": 1, "total": 3 } }
}
```

> The third active row (`todo-riesgo`, `id: 3`) is omitted from the example for brevity; a real response contains all 3. The inactive row (`id: 4`) **must never** appear.

`GET /api/insurance-plans?filters[country][$eq]=CL&filters[active][$eq]=true&sort=order:asc&pagination[pageSize]=100` → `200` (abridged, 3 active `CLP` rows):

```json
{
  "data": [
    {
      "id": 5,
      "documentId": "plancl00000000000000001",
      "key": "basico",
      "name": "Plan Básico",
      "shortDescription": "Cobertura esencial de responsabilidad civil y asistencia en carretera.",
      "basePrice": "280000",
      "currency": "CLP",
      "coverages": [
        { "name": "Responsabilidad civil", "limit": 60000000, "deductible": null },
        { "name": "Asistencia en carretera", "limit": 1500000, "deductible": null }
      ],
      "benefits": ["Asistencia en carretera 24 horas", "Trámite de siniestros en línea", "Cobertura en todo Chile"],
      "order": 1,
      "recommended": false,
      "active": true,
      "country": "CL",
      "publishedAt": "2026-11-23T10:00:00.000Z"
    },
    {
      "id": 6,
      "documentId": "plancl00000000000000002",
      "key": "estandar",
      "name": "Plan Estándar",
      "shortDescription": "Protección equilibrada frente a robo, daños propios y asistencia ampliada.",
      "basePrice": "490000",
      "currency": "CLP",
      "coverages": [],
      "benefits": [],
      "order": 2,
      "recommended": true,
      "active": true,
      "country": "CL",
      "publishedAt": "2026-11-23T10:00:00.000Z"
    }
  ],
  "meta": { "pagination": { "page": 1, "pageSize": 100, "pageCount": 1, "total": 3 } }
}
```

Empty catalogue (0 active published plans — AC4) → `200`:

```json
{
  "data": [],
  "meta": { "pagination": { "page": 1, "pageSize": 100, "pageCount": 0, "total": 0 } }
}
```

Error shapes the client must tolerate: `400` (malformed query), `401`/`403` (permission regression), `404` (path typo), `500`/network failure (container booting, offline). Any non-`2xx` or thrown `HttpErrorResponse` maps to `plansStatus = 'error'`, never `'empty'` (G20).

### 4.4 Public role permission contract (ADR-002) — activation of the 6 read-only actions

`strapi-dev` keeps the bootstrap allowlist **exhaustive**; nothing is clicked in the admin UI. US-02 activates the two `insurance-plan` actions that were already granted in `ADR-002` §4.1 but unused in US-01 — **no ADR amendment is required**.

| Content type / action | `find` | `findOne` | `create` | `update` | `delete` |
| --- | --- | --- | --- | --- | --- |
| `api::form-field.form-field` | ALLOWED | ALLOWED | DENIED | DENIED | DENIED |
| `api::country-config.country-config` | ALLOWED | ALLOWED | DENIED | DENIED | DENIED |
| `api::insurance-plan.insurance-plan` | **ALLOWED (now exercised by US-02)** | **ALLOWED** | DENIED | DENIED | DENIED |
| Any other `api::*`, `plugin::*`, `admin::*` | DENIED | DENIED | DENIED | DENIED | DENIED |
| API tokens (any type, any scope) | **NONE ISSUED / NONE SHIPPED** | — | — | — | — |

The complete Public permission set remains exactly **6 read-only actions**: `find`/`findOne` on `form-field`, `insurance-plan`, `country-config`. `POST`/`PUT`/`DELETE` on any of the three return `401`/`403`; no `Authorization` header is ever sent by the app; no write token exists in `frontend/src/environments/*`. Verify with `ADR-002` §4.6 V2, V4–V6, V10, V11, V14.

---

## 5. Angular 21 Architecture & Typed Contracts

All components: standalone, `ChangeDetectionStrategy.OnPush`, `inject()`, signal `input()`/`output()`, `@if` / `@for (… ; track …)` / `@switch`, zero `NgModule`, zero `any` (`AGENTS.md` §4.1, `angular-dynamic-wizard` §1).

### 5.1 Typed data contracts (`frontend/src/app/core/models/`)

Reuse `CountryCode`, `CurrencyCode`, `AppLocale`, `FormValue`, `CatalogueStatus`, `StrapiListResponse<T>`, `PersistedWizardStateV1` from US-01 §5.1. Add:

```ts
/** One coverage row from the typed `coverages` JSON column. */
export interface PlanCoverageItem {
  readonly name: string;
  /** Money amount in the plan's currency; formatted with formatCurrency(). */
  readonly limit: number;
  /** null / absent → rendered as "No aplica". */
  readonly deductible: number | null;
}

/** Raw Strapi 5 flattened record — NO `.attributes` nesting. */
export interface InsurancePlanDto {
  readonly id: number;
  readonly documentId: string;
  readonly key: string;
  readonly name: string;
  readonly shortDescription: string;
  /** Strapi `biginteger` is serialised as a JSON string. */
  readonly basePrice: number | string;
  readonly currency: CurrencyCode;
  readonly coverages: readonly PlanCoverageItem[] | null;
  readonly benefits: readonly string[] | null;
  readonly order: number;
  readonly recommended: boolean;
  readonly active: boolean;
  readonly country: CountryCode;
  readonly publishedAt: string | null;
}

/** Domain model used by the UI — never the raw Strapi payload. */
export interface InsurancePlan {
  readonly id: number;
  readonly documentId: string;
  readonly key: string;
  readonly name: string;
  readonly shortDescription: string;
  /** Integer ≥ 0 after Number() coercion of the DTO string. */
  readonly basePrice: number;
  readonly currency: CurrencyCode;
  readonly coverages: readonly PlanCoverageItem[];
  readonly benefits: readonly string[];
  readonly order: number;
  readonly recommended: boolean;
  readonly country: CountryCode;
}

/** Output of the pure, deterministic simulated-pricing rule (§2.2). */
export interface PriceAdjustmentResult {
  /** Integer percent added to basePrice; 0 when neither factor applies. */
  readonly adjustmentPercent: number;
  /** Localized neutral-Spanish reasons, e.g. "por antigüedad del vehículo". */
  readonly reasons: readonly string[];
  /** Rounded integer price in the country's currency. */
  readonly finalPrice: number;
}

/** One card's fully derived view model (computed, never persisted). */
export interface QuotedPlan {
  readonly plan: InsurancePlan;
  readonly basePrice: number;
  readonly finalPrice: number;
  readonly formattedBasePrice: string;
  readonly formattedFinalPrice: string;
  readonly adjustment: PriceAdjustmentResult;
}
```

`InsurancePlan` deliberately does **not** carry `active`/`publishedAt`: by the time a DTO becomes a domain object it has passed the active + published + country checks (§5.2), so downstream code cannot accidentally render an ineligible plan.

### 5.2 `CatalogueApi` extension — single `/api/` caller

```ts
// core/catalogue/catalogue.api.ts — extended, NOT duplicated
@Injectable({ providedIn: 'root' })
export class CatalogueApi {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getFormFields(country: CountryCode): Observable<readonly FormFieldConfig[]>;  // US-01, unchanged
  getCountryConfig(country: CountryCode): Observable<CountryConfig | null>;     // US-01, unchanged
  getInsurancePlans(country: CountryCode): Observable<readonly InsurancePlan[]>; // NEW (US-02)
}
```

`getInsurancePlans` behavioural contract (exact order of operations):

1. Build exactly the canonical URL of §4.2 with the single `country` argument; issue an unauthenticated `GET`.
2. Map each `InsurancePlanDto` → `InsurancePlan`, applying G5 drops: `active !== true`, `country !== requested`, missing `documentId`/`key`, `Number(basePrice)` not a finite non-negative integer, `plan.currency !== COUNTRY_CATALOG_BY_CODE[country].currency`. Drop invalid coverage/benefit entries with dev warnings.
3. De-duplicate by `documentId`, keeping the lowest `id`.
4. Sort `order` asc, then `id` asc (`ADR-001` §4.1 tie-break); components never re-sort.
5. Emit `[]` for an empty `data` array; let `HttpErrorResponse` propagate untouched for non-`2xx` (the store converts it to `'error'`, never `'empty'`).
6. Warn in dev (non-blocking) when `meta.pagination.total > data.length` (G4).

Static rule inherited from US-01 `US01-U22`: zero `'/api/'` literals anywhere in `frontend/src/app/**` except `catalogue.api.ts` and `environments/`.

### 5.3 `WizardStore` Step 2 signals and methods

```ts
// core/wizard/wizard.store.ts — extended, NOT replaced
readonly step1Values = computed<Readonly<Record<string, FormValue>>>(...); // from the US-01 form

readonly plans = signal<readonly InsurancePlan[]>([]).asReadonly();
readonly plansStatus = signal<CatalogueStatus>('idle').asReadonly();
readonly plansError = signal<string | null>(null).asReadonly();
readonly selectedPlanDocumentId = signal<string | null>(null).asReadonly();
readonly invalidSelectionNotice = signal<boolean>(false).asReadonly();
readonly quotedPlans = computed<readonly QuotedPlan[]>(...);
readonly selectedPlan = computed<InsurancePlan | null>(
  () => this.plans().find(p => p.documentId === this.selectedPlanDocumentId()) ?? null
);
readonly canAdvance = computed(() => this.plansStatus() === 'ready' && this.selectedPlan() !== null);

async loadPlans(country: CountryCode): Promise<void>;
selectPlan(documentId: string | null): void;   // null is the internal "clear invalid selection" path (G12)
async retryPlans(): Promise<void>;            // same path as loadPlans(country)
```

Lifecycle:

- **Initialisation:** `selectedPlanDocumentId` is hydrated from `PersistedWizardStateV1.selectedPlanDocumentId` by the existing draft-load path. Hydration does **not** validate it; validation waits for a fresh catalogue (G12).
- **`loadPlans(country)`:** `plansStatus = 'loading'`, `plansError = null` → `getInsurancePlans(country)` → on error set `plansStatus = 'error'`, keep selection and storage untouched, stop → on success set `plans`, normalize selection (clear if the stored id is not in the fresh list, set `invalidSelectionNotice`), set `plansStatus = plans.length ? 'ready' : 'empty'`.
- **`selectPlan(documentId)`:** sets the signal, calls `persist('plans')` (updates `savedAt`, preserves `step1` and the storage key/version), and clears `invalidSelectionNotice`. Only an id present in `plans()` may be set by the UI; `null` is reserved for G12.
- **`quotedPlans`:** `computed()` over `plans()`, `pricingStep1 = pickKeys(step1Values(), fields())` (G7), and `QuoteClock` (G8); maps each plan through `calculateAdjustedPrice` and `formatCurrency`. Every Step 1 edit or re-fetch recomputes prices automatically (G13). Nothing in `quotedPlans` is persisted.
- **`retryPlans()`:** identical to `loadPlans(routeCountry)`; no backoff, no storage clearing.

```ts
// core/pricing/quote-clock.ts — deterministic clock boundary for tests
@Injectable({ providedIn: 'root' })
export class QuoteClock {
  /** Captured once per Step 2 entry; local calendar date, no UTC conversion. */
  readonly today: Date = new Date();
  readonly currentYear: number = this.today.getFullYear();
}
```

### 5.4 Pure domain helpers (no Angular imports)

```ts
/** Shared with US-01 isLegalAge: local-date anniversary, 29-Feb → 28-Feb in non-leap years. */
export function ageOnDate(birthDateIso: string, today: Date): number | null;

/** Exact rule from §2.2; integer-only arithmetic; never throws. */
export function calculateAdjustedPrice(
  basePrice: number,
  pricingStep1: Readonly<Record<string, FormValue>>,
  clock: Readonly<{ readonly today: Date; readonly currentYear: number }>
): PriceAdjustmentResult;

/** Intl.NumberFormat(locale, { style:'currency', currency, minimumFractionDigits:0, maximumFractionDigits:0 }). */
export function formatCurrency(value: number, locale: AppLocale, currency: CurrencyCode): string;
```

`ageOnDate` is the single implementation used by **both** US-01's `isLegalAge` and US-02's pricing; extracting/re-exporting it is an internal refactor that keeps the US-01 contract (Checkpoint 3 Resolution 2) byte-identical.

### 5.5 Components, routing and layout

| Component | Responsibility |
| --- | --- |
| `QuoteStep2PlansPageComponent` | **Replaces** `PlansPlaceholderPageComponent`. Calls `loadPlans(country())` on entry, renders stepper (step 2 active), cards/states, back + continue controls, owns `QuoteClock` capture and focus management. |
| `PlanCardComponent` | One card: signal `input()` of `QuotedPlan` + `selected`, `output()` of selection. Native radio, recommended badge, coverages `<dl>`, benefits `<ul>`, base/final prices. No local selection state. |
| `SummaryPlaceholderPageComponent` | New read-only Step 3 placeholder (G16). `data-testid="summary-placeholder"`; "Volver a planes" navigates via `quotePath('plans')`. No terms, payment, masking, or extra Strapi call. Replaced wholesale by US-03. |
| `StatePanelComponent`, `WizardStepperComponent`, `CountrySwitcherComponent`, `AppShellComponent` | Reused unchanged from US-01; the stepper remains non-interactive (plain `<li>`), navigation only through buttons. |

Routing table (`app.routes.ts`, all lazy `loadComponent`):

| Path | Behaviour |
| --- | --- |
| `''` | `redirectTo: 'co/quote'`, `pathMatch: 'full'` (US-01) |
| `':country/quote'` | `canActivate: [countryRouteGuard]` → `QuoteStep1PageComponent` (US-01) |
| `':country/quote/plans'` | `canActivate: [countryRouteGuard, step1CompleteGuard]` → **`QuoteStep2PlansPageComponent`** (replaces the placeholder) |
| `':country/quote/summary'` | `canActivate: [countryRouteGuard, step2CompleteGuard]` → **`SummaryPlaceholderPageComponent`** (US-02 only) |
| `'**'` | `NotFoundPageComponent` |

`step2CompleteGuard` rules: invalid/missing Step 1 → redirect `/:country/quote`; Step 1 valid but `selectedPlan() === null` (no selection, or stale selection cleared) → redirect `/:country/quote/plans`; otherwise allow. `countryRouteGuard` is unchanged and now also guards the summary route. Deep-linking to either step with a clean session therefore never renders a blank catalogue or a false confirmation.

```
QuoteStep2PlansPage ─reads─▶ WizardStore(plans, quotedPlans, selectedPlan, plansStatus)
        │                        │
        │                        ├──▶ CatalogueApi.getInsurancePlans ──GET──▶ Strapi (country + active filtered)
        │                        ├──▶ QuoteClock (captured date/year)
        │                        └──▶ WizardPersistenceService ──▶ sessionStorage wizard:state:v1:CO|CL
        └──renders─▶ PlanCard[] (native radios, badge, formatted prices)
                     └──"Continuar" ──▶ /:country/quote/summary (step2CompleteGuard)
```

---

## 6. UI States, Accessibility & Responsiveness

### 6.1 Explicit states

| State | Trigger | Rendering | Accessibility |
| --- | --- | --- | --- |
| `loading` | `loadPlans()` / `retryPlans()` in flight | 3 skeleton cards (`aria-hidden="true"`), stepper visible, no radios, no "Continuar" | `<section aria-busy="true">` + polite "Cargando los planes…"; focus unchanged |
| `empty` (AC4) | `plansStatus === 'empty'` (0 active published rows) | Panel: `<h1 tabindex="-1">` "No hay planes disponibles para este país en este momento", explanation, **"Volver a mis datos"**, **"Reintentar"**; no cards, no radios | `role="status"`; heading receives focus on transition; both actions keyboard-reachable |
| `error` | non-`2xx` / network failure | Panel: "No pudimos cargar los planes." + "Reintentar" + "Volver a mis datos"; dev-only HTTP detail | `role="alert"`; heading receives focus; storage/selection untouched |
| `ready` | ≥1 active plan fetched | `<form novalidate>` with `<fieldset>` of cards, prices, "Continuar" | see §6.2 |
| `invalid-selection` | stored plan no longer active (G12) | Ready list **plus** polite notice "El plan que habías elegido ya no está disponible…"; "Continuar" disabled | `role="status"`, `aria-live="polite"`; no focus theft; clears on selection |
| `selected` | radio checked | Native `checked` + visible boundary + literal "Seleccionado" text; "Continuar" enabled | State announced by the radio's checked state and label text |
| `restored-selection` | stored id still active | Same card rendered `checked`, no notice | Polite text "Recuperamos tu plan seleccionado." |
| `storage-unavailable` | `StoragePort` throws | No visual state; selection works in memory | dev log only (US-01 G25) |

"Continuar" is **disabled** (`disabled` attribute) while `loading`, `empty`, `error`, or no valid selection — never an enabled button that fails on click.

### 6.2 Accessibility contract

- `<fieldset>` with `<legend>` "Selecciona tu plan"; native `<input type="radio" name="selectedPlan" [value]="plan.documentId" [id]="'plan-' + plan.documentId">`. Single `name` is the browser-enforced single-select mechanism (G14).
- Each radio has an explicit `<label [for]="'plan-' + plan.documentId">` containing the plan name and the "Seleccionado" text when checked. No clickable `<div>` anywhere.
- `[attr.aria-describedby]` on each radio resolves to the ids of its short-description, price-detail and (when present) recommended-badge elements. All ids exist in the DOM; no dangling references. `aria-invalid` is not used on radios (there is no per-plan validation); group-level messaging uses the polite notice.
- **Keyboard:** `Tab`/`Shift+Tab` enters and leaves the radio group at the checked radio (or the first one); `Arrow Up/Down`/`Left/Right` move and select (native behavior); `Space` selects the focused radio (native); **`Enter` on a focused radio selects it and calls `preventDefault()`** so it does not submit the form prematurely (explicit handler required by the story's keyboard rule). The dedicated "Continuar" button advances via native `Enter`/`Space`.
- Recommended badge: visible text "Recomendado" + distinct border style + `aria-hidden="true"` icon; announced through `aria-describedby`. Never colour-only (G2).
- Coverages in `<dl>` with `<dt>` name / `<dd>` "Límite: <formatted>" and "Deducible: <formatted | No aplica>"; benefits in `<ul><li>`. Prices use `<data [attr.value]="quoted.finalPrice">` so the exact integer is machine-readable.
- `:focus-visible` outline `2px` solid, ≥ `3:1` contrast, never removed without replacement; input/label font-size ≥ `16px`; touch targets ≥ `44×44px` (`angular-dynamic-wizard` §4).
- Page `<h1 tabindex="-1">` receives programmatic focus on route entry (forward to summary, back to Step 1, after country switch, after error/empty retry success) so screen-reader users know where they are.
- Tab order follows DOM order: country switcher → stepper (non-interactive) → radios in `order` → "Volver a mis datos" → "Continuar". No `tabindex > 0`.

### 6.3 Keyboard-only completion (full US-02 path)

| Action | Keys |
| --- | --- |
| Enter the plan group | `Tab` from the country switcher |
| Move / select among plans | `Arrow` keys; `Space` or `Enter` to confirm the focused radio |
| Advance to the summary placeholder | `Tab` to "Continuar", `Enter` (or `Space`) |
| Return to Step 1 / edit reserves / return | `Tab` to "Volver a mis datos", `Enter`; edit `vehicleYear`/`birthDate`; Step 1 "Continuar" via `Enter` |
| Return from summary placeholder | `Tab` to "Volver a planes", `Enter` |
| Retry after error / from empty | `Tab` to "Reintentar", `Enter` |

No action in US-02 requires a pointer; no controls are clickable `<div>`s.

### 6.4 Responsiveness

| Viewport | Layout |
| --- | --- |
| `375px` | Single-column card stack, `16px` page padding; cards full width, min-height `44px` controls; no horizontal scroll (`document.scrollWidth === clientWidth`); "Continuar" full-width, not overlaying content; badge wraps below the plan name. |
| `768px` | Two-column CSS grid of cards (`grid-template-columns: repeat(2, minmax(0, 1fr))`), `16px` gap. |
| `1280px+` | Three-column grid (`repeat(3, minmax(0, 1fr))`), container max-width `1120px`, centred; grid gap `24px`; plan names and prices never truncated (`text-overflow: ellipsis` forbidden on price elements). |

Colour/contrast meets WCAG 2.1 AA for text (`4.5:1`) and UI boundaries (`3:1`); the recommended badge and selected state remain distinguishable in forced-colours/high-contrast mode because both carry text.

---

## 7. Verifiable Acceptance Matrix & Open Questions for Checkpoint 3

### 7.1 Acceptance matrix — the four US-02 Gherkin scenarios

Owners: `tester-dev` writes all tests; `angular-dev` / `strapi-dev` make them pass. IDs are referenced in `docs/reviews/US-02-review.md`.

| US-02 AC | Gherkin (abridged) | Unit tests | E2E (Playwright) | Manual / Checkpoint 4 |
| --- | --- | --- | --- | --- |
| **AC1** — Plans for the country | `Given I completed the step 1 form / When I reach the plans step / Then I see only the active and published plans for my country, in the configured order` | `US02-U05` `getInsurancePlans` builds exactly one `filters[country][$eq]` + one `filters[active][$eq]=true`, `sort=order:asc`, `pageSize=100`, maps flattened DTOs (no `.attributes`). `US02-U06` defensive drops (`active !== true`, country mismatch, invalid `basePrice`, currency mismatch, duplicate `documentId`) and `order`→`id` tie-break. `US02-U14` seed fixture invariant: 4 rows/country → 3 active, `order` 1–3, 1 inactive at 4. | `US02-E01` `/co/quote/plans`: 3 CO plans in `order` 1–3, "Plan Todo Riesgo" present, "Plan Full" and the inactive "Plan Básico Ahorro" absent, all prices contain `COP`-locale formatting. `US02-E02` `/cl/quote/plans`: "Plan Full" present, "Plan Todo Riesgo" and inactive "Plan Básico Económico" absent, `CLP` formatting. | Read rendered cards against §3.1/§3.2; confirm a draft-only plan in Strapi admin never appears. |
| **AC2** — Recommended plan | `Given a plan is marked as recommended in Strapi / When I view the plan list / Then that plan is visually distinguished from the others` | `US02-U10` badge count equals the number of `recommended: true` plans (1 → one badge; 2 mocked → two badges; 0 → none and status stays `ready`); badge copy is exactly "Recomendado" from shared `ui-copy.ts`. | `US02-E03` seeded: only "Plan Estándar" shows the "Recomendado" badge; badge has text + non-colour cue and is in the radio's accessible description; mocked catalogues with 0 and with 2 flagged plans render cleanly. | Visual/forced-colours check that the distinction is not colour-only. |
| **AC3** — Plan selection | `Given I am on the plan list / When I select a plan / Then it is marked as chosen / And I can move on to the summary` | `US02-U08` selection persists to `selectedPlanDocumentId` and `selectedPlan()` resolves; `US02-U11` `step2CompleteGuard` allows only with a valid active selection and redirects otherwise. | `US02-E04` select a radio (mouse and keyboard separately) → `checked`, "Seleccionado" visible, "Continuar" enabled → `/:country/quote/summary` with stepper step 3 and `data-testid="summary-placeholder"`. `US02-E14` placeholder is read-only (no terms, Pay, card fields, masked document, quote number). `US02-E15` deep-link to summary with no valid state → guard redirect to Step 1 or plans. | Keyboard-only walkthrough of selection → summary → "Volver a planes". |
| **AC4** — No plans available | `Given there are no active plans for my country / When I reach the plans step / Then I see a message explaining that no plans are available` | `US02-U07` `loadPlans` with `[]` → `plansStatus = 'empty'` (distinct from `'error'`); `US02-U12` empty/error copy ids come from shared `ui-copy.ts`. | `US02-E05` catalogue mocked to `{"data":[],"meta":{...total:0}}` → exact "No hay planes disponibles para este país en este momento", "Volver a mis datos" and "Reintentar", no cards, no "Continuar", no false selection. | Remove/deactivate all plans for a country in Strapi admin, reload, confirm the same panel (zero-redeploy proof). |

### 7.2 Auxiliary checks (pricing, persistence, states, accessibility, security)

| # | Check | Type | Pass criteria |
| --- | --- | --- | --- |
| `US02-U01` | Pricing rule table | Unit (`§2.2`) | §2.2 worked examples pass exactly: 0%, 4%, 14%, 25%; clamp for next-year vehicles; max 30% vehicle + 10% driver = 40%; `reasons` order. |
| `US02-U02` | Pricing fallbacks | Unit (G7) | Missing/absent `vehicleYear` or `birthDate`, stale key removed from `fields()`, non-integer year, invalid ISO date → that factor `0%`; both missing → `finalPrice === basePrice`; never throws. |
| `US02-U03` | Driver age consistency | Unit (`ageOnDate`) | 29-Feb → 28-Feb in non-leap years; `birthDate = today−18y` valid; matches US-01 `isLegalAge` boundary table bit-for-bit. |
| `US02-U04` | Currency formatter | Unit (G10/G11) | `formatCurrency(620000,'es-CO','COP')` and `(490000,'es-CL','CLP')` group thousands, carry the correct symbol/code, contain no decimal separator; `maximumFractionDigits: 0` asserted via options spy; no `NaN`. |
| `US02-U09` | Invalid selection recovery | Unit (`ADR-003` F5, G12) | Stored id absent from fresh active list → signal `null`, persisted id `null`, `invalidSelectionNotice = true`, `canAdvance = false`, `step1` and `savedAt` unchanged. |
| `US02-U13` | Selection preserved on re-entry | Unit (G13) | Stored id still active after `loadPlans` → id unchanged, notice `false`; editing `step1Values` recomputes `quotedPlans` final prices while the id survives. |
| `US02-U15` | Error keeps state | Unit (G20) | Failed fetch → `'error'`, previous `plans`/selection retained, no `persistence.clear()` call. |
| `US02-E06` | Error state + retry | E2E | First plans request `route.abort()` → `role="alert"` "No pudimos cargar los planes." + "Reintentar"; second fulfilled → cards render; previously chosen id survives the failure. |
| `US02-E07` | Loading state | E2E | Plans response delayed 500 ms → `aria-busy="true"` + "Cargando los planes…", 3 skeletons, no radios/Continuar, then replaced. |
| `US02-E08` | Back-edit-recalculate | E2E (G13) | Select plan → back to Step 1 → change `vehicleYear` and `birthDate` → forward: final prices change, selected radio still checked; then `page.reload()` on plans → prices still match the edited values. |
| `US02-E09` | Plan deactivated/unpublished/deleted after selection | E2E (G12) | Select plan → mock the fresh catalogue without it (or flip `active` in Strapi) → reload: polite notice appears, no radio checked, "Continuar" disabled; selecting another plan clears the notice and enables advancing. |
| `US02-E10` | Keyboard-only Step 2 | E2E + Antigravity walkthrough | `Tab`/`Arrow`/`Space`/`Enter` select, advance, go back, retry; focus always visible; `Enter` on a radio does not submit early. |
| `US02-E11` | ARIA wiring | E2E DOM assertions | `<fieldset>/<legend>` present; every radio has `label[for]`, shared `name="selectedPlan"`, resolvable `aria-describedby` ids; badge text in the description; `<data value>` equals the integer final price; live regions have expected `role`. |
| `US02-E12` | No credentials, no writes | E2E network assertions (`ADR-002` V10/V11) | Zero `Authorization` headers; every `/api/**` request is `GET`; bundle/`frontend/src` contains none of `Bearer`, `apiToken`, `api_token`. |
| `US02-E13` | Public role: 6 read-only actions | API test via Playwright `request` (`ADR-002` V2, V4–V6) | `GET /api/insurance-plans?filters[country][$eq]=CL&filters[active][$eq]=true` → `200`, only active CL rows; `POST`/`PUT`/`DELETE /api/insurance-plans(/1)` → `401`/`403`; `GET /api/users` → `401`/`403`. |
| `US02-E16` | Responsive | E2E visual + assertion | `375px`: single column, no horizontal scroll, targets ≥ 44 px; `1280px`: 3-column grid, max-width respected; snapshots reviewed at Checkpoint 4. |
| `US02-E17` | Simulated pricing visible | E2E | Each card shows both "Precio base" and "Precio final estimado"; when the fixed-clock formula yields `+14%`, the "Ajuste simulado: +14% · …" line is present; page footnote present; no real payment wording. |

### 7.3 Test fixtures (strictly fictitious)

| Purpose | Value |
| --- | --- |
| Fixed clock | `today = 2026-11-23`, `currentYear = 2026` (unit tests only; E2E uses the real clock with computed expectations) |
| Step 1 reserves — neutral | `vehicleYear: 2021`, `birthDate: '1990-06-15'` → `0%` |
| Step 1 reserves — combined | `vehicleYear: 2019`, `birthDate: '2004-11-23'` → `+14%` |
| Step 1 reserves — senior | `vehicleYear: 2011`, `birthDate: '1960-11-23'` → `+25%` |
| CO plan ids | `planco00000000000000001/2/3` (active), `planco00000000000000004` (inactive) |
| CL plan ids | `plancl00000000000000001/2/3` (active), `plancl00000000000000004` (inactive) |
| Names / copy | "Plan Básico", "Plan Estándar", "Plan Todo Riesgo", "Plan Full" — invented for this project |

No real identity documents, plates, addresses, or personal data appear in seeds, fixtures, or session logs (`AGENTS.md` §4.3).

### 7.4 Open Questions for Checkpoint 3 (human approval required)

1. **Simulated pricing formula (§2.2).** Approve: vehicle `+2%` per year older than 5 (capped at 30%), driver `+10%` under 25 and `+5%` at 60+, sum, **round half up to an integer** with integer arithmetic, using only `vehicleYear`/`birthDate` and falling back to base price when a key is absent. Also approve that base and final prices are **always both shown**. Any different factor needs the worked-example table and `US02-U01` rewritten before implementation.
2. **Recommended-flag policy (G1/G2).** Approve the defensive UI: render a badge on *every* `recommended: true` plan, render none when zero are flagged, keep the single copy "Recomendado" in shared `ui-copy.ts` (not Strapi), and leave the "exactly one" convention as editorial guidance in the admin panel. Alternative — enforce exactly one flag server-side or make the badge label Strapi-configurable — requires a new ADR decision.
3. **Step 3 boundary (G16).** Approve shipping a read-only `SummaryPlaceholderPageComponent` at `/:country/quote/summary` behind `step2CompleteGuard`, so AC3 is verifiable within US-02 and US-03 replaces it wholesale; and approve "Continuar" being **disabled** until a valid active plan is selected (rather than enabled-with-error-on-click).
4. **Seed catalogue and money display (§3, G10).** Approve the 3+1 fictitious plans per country, their prices, names and localized copy as seeded, and that coverage `limit`/`deductible` are formatted with the country's currency (`maximumFractionDigits: 0`) while `active: false`/published remains the proof that inactive plans never appear.

### 7.5 Traceability summary

| Story rule / requirement | Source | Addressed by |
| --- | --- | --- |
| Plans configured per country with order, recommended, active | US-02 Business rules | §3 seed, §4.1 schema |
| Only active and published plans, in configured order | US-02 AC1 | §4.2 query, §5.2 mapping, `US02-U05/U06`, `US02-E01/E02` |
| Recommended plan visually distinguished | US-02 AC2 | G1/G2, `US02-U10`, `US02-E03` |
| Single plan selection + move to summary | US-02 BR / AC3 | G14/G16, §5.3/§5.5, `US02-U08/U11`, `US02-E04/E14/E15` |
| No plans available message | US-02 AC4 | G19, §6.1, `US02-U07`, `US02-E05` |
| Price in country currency and format | US-02 BR | G10/G11, §5.4, `US02-U04`, `US02-E01/E02` |
| Documented simulated adjustment from Step 1 data | US-02 BR | G6–G9, §2.2, `US02-U01/U02/U03`, `US02-E17` |
| Country-scoped persistence, stale-selection recovery, back-edit continuity | `ADR-003` §4.2–§4.3 | G12/G13, §5.3, `US02-U09/U13`, `US02-E08/E09` |
| Public role read-only, no browser token | `ADR-002` §4.1 | §4.4, `US02-E12/E13` |
| Keyboard-only, semantics, responsive, async states | `AGENTS.md` §4.4 | §6, `US02-E06/E07/E10/E11/E16` |
| Zero-redeploy configurability | `AGENTS.md` §4.2 | §4.2 fresh fetch every entry (G13), `US02-E02` manual Strapi check |

---

### Checkpoint 3 Resolution (2026-11-23)

1. **Simulated pricing formula (§2.2):** Approved — integer-only adjustment (`+2%` per vehicle year over 5 capped at `30%`, `+10%` under age 25, `+5%` age 60+, half-up integer rounding), falling back gracefully when `vehicleYear`/`birthDate` are absent, and always displaying both base price and estimated final price.
2. **Recommended-flag policy (G1/G2):** Approved — defensive UI rendering `"Recomendado"` badge (text + non-colour border/icon) on every `recommended: true` plan, none when zero are flagged, with shared copy in `ui-copy.ts`.
3. **Step 3 boundary (G16):** Approved — ship read-only `SummaryPlaceholderPageComponent` at `/:country/quote/summary` behind `step2CompleteGuard` with `"Continuar"` disabled until an active plan is selected.
4. **Seed catalogue & currency display (§3, G10):** Approved — 3 active + 1 inactive fictitious plans per country with integer `COP`/`CLP` currency formatting (`maximumFractionDigits: 0`).

### Approval block (to be completed at Checkpoint 3)

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Human project owner (Checkpoint 3) | Holguer | ☑ Approved | 2026-11-23 |
| `spec-analyst` (author) |  | Submitted for review | 2026-11-23 |
