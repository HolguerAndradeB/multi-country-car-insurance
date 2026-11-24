import { HttpErrorResponse } from '@angular/common/http';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CatalogueApi } from '../../core/catalogue/catalogue.api';
import type {
  CountryCode,
  CountryConfig,
  FormFieldConfig,
  InsurancePlan,
  PersistedWizardStateV1,
} from '../../core/models';
import { STORAGE_PORT, type StoragePort } from '../../core/persistence/storage.port';
import {
  wizardStorageKey,
  WizardPersistenceService,
} from '../../core/persistence/wizard-persistence.service';
import type { QuoteClock } from '../../core/pricing/quote-clock';
import { WizardStore } from './wizard.store';

class MemoryStorage implements StoragePort {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function makeField(
  overrides: Partial<FormFieldConfig> & Pick<FormFieldConfig, 'key' | 'type'>,
): FormFieldConfig {
  return {
    ...overrides,
    id: overrides.id ?? 1,
    documentId: overrides.documentId ?? 'doc-1',
    label: overrides.label ?? overrides.key,
    required: overrides.required ?? false,
    validations: overrides.validations ?? {},
    options: overrides.options ?? [],
    helpText: overrides.helpText ?? null,
    errorMessage: overrides.errorMessage ?? overrides.key,
    order: overrides.order ?? 1,
    country: overrides.country ?? 'CO',
    section: overrides.section ?? 'policyholder',
  };
}

const CONFIG: CountryConfig = {
  id: 1,
  documentId: 'cfg-co',
  country: 'CO',
  countryName: 'Colombia',
  currency: 'COP',
  localeCode: 'es-CO',
  termsAndConditions: 'Demo terms',
  documentMaskVisibleEnd: 4,
};

function makeState(step1: PersistedWizardStateV1['step1']): PersistedWizardStateV1 {
  return {
    schemaVersion: 1,
    country: 'CO',
    savedAt: new Date().toISOString(),
    step: 'policyholder',
    step1,
    selectedPlanDocumentId: null,
  };
}

interface CatalogueStub {
  getFormFields: (country: CountryCode) => Observable<readonly FormFieldConfig[]>;
  getCountryConfig: (country: CountryCode) => Observable<CountryConfig | null>;
  getInsurancePlans: (country: CountryCode) => Observable<readonly InsurancePlan[]>;
}

function makePlan(overrides: Partial<InsurancePlan> = {}): InsurancePlan {
  return {
    id: overrides.id ?? 1,
    documentId: overrides.documentId ?? 'planco-estandar',
    key: overrides.key ?? 'estandar',
    name: overrides.name ?? 'Plan Estándar',
    shortDescription: overrides.shortDescription ?? 'Descripción ficticia de demostración.',
    basePrice: overrides.basePrice ?? 620000,
    currency: overrides.currency ?? 'COP',
    coverages: overrides.coverages ?? [
      { name: 'Asistencia vial', limit: 2000000, deductible: null },
    ],
    benefits: overrides.benefits ?? ['Asistencia vial 24 horas'],
    order: overrides.order ?? 2,
    recommended: overrides.recommended ?? true,
    country: overrides.country ?? 'CO',
  };
}

const FIXED_CLOCK: QuoteClock = {
  today: new Date(2026, 10, 23),
  currentYear: 2026,
};

function pricingFields(): readonly FormFieldConfig[] {
  return [
    makeField({ key: 'fullName', type: 'text', order: 1 }),
    makeField({ key: 'vehicleYear', type: 'number', order: 2 }),
    makeField({ key: 'birthDate', type: 'date', order: 3 }),
  ];
}

describe('WizardStore (US01-U10, US01-U11, US01-U12, US01-U17)', () => {
  let store: WizardStore;
  let storage: MemoryStorage;
  let api: CatalogueStub;
  let fields$: Observable<readonly FormFieldConfig[]>;
  let config$: Observable<CountryConfig | null>;
  let plans$: Observable<readonly InsurancePlan[]>;

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    storage = new MemoryStorage();
    fields$ = of([]);
    config$ = of(null);
    plans$ = of([]);
    api = {
      getFormFields: vi.fn((_country: CountryCode) => fields$),
      getCountryConfig: vi.fn((_country: CountryCode) => config$),
      getInsurancePlans: vi.fn((_country: CountryCode) => plans$),
    };

    await TestBed.configureTestingModule({
      providers: [
        provideLocationMocks(),
        provideRouter([]),
        { provide: CatalogueApi, useValue: api },
        { provide: STORAGE_PORT, useValue: storage },
      ],
    }).compileComponents();
    store = TestBed.inject(WizardStore);
  });

  it('transitions loading -> ready with fresh fields and config', async () => {
    const fields = [makeField({ key: 'fullName', type: 'text', required: true })];
    fields$ = of(fields);
    config$ = of(CONFIG);

    const loading = store.load('CO');
    expect(store.status()).toBe('loading');

    await loading;

    expect(store.status()).toBe('ready');
    expect(store.isReady()).toBe(true);
    expect(store.fields()).toEqual(fields);
    expect(store.countryConfig()).toEqual(CONFIG);
    expect(store.form()?.controls['fullName']).toBeDefined();
    expect(store.form()?.invalid).toBe(true);
    expect(api.getFormFields).toHaveBeenCalledWith('CO');
  });

  it('transitions loading -> empty for an empty published catalogue', async () => {
    const loading = store.load('CO');
    expect(store.status()).toBe('loading');
    await loading;

    expect(store.status()).toBe('empty');
    expect(store.isReady()).toBe(false);
    expect(store.form()).toBeNull();
  });

  it('transitions loading -> error on HTTP failure without clearing sessionStorage', async () => {
    const draft = makeState({ documentNumber: '1023456789' });
    storage.values.set(wizardStorageKey('CO'), JSON.stringify(draft));
    fields$ = throwError(
      () => new HttpErrorResponse({ status: 500, statusText: 'Server Error' }),
    );

    const loading = store.load('CO');
    expect(store.status()).toBe('loading');
    await loading;

    expect(store.status()).toBe('error');
    expect(store.isReady()).toBe(false);
    expect(store.form()).toBeNull();
    expect(store.errorMessage()).toContain('HTTP 500');
    expect(storage.values.has(wizardStorageKey('CO'))).toBe(true);
    expect(storage.values.get(wizardStorageKey('CO'))).toBe(JSON.stringify(draft));
  });

  it('re-runs the same load path on retry after an error', async () => {
    fields$ = throwError(() => new HttpErrorResponse({ status: 503, statusText: 'Unavailable' }));
    await store.load('CO');
    expect(store.status()).toBe('error');

    fields$ = of([makeField({ key: 'fullName', type: 'text', required: true })]);
    config$ = of(CONFIG);
    await store.retry();

    expect(store.status()).toBe('ready');
    expect(store.fields().map((field) => field.key)).toEqual(['fullName']);
  });

  it('reconciles matching keys with coercion, defaults new keys and drops removed keys on save', async () => {
    storage.values.set(
      wizardStorageKey('CO'),
      JSON.stringify(
        makeState({
          documentNumber: '1023456789',
          vehicleYear: '2019',
          city: 'BOG',
          removedKey: 'orphan',
        }),
      ),
    );
    fields$ = of([
      makeField({ key: 'city', type: 'select', order: 1 }),
      makeField({ key: 'documentNumber', type: 'text', order: 2 }),
      makeField({ key: 'email', type: 'text', order: 3 }),
      makeField({ key: 'vehicleYear', type: 'number', order: 4 }),
    ]);

    await store.load('CO');
    let form = store.form();
    expect(form).not.toBeNull();
    expect(Object.keys(form!.controls)).toEqual(['city', 'documentNumber', 'email', 'vehicleYear']);
    expect(form!.controls['city'].value).toBe('BOG');
    expect(form!.controls['documentNumber'].value).toBe('1023456789');
    expect(form!.controls['email'].value).toBe('');
    expect(form!.controls['vehicleYear'].value).toBe(2019);
    expect(typeof form!.controls['vehicleYear'].value).toBe('number');
    expect(store.restoredFromDraft()).toBe(true);

    // Reordering the catalogue must not move any value: reconciliation is keyed.
    fields$ = of([
      makeField({ key: 'vehicleYear', type: 'number', order: 1 }),
      makeField({ key: 'email', type: 'text', order: 2 }),
      makeField({ key: 'documentNumber', type: 'text', order: 3 }),
      makeField({ key: 'city', type: 'select', order: 4 }),
    ]);
    await store.retry();
    form = store.form();
    expect(Object.keys(form!.controls)).toEqual(['vehicleYear', 'email', 'documentNumber', 'city']);
    expect(form!.controls['city'].value).toBe('BOG');
    expect(form!.controls['vehicleYear'].value).toBe(2019);
    expect(form!.controls['documentNumber'].value).toBe('1023456789');

    store.persist('policyholder');
    const saved = JSON.parse(storage.values.get(wizardStorageKey('CO')) ?? '') as PersistedWizardStateV1;
    expect(Object.keys(saved.step1).sort()).toEqual(['city', 'documentNumber', 'email', 'vehicleYear']);
    expect(saved.step1['removedKey']).toBeUndefined();
    expect(saved.step1['vehicleYear']).toBe(2019);
    expect(saved.step).toBe('policyholder');
  });

  it('revalidates restored drafts and flags invalid values immediately', async () => {
    storage.values.set(
      wizardStorageKey('CO'),
      JSON.stringify(
        makeState({ fullName: 'A', documentNumber: 'abc', vehicleYear: 1800 }),
      ),
    );
    fields$ = of([
      makeField({ key: 'fullName', type: 'text', required: true, validations: { minLength: 3 } }),
      makeField({
        key: 'documentNumber',
        type: 'text',
        required: true,
        validations: { pattern: '^[0-9]+$' },
      }),
      makeField({ key: 'vehicleYear', type: 'number', required: true, validations: { rule: 'vehicleYear' } }),
      // Newly introduced required field with no draft value must block too.
      makeField({ key: 'email', type: 'text', required: true }),
    ]);

    await store.load('CO');
    const form = store.form();

    expect(store.status()).toBe('ready');
    expect(store.restoredFromDraft()).toBe(true);
    expect(form?.invalid).toBe(true);
    expect(form?.controls['fullName'].hasError('minlength')).toBe(true);
    expect(form?.controls['documentNumber'].hasError('pattern')).toBe(true);
    expect(form?.controls['vehicleYear'].hasError('vehicleYear')).toBe(true);
    expect(form?.controls['email'].hasError('required')).toBe(true);
    expect(form?.controls['vehicleYear'].touched).toBe(true);
    expect(form?.controls['email'].touched).toBe(true);
  });

  it('coerces boolean-like draft strings to false for checkboxes', async () => {
    storage.values.set(
      wizardStorageKey('CO'),
      JSON.stringify(makeState({ acceptMarketing: 'true' })),
    );
    fields$ = of([makeField({ key: 'acceptMarketing', type: 'checkbox' })]);

    await store.load('CO');

    expect(store.form()?.controls['acceptMarketing'].value).toBe(false);
  });

  it('marks submission and counts invalid controls only after submit', async () => {
    fields$ = of([
      makeField({ key: 'a', type: 'text', required: true }),
      makeField({ key: 'b', type: 'text', required: true }),
    ]);
    await store.load('CO');

    expect(store.errorCount()).toBe(0);
    store.markSubmitted();
    expect(store.submitted()).toBe(true);
    expect(store.errorCount()).toBe(2);

    store.form()?.controls['a'].setValue('ok');
    expect(store.errorCount()).toBe(1);
  });

  it('patchValues only writes keys present in the current catalogue', async () => {
    fields$ = of([
      makeField({ key: 'fullName', type: 'text' }),
      makeField({ key: 'vehicleYear', type: 'number' }),
    ]);
    await store.load('CO');

    store.patchValues({ fullName: 'Matías Fuentes', vehicleYear: '2020', unknown: 'ignored' });

    expect(store.form()?.controls['fullName'].value).toBe('Matías Fuentes');
    expect(store.form()?.controls['vehicleYear'].value).toBe(2020);
    expect(store.form()?.controls['unknown']).toBeUndefined();
  });

  it('reset clears in-memory state and the country key', async () => {
    fields$ = of([makeField({ key: 'fullName', type: 'text' })]);
    await store.load('CO');
    store.persist('plans');

    store.reset('CO');

    expect(store.status()).toBe('idle');
    expect(store.form()).toBeNull();
    expect(store.fields()).toEqual([]);
    expect(store.isLoadedFor('CO')).toBe(false);
    expect(storage.values.has(wizardStorageKey('CO'))).toBe(false);
  });

  it('US02-U07: an empty active catalogue maps to empty (never error)', async () => {
    fields$ = of(pricingFields());
    config$ = of(CONFIG);
    plans$ = of([]);
    await store.load('CO');

    await store.loadPlans('CO');

    expect(store.plans()).toEqual([]);
    expect(store.plansStatus()).toBe('empty');
    expect(store.plansError()).toBeNull();
    expect(store.selectedPlan()).toBeNull();
    expect(store.canAdvance()).toBe(false);
  });

  it('US02-U08: selecting a plan persists the documentId and resolves selectedPlan()', async () => {
    fields$ = of(pricingFields());
    config$ = of(CONFIG);
    plans$ = of([makePlan()]);
    await store.load('CO');
    await store.loadPlans('CO');

    store.selectPlan('planco-estandar');

    expect(store.selectedPlanDocumentId()).toBe('planco-estandar');
    expect(store.selectedPlan()).toMatchObject({ documentId: 'planco-estandar', basePrice: 620000 });
    expect(store.canAdvance()).toBe(true);
    expect(store.invalidSelectionNotice()).toBe(false);

    const saved = JSON.parse(storage.values.get(wizardStorageKey('CO')) ?? '') as PersistedWizardStateV1;
    expect(saved.selectedPlanDocumentId).toBe('planco-estandar');
    expect(saved.step).toBe('plans');
    expect(saved.schemaVersion).toBe(1);
  });

  it('US02-U09: a stale stored plan is cleared after a successful fetch without touching step1/savedAt', async () => {
    const savedAt = new Date().toISOString();
    const step1 = { fullName: 'Camila Rodríguez', vehicleYear: 2021, birthDate: '1990-06-15' };
    const draft: PersistedWizardStateV1 = {
      schemaVersion: 1,
      country: 'CO',
      savedAt,
      step: 'plans',
      step1,
      selectedPlanDocumentId: 'plan-retirado',
    };
    storage.values.set(wizardStorageKey('CO'), JSON.stringify(draft));
    fields$ = of(pricingFields());
    config$ = of(CONFIG);
    plans$ = of([makePlan({ documentId: 'plan-actual', key: 'basico', name: 'Plan Básico' })]);

    await store.load('CO');
    expect(store.selectedPlanDocumentId()).toBe('plan-retirado');

    await store.loadPlans('CO');

    expect(store.selectedPlanDocumentId()).toBeNull();
    expect(store.selectedPlan()).toBeNull();
    expect(store.invalidSelectionNotice()).toBe(true);
    expect(store.canAdvance()).toBe(false);

    const saved = JSON.parse(storage.values.get(wizardStorageKey('CO')) ?? '') as PersistedWizardStateV1;
    expect(saved.selectedPlanDocumentId).toBeNull();
    expect(saved.step1).toEqual(step1);
    expect(saved.savedAt).toBe(savedAt);

    store.selectPlan('plan-actual');
    expect(store.invalidSelectionNotice()).toBe(false);
    expect(store.selectedPlanDocumentId()).toBe('plan-actual');
  });

  it('US02-U13: a valid stored plan survives re-entry while edited Step 1 values recompute prices', async () => {
    const draft: PersistedWizardStateV1 = {
      schemaVersion: 1,
      country: 'CO',
      savedAt: new Date().toISOString(),
      step: 'plans',
      step1: { fullName: 'Camila Rodríguez', vehicleYear: 2021, birthDate: '1990-06-15' },
      selectedPlanDocumentId: 'planco-estandar',
    };
    storage.values.set(wizardStorageKey('CO'), JSON.stringify(draft));
    fields$ = of(pricingFields());
    config$ = of(CONFIG);
    plans$ = of([makePlan()]);
    store.captureClock(FIXED_CLOCK);

    await store.load('CO');
    await store.loadPlans('CO');

    expect(store.selectedPlanDocumentId()).toBe('planco-estandar');
    expect(store.invalidSelectionNotice()).toBe(false);
    expect(store.restoredSelectionNotice()).toBe(true);
    expect(store.quotedPlans()[0]?.finalPrice).toBe(620000);

    store.patchValues({ vehicleYear: 2019, birthDate: '2004-11-23' });

    expect(store.selectedPlanDocumentId()).toBe('planco-estandar');
    expect(store.quotedPlans()[0]?.adjustment.adjustmentPercent).toBe(14);
    expect(store.quotedPlans()[0]?.finalPrice).toBe(706800);
    expect(store.quotedPlans()[0]?.formattedFinalPrice).not.toBe('');
  });

  it('US02-U15: a failed plans fetch keeps the previous catalogue and never clears storage', async () => {
    fields$ = of(pricingFields());
    config$ = of(CONFIG);
    plans$ = of([makePlan()]);
    await store.load('CO');
    await store.loadPlans('CO');
    store.selectPlan('planco-estandar');
    const before = storage.values.get(wizardStorageKey('CO'));

    const clearSpy = vi.spyOn(WizardPersistenceService.prototype, 'clear');
    try {
      plans$ = throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' }));
      await store.loadPlans('CO');

      expect(store.plansStatus()).toBe('error');
      expect(store.plansError()).toContain('HTTP 500');
      expect(store.plans()).toHaveLength(1);
      expect(store.selectedPlanDocumentId()).toBe('planco-estandar');
      expect(store.selectedPlan()).toMatchObject({ documentId: 'planco-estandar' });
      expect(storage.values.get(wizardStorageKey('CO'))).toBe(before);
      expect(clearSpy).not.toHaveBeenCalled();
    } finally {
      clearSpy.mockRestore();
    }
  });
});
