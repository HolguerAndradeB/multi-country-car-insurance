import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import type { AppLocale, CountryCode, CountryRouteSegment, CurrencyCode, WizardStep } from '../models';
import { COUNTRY_CATALOG_BY_CODE, toCountryCode } from './country-catalog';

interface RouteContext {
  readonly country: CountryCode;
  readonly step: WizardStep;
}

/** Reads the country exclusively from the router; no root `ActivatedRoute` injection. */
@Injectable({ providedIn: 'root' })
export class CountryContextService {
  private readonly router = inject(Router);

  private readonly routeContext = signal<RouteContext>(this.readFromRouter());

  readonly country = computed<CountryCode>(() => this.routeContext().country);
  readonly currentStep = computed<WizardStep>(() => this.routeContext().step);
  readonly entry = computed(() => COUNTRY_CATALOG_BY_CODE[this.country()]);
  readonly locale = computed<AppLocale>(() => this.entry().locale);
  readonly currency = computed<CurrencyCode>(() => this.entry().currency);

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.routeContext.set(this.readFromRouter()));
  }

  /** Single place where internal wizard links are built (ADR-001 §4.2). */
  quotePath(step: 'quote' | 'plans' | 'summary' = 'quote'): string {
    const segment = this.entry().routeSegment;
    return this.buildPath(segment, step);
  }

  pathFor(country: CountryCode, step: 'quote' | 'plans' | 'summary' = 'quote'): string {
    return this.buildPath(COUNTRY_CATALOG_BY_CODE[country].routeSegment, step);
  }

  private buildPath(segment: CountryRouteSegment, step: 'quote' | 'plans' | 'summary'): string {
    const suffix = step === 'quote' ? '' : `/${step}`;
    return `/${segment}/quote${suffix}`;
  }

  private readFromRouter(): RouteContext {
    const snapshot = this.router.routerState.snapshot.root;
    const path = this.router.url.split('?')[0];
    return {
      country: readCountryFromSnapshot(snapshot),
      step: path.includes('/summary') ? 'summary' : path.includes('/plans') ? 'plans' : 'policyholder',
    };
  }
}

/** Walks down `firstChild` snapshots so this service works at the root injector. */
export function readCountryFromSnapshot(snapshot: ActivatedRouteSnapshot): CountryCode {
  let current: ActivatedRouteSnapshot = snapshot;
  while (current.firstChild) {
    current = current.firstChild;
  }
  return toCountryCode(current.paramMap.get('country'));
}
