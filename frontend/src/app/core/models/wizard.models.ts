import type { FormControl, FormGroup } from '@angular/forms';

import type { AppLocale, CountryCode, CurrencyCode } from './country.models';

export interface CountryConfig {
  readonly id: number;
  readonly documentId: string;
  readonly country: CountryCode;
  readonly countryName: string;
  readonly currency: CurrencyCode;
  /** Strapi 5 reserves `locale`, so the content field is named `localeCode`. */
  readonly localeCode: AppLocale;
  readonly termsAndConditions: string;
  readonly documentMaskVisibleEnd: number;
}

export type FormValue = string | number | boolean | null;

export type WizardStep = 'policyholder' | 'plans' | 'summary';

export interface PersistedWizardStateV1 {
  readonly schemaVersion: 1;
  readonly country: CountryCode;
  readonly savedAt: string;
  readonly step: WizardStep;
  readonly step1: Readonly<Record<string, FormValue>>;
  readonly selectedPlanDocumentId: string | null;
}

export interface WizardPersistence {
  load(country: CountryCode): PersistedWizardStateV1 | null;
  save(state: PersistedWizardStateV1): void;
  clear(country: CountryCode): void;
}

export type CatalogueStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export type WizardFormGroup = FormGroup<Record<string, FormControl<FormValue>>>;
