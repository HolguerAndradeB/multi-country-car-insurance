import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  CountryConfigDto,
  CurrencyCode,
  FormFieldDto,
  InsurancePlanDto,
  StrapiListResponse,
} from '../models';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import { CatalogueApi } from './catalogue.api';

const BASE = 'http://strapi.test';
const FIELDS_URL_CO =
  `${BASE}/api/form-fields?filters[country][$eq]=CO&sort=order:asc&pagination[pageSize]=100`;
const FIELDS_URL_CL =
  `${BASE}/api/form-fields?filters[country][$eq]=CL&sort=order:asc&pagination[pageSize]=100`;
const CONFIG_URL_CO = `${BASE}/api/country-configs?filters[country][$eq]=CO`;
const CONFIG_URL_CL = `${BASE}/api/country-configs?filters[country][$eq]=CL`;
const PLANS_URL_CO =
  `${BASE}/api/insurance-plans?filters[country][$eq]=CO` +
  '&filters[active][$eq]=true&sort=order:asc&pagination[pageSize]=100';
const PLANS_URL_CL =
  `${BASE}/api/insurance-plans?filters[country][$eq]=CL` +
  '&filters[active][$eq]=true&sort=order:asc&pagination[pageSize]=100';

function fieldDto(
  overrides: Partial<FormFieldDto> & Pick<FormFieldDto, 'id' | 'documentId' | 'key' | 'order'>,
): FormFieldDto {
  return {
    id: overrides.id,
    documentId: overrides.documentId,
    key: overrides.key,
    label: overrides.label ?? overrides.key,
    type: overrides.type ?? 'text',
    required: overrides.required ?? false,
    validations: overrides.validations ?? null,
    options: overrides.options ?? null,
    helpText: overrides.helpText ?? null,
    errorMessage: overrides.errorMessage ?? null,
    order: overrides.order,
    country: overrides.country ?? 'CO',
    section: overrides.section ?? 'policyholder',
    publishedAt: overrides.publishedAt ?? '2026-11-23T10:00:00.000Z',
  };
}

function configDto(overrides: Partial<CountryConfigDto> = {}): CountryConfigDto {
  return {
    id: overrides.id ?? 1,
    documentId: overrides.documentId ?? 'cfg-1',
    country: overrides.country ?? 'CO',
    countryName: overrides.countryName ?? 'Colombia',
    currency: overrides.currency ?? 'COP',
    localeCode: overrides.localeCode ?? 'es-CO',
    termsAndConditions: overrides.termsAndConditions ?? 'TÉRMINOS DE DEMOSTRACIÓN',
    documentMaskVisibleEnd: overrides.documentMaskVisibleEnd ?? 4,
  };
}

function list<T>(data: readonly T[], total = data.length): StrapiListResponse<T> {
  return {
    data,
    meta: { pagination: { page: 1, pageSize: 100, pageCount: total ? 1 : 0, total } },
  };
}

function planDto(
  overrides: Partial<InsurancePlanDto> & Pick<InsurancePlanDto, 'id' | 'documentId' | 'key' | 'order'>,
): InsurancePlanDto {
  return {
    id: overrides.id,
    documentId: overrides.documentId,
    key: overrides.key,
    name: overrides.name ?? `Plan ${overrides.key}`,
    shortDescription: overrides.shortDescription ?? 'Descripción ficticia de demostración.',
    basePrice: overrides.basePrice ?? '350000',
    currency: overrides.currency ?? 'COP',
    coverages: overrides.coverages ?? [
      { name: 'Responsabilidad civil', limit: 100000000, deductible: null },
    ],
    benefits: overrides.benefits ?? ['Asistencia vial 24 horas'],
    order: overrides.order,
    recommended: overrides.recommended ?? false,
    active: overrides.active ?? true,
    country: overrides.country ?? 'CO',
    publishedAt: overrides.publishedAt ?? '2026-11-23T10:00:00.000Z',
  };
}

describe('CatalogueApi (US01-U09, US01-U18, ADR-002)', () => {
  let api: CatalogueApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });
    api = TestBed.inject(CatalogueApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  it('requests CO with the exact canonical query and no Authorization header', async () => {
    const result = firstValueFrom(api.getFormFields('CO'));
    const request = httpMock.expectOne(FIELDS_URL_CO);

    expect(request.request.method).toBe('GET');
    expect(request.request.urlWithParams).toBe(FIELDS_URL_CO);
    expect((request.request.urlWithParams.match(/filters\[country\]\[\$eq\]/g) ?? []).length).toBe(
      1,
    );
    expect(request.request.urlWithParams).not.toContain('locale');
    expect(request.request.urlWithParams).not.toContain('populate');
    expect(
      request.request.headers.keys().some((name) => name.toLowerCase() === 'authorization'),
    ).toBe(false);

    request.flush(list([]));
    await expect(result).resolves.toEqual([]);
  });

  it('requests CL with the exact canonical query (single country filter)', async () => {
    const result = firstValueFrom(api.getFormFields('CL'));
    const request = httpMock.expectOne(FIELDS_URL_CL);

    expect(request.request.urlWithParams).toBe(FIELDS_URL_CL);
    expect((request.request.urlWithParams.match(/filters\[country\]\[\$eq\]/g) ?? []).length).toBe(
      1,
    );
    request.flush(list([]));
    await expect(result).resolves.toEqual([]);
  });

  it('requests country-configs with exactly one country filter and no status/locale params', async () => {
    const result = firstValueFrom(api.getCountryConfig('CO'));
    const request = httpMock.expectOne(CONFIG_URL_CO);

    expect(request.request.method).toBe('GET');
    expect(request.request.urlWithParams).toBe(CONFIG_URL_CO);
    expect((request.request.urlWithParams.match(/filters\[country\]\[\$eq\]/g) ?? []).length).toBe(
      1,
    );
    expect(request.request.urlWithParams).not.toContain('Authorization');
    request.flush(list([configDto()]));

    await expect(result).resolves.toMatchObject({ country: 'CO', localeCode: 'es-CO' });
  });

  it('maps flattened Strapi 5 DTOs (never .attributes) into typed FormFieldConfig', async () => {
    const result = firstValueFrom(api.getFormFields('CO'));
    const flat = fieldDto({
      id: 7,
      documentId: 'ffco0000000000000000007',
      key: 'licensePlate',
      label: 'Placa del vehículo',
      type: 'text',
      required: true,
      order: 7,
      section: 'vehicle',
      validations: {
        minLength: 6,
        maxLength: 6,
        pattern: '^[A-Z]{3}[0-9]{3}$',
        rule: 'coPlate',
        transform: 'uppercase',
      },
      options: [],
      helpText: 'Formato ABC123, sin espacios ni guiones.',
      errorMessage: 'La placa debe tener el formato ABC123.',
    });
    const nestedV4 = {
      id: 99,
      documentId: 'v4-row',
      attributes: { key: 'shouldNotAppear', label: 'v4', type: 'text', order: 1 },
    } as unknown as FormFieldDto;

    httpMock.expectOne(FIELDS_URL_CO).flush(list([flat, nestedV4]));

    const fields = await result;
    expect(fields).toHaveLength(1);
    expect(fields[0]).toEqual({
      id: 7,
      documentId: 'ffco0000000000000000007',
      key: 'licensePlate',
      label: 'Placa del vehículo',
      type: 'text',
      required: true,
      validations: {
        minLength: 6,
        maxLength: 6,
        pattern: '^[A-Z]{3}[0-9]{3}$',
        rule: 'coPlate',
        transform: 'uppercase',
      },
      options: [],
      helpText: 'Formato ABC123, sin espacios ni guiones.',
      errorMessage: 'La placa debe tener el formato ABC123.',
      order: 7,
      country: 'CO',
      section: 'vehicle',
    });
    expect(fields.some((field) => field.key === 'shouldNotAppear')).toBe(false);
  });

  it('sorts by order asc with id asc tie-breaking', async () => {
    const result = firstValueFrom(api.getFormFields('CO'));
    httpMock.expectOne(FIELDS_URL_CO).flush(
      list([
        fieldDto({ id: 3, documentId: 'd3', key: 'charlie', order: 1 }),
        fieldDto({ id: 1, documentId: 'd1', key: 'alfa', order: 1 }),
        fieldDto({ id: 4, documentId: 'd4', key: 'delta', order: 3 }),
        fieldDto({ id: 2, documentId: 'd2', key: 'bravo', order: 2 }),
      ]),
    );

    const fields = await result;
    expect(fields.map((field) => field.key)).toEqual(['alfa', 'charlie', 'bravo', 'delta']);
    expect(fields.map((field) => field.id)).toEqual([1, 3, 2, 4]);
  });

  it('de-duplicates a repeated key keeping the lowest order, then lowest id (US01-U18)', async () => {
    const result = firstValueFrom(api.getFormFields('CO'));
    httpMock.expectOne(FIELDS_URL_CO).flush(
      list([
        fieldDto({ id: 2, documentId: 'd2', key: 'city', order: 4 }),
        fieldDto({ id: 8, documentId: 'd8', key: 'city', order: 1 }),
        fieldDto({ id: 9, documentId: 'd9', key: 'phone', order: 2 }),
        fieldDto({ id: 3, documentId: 'd3', key: 'phone', order: 2 }),
      ]),
    );

    const fields = await result;
    expect(fields).toHaveLength(2);
    expect(fields[0]).toMatchObject({ key: 'city', id: 8, order: 1 });
    expect(fields[1]).toMatchObject({ key: 'phone', id: 3, order: 2 });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('duplicate field key'));
  });

  it('drops malformed select options instead of crashing', async () => {
    const result = firstValueFrom(api.getFormFields('CL'));
    httpMock.expectOne(FIELDS_URL_CL).flush(
      list([
        fieldDto({
          id: 1,
          documentId: 'd1',
          key: 'city',
          type: 'select',
          country: 'CL',
          order: 1,
          options: [
            { value: 'SCL', label: 'Santiago' },
            { value: 'VAP' } as unknown as { value: string; label: string },
            { label: 'Missing value' } as unknown as { value: string; label: string },
            null as unknown as { value: string; label: string },
          ],
        }),
      ]),
    );

    const fields = await result;
    expect(fields[0].options).toEqual([{ value: 'SCL', label: 'Santiago' }]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('dropping malformed option'));
  });

  it('maps localeCode (never `locale`) and documentMaskVisibleEnd for CL', async () => {
    const result = firstValueFrom(api.getCountryConfig('CL'));
    httpMock.expectOne(CONFIG_URL_CL).flush(
      list([
        configDto({
          id: 2,
          documentId: 'cfgcl000000000000000002',
          country: 'CL',
          countryName: 'Chile',
          currency: 'CLP',
          localeCode: 'es-CL',
          documentMaskVisibleEnd: 4,
        }),
      ]),
    );

    await expect(result).resolves.toEqual({
      id: 2,
      documentId: 'cfgcl000000000000000002',
      country: 'CL',
      countryName: 'Chile',
      currency: 'CLP',
      localeCode: 'es-CL',
      termsAndConditions: 'TÉRMINOS DE DEMOSTRACIÓN',
      documentMaskVisibleEnd: 4,
    });
  });

  it('falls back to the static locale when localeCode is invalid or missing', async () => {
    const result = firstValueFrom(api.getCountryConfig('CL'));
    httpMock.expectOne(CONFIG_URL_CL).flush(
      list([configDto({ country: 'CL', currency: 'CLP', localeCode: 'en-US' })]),
    );

    await expect(result).resolves.toMatchObject({ localeCode: 'es-CL' });
  });

  it('returns null for an empty country-config catalogue', async () => {
    const result = firstValueFrom(api.getCountryConfig('CO'));
    httpMock.expectOne(CONFIG_URL_CO).flush(list([]));
    await expect(result).resolves.toBeNull();
  });

  it('propagates non-2xx responses as HttpErrorResponse (never an empty catalogue)', async () => {
    const result = firstValueFrom(api.getFormFields('CO'));
    httpMock
      .expectOne(FIELDS_URL_CO)
      .flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });

    const error = await result.then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(error).toMatchObject({ status: 500 });
  });

  it('US02-U05: builds the exact canonical CO plans query with no auth and maps flattened DTOs', async () => {
    const result = firstValueFrom(api.getInsurancePlans('CO'));
    const request = httpMock.expectOne(PLANS_URL_CO);

    expect(request.request.method).toBe('GET');
    expect(request.request.urlWithParams).toBe(PLANS_URL_CO);
    expect(
      (request.request.urlWithParams.match(/filters\[country\]\[\$eq\]/g) ?? []).length,
    ).toBe(1);
    expect(
      (request.request.urlWithParams.match(/filters\[active\]\[\$eq\]=true/g) ?? []).length,
    ).toBe(1);
    expect(request.request.urlWithParams).toContain('sort=order:asc');
    expect(request.request.urlWithParams).toContain('pagination[pageSize]=100');
    expect(request.request.urlWithParams).not.toContain('status');
    expect(request.request.urlWithParams).not.toContain('locale');
    expect(request.request.urlWithParams).not.toContain('populate');
    expect(
      request.request.headers.keys().some((name) => name.toLowerCase() === 'authorization'),
    ).toBe(false);

    const nestedV4 = {
      id: 99,
      documentId: 'v4-row',
      attributes: { key: 'shouldNotAppear', basePrice: '1' },
    } as unknown as InsurancePlanDto;
    request.flush(
      list([
        planDto({
          id: 1,
          documentId: 'planco00000000000000001',
          key: 'basico',
          name: 'Plan Básico',
          basePrice: '350000',
          order: 1,
          coverages: [
            { name: 'Asistencia vial', limit: 2000000, deductible: null },
            {
              name: 'Mal formado',
              limit: Number.NaN,
              deductible: 'x',
            } as unknown as { name: string; limit: number; deductible: number | null },
          ],
          benefits: ['Asistencia vial 24 horas', 42 as unknown as string],
        }),
        nestedV4,
      ]),
    );

    const plans = await result;
    expect(plans).toHaveLength(1);
    expect(plans[0]).toEqual({
      id: 1,
      documentId: 'planco00000000000000001',
      key: 'basico',
      name: 'Plan Básico',
      shortDescription: 'Descripción ficticia de demostración.',
      basePrice: 350000,
      currency: 'COP',
      coverages: [{ name: 'Asistencia vial', limit: 2000000, deductible: null }],
      benefits: ['Asistencia vial 24 horas'],
      order: 1,
      recommended: false,
      country: 'CO',
    });
    expect(plans.some((plan) => plan.key === 'shouldNotAppear')).toBe(false);
  });

  it('US02-U05: builds the exact canonical CL plans query', async () => {
    const result = firstValueFrom(api.getInsurancePlans('CL'));
    const request = httpMock.expectOne(PLANS_URL_CL);

    expect(request.request.urlWithParams).toBe(PLANS_URL_CL);
    expect(request.request.method).toBe('GET');
    request.flush(list([]));
    await expect(result).resolves.toEqual([]);
  });

  it('US02-U06: drops ineligible rows, de-duplicates and sorts by order then id', async () => {
    const result = firstValueFrom(api.getInsurancePlans('CO'));
    httpMock.expectOne(PLANS_URL_CO).flush(
      list([
        planDto({ id: 9, documentId: 'duplicate', key: 'duplicate-later', order: 1 }),
        planDto({ id: 4, documentId: 'duplicate', key: 'duplicate-kept', order: 1 }),
        planDto({ id: 8, documentId: 'second-order', key: 'second', order: 2, recommended: true }),
        planDto({ id: 7, documentId: 'first-order', key: 'first', order: 1 }),
        planDto({ id: 10, documentId: 'inactive', key: 'inactive', order: 3, active: false }),
        planDto({ id: 11, documentId: 'foreign', key: 'foreign', order: 3, country: 'CL' }),
        planDto({
          id: 12,
          documentId: 'bad-price',
          key: 'bad-price',
          order: 3,
          basePrice: '350000.5',
        }),
        planDto({
          id: 13,
          documentId: 'bad-currency',
          key: 'bad-currency',
          order: 3,
          currency: 'CLP',
        }),
        planDto({ id: 14, documentId: '', key: 'no-document-id', order: 3 }),
        planDto({ id: 15, documentId: 'no-key', key: '', order: 3 }),
      ]),
    );

    const plans = await result;
    expect(plans.map((plan) => [plan.key, plan.id, plan.order])).toEqual([
      ['duplicate-kept', 4, 1],
      ['first', 7, 1],
      ['second', 8, 2],
    ]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('duplicate plan documentId'));
  });

  it('US02-U06: keeps the lowest id when duplicate rows share the same order', async () => {
    const result = firstValueFrom(api.getInsurancePlans('CL'));
    httpMock.expectOne(PLANS_URL_CL).flush(
      list([
        planDto({
          id: 30,
          documentId: 'same-doc',
          key: 'duplicate-high',
          order: 1,
          country: 'CL',
          currency: 'CLP',
        }),
        planDto({
          id: 20,
          documentId: 'same-doc',
          key: 'duplicate-low',
          order: 1,
          country: 'CL',
          currency: 'CLP',
        }),
      ]),
    );

    const plans = await result;
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ id: 20, key: 'duplicate-low' });
  });

  it('propagates a plans HTTP failure instead of silently emitting an empty list', async () => {
    const result = firstValueFrom(api.getInsurancePlans('CO'));
    httpMock
      .expectOne(PLANS_URL_CO)
      .flush({ error: 'forbidden' }, { status: 403, statusText: 'Forbidden' });

    const error = await result.then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(error).toMatchObject({ status: 403 });
  });
});

interface SeedFixturePlan {
  readonly key: string;
  readonly name: string;
  readonly basePrice: string;
  readonly currency: CurrencyCode;
  readonly coverages: readonly string[];
  readonly benefits: readonly string[];
  readonly order: number;
  readonly recommended: boolean;
  readonly active: boolean;
}

/**
 * Documented mirror of `backend/src/bootstrap/seed-data.ts` §3.3.
 * Kept in the front-end test suite so the seed contract is checked without
 * importing backend files into the Angular test bundle.
 */
const SEED_PLAN_FIXTURES: Readonly<Record<'CO' | 'CL', readonly SeedFixturePlan[]>> = {
  CO: [
    {
      key: 'basico',
      name: 'Plan Básico',
      basePrice: '350000',
      currency: 'COP',
      coverages: ['Responsabilidad civil extracontractual', 'Asistencia vial'],
      benefits: [
        'Asistencia vial 24 horas',
        'Trámite de siniestros en línea',
        'Cobertura en todo el territorio nacional',
      ],
      order: 1,
      recommended: false,
      active: true,
    },
    {
      key: 'estandar',
      name: 'Plan Estándar',
      basePrice: '620000',
      currency: 'COP',
      coverages: ['Responsabilidad civil extracontractual', 'Daños propios y robo', 'Asistencia vial'],
      benefits: [
        'Asistencia vial 24 horas',
        'Auto reemplazo por 5 días',
        'Descuento en talleres aliados',
        'Reporte de siniestros desde la app',
      ],
      order: 2,
      recommended: true,
      active: true,
    },
    {
      key: 'todo-riesgo',
      name: 'Plan Todo Riesgo',
      basePrice: '1150000',
      currency: 'COP',
      coverages: [
        'Responsabilidad civil extracontractual',
        'Daños propios, robo e incendio',
        'Asistencia vial premium',
      ],
      benefits: [
        'Asistencia vial 24 horas sin límite de eventos',
        'Vehículo de reemplazo por 15 días',
        'Cobertura de cristales y espejos',
        'Atención prioritaria de siniestros',
      ],
      order: 3,
      recommended: false,
      active: true,
    },
    {
      key: 'basico-ahorro-inactivo',
      name: 'Plan Básico Ahorro',
      basePrice: '240000',
      currency: 'COP',
      coverages: ['Asistencia vial'],
      benefits: ['Asistencia telefónica 24 horas'],
      order: 4,
      recommended: false,
      active: false,
    },
  ],
  CL: [
    {
      key: 'basico',
      name: 'Plan Básico',
      basePrice: '280000',
      currency: 'CLP',
      coverages: ['Responsabilidad civil', 'Asistencia en carretera'],
      benefits: [
        'Asistencia en carretera 24 horas',
        'Trámite de siniestros en línea',
        'Cobertura en todo Chile',
      ],
      order: 1,
      recommended: false,
      active: true,
    },
    {
      key: 'estandar',
      name: 'Plan Estándar',
      basePrice: '490000',
      currency: 'CLP',
      coverages: ['Responsabilidad civil', 'Robo y daños propios', 'Asistencia en carretera'],
      benefits: [
        'Asistencia en carretera 24 horas',
        'Vehículo reemplazo por 5 días',
        'Descuento en talleres convenidos',
        'Seguimiento de siniestro en línea',
      ],
      order: 2,
      recommended: true,
      active: true,
    },
    {
      key: 'full',
      name: 'Plan Full',
      basePrice: '890000',
      currency: 'CLP',
      coverages: [
        'Responsabilidad civil',
        'Daños propios, robo e incendio',
        'Asistencia en carretera premium',
      ],
      benefits: [
        'Asistencia en carretera 24 horas sin límite de eventos',
        'Vehículo de reemplazo por 15 días',
        'Cobertura de vidrios y espejos',
        'Atención prioritaria de siniestros',
      ],
      order: 3,
      recommended: false,
      active: true,
    },
    {
      key: 'basico-economico-inactivo',
      name: 'Plan Básico Económico',
      basePrice: '190000',
      currency: 'CLP',
      coverages: ['Asistencia en carretera'],
      benefits: ['Asistencia telefónica 24 horas'],
      order: 4,
      recommended: false,
      active: false,
    },
  ],
};

describe('US02-U14 seed fixture invariants (§3.3)', () => {
  it.each([
    ['CO', 'COP', 'Plan Todo Riesgo', 'Plan Básico Ahorro'],
    ['CL', 'CLP', 'Plan Full', 'Plan Básico Económico'],
  ] as const)(
    'has 4 %s rows: 3 active in order 1-3, 1 inactive at order 4, one recommended',
    (country, currency, activeOnlyName, inactiveName) => {
      const rows = SEED_PLAN_FIXTURES[country];
      const active = rows.filter((row) => row.active).sort((a, b) => a.order - b.order);
      const inactive = rows.filter((row) => !row.active);

      expect(rows).toHaveLength(4);
      expect(active.map((row) => row.order)).toEqual([1, 2, 3]);
      expect(active.map((row) => row.key)).toEqual(['basico', 'estandar', activeOnlyName === 'Plan Full' ? 'full' : 'todo-riesgo']);
      expect(inactive).toHaveLength(1);
      expect(inactive[0]).toMatchObject({ order: 4, name: inactiveName, recommended: false });
      expect(active.filter((row) => row.recommended).map((row) => row.key)).toEqual(['estandar']);
      expect(rows.every((row) => row.currency === currency)).toBe(true);
      expect(rows.every((row) => Number.isInteger(Number(row.basePrice)))).toBe(true);
      expect(new Set(active.map((row) => JSON.stringify(row.coverages))).size).toBe(3);
      expect(new Set(active.map((row) => JSON.stringify(row.benefits))).size).toBe(3);
      expect(new Set(rows.map((row) => `${country}:${row.key}`)).size).toBe(4);
    },
  );
});
