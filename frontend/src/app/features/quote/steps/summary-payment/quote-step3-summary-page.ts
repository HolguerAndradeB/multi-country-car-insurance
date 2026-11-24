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
import type { CountryCode, PaymentStatus } from '../../../../core/models';
import { PaymentPanelComponent } from './components/payment-panel/payment-panel';
import { QuoteConfirmationComponent } from './components/quote-confirmation/quote-confirmation';
import { SummarySectionComponent } from './components/summary-section/summary-section';
import { TermsPanelComponent } from './components/terms-panel/terms-panel';
import { WizardStepperComponent } from '../../ui/wizard-stepper/wizard-stepper';
import { WizardStore } from '../../state/wizard.store';

@Component({
  selector: 'app-quote-step3-summary-page',
  imports: [
    PaymentPanelComponent,
    QuoteConfirmationComponent,
    SummarySectionComponent,
    TermsPanelComponent,
    WizardStepperComponent,
  ],
  templateUrl: './quote-step3-summary-page.html',
  styleUrl: './quote-step3-summary-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteStep3SummaryPageComponent {
  protected readonly store = inject(WizardStore);
  private readonly context = inject(CountryContextService);
  private readonly router = inject(Router);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('pageHeading');

  protected readonly copy = UI_COPY;
  private loadedCountry: CountryCode | null = null;
  private previousPaymentStatus: PaymentStatus | null = null;

  constructor() {
    effect(() => {
      const country = this.context.country();
      if (this.loadedCountry !== country) {
        this.loadedCountry = country;
        untracked(() => {
          void this.store.loadSummaryContext(country);
        });
      }
    });

    effect(() => {
      this.context.country();
      this.store.summaryStatus();
      this.store.summaryError();
      const paymentStatus = this.store.paymentStatus();
      const heading = this.heading();
      const previous = this.previousPaymentStatus;
      this.previousPaymentStatus = paymentStatus;

      const paymentTransitionNeedsFocus =
        previous === null ||
        paymentStatus === previous ||
        paymentStatus === 'rejected' ||
        paymentStatus === 'confirmed';
      if (paymentTransitionNeedsFocus && heading) {
        queueMicrotask(() => heading.nativeElement.focus());
      }
    });
  }

  protected onAccepted(accepted: boolean): void {
    this.store.setTermsAccepted(accepted);
  }

  protected onRetrySummary(): void {
    void this.store.retrySummary(this.context.country());
  }

  protected onPay(): void {
    this.store.submitPayment();
  }

  protected onRetryPayment(): void {
    this.store.submitPayment();
  }

  protected onEditData(): void {
    void this.router.navigateByUrl(this.context.quotePath('quote'));
  }

  protected onChangePlan(): void {
    void this.router.navigateByUrl(this.context.quotePath('plans'));
  }

  protected onBackToPlans(): void {
    void this.router.navigateByUrl(this.context.quotePath('plans'));
  }

  protected onNewQuote(): void {
    const country = this.context.country();
    this.store.newQuote(country);
    void this.router.navigateByUrl(this.context.quotePath('quote'));
  }
}
