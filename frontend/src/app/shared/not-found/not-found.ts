import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { UI_COPY } from '../../core/i18n/ui-copy';
import { COUNTRY_CATALOG_BY_CODE, DEFAULT_COUNTRY } from '../../core/country/country-catalog';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  templateUrl: './not-found.html',
  styleUrl: './not-found.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPageComponent {
  protected readonly copy = UI_COPY;
  protected readonly homePath = `/${COUNTRY_CATALOG_BY_CODE[DEFAULT_COUNTRY].routeSegment}/quote`;
}
