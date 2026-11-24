import type { CountryCode } from './country.models';

export type FormFieldType = 'text' | 'number' | 'select' | 'date' | 'checkbox';

export type FormFieldSection = 'policyholder' | 'vehicle';

export type DomainValidationRule =
  | 'legalAge'
  | 'vehicleYear'
  | 'clRut'
  | 'coDocumentNumber'
  | 'coPlate'
  | 'clPlate';

export interface FormFieldOption {
  readonly value: string;
  readonly label: string;
}

/** Typed mirror of the Strapi `validations` JSON blob; unknown keys are ignored. */
export interface FormFieldValidationRules {
  readonly minLength?: number;
  readonly maxLength?: number;
  /** Numeric lower bound, ignored when `rule` is `vehicleYear`. */
  readonly min?: number;
  /** Numeric upper bound, ignored when `rule` is `vehicleYear`. */
  readonly max?: number;
  /** ISO `YYYY-MM-DD` lower bound. */
  readonly minDate?: string;
  /** ISO `YYYY-MM-DD` upper bound. */
  readonly maxDate?: string;
  readonly pattern?: string;
  readonly integer?: boolean;
  readonly transform?: 'uppercase' | 'trim';
  readonly rule?: DomainValidationRule;
}

/** Domain model consumed by the UI; never the raw Strapi payload. */
export interface FormFieldConfig {
  readonly id: number;
  readonly documentId: string;
  readonly key: string;
  readonly label: string;
  readonly type: FormFieldType;
  readonly required: boolean;
  readonly validations: FormFieldValidationRules;
  readonly options: readonly FormFieldOption[];
  readonly helpText: string | null;
  readonly errorMessage: string | null;
  readonly order: number;
  readonly country: CountryCode;
  readonly section: FormFieldSection;
}
