/**
 * Test-only type shim for the Angular development file replacement.
 *
 * `angular.json` replaces `environment.ts` with `environment.development.ts`
 * for every `ng test` build (the unit-test builder always uses the
 * `development` build configuration). The production `AppEnvironment`
 * interface is declared in `environment.ts`; the development replacement
 * imports that type from `./environment`, which is rewritten to itself by the
 * same replacement and therefore cannot see the exported interface.
 *
 * This spec augments the replacement module with the same public shape so the
 * test build can compile without changing any production source file. The
 * production defect should be fixed by `angular-dev`; this shim does not alter
 * runtime behaviour or weaken any assertion.
 */
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { API_BASE_URL } from '../app/core/tokens/api-base-url.token';

declare module './environment.development' {
  export interface AppEnvironment {
    readonly production: boolean;
    readonly strapiBaseUrl: string;
  }
}

describe('development environment replacement (test build only)', () => {
  it('exposes the public Strapi base URL through API_BASE_URL with no credentials', () => {
    expect(TestBed.inject(API_BASE_URL)).toBe('http://localhost:1337');
  });
});
