import { FormControl, FormGroup, Validators } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { FormFieldConfig, FormValue } from '../../core/models';
import { UI_COPY } from '../../core/i18n/ui-copy';
import { DynamicFieldComponent } from './dynamic-field';
import {
  DynamicFormFactory,
  clRutValidator,
  coerceDraftValue,
  coDocumentNumberValidator,
  dateBoundsValidator,
  legalAgeValidator,
  normalizeFieldValue,
  plateValidator,
  vehicleYearValidator,
} from './dynamic-form.factory';

function makeField(
  overrides: Partial<FormFieldConfig> & Pick<FormFieldConfig, 'key' | 'type'>,
): FormFieldConfig {
  return {
    ...overrides,
    id: overrides.id ?? 1,
    documentId: overrides.documentId ?? 'doc-1',
    label: overrides.label ?? overrides.key,
    required: overrides.required ?? false,
    validations: overrides.validations ?? {},
    options: overrides.options ?? [],
    helpText: overrides.helpText ?? null,
    errorMessage: overrides.errorMessage ?? null,
    order: overrides.order ?? 1,
    country: overrides.country ?? 'CO',
    section: overrides.section ?? 'policyholder',
  };
}

describe('DynamicFormFactory', () => {
  let factory: DynamicFormFactory;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    factory = TestBed.inject(DynamicFormFactory);
  });

  it('maps required to Validators.required for non-checkbox fields (US01-U02)', () => {
    const field = makeField({ key: 'fullName', type: 'text', required: true });
    const form = factory.createForm([field], {});
    const control = form.controls['fullName'];

    expect(control.hasError('required')).toBe(true);
    control.setValue('Camila Rodríguez');
    expect(control.valid).toBe(true);
    expect(form.valid).toBe(true);
  });

  it('maps required checkbox to Validators.requiredTrue and persists only booleans (US01-U21)', () => {
    const field = makeField({ key: 'acceptMarketing', type: 'checkbox', required: true });
    const form = factory.createForm([field], {});
    const control = form.controls['acceptMarketing'];

    expect(control.value).toBe(false);
    expect(control.hasError('required')).toBe(true);
    expect(form.invalid).toBe(true);

    control.setValue(true);
    expect(control.valid).toBe(true);
    expect(form.valid).toBe(true);
    expect(typeof control.value).toBe('boolean');
  });

  it('maps minLength and maxLength from Strapi validations (US01-U02)', () => {
    const field = makeField({
      key: 'fullName',
      type: 'text',
      validations: { minLength: 3, maxLength: 5 },
    });
    const control = factory.createForm([field], {}).controls['fullName'];

    control.setValue('ab');
    expect(control.hasError('minlength')).toBe(true);
    control.setValue('abc');
    expect(control.valid).toBe(true);
    control.setValue('abcdef');
    expect(control.hasError('maxlength')).toBe(true);
  });

  it('maps numeric min/max but ignores them for vehicleYear (US01-U02, US01-U05)', () => {
    const numeric = makeField({
      key: 'someNumber',
      type: 'number',
      validations: { min: 1900, max: 2027 },
    });
    const numericControl = factory.createForm([numeric], {}).controls['someNumber'];

    numericControl.setValue(1899);
    expect(numericControl.hasError('min')).toBe(true);
    numericControl.setValue(2028);
    expect(numericControl.hasError('max')).toBe(true);
    numericControl.setValue(2019);
    expect(numericControl.valid).toBe(true);

    const vehicleYear = makeField({
      key: 'vehicleYear',
      type: 'number',
      validations: { rule: 'vehicleYear', min: 1900, max: 1901 },
    });
    const yearControl = factory.createForm([vehicleYear], { vehicleYear: 2026 }).controls['vehicleYear'];
    expect(yearControl.hasError('min')).toBe(false);
    expect(yearControl.hasError('max')).toBe(false);
    expect(yearControl.valid).toBe(true);
  });

  it('maps pattern and domain plate validators (US01-U02, US01-U08)', () => {
    const text = makeField({
      key: 'documentNumber',
      type: 'text',
      validations: { pattern: '^[0-9]+$' },
    });
    const textControl = factory.createForm([text], {}).controls['documentNumber'];
    textControl.setValue('12345');
    expect(textControl.valid).toBe(true);
    textControl.setValue('12-345');
    expect(textControl.hasError('pattern')).toBe(true);

    const coPlate = makeField({
      key: 'licensePlate',
      type: 'text',
      validations: { rule: 'coPlate', pattern: '^[A-Z]{3}[0-9]{3}$' },
    });
    const plateControl = factory.createForm([coPlate], { licensePlate: 'ABC123' }).controls['licensePlate'];
    expect(plateControl.valid).toBe(true);
    plateControl.setValue('AB1234');
    expect(plateControl.hasError('plate')).toBe(true);
  });

  it('reacts to sibling documentType for coDocumentNumber (US01-U07)', () => {
    const fields: readonly FormFieldConfig[] = [
      makeField({ key: 'documentType', type: 'select' }),
      makeField({
        key: 'documentNumber',
        type: 'text',
        validations: { rule: 'coDocumentNumber', pattern: '^[0-9]+$' },
      }),
    ];

    const form = factory.createForm(fields, {
      documentType: '',
      documentNumber: '1023456789',
    });
    const typeControl = form.controls['documentType'];
    const numberControl = form.controls['documentNumber'];

    expect(numberControl.hasError('coDocumentNumber')).toBe(true);
    expect(form.hasError('coDocumentNumber')).toBe(true);
    expect(form.invalid).toBe(true);

    typeControl.setValue('CC');
    expect(numberControl.valid).toBe(true);
    expect(form.valid).toBe(true);

    // CE accepts 12 digits, CC does not.
    numberControl.setValue('123456789012');
    expect(numberControl.hasError('coDocumentNumber')).toBe(true);
    typeControl.setValue('CE');
    expect(numberControl.valid).toBe(true);

    numberControl.setValue('102345678A');
    expect(numberControl.hasError('pattern')).toBe(true);
    expect(numberControl.hasError('coDocumentNumber')).toBe(true);
  });

  it('standalone coDocumentNumberValidator passes only with a valid sibling type', () => {
    const group = new FormGroup({
      documentType: new FormControl<FormValue>(''),
      documentNumber: new FormControl<FormValue>('123456'),
    });
    const control = group.controls.documentNumber;

    expect(coDocumentNumberValidator()(control)).toEqual({ coDocumentNumber: true });
    group.controls.documentType.setValue('CC');
    expect(coDocumentNumberValidator()(control)).toBeNull();
  });

  it('coerces restored draft values to the target control type (US01-U17)', () => {
    expect(coerceDraftValue(makeField({ key: 'vehicleYear', type: 'number' }), '2019')).toBe(2019);
    expect(coerceDraftValue(makeField({ key: 'vehicleYear', type: 'number' }), 'abc')).toBeNull();
    expect(coerceDraftValue(makeField({ key: 'vehicleYear', type: 'number' }), null)).toBeNull();
    expect(coerceDraftValue(makeField({ key: 'acceptMarketing', type: 'checkbox' }), 'true')).toBe(
      false,
    );
    expect(coerceDraftValue(makeField({ key: 'acceptMarketing', type: 'checkbox' }), true)).toBe(
      true,
    );
    expect(coerceDraftValue(makeField({ key: 'fullName', type: 'text' }), 123)).toBe('123');
    expect(coerceDraftValue(makeField({ key: 'fullName', type: 'text' }), null)).toBe('');
  });

  it('provides safe type defaults for newly added fields (US01-U12)', () => {
    expect(factory.defaultValue(makeField({ key: 'a', type: 'text' }))).toBe('');
    expect(factory.defaultValue(makeField({ key: 'b', type: 'number' }))).toBeNull();
    expect(factory.defaultValue(makeField({ key: 'c', type: 'checkbox' }))).toBe(false);
  });

  it('re-applies validators when the catalogue changes (US01-U12)', () => {
    const field = makeField({ key: 'fullName', type: 'text', required: false });
    const form = factory.createForm([field], { fullName: 'Camila Rodríguez' });
    expect(form.valid).toBe(true);

    factory.revalidate(
      form,
      [makeField({ key: 'fullName', type: 'text', required: true, validations: { minLength: 20 } })],
    );

    expect(form.controls['fullName'].hasError('required')).toBe(false);
    expect(form.controls['fullName'].hasError('minlength')).toBe(true);
    expect(form.invalid).toBe(true);
  });

  it('applies configured transforms on blur (US01-U08)', () => {
    expect(
      normalizeFieldValue(
        makeField({ key: 'licensePlate', type: 'text', validations: { rule: 'coPlate' } }),
        ' abc123 ',
      ),
    ).toBe('ABC123');
    expect(
      normalizeFieldValue(
        makeField({ key: 'documentNumber', type: 'text', validations: { rule: 'clRut' } }),
        '12.345.678-5',
      ),
    ).toBe('12345678-5');
    expect(
      normalizeFieldValue(
        makeField({ key: 'fullName', type: 'text', validations: { transform: 'trim' } }),
        '  Camila  ',
      ),
    ).toBe('Camila');
    expect(
      normalizeFieldValue(makeField({ key: 'n', type: 'number' }), '2019'),
    ).toBe('2019');
  });

  it('exposes pure domain validators used by the factory', () => {
    const today = new Date(2026, 10, 23);

    expect(legalAgeValidator(today)(new FormControl('2008-11-23'))).toBeNull();
    expect(legalAgeValidator(today)(new FormControl('2008-11-24'))).toEqual({ legalAge: true });
    expect(vehicleYearValidator(today)(new FormControl(2026.5))).toEqual({ vehicleYear: true });
    expect(clRutValidator()(new FormControl('12.345.678-5'))).toBeNull();
    expect(clRutValidator()(new FormControl('12.345.678-9'))).toEqual({ clRut: true });
    expect(dateBoundsValidator('1900-01-01')(new FormControl('1899-12-31'))).toEqual({
      dateRange: true,
    });
    expect(dateBoundsValidator('1900-01-01')(new FormControl('1990-01-01'))).toBeNull();
  });

  it('never throws on an invalid configured regex', () => {
    const field = makeField({
      key: 'fullName',
      type: 'text',
      validations: { pattern: '[' },
    });
    const control = factory.createForm([field], {}).controls['fullName'];
    control.setValue('Camila');
    expect(control.valid).toBe(true);
  });
});

describe('DynamicFieldComponent error message resolution (US01-U19)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DynamicFieldComponent] }).compileComponents();
  });

  function render(field: FormFieldConfig, control: FormControl<FormValue>): HTMLElement {
    const fixture = TestBed.createComponent(DynamicFieldComponent);
    fixture.componentRef.setInput('field', field);
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the Strapi errorMessage verbatim for an invalid touched field', () => {
    const field = makeField({
      key: 'documentNumber',
      type: 'text',
      helpText: 'Ingresa tu RUT con o sin puntos y guion.',
      errorMessage: 'El RUT ingresado no es válido.',
      validations: { rule: 'clRut' },
    });
    const control = new FormControl<FormValue>('12.345.678-9', clRutValidator());
    control.markAsTouched();

    const host = render(field, control);
    const error = host.querySelector<HTMLElement>('#err-documentNumber');

    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent?.trim()).toBe('El RUT ingresado no es válido.');
    expect(host.querySelector('input')?.getAttribute('aria-invalid')).toBe('true');
    expect(host.querySelector('#help-documentNumber')?.textContent).toContain('RUT');
    expect(host.querySelector('input')?.getAttribute('aria-describedby')).toBe(
      'help-documentNumber err-documentNumber',
    );
  });

  it('falls back to neutral Spanish copy when errorMessage is null or blank', () => {
    const control = new FormControl<FormValue>('', Validators.required);
    control.markAsTouched();

    const nullHost = render(
      makeField({ key: 'fullName', type: 'text', required: true, errorMessage: null }),
      control,
    );
    expect(nullHost.querySelector('#err-fullName')?.textContent?.trim()).toBe(
      UI_COPY.fallbackValidation,
    );

    const blankHost = render(
      makeField({ key: 'fullName', type: 'text', required: true, errorMessage: '   ' }),
      control,
    );
    expect(blankHost.querySelector('#err-fullName')?.textContent?.trim()).toBe(
      UI_COPY.fallbackValidation,
    );
  });

  it('does not render an error for a valid or untouched control', () => {
    const field = makeField({
      key: 'licensePlate',
      type: 'text',
      errorMessage: 'La placa debe tener el formato ABC123.',
      validations: { rule: 'coPlate', pattern: '^[A-Z]{3}[0-9]{3}$' },
    });

    const validHost = render(field, new FormControl<FormValue>('XYZ987', plateValidator('^[A-Z]{3}[0-9]{3}$')));
    expect(validHost.querySelector('[role="alert"]')).toBeNull();

    const untouched = new FormControl<FormValue>('AB1234', plateValidator('^[A-Z]{3}[0-9]{3}$'));
    const untouchedHost = render(field, untouched);
    expect(untouchedHost.querySelector('[role="alert"]')).toBeNull();
  });
});
