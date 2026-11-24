import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { CountryContextService } from './core/country/country-context.service';
import { UI_COPY } from './core/i18n/ui-copy';
import { CountrySwitcherComponent } from './shared/country-switcher/country-switcher';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, CountrySwitcherComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly context = inject(CountryContextService);
  private readonly document = inject(DOCUMENT);

  protected readonly copy = UI_COPY;
  protected readonly homePath = computed(() => this.context.quotePath('quote'));

  constructor() {
    effect(() => {
      this.document.documentElement.lang = this.context.locale();
    });
  }
}
