import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { COUNTRY_CATALOG_BY_CODE, toCountryCode } from '../country/country-catalog';

/** Canonicalises `:country` and redirects unknown/uppercase segments. */
export const countryRouteGuard: CanActivateFn = (route) => {
  const raw = route.paramMap.get('country');
  const country = toCountryCode(raw);
  const canonicalSegment = COUNTRY_CATALOG_BY_CODE[country].routeSegment;

  if (!raw || raw !== canonicalSegment) {
    return inject(Router).createUrlTree([`/${canonicalSegment}/quote`]);
  }
  return true;
};
