# Global Agent Context — Multi-Country Car Insurance Wizard

This file governs all AI agents, subagents, and automated skills operating in this repository. Every artifact produced must comply with these conventions.

---

## 1. Project Mission

Build a **single-build, multi-country car insurance quoting wizard** serving **Colombia (`CO`)** and **Chile (`CL`)** with:
- **Front end:** Angular 21+ (single application and single build for both countries).
- **Content backend:** Strapi 5+ (100% business-configurable form fields, plans, coverages, benefits, and legal terms per country without requiring a front-end redeployment).
- **Environment:** Single-command local startup (`docker compose up`) with idempotent seed data for both Colombia and Chile.

---

## 2. Methodology: Lightweight Custom SDD (No External Framework)

We follow a custom **Spec-Driven Development (SDD)** workflow without external SDD frameworks (such as Spec Kit or Kiro) so that every artifact remains transparent, concise, and strictly aligned with traceability requirements.

### Mandatory Traceability Chain
Every increment must follow and link this chain:

`User Story (docs/user-stories/US-XX.md)` → `Spec (specs/US-XX-*.md)` → `ADR (docs/adrs/ADR-XXX-*.md)` → `Code (backend/ & frontend/)` → `Tests (unit + E2E)` → `Code Review (docs/reviews/US-XX-review.md)` → `Fix commits`

---

## 3. Hybrid Tooling Model

- **Antigravity:** Planning, multi-step orchestration, human-in-the-loop checkpoints, and interactive/visual browser verification (accessibility, keyboard-only navigation, mobile/desktop responsiveness).
- **OpenCode (`opencode` CLI):** Versioned subagent definitions (`.opencode/agents/`), reusable custom skills (`.opencode/skills/`), focused agent execution, and unedited session log exports (`opencode session export` stored in `docs/session-logs/`).

### Subagent Roster & Ownership Boundaries

| Subagent | Role | Allowed Scope | Outputs |
| --- | --- | --- | --- |
| `spec-analyst` | Spec & ADR Analyst | `specs/`, `docs/adrs/` (no bash) | `specs/US-XX-*.md`, `docs/adrs/ADR-XXX-*.md` |
| `strapi-dev` | Strapi Backend Developer | `backend/`, Strapi Docker/env config | Content schemas, idempotent seed, Public role read-only permissions |
| `angular-dev` | Angular Front-End Developer | `frontend/` production source (no test suites) | Standalone components, signal stores, typed dynamic forms |
| `tester-dev` | Test Automation Developer | `frontend/src/**/*.spec.ts`, `frontend/e2e/**`, test configs | Unit tests, Playwright E2E tests, execution reports |
| `code-reviewer` | Independent Code Reviewer | `docs/reviews/` (read-only on app code) | `docs/reviews/US-XX-review.md` with severity-ranked findings |

---

## 4. Mandatory Technical Rules

### 4.1 Angular 21+ (`frontend/`)
- **Standalone components only** — NO `NgModule`s anywhere.
- **Signals-first reactivity** — `signal()`, `computed()`, `input()`, `output()`, and `effect()` (only when strictly needed).
- **Built-in control flow** — `@if`, `@for` (with explicit `track`), `@switch`; never use legacy `*ngIf`, `*ngFor`, `*ngSwitch`.
- **`ChangeDetectionStrategy.OnPush`** on all components.
- **`inject()` function** for dependency injection instead of constructor parameter injection.
- **Strict TypeScript** — zero `any`, explicit interfaces/types for Strapi payloads, dynamic form schemas, and wizard state.
- **State persistence** — persist wizard state strictly on the front end (`sessionStorage` or `localStorage`, scoped by country). No backend database for user quote submissions.
- **Simulated pricing & payment** — pricing adjustments and payment submission are simulated on the front end; never integrate real payment gateways or accept real card data.

### 4.2 Strapi 5+ (`backend/`)
- **Strapi 5 flattened REST format** — consume `data: [{ id, documentId, ...fields }]` directly (never Strapi v4 `.attributes` nesting).
- **Zero-redeploy configurability** — adding, removing, reordering, or modifying published form fields, select options, plans, or legal terms in Strapi must reflect immediately on reload in Angular without code changes.
- **Idempotent bootstrap seed** — `backend/src/index.ts` must populate realistic fictitious seed data for both `CO` and `CL` if missing, published (`status: 'published'`), without duplicating records across restarts.

### 4.3 Security (Non-Negotiable)
- **NEVER expose any Strapi write token, admin token, or API token with write permissions to the browser.**
- **Minimal Public Role permissions** — configure Strapi's `Public` role programmatically with ONLY `find` and `findOne` on strictly required read-only content types. Zero `create`, `update`, or `delete` permissions on `Public`.
- **NEVER commit real secrets, passwords, API keys, or real personal data** — use `.env` (gitignored) + `.env.example` with placeholders, and strictly fictitious user/vehicle data.

### 4.4 Accessibility, Localization & UX
- **Keyboard-only completion** — the entire wizard (country selection, Step 1, Step 2, Step 3, confirmation/retry) must be operable via keyboard alone (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Arrow` keys).
- **Accessible semantics** — every form control must have an explicit `<label for>`, `aria-invalid`, `aria-describedby` linking help text and validation errors, and visible `:focus-visible` outlines.
- **Responsive layout** — works cleanly on mobile (`375px`) and desktop (`1280px+`).
- **Explicit UI states** — every async view must handle `loading`, `empty`, and `error` states gracefully with retry options.

---

## 5. Language Policy

- **English:** All source code, identifiers, filenames, comments, `README.md`, `FLOW.md`, specs, ADRs, code review reports, and Git commit messages.
- **Localized Spanish (`es-CO` / `es-CL`):** All Strapi seed content and user-facing copy in the Angular app, adapted to each country's terminology (e.g., *cédula de ciudadanía / placa* in Colombia; *RUT / patente* in Chile) and currency formatting (`COP` / `CLP`).

---

## 6. Repository Structure

```text
.
├── AGENTS.md                     # Global conventions for all agents
├── FLOW.md                       # Agentic workflow documentation & Mermaid diagram
├── README.md                     # Setup, architecture overview & requirements checklist
├── docker-compose.yml            # Single-command startup (Strapi + Angular)
├── .opencode/
│   ├── agents/                   # Versioned subagent definitions
│   └── skills/                   # Versioned reusable domain skills
├── docs/
│   ├── user-stories/             # Input functional stories (US-01, US-02, US-03)
│   ├── adrs/                     # Architecture Decision Records (MADR format)
│   ├── reviews/                  # Code review findings and resolution logs
│   └── session-logs/             # Unedited agent session exports
├── specs/                        # SDD specifications per user story
├── backend/                      # Strapi 5+ project & seed logic
└── frontend/                     # Angular 21+ application & tests (unit + E2E)
```

---

## 7. Commit & Traceability Conventions

Use Conventional Commits referencing the relevant story, ADR, or review:
- `chore: ...` — repository, tooling, or environment setup
- `docs(adr): ADR-XXX ...` — architecture decision records
- `docs(spec): US-XX ...` — functional specifications
- `feat(US-XX): ...` — implementation and tests for a user story
- `fix(review-US-XX): ...` — fixes addressing code review findings
- `docs(flow): ...` — `FLOW.md`, `README.md`, and session logs

---

## 8. Human-in-the-Loop Checkpoints

No phase advances without explicit human approval at these checkpoints:
1. **Checkpoint 1 — Workflow & Rules:** Approve `AGENTS.md`, subagents, and custom skills before writing ADRs or application code.
2. **Checkpoint 2 — Architecture (ADRs):** Review and approve `ADR-001` (multi-country strategy), `ADR-002` (Strapi security & permissions), and `ADR-003` (front-end persistence & SDD tooling).
3. **Checkpoint 3 — Specs (`US-01`, `US-02`, `US-03`):** Review each spec, answer open questions / resolve gaps, and approve before implementation begins.
4. **Checkpoint 4 — Code Review & Verification:** Review `docs/reviews/US-XX-review.md`, verify fixes, and confirm UI/keyboard/E2E checks before marking the increment QA-ready.
