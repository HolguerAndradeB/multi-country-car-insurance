# ADR-001: Multi-Country Content Strategy — Strapi Country Scoping and Angular Path-Based Country Context

**Status:** Accepted (Approved at Checkpoint 2 on 2026-11-23)

**Date:** 2026-11-23

**Deciders:** Human project owner (Checkpoint 2), `spec-analyst` (author), `strapi-dev`, `angular-dev`

**Consulted:** `.opencode/skills/strapi-multi-country/SKILL.md`, `.opencode/skills/angular-dynamic-wizard/SKILL.md`, `AGENTS.md` §1, §2, §4.1, §4.2, §5

**Informed:** `tester-dev`, `code-reviewer`

---

## 1. Context and Problem Statement

The product must serve **Colombia (`CO`)** and **Chile (`CL`)** from **one Angular 21+ build** and **one Strapi 5+ instance**, started with a single `docker compose up` and seeded idempotently for both countries (`AGENTS.md` §1, §4.2).

The two markets differ in ways that are **catalog differences, not only translations**:

| Aspect | Colombia (`CO`) | Chile (`CL`) |
| --- | --- | --- |
| Identity document label | *Cédula de ciudadanía* / *cédula de extranjería* | *RUT* |
| Document format / check digit | Numeric, no check digit | `12.345.678-9` with módulo-11 check digit |
| Plate label | *Placa* | *Patente* |
| Plate format (seed) | `ABC123` | `ABCD12` (and other formats) |
| Currency | `COP` | `CLP` |
| Locale | `es-CO` | `es-CL` |
| Legal terms (`US-03`) | Country-specific text | Country-specific text |
| Plans, coverages, benefits (`US-02`) | Country-specific catalog | Country-specific catalog |
| Field set, labels, order, validations (`US-01`) | Country-specific | Country-specific |

**Core problem:** how do we model "which country is this content for" in Strapi, and "which country is the user in" in Angular, so that:

1. Editing/adding/removing/reordering a published field, plan, or legal text in Strapi becomes visible **on reload, with zero front-end code changes and zero redeployment** (`AGENTS.md` §4.2; US-01 "Configuration change without deployment").
2. A future third market (e.g. Peru, Mexico) is a **data + one enum value** change, not a fork of the front end.
3. A country context is **deep-linkable, refresh-safe, and shareable**, so a marketing link or a support agent can hand over `.../co/quote` or `.../cl/quote`.
4. Cross-country data leakage is **structurally hard**, not merely a reviewer's habit: a `CO` session must never display a `CL` plan, legal text, or field.

This ADR decides **two coupled questions**:

- **Q1 (backend):** the Strapi multi-country content model.
- **Q2 (frontend):** the Angular country-context/routing model.

They are recorded together because a mismatch between them (e.g. Strapi i18n locales + subdomain routing) creates exactly the dual-source-of-truth failures this ADR is meant to prevent.

**Out of scope of this ADR:** authentication of end users (there is none), real payment integration (simulated per §4.1), and front-end persistence mechanics (see `ADR-003`).

---

## 2. Decision Drivers

| # | Driver | Source |
| --- | --- | --- |
| D1 | **Zero-redeploy configurability** — published Strapi content drives the UI on reload | `AGENTS.md` §4.2; US-01 AC3 |
| D2 | **Single build / single instance / single command** | `AGENTS.md` §1 |
| D3 | **Business-editable ordering** (`order` asc) and per-country field sets | US-01 BR, US-02 BR |
| D4 | **Strict structural isolation** between `CO` and `CL` catalogs | US-01 AC1, US-02 AC1, US-03 AC2 |
| D5 | **Deep-linkability + refresh safety** of the country context | US-01 AC1 ("open the application in the context of a country"), refresh-driven AC3 |
| D6 | **Low operational complexity** for local dev (no DNS/TLS/hosts hacks) | `AGENTS.md` §1, §4.4 |
| D7 | **Editorial cognitive load** — a non-technical business editor must not reason about locales vs markets | `AGENTS.md` §1, §5 |
| D8 | **Linear (not multiplicative) cost of a third market** | `AGENTS.md` §1 (single build) |
| D9 | **E2E testability** — country context must be expressible as a URL/param in Playwright | `AGENTS.md` §2 (tests chain) |
| D10 | **Market ≠ language** — Chile and Colombia share Spanish but need different documents, formats, plans, and legal text | US-01/US-03 context |
| D11 | **Strapi 5 flattened REST + Public read-only `find`/`findOne`** must remain the only access path | `AGENTS.md` §4.2, §4.3; `strapi-multi-country` skill §1, §4 |
| D12 | **Simplicity of the security surface** — fewer public endpoints and no locale-parameter translation layer in the browser | `ADR-002` |

---

## 3. Considered Options

### 3.1 Q1 — Strapi multi-country content model

#### Option A — Explicit `country` enumeration (`CO` | `CL`) + REST filtering **(Recommended)**

Every country-scoped collection type (`form-field`, `insurance-plan`, `country-config`) carries a required `country` enumeration. The front end queries:

```http
GET /api/form-fields?filters[country][$eq]=CO&sort=order:asc&pagination[pageSize]=100
GET /api/insurance-plans?filters[country][$eq]=CL&filters[active][$eq]=true&sort=order:asc
GET /api/country-configs?filters[country][$eq]=CL
```

**Pros**

- **Direct mapping to the domain.** The thing that varies is the *market*, and the schema says `country`. Reviewers, editors, and tests all speak the same word (D4, D7, D10).
- **One query parameter is the whole contract.** Country scoping lives in a single `filters[country][$eq]=…` clause, injectable in exactly one place (`CatalogueApi`), so leakage can be prevented structurally and asserted in one unit test (D4).
- **Per-country field sets are the natural case, not a workaround.** A field that exists only in `CL` is simply a row with `country: CL` (D3).
- **`order` is a plain integer column,** so `sort=order:asc` gives deterministic, business-controlled ordering per country with no locale-aware sorting surprises (D3).
- **`country-config.country` can be `unique: true`,** giving a hard invariant "exactly one legal/currency config per market" enforced by the database (D4).
- **`enum` is self-documenting in the Strapi Content-Type Builder** and validates on write; a typo `COO` is rejected at the API/schema level rather than silently producing an empty list (D7).
- **Seed idempotency is trivial:** `filters: { country, key }` (fields) / `filters: { country }` (config) is a stable natural key (D2, D11).
- **Works with the existing skill contracts** (`strapi-multi-country` §2) with zero reinterpretation (D11).
- **Adding a market** = add an enum value + seed rows + one entry in the front-end static country catalog. No schema restructure, no second instance (D8).

**Cons**

- The `country` enum is a **schema-level** list: adding `PE` requires editing the schema and restarting Strapi (not the front end). This is acceptable because schema changes already require a restart, and the requirement is specifically *no front-end redeploy* (D1).
- **Every query must remember the filter.** Without a single choke point, one forgotten filter leaks the other country's catalog. Mitigation: all catalogue reads go through one `CatalogueApi` service that owns the country parameter; components never build Strapi query URLs (see §4.4).
- **Copy is duplicated per country** where the texts are near-identical (e.g. a generic help text). Mitigation: editors copy the entry; Strapi has no shared-content mechanism without relations, and duplicating two rows is cheaper than the complexity of a translation layer (D7, D12).
- Enum and locale are **two separate concepts** (`country: CL` and `locale: 'es-CL'`). Accepted: locale is a *display/formatting* attribute stored on `country-config`, not an addressable dimension.

#### Option B — Strapi built-in i18n locales (`es-CO` / `es-CL`)

Model content per locale; the front end queries `?locale=es-CO`, mapping `CO → es-CO`.

**Pros**

- Native admin locale switcher and per-locale draft/publish (`draftAndPublish` + i18n).
- Built-in locale fallback (`defaultLocale`) for untranslated entries.
- Standard Strapi feature; no custom field to explain to editors.
- Correct tool if the primary variation were *language* (D10) — e.g. shipping an English UI for the same market.

**Cons**

- **Conceptual mismatch (D10).** i18n asserts that entries are *translations of the same document*. `CO` and `CL` plans are **not translations of each other** — they have different names, prices, coverages, and legal force. Linking them as locale variants of one document is semantically wrong and will confuse editors about what "publish both locales" means.
- **Dual source of truth.** `country-config.country` is still needed (currency per market, and `country` is the filter used by the verification checklist and by `ADR-002`'s permission smoke tests), so the model would carry *both* `country` and `locale` while only one of them is the real discriminator (D4, D7).
- **Filtering requires a mapping layer in the browser** (`CO → es-CO`), i.e. a second naming system in the front end and a second failure mode ("wrong locale string → empty UI") (D9, D12).
- **Per-market field sets become implicit.** A `CL`-only field exists only as an entry missing its `es-CO` sibling; there is no single `country` column to query, index, or assert against. `order` becomes a localized field, so any accidental locale mismatch silently reorders or hides fields (D3, D4).
- **Empty-locale failure is silent.** Forgetting to publish one locale yields an empty list, which is indistinguishable from "no plans available" (US-02 AC4) — a bad, unlabelled empty state.
- **Relations get locale-coupled.** Plan → coverage/benefit references must be locale-matched; mismatches surface as missing coverages rather than an error.
- **`unique` per country is not expressible;** uniqueness becomes per `(locale, …)` and depends on the i18n plugin's behavior.
- Adds i18n surface to the public API (e.g. locale listing endpoints) that `ADR-002`'s minimal permission matrix must then explicitly deny (D12).

#### Option C — Separate content types or separate Strapi instances per country

`form-field-co` / `form-field-cl`, or two Strapi projects (two databases, two ports).

**Pros**

- Maximum isolation: a leak is impossible without touching two systems.
- Independent schema evolution and independent deploy cadence per country.
- Per-country admin users and roles are natural.
- Failure blast radius is one market.

**Cons**

- **Multiplicative maintenance (D8).** Every schema change, seed change, permission change, and query change happens twice; a third market makes it three.
- **Breaks the "single build, single Strapi, single command" mandate (D2).** Two Strapi instances double the compose services/DBs and contradict `AGENTS.md` §1 and the `strapi-multi-country` seed/permission patterns.
- **Schema drift is near-certain.** The two schemas diverge, then the front end needs per-country branches — the exact hardcoding the project forbids (`angular-dynamic-wizard` §2: "Never hardcode country field definitions").
- **Editors must know which admin panel to open (D7),** and cross-country consistency review becomes a manual diff.
- **Ordering and enumeration must be duplicated** in two schemas rather than shared (D3).
- **No cheap way to add a market,** and no single idempotent bootstrap (§4.2 of `AGENTS.md`) — seed logic forks.
- **Test cost multiplies:** Playwright and unit fixtures need per-country configuration instead of one parameterized `country` (D9).

### 3.2 Q2 — Angular country context

#### Option A — Path-based routing (`/:country/quote`) + header country switcher + `CountryContextService` **(Recommended)**

```
/                       → redirect to /co/quote  (default market) or a country picker
/:country/quote         → Step 1 (policyholder + vehicle)
/:country/quote/plans   → Step 2 (plan list)
/:country/quote/summary → Step 3 (summary + simulated payment)
```

A route guard validates `country ∈ {'co','cl'}` (case-normalised), resolves a static `COUNTRY_CATALOG` entry, and provides a `CountryContextService` whose `country` is a `signal` **derived from the route param** (single source of truth). A header `<select>`/segmented control switches country by navigating to the sibling route, resetting wizard state scoped to the country.

**Pros**

- **Deep-linkable and shareable (D5).** A support agent can send `/cl/quote/plans`; refresh restores context with no storage read needed.
- **Refresh-safe and back/forward-native.** Browser history maps 1:1 to wizard steps, which also satisfies US-01 AC4 ("keep data when going back") at the routing level.
- **Trivially E2E-parameterisable (D9):** `for (const c of ['co','cl']) test(...)` with no fixture plumbing.
- **No infrastructure (D6):** works on `http://localhost:4200` and inside Docker with one origin, so the Strapi CORS allowlist stays a single entry (`ADR-002`).
- **Guarded, validated context.** Unknown segments (`/xx/quote`) are rejected by a guard → canonical redirect, rather than producing an empty catalogue.
- **Enables per-country analytics/SEO and canonical URLs** without a second build (D1, D2).
- **Country switching is explicit and observable:** navigating `/co/quote` → `/cl/quote` triggers a well-defined reset path (see `ADR-003`), avoiding silent cross-country state bleed (D4).

**Cons**

- Requires a guard, a route-param-to-signal bridge, and discipline that **no component caches its own `country` copy** — otherwise a stale copy reappears (D4). Mitigation: `CountryContextService` is the only provider; lint/review rule forbids `sessionStorage`/literal country reads in components.
- All internal links must be generated with the country prefix (a small `quotePath()` helper rather than string literals).
- `/:country` is a reserved root segment in routing; a future marketing page must not collide with `co`/`cl` (acceptable, documented).

#### Option B — Subdomains (`co.example.com` / `cl.example.com`)

**Pros**

- Cleanest URL aesthetics (root paths per market).
- Natural market separation for cookies, CDN caching, and per-country marketing landing pages.
- Country is unambiguous at the origin level; no route guard needed for validity.

**Cons**

- **Local dev and Docker cost (D6):** requires `hosts` entries / DNS, wildcard TLS in production, and two origins in the CORS allowlist and in Playwright base URLs.
- **`sessionStorage` is origin-scoped,** so the header country switcher would land on a different origin and *lose* all wizard state — which either breaks US-01 AC4 across a switch or forces cross-origin state sharing (a cookie/localStorage bridge) and thus a third persistence mechanism (`ADR-003` conflict).
- **Host-header-dependent behaviour is invisible in the code path,** so a misconfigured proxy silently serves the wrong market (bad failure mode for D4).
- **Harder to verify in one tab** during the mandated accessibility/keyboard walkthrough (Checkpoint 4).
- **Premature infrastructure** for a two-market MVP: no requirement mentions vanity domains, and the single-build requirement is about code, not hosting topology.

#### Option C — Query parameter or storage-only toggle (`?country=CL`, or `localStorage` only)

**Pros**

- Cheapest possible implementation; no guard, no path design.
- Switching country is a single signal write (storage-only) with no navigation.

**Cons**

- **Storage-only breaks linkability outright (D5):** a shared link has no country, so the recipient silently gets the *sender's* default or a stale stored country — a data-integrity bug that manifests as "wrong legal terms shown" in US-03 AC2.
- **Query params make every route ambiguous** (`/quote?country=cl` vs `/quote/plans?country=co`), leak the parameter into every link, and produce duplicate URLs for the same resource (poor canonicalisation, messy analytics).
- **Back/forward becomes inconsistent:** changing country via a dropdown either pushes meaningless history entries or leaves a back button that appears broken.
- **No structural validation.** An invalid value must be defended in every consumer rather than once at the route boundary (D4).
- **Harder E2E:** each test must seed storage before navigation or append the query string everywhere (D9).

---

## 4. Decision Outcome

**Chosen (Q1): Option A — explicit `country` enumeration (`CO` | `CL`) with REST filtering.**
**Chosen (Q2): Option A — path-based `/:country/quote` routing, header country switcher, signal-based `CountryContextService`.**

Only these sentences are the decision; everything below is its concrete shape and consequences.

### 4.1 Strapi content shape (contract summary)

| Collection type | Endpoint | Country-scoped? | Key fields (as per `strapi-multi-country` §2) |
| --- | --- | --- | --- |
| `form-field` | `GET /api/form-fields` | yes — `country` enum, required | `key`, `label`, `type`, `required`, `validations`, `options`, `helpText`, `errorMessage`, `order`, `country` |
| `insurance-plan` | `GET /api/insurance-plans` | yes — `country` enum, required | `name`, `shortDescription`, `basePrice`, `currency`, `coverages`, `benefits`, `order`, `recommended`, `active`, `country` |
| `country-config` | `GET /api/country-configs` | yes — `country` enum, **unique** | `countryName`, `currency`, `locale`, `termsAndConditions`, `documentMaskVisibleEnd` |

Canonical queries (exact strings, per `strapi-multi-country` §5):

```http
GET /api/form-fields?filters[country][$eq]=CO&sort=order:asc&pagination[pageSize]=100
GET /api/insurance-plans?filters[country][$eq]=CL&filters[active][$eq]=true&sort=order:asc&pagination[pageSize]=100
GET /api/country-configs?filters[country][$eq]=CO
```

Ordering contract: `order` is the **only** sort key; ties are broken by `id:asc` client-side to guarantee stable rendering across reloads. Filtering is **never** done in the browser as a substitute for the server filter — the browser receives only its own country's rows (defence in depth for D4).

### 4.2 Angular routing and country context (contract summary)

```ts
export type CountryCode = 'CO' | 'CL';

export interface CountryCatalogEntry {
  readonly code: CountryCode;          // 'CO' | 'CL'
  readonly routeSegment: string;       // 'co' | 'cl'
  readonly locale: string;             // 'es-CO' | 'es-CL'
  readonly currency: 'COP' | 'CLP';
  readonly displayName: string;        // 'Colombia' | 'Chile'
}

export const COUNTRY_CATALOG: readonly CountryCatalogEntry[] = [
  { code: 'CO', routeSegment: 'co', locale: 'es-CO', currency: 'COP', displayName: 'Colombia' },
  { code: 'CL', routeSegment: 'cl', locale: 'es-CL', currency: 'CLP', displayName: 'Chile' },
];
```

- `COUNTRY_CATALOG` holds **only** locale/currency/route metadata and display names. It must **never** contain field definitions, plan names, prices, or legal text — those come from Strapi only (`AGENTS.md` §4.2).
- `CountryContextService` exposes `readonly country = computed<CountryCode>(...)` fed exclusively by the activated route's `:country` param. It exposes no setter; a country change is a *navigation*.
- Route configuration: `/` → `redirectTo: 'co/quote'` (documented default market), `/:country/quote` (Step 1), `/:country/quote/plans` (Step 2), `/:country/quote/summary` (Step 3), `**` → not-found page with a link back to `/co/quote`. An invalid `:country` triggers a redirect, never a blank catalogue.
- `CatalogueApi` is the **single** place that appends `filters[country][$eq]=…`; components/pages never build Strapi URLs.

### 4.3 Consequences

**Good**

- One Strapi instance and one Angular build serve both markets, honouring §1/§4.2 with no per-country branching in components.
- Country is **data**: field sets, plans, ordering, recommended flags, and legal text are all business-editable, satisfying D1/D3 and US-01 AC3.
- Cross-country leakage has one choke point (`CatalogueApi`) plus one unit test to prove it.
- Deep links, refresh, and back-navigation all work without persistence being the source of truth for *country*.
- A third market is an enum value + seed rows + one catalog entry — linear cost (D8).
- Minimal security surface: three read-only public endpoints, no locale/translation layer, one CORS origin (`ADR-002`).

**Bad / accepted trade-offs**

- Adding a market touches the **Strapi schema enum** and needs a Strapi restart (but no front-end rebuild/redeploy).
- Near-identical copy is duplicated per country rather than translated once (accepted for two Spanish-speaking markets).
- Path-prefix discipline is required for every internal link; enforced via a `quotePath()` helper and review checklist.
- The default-market redirect (`/` → `/co/quote`) is a product assumption that must be confirmed at Checkpoint 3; if the business wants a country chooser at `/`, only the redirect target changes (US-01 AC1 says "open the application in the context of a country" without mandating a picker).
- Failed/absent `country-config` for a market means no legal text → Step 3 must block with an explicit error state rather than render empty terms (`ADR-003`, US-03 AC2).

### 4.4 Confirmation (how we will know the decision was implemented)

| Check | Method | Pass criteria |
| --- | --- | --- |
| C1 | `curl`/E2E `GET /api/form-fields?filters[country][$eq]=CO&sort=order:asc` | HTTP 200, every row has `country === 'CO'` |
| C2 | Unit test on `CatalogueApi` | Exactly one `filters[country][$eq]` per request; no request without it |
| C3 | E2E: visit `/co/quote` and `/cl/quote` | Only that country's field labels render; `order` ascending |
| C4 | E2E: navigate `/xx/quote` | Canonical redirect to a valid country route, no empty catalogue |
| C5 | Static check in `frontend/src` | No `'/api/'` string literals in components; only `CatalogueApi` builds URLs |
| C6 | Strapi admin: add a published `CL` field, reload `/cl/quote` | Field appears without any code change or rebuild (US-01 AC3) |
| C7 | Review of `country-config` schema | `country` is `unique: true`, `required` |
| C8 | Security regression (`ADR-002` §6) | Public role still only `find`/`findOne` on the three types |

---

## 5. Pros and Cons of the Options (consolidated)

### 5.1 Q1 summary

| Option | Isolation | Editor clarity | Zero-redeploy | Add-market cost | Local-dev cost | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| **A. `country` enum + filters** | High (one filter choke point) | High (one word: country) | Yes | Low (enum + seed + catalog row) | None | **Chosen** |
| B. i18n locales | Medium (implicit, locale-matched) | Low (locale vs market) | Yes | Medium (new locale + fallback rules) | None | Rejected |
| C. Separate types/instances | Maximum | Low (two panels) | Yes | High (linear duplication) | High (2 services/DBs) | Rejected |

### 5.2 Q2 summary

| Option | Deep links | Refresh safety | Infra cost | State continuity on switch | E2E ergonomics | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| **A. Path `/:country/quote`** | Yes | Yes | None | Explicit reset per country | Best (URL only) | **Chosen** |
| B. Subdomains | Yes | Yes | High (DNS/TLS/hosts) | Broken (origin-scoped storage) | Poor (multi-origin config) | Rejected |
| C. Query param / storage-only | Partial / No | Fragile | None | Implicit and surprising | Poor (seed storage) | Rejected |

---

## 6. Traceability

| Requirement | Story / Rule | Addressed by |
| --- | --- | --- |
| Fields configured per country with `order`, `country`, validations | US-01 Business rules | §4.1 (`form-field`), §3.1-A |
| "Form configured by country" — only that country's fields, in order | US-01 AC1 | §4.1 queries, §4.4 C1/C3 |
| "Configuration change without deployment" after reload | US-01 AC3 | §3.1-A pros, §4.4 C6 |
| "Keep data when going back" (Step 2 → Step 1) | US-01 AC4 | §3.2-A (history-native routing) + `ADR-003` §4.3 |
| Only active + published plans for the country, in order | US-02 AC1 | §4.1 (`insurance-plan` filters) |
| Recommended flag, plan selection, empty state | US-02 AC2–AC4 | §4.1 (`recommended`, `order`), `ADR-003` (state) |
| Terms text per country | US-03 AC2 | §4.1 (`country-config.termsAndConditions`), §4.3 (missing config blocks) |
| Single build, single instance, single command | `AGENTS.md` §1, §4.2 | §4.3 Good |
| Strapi 5 flattened REST, public read-only | `AGENTS.md` §4.2–4.3 | §4.1, `ADR-002` |
| No hardcoded country field definitions in Angular | `angular-dynamic-wizard` §2 | §4.2 (`COUNTRY_CATALOG` limited to locale/currency/route) |

---

## 7. Links

- [`docs/user-stories/US-01.md`](../user-stories/US-01.md)
- [`docs/user-stories/US-02.md`](../user-stories/US-02.md)
- [`docs/user-stories/US-03.md`](../user-stories/US-03.md)
- [`docs/adrs/ADR-002-strapi-security-and-permissions.md`](./ADR-002-strapi-security-and-permissions.md)
- [`docs/adrs/ADR-003-frontend-persistence-and-sdd-workflow.md`](./ADR-003-frontend-persistence-and-sdd-workflow.md)
- [`.opencode/skills/strapi-multi-country/SKILL.md`](../../.opencode/skills/strapi-multi-country/SKILL.md) §2, §5
- [`.opencode/skills/angular-dynamic-wizard/SKILL.md`](../../.opencode/skills/angular-dynamic-wizard/SKILL.md) §2, §3
- [`AGENTS.md`](../../AGENTS.md) §1, §2, §4.1, §4.2, §5

---

## 8. Open Questions for Checkpoint 2

1. **Default market at `/`:** redirect to `/co/quote` (assumed), or render a keyboard-accessible country chooser? The ADR assumes a redirect; only the redirect target changes if the answer differs.
2. **Route segment casing:** lowercase `/co` / `/cl` (assumed, per URL convention) with case-insensitive guard normalisation — confirm no uppercase `/CO` links are required.
3. **Third-market readiness:** confirm that adding `PE` may legitimately require a Strapi schema edit + restart (but never an Angular rebuild).
4. **Query page size:** assume `pagination[pageSize]=100` is sufficient for both field sets and plan lists (no pagination UI in scope). Confirm.

### Checkpoint 2 Resolution (2026-11-23)

- **Default market at `/`:** Approved — `/` automatically redirects to `/co/quote`, with a visible header country switcher to navigate to `/cl/quote`.
- **Route segment casing & pagination:** Confirmed canonical lowercase `/co` and `/cl` routes and `pagination[pageSize]=100`; adding a future third market may update the Strapi `country` enum without requiring an Angular rebuild.
