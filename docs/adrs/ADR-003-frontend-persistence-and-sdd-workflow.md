# ADR-003: Front-End Persistence Strategy and SDD / Hybrid Tooling Workflow

**Status:** Proposed (Awaiting Checkpoint 2 Human Approval)

**Date:** 2026-11-23

**Deciders:** Human project owner (Checkpoint 2), `spec-analyst` (author), `angular-dev`, `tester-dev`

**Consulted:** `.opencode/skills/angular-dynamic-wizard/SKILL.md` §3, §5; `AGENTS.md` §2, §3, §4.1, §4.4, §8; `ADR-001`

**Informed:** `strapi-dev`, `code-reviewer`

---

## 1. Context and Problem Statement

Two decisions are recorded here because both govern **how the project keeps its promises over time**, and both are cheap now but expensive to retrofit:

**Part 1 — Where does in-progress wizard state live?**
The wizard collects identity-document numbers, birth dates, plate numbers, and a chosen plan across three steps (US-01 → US-03). `AGENTS.md` §4.1 requires persistence **strictly on the front end**, scoped by country, with **no backend database for quote submissions**. US-01 AC4 requires data to survive back-navigation; US-01 AC3 explicitly normalises **reloading** the app; US-03 AC4 requires retry after a simulated payment failure **without losing information**. Simultaneously, the data is personal (document number, date of birth, plate) and must not be retained indefinitely on a shared laptop.

**Part 2 — Which development process and toolchain?**
`AGENTS.md` §2 mandates a *lightweight custom SDD* with a fixed traceability chain, and §3 mandates a *hybrid* Antigravity + OpenCode model with human checkpoints. Both are asserted in the constitution but not yet justified against the obvious alternatives (Spec Kit, Kiro, single-tool workflows). Without a recorded rationale, the first moment of friction ("let's just adopt framework X") erases the traceability guarantees.

**Out of scope:** server-side session handling (there is no server session), real payment data (simulated and never accepted), and cross-device continuity (not a requirement).

---

## 2. Decision Drivers

### Part 1 — Persistence

| # | Driver | Source |
| --- | --- | --- |
| P1 | **No backend persistence of quotes** — the browser is the system of record for a draft | `AGENTS.md` §4.1 |
| P2 | **Back-navigation preserves entries** (Step 2 → Step 1) | US-01 AC4 |
| P3 | **Reload does not destroy the draft** (the app is routinely reloaded to pick up Strapi changes) | US-01 AC3, `AGENTS.md` §4.2 |
| P4 | **Retry after simulated failure keeps all data** | US-03 AC4 |
| P5 | **PII minimisation / no indefinite retention** on a shared or borrowed device | `AGENTS.md` §4.3, §4.4 (privacy posture), US-03 (masking) |
| P6 | **Country isolation** — a `CO` draft must never surface under `CL` | `ADR-001` D4 |
| P7 | **Strapi metadata can change between reloads** — a persisted draft may reference a field or plan that no longer exists | US-01 AC3, US-02 AC1 |
| P8 | **Testability** of the store and of persistence behaviour in unit tests | `AGENTS.md` §2, `angular-dynamic-wizard` §5 |
| P9 | **Signals-first, OnPush, strict TypeScript** — the store must be a signal store, not an RxJS side-channel | `AGENTS.md` §4.1 |

### Part 2 — Process and tooling

| # | Driver | Source |
| --- | --- | --- |
| T1 | **Mandatory traceability chain** US → Spec → ADR → Code → Tests → Review → Fixes | `AGENTS.md` §2 |
| T2 | **Explicit human approval checkpoints** (4 of them) | `AGENTS.md` §8 |
| T3 | **Small artifact set** that a human actually reviews (3 stories, not 40 files) | `AGENTS.md` §2 |
| T4 | **Versioned, reusable agent definitions and domain skills** in git | `AGENTS.md` §3 |
| T5 | **Zero-cost execution** (free OpenCode models) with acceptable quality variance | `AGENTS.md` §3, §1 |
| T6 | **Auditability of agent work** — unedited session exports | `AGENTS.md` §3 |
| T7 | **Portability** — no lock-in to one IDE/vendor harness | `AGENTS.md` §3 |
| T8 | **Low ceremony for a 3-story increment**; onboarding cost near zero | `AGENTS.md` §2 |
| T9 | **Independent verification** separated from implementation (review, visual/a11y checks) | `AGENTS.md` §3, §4.4 |

---

## 3. Considered Options — Part 1: Front-End Persistence

### Option A — Country-scoped `sessionStorage` + Angular signal store (`WizardStore`) **(Recommended)**

A single `WizardStore` (signals + `computed`) holds the live draft in memory. A thin `WizardPersistenceService` mirrors the draft into `sessionStorage` under a versioned, country-scoped key (`wizard:state:v1:CO`), and rehydrates it on store initialisation. `sessionStorage` is per-tab and per-origin, cleared when the tab closes.

**Pros**

- **Satisfies P1 by construction:** nothing leaves the browser; there is no API call for a draft, so there is no public write path to secure (reinforces `ADR-002` §4.1: all `create`/`update`/`delete` denied).
- **P2 works with or without storage.** Back-navigation inside the SPA is served by the in-memory signal store; persistence is only the *reload* safety net. This separation keeps the common path fast and simple.
- **P3 satisfied** for the realistic reload scenarios (F5, hot reload, "reload to see a new Strapi field").
- **P5, the reason this option wins:** `sessionStorage` is **discarded when the tab/window closes**, so a draft cannot linger for weeks on a shared machine. A raw identity-document number and date of birth are exactly the data you do *not* want surviving a browser restart.
- **Tab isolation is a privacy feature:** two tabs (e.g. comparing `CO` and `CL`) do not overwrite each other, and a colleague opening a new tab does not inherit a draft from another workflow.
- **P6 is enforceable structurally:** the key embeds the country, so rehydration is `load(country)` and a `CL` route can never accidentally read a `CO` blob (and `ADR-001` keeps `country` in the URL, not in storage).
- **P8:** `WizardPersistenceService` sits behind a tiny interface, so unit tests inject a fake storage and assert serialise/rehydrate/TTL/clear without touching a real browser store.
- **P9:** the store is plain `signal()`/`computed()` with `OnPush` components; no state library needed.

**Cons**

- **Draft does not survive closing the browser** (tab close or full quit). Accepted: P3 asks for reload, not for cross-session resumption; and losing a draft is the *privacy-correct* default for this data.
- **Not shared across tabs.** Accepted: the wizard is a linear single-session task; cross-tab sync would require `storage` events and conflict resolution for no stated requirement.
- **Quota (~5 MB) and JSON serialisation.** A field map plus a plan id is a few KB; there is no attachment, no base64, no media. Non-issue, but the write path must still fail gracefully (see §4.5).
- **`sessionStorage` can throw** (Safari private mode, storage disabled, SSR). Must fall back to in-memory-only with a non-blocking notice, never crash the wizard.
- **Requires a schema version** so an old blob cannot be misparsed after the persisted shape changes (P7). Handled by `schemaVersion` + key version (`v1`) + discard-on-mismatch.

### Option B — `localStorage`

Same mechanism, persistent across browser restarts and shared between tabs.

**Pros**

- Survives tab close, browser restart, and crashes — maximum draft resilience.
- Shared across tabs, so a draft opened in a second tab is present.
- Slightly simpler mental model ("it's just saved").

**Cons**

- **Violates P5.** An identity-document number, birth date, and plate would persist **indefinitely** on a shared, borrowed, or demo machine, with no expiry unless we build one. That is precisely the retention risk the project's privacy posture (`AGENTS.md` §4.3, §4.4) tells us to avoid for data we are not required to keep.
- **Cross-country and cross-user bleed** on a shared device: a `CL` visitor on a kiosk inherits the previous visitor's stored `CO` draft unless every key is both country-scoped *and* explicitly cleared (P6 becomes a discipline, not a property).
- **Cross-tab write conflicts** (two tabs, one key, last-write-wins) require `storage`-event merging that adds real complexity for a linear wizard.
- **No natural end-of-life.** Every additional "clear on X" rule (payment success, country switch, logout-that-doesn't-exist) is a new bug surface.
- **Deployment/hard-refresh confusion:** a stale draft from a previous version of the field schema resurfaces after a deploy, producing "phantom fields" that no longer exist in Strapi (P7) — the worst possible failure for a "content changes without redeploy" system.

### Option C — In-memory signals only

`WizardStore` lives entirely in memory; nothing is serialised.

**Pros**

- **Best possible privacy:** nothing at rest, nothing to leak, no key, no version, no TTL, no storage API to feature-detect.
- Simplest possible implementation and testing story (pure store, zero I/O).
- Impossible to have stale or cross-country persisted state.

**Cons**

- **Fails P3.** Any reload — F5, hot reload, or the reload that US-01 AC3 explicitly relies on to pick up new Strapi fields — wipes the draft. A user who reloads after seeing a new field loses everything they typed.
- **Fails P4 in practice.** A simulated payment failure that coincides with a reload (or a user "refreshing to retry") loses the plan selection and all data.
- **Breaks the reasonable expectation set by US-01 AC4,** generalised: users treat a wizard as resumable within a session.
- **Weaker E2E:** the browser-navigation-based full-flow test cannot verify recovery behaviour at all, and the "reload shows the new field" acceptance criterion becomes untestable in a realistic way.

### Part 1 decision

**Chosen: Option A — country-scoped `sessionStorage` (`wizard:state:v1:<CO|CL>`) + `WizardStore` signal store**, with an explicit TTL, versioning, and a defined clearing policy.

---

## 4. Decision Outcome — Part 1

### 4.1 Architectural split (why this is not "just a storage call")

```
Component (OnPush, inject()) ──reads/writes──▶ WizardStore (signals) ──mirrors──▶ WizardPersistenceService
                                                    │                                   │
                                              source of truth                    sessionStorage
                                              for the whole SPA                  wizard:state:v1:CO
```

- **In-SPA navigation (back/next) never touches storage.** The store is authoritative; this is what makes US-01 AC4 a trivially correct behaviour rather than a serialisation exercise.
- **Storage is a recoverable snapshot**, written on meaningful change (debounced/step-boundary) and read exactly once on store initialisation for the active country.
- **`country` is *not* restored from storage.** It comes from the route (`ADR-001` §4.2). Storage is indexed *by* country so that a `CL` session can never hydrate a `CO` draft.

### 4.2 Persisted contract (typed, versioned)

```ts
export type CountryCode = 'CO' | 'CL';
export type WizardStep = 'policyholder' | 'plans' | 'summary';

export type FormValue = string | number | boolean | null;

export interface PersistedWizardStateV1 {
  /** Bumped whenever the shape below changes; mismatches are discarded, never migrated silently. */
  readonly schemaVersion: 1;
  readonly country: CountryCode;
  /** ISO-8601 instant of the last write; the basis for TTL expiry. */
  readonly savedAt: string;
  readonly step: WizardStep;
  /** Raw Step 1 values keyed by Strapi `form-field.key`; revalidated on rehydration. */
  readonly step1: Readonly<Record<string, FormValue>>;
  /** Strapi 5 documentId of the chosen plan, or null. */
  readonly selectedPlanDocumentId: string | null;
}

export interface WizardPersistence {
  load(country: CountryCode): PersistedWizardStateV1 | null;
  save(state: PersistedWizardStateV1): void;
  clear(country: CountryCode): void;
}
```

**Explicitly NOT persisted** (deliberate omissions, each one a decision):

| Not persisted | Why |
| --- | --- |
| `termsAccepted` | Consent must be given by the human in the current session; auto-restoring consent would fabricate legal acceptance (US-03 AC2). |
| `isSubmitting` / payment status / quote number | Transient; a restored "in-flight" payment is meaningless. On reload the payment state resets to `idle`. |
| Card / payment fields | Never collected: payment is simulated (`AGENTS.md` §4.1). Zero card data exists in the model. |
| Server-returned catalogue (fields, plans, terms) | Strapi is the only source; caching catalogue data in storage would break US-01 AC3 (new field on reload) and risk stale legal text (P7). |
| `country` as an authoritative input | Route is the source of truth (P6, `ADR-001`). |

### 4.3 Reload / restore behaviour matrix

| Scenario | Expected behaviour | Reason |
| --- | --- | --- |
| Reload on **Step 1** | Draft restored; validators re-run; controls render from **fresh** Strapi metadata | P3, P7 |
| Reload on **Step 2** | Step 1 restored **and revalidated**; plans re-fetched; if the stored `selectedPlanDocumentId` is missing/inactive/unpublished → selection cleared + explicit notice | P7, US-02 AC1/AC4 |
| Reload on **Step 3** | Steps 1–2 restored; **terms checkbox reset to unchecked**; Pay re-disabled | US-03 AC2 |
| Draft older than **TTL** (proposed 2 h idle) | Discarded; wizard starts clean at Step 1; no error shown | P5 |
| Draft `schemaVersion` mismatch | Discarded silently (dev-logged); clean start | P7 |
| Draft `country` ≠ route country | Ignored; never hydrated | P6 |
| Draft references a **removed field key** | Unknown keys dropped; known keys kept | P7, US-01 AC3 |
| Draft missing a **newly required field** | Field rendered empty and blocking; user completes it | US-01 AC2, AC3 |
| Draft with an **invalid value** under new validations | Field marked invalid with the Strapi `errorMessage`; advancing blocked | US-01 AC2 |
| `sessionStorage` unavailable/throwing | In-memory only; wizard fully functional; no crash | resilience |
| New tab | Clean start for that country (no cross-tab bleed) | P5 |
| Successful simulated payment | Draft cleared for that country after confirmation is shown | P5, "cannot be submitted twice" (US-03) |
| Country switch via header | Previous country's draft retained under **its own** key; new country starts clean (or restores its own draft) | P6, `ADR-001` |

### 4.4 Clearing policy (single, auditable list)

Clear `wizard:state:v1:<country>` when:
1. the simulated payment reaches the confirmation state (`US-03`), or
2. the TTL has elapsed, or
3. `schemaVersion` does not match, or
4. the stored `country` does not match the key/route (corrupt or foreign blob), or
5. the user explicitly restarts the quote (a "start over" affordance, if provided).

Never cleared automatically when the user merely navigates backwards — that would defeat US-01 AC4.

### 4.5 Consequences

**Good**

- Quote data never touches a server (P1) and never outlives the browsing session (P5), which is a stronger privacy posture than `localStorage` with a hand-rolled expiry.
- Back-navigation is instant and storage-independent; reload recovery is a bounded, well-specified behaviour with a test matrix (§4.3) rather than an accident.
- Country isolation is structural (key + route), not a convention (P6).
- Stale-metadata hazards from Strapi edits (P7) have explicit, user-visible handling instead of phantom fields.
- The store is a pure signal store, unit-testable with a fake `WizardPersistence` (P8, P9).

**Bad / accepted trade-offs**

- A user who closes the tab mid-quote loses the draft. Accepted: matches `sessionStorage` semantics and the privacy requirement, and is a documented, testable behaviour.
- The wizard must tolerate a partially restored draft; the rehydration path is real logic that needs unit tests (field dropped, field added, plan gone, terms reset).
- The TTL is a product-tunable number (proposed 2 h); changing it changes only a constant, not the design.
- If the business later wants "resume my quote tomorrow", that would require `localStorage` **plus** an explicit consent checkbox **plus** an expiry UI — a deliberate future ADR, not an implicit change.

### 4.6 Confirmation (Part 1)

| # | Check | Method | Pass criteria |
| --- | --- | --- | --- |
| F1 | Back-navigation keeps data (US-01 AC4) | E2E: fill Step 1 → Step 2 → back | all values still present |
| F2 | Reload restores draft | E2E: fill Step 1, `page.reload()` | values restored |
| F3 | No server write | DevTools: only `GET`s to `/api/...`; `ADR-002` V4–V6 | zero non-GET requests |
| F4 | Terms not restored | E2E: accept terms, reload on summary | checkbox unchecked, Pay disabled |
| F5 | Plan disappeared | Unit: rehydrate with unknown `selectedPlanDocumentId` | selection `null` + notice flag |
| F6 | Country isolation | Unit: save `CO`, `load('CL')` | `null` |
| F7 | TTL expiry | Unit: `savedAt` older than TTL | `load` returns `null`, key removed |
| F8 | Schema version mismatch | Unit: `schemaVersion: 0` | discarded |
| F9 | Storage unavailable | Unit: fake storage throws | no exception; store works in memory |
| F10 | Cleared after payment | E2E: complete simulated payment, assert storage key removed | absent |
| F11 | No PII beyond the session | Manual: complete a quote, close tab, reopen `/co/quote` | clean Step 1 |

---

## 5. Considered Options — Part 2: SDD & Tooling

### 5.1 Process: custom lightweight SDD vs Spec Kit vs Kiro

#### Option A — Custom lightweight SDD (fixed 4-document chain in `AGENTS.md`) **(Recommended)**

`US-XX.md` → `specs/US-XX-*.md` → `docs/adrs/ADR-XXX-*.md` → code → tests → `docs/reviews/US-XX-review.md` → fix commits, with four human checkpoints (§8).

**Pros**

- **Exactly the required chain (T1),** with no translation layer: the constitution *is* the process, so a reviewer can follow one link at a time.
- **Small artifact set (T3):** three specs, three ADRs, three reviews — reviewable in one sitting by one human, which is what makes Checkpoint 3 real rather than ceremonial.
- **Checkpoints are first-class (T2):** each phase has a named gate and a status string (`Proposed (Awaiting Checkpoint 2 Human Approval)`) that code can be held behind.
- **No dependency, no version churn, no lock-in (T7).** Nothing to upgrade mid-project; nothing that can change the file layout under us.
- **Git-native (T6):** every artifact is markdown in the repo, so session logs, specs, and reviews are diffable and auditable together.
- **Onboarding is a single file (T8):** a new agent or human reads `AGENTS.md` and knows the whole process.

**Cons**

- **We own the discipline.** Nothing mechanically enforces that a spec exists before code; skipping is possible (mitigated by the spec-analyst checklist, review gate, and commit conventions).
- **No built-in validators** for spec completeness or traceability links (mitigated by the mandatory checklist and the review's severity findings).
- **Templates are informal** and can drift in shape between stories (mitigated by keeping them in `AGENTS.md`/skills rather than ad hoc).

#### Option B — Spec Kit (GitHub's spec-driven toolkit)

Scaffolds `.specify/` with commands/templates for `specify → plan → tasks → implement`.

**Pros**

- Mature templates and a well-known vocabulary; fast first draft of a spec.
- Built-in task decomposition (`tasks.md`) that some teams find useful for parallel work.
- Community momentum and examples; opinionated structure reduces "blank page" friction.

**Cons**

- **Duplicates and competes with our chain (T1):** it introduces `spec.md`/`plan.md`/`tasks.md`/`research.md`, so the ADR layer and the review layer become either mapped awkwardly onto theirs or kept in parallel — the traceability chain gains a translation step.
- **Scaffolding overhead for 3 stories (T3, T8):** dozens of template/command files and a workflow ceremony disproportionate to a small increment; more surface for humans to read than value returned.
- **Justification not needed by the brief:** the requirement mentions the framework only as a rejected alternative; adopting it adds tooling risk and version churn (T7).
- **Task files become a second backlog** that drifts from the human checkpoints, weakening T2.

#### Option C — Kiro (IDE-integrated spec-driven agent)

Requirements/design/tasks triad handled by a dedicated agentic IDE.

**Pros**

- Tight integration: requirements → design → tasks → code inside one harness.
- Strong guided flow for a single developer; less manual prompt engineering.
- Good at generating consistent, structured artifacts quickly.

**Cons**

- **Vendor/harness lock-in (T7):** the workflow lives inside one IDE; the project's hybrid Antigravity + OpenCode split cannot be reproduced, and artifacts are shaped by that harness rather than by our traceability chain.
- **Its triad overlaps our US/ADR/Spec layering (T1)** without the ADR-as-decision-record and review-as-gate concepts, so decisions and findings still need a home.
- **Compatibility with versioned `.opencode/` agents and skills (T4)** is at best manual.
- **Harder to satisfy the human-in-the-loop checkpoint model (T2)** when the tool wants to run the whole flow end to end.

### 5.2 Tooling: Hybrid Antigravity + OpenCode vs single-tool

#### Option A — Hybrid: Antigravity (orchestration, checkpoints, visual verification) + OpenCode (versioned agents/skills, focused execution, session export) **(Recommended)**

**Pros**

- **Separation of duties (T9):** the orchestrating agent plans and verifies; execution happens in narrowly-scoped subagents whose allowed paths are declared (`AGENTS.md` §3 table). An independent `code-reviewer` is structurally not the author.
- **Agent definitions and skills are versioned in git (T4)** in `.opencode/agents/` and `.opencode/skills/`, so domain knowledge (Strapi 5 flattened responses, Angular signals, Public-role security) is reviewable and reusable rather than lost in chat history.
- **Zero-cost execution (T5):** free OpenCode models keep the whole loop free; the paid/high-capability work is human judgement at checkpoints.
- **Auditability (T6):** `opencode session export` into `docs/session-logs/` produces unedited transcripts alongside specs and reviews — the evidence trail the chain requires.
- **Checkpoints stay human (T2):** Antigravity drives the gate-and-approve loop; no subagent can approve its own phase.
- **Best tool per job:** interactive browser verification of keyboard-only flow, `aria-describedby` wiring, and 375 px / 1280 px layouts needs a visual harness — exactly what Antigravity provides — not a terminal agent.

**Cons**

- **Two places to keep in sync.** Instructions exist in `AGENTS.md`, `.opencode/agents/`, and `.opencode/skills/`; divergence is a real risk. Mitigation: `AGENTS.md` is the single source of truth, and skills must *reference* it rather than restate conflicting rules; review checks for contradictions.
- **Free models vary in quality (T5),** so more of the correctness burden lands on the checklists, tests, and review gate. Mitigation: narrow scopes per subagent, deterministic seeds/tests, mandatory review.
- **Session-log hygiene:** exported logs could capture secrets or real data. Mitigation: `.gitignore` for local env, fictitious seed data only, and a review step before commit (`ADR-002` §8.5).
- **More moving parts to document** (`FLOW.md`, `README.md`) than a single-tool setup.

#### Option B — Antigravity only (single tool, no OpenCode)

**Pros**

- One harness, one instruction surface, no cross-tool drift.
- Simplest mental model and lowest setup cost.
- No session-export plumbing.

**Cons**

- **Loses the versioned, reusable, reviewable agent/skill layer (T4)** — domain rules live in prompts rather than in git.
- **Weakens independence (T9):** the same session that plans also implements, with no path-scoped boundaries as a backstop.
- **Reduced auditability (T6)** without the export convention.
- Concentrates capability in one vendor (T7).

#### Option C — OpenCode only (terminal subagents, no visual harness)

**Pros**

- Fast, scriptable, fully versioned, cheap (T4, T5).
- Excellent for bounded file-scoped work (schemas, seeds, stores, tests).

**Cons**

- **No adequate visual/keyboard verification (T9, `AGENTS.md` §4.4)**: keyboard-only completion, focus-visible outlines, and 375 px layouts must be observed, not inferred from code.
- Human checkpoints become harder to stage as reviewable gates (T2).
- Reviewers lose an independent visual confirmation before Checkpoint 4.

### Part 2 decision

**Chosen: Option A (custom lightweight SDD) and Option A (hybrid Antigravity + OpenCode).**

---

## 6. Consequences — Part 2

**Good**

- One traceability chain, one constitution, four checkpoints — auditable from story to fix commit.
- Domain knowledge is versioned and reusable; every future story inherits the same Strapi/Angular/security rules.
- Execution is free and scoped; verification is independent and visual.
- Every decision and finding has a durable, diffable home in git.

**Bad / accepted trade-offs**

- Discipline, not tooling, enforces spec-before-code. Accepted: human checkpoints exist precisely because automation cannot gate intent.
- Three instruction surfaces must be kept consistent; an inconsistency is a legitimate review finding.
- Free-model variance means tests, seeds, and review carry more weight than usual.
- Vendor neutrality is preserved at the cost of manual plumbing (`FLOW.md`, exports, subagent defs).

### Confirmation (Part 2)

| # | Check | Method | Pass criteria |
| --- | --- | --- | --- |
| G1 | Chain is complete per story | Repo inspection | `US-XX` → `specs/US-XX-*` → ADRs → code → tests → `docs/reviews/US-XX-review.md` all present and linked |
| G2 | Checkpoints honoured | ADR/spec status strings + `FLOW.md` | no implementation before Checkpoint 3 approval |
| G3 | Agents/skills versioned | `.opencode/agents/`, `.opencode/skills/` in git | present, English, consistent with `AGENTS.md` |
| G4 | Session logs archived | `docs/session-logs/` | export per story, unedited |
| G5 | Conventional commits | `git log` | `docs(adr):`, `docs(spec):`, `feat(US-XX):`, `fix(review-US-XX):` used correctly |
| G6 | Visual/a11y gate | Antigravity walkthrough at Checkpoint 4 | keyboard-only flow, focus visible, 375/1280 px |
| G7 | No contradiction | `AGENTS.md` vs `.opencode/**` review | skills reference, never contradict, the constitution |

---

## 7. Traceability

| Requirement | Source | Addressed by |
| --- | --- | --- |
| Persistence strictly front-end, no quote DB | `AGENTS.md` §4.1 | §3-A, §4.1, F3 |
| Country-scoped persistence | `AGENTS.md` §4.1; `ADR-001` D4 | §4.2, F6 |
| "Keep data when going back" | US-01 AC4 | §4.1 (in-memory authority), F1 |
| Reload shows new Strapi field without losing data | US-01 AC3 | §4.3 (Step 1 restore + revalidation), F2 |
| Retry without losing information | US-03 AC4 | §4.3 (plan revalidation, terms reset only) |
| Partial document masking on summary | US-03 BR | §4.2 (masking applied at render, not stored) |
| Payment cannot be submitted twice | US-03 BR | §4.2 (`isSubmitting` transient), §4.4 clearing |
| Custom lightweight SDD, no external framework | `AGENTS.md` §2 | §5.1-A |
| Hybrid Antigravity + OpenCode, free models, versioned agents/skills, session exports | `AGENTS.md` §3 | §5.2-A, G3, G4 |
| Four human checkpoints | `AGENTS.md` §8 | §5.1-A, G2 |
| English artifacts, Spanish UI copy | `AGENTS.md` §5 | all documents |

---

## 8. Links

- [`docs/adrs/ADR-001-multi-country-content-strategy.md`](./ADR-001-multi-country-content-strategy.md) — route-based country context that storage must not duplicate
- [`docs/adrs/ADR-002-strapi-security-and-permissions.md`](./ADR-002-strapi-security-and-permissions.md) — why no quote write path exists
- [`docs/user-stories/US-01.md`](../user-stories/US-01.md), [`US-02.md`](../user-stories/US-02.md), [`US-03.md`](../user-stories/US-03.md)
- [`.opencode/skills/angular-dynamic-wizard/SKILL.md`](../../.opencode/skills/angular-dynamic-wizard/SKILL.md) §3, §5
- [`AGENTS.md`](../../AGENTS.md) §2, §3, §4.1, §4.4, §8

---

## 9. Open Questions for Checkpoint 2

1. **TTL value:** confirm the proposed **2-hour idle** expiry for `sessionStorage` drafts (or "no TTL, session lifetime only").
2. **"Start over" affordance:** is an explicit restart action required in the UI? It affects the clearing policy (§4.4 item 5) and needs a confirmation step for accessibility.
3. **Tab-close warning:** do we add a `beforeunload` prompt while a draft exists? Recommended: **no** (hostile UX, unreliable, and reload robustness makes it unnecessary) — confirm.
4. **Country switch and the draft:** confirm that switching `CO → CL → CO` should restore the `CO` draft (assumed) rather than discard it.
5. **Session-log contents:** confirm that exporting unedited sessions is approved given that prompts may quote seed data (strictly fictitious), and that no `.env` values may appear in logs.
6. **Review gate authority:** confirm that `code-reviewer` findings rated *blocker* must be resolved before Checkpoint 4 sign-off, making the review a real gate rather than advisory.
