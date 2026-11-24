import { InjectionToken } from '@angular/core';

import { environment } from '../../../environments/environment';

/**
 * Public Strapi origin only. Credentials are never shipped to the browser
 * (ADR-002 §4.4).
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.strapiBaseUrl,
});
