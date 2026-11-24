/** Static, metadata-only country definitions (ADR-001 §4.2). */
export type CountryCode = 'CO' | 'CL';

export type CountryRouteSegment = 'co' | 'cl';

export type CurrencyCode = 'COP' | 'CLP';

export type AppLocale = 'es-CO' | 'es-CL';

/** Metadata only: never field definitions, plans, prices or legal text. */
export interface CountryCatalogEntry {
  readonly code: CountryCode;
  readonly routeSegment: CountryRouteSegment;
  readonly locale: AppLocale;
  readonly currency: CurrencyCode;
  readonly displayName: string;
}
