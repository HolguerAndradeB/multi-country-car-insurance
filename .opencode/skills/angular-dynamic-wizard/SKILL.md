---
name: angular-dynamic-wizard
description: Standards and implementation patterns for Angular 21+ standalone components, signals, typed dynamic reactive forms from Strapi metadata, multi-country formatting, front-end persistence, keyboard accessibility, and testing. Use whenever building or modifying Angular components, services, forms, or tests.
license: MIT
compatibility: opencode
metadata:
  domain: frontend
  stack: angular-21
---

# Angular 21+ Dynamic Multi-Country Wizard Conventions

Use this skill for all front-end implementation and testing work under `frontend/`.

## 1. Modern Angular 21+ Architecture Rules

- **Zero NgModules:** Every component, directive, and pipe must be standalone (`standalone: true` is default in Angular 19+/21, omit or keep explicit, never declare `NgModule`).
- **OnPush everywhere:** Set `changeDetection: ChangeDetectionStrategy.OnPush` on every component.
- **Signals & Built-in Control Flow:**
  - Store state in `signal()` and derive view data with `computed()`.
  - Use `input()` / `output()` signal APIs instead of `@Input()` / `@Output()` decorators.
  - Use `inject()` instead of constructor dependency injection.
  - Use `@if`, `@else`, `@for (item of list(); track item.id)`, and `@switch`. Never use `*ngIf` or `*ngFor`.
- **Strict TypeScript:** Never use `any`. Model every Strapi entity, validation rule, form value, plan, and quote state explicitly.

## 2. Typed Dynamic Form Factory (Step 1)

Map Strapi `FormFieldConfig[]` dynamically to Reactive Forms:
- Supported Strapi types: `text`, `number`, `select`, `date`, `checkbox`.
- Sort fields strictly by `order` ascending before building controls and rendering.
- Build a typed `FormGroup<Record<string, AbstractControl>>` dynamically from Strapi metadata:
  - Attach `Validators.required` (or `Validators.requiredTrue` for required checkboxes) when `field.required === true`.
  - Attach `Validators.minLength`, `Validators.maxLength`, `Validators.min`, `Validators.max`, `Validators.pattern` from `field.validations`.
  - Attach domain validators when specified by `validations.rule`:
    - `legalAge`: birth date must verify age >= 18 years as of today.
    - `vehicleYear`: integer year must satisfy `currentYear - 20 <= year <= currentYear + 1`.
    - `clRut` (optional check digit / format): validate Chilean RUT format if configured.
- Render the Strapi-provided `errorMessage` next to the invalid field once touched or submitted, and block advancing to Step 2 while the form is invalid.
- Never hardcode country field definitions in Angular components; changing or adding a published field in Strapi and reloading the page must render it immediately.

## 3. Multi-Country Context, Persistence & Simulated Logic

- **Single build, runtime country context:** Support switching or routing between `CO` (Colombia) and `CL` (Chile) cleanly without duplicating components.
- **Front-end persistence:** Persist step data, selected country, and chosen plan in `sessionStorage` / `localStorage` scoped by country key so going back from Step 2 or Step 3 preserves user entries, and reloading recovers in-progress data safely.
- **Currency & Locale formatting:** Use `Intl.NumberFormat`:
  - `CO`: `es-CO`, `COP`, `maximumFractionDigits: 0`
  - `CL`: `es-CL`, `CLP`, `maximumFractionDigits: 0`
- **Document masking (Step 3):** Mask identity document numbers partially (e.g., show only last 4 characters prefixed with `*`, or preserve formatting safely while hiding leading digits).
- **Simulated price adjustment & payment:**
  - Document the simulated price adjustment formula clearly (e.g., vehicle age factor applied to `basePrice`).
  - Disable the Pay button until country-specific Strapi `termsAndConditions` are accepted.
  - Lock the Pay button immediately on click (`isSubmitting` signal) to prevent double submission.
  - Support simulated failure + retry without losing any entered data or selected plan.

## 4. Accessibility & Responsive UI Rules

- **Keyboard-only navigation:** Every control, country switcher, plan card radio/button, terms checkbox, back/next button, and retry action must be reachable via `Tab` and activatable via `Enter`/`Space`.
- **Semantic HTML & ARIA:**
  - Use `<label [for]="field.key">` for every input/select/checkbox.
  - Bind `[attr.aria-invalid]="isInvalid(field.key)"`.
  - Bind `[attr.aria-describedby]="describedByIds(field)"` referencing help text and error message IDs (`role="alert"` or `aria-live="polite"` on error messages).
  - Never use clickable `<div>`s where `<button>` or `<input type="radio">` belongs.
- **Responsive design:** Mobile-first CSS Grid / Flexbox layout verified at `375px` and `1280px`.

## 5. Testing Standards

- **Unit tests (`*.spec.ts`):** Test dynamic form builder validators (required, pattern, vehicleYear, legalAge), currency formatter, partial document masking, simulated price calculation, and front-end persistence store.
- **E2E tests:** Include at least one full-flow end-to-end test covering Step 1 → Step 2 → Step 3 → Simulated Payment confirmation for a country, plus keyboard/validation assertions.
