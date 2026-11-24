import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { CountryContextService } from '../../../../core/country/country-context.service';
import { UI_COPY } from '../../../../core/i18n/ui-copy';
import type {
  FormFieldConfig,
  FormFieldSection,
  FormValue,
  WizardFormGroup,
} from '../../../../core/models';
import { DynamicFieldComponent } from './components/dynamic-field/dynamic-field';
import { normalizeFieldValue } from './dynamic-form.factory';
import { StatePanelComponent } from '../../ui/state-panel/state-panel';
import { WizardStepperComponent } from '../../ui/wizard-stepper/wizard-stepper';
import { WizardStore } from '../../state/wizard.store';

interface FieldGroup {
  readonly section: FormFieldSection;
  readonly legend: string;
  readonly fields: readonly FormFieldConfig[];
}

@Component({
  selector: 'app-quote-step1-page',
  imports: [ReactiveFormsModule, DynamicFieldComponent, StatePanelComponent, WizardStepperComponent],
  templateUrl: './quote-step1-page.html',
  styleUrl: './quote-step1-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteStep1PageComponent {
  protected readonly store = inject(WizardStore);
  protected readonly context = inject(CountryContextService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('pageHeading');

  protected readonly copy = UI_COPY;
  protected readonly groups = computed<readonly FieldGroup[]>(() => this.groupFields(this.store.fields()));

  constructor() {
    effect(() => {
      const country = this.context.country();
      const heading = this.heading();
      if (heading) {
        queueMicrotask(() => heading.nativeElement.focus());
      }
      untracked(() => {
        void this.store.load(country);
      });
    });
  }

  protected form(): WizardFormGroup | null {
    return this.store.form();
  }

  protected controlFor(form: WizardFormGroup, key: string): FormControl<FormValue> {
    const control = form.controls[key];
    if (!control) {
      throw new Error(`Missing form control for field "${key}".`);
    }
    return control;
  }

  protected otherCountryPath(): string {
    const other = this.context.country() === 'CO' ? 'CL' : 'CO';
    return this.context.pathFor(other);
  }

  protected errorSummary(): string {
    return UI_COPY.errorSummary(this.store.errorCount());
  }

  protected onRetry(): void {
    void this.store.retry();
  }

  protected onSubmit(): void {
    this.store.markSubmitted();
    const form = this.store.form();
    if (!form) {
      return;
    }

    for (const field of this.store.fields()) {
      const control = form.controls[field.key];
      if (control) {
        const normalized = normalizeFieldValue(field, control.value);
        if (normalized !== control.value) {
          control.setValue(normalized);
        }
      }
    }

    if (form.invalid) {
      form.markAllAsTouched();
      const firstInvalidKey = Object.keys(form.controls).find(
        (key) => form.controls[key]?.invalid,
      );
      if (firstInvalidKey) {
        queueMicrotask(() => this.document.getElementById(firstInvalidKey)?.focus());
      }
      return;
    }

    this.store.persist('policyholder');
    void this.router.navigateByUrl(this.context.quotePath('plans'));
  }

  private groupFields(fields: readonly FormFieldConfig[]): readonly FieldGroup[] {
    const groups: Array<{
      section: FormFieldSection;
      legend: string;
      fields: FormFieldConfig[];
    }> = [];
    for (const field of fields) {
      const last = groups[groups.length - 1];
      if (!last || last.section !== field.section) {
        groups.push({
          section: field.section,
          legend: UI_COPY.sectionLegends[field.section],
          fields: [field],
        });
      } else {
        last.fields.push(field);
      }
    }
    return groups;
  }
}
