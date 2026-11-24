import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { CountryContextService } from '../../../../../../core/country/country-context.service';
import { UI_COPY } from '../../../../../../core/i18n/ui-copy';
import type { QuotedPlan } from '../../../../../../core/models';
import { formatCurrency } from '../../../../../../core/pricing/pricing.helper';

@Component({
  selector: 'app-plan-card',
  imports: [],
  templateUrl: './plan-card.html',
  styleUrl: './plan-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanCardComponent {
  readonly quoted = input.required<QuotedPlan>();
  readonly selected = input.required<boolean>();
  readonly selection = output<string>();

  protected readonly copy = UI_COPY;
  private readonly context = inject(CountryContextService);

  protected readonly descriptionId = computed(() => `plan-description-${this.planId()}`);
  protected readonly priceId = computed(() => `plan-price-${this.planId()}`);
  protected readonly badgeId = computed(() => `plan-badge-${this.planId()}`);

  private readonly planId = computed(() => this.quoted().plan.documentId);

  protected describedBy(): string {
    const ids = [this.descriptionId(), this.priceId()];
    if (this.quoted().plan.recommended) {
      ids.push(this.badgeId());
    }
    return ids.join(' ');
  }

  protected adjustmentText(): string {
    const adjustment = this.quoted().adjustment;
    return adjustment.reasons.join(' · ');
  }

  protected formatMoney(value: number): string {
    return formatCurrency(value, this.context.locale(), this.context.currency());
  }

  protected onSelect(): void {
    this.selection.emit(this.planId());
  }

  protected onEnter(event: Event): void {
    event.preventDefault();
    this.onSelect();
  }
}
