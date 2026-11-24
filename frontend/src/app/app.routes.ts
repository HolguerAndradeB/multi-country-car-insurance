import { Routes } from '@angular/router';

import { countryRouteGuard } from './core/guards/country-route.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'co/quote' },
  {
    path: ':country/quote',
    canActivate: [countryRouteGuard],
    loadChildren: () =>
      import('./features/quote/quote.routes').then((module) => module.QUOTE_ROUTES),
  },
  {
    path: '**',
    title: 'Cotiza tu seguro — Página no encontrada',
    loadComponent: () =>
      import('./shared/not-found/not-found').then((module) => module.NotFoundPageComponent),
  },
];
