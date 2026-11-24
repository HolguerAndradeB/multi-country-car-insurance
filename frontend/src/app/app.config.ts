import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { API_BASE_URL } from './core/tokens/api-base-url.token';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    { provide: API_BASE_URL, useValue: environment.strapiBaseUrl },
  ],
};
