import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CountryContextService } from '../../core/country/country-context.service';
import { UI_COPY } from '../../core/i18n/ui-copy';
import type { InsurancePlan, QuotedPlan } from '../../core/models';
import { PlanCardComponent } from './plan-card';

function plan(overrides: Partial<InsurancePlan> = {}): InsurancePlan {
  return {
    id: overrides.id ?? 2,
    documentId: overrides.documentId ?? 'planco00000000000000002',
    key: overrides.key ?? 'estandar',
    name: overrides.name ?? 'Plan Estándar',
    shortDescription:
      overrides.shortDescription ?? 'Equilibrio entre cobertura y precio, con protección ante robo.',
    basePrice: overrides.basePrice ?? 620000,
    currency: overrides.currency ?? 'COP',
    coverages: overrides.coverages ?? [
      { name: 'Responsabilidad civil', limit: 200000000, deductible: null },
      { name: 'Daños propios y robo', limit: 40000000, deductible: 1500000 },
    ],
    benefits: overrides.benefits ?? ['Asistencia vial 24 horas', 'Auto reemplazo por 5 días'],
    order: overrides.order ?? 2,
    recommended: overrides.recommended ?? true,
    country: overrides.country ?? 'CO',
  };
}

function quoted(
  overrides: Partial<InsurancePlan> = {},
  finalPrice = 706800,
  adjustmentPercent = 14,
  reasons: readonly string[] = ['por antigüedad del vehículo', 'por edad del conductor'],
): QuotedPlan {
  const value = plan(overrides);
  return {
    plan: value,
    basePrice: value.basePrice,
    finalPrice,
    formattedBasePrice: '$ 620.000',
    formattedFinalPrice: '$ 706.800',
    adjustment: { adjustmentPercent, reasons, finalPrice },
  };
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s/g, ' ').trim();
}

@Component({
  imports: [PlanCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-plan-card [quoted]="first" [selected]="false" />
    <app-plan-card [quoted]="second" [selected]="false" />
    <app-plan-card [quoted]="third" [selected]="false" />
  `,
})
class BadgeHostComponent {
  first: QuotedPlan = quoted({ documentId: 'one', name: 'Plan Básico', recommended: false }, 350000);
  second: QuotedPlan = quoted({ documentId: 'two', name: 'Plan Estándar', recommended: true }, 620000);
  third: QuotedPlan = quoted({ documentId: 'three', name: 'Plan Full', recommended: true }, 890000);
}

describe('PlanCardComponent (US02-U10, US02-U12, §6.2)', () => {
  let context: { locale: ReturnType<typeof signal<'es-CO'>>; currency: ReturnType<typeof signal<'COP'>> };

  beforeEach(async () => {
    context = { locale: signal('es-CO'), currency: signal('COP') };
    await TestBed.configureTestingModule({
      providers: [{ provide: CountryContextService, useValue: context }],
    }).compileComponents();
  });

  function render(value: QuotedPlan, selected = false): ComponentFixture<PlanCardComponent> {
    const fixture = TestBed.createComponent(PlanCardComponent);
    fixture.componentRef.setInput('quoted', value);
    fixture.componentRef.setInput('selected', selected);
    fixture.detectChanges();
    return fixture;
  }

  it('renders a native radio with resolvable ARIA descriptions and a text badge', () => {
    const fixture = render(quoted());
    const root: HTMLElement = fixture.nativeElement;
    const radio = root.querySelector('input[type="radio"]');
    expect(radio).not.toBeNull();
    expect(radio?.id).toBe('plan-planco00000000000000002');
    expect(radio?.getAttribute('name')).toBe('selectedPlan');
    expect(radio?.getAttribute('value')).toBe('planco00000000000000002');

    const describedBy = (radio?.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    expect(describedBy).toHaveLength(3);
    for (const id of describedBy) {
      expect(root.querySelector(`#${id}`)).not.toBeNull();
    }

    const label = root.querySelector('label');
    expect(label?.getAttribute('for')).toBe(radio?.id);
    expect(label?.textContent).toContain('Plan Estándar');
    expect(label?.textContent).not.toContain(UI_COPY.selectedLabel);

    const badge = root.querySelector('.plan-card__badge');
    expect(badge?.textContent).toContain(UI_COPY.recommendedBadge);
    expect(badge?.id).toBe('plan-badge-planco00000000000000002');
    expect(describedBy).toContain(badge?.id);
    expect(badge?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(root.querySelector('.plan-card')?.className).toContain('plan-card--recommended');
  });

  it('shows both transparent prices, the adjustment reason, coverages and benefits', () => {
    const fixture = render(quoted());
    const root: HTMLElement = fixture.nativeElement;
    const text = root.textContent ?? '';

    expect(text).toContain(`${UI_COPY.finalPriceLabel}:`);
    expect(text).toContain('$ 706.800');
    expect(text).toContain(`${UI_COPY.basePriceLabel}: $ 620.000`);
    expect(text).toContain(`${UI_COPY.adjustmentLabel}: +14%`);
    expect(text).toContain('por antigüedad del vehículo · por edad del conductor');

    const data = root.querySelector('data');
    expect(data?.getAttribute('value')).toBe('706800');
    expect(data?.textContent).toContain('$ 706.800');

    const coverageNames = [...root.querySelectorAll('dt')].map((node) => node.textContent?.trim());
    expect(coverageNames).toEqual(['Responsabilidad civil', 'Daños propios y robo']);
    const details = [...root.querySelectorAll('dd')].map((node) => node.textContent ?? '');
    expect(normalize(details[0])).toContain(`${UI_COPY.coverageLimitLabel}: $ 200.000.000`);
    expect(normalize(details[1])).toContain(UI_COPY.notApplicable);
    const deductible = normalize(details[3]);
    expect(deductible).toContain(UI_COPY.coverageDeductibleLabel);
    expect(deductible).toContain('$ 1.500.000');
    expect([...root.querySelectorAll('li')].map((node) => node.textContent)).toEqual([
      'Asistencia vial 24 horas',
      'Auto reemplazo por 5 días',
    ]);
  });

  it('renders the neutral adjustment copy and no badge when nothing is flagged', () => {
    const fixture = render(quoted({ recommended: false }, 620000, 0, []));
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('.plan-card__badge')).toBeNull();
    expect(root.textContent).toContain(UI_COPY.noAdjustment);
    expect(root.querySelector('.plan-card__adjustment--neutral')).not.toBeNull();
    const describedBy = (
      root.querySelector('input[type="radio"]')?.getAttribute('aria-describedby') ?? ''
    )
      .split(/\s+/)
      .filter(Boolean);
    expect(describedBy).toHaveLength(2);
    expect(describedBy.some((id) => id.startsWith('plan-badge-'))).toBe(false);
    expect(root.querySelector('.plan-card')?.className).not.toContain('plan-card--recommended');
  });

  it('marks the selected radio with the literal "Seleccionado" text', () => {
    const fixture = render(quoted(), true);
    const root: HTMLElement = fixture.nativeElement;
    const radio = root.querySelector('input[type="radio"]') as HTMLInputElement;

    expect(radio.checked).toBe(true);
    expect(root.querySelector('label')?.textContent).toContain(UI_COPY.selectedLabel);
    expect(root.querySelector('.plan-card')?.className).toContain('plan-card--selected');
  });

  it('emits the documentId on change and on Enter while preventing form submission', () => {
    const fixture = render(quoted());
    const emitted: string[] = [];
    fixture.componentInstance.selection.subscribe((id) => emitted.push(id));
    const radio = fixture.nativeElement.querySelector('input[type="radio"]') as HTMLInputElement;

    radio.dispatchEvent(new Event('change'));
    expect(emitted).toEqual(['planco00000000000000002']);

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    radio.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(emitted).toEqual([
      'planco00000000000000002',
      'planco00000000000000002',
    ]);
  });

  it('US02-U10: renders exactly one badge per recommended plan (1, 2 and 0 cases)', async () => {
    const fixture = TestBed.createComponent(BadgeHostComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelectorAll('app-plan-card')).toHaveLength(3);
    expect(root.querySelectorAll('.plan-card__badge')).toHaveLength(2);
    expect([...root.querySelectorAll('.plan-card__badge')].map((node) => node.textContent)).toEqual([
      expect.stringContaining(UI_COPY.recommendedBadge),
      expect.stringContaining(UI_COPY.recommendedBadge),
    ]);
    expect(root.querySelector('app-plan-card .plan-card__name')?.textContent).toContain('Plan Básico');

    // Zero flagged plans must not produce a placeholder badge or block the list.
    const zero = TestBed.createComponent(BadgeHostComponent);
    const cards = zero.componentInstance;
    cards.first = quoted({ documentId: 'one', name: 'Plan Básico', recommended: false }, 350000);
    cards.second = quoted({ documentId: 'two', name: 'Plan Estándar', recommended: false }, 620000);
    cards.third = quoted({ documentId: 'three', name: 'Plan Full', recommended: false }, 890000);
    zero.detectChanges();
    expect(zero.nativeElement.querySelectorAll('.plan-card__badge')).toHaveLength(0);
    expect(zero.nativeElement.querySelectorAll('input[type="radio"]')).toHaveLength(3);
  });
});
