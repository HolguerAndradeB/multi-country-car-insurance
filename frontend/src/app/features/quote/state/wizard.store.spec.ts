import { HttpErrorResponse } from '@angular/common/http';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CatalogueApi } from '../../../core/catalogue/catalogue.api';
import type {
  CountryCode,
  CountryConfig,
  FormFieldConfig,
  FormValue,
  InsurancePlan,
  PersistedWizardStateV1,
  QuoteConfirmation,
  SimulatedPaymentRequest,
  SimulatedPaymentResult,
} from '../../../core/models';
import {
  SIMULATED_PAYMENT_FAILURE_HOOK,
  SimulatedPaymentService,
} from '../../../core/payment/simulated-payment.service';
import { STORAGE_PORT, type StoragePort } from '../../../core/persistence/storage.port';
import {
  wizardStorageKey,
  WizardPersistenceService,
} from '../../../core/persistence/wizard-persistence.service';
import { QuoteClock } from '../../../core/pricing/quote-clock';
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

describe('WizardStore — US-03 summary and simulated payment', () => {
  const CO_TERMS = 'TÉRMINOS Y CONDICIONES SIMULADOS — COLOMBIA.';
  const CL_TERMS = 'TÉRMINOS Y CONDICIONES SIMULADOS — CHILE.';
  const CLOCK: QuoteClock = { today: new Date(2026, 10, 24), currentYear: 2026 };

  const CONFIGS: Readonly<Record<CountryCode, CountryConfig>> = {
    CO: {
      id: 1,
      documentId: 'cfgcol0000000000000001',
      country: 'CO',
      countryName: 'Colombia',
      currency: 'COP',
      localeCode: 'es-CO',
      termsAndConditions: CO_TERMS,
      documentMaskVisibleEnd: 4,
    },
    CL: {
      id: 2,
      documentId: 'cfgcll0000000000000001',
      country: 'CL',
      countryName: 'Chile',
      currency: 'CLP',
      localeCode: 'es-CL',
      termsAndConditions: CL_TERMS,
      documentMaskVisibleEnd: 4,
    },
  };

  const STEP1: Readonly<Record<CountryCode, Readonly<Record<string, FormValue>>>> = {
    CO: {
      documentNumber: '123456789',
      fullName: 'Ana Ejemplo',
      birthDate: '1990-06-15',
      licensePlate: 'ABC123',
      vehicleYear: 2021,
    },
    CL: {
      documentNumber: '12345678-K',
      fullName: 'Carlos Ejemplo',
      birthDate: '1990-06-15',
      licensePlate: 'ABCD12',
      vehicleYear: 2021,
    },
  };

  function planId(country: CountryCode): string {
    return country === 'CO' ? 'planco00000000000000002' : 'plancl00000000000000002';
  }

  function summaryFields(country: CountryCode): readonly FormFieldConfig[] {
    return [
      makeField({
        id: 1,
        key: 'documentNumber',
        type: 'text',
        label: country === 'CO' ? 'Número de documento' : 'RUT',
        required: true,
        order: 1,
        country,
      }),
      makeField({
        id: 2,
        key: 'fullName',
        type: 'text',
        label: 'Nombre completo',
        required: true,
        order: 2,
        country,
      }),
      makeField({
        id: 3,
        key: 'birthDate',
        type: 'date',
        label: 'Fecha de nacimiento',
        required: true,
        order: 3,
        country,
      }),
      makeField({
        id: 4,
        key: 'licensePlate',
        type: 'text',
        label: country === 'CO' ? 'Placa' : 'Patente',
        required: true,
        order: 4,
        country,
        section: 'vehicle',
      }),
      makeField({
        id: 5,
        key: 'vehicleYear',
        type: 'number',
        label: 'Año del vehículo',
        required: true,
        order: 5,
        country,
        section: 'vehicle',
      }),
    ];
  }

  let store: WizardStore;
  let storage: MemoryStorage;
  let fields$: Observable<readonly FormFieldConfig[]>;
  let config$: Observable<CountryConfig | null>;
  let plans$: Observable<readonly InsurancePlan[]>;
  let api: {
    getFormFields: ReturnType<typeof vi.fn>;
    getCountryConfig: ReturnType<typeof vi.fn>;
    getInsurancePlans: ReturnType<typeof vi.fn>;
  };
  let payment: { pay: ReturnType<typeof vi.fn> };
  let failureHook: ReturnType<typeof vi.fn>;

  beforeEach(() => {
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
    payment = {
      pay: vi.fn(
        (_request: SimulatedPaymentRequest): Promise<SimulatedPaymentResult> =>
          Promise.resolve({ ok: true }),
      ),
    };
    failureHook = vi.fn(() => false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
    Reflect.deleteProperty(globalThis, '__WIZARD_SIMULATE_PAYMENT_FAILURE__');
  });

  async function prepare(country: CountryCode): Promise<WizardStore> {
    const draft: PersistedWizardStateV1 = {
      schemaVersion: 1,
      country,
      savedAt: new Date().toISOString(),
      step: 'summary',
      step1: { ...STEP1[country] },
      selectedPlanDocumentId: planId(country),
    };
    storage.values.set(wizardStorageKey(country), JSON.stringify(draft));
    fields$ = of(summaryFields(country));
    config$ = of(CONFIGS[country]);
    plans$ = of([
      makePlan({
        documentId: planId(country),
        country,
        name: 'Plan Estándar',
        basePrice: country === 'CO' ? 620000 : 490000,
        currency: country === 'CO' ? 'COP' : 'CLP',
      }),
    ]);

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      providers: [
        provideLocationMocks(),
        provideRouter([]),
        { provide: CatalogueApi, useValue: api },
        { provide: STORAGE_PORT, useValue: storage },
        { provide: QuoteClock, useValue: CLOCK },
        { provide: SimulatedPaymentService, useValue: payment },
        { provide: SIMULATED_PAYMENT_FAILURE_HOOK, useValue: failureHook },
      ],
    }).compileComponents();

    const readyStore = TestBed.inject(WizardStore);
    readyStore.captureClock(CLOCK);
    await readyStore.load(country);
    await readyStore.loadPlans(country);
    expect(readyStore.selectedPlanDocumentId()).toBe(planId(country));
    await readyStore.loadSummaryContext(country);
    expect(readyStore.summaryStatus()).toBe('ready');
    return readyStore;
  }

  async function settlePayment(): Promise<void> {
    for (let tick = 0; tick < 8; tick += 1) {
      await Promise.resolve();
    }
  }

  it('US03-U06: reloads the live config on every entry and keeps CO/CL terms distinct', async () => {
    const coStore = await prepare('CO');
    expect(coStore.summaryConfig()?.termsAndConditions).toBe(CO_TERMS);
    const coCalls = api.getCountryConfig.mock.calls.filter((call) => call[0] === 'CO').length;
    expect(coCalls).toBeGreaterThanOrEqual(2);

    config$ = of({ ...CONFIGS['CO'], termsAndConditions: 'TÉRMINOS EDITADOS EN STRAPI.' });
    await coStore.retrySummary('CO');
    expect(api.getCountryConfig).toHaveBeenCalledWith('CO');
    expect(
      api.getCountryConfig.mock.calls.filter((call) => call[0] === 'CO').length,
    ).toBe(coCalls + 1);
    expect(coStore.summaryConfig()?.termsAndConditions).toBe('TÉRMINOS EDITADOS EN STRAPI.');

    const clStore = await prepare('CL');
    expect(clStore.summaryConfig()?.termsAndConditions).toBe(CL_TERMS);
    expect(clStore.summaryConfig()?.documentId).toBe('cfgcll0000000000000001');
    expect(api.getCountryConfig).toHaveBeenCalledWith('CL');
    expect(CL_TERMS).not.toBe(CO_TERMS);
  });

  it('US03-U07: blank and null configs block payment with empty-terms without clearing storage', async () => {
    const readyStore = await prepare('CO');
    const saved = storage.values.get(wizardStorageKey('CO'));
    readyStore.setTermsAccepted(true);

    config$ = of({ ...CONFIGS['CO'], termsAndConditions: '   ' });
    await readyStore.retrySummary('CO');

    expect(readyStore.summaryStatus()).toBe('empty-terms');
    expect(readyStore.summaryConfig()?.termsAndConditions).toBe('   ');
    expect(readyStore.termsAvailable()).toBe(false);
    expect(readyStore.termsAccepted()).toBe(false);
    expect(readyStore.canPay()).toBe(false);
    expect(readyStore.paymentStatus()).toBe('idle');
    expect(storage.values.get(wizardStorageKey('CO'))).toBe(saved);

    config$ = of(null);
    await readyStore.retrySummary('CO');
    expect(readyStore.summaryStatus()).toBe('empty-terms');
    expect(readyStore.summaryConfig()).toBeNull();
    expect(readyStore.canPay()).toBe(false);
  });

  it('US03-U08: canPay gates on ready config and accepted terms', async () => {
    const readyStore = await prepare('CO');

    expect(readyStore.summaryStatus()).toBe('ready');
    expect(readyStore.termsAvailable()).toBe(true);
    expect(readyStore.termsAccepted()).toBe(false);
    expect(readyStore.canPay()).toBe(false);

    readyStore.setTermsAccepted(true);
    expect(readyStore.canPay()).toBe(true);

    readyStore.submitPayment();
    expect(readyStore.paymentStatus()).toBe('processing');
    expect(readyStore.canPay()).toBe(false);
  });

  it('US03-U09: the double-submit lock is set before the asynchronous payment starts', async () => {
    const paymentGate: { resolve: ((result: SimulatedPaymentResult) => void) | null } = {
      resolve: null,
    };
    payment.pay.mockImplementation(
      () =>
        new Promise<SimulatedPaymentResult>((resolve) => {
          paymentGate.resolve = resolve;
        }),
    );
    const readyStore = await prepare('CO');
    readyStore.setTermsAccepted(true);

    readyStore.submitPayment();
    expect(readyStore.paymentStatus()).toBe('processing');
    readyStore.submitPayment();
    readyStore.submitPayment();

    expect(payment.pay).toHaveBeenCalledTimes(1);
    if (paymentGate.resolve === null) {
      throw new Error('The payment boundary must have been called before the lock is tested.');
    }
    paymentGate.resolve({ ok: true });
    await settlePayment();

    expect(readyStore.paymentStatus()).toBe('confirmed');
    expect(payment.pay).toHaveBeenCalledTimes(1);
  });

  it('US03-U10: submits only typed display data and freezes no card or token fields', async () => {
    const readyStore = await prepare('CO');
    readyStore.setTermsAccepted(true);

    readyStore.submitPayment();
    await settlePayment();

    expect(payment.pay).toHaveBeenCalledTimes(1);
    const request = payment.pay.mock.calls[0]?.[0] as SimulatedPaymentRequest;
    expect(Object.keys(request).sort()).toEqual([
      'country',
      'locale',
      'planDocumentId',
      'shouldFail',
      'termsDocumentId',
    ]);
    expect(request).toEqual({
      country: 'CO',
      locale: 'es-CO',
      planDocumentId: 'planco00000000000000002',
      termsDocumentId: 'cfgcol0000000000000001',
      shouldFail: false,
    });
    expect(JSON.stringify(request)).not.toMatch(
      /card|cvv|expiry|expiration|billing|address|token|gateway/i,
    );
    expect(readyStore.paymentStatus()).toBe('confirmed');
  });

  it('US03-U11: rejection keeps data, terms and storage, and retry reuses the loaded context', async () => {
    const readyStore = await prepare('CO');
    readyStore.setTermsAccepted(true);
    const beforeStep1 = { ...readyStore.step1Values() };
    const beforePlan = readyStore.selectedPlanDocumentId();
    const beforeStorage = storage.values.get(wizardStorageKey('CO'));

    payment.pay.mockResolvedValueOnce({ ok: false, code: 'SIMULATED_REJECTION' });
    readyStore.submitPayment();
    await settlePayment();

    expect(readyStore.paymentStatus()).toBe('rejected');
    expect(readyStore.confirmation()).toBeNull();
    expect(readyStore.termsAccepted()).toBe(true);
    expect(readyStore.canPay()).toBe(true);
    expect(readyStore.step1Values()).toEqual(beforeStep1);
    expect(readyStore.selectedPlanDocumentId()).toBe(beforePlan);
    expect(storage.values.get(wizardStorageKey('CO'))).toBe(beforeStorage);

    payment.pay.mockResolvedValueOnce({ ok: true });
    readyStore.submitPayment();
    await settlePayment();

    expect(readyStore.paymentStatus()).toBe('confirmed');
    expect(payment.pay).toHaveBeenCalledTimes(2);
    expect(readyStore.termsAccepted()).toBe(true);
    expect(storage.values.get(wizardStorageKey('CO'))).toBe(beforeStorage);
  });

  it('US03-U11: a true failure hook is passed to the payment boundary', async () => {
    failureHook.mockReturnValue(true);
    const readyStore = await prepare('CO');
    readyStore.setTermsAccepted(true);

    readyStore.submitPayment();
    await settlePayment();

    const request = payment.pay.mock.calls[0]?.[0] as SimulatedPaymentRequest;
    expect(request.shouldFail).toBe(true);
    expect(failureHook).toHaveBeenCalled();
  });

  it('US03-U12/U13: success builds a deterministic local-date quote number and a frozen snapshot', async () => {
    const readyStore = await prepare('CL');
    readyStore.setTermsAccepted(true);

    readyStore.submitPayment();
    await settlePayment();

    const confirmation = readyStore.confirmation();
    expect(confirmation).not.toBeNull();
    expect(confirmation?.quoteNumber).toMatch(/^COT-CL-20261124-[0-9A-Z]{6}$/);
    expect(confirmation?.country).toBe('CL');
    expect(confirmation?.locale).toBe('es-CL');
    expect(confirmation?.currency).toBe('CLP');
    expect(confirmation?.issuedAt).toBe(CLOCK.today.toISOString());
    expect(confirmation?.policyholder.find((row) => row.key === 'documentNumber')?.value).toBe(
      '••••••78-K',
    );
    expect(confirmation?.finalPrice).toBeGreaterThan(0);
    expect(Object.isFrozen(confirmation)).toBe(true);
    expect(Object.isFrozen(confirmation?.policyholder)).toBe(true);
    expect(Object.isFrozen(confirmation?.vehicle)).toBe(true);
    expect(Object.isFrozen(confirmation?.policyholder[0])).toBe(true);
    expect(
      Reflect.set(confirmation as QuoteConfirmation, 'quoteNumber', 'COT-HACKED-000000'),
    ).toBe(false);
  });

  it('US03-U14: newQuote delegates to reset, clears the country key and all Step 3 signals', async () => {
    const readyStore = await prepare('CO');
    const clearSpy = vi.spyOn(WizardPersistenceService.prototype, 'clear');
    readyStore.setTermsAccepted(true);
    readyStore.submitPayment();
    await settlePayment();

    expect(readyStore.paymentStatus()).toBe('confirmed');
    expect(clearSpy).not.toHaveBeenCalled();

    readyStore.newQuote('CO');

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalledWith('CO');
    expect(readyStore.summaryStatus()).toBe('idle');
    expect(readyStore.summaryConfig()).toBeNull();
    expect(readyStore.termsAccepted()).toBe(false);
    expect(readyStore.paymentStatus()).toBe('idle');
    expect(readyStore.confirmation()).toBeNull();
    expect(readyStore.step1Values()).toEqual({});
    expect(readyStore.selectedPlanDocumentId()).toBeNull();
    expect(readyStore.form()).toBeNull();
    expect(storage.values.has(wizardStorageKey('CO'))).toBe(false);
    clearSpy.mockRestore();
  });

  it('US03-U15: summary re-entry after edit-style navigation preserves values, plan and storage', async () => {
    const readyStore = await prepare('CO');
    const clearSpy = vi.spyOn(WizardPersistenceService.prototype, 'clear');
    const beforeStep1 = { ...readyStore.step1Values() };
    const beforePlan = readyStore.selectedPlanDocumentId();
    const beforeStorage = storage.values.get(wizardStorageKey('CO'));

    readyStore.setTermsAccepted(true);
    await readyStore.loadSummaryContext('CO');

    expect(readyStore.summaryStatus()).toBe('ready');
    expect(readyStore.termsAccepted()).toBe(false);
    expect(readyStore.step1Values()).toEqual(beforeStep1);
    expect(readyStore.selectedPlanDocumentId()).toBe(beforePlan);
    expect(readyStore.step1Values()['documentNumber']).toBe('123456789');
    expect(readyStore.summarySections()[0]?.rows[0]?.value).toBe('•••••6789');
    expect(storage.values.get(wizardStorageKey('CO'))).toBe(beforeStorage);
    expect(clearSpy).not.toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
