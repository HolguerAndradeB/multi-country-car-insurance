import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CountryConfigDto, FormFieldDto, StrapiListResponse } from '../models';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import { CatalogueApi } from './catalogue.api';

const BASE = 'http://strapi.test';
const FIELDS_URL_CO =
  `${BASE}/api/form-fields?filters[country][$eq]=CO&sort=order:asc&pagination[pageSize]=100`;
const FIELDS_URL_CL =
  `${BASE}/api/form-fields?filters[country][$eq]=CL&sort=order:asc&pagination[pageSize]=100`;
const CONFIG_URL_CO = `${BASE}/api/country-configs?filters[country][$eq]=CO`;
const CONFIG_URL_CL = `${BASE}/api/country-configs?filters[country][$eq]=CL`;

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
});
