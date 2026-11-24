import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AppLocale,
  FormFieldConfig,
  FormValue,
  PlanSummaryCopy,
  QuotedPlan,
} from '../models';
import {
  buildPlanSummary,
  buildQuoteNumber,
  buildSummarySections,
  formatIsoDate,
  maskDocumentNumber,
} from './summary.helper';

const FIXED_CLOCK: Readonly<{ readonly today: Date }> = {
  today: new Date(2026, 10, 24),
};

const COPY: PlanSummaryCopy = {
  basePriceLabel: 'Precio base',
  finalPriceLabel: 'Precio final estimado',
  adjustmentLabel: 'Ajuste simulado',
  noAdjustment: 'Sin ajuste simulado aplicado',
  simulatedFootnote: 'Los precios son simulados y no constituyen una oferta comercial.',
};

function field(overrides: Partial<FormFieldConfig> & Pick<FormFieldConfig, 'key' | 'type'>): FormFieldConfig {
  return {
    id: overrides.id ?? 1,
    documentId: overrides.documentId ?? `field-${overrides.key}`,
    label: overrides.label ?? overrides.key,
    required: overrides.required ?? false,
    validations: overrides.validations ?? {},
    options: overrides.options ?? [],
    helpText: overrides.helpText ?? null,
    errorMessage: overrides.errorMessage ?? null,
    order: overrides.order ?? 1,
    country: overrides.country ?? 'CO',
    section: overrides.section ?? 'policyholder',
    ...overrides,
  };
}

function values(entries: Readonly<Record<string, FormValue>>): Readonly<Record<string, FormValue>> {
  return entries;
}

function renderSections(
  fields: readonly FormFieldConfig[],
  currentValues: Readonly<Record<string, FormValue>>,
  visibleEnd = 4,
): ReturnType<typeof buildSummarySections> {
  return buildSummarySections(fields, currentValues, visibleEnd, 'Sí', 'No', '—');
}

function localizedDate(iso: string, locale: AppLocale): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (parts === null) {
    throw new Error('The fixture must be a valid ISO date.');
  }
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])));
}

describe('summary.helper (US03-U01, US03-U02, US03-U03, US03-U04, US03-U05, US03-U12)', () => {
  let previousDevMode: boolean | undefined;

  beforeEach(() => {
    previousDevMode = (globalThis as { ngDevMode?: boolean }).ngDevMode;
    Reflect.set(globalThis, 'ngDevMode', true);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (previousDevMode === undefined) {
      Reflect.deleteProperty(globalThis, 'ngDevMode');
    } else {
      Reflect.set(globalThis, 'ngDevMode', previousDevMode);
    }
    vi.restoreAllMocks();
  });

  it('US03-U01: masks a Colombian document with one bullet per hidden digit', () => {
    expect(maskDocumentNumber('123456789', 4)).toBe('•••••6789');
    expect(maskDocumentNumber('123456789', 4)).toHaveLength('123456789'.length);
  });

  it('US03-U02: fully masks at visibleEnd <= 0 and keeps short values verbatim', () => {
    expect(maskDocumentNumber('123456789', 0)).toBe('•••••••••');
    expect(maskDocumentNumber('123456789', -3)).toBe('•••••••••');
    expect(maskDocumentNumber('1234', 4)).toBe('1234');
    expect(maskDocumentNumber('12', 4)).toBe('12');
    expect(maskDocumentNumber('', 4)).toBe('');
    expect(maskDocumentNumber('   ', 4)).toBe('');
  });

  it('US03-U02: degrades a non-finite or non-number visibleEnd to 4', () => {
    expect(maskDocumentNumber('123456789', Number.NaN)).toBe('•••••6789');
    expect(maskDocumentNumber('123456789', Number.POSITIVE_INFINITY)).toBe('•••••6789');
    const looseMask = maskDocumentNumber as unknown as (raw: string, visibleEnd: unknown) => string;
    expect(looseMask('123456789', 'invalid')).toBe('•••••6789');
    expect(Reflect.apply(maskDocumentNumber, undefined, ['123456789', null])).toBe('•••••6789');
  });

  it('US03-U02: formats ISO dates on the local calendar and passes invalid input through', () => {
    expect(formatIsoDate('1990-06-15', 'es-CO')).toBe(localizedDate('1990-06-15', 'es-CO'));
    expect(formatIsoDate('1990-06-15', 'es-CL')).toBe(localizedDate('1990-06-15', 'es-CL'));
    expect(formatIsoDate('2026-02-30', 'es-CO')).toBe('2026-02-30');
    expect(formatIsoDate('not-a-date', 'es-CO')).toBe('not-a-date');
    expect(formatIsoDate('', 'es-CL')).toBe('');
  });

  it('US03-U03: always reveals a Chilean RUT dash and verifier together', () => {
    expect(maskDocumentNumber('12345678-K', 4)).toBe('••••••78-K');
    expect(maskDocumentNumber('12345678-k', 4)).toBe('••••••78-k');
    expect(maskDocumentNumber('12345678-5', 4)).toBe('••••••78-5');
    expect(maskDocumentNumber('12345678-K', 1)).toBe('••••••••-K');
    expect(maskDocumentNumber('12345678-K', 0)).toBe('••••••••••');
  });

  it('US03-U04: groups fields by section and sorts by order with an id tie-break', () => {
    const sections = renderSections(
      [
        field({ key: 'licensePlate', type: 'text', order: 7, section: 'vehicle' }),
        field({ key: 'documentNumber', type: 'text', order: 2 }),
        field({ key: 'city', type: 'select', order: 5, id: 9 }),
        field({ key: 'fullName', type: 'text', order: 5, id: 2 }),
      ],
      values({
        licensePlate: 'ABC123',
        documentNumber: '123456789',
        city: 'BOG',
        fullName: 'Ana Ejemplo',
      }),
    );

    expect(sections.map((section) => section.id)).toEqual(['policyholder', 'vehicle']);
    expect(sections.map((section) => section.heading)).toEqual(['Tomador', 'Vehículo']);
    expect(sections[0]?.rows.map((row) => row.key)).toEqual(['documentNumber', 'fullName', 'city']);
    expect(sections[1]?.rows.map((row) => row.key)).toEqual(['licensePlate']);
  });

  it('US03-U04: uses verbatim labels, resolves option labels and falls back with a warning', () => {
    const warn = vi.spyOn(console, 'warn');
    const sections = renderSections(
      [
        field({
          key: 'documentType',
          type: 'select',
          label: 'Tipo de documento',
          order: 1,
          options: [
            { value: 'CC', label: 'Cédula de ciudadanía' },
            { value: 'CE', label: 'Cédula de extranjería' },
          ],
        }),
        field({
          key: 'city',
          type: 'select',
          label: 'Ciudad de residencia',
          order: 2,
          options: [{ value: 'BOG', label: 'Bogotá D.C.' }],
        }),
      ],
      values({ documentType: 'CC', city: 'REMOVED' }),
    );

    const rows = sections[0]?.rows ?? [];
    expect(rows[0]).toEqual({
      key: 'documentType',
      label: 'Tipo de documento',
      value: 'Cédula de ciudadanía',
    });
    expect(rows[1]).toEqual({
      key: 'city',
      label: 'Ciudad de residencia',
      value: 'REMOVED',
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('city'));
  });

  it('US03-U04: renders Sí/No, omits optional blanks and shows — for required blanks', () => {
    const sections = renderSections(
      [
        field({ key: 'acceptMarketing', type: 'checkbox', label: 'Marketing', order: 1 }),
        field({ key: 'requiredText', type: 'text', label: 'Obligatorio', required: true, order: 2 }),
        field({ key: 'optionalText', type: 'text', label: 'Opcional', order: 3 }),
        field({ key: 'optionalNumber', type: 'number', label: 'Número opcional', order: 4 }),
      ],
      values({
        acceptMarketing: true,
        optionalText: '   ',
        optionalNumber: null,
      }),
    );

    const rows = sections[0]?.rows ?? [];
    expect(rows).toEqual([
      { key: 'acceptMarketing', label: 'Marketing', value: 'Sí' },
      { key: 'requiredText', label: 'Obligatorio', value: '—' },
    ]);

    const negative = renderSections(
      [field({ key: 'acceptMarketing', type: 'checkbox', label: 'Marketing' })],
      values({ acceptMarketing: false }),
    );
    expect(negative[0]?.rows[0]?.value).toBe('No');
  });

  it('US03-U04: localizes ISO dates and masks only documentNumber, never licensePlate', () => {
    const sections = renderSections(
      [
        field({ key: 'documentNumber', type: 'text', label: 'Número de documento', order: 1 }),
        field({ key: 'birthDate', type: 'date', label: 'Fecha de nacimiento', order: 2 }),
        field({ key: 'licensePlate', type: 'text', label: 'Placa del vehículo', order: 3, section: 'vehicle' }),
      ],
      values({
        documentNumber: '12345678-K',
        birthDate: '1990-06-15',
        licensePlate: 'ABC123',
      }),
    );

    expect(sections[0]?.rows).toEqual([
      { key: 'documentNumber', label: 'Número de documento', value: '••••••78-K' },
      { key: 'birthDate', label: 'Fecha de nacimiento', value: localizedDate('1990-06-15', 'es-CO') },
    ]);
    expect(sections[1]?.rows).toEqual([
      { key: 'licensePlate', label: 'Placa del vehículo', value: 'ABC123' },
    ]);
  });

  it('US03-U05: reads the three price lines directly from QuotedPlan without recomputing', () => {
    const quoted: QuotedPlan = {
      plan: {
        id: 2,
        documentId: 'planco00000000000000002',
        key: 'estandar',
        name: 'Plan Estándar',
        shortDescription: 'Descripción ficticia de demostración.',
        basePrice: 620000,
        currency: 'COP',
        coverages: [],
        benefits: [],
        order: 2,
        recommended: true,
        country: 'CO',
      },
      basePrice: 620000,
      // Deliberately inconsistent with basePrice: a recomputation would fail this test.
      finalPrice: 999999,
      formattedBasePrice: '$ 620.000',
      formattedFinalPrice: '$ 999.999',
      adjustment: {
        adjustmentPercent: 14,
        reasons: ['por antigüedad del vehículo', 'por edad del conductor'],
        finalPrice: 999999,
      },
    };

    const summary = buildPlanSummary(quoted, COPY);

    expect(summary).toEqual({
      name: 'Plan Estándar',
      shortDescription: 'Descripción ficticia de demostración.',
      basePriceText: 'Precio base: $ 620.000',
      finalPriceText: 'Precio final estimado: $ 999.999',
      adjustmentText:
        'Ajuste simulado: +14% · por antigüedad del vehículo, por edad del conductor',
      footnote: 'Los precios son simulados y no constituyen una oferta comercial.',
      finalPrice: 999999,
    });
  });

  it('US03-U05: renders the no-adjustment line when the simulated percent is zero', () => {
    const quoted: QuotedPlan = {
      plan: {
        id: 1,
        documentId: 'plancl00000000000000001',
        key: 'basico',
        name: 'Plan Básico',
        shortDescription: 'Descripción ficticia de demostración.',
        basePrice: 280000,
        currency: 'CLP',
        coverages: [],
        benefits: [],
        order: 1,
        recommended: false,
        country: 'CL',
      },
      basePrice: 280000,
      finalPrice: 280000,
      formattedBasePrice: '$ 280.000',
      formattedFinalPrice: '$ 280.000',
      adjustment: { adjustmentPercent: 0, reasons: [], finalPrice: 280000 },
    };

    expect(buildPlanSummary(quoted, COPY).adjustmentText).toBe('Sin ajuste simulado aplicado');
  });

  it('US03-U12: builds a deterministic COT number with a fixed clock and canonical payload', () => {
    const payload: Readonly<Record<string, string>> = {
      'policyholder.documentNumber': '•••••6789',
      'policyholder.fullName': 'Ana Ejemplo',
      planDocumentId: 'planco00000000000000002',
      termsDocumentId: 'cfgcol0000000000000001',
      locale: 'es-CO',
    };

    expect(buildQuoteNumber('CO', payload, FIXED_CLOCK)).toBe('COT-CO-20261124-PW9ELV');
    const shuffled: Readonly<Record<string, string>> = {
      locale: 'es-CO',
      planDocumentId: 'planco00000000000000002',
      'policyholder.fullName': 'Ana Ejemplo',
      termsDocumentId: 'cfgcol0000000000000001',
      'policyholder.documentNumber': '•••••6789',
    };
    expect(buildQuoteNumber('CO', shuffled, FIXED_CLOCK)).toBe('COT-CO-20261124-PW9ELV');
    expect(buildQuoteNumber('CO', payload, { today: new Date(2026, 10, 25) })).toMatch(
      /^COT-CO-20261125-[0-9A-Z]{6}$/,
    );
  });

  it('US03-U12: prefixes Chilean numbers with COT-CL and derives a distinct suffix', () => {
    const clPayload: Readonly<Record<string, string>> = {
      'policyholder.documentNumber': '••••••78-K',
      'policyholder.fullName': 'Carlos Ejemplo',
      planDocumentId: 'plancl00000000000000002',
      termsDocumentId: 'cfgcll0000000000000001',
      locale: 'es-CL',
    };

    expect(buildQuoteNumber('CL', clPayload, FIXED_CLOCK)).toBe('COT-CL-20261124-JT5BAQ');
    expect(buildQuoteNumber('CL', clPayload, FIXED_CLOCK)).not.toBe(
      buildQuoteNumber('CO', clPayload, FIXED_CLOCK),
    );
  });
});
