import { provideLocationMocks } from '@angular/common/testing';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CountryContextService } from '../../core/country/country-context.service';
import { UI_COPY } from '../../core/i18n/ui-copy';
import type {
  CountryCode,
  CountryConfig,
  PaymentStatus,
  PlanSummary,
  QuoteConfirmation,
  SummaryLoadStatus,
  SummarySection,
} from '../../core/models';
import { QuoteStep3SummaryPageComponent } from './quote-step3-summary-page';
import { WizardStore } from './wizard.store';

interface StoreStub {
  readonly summaryStatus: WritableSignal<SummaryLoadStatus>;
  readonly summaryError: WritableSignal<string | null>;
  readonly summaryConfig: WritableSignal<CountryConfig | null>;
  readonly termsAccepted: WritableSignal<boolean>;
  readonly termsAvailable: WritableSignal<boolean>;
  readonly paymentStatus: WritableSignal<PaymentStatus>;
  readonly confirmation: WritableSignal<QuoteConfirmation | null>;
  readonly canPay: WritableSignal<boolean>;
  readonly summarySections: WritableSignal<readonly SummarySection[]>;
  readonly planSummary: WritableSignal<PlanSummary | null>;
  readonly loadSummaryContext: ReturnType<typeof vi.fn>;
  readonly retrySummary: ReturnType<typeof vi.fn>;
  readonly setTermsAccepted: ReturnType<typeof vi.fn>;
  readonly submitPayment: ReturnType<typeof vi.fn>;
  readonly newQuote: ReturnType<typeof vi.fn>;
}

const CONFIG: CountryConfig = {
  id: 1,
  documentId: 'cfgcol0000000000000001',
  country: 'CO',
  countryName: 'Colombia',
  currency: 'COP',
  localeCode: 'es-CO',
  termsAndConditions: 'TÉRMINOS SIMULADOS — COLOMBIA.',
  documentMaskVisibleEnd: 4,
};

const SECTIONS: readonly SummarySection[] = [
  {
    id: 'policyholder',
    heading: UI_COPY.summaryTomadorHeading,
    rows: [
      {
        key: 'documentNumber',
        label: 'Número de documento',
        value: '•••••6789',
      },
    ],
  },
  {
    id: 'vehicle',
    heading: UI_COPY.summaryVehicleHeading,
    rows: [{ key: 'licensePlate', label: 'Placa del vehículo', value: 'ABC123' }],
  },
];

const PLAN: PlanSummary = {
  name: 'Plan Estándar',
  shortDescription: 'Descripción ficticia de demostración.',
  basePriceText: 'Precio base: $ 620.000',
  finalPriceText: 'Precio final estimado: $ 706.800',
  adjustmentText: 'Ajuste simulado: +14% · por antigüedad del vehículo',
  footnote: UI_COPY.simulatedFootnote,
  finalPrice: 706800,
};

const CONFIRMATION: QuoteConfirmation = Object.freeze({
  quoteNumber: 'COT-CO-20261124-PW9ELV',
  country: 'CO',
  locale: 'es-CO',
  currency: 'COP',
  issuedAt: '2026-11-24T00:00:00.000Z',
  policyholder: Object.freeze([Object.freeze(SECTIONS[0]?.rows[0] as NonNullable<SummarySection['rows'][number]>) ]),
  vehicle: Object.freeze([Object.freeze(SECTIONS[1]?.rows[0] as NonNullable<SummarySection['rows'][number]>) ]),
  planName: PLAN.name,
  finalPrice: PLAN.finalPrice,
  formattedFinalPrice: '$ 706.800',
  termsDocumentId: CONFIG.documentId,
});

describe('QuoteStep3SummaryPageComponent (US-03 §6.1, §6.2, §6.3)', () => {
  let fixture: ComponentFixture<QuoteStep3SummaryPageComponent>;
  let store: StoreStub;
  let router: Router;
  let root: HTMLElement;
  let country: WritableSignal<CountryCode>;
  let context: {
    country: WritableSignal<CountryCode>;
    quotePath: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    country = signal<CountryCode>('CO');
    context = {
      country,
      quotePath: vi.fn((step: string) =>
        step === 'quote' ? '/co/quote' : step === 'plans' ? '/co/quote/plans' : '/co/quote/summary',
      ),
    };

    store = {
      summaryStatus: signal<SummaryLoadStatus>('ready'),
      summaryError: signal<string | null>(null),
      summaryConfig: signal<CountryConfig | null>(CONFIG),
      termsAccepted: signal(false),
      termsAvailable: signal(true),
      paymentStatus: signal<PaymentStatus>('idle'),
      confirmation: signal<QuoteConfirmation | null>(null),
      canPay: signal(false),
      summarySections: signal<readonly SummarySection[]>(SECTIONS),
      planSummary: signal<PlanSummary | null>(PLAN),
      loadSummaryContext: vi.fn(async () => undefined),
      retrySummary: vi.fn(async () => undefined),
      setTermsAccepted: vi.fn(),
      submitPayment: vi.fn(),
      newQuote: vi.fn(),
    };
    store.setTermsAccepted.mockImplementation((accepted: boolean) => {
      store.termsAccepted.set(accepted);
      store.canPay.set(accepted && store.termsAvailable());
    });

    await TestBed.configureTestingModule({
      imports: [QuoteStep3SummaryPageComponent],
      providers: [
        provideLocationMocks(),
        provideRouter([]),
        { provide: WizardStore, useValue: store },
        { provide: CountryContextService, useValue: context },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(QuoteStep3SummaryPageComponent);
    root = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  }

  function button(label: string): HTMLButtonElement {
    const found = [...root.querySelectorAll('button')].find(
      (node) => node.textContent?.trim() === label,
    );
    if (!(found instanceof HTMLButtonElement)) {
      throw new Error(`Expected a button labelled "${label}".`);
    }
    return found;
  }

  function heading(): HTMLHeadingElement {
    const found = root.querySelector('h1');
    if (!(found instanceof HTMLHeadingElement)) {
      throw new Error('Expected the summary page heading.');
    }
    return found;
  }

  it('loads the country context once, focuses the heading and marks step 3 active', async () => {
    await render();

    expect(store.loadSummaryContext).toHaveBeenCalledTimes(1);
    expect(store.loadSummaryContext).toHaveBeenCalledWith('CO');
    expect(heading().textContent?.trim()).toBe(UI_COPY.summaryHeading);
    expect(heading().getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(heading());
    expect(root.querySelector('[aria-current="step"]')?.textContent).toContain('Resumen');
  });

  it('shows an accessible loading skeleton and no terms or pay controls', async () => {
    store.summaryStatus.set('loading');
    await render();

    expect(root.querySelector('[data-testid="summary-loading"]')).not.toBeNull();
    expect(root.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(root.querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(root.querySelectorAll('.skeleton')).toHaveLength(3);
    expect(root.textContent).toContain(UI_COPY.summaryLoading);
    expect(root.querySelector('#terms-accepted')).toBeNull();
    expect(root.querySelector('[data-testid="pay-button"]')).toBeNull();
  });

  it('shows the load-error panel with keyboard-reachable retry and back actions', async () => {
    store.summaryStatus.set('error');
    store.summaryError.set('HTTP 500 Server Error');
    await render();

    const alert = root.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(root.textContent).toContain(UI_COPY.summaryErrorTitle);
    expect(root.textContent).toContain(UI_COPY.summaryErrorBody);
    expect(root.textContent).toContain('HTTP 500 Server Error');
    expect(document.activeElement).toBe(heading());

    button(UI_COPY.retry).click();
    expect(store.retrySummary).toHaveBeenCalledWith('CO');
    button(UI_COPY.backToPlans).click();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/co/quote/plans');
    expect(root.querySelector('#terms-accepted')).toBeNull();
  });

  it('blocks the ready form when Strapi terms are empty', async () => {
    store.summaryStatus.set('empty-terms');
    await render();

    expect(root.querySelector('[data-testid="summary-empty-terms"]')).not.toBeNull();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(root.textContent).toContain(UI_COPY.termsUnavailable);
    expect(root.querySelector('#terms-accepted')).toBeNull();
    expect(root.querySelector('[data-testid="pay-button"]')).toBeNull();

    button(UI_COPY.retry).click();
    expect(store.retrySummary).toHaveBeenCalledWith('CO');
  });

  it('renders accessible summary, terms and price markup, then gates Pay on acceptance', async () => {
    await render();

    expect(root.querySelectorAll('app-summary-section')).toHaveLength(2);
    expect(root.querySelectorAll('app-summary-section dl dt')).toHaveLength(2);
    expect(root.querySelectorAll('app-summary-section dl dd')).toHaveLength(2);
    expect(root.textContent).toContain('•••••6789');
    expect(root.textContent).toContain('ABC123');

    const region = root.querySelector('[data-testid="terms-region"]');
    expect(region?.getAttribute('role')).toBe('region');
    expect(region?.getAttribute('tabindex')).toBe('0');
    const regionLabelledBy = region?.getAttribute('aria-labelledby');
    expect(regionLabelledBy).not.toBeNull();
    expect(root.querySelector(`#${regionLabelledBy}`)?.textContent).toContain(UI_COPY.termsHeading);

    const checkbox = root.querySelector('#terms-accepted');
    if (!(checkbox instanceof HTMLInputElement)) {
      throw new Error('Expected the native terms acceptance checkbox.');
    }
    expect(checkbox.getAttribute('type')).toBe('checkbox');
    expect(root.querySelector('label[for="terms-accepted"]')?.textContent).toContain(
      UI_COPY.termsAcceptLabel,
    );
    const describedBy = (checkbox.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter(Boolean);
    expect(describedBy).toContain(regionLabelledBy);
    for (const id of describedBy) {
      expect(root.querySelector(`#${id}`)).not.toBeNull();
    }
    expect(checkbox.hasAttribute('aria-invalid')).toBe(false);

    const price = root.querySelector('.payment__price--final data');
    expect(price?.getAttribute('value')).toBe('706800');

    const pay = button(UI_COPY.pay);
    expect(pay.disabled).toBe(true);
    expect(pay.getAttribute('aria-disabled')).toBe('true');

    checkbox.click();
    fixture.detectChanges();

    expect(store.setTermsAccepted).toHaveBeenCalledWith(true);
    expect(button(UI_COPY.pay).disabled).toBe(false);
    expect(button(UI_COPY.pay).hasAttribute('aria-disabled')).toBe(false);
  });

  it('announces processing and keeps the locked pay button visible', async () => {
    store.paymentStatus.set('processing');
    store.canPay.set(false);
    await render();

    const pay = button(UI_COPY.payProcessing);
    expect(pay.disabled).toBe(true);
    expect(pay.getAttribute('aria-disabled')).toBe('true');
    expect(root.querySelector('.payment__processing')?.getAttribute('aria-live')).toBe('polite');
    expect(root.textContent).toContain(UI_COPY.payProcessing);
  });

  it('shows the rejection alert and retries without reloading the context', async () => {
    store.paymentStatus.set('rejected');
    store.termsAccepted.set(true);
    store.canPay.set(true);
    await render();

    const alert = root.querySelector('[data-testid="payment-rejected"]');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(root.textContent).toContain(UI_COPY.paymentRejected);
    expect(document.activeElement).toBe(heading());
    expect((root.querySelector('#terms-accepted') as HTMLInputElement).checked).toBe(true);

    button(UI_COPY.retryPayment).click();
    expect(store.submitPayment).toHaveBeenCalledTimes(1);
    expect(store.retrySummary).not.toHaveBeenCalled();
  });

  it('replaces the form with the frozen confirmation and starts a new quote', async () => {
    store.paymentStatus.set('confirmed');
    store.confirmation.set(CONFIRMATION);
    await render();

    const confirmation = root.querySelector('[data-testid="quote-confirmation"]');
    expect(confirmation?.getAttribute('role')).toBe('status');
    expect(confirmation?.getAttribute('aria-live')).toBe('polite');
    expect(root.textContent).toContain(UI_COPY.confirmationHeading);
    expect(root.textContent).toContain(CONFIRMATION.quoteNumber);
    expect(root.textContent).toContain('•••••6789');
    expect(root.textContent).toContain(PLAN.name);
    expect(root.textContent).toContain('$ 706.800');
    expect(document.activeElement).toBe(heading());
    expect(root.querySelector('[data-testid="pay-button"]')).toBeNull();
    expect(root.querySelector('#terms-accepted')).toBeNull();

    button(UI_COPY.newQuote).click();
    expect(store.newQuote).toHaveBeenCalledWith('CO');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/co/quote');
  });

  it('navigates through edit links without resetting the in-memory store', async () => {
    await render();
    const sectionsBefore = store.summarySections();
    const planBefore = store.planSummary();
    const configBefore = store.summaryConfig();

    button(UI_COPY.editData).click();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/co/quote');

    button(UI_COPY.changePlan).click();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/co/quote/plans');

    expect(store.newQuote).not.toHaveBeenCalled();
    expect(store.summarySections()).toBe(sectionsBefore);
    expect(store.planSummary()).toBe(planBefore);
    expect(store.summaryConfig()).toBe(configBefore);
  });

  it('reloads Step 3 when the selected country changes', async () => {
    await render();
    expect(store.loadSummaryContext).toHaveBeenCalledTimes(1);

    country.set('CL');
    await render();

    expect(store.loadSummaryContext).toHaveBeenCalledTimes(2);
    expect(store.loadSummaryContext).toHaveBeenLastCalledWith('CL');
  });
});
