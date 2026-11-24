import type {
  AppLocale,
  CountryCode,
  CurrencyCode,
} from './country.models';
import type {
  FormFieldOption,
  FormFieldSection,
  FormFieldType,
  FormFieldValidationRules,
} from './form-field.models';

export interface StrapiPagination {
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
  readonly total: number;
}

export interface StrapiListResponse<T> {
  readonly data: readonly T[];
  readonly meta?: { readonly pagination?: StrapiPagination };
}

/** Flattened Strapi 5 document (no v4 `.attributes` nesting). */
export interface FormFieldDto {
  readonly id: number;
  readonly documentId: string;
  readonly key: string;
  readonly label: string;
  readonly type: FormFieldType;
  readonly required: boolean;
  readonly validations: FormFieldValidationRules | null;
  readonly options: readonly FormFieldOption[] | null;
  readonly helpText: string | null;
  readonly errorMessage: string | null;
  readonly order: number;
  readonly country: CountryCode;
  readonly section: FormFieldSection;
  readonly publishedAt: string | null;
}

/** `locale` is reserved in Strapi 5, hence `localeCode`. */
export interface CountryConfigDto {
  readonly id: number;
  readonly documentId: string;
  readonly country: CountryCode;
  readonly countryName: string;
  readonly currency: CurrencyCode;
  readonly localeCode: string;
  readonly termsAndConditions: string;
  readonly documentMaskVisibleEnd: number | null;
}

export type SupportedAppLocale = AppLocale;
