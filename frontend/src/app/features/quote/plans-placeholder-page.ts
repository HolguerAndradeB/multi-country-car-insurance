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
  selector: 'app-plans-placeholder-page',
  imports: [WizardStepperComponent],
  templateUrl: './plans-placeholder-page.html',
  styleUrl: './plans-placeholder-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlansPlaceholderPageComponent {
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

  protected goBack(): void {
    void this.router.navigateByUrl(this.context.quotePath('quote'));
  }
}
