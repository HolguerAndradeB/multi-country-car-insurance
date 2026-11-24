import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  isDevMode,
  output,
  viewChild,
} from '@angular/core';

import { UI_COPY } from '../../core/i18n/ui-copy';
import type { CountryCode } from '../../core/models';

type PanelState = 'loading' | 'empty' | 'error';

@Component({
  selector: 'app-state-panel',
  templateUrl: './state-panel.html',
  styleUrl: './state-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatePanelComponent {
  readonly state = input.required<PanelState>();
  readonly message = input<string | null>(null);
  readonly country = input<CountryCode>('CO');
  readonly otherCountryPath = input('/cl/quote');
  readonly retry = output<void>();

  protected readonly copy = UI_COPY;
  protected readonly showDetails = isDevMode();
  private readonly heading = viewChild<ElementRef<HTMLElement>>('panelHeading');

  constructor() {
    effect(() => {
      const state = this.state();
      const heading = this.heading();
      if (state !== 'loading' && heading) {
        queueMicrotask(() => heading.nativeElement.focus());
      }
    });
  }

  protected otherCountryLabel(): string {
    return UI_COPY.otherCountry[this.country()];
  }
}
