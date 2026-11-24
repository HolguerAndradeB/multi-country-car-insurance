import { describe, expect, it, vi } from 'vitest';

import type { FormFieldConfig, FormValue } from '../models';
import { ageOnDate, isLegalAge } from '../validators/domain-validators';
import { calculateAdjustedPrice, formatCurrency, pickKeys } from './pricing.helper';

interface PricingClock {
  readonly today: Date;
  readonly currentYear: number;
}

const CLOCK: PricingClock = {
  today: new Date(2026, 10, 23),
  currentYear: 2026,
};

function step1(
  overrides: Readonly<Record<string, FormValue>> = {},
): Readonly<Record<string, FormValue>> {
  return {
    vehicleYear: 2021,
    birthDate: '1990-06-15',
    ...overrides,
  };
}

function price(basePrice: number, values: Readonly<Record<string, FormValue>> = step1()) {
  return calculateAdjustedPrice(basePrice, values, CLOCK);
}

describe('calculateAdjustedPrice worked examples (US02-U01, §2.2)', () => {
  it('applies 0% for a five-year-old vehicle and an adult driver (350000 -> 350000)', () => {
    expect(price(350000)).toEqual({
      adjustmentPercent: 0,
      reasons: [],
      finalPrice: 350000,
    });
  });

  it('applies 4% for a seven-year-old vehicle (350000 -> 364000)', () => {
    expect(price(350000, step1({ vehicleYear: 2019 }))).toEqual({
      adjustmentPercent: 4,
      reasons: ['por antigüedad del vehículo'],
      finalPrice: 364000,
    });
  });

  it('applies 14% and orders reasons vehicle-before-driver (620000 -> 706800)', () => {
    const result = price(620000, step1({ vehicleYear: 2019, birthDate: '2004-11-23' }));

    expect(result.adjustmentPercent).toBe(14);
    expect(result.reasons).toEqual([
      'por antigüedad del vehículo',
      'por edad del conductor',
    ]);
    expect(result.finalPrice).toBe(706800);
  });

  it('applies 25% for a 15-year-old vehicle and a senior driver (620000 -> 775000)', () => {
    const result = price(620000, step1({ vehicleYear: 2011, birthDate: '1960-11-23' }));

    expect(result.adjustmentPercent).toBe(25);
    expect(result.reasons).toEqual([
      'por antigüedad del vehículo',
      'por edad del conductor',
    ]);
    expect(result.finalPrice).toBe(775000);
  });

  it('clamps a next-year vehicle to age 0 and keeps the price at base', () => {
    expect(price(101, step1({ vehicleYear: 2027 }))).toEqual({
      adjustmentPercent: 0,
      reasons: [],
      finalPrice: 101,
    });
    expect(price(101)).toEqual({ adjustmentPercent: 0, reasons: [], finalPrice: 101 });
  });

  it('caps the vehicle factor at 30% and the combined adjustment at 40%', () => {
    const clampedVehicle = price(100000, step1({ vehicleYear: 2000, birthDate: '1990-06-15' }));
    expect(clampedVehicle.adjustmentPercent).toBe(30);
    expect(clampedVehicle.finalPrice).toBe(130000);
    expect(clampedVehicle.reasons).toEqual(['por antigüedad del vehículo']);

    const cappedTotal = price(100000, step1({ vehicleYear: 2006, birthDate: '2004-11-23' }));
    expect(cappedTotal.adjustmentPercent).toBe(40);
    expect(cappedTotal.finalPrice).toBe(140000);
    expect(cappedTotal.reasons).toEqual([
      'por antigüedad del vehículo',
      'por edad del conductor',
    ]);
  });

  it('rounds half up using integer arithmetic without decimals', () => {
    // 25 at +10% is exactly 27.5; integer half-up must produce 28.
    expect(price(25, step1({ birthDate: '2004-11-23' })).finalPrice).toBe(28);
    // 101 at +4% is 105.04 and must stay the integer 105 (not truncate to 104).
    expect(price(101, step1({ vehicleYear: 2019 })).finalPrice).toBe(105);
    expect(Number.isInteger(price(101, step1({ vehicleYear: 2019 })).finalPrice)).toBe(true);
  });
});

describe('calculateAdjustedPrice neutral fallbacks (US02-U02, G7)', () => {
  it('never throws and falls back to base price when both reserved keys are absent', () => {
    expect(() => calculateAdjustedPrice(350000, {}, CLOCK)).not.toThrow();
    expect(price(350000, {})).toEqual({ adjustmentPercent: 0, reasons: [], finalPrice: 350000 });
  });

  it('uses only keys still present in the freshly fetched Strapi field catalogue', () => {
    const staleValues: Readonly<Record<string, FormValue>> = {
      vehicleYear: 2019,
      birthDate: '2004-11-23',
    };
    const fields: readonly FormFieldConfig[] = [
      { key: 'fullName' } as FormFieldConfig,
      { key: 'licensePlate' } as FormFieldConfig,
    ];

    expect(pickKeys(staleValues, fields)).toEqual({});
    expect(price(101, pickKeys(staleValues, fields))).toEqual({
      adjustmentPercent: 0,
      reasons: [],
      finalPrice: 101,
    });

    const keptFields: readonly FormFieldConfig[] = [{ key: 'vehicleYear' } as FormFieldConfig];
    expect(pickKeys(staleValues, keptFields)).toEqual({ vehicleYear: 2019 });
    expect(price(101, pickKeys(staleValues, keptFields)).adjustmentPercent).toBe(4);
  });

  it.each([
    ['non-integer vehicleYear', { vehicleYear: 2019.5, birthDate: '1990-06-15' }],
    ['string vehicleYear', { vehicleYear: '2019', birthDate: '1990-06-15' }],
    ['null vehicleYear', { vehicleYear: null, birthDate: '1990-06-15' }],
    ['malformed birthDate', { vehicleYear: 2019, birthDate: '23/11/2004' }],
    ['impossible birthDate', { vehicleYear: 2019, birthDate: '2004-02-30' }],
    ['non-string birthDate', { vehicleYear: 2019, birthDate: 20041123 }],
  ])('falls back to the neutral factor for %s', (_label, values) => {
    const result = calculateAdjustedPrice(101, values as Readonly<Record<string, FormValue>>, CLOCK);

    expect(result.adjustmentPercent).toBeLessThanOrEqual(10);
    expect(Number.isInteger(result.finalPrice)).toBe(true);
    expect(() => calculateAdjustedPrice(101, values as Readonly<Record<string, FormValue>>, CLOCK)).not.toThrow();
  });

  it('treats an invalid base price as zero without throwing', () => {
    expect(calculateAdjustedPrice(Number.NaN, {}, CLOCK).finalPrice).toBe(0);
    expect(calculateAdjustedPrice(-10, {}, CLOCK).finalPrice).toBe(0);
  });
});

describe('ageOnDate driver-age consistency (US02-U03)', () => {
  it('uses 28-Feb for a 29-Feb birthday in non-leap years', () => {
    expect(ageOnDate('2008-02-29', new Date(2026, 1, 27))).toBe(17);
    expect(ageOnDate('2008-02-29', new Date(2026, 1, 28))).toBe(18);
    expect(ageOnDate('2008-02-29', new Date(2026, 2, 1))).toBe(18);
    expect(ageOnDate('2008-02-29', new Date(2028, 1, 28))).toBe(19);
    expect(ageOnDate('2008-02-29', new Date(2028, 1, 29))).toBe(20);
  });

  it('matches the US-01 isLegalAge 18-year boundary bit-for-bit', () => {
    const today = new Date(2026, 10, 23);

    expect(ageOnDate('2008-11-23', today)).toBe(18);
    expect(isLegalAge('2008-11-23', today)).toBe(true);
    expect(ageOnDate('2008-11-24', today)).toBe(17);
    expect(isLegalAge('2008-11-24', today)).toBe(false);
    expect(ageOnDate('2008-11-23', new Date(2026, 10, 23, 23, 59, 59))).toBe(18);
  });

  it('returns null for impossible, future and malformed dates', () => {
    expect(ageOnDate('2026-02-30', CLOCK.today)).toBeNull();
    expect(ageOnDate('2026-11-24', CLOCK.today)).toBeNull();
    expect(ageOnDate('not-a-date', CLOCK.today)).toBeNull();
  });
});

describe('formatCurrency locale contract (US02-U04, G10/G11)', () => {
  it('passes the exact Intl options for es-CO/COP and es-CL/CLP', () => {
    const originalNumberFormat = Intl.NumberFormat;
    const observedOptions: Array<Intl.NumberFormatOptions | undefined> = [];

    class ObservedNumberFormat extends originalNumberFormat {
      constructor(locales?: string | string[], options?: Intl.NumberFormatOptions) {
        super(locales, options);
        observedOptions.push(options);
      }
    }

    vi.stubGlobal('Intl', Object.assign(Object.create(Intl), { NumberFormat: ObservedNumberFormat }));

    try {
      const cop = formatCurrency(620000, 'es-CO', 'COP');
      const clp = formatCurrency(490000, 'es-CL', 'CLP');

      expect(observedOptions).toEqual([
        { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 },
        { style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 0 },
      ]);
      expect(cop.replace(/\s/g, '')).toMatch(/620\.000/);
      expect(clp.replace(/\s/g, '')).toMatch(/490\.000/);
      for (const formatted of [cop, clp]) {
        expect(formatted).toMatch(/\$|COP|CLP/);
        expect(formatted).not.toMatch(/NaN|undefined/);
        expect(formatted).not.toMatch(/[.,]\d{2}$/);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
