import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { UI_COPY } from '../../core/i18n/ui-copy';
import type { QuoteConfirmation, SummaryRow } from '../../core/models';

@Component({
  selector: 'app-quote-confirmation',
  templateUrl: './quote-confirmation.html',
  styleUrl: './quote-confirmation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteConfirmationComponent {
  readonly confirmation = input.required<QuoteConfirmation>();
  readonly newQuote = output<void>();

  protected readonly copy = UI_COPY;
  protected readonly confirmationHeadingId = 'confirmation-heading';
  protected readonly documentRow = computed<SummaryRow | null>(
    () =>
      this.confirmation().policyholder.find((row) => row.key === 'documentNumber') ?? null,
  );
  protected readonly issuedAtText = computed<string>(() => {
    const confirmation = this.confirmation();
    const issuedAt = new Date(confirmation.issuedAt);
    if (Number.isNaN(issuedAt.getTime())) {
      return confirmation.issuedAt;
    }
    return new Intl.DateTimeFormat(confirmation.locale, {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(issuedAt);
  });
}
