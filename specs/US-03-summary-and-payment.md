# Spec US-03 — Summary and Simulated Payment (Colombia `CO` / Chile `CL`)

**Story ID:** `US-03`

**Status:** Draft — awaiting Checkpoint 3 human approval

**Date:** 2026-11-24

**Author:** `spec-analyst`

---

## 1. Traceability & Status

### 1.1 Traceability header

| Item | Value |
| --- | --- |
| User story | [`docs/user-stories/US-03.md`](../docs/user-stories/US-03.md) |
| Spec (this document) | `specs/US-03-summary-and-payment.md` |
| Accepted ADRs | [`ADR-001` — Multi-country content strategy](../docs/adrs/ADR-001-multi-country-content-strategy.md) (Accepted, Checkpoint 2) · [`ADR-002` — Strapi security & permissions](../docs/adrs/ADR-002-strapi-security-and-permissions.md) (Accepted, Checkpoint 2) · [`ADR-003` — Front-end persistence & SDD workflow](../docs/adrs/ADR-003-frontend-persistence-and-sdd-workflow.md) (Accepted, Checkpoint 2) |
| Predecessor specs (contract sources) | [`specs/US-01-policyholder-vehicle-form.md`](./US-01-policyholder-vehicle-form.md) (Approved, Checkpoint 3) · [`specs/US-02-plan-list.md`](./US-02-plan-list.md) (Approved, Checkpoint 3) |
| Governing skills | [`.opencode/skills/strapi-multi-country/SKILL.md`](../.opencode/skills/strapi-multi-country/SKILL.md) §1–§5 · [`.opencode/skills/angular-dynamic-wizard/SKILL.md`](../.opencode/skills/angular-dynamic-wizard/SKILL.md) §1–§5 |
| Global conventions | [`AGENTS.md`](../AGENTS.md) §1, §2, §4.1, §4.2, §4.3, §4.4, §5, §8 |
| Implemented by | `angular-dev` (`frontend/`), `strapi-dev` (`backend/` — **seed copy only**, see §3) |
| Verified by | `tester-dev` (unit + Playwright E2E), `code-reviewer` (`docs/reviews/US-03-review.md`), human Checkpoint 4 |
| Status | **Draft — awaiting Checkpoint 3 human approval** |

**No new ADR is introduced by this increment.** `ADR-001` §4.1 already declares `country-config.termsAndConditions` and `country-config.documentMaskVisibleEnd`; `ADR-002` §4.1 already grants Public `find`/`findOne` on `country-config` (exercised once in US-01 and now again, live, in US-03); `ADR-003` §4.2 already fixes the persisted shape and §4.4 already governs back-edit continuity. US-03 activates those decisions and makes them testable — it does **not** amend them. No new Strapi collection type, no new Public permission, and no new `/api/` URL is introduced. Every derivation that would change an ADR is instead listed as a Checkpoint 3 open question in §7.4.

### 1.2 US-01 / US-02 handoff contracts (must be preserved verbatim in shape)

US-03 consumes — and must not redefine — these existing artifacts:

| Artifact | Contract used by US-03 |
| --- | --- |
| `CatalogueApi.getCountryConfig(country)` | Existing method (`catalogue.api.ts`): builds `${apiBaseUrl}/api/country-configs?filters[country][$eq]=${country}`, maps the flattened Strapi 5 response through `mapCountryConfig()`, returns `Observable<CountryConfig \| null>`. US-03 calls it **live on every Step 3 entry** (§4.2, G9) — no new API method, no caching layer. |
| `CountryConfig` | Existing domain model (`wizard.models.ts`): `id`, `documentId`, `country`, `countryName`, `currency`, `localeCode`, `termsAndConditions: string`, `documentMaskVisibleEnd: number`. US-03 adds **no field** to it. |
| `WizardStore` | Existing root signal store. US-03 **extends this same store** with Step 3 signals/methods (§5.3) — no second store, no RxJS side channel. Existing `reset(country)` already calls `persistence.clear(country)` and clears all signals; it is reused verbatim for "Nueva cotización". |
| `PersistedWizardStateV1` | `schemaVersion: 1` with `step1` and `selectedPlanDocumentId` only. US-03 **does not add payment fields and does not bump the schema version** (§5.3, §7.4 Q3). "Editar datos" and "Cambiar plan" preserve both values; only "Nueva cotización" clears them. |
| `QuotedPlan` | US-02's derived card view model carries `basePrice`, `finalPrice`, `formattedBasePrice`, `formattedFinalPrice`, `adjustment`. US-03 **reads** these for "Plan elegido"; it never recomputes the simulated price (G4). |
| `step1Values()` / `fields()` | The freshly fetched Strapi field catalogue supplies every summary label (`form-field.label`) and every select display value (`option.label`); `step1Values()` supplies the values. US-03 does not add or rename Step 1 keys. |
| `QuoteClock` | Injected clock boundary from US-02 (`today`, `currentYear`, local calendar date, no UTC conversion). US-03 reuses it for the `YYYYMMDD` part of the quote number (§5.4). |
| `formatCurrency`, `pickKeys`, `calculateAdjustedPrice` | Existing pure helpers. US-03 reuses `formatCurrency` for the three price lines and never calls `calculateAdjustedPrice` itself (G4). |
| `CountryContextService` | `country`, `locale`, `currency` signals and `quotePath(step: 'quote' \| 'plans' \| 'summary')` are the only source of route context and navigation paths. |
| `step2CompleteGuard` | Already protects `/:country/quote/summary`. US-03 keeps it unchanged: invalid Step 1 → `/:country/quote`; Step 1 valid but no active selection → `/:country/quote/plans`. |
| `UI_COPY` | Shared neutral-Spanish chrome copy. US-03 **adds keys** for Step 3 (§5.6) but keeps all existing keys byte-identical. Country-specific terms text comes from Strapi, never from `UI_COPY`. |
| `SummaryPlaceholderPageComponent` | US-02's read-only Step 3 shell. US-03 **replaces it wholesale** with `QuoteStep3SummaryPageComponent`, exactly as US-02 replaced `PlansPlaceholderPageComponent`. |

### 1.3 Scope of this increment

In scope (US-03 only):

- Upgrade the two `country-config` seed **terms strings** to country-distinct, clearly simulated Spanish copy (no schema change); keep `documentMaskVisibleEnd` at `4` for both countries.
- Live Step 3 load/refresh of `countryConfig` through the existing `getCountryConfig(country)`.
- Read-only summary sections "Tomador", "Vehículo", "Plan elegido" with labels/options from Strapi and the three price lines from the US-02 `QuotedPlan`.
- Pure `maskDocumentNumber()` display masking with raw value untouched in store/storage.
- Terms acceptance gating, a frontend-only injectable `SimulatedPaymentService`, a strict synchronous double-submit lock, deterministic quote numbers, a frozen confirmation snapshot, rejection recovery, and "Nueva cotización".
- Explicit `loading` / `error` / `empty-terms` / `ready` / `processing` / `rejected` / `confirmed` states, accessibility, keyboard-only completion and responsive layout.

Out of scope (owned by later stories or permanently forbidden, listed only as boundaries):

| Concern | Owner | US-03 boundary |
| --- | --- | --- |
| Real payment gateway, real card data, backend quote persistence | Never (`AGENTS.md` §4.1, §4.3) | No card fields, no CVV, no billing address, no `POST`/`PUT`/`DELETE`, no payment token. The only simulated-failure control is a deterministic test hook (§7.4 Q2). |
| Editing field definitions, validations, plans or prices | US-01 / US-02 | US-03 reads them; it does not change Step 1 or Step 2 rendering. |
| New Strapi content types or Public permissions | Never for US-03 | `country-config` already exposes both fields through the existing six read-only Public actions (§3.3, §4.4). |
| Legal approval of the terms text | Human (Checkpoint 3 / business) | Seed copy is explicitly simulated demo copy; real legal text is entered in Strapi by the business team. Flagged in §7.4 Q1. |

---

## 2. Gap & Ambiguity Analysis

The user story is business-level. Each row below is a **gap, edge case, or implicit assumption** in `US-03` and the concrete decision this spec imposes. Every decision is traceable to `AGENTS.md`, an accepted ADR, a skill, the US-01/US-02 contracts, or is flagged in §7.4 for Checkpoint 3.

### 2.1 Summary content and display rules

| # | Gap / edge case | Decision in this spec |
| --- | --- | --- |
| G1 | **"Shows the policyholder's data, the vehicle's data and the chosen plan" never defines which fields or where their labels come from.** | Three read-only sections with exact headings **"Tomador"**, **"Vehículo"**, **"Plan elegido"**. Rows are derived from the freshly fetched `fields()`: one row per field whose `section` is `policyholder` or `vehicle`, in `order` ascending (`id` ascending tie-break, same rule as US-01/US-02). The row label is **`form-field.label` verbatim** — never a hardcoded English or translated string. Rows live in a `<dl>` with `<dt>`/`dd>`. Section headings are shared neutral Spanish in `UI_COPY` (§5.6). |
| G2 | **Select fields store the raw `option.value`, not what a human should read.** | For `type === 'select'`, resolve the displayed value through that field's `options`: `options.find(o => o.value === raw)?.label ?? raw`. A value no longer present in Strapi (business removed the option) renders the **raw value** unchanged with a dev-console warning — it never renders blank and never throws. No re-validation and no redirect; this is a display-only fallback. |
| G3 | **Checkbox fields and optional blanks are undefined.** | Booleans render exactly **`"Sí"`** for `true` and **`"No"`** for `false` (shared `UI_COPY`, not Strapi). A blank value (`null`, `''`, or an absent key) on a field with `required: false` causes the **entire row to be omitted**. A blank value on a `required: true` field (which `step2CompleteGuard` should already prevent) renders the safe placeholder **`"—"`** instead of crashing the page. Numbers render as their decimal string; ISO dates render through `formatIsoDate()` (§5.4). |
| G4 | **"Chosen plan with its final price" could tempt a recomputation that disagrees with Step 2.** | The three price lines are read **only** from the already-derived `QuotedPlan` for the selected `documentId`: `formattedBasePrice`, the adjustment text built from `adjustment.adjustmentPercent`/`adjustment.reasons`, and `formattedFinalPrice`. US-03 never calls `calculateAdjustedPrice`, never re-reads `vehicleYear`/`birthDate` for pricing, and never invents a fourth price. If the selected plan cannot be resolved (`selectedPlan() === null`), `step2CompleteGuard` has already redirected — the component does not render a partial summary. |
| G5 | **Price transparency inherited from US-02 must survive into the summary (US-02 §2.2).** | "Plan elegido" always shows `Precio base: <formattedBasePrice>`, then `Precio final estimado: <formattedFinalPrice>`, then either `Ajuste simulado: +<n>% · <reasons>` when `adjustmentPercent > 0` or `Sin ajuste simulado aplicado` when it is `0`, followed by the shared footnote "Los precios son simulados y no constituyen una oferta comercial." The final price is the one used in the confirmation snapshot (§5.3). |
| G6 | **Which document is masked, and is the plate masked too?** | Only the reserved Step 1 key **`documentNumber`** (CO *cédula de ciudadanía*, CL *RUT*) is masked, and only in the read-only "Tomador" view. `licensePlate` and every other field render in full. Masking is **display-only** in the view model (§2.2, G12). |

### 2.2 Document masking (pure function)

| # | Gap / edge case | Decision in this spec |
| --- | --- | --- |
| G7 | **"Partially masked" has no mask glyph, no count semantics, and no rule for short values.** | Pure helper `maskDocumentNumber(rawValue: string, visibleEnd: number): string` (§5.4). The mask glyph is exactly **`'•'` (U+2022 BULLET)**, **one glyph per hidden character**, so output length equals input length. No ellipsis, no grouping re-insertion, no case transformation, no trimming. `visibleEnd` comes from `countryConfig.documentMaskVisibleEnd` (seeded `4`, Strapi-editable, `min: 0`). |
| G8 | **`documentMaskVisibleEnd = 0`, a value shorter than the mask, and empty input.** | `visibleEnd <= 0` → **fully masked** (all bullets; the safe interpretation of the Strapi minimum). `rawValue.length <= visibleEnd` → returned **verbatim**, with no bullet at all (never "mask" a value that has nothing to hide). `''` / whitespace-only input → `''`. The helper never throws for any string/number input; non-finite or non-number `visibleEnd` degrades to `4` before the call (already done by `mapCountryConfig`, §4.3). |
| G9 | **Chilean RUT verification digit (`-K`, or `-<digit>`) and trailing characters.** | Because the visible tail is copied verbatim, the default `visibleEnd = 4` already reveals the suffix (e.g. `12345678-K` → `••••••78-K`). To prevent a small `visibleEnd` from hiding the verifier alone, a **RUT-suffix rule** applies: when `visibleEnd > 0` and `rawValue` matches `/-[0-9Kk]$/`, the effective visible tail is `min(rawValue.length, max(visibleEnd, 2))` — the dash and verifier are always revealed together. `visibleEnd <= 0` still wins and fully masks. Trailing whitespace is displayed as part of the tail (no silent trimming); Step 1 already applies the configured `trim` transform to document fields. Full examples in §5.4. |
| G10 | **Masking must not leak into back-edit or storage.** | The raw value in `WizardStore.step1Values()` and in `sessionStorage` is **never modified**. Masking is applied only when constructing the summary view model. "Editar datos" returns the original value to the Step 1 input. The confirmation snapshot stores the **masked** display string (it is a presentation artifact) and never the raw document (§5.3). |

### 2.3 Terms by country and zero-redeploy loading

| # | Gap / edge case | Decision in this spec |
| --- | --- | --- |
| G11 | **"Text varies by country and is managed by the business team from Strapi" is only true if Step 3 fetches live.** | On **every** Step 3 entry (forward from plans, back from Step 1, after a country switch, and after every retry) the page calls `CatalogueApi.getCountryConfig(country())`. A reload after a Strapi admin edit therefore shows the new terms and new `documentMaskVisibleEnd` with **zero front-end redeploy** (`AGENTS.md` §4.2). No component-level cache and no reuse of the US-01 `countryConfig` signal as the source of truth for Step 3. Confirmation in §7.4 Q4. |
| G12 | **Terms text can be blank even though the Strapi field is `required: true`.** | `termsAndConditions.trim().length === 0`, or a `null` config from `mapCountryConfig`, maps to the blocking **`empty-terms`** state: a panel "No pudimos cargar los términos y condiciones para este país." with "Reintentar" and "Volver a planes"; the terms checkbox and Pay button are **not rendered** (or are rendered disabled), and `canPay()` is `false`. It is distinct from `error` (network/HTTP) and from `loading`. |
| G13 | **Terms acceptance is per-page state; what happens on retry/re-entry?** | `termsAccepted` is an in-memory signal initialised to `false` on each Step 3 entry and on every country switch. A failed payment keeps it `true` so the visitor can retry without re-accepting (AC4). A successful payment freezes the snapshot before any reset. It is deliberately **not persisted** (§7.4 Q3). |
| G14 | **Terms text is long and must be readable and scrollable, not a trap.** | Rendered in a bounded, scrollable `<section>` with a visible heading "Términos y condiciones", `tabindex="0"` so keyboard users can scroll it, and an accessible name via `aria-labelledby`. Preserve line breaks with `white-space: pre-line`. The checkbox is outside the scroll region so it is never scrolled out of reach. |
| G15 | **Existing databases will keep the old placeholder terms.** | `seed.ts` is create-only (Checkpoint 2 invariant), so changing the seed constants affects **fresh databases only**. Option A (recommended): keep strict create-only idempotency and require the business to edit terms in the Strapi admin for existing environments. Option B: a guarded one-time migration that overwrites only the exact known placeholder string. This is a human decision in §7.4 Q1; no migration code is written until it is approved. |

### 2.4 Simulated payment, double-submit and confirmation

| # | Gap / edge case | Decision in this spec |
| --- | --- | --- |
| G16 | **"Pay button enabled only after accepting the terms" is necessary but not sufficient.** | `canPay()` requires **all** of: `summaryLoadStatus === 'ready'`, `termsAvailable === true`, `termsAccepted === true`, and `paymentStatus` is `idle` or `rejected`. Pay is disabled while `loading`, `error`, `empty-terms`, `processing` and `confirmed`. The disabled rule is enforced in `canPay()` **and** reflected as `disabled` + `aria-disabled` on the button (§6.2). |
| G17 | **"Payment cannot be submitted twice" needs an exact mechanism, not a UI hope.** | `WizardStore.submitPayment()` performs a **synchronous check-and-set with no `await` between them**: if `paymentStatus()` is `processing` or `confirmed`, or `!canPay()`, it returns immediately; otherwise it sets `paymentStatus = 'processing'` in the same tick before calling the service. A second click, a double `Enter`, or a programmatic second call in the same tick therefore sees `'processing'` and does nothing. The button is additionally disabled during processing. Verified by `US03-U09` and `US03-E10`. |
| G18 | **A simulated service still needs a defined boundary and zero sensitive data.** | Injectable, frontend-only `SimulatedPaymentService` (`providedIn: 'root'`). Its request carries only `country`, `locale`, `documentMaskVisibleEnd` already-derived display data, the selected plan `documentId`, the terms `documentId`, and a boolean test hook. **No card number, CVV, expiry, billing address, token or PII beyond the wizard's existing values.** It issues **no HTTP request at all** and returns a `Promise<SimulatedPaymentResult>` after a short injectable delay (default `600 ms`, `0` in unit tests). Success/failure is decided by the deterministic test hook (§7.4 Q2). |
| G19 | **"Simulated quote number" has no format or uniqueness rule.** | `COT-${country}-${YYYYMMDD}-${XXXXXX}`: the `YYYYMMDD` part is the local calendar date from an injected `QuoteClock` at the moment of success; `XXXXXX` is six uppercase base-36 characters derived from a stable, order-independent hash of the canonical confirmation payload (§5.4). Same payload + same date → byte-identical number across browsers and reloads. CO and CL are distinguished by their prefix. Tests inject a fixed clock and assert exact strings; no `Math.random()`, no `Date.now()` inside the number derivation. |
| G20 | **Confirmation must be a snapshot, not a live view that changes under the user.** | On success the store builds a `QuoteConfirmation` and **`Object.freeze`s** it and its nested records/arrays before setting `paymentStatus = 'confirmed'`. The confirmation view renders only from that frozen object: quote number, masked document, plan name, final price and localized issue timestamp. Subsequent form edits, Strapi edits or price changes cannot alter a displayed confirmation. |
| G21 | **Rejected payment must not lose information (AC4).** | On rejection only `paymentStatus` changes to `'rejected'`. `step1` values, selected plan, `countryConfig`, `termsAccepted` and all sessionStorage data are untouched. An `role="alert"` panel shows "No pudimos procesar el pago simulado. Inténtalo de nuevo; tus datos siguen guardados." plus a "Reintentar pago" button. The visitor never returns to Step 1 or re-enters data to retry. |
| G22 | **"Nueva cotización" versus back-navigation are different operations.** | "Editar datos" and "Cambiar plan" are pure navigation (`quotePath('quote')` / `quotePath('plans')`) and preserve `step1` + `selectedPlanDocumentId` in store and sessionStorage. Only the confirmation view's **"Nueva cotización"** calls `store.reset(country)` → `persistence.clear(country)`, then navigates to `/:country/quote`. No other control in US-03 clears storage. |
| G23 | **Reload after a confirmed (simulated) payment is ambiguous.** | Decision: confirmation and `termsAccepted` are **in-memory only** and not added to `PersistedWizardStateV1`. A reload therefore restores Step 1 + selected plan, passes `step2CompleteGuard`, and lands on a fresh summary with terms unchecked and no confirmation shown. This avoids persisting a "paid" flag for a payment that never happened. Alternative (persist a confirmation under a separate key) is flagged in §7.4 Q3. |

### 2.5 Async states and assumptions taken as given

| # | Gap / edge case | Decision in this spec |
| --- | --- | --- |
| G24 | **Async views need explicit loading/error states (`AGENTS.md` §4.4) absent from the story.** | `loading` → `aria-busy="true"`, skeletons for the three sections, no checkbox and no Pay. `error` → `role="alert"` "No pudimos cargar la configuración de tu país." + "Reintentar" + "Volver a planes"; storage untouched. Retry reuses `loadSummaryContext(country)` once, no backoff. |
| G25 | **`sessionStorage` may throw** (private mode, disabled storage). | `WizardPersistenceService` already swallows storage errors; US-03 inherits that. Payment and confirmation still work in memory; dev-console warning only, no blocking notice. |
| G26 | **Country switch on the summary page.** | `CountryContextService.country()` changes → the page calls `loadSummaryContext(newCountry)`, resets `termsAccepted = false`, and re-derives the summary from the new country's Strapi data. A frozen confirmation is abandoned by a country switch (the visitor is leaving that quote). |
| G27 | **Assumptions taken as given.** | (a) Strapi on `http://localhost:1337`, Angular on `http://localhost:4200`, no token in `frontend/src/environments/*`. (b) `draftAndPublish: true`; unauthenticated `find` returns published rows only. (c) All seed/fixture data is strictly fictitious and all user-facing copy is localized Spanish. (d) Payment is simulated and front-end-only; there is no quote POST. (e) The 2026 dates in examples are illustrative; the quote number uses the injected clock. |

---

## 3. Multi-Country Seed Contract (`CO` & `CL`)

US-03 changes **copy inside an existing collection type only**. There is no new schema, no new permission and no new seed entity beyond upgrading the two strings already present in `backend/src/bootstrap/seed-data.ts`.

### 3.1 `country-config` seed records (existing schema, upgraded copy)

Natural key for `country-config` is **`country`** (`strapi-multi-country` §3). Both rows are created by the idempotent bootstrap with `status: 'published'`.

| Field | Colombia (`CO`) | Chile (`CL`) | Change in US-03 |
| --- | --- | --- | --- |
| `country` | `CO` | `CL` | none |
| `countryName` | `Colombia` | `Chile` | none |
| `currency` | `COP` | `CLP` | none |
| `localeCode` | `es-CO` | `es-CL` | none |
| `termsAndConditions` | upgraded (§3.2) | upgraded (§3.2) | **yes** — placeholder → country-distinct simulated text |
| `documentMaskVisibleEnd` | `4` | `4` | none (value retained; Strapi-editable at runtime per G7) |

### 3.2 Upgraded `termsAndConditions` seed copy (simulated, fictitious, localized)

The current constants are explicitly placeholders:

- `TERMS_AND_CONDITIONS_CO` / `TERMS_AND_CONDITIONS_CL` currently read `TÉRMINOS Y CONDICIONES — TEXTO DE DEMOSTRACIÓN (PENDIENTE DE APROBACIÓN LEGAL)…` (`seed-data.ts` lines 85–93).

They must be upgraded to the following **country-distinct** text. Both remain clearly simulated (never presented as real legal terms), preserve the "no real policy / no real payment" warning required by `AGENTS.md` §4.1/§4.3, and use country-specific currency and local-authorization wording:

**Colombia (`es-CO`)** — proposed `TERMS_AND_CONDITIONS_CO` value:

> TÉRMINOS Y CONDICIONES SIMULADOS — COLOMBIA.
> Este documento es ficticio y se utiliza únicamente para demostrar el funcionamiento del cotizador.
> La cotización es simulada: no constituye una póliza de seguros, no genera cobertura alguna y no crea obligaciones de pago reales.
> Los datos del tomador y del vehículo se utilizan solo en tu navegador durante esta sesión y no se envían a ningún servidor para contratar un seguro.
> Los precios y los ajustes mostrados son ilustrativos y no representan una oferta comercial.
> El pago es simulado y no se procesa ningún instrumento de pago real.
> Los precios están expresados en pesos colombianos (COP).
> Para contratar un seguro de auto real debes acudir a una aseguradora autorizada en Colombia y revisar los términos y condiciones vigentes conforme a la regulación local.

**Chile (`es-CL`)** — proposed `TERMS_AND_CONDITIONS_CL` value:

> TÉRMINOS Y CONDICIONES SIMULADOS — CHILE.
> Este documento es ficticio y se utiliza únicamente para demostrar el funcionamiento del cotizador.
> La cotización es simulada: no constituye una póliza de seguros, no genera cobertura alguna y no crea obligaciones de pago reales.
> Los datos del tomador y del vehículo se utilizan solo en tu navegador durante esta sesión y no se envían a ningún servidor para contratar un seguro.
> Los precios y los ajustes mostrados son ilustrativos y no representan una oferta comercial.
> El pago es simulado y no se procesa ningún instrumento de pago real.
> Los precios están expresados en pesos chilenos (CLP).
> Para contratar un seguro de auto real debes acudir a una aseguradora autorizada en Chile y revisar los términos y condiciones vigentes conforme a la regulación local.

Notes:

- The two strings are **different** (country name, currency sentence and local-authorization sentence) so `US03-E03`/`US03-E04` can prove country scoping. Both are entirely Spanish; no English source words remain.
- The seed copy is a **demo baseline**, not legal sign-off. The business team may replace it in the Strapi admin at any time; because Step 3 fetches live (G11), that edit takes effect on reload with no redeploy. Human approval of this copy is §7.4 Q1.

### 3.3 No new content types, no permission changes

| Check | Result |
| --- | --- |
| New Strapi collection type required? | **No.** `country-config` already has `termsAndConditions` (`text`, required) and `documentMaskVisibleEnd` (`integer`, default `4`, `min: 0`) in `schema.json`. |
| New Public action required? | **No.** `country-config.find` and `country-config.findOne` are already in the six-action allowlist (`public-permissions.ts` lines 15–22). |
| New `/api/` URL in the front end? | **No.** `CatalogueApi.getCountryConfig()` already owns the only `country-configs` URL (`ADR-001` §4.4 C5). |
| Seed idempotency invariant | Unchanged: create only when neither a draft nor a published row exists for the natural key; never delete or overwrite business-edited rows (`seed.ts` §1–§12). See G15 / §7.4 Q1 for the existing-DB caveat. |

### 3.4 Seed coverage and invariants

| Invariant | `CO` | `CL` |
| --- | --- | --- |
| Published `country-config` rows | 1 | 1 |
| `termsAndConditions` is non-blank after upgrade | yes | yes |
| Terms strings differ from each other | yes | yes |
| `documentMaskVisibleEnd` | `4` | `4` |
| All copy localized Spanish (`es-CO` / `es-CL`) | yes | yes |
| All data strictly fictitious | yes | yes |

---

## 4. Strapi 5 Content Model & REST API Contract

### 4.1 `country-config` content type (`api::country-config.country-config`) — unchanged schema

| Attribute | Type | Constraints | Relevance to US-03 |
| --- | --- | --- | --- |
| `country` | `enumeration` | required, unique; `CO \| CL` | Filter key for the canonical query. |
| `countryName` | `string` | required | Read into `CountryConfig`; not rendered on Step 3. |
| `currency` | `enumeration` | required; `COP \| CLP` | Drives the footnote/price currency already formatted by US-02. |
| `localeCode` | `string` | required | `es-CO` / `es-CL`; drives `formatIsoDate()` and localized chrome. `locale` remains reserved; never rename this field. |
| `termsAndConditions` | `text` | required | **The terms text.** Read live; blank/whitespace → `empty-terms` (G12). |
| `documentMaskVisibleEnd` | `integer` | default `4`, `min: 0` | The mask tail length for `maskDocumentNumber()` (G7–G9). |

Options: `draftAndPublish: true`; no relations, no media, no i18n, no components. US-03 does **not** edit `schema.json`.

### 4.2 Canonical query URL (exact string) and live-refresh contract

```http
GET {apiBaseUrl}/api/country-configs?filters[country][$eq]=CO
GET {apiBaseUrl}/api/country-configs?filters[country][$eq]=CL
```

Rules:

- `CatalogueApi.getCountryConfig(country)` is the **only** builder of these URLs; exactly one `filters[country][$eq]` per request, no `populate`, no `locale`, no `status`, no extra `pagination` parameter.
- Unauthenticated `GET`, **no `Authorization` header**, no cookies, no credentials mode (`ADR-002` §4.1, §4.3).
- The page calls this method **on every Step 3 entry and every retry** (G11). It does **not** reuse a module-level cache and does **not** treat the US-01 `countryConfig` signal as authoritative for Step 3.
- Static rule inherited from `US01-U22`: zero `'/api/'` literals anywhere in `frontend/src/app/**` except `catalogue.api.ts` and `environments/`.

### 4.3 Flattened Strapi 5 response shapes (no `.attributes`)

`GET /api/country-configs?filters[country][$eq]=CO` → `200` (published row; terms abbreviated here with `…` for readability — the real value is the full §3.2 string):

```json
{
  "data": [
    {
      "id": 1,
      "documentId": "cfgcol0000000000000001",
      "country": "CO",
      "countryName": "Colombia",
      "currency": "COP",
      "localeCode": "es-CO",
      "termsAndConditions": "TÉRMINOS Y CONDICIONES SIMULADOS — COLOMBIA. …",
      "documentMaskVisibleEnd": 4,
      "publishedAt": "2026-11-24T10:00:00.000Z"
    }
  ],
  "meta": { "pagination": { "page": 1, "pageSize": 25, "pageCount": 1, "total": 1 } }
}
```

`GET /api/country-configs?filters[country][$eq]=CL` → `200` (distinct text, `es-CL`, `CLP`, `documentId` `cfgcll0000000000000001`).

`mapCountryConfig()` accepts the row only when `id` is a number, `documentId` and `countryName` are strings, `rowCountry === requested country`, `currency` is `COP`/`CLP`, and `termsAndConditions` is a **string**; it falls back to the country's static locale and to mask `4` when those are invalid (`catalogue.api.ts` lines 420–467). A blank-but-valid string still maps to `CountryConfig` and is caught by the page as `empty-terms` (G12).

Additional shapes the client must tolerate:

| Shape | Mapping |
| --- | --- |
| `{"data": []}` → `null` | `mapCountryConfig` returns `null` → **`empty-terms`** (G12), not `error`. |
| `{"data": [{"termsAndConditions": "   "}]}` | Valid `CountryConfig` with blank text → **`empty-terms`** (G12). |
| `400` malformed query, `401`/`403` permission regression, `404` path typo, `500`/network failure | Any thrown `HttpErrorResponse` or non-`2xx` → **`error`** (G24), never `empty-terms`; sessionStorage untouched. |
| `data[0].documentMaskVisibleEnd` = `0`, negative, or a string | `0` is honoured (full mask); negative/string degrades to `4` per existing mapper (G8). |

### 4.4 Public role permission contract (ADR-002) — unchanged, six read-only actions

| Content type / action | `find` | `findOne` | `create` | `update` | `delete` |
| --- | --- | --- | --- | --- | --- |
| `api::form-field.form-field` | ALLOWED | ALLOWED | DENIED | DENIED | DENIED |
| `api::country-config.country-config` | **ALLOWED (re-exercised live by US-03)** | **ALLOWED** | DENIED | DENIED | DENIED |
| `api::insurance-plan.insurance-plan` | ALLOWED | ALLOWED | DENIED | DENIED | DENIED |
| Any other `api::*`, `plugin::*`, `admin::*` | DENIED | DENIED | DENIED | DENIED | DENIED |
| API tokens (any type, any scope) | **NONE ISSUED / NONE SHIPPED** | — | — | — | — |

The complete Public permission set remains exactly **six read-only actions**. `POST`/`PUT`/`DELETE` on any content type return `401`/`403`; no `Authorization` header is ever sent; no write token exists in `frontend/src/environments/*`. The simulated payment adds **zero** network requests. Verify with `ADR-002` §4.6 V2, V4–V6, V10, V11, V14 and `US03-E16`.

---

## 5. Angular 21 Architecture & Typed Contracts

All components: standalone, `ChangeDetectionStrategy.OnPush`, `inject()`, signal `input()`/`output()`, `@if` / `@for (… ; track …)` / `@switch`, zero `NgModule`, zero `any` (`AGENTS.md` §4.1, `angular-dynamic-wizard` §1). Zero new `/api/` literals (§4.2).

### 5.1 Typed data contracts (`frontend/src/app/core/models/`)

Reuse `CountryCode`, `CurrencyCode`, `AppLocale`, `FormValue`, `CatalogueStatus`, `CountryConfig`, `QuotedPlan`, `PersistedWizardStateV1` from US-01/US-02. **Add** (no existing interface is modified):

```ts
// ---- Summary view models (computed only, never persisted) ----

export interface SummaryRow {
  readonly key: string;
  /** Verbatim form-field.label from the freshly fetched Strapi catalogue. */
  readonly label: string;
  /** Already localized/derived display string (option label, Sí/No, formatted date, masked doc, —). */
  readonly value: string;
}

export interface SummarySection {
  readonly id: 'policyholder' | 'vehicle';
  readonly heading: string;
  readonly rows: readonly SummaryRow[];
}

/** Reads only from the US-02 QuotedPlan — never recomputes pricing. */
export interface PlanSummary {
  readonly name: string;
  readonly shortDescription: string;
  readonly basePriceText: string;
  readonly finalPriceText: string;
  readonly adjustmentText: string;
  readonly footnote: string;
  /** Machine-readable integer for <data [attr.value]>. */
  readonly finalPrice: number;
}

// ---- Step 3 lifecycle ----

export type SummaryLoadStatus = 'idle' | 'loading' | 'ready' | 'empty-terms' | 'error';
export type PaymentStatus = 'idle' | 'processing' | 'rejected' | 'confirmed';

// ---- Simulated payment boundary (frontend only, zero network, zero card data) ----

export interface SimulatedPaymentRequest {
  readonly country: CountryCode;
  readonly locale: AppLocale;
  readonly planDocumentId: string;
  readonly termsDocumentId: string;
  /** Deterministic failure hook; false for the shipped happy path (§7.4 Q2). */
  readonly shouldFail: boolean;
  /** Injectable in unit tests; default 600 ms in the service. */
  readonly delayMs?: number;
}

export type SimulatedPaymentResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: 'SIMULATED_REJECTION' };

/** Frozen at success; the confirmation view renders ONLY from this object. */
export interface QuoteConfirmation {
  readonly quoteNumber: string;
  readonly country: CountryCode;
  readonly locale: AppLocale;
  readonly currency: CurrencyCode;
  /** ISO timestamp from QuoteClock, formatted for display at render time. */
  readonly issuedAt: string;
  readonly policyholder: readonly SummaryRow[];
  readonly vehicle: readonly SummaryRow[];
  readonly planName: string;
  readonly finalPrice: number;
  readonly formattedFinalPrice: string;
  readonly termsDocumentId: string;
}
```

`QuoteConfirmation` stores the **masked** document value from `SummaryRow` and never the raw `documentNumber` (G10). `PersistedWizardStateV1` is unchanged — no confirmation, `termsAccepted`, or `paymentStatus` field is added (G23).

### 5.2 Live `countryConfig` load — `CatalogueApi` unchanged

```ts
// core/catalogue/catalogue.api.ts — NO new method, NO signature change
getCountryConfig(country: CountryCode): Observable<CountryConfig | null>; // existing (US-01)
```

US-03 only **calls** this method from the Step 3 page/store. Behavioural reliance (already implemented, re-asserted here as a contract):

1. Build exactly `GET {apiBaseUrl}/api/country-configs?filters[country][$eq]=<country>` (§4.2).
2. `mapCountryConfig()` validates the flattened row and returns `CountryConfig | null`; `termsAndConditions` must be a string, `documentMaskVisibleEnd` degrades to `4` when invalid (§4.3).
3. An empty `data` array maps to `null`; a non-`2xx`/network error propagates as `HttpErrorResponse`.
4. **No cache in the store or the page.** `loadSummaryContext(country)` re-subscribes on every entry and retry so Strapi edits are visible on reload (G11, `US03-E05`).

### 5.3 `WizardStore` Step 3 signals and methods (extended, not replaced)

```ts
// features/quote/wizard.store.ts — extended, NOT replaced
private readonly summaryStatusSignal = signal<SummaryLoadStatus>('idle');
private readonly summaryErrorSignal = signal<string | null>(null);
private readonly summaryConfigSignal = signal<CountryConfig | null>(null);
private readonly termsAcceptedSignal = signal(false);
private readonly paymentStatusSignal = signal<PaymentStatus>('idle');
private readonly confirmationSignal = signal<QuoteConfirmation | null>(null);

readonly summaryStatus = this.summaryStatusSignal.asReadonly();
readonly summaryError = this.summaryErrorSignal.asReadonly();
readonly summaryConfig = this.summaryConfigSignal.asReadonly();
readonly termsAccepted = this.termsAcceptedSignal.asReadonly();
readonly paymentStatus = this.paymentStatusSignal.asReadonly();
readonly confirmation = this.confirmationSignal.asReadonly();

readonly termsAvailable = computed<boolean>(() => {
  const config = this.summaryConfig();
  return config !== null && config.termsAndConditions.trim().length > 0;
});

readonly canPay = computed<boolean>(() =>
  this.summaryStatus() === 'ready' &&
  this.termsAvailable() &&
  this.termsAccepted() &&
  (this.paymentStatus() === 'idle' || this.paymentStatus() === 'rejected')
);

readonly summarySections = computed<readonly SummarySection[]>(...); // §5.4, from fields() + step1Values()
readonly planSummary = computed<PlanSummary | null>(...);             // §5.4, from selectedPlan()/quotedPlans

async loadSummaryContext(country: CountryCode): Promise<void>;
setTermsAccepted(accepted: boolean): void;
submitPayment(): void;              // synchronous check-and-set; see below
async retrySummary(country: CountryCode): Promise<void>;
```

**Lifecycle:**

- **`loadSummaryContext(country)`:** set `summaryStatus = 'loading'`, `summaryError = null`, `termsAccepted = false`, `paymentStatus = 'idle'`, `confirmation = null` → `getCountryConfig(country)` → on error set `summaryStatus = 'error'` and keep all Step 1/plan/storage state → on `null` or blank terms set `summaryStatus = 'empty-terms'` → otherwise set `summaryConfig`, `summaryStatus = 'ready'`.
- **`retrySummary(country)`:** identical to `loadSummaryContext(country)`, once, no backoff, no storage clearing.
- **`setTermsAccepted(accepted)`:** only writes the signal; never triggers navigation or persistence.
- **Payment retry after rejection:** "Reintentar pago" calls `submitPayment()` **again on the same loaded context** — it does **not** call `loadSummaryContext()`, so `termsAccepted` stays `true` and Step 1/plan/config are untouched (G21). Only a full page reload or an explicit entry re-navigation resets them.
- **`newQuote(country)`:** delegates to the existing `reset(country)`, which calls `persistence.clear(country)` and resets every signal including the new Step 3 ones; the component then navigates to `quotePath('quote')` (G22).

**Strict synchronous double-submit lock (G17) — exact order:**

```ts
submitPayment(): void {
  // 1. synchronous guards — no await anywhere before the lock is set
  if (this.paymentStatus() === 'processing' || this.paymentStatus() === 'confirmed') return;
  if (!this.canPay()) return;

  // 2. build the request from synchronous state only
  const request = this.buildPaymentRequest();

  // 3. LOCK: same tick as the guards
  this.paymentStatusSignal.set('processing');

  // 4. async work starts only AFTER the lock
  void this.finishPayment(request);
}
```

`finishPayment()` awaits `SimulatedPaymentService.pay()`, then either (a) builds the frozen confirmation, sets `paymentStatus = 'confirmed'`, or (b) sets `paymentStatus = 'rejected'`. It catches **all** failures and always maps them to `'rejected'` — an unhandled rejection can never leave the UI stuck in `processing`. No `await` may be inserted between steps 1 and 3 by a future refactor; `US03-U09` guards this ordering.

### 5.4 Pure domain helpers (no Angular imports, never throw on valid typed input)

```ts
/** One bullet per hidden char; visible tail verbatim; RUT -K protection (G7–G9). */
export function maskDocumentNumber(rawValue: string, visibleEnd: number): string;

/** ISO YYYY-MM-DD → Intl.DateTimeFormat(locale, { year:'numeric', month:'long', day:'numeric' }). */
export function formatIsoDate(iso: string, locale: AppLocale): string;

/** COT-<CO|CL>-<YYYYMMDD>-<XXXXXX>; deterministic FNV-1a over a canonical payload (G19). */
export function buildQuoteNumber(
  country: CountryCode,
  payload: Readonly<Record<string, string>>,
  clock: Readonly<{ readonly today: Date }>,
): string;

/** Derived, never persisted; resolves labels/options/booleans/blanks (G1–G6). */
export function buildSummarySections(
  fields: readonly FormFieldConfig[],
  values: Readonly<Record<string, FormValue>>,
  documentMaskVisibleEnd: number,
  yes: string,
  no: string,
  blankPlaceholder: string,
): readonly SummarySection[];

export function buildPlanSummary(quoted: QuotedPlan, copy: PlanSummaryCopy): PlanSummary;
```

**`maskDocumentNumber` normative algorithm:**

```text
MASK = '•'  (U+2022)
if rawValue.trim().length === 0            -> return ''
if visibleEnd <= 0                         -> return MASK.repeat(rawValue.length)
if rawValue.length <= visibleEnd           -> return rawValue
visible = visibleEnd
if /-[0-9Kk]$/.test(rawValue)              -> visible = min(rawValue.length, max(visibleEnd, 2))
return MASK.repeat(rawValue.length - visible) + rawValue.slice(rawValue.length - visible)
```

Worked examples (all fictitious — tests assert these exactly):

| `rawValue` | `visibleEnd` | Result | Note |
| --- | --- | --- | --- |
| `123456789` | `4` | `•••••6789` | CO document, 9 chars |
| `12345678-5` | `4` | `••••••78-5` | CL RUT, numeric verifier |
| `12345678-K` | `4` | `••••••78-K` | CL RUT, `K` verifier preserved verbatim |
| `12345678-k` | `4` | `••••••78-k` | Lowercase `k` preserved (no case change) |
| `12345678-K` | `1` | `••••••••-K` | RUT rule extends the tail to the dash + verifier |
| `12345678-K` | `0` | `••••••••••` | Fully masked; `visibleEnd <= 0` wins over the RUT rule |
| `1234` | `4` | `1234` | Nothing to hide |
| `12` | `4` | `12` | Short input |
| `  ` | `4` | `` | Whitespace-only → empty |

**`buildQuoteNumber` normative algorithm:**

```text
DATE = YYYYMMDD of clock.today (local calendar date, no UTC conversion)
canonical = [country, ...Object.keys(payload).sort().map(k => k + '=' + payload[k])].join('|')
hash = FNV-1a 32-bit over the UTF-16 code units of canonical   // start 0x811C9DC5, prime 0x01000193
XXXXXX = hash.toString(36).toUpperCase().padStart(6, '0').slice(-6)
return `COT-${country}-${DATE}-${XXXXXX}`
```

`payload` is the canonical confirmation payload: the display rows (already masked), `planDocumentId`, `termsDocumentId` and `locale`. It **excludes** `issuedAt` and any random value, so identical inputs + identical clock produce an identical number. FNV-1a is chosen because it is pure, dependency-free and byte-identical across browsers and Node. Example shape (illustrative): `COT-CO-20261124-0A7K3P`; tests assert against the fixed-clock/fixed-payload expected value, not against a live clock.

**`formatIsoDate`:** parse `YYYY-MM-DD` into numbers and construct `new Date(y, m - 1, d)` (local calendar, no `Date.parse` UTC shift); an unparseable ISO string is returned unchanged rather than throwing.

### 5.5 `SimulatedPaymentService` (frontend only)

```ts
// core/payment/simulated-payment.service.ts
@Injectable({ providedIn: 'root' })
export class SimulatedPaymentService {
  pay(request: SimulatedPaymentRequest): Promise<SimulatedPaymentResult> {
    // no HttpClient, no fetch, no WebSocket, no storage access
    // resolves { ok: true } or { ok: false, code: 'SIMULATED_REJECTION' } after request.delayMs ?? 600
  }
}
```

Contract:

| Rule | Detail |
| --- | --- |
| Zero network | No `HttpClient`, `fetch`, `XMLHttpRequest`, `WebSocket` or backend call. `US03-E16` asserts no new `/api/**` request on Pay. |
| Zero sensitive data | Request type contains no card/expiry/CVV/address/token field; tests assert the service is called with exactly the typed keys (§5.1). |
| Injectable delay | Default `600 ms`; unit tests pass `delayMs: 0`. No `setTimeout` loop, no retry inside the service. |
| Deterministic outcome | `shouldFail: true` → `{ ok: false, code: 'SIMULATED_REJECTION' }`; otherwise `{ ok: true }`. The trigger mechanism is a Checkpoint 3 decision (§7.4 Q2). |
| No throw for the rejection path | A rejection is a **result value**, not an exception; only unexpected programmer errors throw, and `finishPayment()` still maps them to `rejected`. |

### 5.6 Components, routing, shared copy and layout

| Component | Responsibility |
| --- | --- |
| `QuoteStep3SummaryPageComponent` | **Replaces** `SummaryPlaceholderPageComponent` (files `quote-step3-summary-page.{ts,html,scss}`). Calls `loadSummaryContext(country())` on entry and on country change, renders stepper (step 3 active), owns heading focus and the seven states. |
| `SummarySectionComponent` | One read-only `<dl>` section ("Tomador"/"Vehículo") from a `SummarySection` signal `input()`. No local state. |
| `TermsPanelComponent` | Scrollable terms `<section>` + the acceptance checkbox with `<label for>`. Signal `input()` of the terms text; `output()` of the checkbox change. |
| `PaymentPanelComponent` | Price lines, Pay button, processing/rejection messaging and the two edit links. Signal `input()` of `PlanSummary`, `canPay`, `paymentStatus`; `output()` of `pay` / `retry`. |
| `QuoteConfirmationComponent` | Renders only the frozen `QuoteConfirmation`: quote number, masked document, plan, final price, "Nueva cotización". |
| `StatePanelComponent`, `WizardStepperComponent`, `CountrySwitcherComponent`, `AppShellComponent` | Reused unchanged from US-01/US-02. The stepper remains non-interactive (plain `<li>`); navigation only through buttons/links. |

`UI_COPY` additions (all neutral Spanish, shared chrome; **all existing keys unchanged**). Country-specific values — terms text, mask length, field labels, option labels — never come from here:

```ts
summaryTomadorHeading: 'Tomador',
summaryVehicleHeading: 'Vehículo',
summaryPlanHeading: 'Plan elegido',
summaryLoading: 'Cargando el resumen…',
termsHeading: 'Términos y condiciones',
termsAcceptLabel: 'Acepto los términos y condiciones',
termsUnavailable: 'No pudimos cargar los términos y condiciones para este país.',
summaryErrorTitle: 'No pudimos cargar la configuración de tu país.',
summaryErrorBody: 'Revisa tu conexión e inténtalo de nuevo. Tus datos siguen guardados.',
editData: 'Editar datos',
changePlan: 'Cambiar plan',
pay: 'Pagar',
payProcessing: 'Procesando pago simulado...',
paymentRejected: 'No pudimos procesar el pago simulado. Inténtalo de nuevo; tus datos siguen guardados.',
retryPayment: 'Reintentar pago',
confirmationHeading: '¡Pago simulado confirmado!',
confirmationBody: 'Tu cotización simulada se ha registrado con el siguiente número:',
quoteNumberLabel: 'Número de cotización',
newQuote: 'Nueva cotización',
yes: 'Sí',
no: 'No',
blankPlaceholder: '—',
```

Routing table (`app.routes.ts`, lazy `loadComponent`): only the summary row changes.

| Path | Behaviour |
| --- | --- |
| `''` | `redirectTo: 'co/quote'`, `pathMatch: 'full'` (unchanged) |
| `':country/quote'` | `canActivate: [countryRouteGuard]` → `QuoteStep1PageComponent` (unchanged) |
| `':country/quote/plans'` | `canActivate: [countryRouteGuard, step1CompleteGuard]` → `QuoteStep2PlansPageComponent` (unchanged) |
| `':country/quote/summary'` | `canActivate: [countryRouteGuard, step2CompleteGuard]` → **`QuoteStep3SummaryPageComponent`** (replaces the placeholder) |
| `'**'` | `NotFoundPageComponent` (unchanged) |

`step2CompleteGuard` is **not modified**: invalid/missing Step 1 → `/:country/quote`; Step 1 valid but `selectedPlan() === null` → `/:country/quote/plans`; otherwise allow. This guarantees the summary never renders without data or a plan.

```
QuoteStep3SummaryPage ─reads─▶ WizardStore(summaryStatus, summaryConfig, termsAccepted,
        │                              paymentStatus, confirmation, summarySections, planSummary)
        │                        │
        │                        ├──▶ CatalogueApi.getCountryConfig ──GET──▶ Strapi (live, every entry)
        │                        ├──▶ SimulatedPaymentService.pay() ──▶ in-memory result (NO network)
        │                        └──▶ QuoteClock ──▶ quote-number date
        └──renders─▶ SummarySection[] + TermsPanel + PaymentPanel | QuoteConfirmation
                     ├──"Editar datos" ──▶ quotePath('quote')     (state preserved)
                     ├──"Cambiar plan" ──▶ quotePath('plans')     (state preserved)
                     └──"Nueva cotización" ──▶ reset(country) ──▶ persistence.clear ──▶ quotePath('quote')
```

---

## 6. UI States, Accessibility & Responsiveness

### 6.1 Explicit states

| State | Trigger | Rendering | Accessibility |
| --- | --- | --- | --- |
| `loading` | `summaryStatus === 'loading'` (or `'idle'` on first paint) | Stepper visible; three skeleton blocks for Tomador/Vehículo/Plan; **no** terms checkbox and **no** Pay | `<section aria-busy="true">` + polite "Cargando el resumen…"; focus on `<h1 tabindex="-1">` on entry |
| `error` | Non-`2xx` / network failure from `getCountryConfig` | `role="alert"` panel: "No pudimos cargar la configuración de tu país." + "Reintentar" + "Volver a planes"; dev-only HTTP detail; storage untouched | `role="alert"`; heading receives focus; keyboard-reachable actions |
| `empty-terms` | Config `null` **or** `termsAndConditions.trim() === ''` | `role="alert"` panel: "No pudimos cargar los términos y condiciones para este país." + "Reintentar" + "Volver a planes"; **no checkbox and no Pay** | `role="alert"`; heading receives focus; Pay absent/disabled (G12, G16) |
| `ready` | Valid config with non-blank terms | Three read-only sections + scrollable terms + acceptance checkbox + Pay button (disabled until accepted) | See §6.2; Pay is `disabled` + `aria-disabled="true"` while `!termsAccepted` |
| `processing` | `paymentStatus === 'processing'` after `submitPayment()` | Terms/checkbox/sections remain visible and read-only; Pay shows **"Procesando pago simulado..."** and is locked; no second control can start a payment | `disabled` + `aria-disabled="true"` on Pay; `aria-live="polite"` announces the processing label; synchronous lock (G17) |
| `rejected` | `SimulatedPaymentResult.ok === false` (or unexpected throw) | `role="alert"` panel above the still-editable Pay area: "No pudimos procesar el pago simulado. Inténtalo de nuevo; tus datos siguen guardados." + **"Reintentar pago"**; terms checkbox stays checked; all data intact | `role="alert"`; heading receives focus; retry is keyboard-reachable; no data lost (G21) |
| `confirmed` | `paymentStatus === 'confirmed'` | Entire form replaced by `QuoteConfirmationComponent`: heading "¡Pago simulado confirmado!", explanatory line, quote number (monospace, `<data>`), masked document, plan name, formatted final price, **"Nueva cotización"** | `role="status"` + `aria-live="polite"`; heading receives focus; no stale Pay button in the DOM |

`canPay()` (§5.3) is the single gate. Pay is **disabled** while `loading`, `error`, `empty-terms`, `processing` and `confirmed`, and until the terms checkbox is checked — never an enabled button that fails on click. Only `rejected` re-enables it while keeping `termsAccepted = true`.

### 6.2 Accessibility contract

- Page `<h1 tabindex="-1">` ("Resumen de tu cotización") receives programmatic focus on route entry, after country change, after error/empty-terms retry success, on rejection and on confirmation, so screen-reader users know where they are (`angular-dynamic-wizard` §4).
- Read-only sections use `<dl>` with `<dt>` (the verbatim Strapi `label`) / `<dd>` (the derived value); every section has a visible heading (`<h2>`) wired via `aria-labelledby` on its `<section>`.
- Select display values are resolved to `option.label` (G2); booleans are the literal "Sí"/"No"; blank optional rows are omitted; final price also appears in `<data [attr.value]="planSummary.finalPrice">` so the exact integer is machine-readable.
- Terms are a bounded, scrollable `<section tabindex="0" role="region" [attr.aria-labelledby]="'terms-heading'">` with `white-space: pre-line`; keyboard users can scroll it with Arrow/Page keys. The checkbox is **outside** the scroll region.
- Acceptance control is a native `<input type="checkbox" id="terms-accepted">` with an explicit `<label for="terms-accepted">Acepto los términos y condiciones</label>`. No clickable `<div>`; no label-by-wrapper-only pattern.
- `[attr.aria-describedby]` on the checkbox resolves to the terms heading id and, when present, the validation/error id; `aria-invalid` is **not** set for the un-accepted state (it is not a validation error — Pay is simply gated). Error/rejection panels use `role="alert"`; processing and loading use `aria-live="polite"`.
- `:focus-visible` outline `2px` solid, ≥ `3:1` contrast, never removed without replacement; font-size ≥ `16px`; all interactive targets (checkbox, Pay, retry, links, confirmation action) ≥ `44×44px`.
- Tab order follows DOM order: country switcher → stepper (non-interactive) → read-only sections (not focusable) → terms scroll region → checkbox → "Editar datos" → "Cambiar plan" → Pay. No `tabindex > 0`.
- No real personal data, card fields, or payment branding appears in the DOM; the only payment wording is the simulated copy from §5.6.

### 6.3 Keyboard-only completion (full US-03 path)

| Action | Keys |
| --- | --- |
| Enter the summary from Step 2 | `Tab` to "Continuar" on plans, `Enter` → guard fires → `<h1>` focused on summary |
| Read terms | `Tab` into the terms region, `Arrow`/`PageDown`/`Space` to scroll, `Tab` out |
| Accept terms | `Tab` to checkbox, `Space` toggles → Pay becomes enabled (native change event) |
| Pay | `Tab` to "Pagar", `Enter` or `Space` → synchronous lock, "Procesando pago simulado..." |
| Retry after rejection | `Tab` to "Reintentar pago", `Enter` — no data re-entry required |
| Edit data | `Tab` to "Editar datos", `Enter` → `/:country/quote`, Step 1 values and plan preserved |
| Change plan | `Tab` to "Cambiar plan", `Enter` → `/:country/quote/plans`, selection preserved |
| New quote | On confirmation, `Tab` to "Nueva cotización", `Enter` → storage cleared → Step 1 |
| Retry after load error / empty terms | `Tab` to "Reintentar", `Enter` |

No action requires a pointer; no control is a clickable `<div>`. Verified by `US03-E15` and an Antigravity manual walkthrough at Checkpoint 4.

### 6.4 Responsiveness

| Viewport | Layout |
| --- | --- |
| `375px` | Single column, `16px` page padding; sections and terms stack full width; terms region max-height `40vh`; Pay and all actions full-width, ≥ `44px` high; no horizontal scroll (`document.scrollWidth === clientWidth`); quote number does not overflow (monospace, `overflow-wrap: anywhere`). |
| `768px` | Tomador and Vehículo in a two-column CSS grid (`repeat(2, minmax(0, 1fr))`), `16px` gap; Plan elegido and terms full width. |
| `1280px+` | Container max-width `1120px`, centred; Tomador/Vehículo side by side, Plan elegido and terms below; `24px` gap; labels and prices never truncated (`text-overflow: ellipsis` forbidden on price/quote-number elements). |

Colour/contrast meets WCAG 2.1 AA for text (`4.5:1`) and UI boundaries (`3:1`); the disabled Pay state remains perceivable and the rejection/confirmation states remain distinguishable in forced-colours mode because both carry text, not colour alone.

### 6.5 Security checks (non-negotiable)

| Check | Expected result |
| --- | --- |
| Browser headers | Zero `Authorization` headers; no cookies or credentials on any `/api/**` request (`ADR-002` §4.3). |
| HTTP methods | Every network request is `GET`; Pay produces **no** request at all. |
| Bundle / source scan | No `Bearer`, `apiToken`, `api_token`, `cardNumber`, `cvv` or payment-gateway URL in `frontend/src/**`. |
| Strapi Public role | Exactly the six read-only actions (§4.4); `POST`/`PUT`/`DELETE` → `401`/`403`. |
| Stored data | Only `PersistedWizardStateV1` (`step1` + `selectedPlanDocumentId`) in `sessionStorage`; no payment result, no raw document beyond what Step 1 already stores, no card data. |
| Personal data | All seed terms, fixtures and test data are fictitious (`AGENTS.md` §4.3, §5). |

---

## 7. Verifiable Acceptance Matrix & Open Questions for Checkpoint 3

### 7.1 Acceptance matrix — the four US-03 Gherkin scenarios

Owners: `tester-dev` writes all tests; `angular-dev` / `strapi-dev` make them pass. IDs are referenced in `docs/reviews/US-03-review.md`.

| US-03 AC | Gherkin (abridged) | Unit tests | E2E (Playwright) | Manual / Checkpoint 4 |
| --- | --- | --- | --- | --- |
| **AC1** — Complete summary | `Given I chose a plan / When I reach the summary / Then I see my data, my vehicle's data and the chosen plan with its final price` | `US03-U01` CO document masking. `US03-U02` mask edge cases. `US03-U03` RUT `-K` protection. `US03-U04` label/option/boolean/blank/date resolution. `US03-U05` three price lines read from `QuotedPlan` (no recompute). | `US03-E01` `/co/quote/summary`: "Tomador"/"Vehículo"/"Plan elegido", masked `123456789`, Strapi labels, `COP` prices. `US03-E02` `/cl/quote/summary`: `es-CL` labels, RUT `••••••78-K`, `CLP` prices. | Compare rendered sections with §3/§5 seed and fixtures. |
| **AC2** — Terms by country | `Given I am on the summary / When I view the terms and conditions / Then the text matches the one configured in Strapi for my country / And the pay button is disabled until I accept them` | `US03-U06` live `getCountryConfig` per entry, CO vs CL distinct. `US03-U07` blank/`null` → `empty-terms`, Pay disabled. `US03-U08` `canPay()` gating. | `US03-E03` CO terms equal the seeded Strapi value. `US03-E04` CL terms equal the seeded value and differ from CO. `US03-E05` edit terms + a field label/option in Strapi → reload → new values with no redeploy. `US03-E06` Pay disabled until checkbox toggled by keyboard. `US03-E07` blank terms → blocking panel, no Pay, retry. | Edit terms in Strapi admin for both countries, reload, confirm text changes immediately. |
| **AC3** — Successful payment | `Given I accepted the terms / When I click pay / Then the button is locked while the payment is processed / And I see the confirmation with the quote number` | `US03-U09` synchronous check-and-set lock. `US03-U10` success result, no HTTP, no card data. `US03-U12` `COT-<CC>-<YYYYMMDD>-<XXXXXX>` determinism. `US03-U13` frozen confirmation snapshot. | `US03-E09` accept → Pay → locked "Procesando pago simulado..." → confirmation with quote number and masked document. `US03-E10` rapid double-click/double-`Enter` → one service call, one quote number. | Keyboard-only pay and confirmation focus check. |
| **AC4** — Rejected payment | `Given the simulated payment fails / When I click pay / Then I see a clear error message / And I can try again without losing my information` | `US03-U11` rejection result keeps `step1`, plan, `termsAccepted`, storage; `paymentStatus = 'rejected'`. | `US03-E11` failure hook → `role="alert"` rejection copy → "Reintentar pago" → success without re-entering data or re-accepting terms. | Use the trigger approved in §7.4 Q2. |

### 7.2 Auxiliary checks (states, navigation, persistence, accessibility, security, responsiveness)

| # | Check | Type | Pass criteria |
| --- | --- | --- | --- |
| `US03-U14` | "Nueva cotización" reset | Unit (`G22`) | `reset(country)` calls `persistence.clear(country)` and clears `summaryStatus`, `summaryConfig`, `termsAccepted`, `paymentStatus`, `confirmation`, `step1` values and selected plan; no other method calls `clear()`. |
| `US03-U15` | Navigation preservation | Unit (`G22`, `ADR-003` §4.4) | Entering "Editar datos"/"Cambiar plan" does **not** call `clear()` or mutate `step1`/`selectedPlanDocumentId`; after re-entry the summary shows the same values and plan. |
| `US03-E08` | Loading + error states and retry | E2E (`G24`) | Delay config response 500 ms → `aria-busy="true"` + "Cargando el resumen…", skeletons, no checkbox/Pay. Abort request → `role="alert"` "No pudimos cargar la configuración de tu país." + "Reintentar"; next fulfilment renders `ready`; storage unchanged. |
| `US03-E12` | "Editar datos" | E2E (`G22`) | From the ready summary, click/keyboard "Editar datos" → `/:country/quote`; original (unmasked) document value is back in the Step 1 input; selected plan still in storage; advancing returns to the summary with the same plan. |
| `US03-E13` | "Cambiar plan" | E2E (`G22`) | "Cambiar plan" → `/:country/quote/plans`; previously selected radio still checked; choose another plan → "Continuar" → summary shows the new plan name and new final price. |
| `US03-E14` | "Nueva cotización" + reload | E2E (`G22`, `G23`) | From confirmation, "Nueva cotización" → `sessionStorage` key `wizard:state:v1:<CO\|CL>` removed → `/:country/quote` with empty form. Separately: after a confirmed payment, `page.reload()` restores Step 1 + plan, lands on a fresh summary with terms unchecked and **no** confirmation/quote number. |
| `US03-E15` | Keyboard-only + ARIA wiring | E2E + Antigravity walkthrough (`§6.2`, `§6.3`) | Full path via `Tab`/`Shift+Tab`/`Space`/`Enter` including terms scrolling, retry and confirmation. Assert `<h1 tabindex="-1">` focus on entry/rejection/confirmation, `label[for="terms-accepted"]`, `role="alert"` on error/empty-terms/rejection, `aria-live="polite"` on loading/processing, resolvable `aria-labelledby`/`aria-describedby`, `<data value>` = integer final price, visible `:focus-visible` outlines. |
| `US03-E16` | Responsive + security | E2E visual + network assertions (`§6.4`, `§6.5`, `ADR-002` V10/V11) | `375px`: single column, no horizontal scroll, targets ≥ 44 px; `1280px`: max-width respected, no truncation. Zero `Authorization` headers; Pay adds no `/api/**` request; `POST`/`PUT`/`DELETE` on content types → `401`/`403`; source scan finds no token/card keywords. |

### 7.3 Test fixtures (strictly fictitious)

| Purpose | Value |
| --- | --- |
| Fixed clock (unit) | `today = 2026-11-24`, so the quote-number date part is `20261124` (E2E uses the real clock with a computed expectation) |
| CO document (fictitious) | `123456789` → masked `•••••6789` at `visibleEnd = 4` |
| CL RUT (fictitious) | `12345678-K` → masked `••••••78-K` at `visibleEnd = 4`; `••••••••-K` at `visibleEnd = 1` |
| Fictitious names | `Ana Ejemplo` (CO), `Carlos Ejemplo` (CL) |
| Fictitious plates | `ABC123` (CO), `AA-BB-11` (CL) — rendered unmasked |
| Plan ids (from US-02) | `planco00000000000000002` / `plancl00000000000000002` (selected "Plan Estándar") |
| `country-config` documentIds | `cfgcol0000000000000001` (CO), `cfgcll0000000000000001` (CL) |
| Quote number example | `COT-CO-20261124-0A7K3P` (illustrative only — tests assert the deterministic helper's output for the fixed payload) |
| Rejection fixture | `SimulatedPaymentRequest.shouldFail = true`, `delayMs = 0` in unit tests; E2E injects the same hook via the mechanism approved in §7.4 Q2 |

No real identity documents, plates, addresses, card data, or personal data appear in seeds, fixtures, or session logs (`AGENTS.md` §4.3).

### 7.4 Open Questions for Checkpoint 3 (human approval required)

1. **Terms seed copy and existing databases (§3.2, G15).** Approve the two country-distinct **simulated** terms strings as the demo baseline, understanding they are not legal sign-off. Then choose the migration policy: **Option A (recommended)** — keep the strict create-only idempotency from Checkpoint 2; the seed upgrade affects fresh databases only, and the business edits terms in the Strapi admin for already-running environments; or **Option B** — add a one-time guarded migration that overwrites `termsAndConditions` **only** when it still equals the exact old placeholder string, leaving any business-edited text untouched. Always-overwrite is rejected because it destroys business edits. No migration code is written until a choice is made.
2. **Simulated payment failure trigger (G18, §5.5).** Choose how testers produce `shouldFail: true`: **Option A (recommended)** — an injectable test hook (Angular injection token / `SimulatedPaymentService` port) used by unit tests and Playwright route/interception fixtures, with **no** failure control in the shipped UI; **Option B** — a clearly labelled "Simular fallo de pago (solo entorno de prueba)" panel shown only when `!environment.production`; or **Option C** — a deterministic rule on a fixture value (e.g. a reserved test plan key). Option A keeps the production UI clean; a human must confirm which one `tester-dev` builds against.
3. **Reload after confirmation and quote-number determinism (G19, G23).** Approve **Option A (recommended)**: confirmation and `termsAccepted` are in-memory only, so a reload restores Step 1 + plan and shows a fresh summary with terms unchecked and no quote number (appropriate for a simulated payment, schemaVersion stays `1`); quote numbers are reproducible from the frozen payload + injected clock via FNV-1a. The alternative — persisting a confirmation under a separate sessionStorage key so it survives reload, and/or using a random suffix — requires an explicit decision and possibly an ADR amendment.
4. **Live refresh and masking/display contract (G7–G11, §5.4, §5.6).** Approve: (a) `getCountryConfig()` is called on **every** Step 3 entry/retry so Strapi admin edits to terms, labels, options and `documentMaskVisibleEnd` apply on reload with zero redeploy; (b) masking uses one `•` per hidden character, fully masks at `visibleEnd <= 0`, returns short values verbatim, and always reveals a RUT dash+verifier together; (c) booleans are "Sí"/"No", blank optional rows are omitted, required blanks show "—", dates are localized from ISO, and select values use `option.label`. Any different mask glyph or display convention must be restated here before implementation.

### 7.5 Traceability summary

| Story rule / requirement | Source | Addressed by |
| --- | --- | --- |
| Summary of policyholder, vehicle and chosen plan with final price | US-03 BR / AC1 | G1–G5, §5.1/§5.4, `US03-U01`–`U05`, `US03-E01/E02` |
| Document number partially masked | US-03 BR | G7–G10, §5.4, `US03-U01`–`U03`, `US03-E01/E02` |
| Back to edit data / change plan, preserving state | US-03 BR | G22, §5.3/§5.6, `US03-U14/U15`, `US03-E12/E13` |
| Pay enabled only after accepting terms | US-03 BR / AC2 | G13/G16, §5.3/§6.1, `US03-U06`–`U08`, `US03-E03`–`E06` |
| Terms text from Strapi per country | US-03 BR / AC2 | G11/G12/G15, §3.2/§4.2, `US03-U06/U07`, `US03-E03`–`E05` |
| Payment cannot be submitted twice | US-03 BR / AC3 | G17, §5.3, `US03-U09`, `US03-E10` |
| Confirmation with simulated quote number | US-03 BR / AC3 | G19/G20, §5.4/§5.5, `US03-U10/U12/U13`, `US03-E09` |
| Clear error + retry without losing information | US-03 AC4 | G21, §6.1, `US03-U11`, `US03-E11` |
| No new schema/permissions, read-only Public role | `ADR-001` §4.1, `ADR-002` §4.1 | §3.3/§4.4, `US03-E16` |
| Front-end-only persistence and simulation | `ADR-003` §4.2, `AGENTS.md` §4.1 | §5.3/§5.5, `US03-U14`, `US03-E14/E16` |
| Keyboard-only, semantics, responsive, async states | `AGENTS.md` §4.4 | §6, `US03-E07/E08/E15/E16` |
| Zero-redeploy configurability | `AGENTS.md` §4.2 | G11, §4.2/§5.2, `US03-E05` |

---

### Checkpoint 3 approval block (to be completed by the human project owner)

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Human project owner (Checkpoint 3) | Holguer | ☐ Pending review | — |
| `spec-analyst` (author) |  | Submitted as **Draft** | 2026-11-24 |

**Implementation must not begin until this Draft is approved and the four open questions in §7.4 are answered.**

