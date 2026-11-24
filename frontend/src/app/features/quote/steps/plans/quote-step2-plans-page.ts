import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { CountryContextService } from '../../../../core/country/country-context.service';
import { UI_COPY } from '../../../../core/i18n/ui-copy';
import type { CountryCode } from '../../../../core/models';
import { QuoteClock } from '../../../../core/pricing/quote-clock';
import { PlanCardComponent } from './components/plan-card/plan-card';
import { WizardStepperComponent } from '../../ui/wizard-stepper/wizard-stepper';
import { WizardStore } from '../../state/wizard.store';

@Component({
  selector: 'app-quote-step2-plans-page',
  imports: [PlanCardComponent, WizardStepperComponent],
  templateUrl: './quote-step2-plans-page.html',
  styleUrl: './quote-step2-plans-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteStep2PlansPageComponent {
  protected readonly store = inject(WizardStore);
  protected readonly context = inject(CountryContextService);
  private readonly router = inject(Router);
  private readonly clock = inject(QuoteClock);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('pageHeading');

  protected readonly copy = UI_COPY;
  private loadedCountry: CountryCode | null = null;

  constructor() {
    effect(() => {
      const country = this.context.country();
      if (this.loadedCountry !== country) {
        this.loadedCountry = country;
        untracked(() => {
          this.store.captureClock(this.clock);
          void this.store.loadPlans(country);
        });
      }
    });

    effect(() => {
      this.store.plansStatus();
      const heading = this.heading();
      if (heading) {
        queueMicrotask(() => heading.nativeElement.focus());
      }
    });
  }

  protected onSelect(documentId: string): void {
    this.store.selectPlan(documentId);
  }

  protected onRetry(): void {
    void this.store.retryPlans();
  }

  protected onBack(): void {
    void this.router.navigateByUrl(this.context.quotePath('quote'));
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (this.store.canAdvance()) {
      void this.router.navigateByUrl(this.context.quotePath('summary'));
    }
  }
}
