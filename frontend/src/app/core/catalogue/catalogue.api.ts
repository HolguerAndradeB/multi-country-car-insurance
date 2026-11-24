import { HttpClient } from '@angular/common/http';
import { isDevMode, Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import type {
  AppLocale,
  CountryCode,
  CountryConfig,
  CountryConfigDto,
  CurrencyCode,
  FormFieldConfig,
  FormFieldDto,
  FormFieldOption,
  FormFieldSection,
  FormFieldType,
  FormFieldValidationRules,
  InsurancePlan,
  PlanCoverageItem,
  StrapiListResponse,
} from '../models';
import { COUNTRY_CATALOG_BY_CODE } from '../country/country-catalog';
import { API_BASE_URL } from '../tokens/api-base-url.token';

const FIELD_TYPES: readonly FormFieldType[] = ['text', 'number', 'select', 'date', 'checkbox'];
const SECTIONS: readonly FormFieldSection[] = ['policyholder', 'vehicle'];
const RULES: readonly string[] = [
  'legalAge',
  'vehicleYear',
  'clRut',
  'coDocumentNumber',
  'coPlate',
  'clPlate',
];

type MutableValidations = {
  -readonly [K in keyof FormFieldValidationRules]?: FormFieldValidationRules[K];
};

/** The only place that builds Strapi URLs and appends the country filter. */
@Injectable({ providedIn: 'root' })
export class CatalogueApi {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getFormFields(country: CountryCode): Observable<readonly FormFieldConfig[]> {
    const url =
      `${this.apiBaseUrl}/api/form-fields?filters[country][$eq]=${country}` +
      '&sort=order:asc&pagination[pageSize]=100';

    return this.http
      .get<StrapiListResponse<unknown>>(url)
      .pipe(map((response) => this.mapFields(response, country)));
  }

  getCountryConfig(country: CountryCode): Observable<CountryConfig | null> {
    const url = `${this.apiBaseUrl}/api/country-configs?filters[country][$eq]=${country}`;
    return this.http
      .get<StrapiListResponse<unknown>>(url)
      .pipe(map((response) => this.mapCountryConfig(response, country)));
  }

  getInsurancePlans(country: CountryCode): Observable<readonly InsurancePlan[]> {
    const url =
      `${this.apiBaseUrl}/api/insurance-plans?filters[country][$eq]=${country}` +
      '&filters[active][$eq]=true&sort=order:asc&pagination[pageSize]=100';

    return this.http
      .get<StrapiListResponse<unknown>>(url)
      .pipe(map((response) => this.mapPlans(response, country)));
  }

  private mapPlans(
    response: StrapiListResponse<unknown>,
    country: CountryCode,
  ): readonly InsurancePlan[] {
    const rows = Array.isArray(response.data) ? response.data : [];
    const pagination = response.meta?.pagination;
    if (pagination && pagination.total > rows.length && isDevMode()) {
      console.warn(
        `[catalogue] only ${rows.length} of ${pagination.total} plans for ${country} were received (page size 100).`,
      );
    }

    const mapped: InsurancePlan[] = [];
    for (const row of rows) {
      const plan = this.toInsurancePlan(row, country);
      if (plan) {
        mapped.push(plan);
      }
    }

    mapped.sort((left, right) => left.order - right.order || left.id - right.id);
    const byDocumentId = new Map<string, InsurancePlan>();
    for (const plan of mapped) {
      const existing = byDocumentId.get(plan.documentId);
      if (existing) {
        if (isDevMode()) {
          console.warn(
            `[catalogue] duplicate plan documentId "${plan.documentId}"; keeping order ${existing.order} (id ${existing.id}).`,
          );
        }
        continue;
      }
      byDocumentId.set(plan.documentId, plan);
    }

    return [...byDocumentId.values()].sort(
      (left, right) => left.order - right.order || left.id - right.id,
    );
  }

  private toInsurancePlan(raw: unknown, country: CountryCode): InsurancePlan | null {
    if (!isRecord(raw)) {
      this.warnInvalidPlan('non-object row');
      return null;
    }

    const id = raw['id'];
    const documentId = raw['documentId'];
    const key = raw['key'];
    const name = raw['name'];
    const shortDescription = raw['shortDescription'];
    const rawPrice = raw['basePrice'];
    const currency = raw['currency'];
    const order = raw['order'];
    const active = raw['active'];
    const rowCountry = raw['country'];
    const recommended = raw['recommended'];

    if (
      typeof id !== 'number' ||
      !Number.isFinite(id) ||
      typeof documentId !== 'string' ||
      documentId.trim().length === 0 ||
      typeof key !== 'string' ||
      key.trim().length === 0 ||
      typeof order !== 'number' ||
      !Number.isFinite(order)
    ) {
      this.warnInvalidPlan('missing or malformed required attributes');
      return null;
    }

    if (active !== true) {
      this.warnInvalidPlan(`inactive plan "${key}"`);
      return null;
    }
    if (rowCountry !== country) {
      this.warnInvalidPlan(`plan "${key}" from country ${String(rowCountry)} in ${country} response`);
      return null;
    }

    const hasPrice =
      typeof rawPrice === 'number' ||
      (typeof rawPrice === 'string' && rawPrice.trim().length > 0);
    const basePrice = hasPrice ? Number(rawPrice) : Number.NaN;
    if (!Number.isFinite(basePrice) || !Number.isInteger(basePrice) || basePrice < 0) {
      this.warnInvalidPlan(`invalid basePrice on plan "${key}"`);
      return null;
    }

    const expectedCurrency = COUNTRY_CATALOG_BY_CODE[country].currency;
    if (currency !== expectedCurrency) {
      this.warnInvalidPlan(`currency mismatch on plan "${key}"`);
      return null;
    }

    return {
      id,
      documentId,
      key,
      name: typeof name === 'string' && name.length > 0 ? name : key,
      shortDescription: typeof shortDescription === 'string' ? shortDescription : '',
      basePrice,
      currency: expectedCurrency as CurrencyCode,
      coverages: this.parseCoverages(raw['coverages'], key),
      benefits: this.parseBenefits(raw['benefits'], key),
      order,
      recommended: recommended === true,
      country,
    };
  }

  private parseCoverages(raw: unknown, planKey: string): readonly PlanCoverageItem[] {
    if (!Array.isArray(raw)) {
      if (raw !== null && raw !== undefined && isDevMode()) {
        console.warn(`[catalogue] dropping malformed coverages on plan "${planKey}".`);
      }
      return [];
    }

    const coverages: PlanCoverageItem[] = [];
    for (const entry of raw) {
      if (
        !isRecord(entry) ||
        typeof entry['name'] !== 'string' ||
        entry['name'].trim().length === 0 ||
        typeof entry['limit'] !== 'number' ||
        !Number.isFinite(entry['limit'])
      ) {
        if (isDevMode()) {
          console.warn(`[catalogue] dropping malformed coverage on plan "${planKey}".`);
        }
        continue;
      }

      const rawDeductible = entry['deductible'];
      const deductible =
        rawDeductible === null || rawDeductible === undefined
          ? null
          : typeof rawDeductible === 'number' && Number.isFinite(rawDeductible)
            ? rawDeductible
            : null;
      coverages.push({ name: entry['name'], limit: entry['limit'], deductible });
    }
    return coverages;
  }

  private parseBenefits(raw: unknown, planKey: string): readonly string[] {
    if (!Array.isArray(raw)) {
      if (raw !== null && raw !== undefined && isDevMode()) {
        console.warn(`[catalogue] dropping malformed benefits on plan "${planKey}".`);
      }
      return [];
    }

    const benefits: string[] = [];
    for (const entry of raw) {
      if (typeof entry === 'string') {
        benefits.push(entry);
      } else if (isDevMode()) {
        console.warn(`[catalogue] dropping malformed benefit on plan "${planKey}".`);
      }
    }
    return benefits;
  }

  private mapFields(
    response: StrapiListResponse<unknown>,
    country: CountryCode,
  ): readonly FormFieldConfig[] {
    const rows = Array.isArray(response.data) ? response.data : [];
    const pagination = response.meta?.pagination;
    if (pagination && pagination.total > rows.length && isDevMode()) {
      console.warn(
        `[catalogue] only ${rows.length} of ${pagination.total} fields for ${country} were received (page size 100).`,
      );
    }

    const mapped: FormFieldConfig[] = [];
    for (const row of rows) {
      const field = this.toFormFieldConfig(row, country);
      if (field) {
        mapped.push(field);
      }
    }

    // De-duplicate by key keeping the lowest order (tie-break by lowest id), then apply rendering order.
    mapped.sort(
      (left, right) =>
        left.key.localeCompare(right.key) || left.order - right.order || left.id - right.id,
    );
    const byKey = new Map<string, FormFieldConfig>();
    for (const field of mapped) {
      const existing = byKey.get(field.key);
      if (existing && existing.id !== field.id && isDevMode()) {
        console.warn(
          `[catalogue] duplicate field key "${field.key}"; keeping order ${existing.order} (id ${existing.id}).`,
        );
      }
      if (!existing) {
        byKey.set(field.key, field);
      }
    }

    return [...byKey.values()].sort((left, right) => left.order - right.order || left.id - right.id);
  }

  private toFormFieldConfig(raw: unknown, country: CountryCode): FormFieldConfig | null {
    if (!isRecord(raw)) {
      this.warnInvalid('non-object row');
      return null;
    }

    const id = raw['id'];
    const documentId = raw['documentId'];
    const key = raw['key'];
    const label = raw['label'];
    const type = raw['type'];
    const required = raw['required'];
    const order = raw['order'];
    const section = raw['section'];
    const rowCountry = raw['country'];

    if (
      typeof id !== 'number' ||
      typeof documentId !== 'string' ||
      typeof key !== 'string' ||
      !/^[a-zA-Z][a-zA-Z0-9]*$/.test(key) ||
      typeof label !== 'string' ||
      typeof type !== 'string' ||
      !FIELD_TYPES.includes(type as FormFieldType) ||
      typeof required !== 'boolean' ||
      typeof order !== 'number'
    ) {
      this.warnInvalid('missing or malformed required attributes');
      return null;
    }

    if (typeof rowCountry === 'string' && rowCountry !== country) {
      if (isDevMode()) {
        console.warn(`[catalogue] dropping field "${key}" from country ${rowCountry} in ${country} response.`);
      }
      return null;
    }

    const fieldType = type as FormFieldType;
    const fieldSection: FormFieldSection =
      typeof section === 'string' && SECTIONS.includes(section as FormFieldSection)
        ? (section as FormFieldSection)
        : 'policyholder';

    return {
      id,
      documentId,
      key,
      label,
      type: fieldType,
      required,
      validations: this.parseValidations(raw['validations'], key),
      options: this.parseOptions(raw['options'], key),
      helpText: this.parseNullableString(raw['helpText']),
      errorMessage: this.parseNullableString(raw['errorMessage']),
      order,
      country,
      section: fieldSection,
    };
  }

  private parseValidations(raw: unknown, fieldKey: string): FormFieldValidationRules {
    if (!isRecord(raw)) {
      return {};
    }

    const rules: MutableValidations = {};
    const minLength = raw['minLength'];
    const maxLength = raw['maxLength'];
    const min = raw['min'];
    const max = raw['max'];
    if (typeof minLength === 'number' && Number.isFinite(minLength)) {
      rules.minLength = minLength;
    }
    if (typeof maxLength === 'number' && Number.isFinite(maxLength)) {
      rules.maxLength = maxLength;
    }
    if (typeof min === 'number' && Number.isFinite(min)) {
      rules.min = min;
    }
    if (typeof max === 'number' && Number.isFinite(max)) {
      rules.max = max;
    }

    const minDate = raw['minDate'];
    const maxDate = raw['maxDate'];
    if (typeof minDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(minDate)) {
      rules.minDate = minDate;
    }
    if (typeof maxDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(maxDate)) {
      rules.maxDate = maxDate;
    }

    const pattern = raw['pattern'];
    if (typeof pattern === 'string' && pattern.length > 0) {
      rules.pattern = pattern;
    }
    const integer = raw['integer'];
    if (typeof integer === 'boolean') {
      rules.integer = integer;
    }
    const transform = raw['transform'];
    if (transform === 'uppercase' || transform === 'trim') {
      rules.transform = transform;
    }
    const rule = raw['rule'];
    if (typeof rule === 'string' && RULES.includes(rule)) {
      rules.rule = rule as FormFieldValidationRules['rule'];
    }

    if (isDevMode()) {
      for (const key of Object.keys(raw)) {
        if (!(key in rules)) {
          console.warn(`[catalogue] ignoring unknown validation "${key}" on field "${fieldKey}".`);
        }
      }
    }
    return rules;
  }

  private parseOptions(raw: unknown, fieldKey: string): readonly FormFieldOption[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    const options: FormFieldOption[] = [];
    for (const entry of raw) {
      if (
        isRecord(entry) &&
        typeof entry['value'] === 'string' &&
        typeof entry['label'] === 'string'
      ) {
        options.push({ value: entry['value'], label: entry['label'] });
      } else if (isDevMode()) {
        console.warn(`[catalogue] dropping malformed option on field "${fieldKey}".`);
      }
    }
    return options;
  }

  private mapCountryConfig(
    response: StrapiListResponse<unknown>,
    country: CountryCode,
  ): CountryConfig | null {
    const first = Array.isArray(response.data) ? response.data[0] : undefined;
    if (!isRecord(first)) {
      return null;
    }

    const id = first['id'];
    const documentId = first['documentId'];
    const rowCountry = first['country'];
    const countryName = first['countryName'];
    const currency = first['currency'];
    const localeCode = first['localeCode'];
    const terms = first['termsAndConditions'];
    const maskEnd = first['documentMaskVisibleEnd'];

    if (
      typeof id !== 'number' ||
      typeof documentId !== 'string' ||
      rowCountry !== country ||
      typeof countryName !== 'string' ||
      (currency !== 'COP' && currency !== 'CLP') ||
      typeof terms !== 'string'
    ) {
      if (isDevMode()) {
        console.warn(`[catalogue] ignoring malformed country-config for ${country}.`);
      }
      return null;
    }

    const locale: AppLocale =
      localeCode === 'es-CO' || localeCode === 'es-CL'
        ? localeCode
        : COUNTRY_CATALOG_BY_CODE[country].locale;

    return {
      id,
      documentId,
      country,
      countryName,
      currency,
      localeCode: locale,
      termsAndConditions: terms,
      documentMaskVisibleEnd: typeof maskEnd === 'number' && maskEnd >= 0 ? maskEnd : 4,
    };
  }

  private parseNullableString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }

  private warnInvalid(reason: string): void {
    if (isDevMode()) {
      console.warn(`[catalogue] dropping form-field row: ${reason}.`);
    }
  }

  private warnInvalidPlan(reason: string): void {
    if (isDevMode()) {
      console.warn(`[catalogue] dropping insurance-plan row: ${reason}.`);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type { FormFieldDto, CountryConfigDto };
