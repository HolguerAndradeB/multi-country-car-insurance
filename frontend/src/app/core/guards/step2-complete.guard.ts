import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { COUNTRY_CATALOG_BY_CODE, toCountryCode } from '../country/country-catalog';
import { WizardStore } from '../../features/quote/wizard.store';

/** US-02: Step 3 requires a valid Step 1 and an active selected plan. */
export const step2CompleteGuard: CanActivateFn = async (route) => {
  const store = inject(WizardStore);
  const router = inject(Router);
  const country = toCountryCode(route.paramMap.get('country'));
  const segment = COUNTRY_CATALOG_BY_CODE[country].routeSegment;

  if (!store.isLoadedFor(country) || !store.form()?.valid) {
    await store.load(country);
    if (!store.isLoadedFor(country) || !store.form()?.valid) {
      return router.createUrlTree([`/${segment}/quote`]);
    }
  }

  if (store.selectedPlan() === null) {
    return router.createUrlTree([`/${segment}/quote/plans`]);
  }

  return true;
};
