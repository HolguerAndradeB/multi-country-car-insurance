import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { CountryContextService } from '../../core/country/country-context.service';
import { UI_COPY } from '../../core/i18n/ui-copy';
import { WizardStepperComponent } from './wizard-stepper';

@Component({
  selector: 'app-summary-placeholder-page',
  imports: [WizardStepperComponent],
  templateUrl: './summary-placeholder-page.html',
  styleUrl: './summary-placeholder-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SummaryPlaceholderPageComponent {
  private readonly context = inject(CountryContextService);
  private readonly router = inject(Router);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('pageHeading');

  protected readonly copy = UI_COPY;

  constructor() {
    effect(() => {
      this.context.country();
      const heading = this.heading();
      if (heading) {
        queueMicrotask(() => heading.nativeElement.focus());
      }
    });
  }

  protected backToPlans(): void {
    void this.router.navigateByUrl(this.context.quotePath('plans'));
  }
}
