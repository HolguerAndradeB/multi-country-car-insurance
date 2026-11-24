import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { toCountryCode, toRouteSegment } from './country-catalog';
import { CountryContextService } from './country-context.service';

@Component({ template: '', standalone: true })
class RouteTargetComponent {}

describe('toCountryCode / toRouteSegment', () => {
  it('canonicalises co/CO/cl/CL and falls back to CO for unknown values', () => {
    expect(toCountryCode('co')).toBe('CO');
    expect(toCountryCode('CO')).toBe('CO');
    expect(toCountryCode('cl')).toBe('CL');
    expect(toCountryCode('CL')).toBe('CL');
    expect(toCountryCode('xx')).toBe('CO');
    expect(toCountryCode(null)).toBe('CO');
    expect(toCountryCode(undefined)).toBe('CO');
    expect(toRouteSegment('CL')).toBe('cl');
    expect(toRouteSegment('xx')).toBe('co');
  });
});

describe('CountryContextService (US01-U14)', () => {
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideLocationMocks(),
        provideRouter([
          { path: ':country/quote/plans', component: RouteTargetComponent },
          { path: ':country/quote', component: RouteTargetComponent },
          { path: '**', component: RouteTargetComponent },
        ]),
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    await router.navigateByUrl('/');
  });

  it('derives Colombia context from the canonical lowercase route param', async () => {
    await router.navigateByUrl('/co/quote');
    const context = TestBed.inject(CountryContextService);

    expect(context.country()).toBe('CO');
    expect(context.locale()).toBe('es-CO');
    expect(context.currency()).toBe('COP');
    expect(context.entry().displayName).toBe('Colombia');
    expect(context.currentStep()).toBe('policyholder');
    expect(context.quotePath()).toBe('/co/quote');
    expect(context.quotePath('plans')).toBe('/co/quote/plans');
    expect(context.pathFor('CL')).toBe('/cl/quote');
  });

  it('derives Chile context from /cl/quote', async () => {
    await router.navigateByUrl('/cl/quote');
    const context = TestBed.inject(CountryContextService);

    expect(context.country()).toBe('CL');
    expect(context.locale()).toBe('es-CL');
    expect(context.currency()).toBe('CLP');
    expect(context.entry().displayName).toBe('Chile');
    expect(context.quotePath('plans')).toBe('/cl/quote/plans');
  });

  it('normalises uppercase CO and CL route params', async () => {
    await router.navigateByUrl('/CO/quote');
    const context = TestBed.inject(CountryContextService);
    expect(context.country()).toBe('CO');

    await router.navigateByUrl('/CL/quote');
    expect(context.country()).toBe('CL');
  });

  it('recognises the plans step from the router URL', async () => {
    await router.navigateByUrl('/cl/quote/plans');
    const context = TestBed.inject(CountryContextService);

    expect(context.currentStep()).toBe('plans');
    expect(context.country()).toBe('CL');
  });

  it('falls back to Colombia for an unknown country param', async () => {
    await router.navigateByUrl('/xx/quote');
    const context = TestBed.inject(CountryContextService);

    expect(context.country()).toBe('CO');
    expect(context.locale()).toBe('es-CO');
  });

  it('reacts to NavigationEnd when switching country at runtime', async () => {
    const context = TestBed.inject(CountryContextService);
    expect(context.country()).toBe('CO');

    await router.navigateByUrl('/cl/quote');
    expect(context.country()).toBe('CL');

    await router.navigateByUrl('/co/quote');
    expect(context.country()).toBe('CO');
  });
});
