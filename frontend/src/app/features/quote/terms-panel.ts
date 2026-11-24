import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { UI_COPY } from '../../core/i18n/ui-copy';

@Component({
  selector: 'app-terms-panel',
  templateUrl: './terms-panel.html',
  styleUrl: './terms-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsPanelComponent {
  readonly terms = input.required<string>();
  readonly accepted = input(false);
  readonly acceptedChange = output<boolean>();

  protected readonly copy = UI_COPY;
  protected readonly headingId = 'terms-heading';

  protected onToggle(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.acceptedChange.emit(target.checked);
    }
  }
}
