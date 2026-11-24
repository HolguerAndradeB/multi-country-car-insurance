import { Routes } from '@angular/router';

import { countryRouteGuard } from './core/guards/country-route.guard';
import { step1CompleteGuard } from './core/guards/step1-complete.guard';
import { step2CompleteGuard } from './core/guards/step2-complete.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'co/quote' },
  {
    path: ':country/quote/plans',
    canActivate: [countryRouteGuard, step1CompleteGuard],
    loadComponent: () =>
      import('./features/quote/quote-step2-plans-page').then(
        (module) => module.QuoteStep2PlansPageComponent,
      ),
  },
  {
    path: ':country/quote/summary',
    canActivate: [countryRouteGuard, step2CompleteGuard],
    loadComponent: () =>
      import('./features/quote/quote-step3-summary-page').then(
        (module) => module.QuoteStep3SummaryPageComponent,
      ),
  },
  {
    path: ':country/quote',
    canActivate: [countryRouteGuard],
    loadComponent: () =>
      import('./features/quote/quote-step1-page').then((module) => module.QuoteStep1PageComponent),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./shared/not-found/not-found').then((module) => module.NotFoundPageComponent),
  },
];
