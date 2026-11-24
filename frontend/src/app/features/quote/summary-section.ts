import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { SummarySection } from '../../core/models';

@Component({
  selector: 'app-summary-section',
  templateUrl: './summary-section.html',
  styleUrl: './summary-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SummarySectionComponent {
  readonly section = input.required<SummarySection>();

  protected readonly headingId = computed(() => `summary-${this.section().id}-heading`);
}
