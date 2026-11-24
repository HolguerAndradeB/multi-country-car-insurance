import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterOutlet } from '@angular/router';

import { App } from './app';
import { API_BASE_URL } from './core/tokens/api-base-url.token';
import { UI_COPY } from './core/i18n/ui-copy';

describe('App shell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideLocationMocks(),
        { provide: API_BASE_URL, useValue: 'http://strapi.test' },
      ],
    }).compileComponents();
  });

  it('creates the standalone App shell', () => {
    const fixture = TestBed.createComponent(App);

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the header, country switcher and router outlet (no hard-coded page title)', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('header.app-header')).not.toBeNull();
    expect(host.querySelector('main.app-main')).not.toBeNull();
    expect(host.querySelector('router-outlet')).not.toBeNull();
    expect(TestBed.createComponent(App).debugElement.queryAll((node) => node.name === 'router-outlet').length).toBe(1);

    const brand = host.querySelector('.app-header__brand');
    expect(brand?.textContent).toContain(UI_COPY.brand);

    const switcher = host.querySelector<HTMLSelectElement>('#country-switcher');
    expect(switcher).not.toBeNull();
    expect(switcher?.tagName).toBe('SELECT');
    expect(Array.from(switcher?.options ?? []).map((option) => option.value)).toEqual(['co', 'cl']);

    const switcherLabel = host.querySelector('label[for="country-switcher"]');
    expect(switcherLabel?.textContent).toContain(UI_COPY.countryLabel);

    // US-01 chrome copy is shared/neutral; the page heading belongs to the routed page.
    expect(host.querySelector('h1')).toBeNull();
  });

  it('sets the document language from the route country context', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const document = TestBed.inject(DOCUMENT);

    expect(document.documentElement.lang).toBe('es-CO');
  });

  it('provides a RouterOutlet so lazy wizard routes can render', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.debugElement.query((node) => node.injector.get(RouterOutlet, null) !== null)).toBeTruthy();
    expect(TestBed.inject(API_BASE_URL)).toBe('http://strapi.test');
  });

  it('defaults API_BASE_URL to the public Strapi origin with no credentials', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    expect(TestBed.inject(API_BASE_URL)).toBe('http://localhost:1337');
  });
});
