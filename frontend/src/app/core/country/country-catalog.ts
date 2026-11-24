import type { CountryCatalogEntry, CountryCode, CountryRouteSegment } from '../models';

const COLOMBIA: CountryCatalogEntry = {
  code: 'CO',
  routeSegment: 'co',
  locale: 'es-CO',
  currency: 'COP',
  displayName: 'Colombia',
};

const CHILE: CountryCatalogEntry = {
  code: 'CL',
  routeSegment: 'cl',
  locale: 'es-CL',
  currency: 'CLP',
  displayName: 'Chile',
};

/** Metadata only. Catalogue content always comes from Strapi at runtime. */
export const COUNTRY_CATALOG: readonly CountryCatalogEntry[] = [COLOMBIA, CHILE];

export const COUNTRY_CATALOG_BY_CODE: Readonly<Record<CountryCode, CountryCatalogEntry>> = {
  CO: COLOMBIA,
  CL: CHILE,
};

export const DEFAULT_COUNTRY: CountryCode = 'CO';

/** Canonicalises `co`/`CO`/`cl`/`CL`; unknown values fall back to Colombia. */
export function toCountryCode(raw: string | null | undefined): CountryCode {
  const normalized = (raw ?? '').trim().toUpperCase();
  return normalized === 'CL' ? 'CL' : 'CO';
}

export function toRouteSegment(raw: string | null | undefined): CountryRouteSegment {
  return COUNTRY_CATALOG_BY_CODE[toCountryCode(raw)].routeSegment;
}
