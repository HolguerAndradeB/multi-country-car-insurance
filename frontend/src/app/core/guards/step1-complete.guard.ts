import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { COUNTRY_CATALOG_BY_CODE, toCountryCode } from '../country/country-catalog';
import { WizardStore } from '../../features/quote/wizard.store';

/** US-01 placeholder guard: a deep link without a valid Step 1 returns to Step 1. */
export const step1CompleteGuard: CanActivateFn = async (route) => {
  const store = inject(WizardStore);
  const router = inject(Router);
  const country = toCountryCode(route.paramMap.get('country'));

  if (store.isLoadedFor(country) && store.form()?.valid) {
    return true;
  }

  await store.load(country);
  const form = store.form();
  if (store.isLoadedFor(country) && form?.valid) {
    return true;
  }

  return router.createUrlTree([`/${COUNTRY_CATALOG_BY_CODE[country].routeSegment}/quote`]);
};
