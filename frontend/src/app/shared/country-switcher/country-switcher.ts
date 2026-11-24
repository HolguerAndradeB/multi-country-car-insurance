import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { COUNTRY_CATALOG, COUNTRY_CATALOG_BY_CODE } from '../../core/country/country-catalog';
import { CountryContextService } from '../../core/country/country-context.service';
import { UI_COPY } from '../../core/i18n/ui-copy';
import type { CountryCode } from '../../core/models';

@Component({
  selector: 'app-country-switcher',
  templateUrl: './country-switcher.html',
  styleUrl: './country-switcher.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountrySwitcherComponent {
  private readonly context = inject(CountryContextService);
  private readonly router = inject(Router);

  protected readonly copy = UI_COPY;
  protected readonly countries = COUNTRY_CATALOG;
  protected readonly selectedCountry = this.context.country;
  protected readonly selectedSegment = computed(() => this.context.entry().routeSegment);

  onChange(routeSegment: string): void {
    const selected = COUNTRY_CATALOG.find((entry) => entry.routeSegment === routeSegment);
    if (!selected || selected.code === this.context.country()) {
      return;
    }
    const step = this.context.currentStep();
    void this.router.navigateByUrl(this.context.pathFor(selected.code, step === 'plans' ? 'plans' : 'quote'));
  }

  protected isSelected(code: CountryCode): boolean {
    return this.context.country() === code;
  }
}
