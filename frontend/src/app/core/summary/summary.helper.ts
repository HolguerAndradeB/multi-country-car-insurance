import { COUNTRY_CATALOG_BY_CODE } from '../country/country-catalog';
import { UI_COPY } from '../i18n/ui-copy';
import type {
  AppLocale,
  CountryCode,
  FormFieldConfig,
  FormValue,
  PlanSummary,
  PlanSummaryCopy,
  QuotedPlan,
  SummaryRow,
  SummarySection,
} from '../models';

const MASK = '•'; // U+2022 BULLET — one glyph per hidden character.
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const RUT_SUFFIX = /-[0-9Kk]$/;
const DEFAULT_VISIBLE_END = 4;

const dateFormatters = new Map<AppLocale, Intl.DateTimeFormat>();

/** One bullet per hidden char; visible tail verbatim; RUT -K protection (G7–G9). */
export function maskDocumentNumber(rawValue: string, visibleEnd: number): string {
  const raw = typeof rawValue === 'string' ? rawValue : String(rawValue ?? '');
  if (raw.trim().length === 0) {
    return '';
  }

  const safeVisibleEnd = Number.isFinite(visibleEnd) ? Math.floor(visibleEnd) : DEFAULT_VISIBLE_END;
  if (safeVisibleEnd <= 0) {
    return MASK.repeat(raw.length);
  }
  if (raw.length <= safeVisibleEnd) {
    return raw;
  }

  let visible = safeVisibleEnd;
  if (RUT_SUFFIX.test(raw)) {
    visible = Math.min(raw.length, Math.max(safeVisibleEnd, 2));
  }

  return MASK.repeat(raw.length - visible) + raw.slice(raw.length - visible);
}

/** ISO YYYY-MM-DD → local-calendar Intl date; unparseable input is returned unchanged. */
export function formatIsoDate(iso: string, locale: AppLocale): string {
  const text = typeof iso === 'string' ? iso : String(iso ?? '');
  const match = ISO_DATE.exec(text);
  if (!match) {
    return text;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return text;
  }

  let formatter = dateFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    dateFormatters.set(locale, formatter);
  }
  return formatter.format(date);
}

/** COT-<CO|CL>-<YYYYMMDD>-<XXXXXX>; deterministic FNV-1a over a canonical payload (G19). */
export function buildQuoteNumber(
  country: CountryCode,
  payload: Readonly<Record<string, string>>,
  clock: Readonly<{ readonly today: Date }>,
): string {
  const today = clock.today;
  const datePart =
    String(today.getFullYear()).padStart(4, '0') +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0');

  const canonical = [
    country,
    ...Object.keys(payload)
      .sort()
      .map((key) => `${key}=${payload[key]}`),
  ].join('|');

  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  const suffix = (hash >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(-6);

  return `COT-${country}-${datePart}-${suffix}`;
}

/** Derived, never persisted; resolves labels/options/booleans/blanks (G1–G6). */
export function buildSummarySections(
  fields: readonly FormFieldConfig[],
  values: Readonly<Record<string, FormValue>>,
  documentMaskVisibleEnd: number,
  yes: string,
  no: string,
  blankPlaceholder: string,
): readonly SummarySection[] {
  const ordered = [...fields]
    .filter((field) => field.section === 'policyholder' || field.section === 'vehicle')
    .sort((left, right) => left.order - right.order || left.id - right.id);

  const policyholder: SummaryRow[] = [];
  const vehicle: SummaryRow[] = [];

  for (const field of ordered) {
    const resolved = resolveRowValue(
      field,
      values,
      documentMaskVisibleEnd,
      yes,
      no,
      blankPlaceholder,
    );
    if (resolved === null) {
      continue;
    }

    const row: SummaryRow = { key: field.key, label: field.label, value: resolved };
    if (field.section === 'vehicle') {
      vehicle.push(row);
    } else {
      policyholder.push(row);
    }
  }

  return [
    { id: 'policyholder', heading: UI_COPY.summaryTomadorHeading, rows: policyholder },
    { id: 'vehicle', heading: UI_COPY.summaryVehicleHeading, rows: vehicle },
  ];
}

/** Reads the US-02 QuotedPlan verbatim; never recalculates a price. */
export function buildPlanSummary(quoted: QuotedPlan, copy: PlanSummaryCopy): PlanSummary {
  const { adjustment } = quoted;
  const adjustmentText =
    adjustment.adjustmentPercent > 0
      ? `${copy.adjustmentLabel}: +${adjustment.adjustmentPercent}%` +
        (adjustment.reasons.length > 0 ? ` · ${adjustment.reasons.join(', ')}` : '')
      : copy.noAdjustment;

  return {
    name: quoted.plan.name,
    shortDescription: quoted.plan.shortDescription,
    basePriceText: `${copy.basePriceLabel}: ${quoted.formattedBasePrice}`,
    finalPriceText: `${copy.finalPriceLabel}: ${quoted.formattedFinalPrice}`,
    adjustmentText,
    footnote: copy.footnote ?? copy.simulatedFootnote ?? '',
    finalPrice: quoted.finalPrice,
  };
}

function resolveRowValue(
  field: FormFieldConfig,
  values: Readonly<Record<string, FormValue>>,
  documentMaskVisibleEnd: number,
  yes: string,
  no: string,
  blankPlaceholder: string,
): string | null {
  const raw: FormValue | undefined = values[field.key];
  if (isBlank(raw)) {
    return field.required ? blankPlaceholder : null;
  }
  const value = raw as FormValue;

  if (field.key === 'documentNumber') {
    return maskDocumentNumber(String(value), documentMaskVisibleEnd);
  }

  switch (field.type) {
    case 'select': {
      const text = String(value);
      const option = field.options.find((candidate) => candidate.value === text);
      if (option) {
        return option.label;
      }
      warnDev(`[summary] option "${text}" is no longer configured for field "${field.key}".`);
      return text;
    }
    case 'checkbox':
      return value === true ? yes : no;
    case 'date':
      return formatIsoDate(String(value), localeFor(field.country));
    case 'number':
    case 'text':
      return String(value);
  }
}

function isBlank(value: FormValue | undefined): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim().length === 0)
  );
}

function localeFor(country: CountryCode): AppLocale {
  return COUNTRY_CATALOG_BY_CODE[country].locale;
}

/** Dev-only warning without importing Angular runtime helpers into the pure helper module. */
function warnDev(message: string): void {
  const devMode = (globalThis as { ngDevMode?: boolean }).ngDevMode;
  if (devMode !== false) {
    console.warn(message);
  }
}
