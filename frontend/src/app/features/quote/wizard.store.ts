import { DestroyRef, Injectable, inject, isDevMode, signal, computed } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, debounceTime, firstValueFrom, forkJoin } from 'rxjs';

import { CatalogueApi } from '../../core/catalogue/catalogue.api';
import { CountryContextService } from '../../core/country/country-context.service';
import type {
  CatalogueStatus,
  CountryCode,
  CountryConfig,
  FormFieldConfig,
  FormValue,
  InsurancePlan,
  PersistedWizardStateV1,
  QuotedPlan,
  WizardFormGroup,
  WizardStep,
} from '../../core/models';
import { WizardPersistenceService } from '../../core/persistence/wizard-persistence.service';
import { calculateAdjustedPrice, formatCurrency, pickKeys } from '../../core/pricing/pricing.helper';
import { QuoteClock } from '../../core/pricing/quote-clock';
import { DynamicFormFactory, coerceDraftValue } from './dynamic-form.factory';

@Injectable({ providedIn: 'root' })
export class WizardStore {
  private readonly catalogue = inject(CatalogueApi);
  private readonly context = inject(CountryContextService);
  private readonly persistence = inject(WizardPersistenceService);
  private readonly factory = inject(DynamicFormFactory);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injectedClock = inject(QuoteClock);

  private readonly fieldsSignal = signal<readonly FormFieldConfig[]>([]);
  private readonly configSignal = signal<CountryConfig | null>(null);
  private readonly statusSignal = signal<CatalogueStatus>('idle');
  private readonly errorMessageSignal = signal<string | null>(null);
  private readonly formSignal = signal<WizardFormGroup | null>(null);
  private readonly submittedSignal = signal(false);
  private readonly restoredSignal = signal(false);
  private readonly selectedPlanSignal = signal<string | null>(null);
  private readonly activeCountrySignal = signal<CountryCode | null>(null);
  private readonly formRevision = signal(0);

  private readonly plansSignal = signal<readonly InsurancePlan[]>([]);
  private readonly plansStatusSignal = signal<CatalogueStatus>('idle');
  private readonly plansErrorSignal = signal<string | null>(null);
  private readonly invalidSelectionNoticeSignal = signal(false);
  private readonly restoredSelectionNoticeSignal = signal(false);
  private readonly restoredSelectionFromDraftSignal = signal(false);
  private readonly quoteClockSignal = signal<QuoteClock | null>(null);

  private changes: Subscription | null = null;
  private activeLoad: { readonly country: CountryCode; readonly promise: Promise<void> } | null = null;

  readonly fields = this.fieldsSignal.asReadonly();
  readonly countryConfig = this.configSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly errorMessage = this.errorMessageSignal.asReadonly();
  readonly form = this.formSignal.asReadonly();
  readonly submitted = this.submittedSignal.asReadonly();
  readonly restoredFromDraft = this.restoredSignal.asReadonly();
  readonly selectedPlanDocumentId = this.selectedPlanSignal.asReadonly();
  readonly plans = this.plansSignal.asReadonly();
  readonly plansStatus = this.plansStatusSignal.asReadonly();
  readonly plansError = this.plansErrorSignal.asReadonly();
  readonly invalidSelectionNotice = this.invalidSelectionNoticeSignal.asReadonly();
  readonly restoredSelectionNotice = this.restoredSelectionNoticeSignal.asReadonly();

  /** Recomputed on every form value/status change so Step 2 pricing never goes stale. */
  readonly step1Values = computed<Readonly<Record<string, FormValue>>>(() => {
    this.formRevision();
    const form = this.formSignal();
    if (!form) {
      return {};
    }

    const values: Record<string, FormValue> = {};
    for (const field of this.fieldsSignal()) {
      const control = form.controls[field.key];
      values[field.key] = control
        ? coerceDraftValue(field, control.value)
        : this.factory.defaultValue(field);
    }
    return values;
  });

  readonly quotedPlans = computed<readonly QuotedPlan[]>(() => {
    const pricingStep1 = pickKeys(this.step1Values(), this.fieldsSignal());
    const locale = this.context.locale();
    const currency = this.context.currency();
    const clock = this.quoteClockSignal() ?? this.injectedClock;

    return this.plansSignal().map((plan) => {
      const adjustment = calculateAdjustedPrice(plan.basePrice, pricingStep1, clock);
      return {
        plan,
        basePrice: plan.basePrice,
        finalPrice: adjustment.finalPrice,
        formattedBasePrice: formatCurrency(plan.basePrice, locale, currency),
        formattedFinalPrice: formatCurrency(adjustment.finalPrice, locale, currency),
        adjustment,
      };
    });
  });

  readonly selectedPlan = computed<InsurancePlan | null>(() => {
    const documentId = this.selectedPlanDocumentId();
    if (documentId === null) {
      return null;
    }
    return this.plansSignal().find((plan) => plan.documentId === documentId) ?? null;
  });

  readonly canAdvance = computed<boolean>(
    () => this.plansStatusSignal() === 'ready' && this.selectedPlan() !== null,
  );

  readonly isReady = computed<boolean>(() => this.statusSignal() === 'ready' && this.formSignal() !== null);

  readonly errorCount = computed<number>(() => {
    this.formRevision();
    const form = this.formSignal();
    if (!this.submittedSignal() || !form) {
      return 0;
    }
    return Object.values(form.controls).reduce((count, control) => count + (control.invalid ? 1 : 0), 0);
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.changes?.unsubscribe());
  }

  /** Reuses an in-flight/resolved load for the same country to avoid duplicate requests. */
  load(country: CountryCode): Promise<void> {
    if (this.activeLoad?.country === country && this.statusSignal() !== 'error') {
      return this.activeLoad.promise;
    }
    const promise = this.startLoad(country);
    this.activeLoad = { country, promise };
    return promise;
  }

  retry(): Promise<void> {
    this.activeLoad = null;
    return this.load(this.activeCountrySignal() ?? this.context.country());
  }

  /** The Step 2 page hands over the clock instance captured on entry. */
  captureClock(clock: QuoteClock): void {
    this.quoteClockSignal.set(clock);
  }

  async loadPlans(country: CountryCode): Promise<void> {
    this.plansStatusSignal.set('loading');
    this.plansErrorSignal.set(null);

    try {
      const plans = await firstValueFrom(this.catalogue.getInsurancePlans(country));
      this.plansSignal.set(plans);
      this.normalizeSelection(plans, country);
      this.plansStatusSignal.set(plans.length > 0 ? 'ready' : 'empty');
    } catch (error: unknown) {
      // Keep the previous catalogue, selection and persisted draft untouched (US-02 G20).
      this.plansErrorSignal.set(this.describeError(error));
      this.plansStatusSignal.set('error');
    }
  }

  retryPlans(): Promise<void> {
    return this.loadPlans(this.activeCountrySignal() ?? this.context.country());
  }

  selectPlan(documentId: string | null): void {
    if (documentId !== null && !this.plansSignal().some((plan) => plan.documentId === documentId)) {
      return;
    }

    this.selectedPlanSignal.set(documentId);
    this.invalidSelectionNoticeSignal.set(false);
    this.restoredSelectionNoticeSignal.set(false);
    this.persist('plans');
  }

  persist(step: WizardStep): void {
    const form = this.formSignal();
    const country = this.activeCountrySignal() ?? this.context.country();
    if (!form || this.statusSignal() !== 'ready') {
      return;
    }

    const step1: Record<string, FormValue> = {};
    for (const field of this.fieldsSignal()) {
      const control = form.controls[field.key];
      step1[field.key] = control
        ? coerceDraftValue(field, control.value)
        : this.factory.defaultValue(field);
    }

    const state: PersistedWizardStateV1 = {
      schemaVersion: 1,
      country,
      savedAt: new Date().toISOString(),
      step,
      step1,
      selectedPlanDocumentId: this.selectedPlanSignal(),
    };
    this.persistence.save(state);
  }

  patchValues(values: Readonly<Record<string, FormValue>>): void {
    const form = this.formSignal();
    if (!form) {
      return;
    }
    for (const field of this.fieldsSignal()) {
      const control = form.controls[field.key];
      const value = values[field.key];
      if (control && value !== undefined) {
        control.setValue(coerceDraftValue(field, value));
      }
    }
  }

  markSubmitted(): void {
    this.submittedSignal.set(true);
  }

  isLoadedFor(country: CountryCode): boolean {
    return (
      this.activeCountrySignal() === country &&
      this.statusSignal() === 'ready' &&
      this.formSignal() !== null
    );
  }

  reset(country: CountryCode): void {
    this.changes?.unsubscribe();
    this.changes = null;
    this.activeLoad = null;
    this.persistence.clear(country);
    this.activeCountrySignal.set(null);
    this.fieldsSignal.set([]);
    this.configSignal.set(null);
    this.formSignal.set(null);
    this.statusSignal.set('idle');
    this.errorMessageSignal.set(null);
    this.submittedSignal.set(false);
    this.restoredSignal.set(false);
    this.selectedPlanSignal.set(null);
    this.formRevision.set(0);
    this.clearPlanState();
  }

  private async startLoad(country: CountryCode): Promise<void> {
    this.changes?.unsubscribe();
    this.changes = null;
    this.activeCountrySignal.set(country);
    this.statusSignal.set('loading');
    this.errorMessageSignal.set(null);
    this.submittedSignal.set(false);
    this.restoredSignal.set(false);
    this.clearPlanState();

    try {
      const { fields, config } = await firstValueFrom(
        forkJoin({
          fields: this.catalogue.getFormFields(country),
          config: this.catalogue.getCountryConfig(country),
        }),
      );

      this.fieldsSignal.set(fields);
      this.configSignal.set(config);

      if (fields.length === 0) {
        this.formSignal.set(null);
        this.selectedPlanSignal.set(null);
        this.restoredSelectionFromDraftSignal.set(false);
        this.statusSignal.set('empty');
        return;
      }

      const draft = this.persistence.load(country);
      const values: Record<string, FormValue> = {};
      for (const field of fields) {
        const raw = draft?.step1[field.key];
        values[field.key] = raw === undefined ? this.factory.defaultValue(field) : coerceDraftValue(field, raw);
      }

      const form = this.factory.createForm(fields, values);
      this.formSignal.set(form);
      this.restoredSelectionFromDraftSignal.set(draft?.selectedPlanDocumentId != null);
      this.selectedPlanSignal.set(draft?.selectedPlanDocumentId ?? null);

      const hasRestoredValues = Boolean(draft && Object.keys(draft.step1).length > 0);
      if (hasRestoredValues) {
        form.markAllAsTouched();
        this.restoredSignal.set(true);
      }
      form.updateValueAndValidity({ emitEvent: false });
      this.statusSignal.set('ready');

      this.changes = new Subscription();
      this.changes.add(
        form.statusChanges.subscribe(() => this.formRevision.update((revision) => revision + 1)),
      );
      this.changes.add(
        form.valueChanges.pipe(debounceTime(400)).subscribe(() => this.persist('policyholder')),
      );
    } catch (error: unknown) {
      this.errorMessageSignal.set(this.describeError(error));
      this.statusSignal.set('error');
    }
  }

  private normalizeSelection(plans: readonly InsurancePlan[], country: CountryCode): void {
    const selected = this.selectedPlanSignal();
    const restoredFromDraft = this.restoredSelectionFromDraftSignal();

    if (selected !== null && plans.some((plan) => plan.documentId === selected)) {
      this.invalidSelectionNoticeSignal.set(false);
      this.restoredSelectionNoticeSignal.set(restoredFromDraft);
      return;
    }

    if (selected !== null) {
      this.selectedPlanSignal.set(null);
      this.clearPersistedSelection(country);
      this.invalidSelectionNoticeSignal.set(true);
    } else {
      this.invalidSelectionNoticeSignal.set(false);
    }
    this.restoredSelectionNoticeSignal.set(false);
  }

  /** Clears only the plan id; `step1` and `savedAt` stay byte-identical (US-02 G12). */
  private clearPersistedSelection(country: CountryCode): void {
    const draft = this.persistence.load(country);
    if (!draft || draft.selectedPlanDocumentId === null) {
      return;
    }
    const cleared: PersistedWizardStateV1 = { ...draft, selectedPlanDocumentId: null };
    this.persistence.save(cleared);
  }

  private clearPlanState(): void {
    this.plansSignal.set([]);
    this.plansStatusSignal.set('idle');
    this.plansErrorSignal.set(null);
    this.invalidSelectionNoticeSignal.set(false);
    this.restoredSelectionNoticeSignal.set(false);
    this.restoredSelectionFromDraftSignal.set(false);
    this.quoteClockSignal.set(null);
  }

  private describeError(error: unknown): string | null {
    if (!isDevMode()) {
      return null;
    }
    if (error instanceof HttpErrorResponse) {
      return `HTTP ${error.status} ${error.statusText}`.trim();
    }
    return error instanceof Error ? error.message : null;
  }
}
