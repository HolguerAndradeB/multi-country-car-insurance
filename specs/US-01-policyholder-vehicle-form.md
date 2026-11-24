# Spec US-01 — Policyholder and Vehicle Data Form (Colombia `CO` / Chile `CL`)

**Story ID:** `US-01`

**Status:** Approved (Checkpoint 3 — 2026-11-23)

**Date:** 2026-11-23

**Author:** `spec-analyst`

---

## 1. Traceability & Status

### 1.1 Traceability header

| Item | Value |
| --- | --- |
| User story | [`docs/user-stories/US-01.md`](../docs/user-stories/US-01.md) |
| Spec (this document) | `specs/US-01-policyholder-vehicle-form.md` |
| Accepted ADRs | [`ADR-001` — Multi-country content strategy](../docs/adrs/ADR-001-multi-country-content-strategy.md) (Accepted, Checkpoint 2) · [`ADR-002` — Strapi security & permissions](../docs/adrs/ADR-002-strapi-security-and-permissions.md) (Accepted, Checkpoint 2) · [`ADR-003` — Front-end persistence & SDD workflow](../docs/adrs/ADR-003-frontend-persistence-and-sdd-workflow.md) (Accepted, Checkpoint 2) |
| Governing skills | [`.opencode/skills/strapi-multi-country/SKILL.md`](../.opencode/skills/strapi-multi-country/SKILL.md) §1–§5 · [`.opencode/skills/angular-dynamic-wizard/SKILL.md`](../.opencode/skills/angular-dynamic-wizard/SKILL.md) §1–§5 |
| Global conventions | [`AGENTS.md`](../AGENTS.md) §1, §2, §4.1, §4.2, §4.3, §4.4, §5, §8 |
| Implemented by | `strapi-dev` (`backend/`), `angular-dev` (`frontend/`) |
| Verified by | `tester-dev` (unit + Playwright E2E), `code-reviewer` (`docs/reviews/US-01-review.md`), human Checkpoint 4 |
| Status | **Approved (Checkpoint 3 — 2026-11-23)** |

### 1.2 Scope of this increment

In scope (US-01 only):

- Country-scoped, Strapi-driven **Step 1** form (policyholder + vehicle sections) at `/:country/quote`.
- Dynamic rendering and validation of all five Strapi field types: `text`, `number`, `select`, `date`, `checkbox`.
- Country context via URL, header country switcher, 3-step accessible stepper (Step 1 active; Step 2 placeholder; Step 3 not yet routed).
- Front-end-only draft persistence with revalidation on reload.
- Loading / empty / error states and keyboard-only completion.

Out of scope (owned by later stories, listed here only as boundaries):

| Concern | Owner | US-01 boundary |
| --- | --- | --- |
| Plan catalogue, recommended flag, final sorted list | `US-02` | Only a **placeholder shell** exists at `/:country/quote/plans`; no plan data is fetched or rendered. |
| Simulated price adjustment rule | `US-02` | No pricing logic in US-01; Step 1 only produces and persists raw values. |
| Terms and conditions display/acceptance, document masking, simulated payment, rejection trigger, quote number | `US-03` | US-01 stores the raw values and seeds a `termsAndConditions` **placeholder text** in `country-config` only; nothing is displayed or accepted. |
| Backend persistence of quotes | Never (`AGENTS.md` §4.1) | No `POST`/`PUT`/`DELETE` to Strapi from the browser at any point. |

---

## 2. Gap & Ambiguity Analysis

The user story is intentionally business-level. Each row below is a **gap, edge case, or implicit assumption** found in `US-01` and the decision this spec imposes so that implementation and tests are unambiguous. Every decision is traceable to `AGENTS.md`, an accepted ADR, a skill, or is flagged in §7.4 for Checkpoint 3.

### 2.1 Identity documents, plates and legal-age rules

| # | Gap / edge case | Decision in this spec |
| --- | --- | --- |
| G1 | **US-01 says only "must be of legal age"** — no boundary definition (turning 18 *today*, timezones, leap-year birthdays, future dates). | Legal age = the person has **reached 18 years on or before today's local calendar date** in the browser's timezone. Compare **date-only** triples (`YYYY-MM-DD`), never `Date` timestamps or UTC conversion. Formally: `turns18 = birthDate + 18 years`, and the field is valid iff `turns18 <= today` (calendar comparison). A birth date of **today − 18 years** is **valid**; today − 18 years + 1 day is **invalid**. |
| G2 | **Leap-year birthdays** (born 29 February) have no anniversary in non-leap years. | Deterministic rule: when `birthDate` is **29 Feb** and the target year is not a leap year, the anniversary is evaluated on **28 Feb** of that year (favourable to the user, avoids blocking a legally adult person). Applied identically to the 18-year computation and to the "turns 18 today" boundary. Flagged for confirmation in §7.4 Q2. |
| G3 | **Future / impossible birth dates** are not explicitly rejected. | Any `birthDate > today` is invalid with the Strapi `errorMessage`. Impossible calendar dates (`2026-02-30`) are rejected by the date parser (`date` input) and never reach the validator. A sanity floor `minDate: "1900-01-01"` is seeded to catch typos. |
| G4 | **Vehicle year bounds are relative to "now"** and the story gives no numeric window, integer rule, or year-rollover behaviour. | Rule `vehicleYear`: field valid iff `currentYear - 20 <= year <= currentYear + 1` **and** `Number.isInteger(year)`. `currentYear` is the browser's local calendar year at validation time. **In 2026 the valid range is `2006..2027`.** Bounds are computed by a single exported helper (`vehicleYearBounds(today)`) used by **both** the validator and the rendered `min`/`max` attributes, so they can never disagree. Consequence to accept: a draft saved in Dec 2026 with `2006` becomes invalid in Jan 2027 (`2007..2028`) and is blocked with the Strapi `errorMessage` (G11). |
| G5 | **The seeded `errorMessage` for vehicle year would go stale every January** if it contained literal years. | Seeded copy is **range-agnostic** ("El año del vehículo no está dentro del rango permitido…"). The exact range is communicated in `helpText` only as a relative statement ("últimos 20 años o el próximo año"), so annual rollover requires **no** Strapi edit. |
| G6 | **Colombia documents**: the story names *cédula de ciudadanía* and *cédula de extranjería* but gives no format, and the numeric rule **depends on the selected document type** (a cross-field dependency that a single `pattern` cannot express). | `documentType` is a `select` (`CC`, `CE`). `documentNumber` carries static rules `minLength: 6`, `maxLength: 12`, `pattern: "^[0-9]+$"`, `transform: "trim"` **plus** domain rule `coDocumentNumber`, which re-checks length against the selected type: `CC` → 6–10 digits, `CE` → 6–12 digits. Missing/invalid `documentType` makes `documentNumber` invalid (no silent pass). |
| G7 | **Colombia plate format** is unspecified. | `licensePlate` validations: `pattern: "^[A-Z]{3}[0-9]{3}$"`, `minLength: 6`, `maxLength: 6`, `transform: "uppercase"`. Input is upper-cased and trimmed on blur/paste, so `abc123` passes; `AB1234`, `ABC-123`, `ABC 123` fail. Motorcycle/other plate formats are out of scope (not declared in seed). |
| G8 | **Chilean RUT**: the story says RUT is the document but does not state format, check digit, or whether dots are required. | `documentNumber` (label **RUT**) is validated by domain rule `clRut`: **módulo-11** check digit over the body, check digit `0–9` or `K`/`k`. Input accepts dotted, dashed or bare forms (`12.345.678-9`, `12345678-9`, `12.345.6789`); the value is normalised on blur to canonical `12345678-9` (no dots, uppercase `K`). A wrong check digit is a validation error using the Strapi `errorMessage`. Flagged for confirmation in §7.4 Q3. |
| G9 | **Chilean patente formats** are unspecified ("and other formats" in `ADR-001`). | Exactly two formats are seeded/accepted: `ABCD12` (new) and `AA1234` (older). Pattern `^(?:[A-Z]{4}[0-9]{2}|[A-Z]{2}[0-9]{4})$`, length 6, `transform: "uppercase"`, `rule: "clPlate"`. Motorcycle plates and special plates are out of scope for US-01. |
| G10 | **Select fields have no "unselected" state** in the story. | Every `select` renders a first `<option value="">Selecciona una opción</option>` that is **not disabled** (so assistive technology can announce it) and is always **invalid** when `required` (empty string fails `Validators.required`). `options` coming from Strapi are validated at map time; an option without `value`/`label` is dropped with a dev-console warning rather than crashing. |

### 2.2 Metadata, ordering, reload and country switching

| # | Gap / edge case | Decision in this spec |
| --- | --- | --- |
| G11 | **Reload with a changed catalogue while a `sessionStorage` draft exists** (field added, removed, reordered, validations tightened) — US-01 AC3 normalises reload but says nothing about the draft. | On every load: fetch **fresh** fields → read draft for the active country → **reconcile by `key`**: matching keys keep their value (coerced to the control's expected type), **newly added keys** are initialised with the type's safe default (`''` / `null` / `false`), **removed keys** are retained in memory only until the next save, then **dropped** (the persisted payload only ever contains keys present in the current catalogue). The **entire form is revalidated** after reconciliation; a newly required field is rendered empty and blocks advancing with its `errorMessage` (`ADR-003` §4.3). Order changes never move values because values are keyed by `key`, not by index. |
| G12 | **Country switch semantics** were an open ADR-003 question, resolved at Checkpoint 2. | `CO → CL → CO` preserves each country's draft **independently** under `wizard:state:v1:CO` / `wizard:state:v1:CL`. Switching country is a **navigation** (`ADR-001` §4.2), never a signal write; the target country starts clean **or** restores its own draft. No cross-country hydration is possible (key embeds country + `country` field check in `ADR-003` §4.3). |
| G13 | **US-01 AC4 requires "step 2 → back to step 1", but Step 2 belongs to US-02**, which is not implemented in this increment. | US-01 ships a **Step 2 placeholder shell** at `/:country/quote/plans` (`PlansPlaceholderPage`): stepper with step 2 active, `<h1>`, one explanatory paragraph, a "Volver a mis datos" button returning to `/:country/quote`, and `data-testid="plans-placeholder"`. It performs **no** Strapi call (specifically **not** `/api/insurance-plans`) and renders **no** plan data. AC4 is therefore verifiable **inside US-01** and the placeholder is replaced — not modified — by US-02. Flagged in §7.4 Q1. |
| G14 | **`order` ties** are unspecified; Strapi has no guaranteed secondary sort. | Client-side deterministic sort: `order` ascending, ties broken by `id` ascending (`ADR-001` §4.1). Applied once in `CatalogueApi` mapping; components never re-sort. |
| G15 | **Business editors can produce incoherent layouts** (a `vehicle` field with `order` lower than a `policyholder` field, or interleaved sections). | Rendering contract: iterates fields by `order` asc and opens a new `<fieldset>` **whenever `section` changes** relative to the previous field. Editors must keep each section's `order` values **contiguous** (seeded rows comply: `policyholder` 1–6, `vehicle` 7–9 for `CO`; 1–5 and 6–8 for `CL`). Non-contiguous sections still render correctly but produce repeated headings — a documented editorial rule, not a code path. |
| G16 | **Field `key` governance**: keys are used as form-control names, draft keys and (from US-03) masking targets, yet nothing prevents duplicates or renames. | `key` must match `^[a-zA-Z][a-zA-Z0-9]*$`, be **immutable** once published (renaming orphans drafts), and be **unique per country** (enforced by seed idempotency on `(country, key)` and by a duplicate-detection warning in `CatalogueApi`; duplicates are de-duplicated keeping the lowest `id`). Four **reserved keys** form the cross-story contract: `documentNumber`, `birthDate`, `licensePlate`, `vehicleYear`. US-03 masking and US-02 pricing consume these keys; they must exist in both countries. Flagged in §7.4 Q4. |
| G17 | **`country-config` can be missing or unpublished** for a market; the story assumes it exists. | Step 1 does **not** block on `country-config`: the header/`lang` fall back to the static `COUNTRY_CATALOG` entry (`ADR-001` §4.2) and a non-blocking dev warning is logged. Only US-03 blocks on absent `termsAndConditions`. This keeps US-01 independently testable. |
| G18 | **Chrome copy (headings, buttons, stepper labels) is not Strapi-configured**, yet `AGENTS.md` forbids hardcoded country *field definitions*. | Chrome copy lives in one **shared neutral Spanish** module (`ui-copy.ts`, e.g. "Tus datos", "Datos del vehículo", "Continuar", "Volver") with **no per-country branching**; the document `lang` attribute is driven by the route country (`es-CO` / `es-CL`). All country-specific wording of *fields* comes from Strapi only. |
| G19 | **Required checkboxes** need `Validators.requiredTrue`, but US-01 declares no mandatory consent (legal acceptance belongs to US-03 and must never be pre-seeded or auto-restored, `ADR-003` §4.2). | Seeds include only the **optional** `acceptMarketing` checkbox (covers the `checkbox` type). `requiredTrue` support is implemented and unit-tested against a **synthetic fixture**, not seeded — this prevents fabricating consent and prevents a persisted consent boolean from being auto-restored. |
| G20 | **`pagination[pageSize]=100`** (fixed at Checkpoint 2) can silently truncate a very large catalogue. | If `meta.pagination.total > data.length`, render the received rows and emit a non-blocking dev-console warning; no pagination UI exists in scope. Catalogues of >100 fields are an editorial error, not a supported layout. |
| G21 | **Draft values may have the wrong type** after an editor changes a field from `text` to `number`, or a hand-edited storage blob exists. | Rehydration coerces by target type: `number` → `Number(value)` if finite else `null`; `checkbox` → `value === true`; others → `String(value)` if not `null`. Values that fail coercion become the type default and the field is revalidated (blocking if required). |

### 2.3 Async and environmental states

| # | Gap / edge case | Decision in this spec |
| --- | --- | --- |
| G22 | **Loading** is not in the story, but `AGENTS.md` §4.4 demands explicit async states. | `status: 'loading'` → skeleton form + `aria-busy="true"` + polite live text ("Cargando el formulario…"); Next is not focusable-as-enabled (it is `disabled` only while `loading`). |
| G23 | **Empty catalogue** (0 published fields for the country) is indistinguishable from "loading" or "error" in a naive implementation. | `status: 'empty'` → blocking panel: heading "No hay campos configurados para este país", explanatory text, **Retry** button, link to the other country, and **no** form. Next is never rendered. No draft values are lost. |
| G24 | **Strapi network failure** and retry semantics (draft survival, focus, no white screen). | `status: 'error'` → `role="alert"` panel with "No pudimos cargar el formulario.", the HTTP status in a dev-only detail, and a **Retry** button. `sessionStorage` is **never** cleared by an error. Retry reuses the same `load(country)` path (single-shot, no exponential backoff loop). |
| G25 | **`sessionStorage` may throw** (Safari private mode, storage disabled) — `ADR-003` §4.3 requires graceful degradation. | `WizardPersistenceService` wraps every access in `try/catch` and returns `null`/no-ops on failure; the wizard stays fully functional in memory. No blocking notice is shown (dev-console warning only). |

### 2.4 Assumptions taken as given

1. `docker compose up` serves Strapi on `http://localhost:1337` and Angular on `http://localhost:4200`; `frontend/src/environments/*` contains only `apiBaseUrl` (and optionally `countryDefault`) — **no token, ever** (`ADR-002` §4.4).
2. `/` redirects to `/co/quote` (Checkpoint 2 resolution) and route segments are canonical lowercase `co` / `cl`, case-normalised by the guard.
3. All seed content is **fictitious** (`AGENTS.md` §4.3): names, documents and plates used in tests are obviously synthetic.
4. The browser is the only writer of wizard state; Strapi is the only source of catalogue data and is never cached in storage (`ADR-003` §4.2).
5. `draftAndPublish` is enabled on both content types; unauthenticated `find` returns **published** rows only (`ADR-002` §4.1).

---

## 3. Multi-Country Seed Contract (`CO` & `CL`)

All rows are created by the idempotent bootstrap in `backend/src/index.ts` with `status: 'published'`, using the natural keys below. Running the stack twice must not duplicate or mutate records (`strapi-multi-country` §3).

- **Field natural key:** `(country, key)`.
- **Config natural key:** `country` (unique).
- Localised copy is Spanish: `es-CO` for Colombia, `es-CL` for Chile. All identifiers/keys are English (`AGENTS.md` §5).

### 3.1 `country-config` seed records

| Attribute | `CO` | `CL` |
| --- | --- | --- |
| `country` | `"CO"` | `"CL"` |
| `countryName` | `"Colombia"` | `"Chile"` |
| `currency` | `"COP"` | `"CLP"` |
| `localeCode` | `"es-CO"` | `"es-CL"` |
| `documentMaskVisibleEnd` | `4` | `4` |
| `termsAndConditions` | Placeholder (see below) | Placeholder (see below) |

`termsAndConditions` placeholder copy (**US-03 readiness only — never rendered in US-01**; must be legal-approved before US-03 sign-off):

- **CO:** `"TÉRMINOS Y CONDICIONES — TEXTO DE DEMOSTRACIÓN (PENDIENTE DE APROBACIÓN LEGAL). Esta cotización es simulada y no constituye una póliza de seguros. El texto definitivo para Colombia será configurado por el área legal en Strapi antes de la publicación del paso de resumen."`
- **CL:** `"TÉRMINOS Y CONDICIONES — TEXTO DE DEMOSTRACIÓN (PENDIENTE DE APROBACIÓN LEGAL). Esta cotización es simulada y no constituye una póliza de seguros. El texto definitivo para Chile será configurado por el área legal en Strapi antes de la publicación del paso de resumen."`

Rationale for `documentMaskVisibleEnd: 4`: US-03 masks the document number keeping the last four characters (`angular-dynamic-wizard` §3); storing the value as data keeps the masking rule business-tunable without a front-end change.

### 3.2 `form-field` seed records — Colombia (`CO`)

Orders 1–6 are `policyholder`, 7–9 are `vehicle` (contiguous, per G15).

| `order` | `section` | `key` | `type` | `label` (es-CO) | `required` | `helpText` | `errorMessage` | `validations` | `options` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | policyholder | `documentType` | `select` | Tipo de documento | true | Selecciona el documento con el que te identificas. | Selecciona un tipo de documento válido. | `{}` | `[{"value":"CC","label":"Cédula de ciudadanía"},{"value":"CE","label":"Cédula de extranjería"}]` |
| 2 | policyholder | `documentNumber` | `text` | Número de documento | true | Ingresa solo números, sin puntos ni espacios. | El número de documento no es válido para el tipo seleccionado. | `{"minLength":6,"maxLength":12,"pattern":"^[0-9]+$","rule":"coDocumentNumber","transform":"trim"}` | — |
| 3 | policyholder | `fullName` | `text` | Nombre completo | true | Escríbelo tal como aparece en tu documento. | Ingresa tu nombre completo (mínimo 3 caracteres). | `{"minLength":3,"maxLength":80,"pattern":"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' ]+$","transform":"trim"}` | — |
| 4 | policyholder | `birthDate` | `date` | Fecha de nacimiento | true | Debes ser mayor de 18 años para cotizar. | Debes ser mayor de 18 años para continuar. | `{"rule":"legalAge","minDate":"1900-01-01"}` | — |
| 5 | policyholder | `city` | `select` | Ciudad de residencia | true | Selecciona la ciudad donde resides. | Selecciona una ciudad válida. | `{}` | `[{"value":"BOG","label":"Bogotá D.C."},{"value":"MDE","label":"Medellín"},{"value":"CLO","label":"Cali"},{"value":"BAQ","label":"Barranquilla"},{"value":"BGA","label":"Bucaramanga"}]` |
| 6 | policyholder | `acceptMarketing` | `checkbox` | Acepto recibir información comercial | false | Puedes cambiar esta preferencia más adelante. | — (optional field: no error message) | `{}` | — |
| 7 | vehicle | `licensePlate` | `text` | Placa del vehículo | true | Formato ABC123, sin espacios ni guiones. | La placa debe tener el formato ABC123. | `{"minLength":6,"maxLength":6,"pattern":"^[A-Z]{3}[0-9]{3}$","rule":"coPlate","transform":"uppercase"}` | — |
| 8 | vehicle | `vehicleMake` | `select` | Marca del vehículo | true | Selecciona la marca de tu vehículo. | Selecciona una marca válida. | `{}` | `[{"value":"RENAULT","label":"Renault"},{"value":"CHEVROLET","label":"Chevrolet"},{"value":"MAZDA","label":"Mazda"},{"value":"TOYOTA","label":"Toyota"},{"value":"KIA","label":"Kia"},{"value":"NISSAN","label":"Nissan"},{"value":"OTHER","label":"Otra marca"}]` |
| 9 | vehicle | `vehicleYear` | `number` | Año del vehículo | true | Aceptamos vehículos de los últimos 20 años o del próximo año. | El año del vehículo no está dentro del rango permitido (últimos 20 años o el próximo año). | `{"rule":"vehicleYear","integer":true}` | — |

### 3.3 `form-field` seed records — Chile (`CL`)

Orders 1–5 are `policyholder`, 6–8 are `vehicle` (contiguous, per G15). `documentNumber` carries the **RUT** semantics; there is no `documentType` field in Chile, demonstrating a genuinely different per-country field set (US-01 AC1).

| `order` | `section` | `key` | `type` | `label` (es-CL) | `required` | `helpText` | `errorMessage` | `validations` | `options` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | policyholder | `documentNumber` | `text` | RUT | true | Ingresa tu RUT con o sin puntos y guion. Ejemplo: 12.345.678-5. | El RUT ingresado no es válido. | `{"minLength":8,"maxLength":12,"pattern":"^[0-9kK.\\-]+$","rule":"clRut","transform":"trim"}` | — |
| 2 | policyholder | `fullName` | `text` | Nombre completo | true | Escríbelo tal como aparece en tu documento. | Ingresa tu nombre completo (mínimo 3 caracteres). | `{"minLength":3,"maxLength":80,"pattern":"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' ]+$","transform":"trim"}` | — |
| 3 | policyholder | `birthDate` | `date` | Fecha de nacimiento | true | Debes ser mayor de 18 años para cotizar. | Debes ser mayor de 18 años para continuar. | `{"rule":"legalAge","minDate":"1900-01-01"}` | — |
| 4 | policyholder | `city` | `select` | Ciudad de residencia | true | Selecciona la ciudad donde resides. | Selecciona una ciudad válida. | `{}` | `[{"value":"SCL","label":"Santiago"},{"value":"VAP","label":"Valparaíso"},{"value":"CCP","label":"Concepción"},{"value":"ANT","label":"Antofagasta"},{"value":"LSC","label":"La Serena"}]` |
| 5 | policyholder | `acceptMarketing` | `checkbox` | Acepto recibir información comercial | false | Puedes cambiar esta preferencia más adelante. | — (optional field: no error message) | `{}` | — |
| 6 | vehicle | `licensePlate` | `text` | Patente del vehículo | true | Formatos aceptados: ABCD12 o AA1234, sin espacios ni guiones. | La patente debe tener el formato ABCD12 o AA1234. | `{"minLength":6,"maxLength":6,"pattern":"^(?:[A-Z]{4}[0-9]{2}|[A-Z]{2}[0-9]{4})$","rule":"clPlate","transform":"uppercase"}` | — |
| 7 | vehicle | `vehicleMake` | `select` | Marca del vehículo | true | Selecciona la marca de tu vehículo. | Selecciona una marca válida. | `{}` | `[{"value":"TOYOTA","label":"Toyota"},{"value":"CHEVROLET","label":"Chevrolet"},{"value":"NISSAN","label":"Nissan"},{"value":"HYUNDAI","label":"Hyundai"},{"value":"KIA","label":"Kia"},{"value":"PEUGEOT","label":"Peugeot"},{"value":"OTHER","label":"Otra marca"}]` |
| 8 | vehicle | `vehicleYear` | `number` | Año del vehículo | true | Aceptamos vehículos de los últimos 20 años o del próximo año. | El año del vehículo no está dentro del rango permitido (últimos 20 años o el próximo año). | `{"rule":"vehicleYear","integer":true}` | — |

### 3.4 Coverage and invariants of the seed

| Invariant | `CO` | `CL` |
| --- | --- | --- |
| Total published fields | 9 | 8 |
| `text` fields | `documentNumber`, `fullName`, `licensePlate` | `documentNumber`, `fullName`, `licensePlate` |
| `number` fields | `vehicleYear` | `vehicleYear` |
| `select` fields | `documentType`, `city`, `vehicleMake` | `city`, `vehicleMake` |
| `date` fields | `birthDate` | `birthDate` |
| `checkbox` fields | `acceptMarketing` | `acceptMarketing` |
| Country-exclusive field (AC1 proof) | `documentType` (absent in `CL`) | none (asymmetry is expected; `CO`-only row is the assertion target) |
| Reserved cross-story keys present | `documentNumber`, `birthDate`, `licensePlate`, `vehicleYear` | same four |
| All five `type` values exercised | yes | yes |

Seeding rules (`strapi-multi-country` §3): upsert-by-natural-key, never delete business-edited rows, `status: 'published'`, 100 % fictitious data, and no writes outside `bootstrap`.

---

## 4. Strapi 5 Content Model & REST API Contract

### 4.1 `form-field` content type (`api::form-field.form-field`)

| Attribute | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `key` | `string` | required, `^[a-zA-Z][a-zA-Z0-9]*$` | Stable technical identifier; immutable per G16. Unique per `(country, key)`. |
| `label` | `string` | required, max 120 | Localised user-facing label. |
| `type` | `enumeration` | required; `text \| number \| select \| date \| checkbox` | Drives control rendering (`@switch`). |
| `required` | `boolean` | default `false` | `checkbox` → `Validators.requiredTrue`. |
| `validations` | `json` | optional, default `{}` | Typed shape in §5.2; unknown keys ignored with a dev warning. |
| `options` | `json` | optional, default `[]` | `[{ "value": string, "label": string }]`; mandatory for `type: select`. |
| `helpText` | `string` | optional, max 240 | Rendered and referenced by `aria-describedby`. |
| `errorMessage` | `string` | optional, max 240 | Business-configured validation copy; fallback defined in §5.4. |
| `order` | `integer` | required, `>= 1` | Only sort key; ties broken client-side by `id` asc. |
| `country` | `enumeration` | required; `CO \| CL` | Country scoping dimension (`ADR-001` Q1-A). |
| `section` | `enumeration` | required; `policyholder \| vehicle`, default `policyholder` | Grouping; contiguity rule G15. Made **required** (ADR-001 listed it as optional) so no row is ungrouped. |

Options: `draftAndPublish: true`; no relations, no media, no i18n, no components.

### 4.2 `country-config` content type (`api::country-config.country-config`)

| Attribute | Type | Constraints |
| --- | --- | --- |
| `country` | `enumeration` (`CO \| CL`) | **required, unique** (one config per market) |
| `countryName` | `string` | required |
| `currency` | `enumeration` (`COP \| CLP`) | required |
| `localeCode` | `string` | required, matches `es-CO` / `es-CL` (`locale` is reserved by Strapi 5) |
| `termsAndConditions` | `text` (long text) | required (US-03 consumes it verbatim) |
| `documentMaskVisibleEnd` | `integer` | default `4`, `>= 0` |

Options: `draftAndPublish: true`; single record per country enforced by `unique`.

### 4.3 Canonical query URLs (exact strings)

```http
GET {apiBaseUrl}/api/form-fields?filters[country][$eq]=CO&sort=order:asc&pagination[pageSize]=100
GET {apiBaseUrl}/api/form-fields?filters[country][$eq]=CL&sort=order:asc&pagination[pageSize]=100
GET {apiBaseUrl}/api/country-configs?filters[country][$eq]=CO
GET {apiBaseUrl}/api/country-configs?filters[country][$eq]=CL
```

Rules:

- `CatalogueApi` is the **only** code that builds these URLs (`ADR-001` §4.4 C5). No `'/api/'` literal in components.
- Exactly **one** `filters[country][$eq]` per request; there is no code path that issues a catalogue request without it (`ADR-001` C2).
- No `populate` (no relations), no `locale`, no `status` parameter (the Public role returns published rows only).
- All requests are unauthenticated `GET` with **no `Authorization` header** and no cookies (`ADR-002` §4.1, §4.3).
- `pagination[pageSize]=100` fixed at Checkpoint 2 (G20).

### 4.4 Flattened Strapi 5 response shapes (no `.attributes`)

`GET /api/form-fields?filters[country][$eq]=CO&sort=order:asc&pagination[pageSize]=100` → `200`:

```json
{
  "data": [
    {
      "id": 1,
      "documentId": "ffco0000000000000000001",
      "key": "documentType",
      "label": "Tipo de documento",
      "type": "select",
      "required": true,
      "validations": {},
      "options": [
        { "value": "CC", "label": "Cédula de ciudadanía" },
        { "value": "CE", "label": "Cédula de extranjería" }
      ],
      "helpText": "Selecciona el documento con el que te identificas.",
      "errorMessage": "Selecciona un tipo de documento válido.",
      "order": 1,
      "country": "CO",
      "section": "policyholder",
      "createdAt": "2026-11-23T10:00:00.000Z",
      "updatedAt": "2026-11-23T10:00:00.000Z",
      "publishedAt": "2026-11-23T10:00:00.000Z"
    },
    {
      "id": 7,
      "documentId": "ffco0000000000000000007",
      "key": "licensePlate",
      "label": "Placa del vehículo",
      "type": "text",
      "required": true,
      "validations": {
        "minLength": 6,
        "maxLength": 6,
        "pattern": "^[A-Z]{3}[0-9]{3}$",
        "rule": "coPlate",
        "transform": "uppercase"
      },
      "options": [],
      "helpText": "Formato ABC123, sin espacios ni guiones.",
      "errorMessage": "La placa debe tener el formato ABC123.",
      "order": 7,
      "country": "CO",
      "section": "vehicle",
      "createdAt": "2026-11-23T10:00:00.000Z",
      "updatedAt": "2026-11-23T10:00:00.000Z",
      "publishedAt": "2026-11-23T10:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": { "page": 1, "pageSize": 100, "pageCount": 1, "total": 9 }
  }
}
```

`GET /api/country-configs?filters[country][$eq]=CL` → `200`:

```json
{
  "data": [
    {
      "id": 2,
      "documentId": "cfgcl000000000000000002",
      "country": "CL",
      "countryName": "Chile",
      "currency": "CLP",
      "localeCode": "es-CL",
      "termsAndConditions": "TÉRMINOS Y CONDICIONES — TEXTO DE DEMOSTRACIÓN (PENDIENTE DE APROBACIÓN LEGAL)…",
      "documentMaskVisibleEnd": 4,
      "createdAt": "2026-11-23T10:00:00.000Z",
      "updatedAt": "2026-11-23T10:00:00.000Z",
      "publishedAt": "2026-11-23T10:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": { "page": 1, "pageSize": 25, "pageCount": 1, "total": 1 }
  }
}
```

Empty catalogue (country with no published fields) → `200`:

```json
{
  "data": [],
  "meta": { "pagination": { "page": 1, "pageSize": 100, "pageCount": 0, "total": 0 } }
}
```

Error shapes the client must tolerate: `400` (malformed query), `403`/`401` (permission regression — treated as `error` state, never silently empty), `404` (path typo), `500`/network failure (offline, container booting). The client maps **any** non-`2xx` and any thrown `HttpErrorResponse` to `status: 'error'` with the retry affordance (G24).

### 4.5 Public role permission contract (ADR-002)

Configured programmatically in `bootstrap`; the allowlist is exhaustive and everything else is revoked.

| Content type | `find` | `findOne` | `create` | `update` | `delete` |
| --- | --- | --- | --- | --- | --- |
| `api::form-field.form-field` | ALLOWED | ALLOWED | DENIED | DENIED | DENIED |
| `api::country-config.country-config` | ALLOWED | ALLOWED | DENIED | DENIED | DENIED |
| `api::insurance-plan.insurance-plan` | ALLOWED | ALLOWED | DENIED | DENIED | DENIED (US-02) |
| Any other `api::*`, `plugin::users-permissions.*`, `plugin::upload.*`, `plugin::i18n.*` | DENIED | DENIED | DENIED | DENIED | DENIED |

US-01 asserts (safe subset, since it must not depend on US-02): `GET` on `form-fields` and `country-configs` returns `200`; `POST /api/form-fields`, `PUT /api/form-fields/:id`, `DELETE /api/form-fields/:id` return `401`/`403`; no API token exists in the bundle; no `Authorization` header is sent by the app.

---

## 5. Angular 21 Architecture & Typed Contracts

### 5.1 Typed data contracts (`frontend/src/app/core/models/`)

```ts
export type CountryCode = 'CO' | 'CL';
export type CountryRouteSegment = 'co' | 'cl';
export type CurrencyCode = 'COP' | 'CLP';
export type AppLocale = 'es-CO' | 'es-CL';

export type FormFieldType = 'text' | 'number' | 'select' | 'date' | 'checkbox';
export type FormFieldSection = 'policyholder' | 'vehicle';

export type DomainValidationRule =
  | 'legalAge'
  | 'vehicleYear'
  | 'clRut'
  | 'coDocumentNumber'
  | 'coPlate'
  | 'clPlate';

export interface FormFieldOption {
  readonly value: string;
  readonly label: string;
}

/** Typed mirror of the Strapi `validations` JSON blob (unknown keys ignored). */
export interface FormFieldValidationRules {
  readonly minLength?: number;
  readonly maxLength?: number;
  /** Numeric lower bound for `type: 'number'`. Ignored when `rule: 'vehicleYear'`. */
  readonly min?: number;
  /** Numeric upper bound for `type: 'number'`. Ignored when `rule: 'vehicleYear'`. */
  readonly max?: number;
  /** ISO `YYYY-MM-DD` lower bound for `type: 'date'`. */
  readonly minDate?: string;
  /** ISO `YYYY-MM-DD` upper bound for `type: 'date'`. */
  readonly maxDate?: string;
  readonly pattern?: string;
  readonly integer?: boolean;
  readonly transform?: 'uppercase' | 'trim';
  readonly rule?: DomainValidationRule;
}

/** Domain model used by the UI — never the raw Strapi payload. */
export interface FormFieldConfig {
  readonly id: number;
  readonly documentId: string;
  readonly key: string;
  readonly label: string;
  readonly type: FormFieldType;
  readonly required: boolean;
  readonly validations: FormFieldValidationRules;
  readonly options: readonly FormFieldOption[];
  readonly helpText: string | null;
  readonly errorMessage: string | null;
  readonly order: number;
  readonly country: CountryCode;
  readonly section: FormFieldSection;
}

export interface CountryConfig {
  readonly id: number;
  readonly documentId: string;
  readonly country: CountryCode;
  readonly countryName: string;
  readonly currency: CurrencyCode;
  readonly localeCode: AppLocale;
  readonly termsAndConditions: string;
  readonly documentMaskVisibleEnd: number;
}
```

Raw Strapi shapes (defensive, since `json` columns can be `null`):

```ts
export interface StrapiPagination {
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
  readonly total: number;
}

export interface StrapiListResponse<T> {
  readonly data: readonly T[];
  readonly meta?: { readonly pagination?: StrapiPagination };
}

export interface FormFieldDto {
  readonly id: number;
  readonly documentId: string;
  readonly key: string;
  readonly label: string;
  readonly type: FormFieldType;
  readonly required: boolean;
  readonly validations: FormFieldValidationRules | null;
  readonly options: readonly FormFieldOption[] | null;
  readonly helpText: string | null;
  readonly errorMessage: string | null;
  readonly order: number;
  readonly country: CountryCode;
  readonly section: FormFieldSection;
  readonly publishedAt: string | null;
}

export interface CountryConfigDto {
  readonly id: number;
  readonly documentId: string;
  readonly country: CountryCode;
  readonly countryName: string;
  readonly currency: CurrencyCode;
  readonly localeCode: string;
  readonly termsAndConditions: string;
  readonly documentMaskVisibleEnd: number | null;
}
```

Value and state contracts:

```ts
/** Form control value union — persisted shape from ADR-003 §4.2. */
export type FormValue = string | number | boolean | null;

export interface PersistedWizardStateV1 {
  readonly schemaVersion: 1;
  readonly country: CountryCode;
  /** ISO-8601 instant of the last write; basis for the 2 h idle TTL. */
  readonly savedAt: string;
  readonly step: WizardStep;
  /** Raw Step 1 values keyed by Strapi `form-field.key`; revalidated on rehydration. */
  readonly step1: Readonly<Record<string, FormValue>>;
  /** Strapi 5 documentId of the chosen plan, or null (US-02 writes this). */
  readonly selectedPlanDocumentId: string | null;
}

export type WizardStep = 'policyholder' | 'plans' | 'summary';

export interface WizardPersistence {
  load(country: CountryCode): PersistedWizardStateV1 | null;
  save(state: PersistedWizardStateV1): void;
  clear(country: CountryCode): void;
}

export type CatalogueStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';
```

Storage key: `wizard:state:v1:<CO|CL>`; TTL **2 h** from `savedAt` (Checkpoint 2 resolution); mismatch on `schemaVersion`, `country`, or TTL → discard silently (dev log only), per `ADR-003` §4.3–§4.4.

### 5.2 Services and store

```ts
// core/country/country-context.service.ts
@Injectable({ providedIn: 'root' })
export class CountryContextService {
  private readonly route = inject(ActivatedRoute);
  private readonly countryParam = toSignal(this.route.paramMap.pipe(map((p) => p.get('country'))));

  readonly country = computed<CountryCode>(() => toCountryCode(this.countryParam()));
  readonly entry = computed<CountryCatalogEntry>(() => COUNTRY_CATALOG_BY_CODE[this.country()]);
  readonly locale = computed<AppLocale>(() => this.entry().locale);
  readonly currency = computed<CurrencyCode>(() => this.entry().currency);
  /** Only place internal links are built (`ADR-001` §4.2). */
  quotePath(step: 'quote' | 'plans' = 'quote'): string { /* `/co/quote[/plans]` */ }
}
```

`COUNTRY_CATALOG` is exactly as defined in `ADR-001` §4.2 (`code`, `routeSegment`, `locale`, `currency`, `displayName`) and contains **no** field, plan, price, or legal data.

```ts
// core/catalogue/catalogue.api.ts — the ONLY place that builds Strapi URLs
@Injectable({ providedIn: 'root' })
export class CatalogueApi {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getFormFields(country: CountryCode): Observable<readonly FormFieldConfig[]>;   // sort order asc, id asc; de-dup by key
  getCountryConfig(country: CountryCode): Observable<CountryConfig | null>;      // data[0] ?? null
}
```

Behavioural contract for `getFormFields`:

1. Exactly one `filters[country][$eq]=<CO|CL>`; `sort=order:asc`; `pagination[pageSize]=100`.
2. Maps `FormFieldDto` → `FormFieldConfig` (drops invalid `options` entries, defaults `validations` to `{}`), then sorts `order` asc with `id` asc tie-break.
3. Emits `[]` for an empty `data` array; **throws** `HttpErrorResponse` for non-`2xx` (the store converts it to `status: 'error'`, never `'empty'`).

```ts
// core/persistence/wizard-persistence.service.ts
@Injectable({ providedIn: 'root' })
export class WizardPersistenceService implements WizardPersistence {
  load(country: CountryCode): PersistedWizardStateV1 | null; // TTL + version + country guards, try/catch
  save(state: PersistedWizardStateV1): void;                  // try/catch, quota-safe
  clear(country: CountryCode): void;                          // try/catch
}
```

Storage access goes through an injectable `StoragePort` (`getItem`/`setItem`/`removeItem`) so unit tests can inject a fake that throws (G25).

```ts
// core/wizard/wizard.store.ts
export type WizardFormGroup = FormGroup<Record<string, FormControl<FormValue>>>;

@Injectable({ providedIn: 'root' })
export class WizardStore {
  private readonly country = inject(CountryContextService);
  private readonly catalogue = inject(CatalogueApi);
  private readonly persistence = inject(WizardPersistenceService);
  private readonly factory = inject(DynamicFormFactory);

  readonly fields = computed<readonly FormFieldConfig[]>(...);
  readonly countryConfig = signal<CountryConfig | null>(null).asReadonly();
  readonly status = signal<CatalogueStatus>('idle').asReadonly();
  readonly errorMessage = signal<string | null>(null).asReadonly();
  readonly form = signal<WizardFormGroup | null>(null).asReadonly();
  readonly isReady = computed(() => this.status() === 'ready' && this.form() !== null);
  readonly errorCount = computed(() => /* count invalid controls when submitted */ 0);

  async load(country: CountryCode): Promise<void>;   // fields + config, reconcile draft, build form, revalidate
  async retry(): Promise<void>;                      // same path as load(country)
  persist(step: WizardStep): void;                   // step1 snapshot + savedAt
  patchValues(values: Readonly<Record<string, FormValue>>): void;
  reset(country: CountryCode): void;                 // clears key + memory (ADR-003 §4.4)
}
```

`load()` sequence (single source of truth for the reconciliation rules in G11/G21):

1. `status = 'loading'`; parallel `getFormFields` + `getCountryConfig`.
2. On error → `status = 'error'`, keep any previous state, **do not touch storage**.
3. `fields.length === 0` → `status = 'empty'`, no form.
4. Read draft via `persistence.load(country)`; discard if `null`.
5. Reconcile: keep matching `key` values (coerced), default new keys, ignore removed keys; remember removed keys so the **next save** drops them.
6. `form = factory.createForm(fields, reconciledValues)`; run `markAllAsTouched()` only if the draft was restored **and** contained values (so restored invalid values are immediately visible), then revalidate.
7. `status = 'ready'`; subscribe to `form.valueChanges` → debounce 400 ms → `persist('policyholder')`.

```ts
// features/quote/dynamic-form.factory.ts
@Injectable({ providedIn: 'root' })
export class DynamicFormFactory {
  createForm(fields: readonly FormFieldConfig[], initial: Readonly<Record<string, FormValue>>): WizardFormGroup;
  createControl(field: FormFieldConfig, initial: FormValue): FormControl<FormValue>;
  defaultValue(field: FormFieldConfig): FormValue;      // '' | null | false
  /** Re-applies validators when the catalogue changed (AC3 reload path). */
  revalidate(form: WizardFormGroup, fields: readonly FormFieldConfig[]): void;
}
```

Validator mapping (exactly one implementation, unit-tested once):

| `validations` / `type` | Control validators |
| --- | --- |
| `required: true`, `type !== 'checkbox'` | `Validators.required` |
| `required: true`, `type === 'checkbox'` | `Validators.requiredTrue` |
| `minLength` / `maxLength` | `Validators.minLength` / `Validators.maxLength` |
| `min` / `max` (numeric, and **not** `rule: 'vehicleYear'`) | `Validators.min` / `Validators.max` |
| `pattern` | `Validators.pattern` |
| `rule: 'legalAge'` | `legalAgeValidator(today)` (+ `minDate`/`maxDate` date bounds) |
| `rule: 'vehicleYear'` | `vehicleYearValidator(today)` using `vehicleYearBounds(today)`; integer check |
| `rule: 'clRut'` | `clRutValidator` (módulo-11) + normalisation on blur |
| `rule: 'coDocumentNumber'` | group-level validator reading sibling `documentType` |
| `rule: 'coPlate'` / `'clPlate'` | `Validators.pattern` + uppercase transform |

Domain helpers (pure, no Angular imports, so they are trivially unit-testable):

```ts
export function vehicleYearBounds(today: Date): { readonly min: number; readonly max: number };
export function isLegalAge(birthDateIso: string, today: Date): boolean;  // G1/G2 rules
export function isValidClRut(value: string): boolean;                    // módulo-11, accepts dots/dash
export function normalizeClRut(value: string): string;                   // '12345678-9'
export function isValidCoDocument(documentType: string, value: string): boolean;
export function normalizePlate(value: string): string;                   // trim + uppercase
```

### 5.3 Components, routing and layout

All components: standalone, `ChangeDetectionStrategy.OnPush`, `inject()`, signal `input()`/`output()`, `@if` / `@for (… ; track …)` / `@switch`, zero `NgModule`, zero `any`.

| Component | Responsibility |
| --- | --- |
| `AppShellComponent` (root) | `<header>` + `<main>` + `<router-outlet>`; sets `[attr.lang]` from `CountryContextService.locale()`. |
| `CountrySwitcherComponent` | Labelled `<select id="country-switcher">` ("País") with `CO`/`CL` options; on change navigates to the sibling route (`quote` or `plans`), preserving the current step; no state write. |
| `WizardStepperComponent` | 3-step `<nav aria-label="Pasos del cotizador"><ol>`; items "Tus datos", "Planes", "Resumen"; active item `aria-current="step"`; **non-interactive** in US-01 (plain `<li>`, no links to unimplemented steps). |
| `QuoteStep1PageComponent` | Step 1 page: loads catalogue via `WizardStore.load(country())`, renders sections from `@for`, owns submit/back behaviour and focus management. |
| `DynamicFieldComponent` | One field: `<label [for]="inputId">`, `@switch (field().type)` → input/select/checkbox, `aria-invalid`, `aria-describedby`, error paragraph. |
| `StatePanelComponent` | Shared `loading` / `empty` / `error` presentation with optional retry `output()`. |
| `PlansPlaceholderPageComponent` | Step 2 placeholder shell (G13), no Strapi call. |
| `NotFoundPageComponent` | `**` route; link back to `/co/quote`. |

Routing table (`app.routes.ts`, all lazy `loadComponent`):

| Path | Behaviour |
| --- | --- |
| `''` | `redirectTo: 'co/quote'`, `pathMatch: 'full'` |
| `':country/quote'` | `canActivate: [countryRouteGuard]` → `QuoteStep1PageComponent` |
| `':country/quote/plans'` | `canActivate: [countryRouteGuard, step1CompleteGuard]` → `PlansPlaceholderPageComponent` |
| `'**'` | `NotFoundPageComponent` |

- `countryRouteGuard`: lower-cases the segment, maps `co → CO`, `cl → CL`; unknown → redirect to `/co/quote` (never a blank catalogue, `ADR-001` C4).
- `step1CompleteGuard` (US-01-only, for the placeholder): if the store has no valid Step 1 state for the route country → redirect to `/:country/quote`. Deep-linking directly to `/cl/quote/plans` with a clean session therefore lands on Step 1.
- Step 3 (`summary`) is **not registered** until US-03; a direct hit is handled by `**`.
- `QuoteStep1PageComponent` passes the route country into `WizardStore.load()` (no component-local `country` copy; `ADR-001` §3.2 con).

```
QuoteStep1Page ──reads──▶ WizardStore(fields, status, form)
      │                        │
      │                        ├──▶ CatalogueApi ──GET──▶ Strapi (country-filtered)
      │                        └──▶ WizardPersistenceService ──▶ sessionStorage wizard:state:v1:CO|CL
      └──renders──▶ DynamicField[] (per field.type, ordered by order asc, id asc)
```

Field rendering contract:

- Iterate `WizardStore.fields()` (already sorted). A new `<fieldset>` with `<legend>` opens whenever `section()` changes (G15).
- Control `id` = `field.key`; help id = `help-<key>`; error id = `err-<key>`.
- `select`: `@for (option of field().options; track option.value)` with the leading `value=""` "Selecciona una opción".
- `checkbox`: single `<input type="checkbox">` with the label as text, `aria-describedby` to help only.
- `date`: `<input type="date">` with `min`/`max` from validations, ISO value, `autocomplete="bday"`.
- `number`: `<input type="number" step="1" inputmode="numeric">` with `min`/`max` from `vehicleYearBounds(today)` when `rule: 'vehicleYear'`.
- `text`: `autocomplete` per key (`fullName` → `name`, `documentNumber`/`licensePlate` → `off`), `spellcheck="false"`, `transform` applied on blur.
- `<form novalidate>` — Angular validators are the only validation authority; native browser bubbles are suppressed so the Strapi `errorMessage` is what the user sees.
- Submit button label "Continuar" (`type="submit"`), secondary "Volver" only when arriving from Step 2 (the placeholder owns the back link in US-01).

### 5.4 Error-message resolution

`field.errorMessage` from Strapi is used verbatim for every validation failure of that field. When it is `null`/empty (only allowed for optional fields), the UI falls back to neutral Spanish copy from `ui-copy.ts` ("Revisa este campo."). No error text is ever composed from validator names (`required`, `pattern`, …) in English.

Timezone policy: all date comparisons use the browser's local calendar date derived from `new Date()` **at validation time**; no UTC conversion, no server time (`G1`).

---

## 6. UI States, Accessibility & Responsiveness

### 6.1 Explicit async and validation states

| State | Trigger | Rendering | Accessibility |
| --- | --- | --- | --- |
| `loading` | `load()` / `retry()` in flight | Form-area skeleton, 3 placeholder rows; stepper visible; no inputs | `<section aria-busy="true">` + visually hidden polite live text "Cargando el formulario…"; Next not rendered |
| `empty` | `status === 'empty'` (0 published fields) | Panel: `<h1>` "No hay campos configurados para este país", explanation, **Reintentar** button, link to the other country | `role="status"` on the panel; heading receives focus on transition |
| `error` | non-`2xx` / network failure | Panel: "No pudimos cargar el formulario." + **Reintentar** button | `role="alert"`; heading receives focus; retry reachable by `Tab` and activatable by `Enter`/`Space` |
| `ready` | catalogue loaded | `<form novalidate>` with both fieldsets, stepper, Continuar | see §6.2 |
| `invalid-submit` | submit with `form.invalid` | All touched/valid errors shown; no navigation | `role="alert"` per error, focus moves to first invalid control, live summary "Revisa los campos marcados: N errores." |
| `restored-draft` | draft rehydrated | Values pre-filled; invalid restored values flagged immediately | Polite live text "Recuperamos tus datos guardados." |
| `storage-unavailable` | `StoragePort` throws | No visual state; wizard works in memory | none (dev log only) |

### 6.2 Accessibility contract (per control and per page)

- Every control has `<label [for]="field.key">`; checkbox labels wrap their input **and** are associated by `for`/`id`.
- `[attr.aria-invalid]="isInvalid(field.key)"` (`true` only when invalid **and** touched/submitted, `false` otherwise — never `null`-vs-`false` ambiguity).
- `[attr.aria-describedby]` = `help-<key>` and, when an error is visible, `help-<key> err-<key>`.
- Error text renders in `<p [id]="'err-' + field.key" role="alert">` (announced on appearance, not duplicated on every keystroke: the message is rendered once per invalid state change).
- `aria-required="true"` on required controls; `required` attribute omitted in the DOM where it would trigger native bubbles (`novalidate` on the form is the guarantee).
- `<fieldset>` + `<legend>` "Tus datos" / "Datos del vehículo" for the two sections.
- Inputs use default font-size ≥ `16px` (prevents iOS zoom) and a visible `:focus-visible` outline (`2px` solid, ≥ `3:1` contrast against background) that is never removed by `outline: none` without a replacement.
- Stepper: `<ol>` semantics, active item `aria-current="step"`, step numbers exposed as text ("Paso 1 de 3") for screen readers.
- Page heading `<h1 tabindex="-1">` receives programmatic focus on route entry (forward to placeholder, back to Step 1, and after country switch) so screen-reader users are told where they are.
- Tab order follows DOM order: country switcher → step 1 fields (in catalogue order) → Continuar. No `tabindex > 0` anywhere.

### 6.3 Keyboard-only completion (`AGENTS.md` §4.4)

| Action | Keys |
| --- | --- |
| Move between controls | `Tab` / `Shift+Tab` |
| Choose a native `select` option | `Arrow Up/Down`, `Home`/`End`, `Enter` (`Alt+Down` on Windows) |
| Toggle checkbox | `Space` |
| Edit date/number | typed digits, `Arrow` increments, `Tab` to next |
| Submit Step 1 | `Enter` in a text input or `Space`/`Enter` on Continuar |
| Submit with errors | errors announced, focus lands on first invalid field |
| Country switch without mouse | `Tab` to the switcher, `Arrow` to the target, `Enter` (navigation, no modifier keys) |
| Back from placeholder | `Tab` to "Volver a mis datos", `Enter` |

No action in US-01 requires a pointer device, and no control is a clickable `<div>`.

### 6.4 Responsiveness

| Viewport | Layout |
| --- | --- |
| `375px` | Single column, `16px` page padding; stepper items compressed (number + short label, wrapping to two lines); inputs full width (min height `44px`); no horizontal scroll (`document.scrollWidth === clientWidth`); Continuar full-width sticky-safe (not overlaying the last field). |
| `768px+` | Two-column CSS grid **within each fieldset** (`grid-template-columns: repeat(2, minmax(0, 1fr))`), checkbox rows spanning both columns; container max-width `880px`. |
| `1280px+` | Same grid, container max-width `1040px`, centred; stepper horizontal with labels; field labels never truncated (no `text-overflow: ellipsis`). |

Touch targets ≥ `44×44 px`; colour/contrast meets WCAG 2.1 AA for text (`4.5:1`) and UI boundaries (`3:1`); the country switcher and Continuar remain visible and operable at all three breakpoints.

---

## 7. Verifiable Acceptance Matrix & Open Questions for Checkpoint 3

### 7.1 Acceptance matrix — the four US-01 Gherkin scenarios

Owners: `tester-dev` writes all tests; `angular-dev` / `strapi-dev` make them pass. IDs are referenced in `docs/reviews/US-01-review.md`.

| US-01 AC | Gherkin (abridged) | Unit tests | E2E (Playwright) | Manual / Checkpoint 4 |
| --- | --- | --- | --- | --- |
| **AC1** — Form configured by country | `Given fields are configured in Strapi for Colombia and for Chile / When I open the application in the context of a country / Then I see only the fields configured for that country, in the defined order` | `US01-U09` `CatalogueApi` sends exactly one `filters[country][$eq]`, never a request without it, maps flattened DTOs (no `.attributes`), sorts `order` asc then `id` asc. `US01-U14` `CountryContextService` derives `CO`/`CL` from the route param (`co`/`cl`/`CO` normalisation). `US01-U18` duplicate `key` de-duplication and invalid `options` dropping. | `US01-E01` `/co/quote`: all 9 CO labels render in `order` sequence and **no** `RUT`/`Patente` label appears. `US01-E02` `/cl/quote`: `RUT` + `Patente del vehículo` render, `Tipo de documento` absent, all 8 labels in order. `US01-E03` `/xx/quote` → redirect to `/co/quote`, no empty catalogue. | Read the rendered labels against the seeded tables in §3.2/§3.3. |
| **AC2** — Field validation | `Given I am filling out the form / When a field does not meet its configured validation / Then I see the configured error message next to the field / And I cannot move to the next step` | `US01-U02` required/`requiredTrue`/minLength/maxLength/min/max/pattern mapping. `US01-U03` `isLegalAge` boundaries (turns 18 today valid, +1 day invalid, 29-Feb leap rule). `US01-U04` future and impossible birth dates rejected, `minDate` floor. `US01-U05` `vehicleYearBounds` (2026 → `2006..2027`; 2005/2028 invalid; `2026.5` invalid). `US01-U06` `isValidClRut` (valid `12.345.678-5`, invalid check digit, `K`, dots/no dots) + `normalizeClRut`. `US01-U07` `coDocumentNumber` conditional on `documentType` (`CC` 6–10, `CE` 6–12, missing type → invalid). `US01-U08` plate patterns `ABC123` / `ABCD12` / `AA1234`, uppercase+trim transform. `US01-U19` Strapi `errorMessage` is the rendered message; empty fallback copy used when `null`. | `US01-E04` submit empty CO form → stays on `/co/quote/plans`-free Step 1, 8 error paragraphs with the exact seeded copy, focus on first invalid control, stepper still step 1. `US01-E05` invalid RUT on `/cl/quote` shows "El RUT ingresado no es válido."; correcting it enables progression. `US01-E06` invalid plate `AB1234` (CO) shows the CO message; `ABC123` passes. `US01-E07` birth date making the person 17 years 364 days old blocks; 18 today passes. | Visual check that error text sits next to its field and is not a toast. |
| **AC3** — Configuration change without deployment | `Given the business team adds a new published field in Strapi / When I reload the application / Then the new field appears without code changes` | `US01-U10` `WizardStore.load` status transitions `loading → ready` and `loading → empty` for `[]`. `US01-U12` reconciliation: added key defaulted, removed key ignored then dropped on next save, reordered field keeps its value, tightened validations revalidate the restored draft. `US01-U17` rehydration type coercion (`number` field receiving `"2019"`, `checkbox` receiving `"true"` → `false`). | `US01-E08` fill Step 1 → intercept/serve a catalogue with one extra field (`key: "email"`) → `page.reload()` → the new field renders **and** previously entered values are intact (draft preserved, `ADR-003` §4.3). `US01-E09` draft + catalogue with the field removed → reload → field gone, no console error, draft still has the other values. | Checkpoint 4: add a published `CL` field in the Strapi admin, reload `/cl/quote`, confirm it appears with **no rebuild** (`ADR-001` C6). Automated E2E cannot edit Strapi because the Public role has zero write permissions by design (`ADR-002`) — the E2E proves the front-end contract, the manual check proves the end-to-end promise. |
| **AC4** — Keep data when going back | `Given I moved on to step 2 / When I go back to step 1 / Then my data is still filled in` | `US01-U11` persistence round-trip: `save` → `load` returns identical `step1` values; TTL/`schemaVersion`/`country` mismatch → `null` + key removed. `US01-U13` country isolation: `save('CO')` then `load('CL')` → `null`; `CO` draft still loads afterwards. | `US01-E10` fill all CO fields → Continuar → `/co/quote/plans` placeholder visible → "Volver a mis datos" → every value is still present and the stepper is back on step 1. `US01-E11` same flow with a full `page.reload()` on the placeholder, then Back → values restored. | Keyboard-only walkthrough of the same path at Checkpoint 4. |

### 7.2 Auxiliary checks (states, accessibility, security, persistence)

| # | Check | Type | Pass criteria |
| --- | --- | --- | --- |
| `US01-E12` | Error state + retry | E2E | First catalogue request aborted (`route.abort()`) → `role="alert"` panel with Reintentar; second attempt fulfilled → form renders; draft values captured before the failure survive |
| `US01-E13` | Empty catalogue | E2E | Catalogue mocked to `{"data":[],"meta":{...total:0}}` → empty panel with both actions, **no** form, **no** Continuar; network tab shows no plan request |
| `US01-E14` | Loading state | E2E | Catalogue response delayed 500 ms → `aria-busy="true"` region + "Cargando el formulario…" visible, inputs absent, then replaced |
| `US01-E15` | Draft survives reload | E2E (`ADR-003` F2) | Fill Step 1, `page.reload()` → all values restored, invalid restored values flagged |
| `US01-E16` | Country switch keeps independent drafts | E2E (`ADR-003` F6) | Fill CO → switch to CL (clean form) → switch back to CO → CO values restored |
| `US01-E17` | No credentials, no writes | E2E network assertions (`ADR-002` V10/V11) | Zero `Authorization` headers on any request; every request to `/api/**` is `GET`; bundle/`frontend/src` contains none of `Bearer`, `apiToken`, `api_token` |
| `US01-E18` | Public role still read-only | API test via Playwright `request` (`ADR-002` V4–V6) | `POST /api/form-fields`, `PUT /api/form-fields/1`, `DELETE /api/country-configs/1` → `401`/`403`, never `2xx`; `GET /api/users` → `401`/`403` |
| `US01-E19` | Keyboard-only completion | E2E + Antigravity walkthrough | Entire Step 1 fillable and submittable with `Tab`/`Shift+Tab`/`Enter`/`Space`/`Arrow`; country switch and Back operable without a pointer; focus always visible |
| `US01-E20` | ARIA wiring | E2E DOM assertions | Each control has a resolvable `label[for]`, `aria-describedby` ids exist, `aria-invalid` toggles `false`→`true`, error paragraphs have `role="alert"` |
| `US01-E21` | Focus management | E2E | Invalid submit → focus = first invalid control; error panel → focus on its heading; back from placeholder → focus on `<h1>` |
| `US01-E22` | Responsive | E2E visual + assertion | At `375px`: no horizontal scroll, single column, targets ≥ 44 px. At `1280px`: two-column fieldsets, max-width respected. Snapshots reviewed at Checkpoint 4 |
| `US01-U20` | `StoragePort` throws | Unit (`ADR-003` F9) | No exception; store works in memory; `load` returns `null` |
| `US01-U21` | Required checkbox (`requiredTrue`) | Unit (synthetic fixture, G19) | Unchecked blocks; checked passes; value persists only as `boolean` |
| `US01-U22` | No `/api/` literal outside `CatalogueApi` | Static/lint check (`ADR-001` C5) | Zero matches in `frontend/src/app/**` excluding `catalogue.api.ts` and `environments/` |

### 7.3 Test fixtures (strictly fictitious)

| Purpose | Value |
| --- | --- |
| CO valid document | `documentType: "CC"`, `documentNumber: "1023456789"` |
| CL valid RUT | `12.345.678-5` (canonical `12345678-5`) |
| CO valid plate | `XYZ987` |
| CL valid plates | `ABCD12`, `AA1234` |
| Vehicle year boundaries | `2006` (valid in 2026), `2027` (valid), `2005` / `2028` (invalid) |
| Legal-age boundaries | born `2008-11-23` (turns 18 on 2026-11-23 → valid), `2008-11-24` (invalid), `2008-02-29` (leap rule) |
| Names | "Camila Rodríguez", "Matías Fuentes" |

No real identity documents, plates, addresses, or personal data appear in seeds, fixtures, or session logs (`AGENTS.md` §4.3).

### 7.4 Open Questions for Checkpoint 3 (human approval required)

1. **Step 2 placeholder shell in US-01.** Confirm that US-01 ships a read-only `/:country/quote/plans` placeholder (stepper step 2 active, heading, explanatory paragraph, "Volver a mis datos") with a `step1CompleteGuard`, so AC4 is verifiable within US-01 and US-02 replaces the component wholesale. Alternative: leave Step 2 unrouted and demonstrate AC4 only through browser history from the URL — weaker, and it makes AC4 untestable end to end. *Recommended: ship the placeholder.*
2. **Legal-age boundary convention.** Confirm: (a) validity is decided by the **browser's local calendar date**, not UTC or server time; (b) a 29-February birth date is treated as reaching the anniversary on **28 February** in non-leap years; (c) `birthDate = today − 18 years` is valid. Any change here changes `isLegalAge` and its unit-test table.
3. **Chilean RUT strictness.** Confirm that a wrong **módulo-11** check digit must block progression (not merely a format warning), that dotted, dashed and bare inputs are all accepted, that the stored/normalised form is `12345678-9`, and that US-03's `documentMaskVisibleEnd: 4` applies to both the Chilean RUT and the Colombian document number (masking is a US-03 behaviour, but the stored value shape is fixed here).
4. **Editorial rules for `key` and `order`.** Confirm that `key` is **immutable** after publication (renaming orphans `sessionStorage` drafts) and that all keys match `^[a-zA-Z][a-zA-Z0-9]*$`; that `order` ties are legal and resolved by `id: asc`; and that editors keep each `section`'s `order` values **contiguous** so headings are not repeated. If the business needs free reordering across sections, the rendering contract in G15 must be revisited before implementation.

---

### Checkpoint 3 Resolution (2026-11-23)

1. **Step 2 placeholder shell:** Approved — ship `PlansPlaceholderPageComponent` at `/:country/quote/plans` protected by `step1CompleteGuard` so `US-01` AC4 ("Keep data when going back") is verifiable within `US-01` and replaced cleanly in `US-02`.
2. **Legal-age boundary convention:** Approved — evaluate against the browser's local calendar date; 29-Feb birthdays reach their anniversary on 28-Feb in non-leap years; turning 18 today is valid.
3. **Chilean RUT strictness:** Approved — enforce strict módulo-11 check digit verification, accept dotted/dashed/bare input, and normalize to `12345678-9`.
4. **Editorial rules for `key` and `order`:** Approved — `key` is immutable once published, `order` ties break by `id: asc`, and editors keep `section` orders contiguous.

### Approval block

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Human project owner (Checkpoint 3) | Holguer | ☑ Approved | 2026-11-23 |
| `spec-analyst` (author) |  | Submitted for review | 2026-11-23 |
