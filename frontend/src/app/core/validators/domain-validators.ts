/**
 * Pure domain validators with no Angular imports, so they are trivially unit
 * testable (US-01 §5.2). All date comparisons use browser-local calendar dates.
 */

export interface VehicleYearBounds {
  readonly min: number;
  readonly max: number;
}

export function vehicleYearBounds(today: Date = new Date()): VehicleYearBounds {
  const currentYear = today.getFullYear();
  return { min: currentYear - 20, max: currentYear + 1 };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || month < 1 || month > 12 || day < 1) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

/** 18th birthday must have occurred on or before today's local calendar date. */
export function isLegalAge(birthDateIso: string, today: Date = new Date()): boolean {
  const birthDate = parseIsoDate(birthDateIso);
  if (!birthDate) {
    return false;
  }

  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (birthDate > localToday) {
    return false;
  }

  const turning18Year = birthDate.getFullYear() + 18;
  const anniversaryMonth = birthDate.getMonth();
  let anniversaryDay = birthDate.getDate();
  if (anniversaryMonth === 1 && anniversaryDay === 29 && !isLeapYear(turning18Year)) {
    anniversaryDay = 28;
  }

  const turns18 = new Date(turning18Year, anniversaryMonth, anniversaryDay);
  return turns18 <= localToday;
}

/** Strips separators and normalises a Chilean RUT to `12345678-9`. */
export function normalizeClRut(value: string): string {
  const cleaned = value.replace(/[.\s-]/g, '').toUpperCase();
  const match = /^(\d{7,8})([0-9K])$/.exec(cleaned);
  return match ? `${match[1]}-${match[2]}` : cleaned;
}

/** Strict módulo-11 check digit; accepts dotted, dashed or bare RUTs. */
export function isValidClRut(value: string): boolean {
  const cleaned = value.replace(/[.\s-]/g, '').toUpperCase();
  const match = /^(\d{7,8})([0-9K])$/.exec(cleaned);
  if (!match) {
    return false;
  }

  const body = match[1];
  const checkDigit = match[2];
  let sum = 0;
  let multiplier = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body.charAt(index)) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  const expected = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);
  return checkDigit === expected;
}

/** Conditional Colombian document rule: `CC` 6–10 digits, `CE` 6–12 digits. */
export function isValidCoDocument(documentType: string, value: string): boolean {
  const digits = value.trim();
  if (!/^[0-9]+$/.test(digits)) {
    return false;
  }

  const type = documentType.trim().toUpperCase();
  if (type === 'CC') {
    return digits.length >= 6 && digits.length <= 10;
  }
  if (type === 'CE') {
    return digits.length >= 6 && digits.length <= 12;
  }
  return false;
}

export function normalizePlate(value: string): string {
  return value.trim().toUpperCase();
}
