import { signal, WritableSignal } from '@angular/core';
import { provideLocationMocks } from '@angular/common/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CountryContextService } from '../../../../core/country/country-context.service';
import { UI_COPY } from '../../../../core/i18n/ui-copy';
import type {
  CatalogueStatus,
  InsurancePlan,
  QuotedPlan,
} from '../../../../core/models';
import { QuoteClock } from '../../../../core/pricing/quote-clock';
import { WizardStore } from '../../state/wizard.store';
import { QuoteStep2PlansPageComponent } from './quote-step2-plans-page';

interface StoreStub {
  readonly plansStatus: WritableSignal<CatalogueStatus>;
  readonly plansError: WritableSignal<string | null>;
  readonly quotedPlans: WritableSignal<readonly QuotedPlan[]>;
  readonly selectedPlanDocumentId: WritableSignal<string | null>;
  readonly canAdvance: WritableSignal<boolean>;
  readonly invalidSelectionNotice: WritableSignal<boolean>;
  readonly restoredSelectionNotice: WritableSignal<boolean>;
  readonly loadPlans: ReturnType<typeof vi.fn>;
  readonly retryPlans: ReturnType<typeof vi.fn>;
  readonly captureClock: ReturnType<typeof vi.fn>;
  readonly selectPlan: ReturnType<typeof vi.fn>;
}

const PLAN: InsurancePlan = {
  id: 2,
  documentId: 'planco00000000000000002',
  key: 'estandar',
  name: 'Plan Estándar',
  shortDescription: 'Descripción ficticia de demostración.',
  basePrice: 620000,
  currency: 'COP',
  coverages: [{ name: 'Asistencia vial', limit: 2000000, deductible: null }],
  benefits: ['Asistencia vial 24 horas'],
  order: 2,
  recommended: true,
  country: 'CO',
};

const QUOTED: QuotedPlan = {
  plan: PLAN,
  basePrice: 620000,
  finalPrice: 706800,
  formattedBasePrice: '$ 620.000',
  formattedFinalPrice: '$ 706.800',
  adjustment: {
    adjustmentPercent: 14,
    reasons: ['por antigüedad del vehículo', 'por edad del conductor'],
    finalPrice: 706800,
  },
};

describe('QuoteStep2PlansPageComponent (US02-U12, §6.1)', () => {
  let fixture: ComponentFixture<QuoteStep2PlansPageComponent>;
  let store: StoreStub;
  let router: Router;
  let root: HTMLElement;

  beforeEach(async () => {
    store = {
      plansStatus: signal<CatalogueStatus>('idle'),
      plansError: signal<string | null>(null),
      quotedPlans: signal<readonly QuotedPlan[]>([]),
      selectedPlanDocumentId: signal<string | null>(null),
      canAdvance: signal(false),
      invalidSelectionNotice: signal(false),
      restoredSelectionNotice: signal(false),
      loadPlans: vi.fn(async () => undefined),
      retryPlans: vi.fn(async () => undefined),
      captureClock: vi.fn(),
      selectPlan: vi.fn(),
    };
    const context = {
      country: signal<'CO'>('CO'),
      locale: signal<'es-CO'>('es-CO'),
      currency: signal<'COP'>('COP'),
      quotePath: vi.fn((step: string) =>
        step === 'quote' ? '/co/quote' : step === 'summary' ? '/co/quote/summary' : '/co/quote/plans',
      ),
    };

    await TestBed.configureTestingModule({
      imports: [QuoteStep2PlansPageComponent],
      providers: [
        provideLocationMocks(),
        provideRouter([]),
        { provide: WizardStore, useValue: store },
        { provide: CountryContextService, useValue: context },
        { provide: QuoteClock, useValue: { today: new Date(2026, 10, 23), currentYear: 2026 } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(QuoteStep2PlansPageComponent);
    root = fixture.nativeElement as HTMLElement;
  });

  function setStatus(status: CatalogueStatus): void {
    store.plansStatus.set(status);
    fixture.detectChanges();
  }

  function text(): string {
    return root.textContent ?? '';
  }

  it('captures the clock and fetches plans once on route entry', () => {
    fixture.detectChanges();

    expect(store.captureClock).toHaveBeenCalledTimes(1);
    expect(store.loadPlans).toHaveBeenCalledWith('CO');
  });

  it('shows an accessible loading skeleton with no radios or continue button', () => {
    setStatus('loading');

    expect(root.querySelector('section[aria-busy="true"]')).not.toBeNull();
    expect(root.querySelectorAll('.skeleton')).toHaveLength(3);
    expect(text()).toContain(UI_COPY.plansLoading);
    expect(root.querySelector('input[type="radio"]')).toBeNull();
    expect(text()).not.toContain(UI_COPY.continue);
  });

  it('US02-U12: renders the exact empty copy and both recovery actions', () => {
    setStatus('empty');

    const panel = root.querySelector('[role="status"]');
    expect(panel).not.toBeNull();
    expect(panel?.querySelector('h1')?.textContent).toContain(UI_COPY.plansEmptyTitle);
    expect(text()).toContain(UI_COPY.plansEmptyBody);
    const buttons = [...root.querySelectorAll('button')].map((node) => node.textContent?.trim());
    expect(buttons).toEqual([UI_COPY.retry, UI_COPY.backToData]);
    expect(root.querySelector('input[type="radio"]')).toBeNull();
    expect(text()).not.toContain(UI_COPY.continue);
  });

  it('US02-U12: renders the exact error copy, HTTP detail and recovery actions', () => {
    store.plansError.set('HTTP 500 Server Error');
    setStatus('error');

    const panel = root.querySelector('[role="alert"]');
    expect(panel).not.toBeNull();
    expect(panel?.querySelector('h1')?.textContent).toContain(UI_COPY.plansErrorTitle);
    expect(text()).toContain(UI_COPY.plansErrorBody);
    expect(text()).toContain('HTTP 500 Server Error');
    const buttons = [...root.querySelectorAll('button')].map((node) => node.textContent?.trim());
    expect(buttons).toEqual([UI_COPY.retry, UI_COPY.backToData]);
    expect(root.querySelector('input[type="radio"]')).toBeNull();
    expect(text()).not.toContain(UI_COPY.continue);
  });

  it('renders the fieldset, hidden prices, footnote and a disabled continue until selection', () => {
    store.quotedPlans.set([QUOTED]);
    setStatus('ready');

    expect(root.querySelector('fieldset')).not.toBeNull();
    expect(root.querySelector('legend')?.textContent).toContain(UI_COPY.planSelectLegend);
    expect(root.querySelectorAll('app-plan-card')).toHaveLength(1);
    expect(text()).toContain(UI_COPY.simulatedFootnote);
    const continueButton = root.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);

    store.canAdvance.set(true);
    fixture.detectChanges();
    expect((root.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows polite notices for stale and restored selections without stealing focus', () => {
    store.quotedPlans.set([QUOTED]);
    store.invalidSelectionNotice.set(true);
    store.restoredSelectionNotice.set(true);
    setStatus('ready');

    const notices = [...root.querySelectorAll('[role="status"]')].map(
      (node) => node.textContent?.trim(),
    );
    expect(notices).toContain(UI_COPY.invalidSelectionNotice);
    expect(notices).toContain(UI_COPY.restoredSelectionNotice);
    expect(notices.every((value) => value !== undefined)).toBe(true);
  });

  it('wires selection, retry, back and submit actions to the store and router', () => {
    store.quotedPlans.set([QUOTED]);
    store.canAdvance.set(true);
    setStatus('ready');

    (root.querySelector('input[type="radio"]') as HTMLInputElement).dispatchEvent(new Event('change'));
    expect(store.selectPlan).toHaveBeenCalledWith('planco00000000000000002');

    const back = [...root.querySelectorAll('button')].find(
      (node) => node.textContent?.trim() === UI_COPY.backToData,
    ) as HTMLButtonElement;
    back.click();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/co/quote');

    (root.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/co/quote/summary');

    store.plansStatus.set('error');
    fixture.detectChanges();
    const retry = [...root.querySelectorAll('button')].find(
      (node) => node.textContent?.trim() === UI_COPY.retry,
    ) as HTMLButtonElement;
    retry.click();
    expect(store.retryPlans).toHaveBeenCalledTimes(1);
  });
});
