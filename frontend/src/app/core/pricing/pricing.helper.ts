import type { AppLocale, CurrencyCode, FormFieldConfig, FormValue } from '../models';
import type { PriceAdjustmentResult } from '../models';
import { ageOnDate } from '../validators/domain-validators';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const VEHICLE_REASON = 'por antigüedad del vehículo';
const DRIVER_REASON = 'por edad del conductor';

/** Pure Step 1 snapshot: only keys still present in the Strapi field catalogue. */
export function pickKeys(
  values: Readonly<Record<string, FormValue>>,
  fields: ReadonlyArray<Pick<FormFieldConfig, 'key'>>,
): Readonly<Record<string, FormValue>> {
  const picked: Record<string, FormValue> = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(values, field.key)) {
      picked[field.key] = values[field.key];
    }
  }
  return picked;
}

/**
 * Exact simulated-pricing rule from `specs/US-02-plan-list.md` §2.2.
 * Integer-only arithmetic; never throws; neutral factors when keys are absent.
 */
export function calculateAdjustedPrice(
  basePrice: number,
  pricingStep1: Readonly<Record<string, FormValue>>,
  clock: Readonly<{ readonly today: Date; readonly currentYear: number }>,
): PriceAdjustmentResult {
  const safeBasePrice = Number.isFinite(basePrice) && basePrice >= 0 ? Math.floor(basePrice) : 0;

  const vehicleValue = pricingStep1['vehicleYear'];
  const vehicleYear =
    typeof vehicleValue === 'number' && Number.isInteger(vehicleValue) ? vehicleValue : null;
  const vehicleAge =
    vehicleYear === null ? 0 : clamp(clock.currentYear - vehicleYear, 0, 20);
  const agePercent = vehicleAge <= 5 ? 0 : (vehicleAge - 5) * 2;

  const birthValue = pricingStep1['birthDate'];
  const birthIso = typeof birthValue === 'string' && ISO_DATE.test(birthValue) ? birthValue : null;
  const driverAge = birthIso === null ? null : ageOnDate(birthIso, clock.today);
  const driverPercent = driverAge === null ? 0 : driverAge < 25 ? 10 : driverAge >= 60 ? 5 : 0;

  const adjustmentPercent = agePercent + driverPercent;
  const finalPrice = Math.floor((safeBasePrice * (100 + adjustmentPercent) + 50) / 100);
  const reasons = [
    ...(agePercent > 0 ? [VEHICLE_REASON] : []),
    ...(driverPercent > 0 ? [DRIVER_REASON] : []),
  ];

  return { adjustmentPercent, reasons, finalPrice };
}

const formatters = new Map<string, Intl.NumberFormat>();

/** Locale comes from `COUNTRY_CATALOG`, never from the browser default. */
export function formatCurrency(value: number, locale: AppLocale, currency: CurrencyCode): string {
  const key = `${locale}|${currency}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    formatters.set(key, formatter);
  }
  return formatter.format(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
