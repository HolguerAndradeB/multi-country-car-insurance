import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { UI_COPY } from '../../core/i18n/ui-copy';
import type { FormFieldConfig, FormValue } from '../../core/models';
import { vehicleYearBounds } from '../../core/validators/domain-validators';
import { normalizeFieldValue } from './dynamic-form.factory';

@Component({
  selector: 'app-dynamic-field',
  imports: [ReactiveFormsModule],
  templateUrl: './dynamic-field.html',
  styleUrl: './dynamic-field.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicFieldComponent {
  readonly field = input.required<FormFieldConfig>();
  readonly control = input.required<FormControl<FormValue>>();
  readonly submitted = input(false);

  protected readonly copy = UI_COPY;

  isInvalid(): boolean {
    const control = this.control();
    return control.invalid && (control.touched || this.submitted());
  }

  describedBy(): string | null {
    const ids: string[] = [];
    if (this.field().helpText) {
      ids.push(`help-${this.field().key}`);
    }
    if (this.isInvalid()) {
      ids.push(`err-${this.field().key}`);
    }
    return ids.length > 0 ? ids.join(' ') : null;
  }

  errorMessage(): string {
    const configured = this.field().errorMessage;
    return configured && configured.trim().length > 0 ? configured : UI_COPY.fallbackValidation;
  }

  numberMin(): string | null {
    const validation = this.field().validations;
    if (validation.rule === 'vehicleYear') {
      return String(vehicleYearBounds().min);
    }
    return typeof validation.min === 'number' ? String(validation.min) : null;
  }

  numberMax(): string | null {
    const validation = this.field().validations;
    if (validation.rule === 'vehicleYear') {
      return String(vehicleYearBounds().max);
    }
    return typeof validation.max === 'number' ? String(validation.max) : null;
  }

  autocomplete(): string {
    switch (this.field().key) {
      case 'fullName':
        return 'name';
      case 'documentNumber':
      case 'licensePlate':
        return 'off';
      case 'birthDate':
        return 'bday';
      default:
        return 'off';
    }
  }

  onBlur(): void {
    const control = this.control();
    const normalized = normalizeFieldValue(this.field(), control.value);
    if (normalized !== control.value) {
      control.setValue(normalized);
    }
    control.markAsTouched();
  }
}
