import { Injectable, inject, isDevMode } from '@angular/core';

import type {
  CountryCode,
  FormValue,
  PersistedWizardStateV1,
  WizardPersistence,
  WizardStep,
} from '../models';
import { STORAGE_PORT } from './storage.port';

export const DRAFT_TTL_MS = 2 * 60 * 60 * 1000;

export function wizardStorageKey(country: CountryCode): string {
  return `wizard:state:v1:${country}`;
}

const STEPS: readonly WizardStep[] = ['policyholder', 'plans', 'summary'];

@Injectable({ providedIn: 'root' })
export class WizardPersistenceService implements WizardPersistence {
  private readonly storage = inject(STORAGE_PORT);

  load(country: CountryCode): PersistedWizardStateV1 | null {
    const key = wizardStorageKey(country);
    try {
      const raw = this.storage.getItem(key);
      if (!raw) {
        return null;
      }

      const parsed: unknown = JSON.parse(raw);
      if (!isPersistedState(parsed) || parsed.schemaVersion !== 1 || parsed.country !== country) {
        this.discard(key, 'schema version or country mismatch');
        return null;
      }

      const savedAt = Date.parse(parsed.savedAt);
      if (!Number.isFinite(savedAt) || savedAt > Date.now() || Date.now() - savedAt > DRAFT_TTL_MS) {
        this.discard(key, 'expired or invalid savedAt');
        return null;
      }

      return parsed;
    } catch {
      this.warn('unavailable or corrupt storage');
      return null;
    }
  }

  save(state: PersistedWizardStateV1): void {
    try {
      this.storage.setItem(wizardStorageKey(state.country), JSON.stringify(state));
    } catch {
      this.warn('could not persist draft');
    }
  }

  clear(country: CountryCode): void {
    try {
      this.storage.removeItem(wizardStorageKey(country));
    } catch {
      this.warn('could not clear draft');
    }
  }

  private discard(key: string, reason: string): void {
    try {
      this.storage.removeItem(key);
    } catch {
      this.warn('could not discard draft');
    }
    this.warn(reason);
  }

  private warn(reason: string): void {
    if (isDevMode()) {
      console.warn(`[persistence] ${reason}.`);
    }
  }
}

function isPersistedState(value: unknown): value is PersistedWizardStateV1 {
  if (!isRecord(value)) {
    return false;
  }
  const step1 = value['step1'];
  if (!isRecord(step1)) {
    return false;
  }
  for (const key of Object.keys(step1)) {
    if (!isFormValue(step1[key])) {
      return false;
    }
  }

  return (
    value['schemaVersion'] === 1 &&
    (value['country'] === 'CO' || value['country'] === 'CL') &&
    typeof value['savedAt'] === 'string' &&
    typeof value['step'] === 'string' &&
    STEPS.includes(value['step'] as WizardStep) &&
    (value['selectedPlanDocumentId'] === null ||
      typeof value['selectedPlanDocumentId'] === 'string')
  );
}

function isFormValue(value: unknown): value is FormValue {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
