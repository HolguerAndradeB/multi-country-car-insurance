# ADR-002: Strapi Security and Permissions — Public Role Read-Only Access and Zero Browser Tokens

**Status:** Proposed (Awaiting Checkpoint 2 Human Approval)

**Date:** 2026-11-23

**Deciders:** Human project owner (Checkpoint 2), `spec-analyst` (author), `strapi-dev`

**Consulted:** `.opencode/skills/strapi-multi-country/SKILL.md` §4, §5; `AGENTS.md` §4.3; `ADR-001`

**Informed:** `angular-dev`, `tester-dev`, `code-reviewer`

---

## 1. Context and Problem Statement

The front end is a **public, unauthenticated, browser-delivered** Angular application. It reads form-field metadata, insurance plans, and per-country legal terms from Strapi and **writes nothing** to Strapi: quotes, plan selection, simulated pricing, and simulated payment exist only in the browser (`AGENTS.md` §4.1, §4.3).

The security requirement is explicit and non-negotiable (`AGENTS.md` §4.3):

> **NEVER expose any Strapi write token, admin token, or API token with write permissions to the browser.**
> **Minimal Public Role permissions** — only `find` and `findOne` on strictly required read-only content types. Zero `create`, `update`, or `delete` on `Public`.
> **NEVER commit real secrets** — `.env` (gitignored) + `.env.example` with placeholders.

This forces a question that is usually answered lazily ("just put a token in `environment.ts`"):

**Problem:** How does a browser-only client read Strapi content while the *entire* authorization surface exposed to the internet remains read-only, minimal, and auditable — with no credential of any kind shipped to the browser?

A second, subtler constraint: anything that is readable by a token embedded in a bundle is effectively **public content anyway**, only with worse properties — the credential is extractable, cannot be rotated without a redeploy, and grants whatever scope the token has, silently widening over time as the schema grows. The decision must therefore optimise for **small, enumerable, testable permissions**, not for "convenience now".

**Scope:** Strapi's Public (users-permissions) role, API tokens, CORS, environment hygiene, and the verification procedure. Out of scope: admin-panel hardening beyond the defaults, production WAF/CDN configuration, and any end-user authentication (there is none).

---

## 2. Decision Drivers

| # | Driver | Source |
| --- | --- | --- |
| S1 | **No write credential in the browser, ever** | `AGENTS.md` §4.3 |
| S2 | **Permissions must be enumerable and minimal** (a human can read the whole list) | `AGENTS.md` §4.3; `strapi-multi-country` §4 |
| S3 | **Configuration must be reproducible**, not clicked by hand in the admin UI — `docker compose up` on a clean machine must yield the same posture | `AGENTS.md` §1, §4.2 |
| S4 | **Read-only content is genuinely public content** (fields, plans, legal text), so no user identity is needed | US-01, US-02, US-03 |
| S5 | **Draft content must never leak** (business editors stage drafts) | `AGENTS.md` §4.2 (`draftAndPublish`), `strapi-multi-country` §1 |
| S6 | **Zero-redeploy configurability** must not depend on a rotating credential | `AGENTS.md` §4.2; ADR-001 D1 |
| S7 | **Single-command local dev with one front-end origin** | `AGENTS.md` §1; ADR-001 D6 |
| S8 | **Verifiable in CI/E2E** — the absence of write capability must be provable, not assumed | `AGENTS.md` §2 (tests chain) |
| S9 | **No secret in git history**, including "just for local" tokens | `AGENTS.md` §4.3 |
| S10 | **Operational simplicity** — the MVP is two containers, no extra service to build/own | `AGENTS.md` §1 |
| S11 | **Seed/bootstrap writes must happen without any external credential** | `AGENTS.md` §4.2; `strapi-multi-country` §3 |

---

## 3. Considered Options

### Option A — Programmatic Public role: read-only `find` + `findOne` only, and **no API token** in the browser **(Recommended)**

During `bootstrap`, the Strapi process discovers the Public role (`plugin::users-permissions.role`, `type: 'public'`) and sets its permissions to **exactly**:

- `api::form-field.form-field.find`
- `api::form-field.form-field.findOne`
- `api::insurance-plan.insurance-plan.find`
- `api::insurance-plan.insurance-plan.findOne`
- `api::country-config.country-config.find`
- `api::country-config.country-config.findOne`

…and **nothing else**. The Angular app issues plain unauthenticated `GET` requests to `${apiBaseUrl}/api/...`, with no `Authorization` header and no token constant of any kind.

Bootstrap seeding uses `strapi.documents(...)` **inside** the Strapi process (server-side, privileged by construction), so writes never need a token either (S11).

**Pros**

- **Satisfies S1 absolutely.** There is no credential to leak because none exists in the artifact. This is a property of the architecture, not a review finding.
- **S2 by construction:** the permission list is six lines of code, diffable in a PR, and identical on every machine (S3).
- **Empirical verification is cheap (S8):** `POST/PUT/DELETE` unauthenticated → `401`/`403`; exactly one positive smoke test per content type.
- **No rotation problem (S6).** Configuration changes (new field, new plan) need no token change and no redeploy.
- **Draft isolation comes for free (S5):** the Public role can only ever receive published entries; drafts are not addressable through public `find`/`findOne`.
- **Smallest attack surface.** A public read-only API with no auth is exactly what browsers cache/CDN and what the CORS allowlist can restrict to the app origin.
- **Works in `docker compose` with zero extra services (S7, S10).**
- **Consistent with the existing skill** (`strapi-multi-country` §4) — no reinterpretation drift.

**Cons**

- **The content is readable by anyone on the network.** Accepted and intended: it is marketing/legal/config content, contains no personal data, and is the same content every visitor's browser receives anyway (S4).
- **Enumeration exposure:** if a future contributor adds a `secret-*` content type and carelessly grants Public access, it leaks. Mitigation: the bootstrap function **declares the complete allowlist** and *removes* any other `api::*` permission from Public (deny-by-construction, see §4.3), so the default is denial rather than accumulation.
- **Read amplification:** unauthenticated public reads can be scraped/abused. Mitigation: rate limiting via reverse proxy or Strapi middleware (open point §8.4), plus CDN caching in a real deployment.
- **No per-user personalisation is possible** through this path. Not required: there is no user account in scope (`AGENTS.md` §4.1).

### Option B — Read-only Strapi API token embedded in the Angular environment

Generate a Strapi API token (read-only, scoped to the three content types) and ship it in `frontend/src/environments/environment.ts`, sending `Authorization: Bearer <token>`.

**Pros**

- Trivial to implement: one interceptor, one constant.
- Appears to allow "restricting" reads to the app, at least in intent.
- No bootstrap permission code to write.

**Cons**

- **Directly violates S1's spirit and the letter of §4.3's intent.** Any value in a served bundle is public: it appears in the JS payload, in DevTools, in source maps, and in any screen recording or bug report. "Read-only" limits the blast radius but does not remove the exposure.
- **Rotation requires a front-end redeploy (S6)** — and §4.2 explicitly demands no redeploy for content changes; bundling a credential couples content operations to deployment.
- **Scope creep is silent.** A token created as "read-only on three types" is edited in the admin UI to add a type; nothing in review catches it, and the browser now reads content it never needed (S2 violation by maintenance friction).
- **Secret hygiene fails at the boundary (S9):** the value must live in `.env` → generated into a committed `environment.ts`, or be committed directly. Either path risks history contamination, and `environment.ts` is *code*, not config.
- **No real security gain:** the token protects nothing that the Public role does not already protect, because the content is public by requirement (S4).
- **Adds an auth branch to every request** and a second failure mode ("token expired/revoked → blank UI") that no user can resolve.
- **Temptation to escalate:** once a token is in the bundle, "let's just let the browser post the quote" becomes a one-line change — exactly the boundary this project forbids (`AGENTS.md` §4.1: no backend persistence of quotes).

### Option C — Dedicated BFF (Backend-For-Frontend) proxy service

Add a small Node/Express (or Strapi custom controller) layer that holds a token server-side and exposes a curated public API to Angular (e.g. `/bff/co/catalogue`).

**Pros**

- **Strongest server-side control:** the credential never leaves the server; responses can be trimmed, aggregated, cached, and rate-limited per route.
- Enables response shaping (one call returning fields + plans + config for a country), reducing round trips.
- A natural place for allow-listing query parameters, so a client cannot craft arbitrary `filters[...]` or `populate=*`.
- Scales into a real production topology (CDN + edge cache + token rotation).

**Cons**

- **A third service to build, test, secure, and operate (S10).** It contradicts the "single command, two containers" MVP envelope, and adds a new deployable with its own env/secrets — *more* secret surface, not less.
- **Duplicates the permission model** that Strapi already provides: we would implement and test an authorisation layer that the Public role gives us for free — including a second place for the "only these three types" rule to drift.
- **The security benefit is small here (S4):** proxying *public* content behind a token protects data that is already public; the only real gains (caching, shaping) are not requirements in Phase 1.
- **Extra latency and failure modes** in local dev and E2E (proxy down, port, CORS again).
- **Premature abstraction:** without a requirement for aggregation, per-user data, or protected content, it is architecture for its own sake.

---

## 4. Decision Outcome

**Chosen: Option A — programmatically configured Public role with `find` + `findOne` ONLY on `form-field`, `insurance-plan`, and `country-config`, and zero API tokens (none with write permissions, none at all) in the browser.**

### 4.1 Permission matrix (authoritative)

| Content type / action | `find` | `findOne` | `create` | `update` | `delete` |
| --- | --- | --- | --- | --- | --- |
| `api::form-field.form-field` | **ALLOWED** | **ALLOWED** | DENIED | DENIED | DENIED |
| `api::insurance-plan.insurance-plan` | **ALLOWED** | **ALLOWED** | DENIED | DENIED | DENIED |
| `api::country-config.country-config` | **ALLOWED** | **ALLOWED** | DENIED | DENIED | DENIED |
| Any other `api::*` content type (current or future) | DENIED | DENIED | DENIED | DENIED | DENIED |
| `plugin::users-permissions.auth.*` (`register`, `callback`, `connect`, `forgotPassword`, `resetPassword`, `changePassword`, `emailConfirmation`) | — | — | DENIED | DENIED | DENIED |
| `plugin::users-permissions.user.*` (`/api/users`, `/api/users/me`) | DENIED | DENIED | DENIED | DENIED | DENIED |
| `plugin::upload.content-api.*` (`/api/upload`, `/api/upload/files`) | DENIED | DENIED | DENIED | DENIED | DENIED |
| `plugin::i18n.locale.*` | DENIED | DENIED | DENIED | DENIED | DENIED |
| `plugin::content-releases.*`, `plugin::review-workflows.*` | DENIED | DENIED | DENIED | DENIED | DENIED |
| `admin::*` (all Admin API routes) | NOT GRANTABLE to Public | — | — | — | — |
| API tokens (any type, any scope) | **NONE ISSUED / NONE SHIPPED** | — | — | — | — |

Rationale for the denied rows: there is **no user registration, no uploads (schemas use `json`, not media), no locale switching in the browser (`ADR-001` option A), and no editorial workflow** in the runtime application. Every denied action is one that no browser flow can legitimately reach, so its absence is a testable invariant rather than an opinion.

Note that `find` on a `draftAndPublish` type returns **published entries only** for unauthenticated requests; drafts are unreachable through the Public role (S5).

### 4.2 Bootstrap enforcement shape

The implementation (owned by `strapi-dev`) must, inside `async bootstrap({ strapi })`:

1. Read the Public role and **replace** its permission set with the exact allowlist above (idempotent: running it twice yields the same set).
2. **Revoke** any permission not in the allowlist — including `api::*` permissions added by a developer in the admin UI or by a future content type. Default is denial.
3. Never create an API token; never print or log one.
4. Keep seeding writes inside the process via `strapi.documents(...)` with `status: 'published'` (S11) — no credential is involved in seeding.

### 4.3 CORS policy

- Allowed origins: **exactly** the Angular dev/production origins (`http://localhost:4200`, and the compose-served app origin). No `*`.
- Allowed methods: **`GET`, `HEAD`, `OPTIONS`** only. CORS is *not* authorization, but restricting methods is defence in depth: even a mistakenly granted write permission is not exercisable cross-origin from a browser context.
- Allowed headers: `Content-Type`, `Accept`, `Origin`. No custom auth headers, because no credential is sent.
- **No `Authorization` header, no credentials mode, no cookies** are used by the front end; therefore no `Access-Control-Allow-Credentials`.
- Preflight from a non-allowlisted origin must not receive `Access-Control-Allow-Origin`.

### 4.4 `.env` and secret hygiene

- `backend/.env` is **gitignored**; `backend/.env.example` ships **placeholder** values only: `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY`, database credentials, and `PUBLIC_URL`/`APP_URL` — all obviously non-production (`change-me-...`).
- `docker-compose.yml` consumes environment variables; no literal secret is committed there.
- `frontend/src/environments/*` contains **only** `apiBaseUrl` (and, if needed, `countryDefault`). It must never contain `apiToken`, `token`, `secret`, `adminUrl`, `Bearer`, or any credential-shaped key.
- No API token is created in the admin panel for this project; if one is temporarily created for debugging, it is deleted and **never** committed or pasted into an issue/session log.
- All seed data is strictly fictitious (no real identity documents, plates, names, or addresses), consistent with §4.3 and §5.

### 4.5 Consequences

**Good**

- The browser holds **no credential at all**; S1 is satisfied structurally, and there is nothing to rotate, leak, or accidentally widen.
- The public API is exactly three read-only resources — small enough to enumerate in a README and to assert in E2E.
- Draft/publish staging stays safe: editors can draft freely without publishing to the public API (S5).
- Posture is reproducible across machines and CI because it is code, not clicks (S3).
- Zero extra services; `docker compose up` remains the single command (S7, S10).

**Bad / accepted trade-offs**

- Anyone who can reach the Strapi port can read the catalogue. Accepted: the content is public by design and carries no personal data (S4). In production this is fronted by a CDN/reverse proxy with rate limiting.
- No per-request client restriction (any origin *outside* a browser, e.g. `curl`, can read). Accepted: not a requirement, and unachievable without a BFF — see §8.3.
- The bootstrap revocation step must be maintained as new content types appear; the "deny everything else" rule mitigates carelessness but requires the allowlist to stay intentional.
- Scraping/abuse protection is not built in; it is deferred to hosting (§8.4).

### 4.6 Verification checks (must all pass; candidate E2E/CI assertions)

| # | Check | Command | Expected |
| --- | --- | --- | --- |
| V1 | Public read works | `curl -i "http://localhost:1337/api/form-fields?filters[country][$eq]=CO&sort=order:asc"` | `200`, flattened `data[]`, all rows `country: "CO"` |
| V2 | Public read works (plans, filtered) | `curl -i "http://localhost:1337/api/insurance-plans?filters[country][$eq]=CL&filters[active][$eq]=true&sort=order:asc"` | `200`, only active `CL` plans |
| V3 | Public read works (config) | `curl -i "http://localhost:1337/api/country-configs?filters[country][$eq]=CO"` | `200`, exactly one record |
| V4 | **Create denied** | `curl -i -X POST http://localhost:1337/api/form-fields -H "Content-Type: application/json" -d '{"data":{"key":"hack"}}'` | `401` **or** `403`, never `2xx` |
| V5 | **Update denied** | `curl -i -X PUT http://localhost:1337/api/insurance-plans/1 -H "Content-Type: application/json" -d '{"data":{"name":"x"}}'` | `401`/`403` |
| V6 | **Delete denied** | `curl -i -X DELETE http://localhost:1337/api/country-configs/1` | `401`/`403` |
| V7 | Users not exposed | `curl -i http://localhost:1337/api/users` | `401`/`403` |
| V8 | Auth plugin not exposed | `curl -i -X POST http://localhost:1337/api/auth/local/register -H "Content-Type: application/json" -d '{"username":"a","email":"a@b.c","password":"x"}'` | `403` |
| V9 | Drafts not leaked | publish a draft-only field in admin, then `GET /api/form-fields` | draft never appears |
| V10 | No token in bundle | grep built output and `frontend/src` for `Bearer`, `apiToken`, `api_token`, `Authorization` | zero matches |
| V11 | No auth header on the wire | DevTools Network on `/co/quote` | `GET` requests carry no `Authorization` header |
| V12 | CORS allowlist | `curl -i -H "Origin: http://evil.test" http://localhost:1337/api/form-fields` | no `Access-Control-Allow-Origin` for that origin |
| V13 | Secrets not committed | `git ls-files` contains no `.env`; `git log -p -- backend/.env` empty | pass |
| V14 | Idempotency | restart the stack twice | no duplicate fields/plans/configs; permission set unchanged |

V4–V6 and V7 are the acceptance-level proof of S1/S2 and should be automated (script or Playwright/API test) rather than performed manually once.

---

## 5. Pros and Cons of the Options (consolidated)

| Criterion | A. Public read-only, no token | B. Read-only token in bundle | C. BFF proxy |
| --- | --- | --- | --- |
| Write credential exposed to browser | **Never** | No (read-only) but a credential is exposed | Never |
| Credential rotatable without redeploy | **N/A (no credential)** | No | Yes |
| Permission list auditable in one place | **Yes (code)** | No (admin UI drift) | Yes, but duplicated |
| Extra service to operate | **None** | None | Yes (+ secrets) |
| Reproducible via `docker compose up` | **Yes** | Partially (token generation is manual) | Partially |
| Draft isolation | **Native** | Native | Must be re-implemented |
| Attack surface growth over time | **Bounded by code review** | Silent scope creep | Bounded but duplicated |
| Fits MVP envelope (`AGENTS.md` §1) | **Yes** | Yes | No |
| Verdict | **Chosen** | Rejected | Rejected for Phase 1; revisit if protected/user-specific data appears |

---

## 6. Traceability

| Requirement | Source | Addressed by |
| --- | --- | --- |
| No write/admin/API token with write permissions in the browser | `AGENTS.md` §4.3 | §4.1 (no tokens issued), §4.4 |
| Public role only `find`/`findOne` on required types; zero C/U/D | `AGENTS.md` §4.3; `strapi-multi-country` §4 | §4.1 matrix, §4.2 revocation |
| Permission config is programmatic/idempotent | `strapi-multi-country` §4; `AGENTS.md` §4.2 | §4.2, §4.6 V14 |
| Idempotent seed without external credential | `strapi-multi-country` §3 | §4.2 step 4 |
| Front end reads only public catalogue data | US-01 AC1/AC3, US-02 AC1, US-03 AC2 | §4.1 allowlist |
| No backend persistence of quotes → no public write path needed | `AGENTS.md` §4.1 | §4.1 (all C/U/D denied) |
| No committed secrets, fictitious data only | `AGENTS.md` §4.3, §5 | §4.4, §4.6 V13 |
| Unauthenticated `POST` returns `401`/`403` | `AGENTS.md` §4.3; skill §5 | §4.6 V4–V6 |
| CORS limited to the app origin | `AGENTS.md` §1, §4.3 | §4.3 |
| Single-command startup preserved | `AGENTS.md` §1 | §4.5, Option C cons |

---

## 7. Links

- [`docs/adrs/ADR-001-multi-country-content-strategy.md`](./ADR-001-multi-country-content-strategy.md) — content model that this permission matrix protects
- [`docs/adrs/ADR-003-frontend-persistence-and-sdd-workflow.md`](./ADR-003-frontend-persistence-and-sdd-workflow.md) — why no quote data needs a server at all
- [`docs/user-stories/US-01.md`](../user-stories/US-01.md), [`US-02.md`](../user-stories/US-02.md), [`US-03.md`](../user-stories/US-03.md)
- [`.opencode/skills/strapi-multi-country/SKILL.md`](../../.opencode/skills/strapi-multi-country/SKILL.md) §4, §5
- [`AGENTS.md`](../../AGENTS.md) §4.1, §4.2, §4.3

---

## 8. Open Questions for Checkpoint 2

1. **Absolute "no token ever" reading:** this ADR interprets §4.3 as *no API token in the browser at all*, not merely "none with write permissions". Confirm that even a read-only token is considered a violation (recommended: yes — it is unrotatable without redeploy and adds no real protection).
2. **Exposing `country-config` publicly:** the full legal text becomes world-readable via `GET /api/country-configs`. It is intended to be shown verbatim in the UI (US-03 AC2), so this is accepted — confirm no jurisdiction requires gating terms behind an interstitial.
3. **BFF proxy trigger:** agree the condition that would justify revisiting Option C (e.g. introduction of protected content, per-user quotes, or aggregation needs), so the decision is revisited deliberately rather than by accident.
4. **Rate limiting:** confirm whether Phase 1 adds Strapi/proxy rate limiting on the three public endpoints, or defers it to the hosting layer (recommended: defer, document in `README.md`).
5. **Admin credentials:** confirm that `docker compose` seeds the admin user via env vars (never committed) and that admin credentials are not printed in logs or session logs in `docs/session-logs/`.
