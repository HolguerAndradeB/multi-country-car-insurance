import { Injectable, isDevMode } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

import type { FormFieldConfig, FormValue, WizardFormGroup } from '../../../../core/models';
import {
  isLegalAge,
  isValidClRut,
  isValidCoDocument,
  normalizeClRut,
  normalizePlate,
  vehicleYearBounds,
} from '../../../../core/validators/domain-validators';

const DEFAULT_PLATE_PATTERNS = {
  coPlate: '^[A-Z]{3}[0-9]{3}$',
  clPlate: '^(?:[A-Z]{4}[0-9]{2}|[A-Z]{2}[0-9]{4})$',
} as const;

@Injectable({ providedIn: 'root' })
export class DynamicFormFactory {
  createForm(
    fields: readonly FormFieldConfig[],
    initial: Readonly<Record<string, FormValue>>,
  ): WizardFormGroup {
    const controls: Record<string, FormControl<FormValue>> = {};
    for (const field of fields) {
      controls[field.key] = this.createControl(field, initial[field.key]);
    }

    const form: WizardFormGroup = new FormGroup<Record<string, FormControl<FormValue>>>(controls);
    form.setValidators(this.groupValidators(fields));
    form.updateValueAndValidity({ emitEvent: false });
    return form;
  }

  createControl(field: FormFieldConfig, initial: FormValue | undefined): FormControl<FormValue> {
    return new FormControl<FormValue>(coerceDraftValue(field, initial), {
      validators: this.validatorsFor(field),
    });
  }

  defaultValue(field: FormFieldConfig): FormValue {
    switch (field.type) {
      case 'number':
        return null;
      case 'checkbox':
        return false;
      default:
        return '';
    }
  }

  revalidate(form: WizardFormGroup, fields: readonly FormFieldConfig[]): void {
    for (const field of fields) {
      const control = form.controls[field.key];
      if (control) {
        control.setValidators(this.validatorsFor(field));
        control.updateValueAndValidity({ onlySelf: true, emitEvent: false });
      }
    }
    form.setValidators(this.groupValidators(fields));
    form.updateValueAndValidity({ emitEvent: false });
  }

  private validatorsFor(field: FormFieldConfig): ValidatorFn[] {
    const validators: ValidatorFn[] = [];
    const rules = field.validations;

    if (field.required) {
      validators.push(field.type === 'checkbox' ? Validators.requiredTrue : Validators.required);
    }
    if (typeof rules.minLength === 'number') {
      validators.push(Validators.minLength(rules.minLength));
    }
    if (typeof rules.maxLength === 'number') {
      validators.push(Validators.maxLength(rules.maxLength));
    }
    if (field.type === 'number' && rules.rule !== 'vehicleYear') {
      if (typeof rules.min === 'number') {
        validators.push(Validators.min(rules.min));
      }
      if (typeof rules.max === 'number') {
        validators.push(Validators.max(rules.max));
      }
    }
    if (rules.pattern) {
      const pattern = this.safePattern(rules.pattern, field.key);
      if (pattern) {
        validators.push(Validators.pattern(pattern));
      }
    }

    switch (rules.rule) {
      case 'legalAge':
        validators.push(dateBoundsValidator(rules.minDate, rules.maxDate), legalAgeValidator());
        break;
      case 'vehicleYear':
        validators.push(vehicleYearValidator());
        break;
      case 'clRut':
        validators.push(clRutValidator());
        break;
      case 'coPlate':
      case 'clPlate':
        validators.push(plateValidator(rules.pattern ?? DEFAULT_PLATE_PATTERNS[rules.rule]));
        break;
      case 'coDocumentNumber':
        validators.push(coDocumentNumberValidator());
        break;
      default:
        break;
    }

    return validators;
  }

  private groupValidators(fields: readonly FormFieldConfig[]): ValidatorFn[] {
    const documentField = fields.find((field) => field.validations.rule === 'coDocumentNumber');
    if (!documentField) {
      return [];
    }

    let revalidating = false;
    return [
      (group: AbstractControl): ValidationErrors | null => {
        if (revalidating) {
          return null;
        }
        const documentControl = group.get(documentField.key);
        if (!documentControl) {
          return null;
        }

        revalidating = true;
        documentControl.updateValueAndValidity({ onlySelf: true });
        revalidating = false;

        return documentControl.hasError('coDocumentNumber') ? { coDocumentNumber: true } : null;
      },
    ];
  }

  private safePattern(pattern: string, fieldKey: string): RegExp | null {
    try {
      return new RegExp(pattern);
    } catch {
      if (isDevMode()) {
        console.warn(`[form] invalid pattern configured for field "${fieldKey}".`);
      }
      return null;
    }
  }
}

/** Rehydrates a draft value according to the target field type (G21). */
export function coerceDraftValue(field: FormFieldConfig, rawValue: FormValue | undefined): FormValue {
  if (rawValue === null || rawValue === undefined) {
    return field.type === 'checkbox' ? false : field.type === 'number' ? null : '';
  }

  switch (field.type) {
    case 'number': {
      const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue);
      return Number.isFinite(numeric) ? numeric : null;
    }
    case 'checkbox':
      return rawValue === true;
    default:
      return typeof rawValue === 'string' ? rawValue : String(rawValue);
  }
}

/** Transform applied on blur before validation (Strapi `validations.transform`). */
export function normalizeFieldValue(field: FormFieldConfig, rawValue: FormValue): FormValue {
  if (rawValue === null || typeof rawValue === 'boolean' || field.type === 'number') {
    return rawValue;
  }

  const rule = field.validations.rule;
  if (rule === 'clRut') {
    return normalizeClRut(String(rawValue));
  }
  if (rule === 'coPlate' || rule === 'clPlate') {
    return normalizePlate(String(rawValue));
  }

  let text = String(rawValue);
  if (field.validations.transform === 'uppercase') {
    text = text.toUpperCase();
  }
  if (field.validations.transform === 'trim' || field.validations.transform === 'uppercase') {
    text = text.trim();
  }
  return text;
}

export function legalAgeValidator(today: Date = new Date()): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isEmpty(control.value)) {
      return null;
    }
    return isLegalAge(String(control.value), today) ? null : { legalAge: true };
  };
}

export function vehicleYearValidator(today: Date = new Date()): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isEmpty(control.value)) {
      return null;
    }
    const numeric = typeof control.value === 'number' ? control.value : Number(control.value);
    if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
      return { vehicleYear: true };
    }
    const bounds = vehicleYearBounds(today);
    return numeric >= bounds.min && numeric <= bounds.max ? null : { vehicleYear: true };
  };
}

export function clRutValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    isEmpty(control.value) || isValidClRut(String(control.value)) ? null : { clRut: true };
}

export function plateValidator(pattern: string): ValidatorFn {
  let matcher: RegExp | null = null;
  try {
    matcher = new RegExp(pattern);
  } catch {
    matcher = null;
  }

  return (control: AbstractControl): ValidationErrors | null => {
    if (isEmpty(control.value)) {
      return null;
    }
    if (!matcher) {
      return null;
    }
    return matcher.test(normalizePlate(String(control.value))) ? null : { plate: true };
  };
}

export function coDocumentNumberValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isEmpty(control.value)) {
      return null;
    }
    const documentTypeControl = control.parent?.get('documentType');
    const documentType = documentTypeControl ? String(documentTypeControl.value ?? '') : '';
    return isValidCoDocument(documentType, String(control.value)) ? null : { coDocumentNumber: true };
  };
}

export function dateBoundsValidator(minDate?: string, maxDate?: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isEmpty(control.value)) {
      return null;
    }
    const value = String(control.value);
    if ((minDate && value < minDate) || (maxDate && value > maxDate)) {
      return { dateRange: true };
    }
    return null;
  };
}

function isEmpty(value: FormValue | undefined): boolean {
  return value === null || value === undefined || value === '';
}
