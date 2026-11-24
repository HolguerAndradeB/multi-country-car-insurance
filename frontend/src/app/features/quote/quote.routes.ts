import { Routes } from '@angular/router';

import { step1CompleteGuard } from '../../core/guards/step1-complete.guard';
import { step2CompleteGuard } from '../../core/guards/step2-complete.guard';

export const QUOTE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Cotiza tu seguro — Datos',
    loadComponent: () =>
      import('./steps/policyholder-vehicle/quote-step1-page').then(
        (module) => module.QuoteStep1PageComponent,
      ),
  },
  {
    path: 'plans',
    canActivate: [step1CompleteGuard],
    title: 'Cotiza tu seguro — Planes',
    loadComponent: () =>
      import('./steps/plans/quote-step2-plans-page').then(
        (module) => module.QuoteStep2PlansPageComponent,
      ),
  },
  {
    path: 'summary',
    canActivate: [step2CompleteGuard],
    title: 'Cotiza tu seguro — Resumen y pago',
    loadComponent: () =>
      import('./steps/summary-payment/quote-step3-summary-page').then(
        (module) => module.QuoteStep3SummaryPageComponent,
      ),
  },
];
