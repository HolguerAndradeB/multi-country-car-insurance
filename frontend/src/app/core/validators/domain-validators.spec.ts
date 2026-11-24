import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import { vehicleYearValidator } from '../../features/quote/steps/policyholder-vehicle/dynamic-form.factory';
import {
  isLegalAge,
  isValidClRut,
  isValidCoDocument,
  normalizeClRut,
  normalizePlate,
  vehicleYearBounds,
} from './domain-validators';

const TODAY_2026_11_23 = new Date(2026, 10, 23);

describe('isLegalAge (US01-U03, US01-U04, G1/G2/G3)', () => {
  it('accepts a birth date that turns 18 exactly today (local calendar date)', () => {
    expect(isLegalAge('2008-11-23', TODAY_2026_11_23)).toBe(true);
    // Time of day must not change the calendar-date comparison.
    expect(isLegalAge('2008-11-23', new Date(2026, 10, 23, 23, 59, 59))).toBe(true);
  });

  it('rejects a birth date one day younger than 18 (17 years 364 days)', () => {
    expect(isLegalAge('2008-11-24', TODAY_2026_11_23)).toBe(false);
  });

  it('applies the 28-Feb rule for 29-Feb birthdays in non-leap years', () => {
    expect(isLegalAge('2008-02-29', new Date(2026, 1, 27))).toBe(false);
    expect(isLegalAge('2008-02-29', new Date(2026, 1, 28))).toBe(true);
    expect(isLegalAge('2008-02-29', new Date(2026, 2, 1))).toBe(true);
  });

  it('rejects future birth dates and dates before the 1900-01-01 sanity floor', () => {
    expect(isLegalAge('2026-11-24', TODAY_2026_11_23)).toBe(false);
    expect(isLegalAge('1899-12-31', TODAY_2026_11_23)).toBe(false);
    // The floor itself is a parseable date and is accepted once adulthood is reached.
    expect(isLegalAge('1900-01-01', new Date(2018, 0, 1))).toBe(true);
  });

  it('rejects impossible, malformed and empty calendar dates', () => {
    expect(isLegalAge('2026-02-30', TODAY_2026_11_23)).toBe(false);
    expect(isLegalAge('23/11/2008', TODAY_2026_11_23)).toBe(false);
    expect(isLegalAge('', TODAY_2026_11_23)).toBe(false);
  });
});

describe('vehicleYearBounds / vehicleYearValidator (US01-U05, G4)', () => {
  it('computes currentYear - 20 .. currentYear + 1', () => {
    expect(vehicleYearBounds(new Date(2026, 10, 23))).toEqual({ min: 2006, max: 2027 });
    expect(vehicleYearBounds(new Date(2027, 0, 1))).toEqual({ min: 2007, max: 2028 });
  });

  it('accepts 2006 and 2027 in 2026 but rejects 2005, 2028 and fractional years', () => {
    const validator = vehicleYearValidator(TODAY_2026_11_23);

    expect(validator(new FormControl(2006))).toBeNull();
    expect(validator(new FormControl(2027))).toBeNull();
    expect(validator(new FormControl(2005))).toEqual({ vehicleYear: true });
    expect(validator(new FormControl(2028))).toEqual({ vehicleYear: true });
    expect(validator(new FormControl(2026.5))).toEqual({ vehicleYear: true });
  });
});

describe('isValidClRut / normalizeClRut (US01-U06, G8)', () => {
  it('accepts dotted, dashed, bare and lowercase-k forms with a valid módulo-11 digit', () => {
    expect(isValidClRut('12.345.678-5')).toBe(true);
    expect(isValidClRut('12345678-5')).toBe(true);
    expect(isValidClRut('123456785')).toBe(true);
    expect(isValidClRut('12.345.6785')).toBe(true);
    expect(isValidClRut('10.000.019-9')).toBe(true);
    expect(isValidClRut('1.000.019-k')).toBe(true);
    expect(isValidClRut('1000019-K')).toBe(true);
  });

  it('rejects an invalid check digit and malformed bodies', () => {
    expect(isValidClRut('12.345.678-9')).toBe(false);
    // Accepted *format* but wrong check digit: 12345678 verifies as 5.
    expect(isValidClRut('12.345.6789')).toBe(false);
    expect(isValidClRut('10.000.019-K')).toBe(false);
    expect(isValidClRut('123-4')).toBe(false);
    expect(isValidClRut('12.345.678-A')).toBe(false);
    expect(isValidClRut('')).toBe(false);
  });

  it('normalises to canonical body-dash-checkdigit form with an uppercase K', () => {
    expect(normalizeClRut('12.345.678-5')).toBe('12345678-5');
    expect(normalizeClRut('123456785')).toBe('12345678-5');
    expect(normalizeClRut('1.000.019-k')).toBe('1000019-K');
    expect(normalizeClRut(' 12.345.678 5 ')).toBe('12345678-5');
    expect(normalizeClRut('not-a-rut')).toBe('NOTARUT');
  });
});

describe('isValidCoDocument (US01-U07, G6)', () => {
  it('enforces 6-10 digits for CC', () => {
    expect(isValidCoDocument('CC', '123456')).toBe(true);
    expect(isValidCoDocument('CC', '1023456789')).toBe(true);
    expect(isValidCoDocument('CC', '12345')).toBe(false);
    expect(isValidCoDocument('CC', '12345678901')).toBe(false);
  });

  it('enforces 6-12 digits for CE', () => {
    expect(isValidCoDocument('CE', '123456')).toBe(true);
    expect(isValidCoDocument('CE', '123456789012')).toBe(true);
    expect(isValidCoDocument('CE', '1234567890123')).toBe(false);
  });

  it('rejects non-digits, missing/unknown document types and trims input', () => {
    expect(isValidCoDocument('CC', '102345678A')).toBe(false);
    expect(isValidCoDocument('CC', '10 234 567')).toBe(false);
    expect(isValidCoDocument('', '1023456789')).toBe(false);
    expect(isValidCoDocument('TI', '1023456789')).toBe(false);
    expect(isValidCoDocument('cc', ' 1023456789 ')).toBe(true);
  });
});

describe('normalizePlate and seeded plate patterns (US01-U08, G7/G9)', () => {
  const coPattern = /^[A-Z]{3}[0-9]{3}$/;
  const clPattern = /^(?:[A-Z]{4}[0-9]{2}|[A-Z]{2}[0-9]{4})$/;

  it('trims and upper-cases plate input', () => {
    expect(normalizePlate(' abc123 ')).toBe('ABC123');
    expect(normalizePlate('abcd12')).toBe('ABCD12');
    expect(normalizePlate('aa1234')).toBe('AA1234');
  });

  it('matches the CO format ABC123 only after normalisation', () => {
    expect(coPattern.test(normalizePlate('xyz987'))).toBe(true);
    expect(coPattern.test('XYZ987')).toBe(true);
    expect(coPattern.test('AB1234')).toBe(false);
    expect(coPattern.test('ABC-123')).toBe(false);
    expect(coPattern.test('ABC 123')).toBe(false);
  });

  it('matches exactly the two CL formats ABCD12 and AA1234', () => {
    expect(clPattern.test('ABCD12')).toBe(true);
    expect(clPattern.test('AA1234')).toBe(true);
    expect(clPattern.test('ABC123')).toBe(false);
    expect(clPattern.test('ABC-12')).toBe(false);
  });
});
