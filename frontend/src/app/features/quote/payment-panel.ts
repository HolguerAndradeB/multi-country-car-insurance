import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { UI_COPY } from '../../core/i18n/ui-copy';
import type { PaymentStatus, PlanSummary } from '../../core/models';

@Component({
  selector: 'app-payment-panel',
  templateUrl: './payment-panel.html',
  styleUrl: './payment-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentPanelComponent {
  readonly plan = input.required<PlanSummary>();
  readonly canPay = input.required<boolean>();
  readonly paymentStatus = input.required<PaymentStatus>();

  readonly pay = output<void>();
  readonly retry = output<void>();
  readonly editData = output<void>();
  readonly changePlan = output<void>();

  protected readonly copy = UI_COPY;
  protected readonly planHeadingId = 'plan-heading';
}
