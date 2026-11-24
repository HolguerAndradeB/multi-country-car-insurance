import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CatalogueStatus, InsurancePlan, WizardFormGroup } from '../models';
import { WizardStore } from '../../features/quote/wizard.store';
import { step2CompleteGuard } from './step2-complete.guard';

interface StoreStub {
  readonly isLoadedFor: ReturnType<typeof vi.fn>;
  readonly form: ReturnType<typeof signal<WizardFormGroup | null>>;
  readonly selectedPlan: ReturnType<typeof signal<InsurancePlan | null>>;
  readonly selectedPlanDocumentId: ReturnType<typeof signal<string | null>>;
  readonly plansStatus: ReturnType<typeof signal<CatalogueStatus>>;
  readonly load: ReturnType<typeof vi.fn>;
  readonly loadPlans: ReturnType<typeof vi.fn>;
}

function routeWithCountry(country: string): ActivatedRouteSnapshot {
  return {
    paramMap: convertToParamMap({ country }),
  } as ActivatedRouteSnapshot;
}

const SELECTED: InsurancePlan = {
  id: 2,
  documentId: 'planco00000000000000002',
  key: 'estandar',
  name: 'Plan Estándar',
  shortDescription: 'Plan ficticio de demostración.',
  basePrice: 620000,
  currency: 'COP',
  coverages: [],
  benefits: [],
  order: 2,
  recommended: true,
  country: 'CO',
};

describe('step2CompleteGuard (US02-U11, US02-E15)', () => {
  let router: Router;
  let store: StoreStub;
  const state = {} as RouterStateSnapshot;

  beforeEach(async () => {
    store = {
      isLoadedFor: vi.fn(() => true),
      form: signal({ valid: true } as unknown as WizardFormGroup),
      selectedPlan: signal<InsurancePlan | null>(SELECTED),
      selectedPlanDocumentId: signal<string | null>(SELECTED.documentId),
      plansStatus: signal<CatalogueStatus>('ready'),
      load: vi.fn(async () => undefined),
      loadPlans: vi.fn(async () => undefined),
    };

    await TestBed.configureTestingModule({
      providers: [
        provideLocationMocks(),
        provideRouter([]),
        { provide: WizardStore, useValue: store },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
  });

  function activate(country: string): ReturnType<CanActivateFn> {
    return TestBed.runInInjectionContext(() => step2CompleteGuard(routeWithCountry(country), state));
  }

  async function redirectUrl(result: ReturnType<CanActivateFn>): Promise<string> {
    return router.serializeUrl((await result) as UrlTree);
  }

  it('allows navigation when Step 1 is valid and an active plan is selected', async () => {
    await expect(activate('CO')).resolves.toBe(true);
    expect(store.load).not.toHaveBeenCalled();
    expect(store.isLoadedFor).toHaveBeenCalledWith('CO');
  });

  it('redirects to Step 1 when Step 1 is missing or invalid after reload', async () => {
    store.isLoadedFor.mockReturnValue(false);
    store.form.set(null);

    expect(await redirectUrl(activate('CL'))).toBe('/cl/quote');
    expect(store.load).toHaveBeenCalledWith('CL');
  });

  it('redirects to Step 1 when the restored Step 1 form is invalid', async () => {
    store.form.set({ valid: false } as unknown as WizardFormGroup);

    expect(await redirectUrl(activate('co'))).toBe('/co/quote');
  });

  it('redirects back to plans when Step 1 is valid but no active plan is selected', async () => {
    store.selectedPlan.set(null);

    expect(await redirectUrl(activate('CL'))).toBe('/cl/quote/plans');
    expect(store.load).not.toHaveBeenCalled();
  });

  it('redirects back to plans when the selected plan disappeared after a stale restore', async () => {
    store.selectedPlan.set(null);
    store.isLoadedFor.mockReturnValue(true);

    expect(await redirectUrl(activate('CO'))).toBe('/co/quote/plans');
  });

  it('hydrates plans on cold reload when a persisted selectedPlanDocumentId exists and resolves', async () => {
    store.selectedPlan.set(null);
    store.selectedPlanDocumentId.set(SELECTED.documentId);
    store.plansStatus.set('idle');
    store.loadPlans.mockImplementation(async () => {
      store.plansStatus.set('ready');
      store.selectedPlan.set(SELECTED);
    });

    await expect(activate('CO')).resolves.toBe(true);
    expect(store.loadPlans).toHaveBeenCalledWith('CO');
  });

  it('redirects to plans on cold reload when the persisted selectedPlanDocumentId is no longer active', async () => {
    store.selectedPlan.set(null);
    store.selectedPlanDocumentId.set('stale-plan-id');
    store.plansStatus.set('idle');
    store.loadPlans.mockImplementation(async () => {
      store.plansStatus.set('ready');
      store.selectedPlan.set(null);
    });

    expect(await redirectUrl(activate('CO'))).toBe('/co/quote/plans');
    expect(store.loadPlans).toHaveBeenCalledWith('CO');
  });
});
