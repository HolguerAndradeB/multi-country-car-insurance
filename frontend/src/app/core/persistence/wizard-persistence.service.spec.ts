import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CountryCode, PersistedWizardStateV1 } from '../models';
import { STORAGE_PORT, type StoragePort } from './storage.port';
import {
  DRAFT_TTL_MS,
  WizardPersistenceService,
  wizardStorageKey,
} from './wizard-persistence.service';

class FakeStorage implements StoragePort {
  readonly values = new Map<string, string>();
  throwOnGet = false;
  throwOnSet = false;
  throwOnRemove = false;

  getItem(key: string): string | null {
    if (this.throwOnGet) {
      throw new Error('storage disabled');
    }
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSet) {
      throw new Error('quota exceeded');
    }
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    if (this.throwOnRemove) {
      throw new Error('storage disabled');
    }
    this.values.delete(key);
  }
}

function makeState(overrides: Partial<PersistedWizardStateV1> = {}): PersistedWizardStateV1 {
  return {
    schemaVersion: 1,
    country: overrides.country ?? 'CO',
    savedAt: overrides.savedAt ?? new Date().toISOString(),
    step: overrides.step ?? 'policyholder',
    step1: overrides.step1 ?? {
      documentType: 'CC',
      documentNumber: '1023456789',
      vehicleYear: 2019,
      acceptMarketing: false,
    },
    selectedPlanDocumentId: overrides.selectedPlanDocumentId ?? null,
  };
}

describe('WizardPersistenceService (US01-U11, US01-U13, US01-U20)', () => {
  let storage: FakeStorage;
  let service: WizardPersistenceService;

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    storage = new FakeStorage();
    await TestBed.configureTestingModule({
      providers: [{ provide: STORAGE_PORT, useValue: storage }],
    }).compileComponents();
    service = TestBed.inject(WizardPersistenceService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('round-trips a saved draft with identical step1 values', () => {
    const state = makeState();

    service.save(state);

    expect(storage.values.has('wizard:state:v1:CO')).toBe(true);
    expect(service.load('CO')).toEqual(state);
  });

  it('scopes drafts by country and never hydrates a sibling country', () => {
    const co = makeState({ country: 'CO', step1: { city: 'BOG' } });
    service.save(co);

    expect(service.load('CL')).toBeNull();
    expect(storage.values.has(wizardStorageKey('CL' as CountryCode))).toBe(false);
    expect(service.load('CO')).toEqual(co);

    service.save(makeState({ country: 'CL', step1: { city: 'SCL' } }));
    expect(service.load('CO')).toEqual(co);
    expect(service.load('CL')?.step1).toEqual({ city: 'SCL' });
  });

  it('discards drafts older than the 2-hour TTL', () => {
    const expired = makeState({
      savedAt: new Date(Date.now() - DRAFT_TTL_MS - 1_000).toISOString(),
    });
    service.save(expired);

    expect(service.load('CO')).toBeNull();
    expect(storage.values.has(wizardStorageKey('CO'))).toBe(false);

    const fresh = makeState({
      savedAt: new Date(Date.now() - DRAFT_TTL_MS + 5_000).toISOString(),
    });
    service.save(fresh);
    expect(service.load('CO')).toEqual(fresh);
  });

  it('discards future-dated drafts', () => {
    service.save(makeState({ savedAt: new Date(Date.now() + 60_000).toISOString() }));

    expect(service.load('CO')).toBeNull();
    expect(storage.values.has(wizardStorageKey('CO'))).toBe(false);
  });

  it('discards mismatched schemaVersion and mismatched country', () => {
    const wrongVersion = {
      ...makeState(),
      schemaVersion: 2,
    } as unknown as PersistedWizardStateV1;
    service.save(wrongVersion);
    expect(service.load('CO')).toBeNull();
    expect(storage.values.has(wizardStorageKey('CO'))).toBe(false);

    const wrongCountry = { ...makeState(), country: 'CL' } as PersistedWizardStateV1;
    storage.values.set(wizardStorageKey('CO'), JSON.stringify(wrongCountry));
    expect(service.load('CO')).toBeNull();
    expect(storage.values.has(wizardStorageKey('CO'))).toBe(false);
  });

  it('returns null without throwing for corrupt JSON', () => {
    storage.values.set(wizardStorageKey('CO'), '{not json');

    expect(() => service.load('CO')).not.toThrow();
    expect(service.load('CO')).toBeNull();
  });

  it('clears only the requested country key', () => {
    service.save(makeState({ country: 'CO' }));
    service.save(makeState({ country: 'CL' }));

    service.clear('CO');

    expect(service.load('CO')).toBeNull();
    expect(service.load('CL')?.country).toBe('CL');
  });

  it('degrades gracefully when the injected STORAGE_PORT throws (US01-U20)', () => {
    storage.throwOnGet = true;
    expect(() => service.load('CO')).not.toThrow();
    expect(service.load('CO')).toBeNull();

    storage.throwOnGet = false;
    storage.throwOnSet = true;
    expect(() => service.save(makeState())).not.toThrow();
    expect(storage.values.size).toBe(0);

    storage.throwOnSet = false;
    storage.values.set(wizardStorageKey('CO'), JSON.stringify(makeState()));
    storage.throwOnRemove = true;
    expect(() => service.clear('CO')).not.toThrow();
    expect(storage.values.has(wizardStorageKey('CO'))).toBe(true);
  });

  it('uses the documented storage key shape', () => {
    expect(wizardStorageKey('CO')).toBe('wizard:state:v1:CO');
    expect(wizardStorageKey('CL')).toBe('wizard:state:v1:CL');
  });
});
