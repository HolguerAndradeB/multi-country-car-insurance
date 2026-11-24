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
import { beforeEach, describe, expect, it } from 'vitest';

import { countryRouteGuard } from './country-route.guard';

function routeWithCountry(country: string | null): ActivatedRouteSnapshot {
  return {
    paramMap: convertToParamMap(country === null ? {} : { country }),
  } as ActivatedRouteSnapshot;
}

describe('countryRouteGuard (US01-U14, AC1/E03)', () => {
  let router: Router;
  const state = {} as RouterStateSnapshot;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideLocationMocks(), provideRouter([])],
    }).compileComponents();
    router = TestBed.inject(Router);
  });

  function activate(country: string | null): ReturnType<CanActivateFn> {
    return TestBed.runInInjectionContext(() => countryRouteGuard(routeWithCountry(country), state));
  }

  it('allows canonical lowercase co and cl segments', () => {
    expect(activate('co')).toBe(true);
    expect(activate('cl')).toBe(true);
  });

  it('redirects uppercase CO to /co/quote', () => {
    const result = activate('CO');

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/co/quote');
  });

  it('redirects uppercase CL to /cl/quote', () => {
    const result = activate('CL');

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/cl/quote');
  });

  it('redirects an unknown country to /co/quote (never an empty catalogue)', () => {
    for (const raw of ['xx', 'MX', 'colombia', '']) {
      const result = activate(raw);
      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree)).toBe('/co/quote');
    }
  });

  it('redirects a missing param to /co/quote', () => {
    const result = activate(null);

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/co/quote');
  });
});
