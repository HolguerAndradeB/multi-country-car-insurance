import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { UI_COPY } from '../../core/i18n/ui-copy';
import type { WizardStep } from '../../core/models';

@Component({
  selector: 'app-wizard-stepper',
  templateUrl: './wizard-stepper.html',
  styleUrl: './wizard-stepper.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WizardStepperComponent {
  readonly activeStep = input<WizardStep>('policyholder');
  protected readonly copy = UI_COPY;
}
