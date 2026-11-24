import { InjectionToken } from '@angular/core';

/** Minimal storage surface so tests can inject a fake that throws (G25). */
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORAGE_PORT = new InjectionToken<StoragePort>('STORAGE_PORT', {
  providedIn: 'root',
  factory: () => ({
    getItem: (key: string): string | null => {
      try {
        return globalThis.sessionStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem: (key: string, value: string): void => {
      try {
        globalThis.sessionStorage?.setItem(key, value);
      } catch {
        // Storage unavailable: keep working in memory only.
      }
    },
    removeItem: (key: string): void => {
      try {
        globalThis.sessionStorage?.removeItem(key);
      } catch {
        // Storage unavailable: nothing to discard.
      }
    },
  }),
});
