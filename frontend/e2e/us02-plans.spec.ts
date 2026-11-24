import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const STRAPI_URL =
  process.env['E2E_STRAPI_URL'] ?? process.env['STRAPI_URL'] ?? 'http://localhost:1337';
const PLANS_ROUTE = /\/api\/insurance-plans(?:\?|$)/;

type CountryCode = 'CO' | 'CL';

interface MockCoverage {
  readonly name: string;
  readonly limit: number;
  readonly deductible: number | null;
}

interface MockPlan {
  readonly id: number;
  readonly documentId: string;
  readonly key: string;
  readonly name: string;
  readonly shortDescription: string;
  readonly basePrice: string;
  readonly currency: 'COP' | 'CLP';
  readonly coverages: readonly MockCoverage[];
  readonly benefits: readonly string[];
  readonly order: number;
  readonly recommended: boolean;
  readonly active: boolean;
  readonly country: CountryCode;
  readonly publishedAt: string;
}

const MOCK_PLANS: Readonly<Record<CountryCode, readonly MockPlan[]>> = {
  CO: [
    {
      id: 1,
      documentId: 'planco00000000000000001',
      key: 'basico',
      name: 'Plan Básico',
      shortDescription: 'Protección esencial para tu vehículo.',
      basePrice: '350000',
      currency: 'COP',
      coverages: [{ name: 'Asistencia vial', limit: 2000000, deductible: null }],
      benefits: ['Asistencia vial 24 horas'],
      order: 1,
      recommended: false,
      active: true,
      country: 'CO',
      publishedAt: '2026-11-23T10:00:00.000Z',
    },
    {
      id: 2,
      documentId: 'planco00000000000000002',
      key: 'estandar',
      name: 'Plan Estándar',
      shortDescription: 'Equilibrio entre cobertura y precio.',
      basePrice: '620000',
      currency: 'COP',
      coverages: [
        { name: 'Responsabilidad civil', limit: 200000000, deductible: null },
        { name: 'Daños propios y robo', limit: 40000000, deductible: 1500000 },
      ],
      benefits: ['Asistencia vial 24 horas', 'Auto reemplazo por 5 días'],
      order: 2,
      recommended: true,
      active: true,
      country: 'CO',
      publishedAt: '2026-11-23T10:00:00.000Z',
    },
    {
      id: 3,
      documentId: 'planco00000000000000003',
      key: 'todo-riesgo',
      name: 'Plan Todo Riesgo',
      shortDescription: 'Cobertura amplia sin deducible.',
      basePrice: '1150000',
      currency: 'COP',
      coverages: [{ name: 'Asistencia vial premium', limit: 10000000, deductible: null }],
      benefits: ['Vehículo de reemplazo por 15 días'],
      order: 3,
      recommended: false,
      active: true,
      country: 'CO',
      publishedAt: '2026-11-23T10:00:00.000Z',
    },
  ],
  CL: [
    {
      id: 5,
      documentId: 'plancl00000000000000001',
      key: 'basico',
      name: 'Plan Básico',
      shortDescription: 'Cobertura esencial de responsabilidad civil.',
      basePrice: '280000',
      currency: 'CLP',
      coverages: [{ name: 'Asistencia en carretera', limit: 1500000, deductible: null }],
      benefits: ['Asistencia en carretera 24 horas'],
      order: 1,
      recommended: false,
      active: true,
      country: 'CL',
      publishedAt: '2026-11-23T10:00:00.000Z',
    },
    {
      id: 6,
      documentId: 'plancl00000000000000002',
      key: 'estandar',
      name: 'Plan Estándar',
      shortDescription: 'Protección equilibrada frente a robo.',
      basePrice: '490000',
      currency: 'CLP',
      coverages: [{ name: 'Robo y daños propios', limit: 30000000, deductible: 1000000 }],
      benefits: ['Asistencia en carretera 24 horas'],
      order: 2,
      recommended: true,
      active: true,
      country: 'CL',
      publishedAt: '2026-11-23T10:00:00.000Z',
    },
    {
      id: 7,
      documentId: 'plancl00000000000000003',
      key: 'full',
      name: 'Plan Full',
      shortDescription: 'Cobertura completa con asistencia premium.',
      basePrice: '890000',
      currency: 'CLP',
      coverages: [{ name: 'Asistencia en carretera premium', limit: 8000000, deductible: null }],
      benefits: ['Vehículo de reemplazo por 15 días'],
      order: 3,
      recommended: false,
      active: true,
      country: 'CL',
      publishedAt: '2026-11-23T10:00:00.000Z',
    },
  ],
};

function mockPlans(
  country: CountryCode,
  options: { recommended?: readonly string[]; omit?: readonly string[] } = {},
): readonly MockPlan[] {
  return MOCK_PLANS[country]
    .filter((plan) => !(options.omit ?? []).includes(plan.key))
    .map((plan) => ({
      ...plan,
      recommended: options.recommended
        ? options.recommended.includes(plan.key)
        : plan.recommended,
    }));
}

function plansResponse(data: readonly MockPlan[]): Record<string, unknown> {
  return {
    data,
    meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: data.length } },
  };
}

async function routePlans(page: Page, data: readonly MockPlan[]): Promise<void> {
  await page.route(PLANS_ROUTE, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(plansResponse(data)),
    });
  });
}

function isoYearsAgo(years: number): string {
  const now = new Date();
  const date = new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function currentYear(): number {
  return new Date().getFullYear();
}

interface PricingFixture {
  readonly vehicleYear?: number;
  readonly birthDate?: string;
}

interface Step1Options extends PricingFixture {
  readonly waitForCards?: boolean;
}

async function completeStep1(
  page: Page,
  country: CountryCode,
  options: Step1Options = {},
): Promise<void> {
  const segment = country.toLowerCase();
  await page.goto(`/${segment}/quote`);
  await expect(page.locator('#fullName')).toBeVisible();

  if (country === 'CO') {
    await page.selectOption('#documentType', 'CC');
    await page.fill('#documentNumber', '1023456789');
    await page.selectOption('#city', 'BOG');
    await page.fill('#licensePlate', 'XYZ987');
    await page.selectOption('#vehicleMake', 'MAZDA');
  } else {
    await page.fill('#documentNumber', '12.345.678-5');
    await page.selectOption('#city', 'SCL');
    await page.fill('#licensePlate', 'ABCD12');
    await page.selectOption('#vehicleMake', 'TOYOTA');
  }

  await page.fill('#fullName', 'Camila Rodríguez');
  await page.fill('#birthDate', options.birthDate ?? isoYearsAgo(36));
  await page.fill('#vehicleYear', String(options.vehicleYear ?? currentYear() - 5));
  await page.waitForTimeout(550);

  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(new RegExp(`/${segment}/quote/plans$`));
  await expect(page.getByTestId('plans-page')).toBeVisible();
  if (options.waitForCards !== false) {
    await expect(page.locator('app-plan-card').first()).toBeVisible();
  }
}

function adjustedPrice(basePrice: number, percent: number): number {
  return Math.floor((basePrice * (100 + percent) + 50) / 100);
}

function money(value: number, country: CountryCode): string {
  return new Intl.NumberFormat(country === 'CO' ? 'es-CO' : 'es-CL', {
    style: 'currency',
    currency: country === 'CO' ? 'COP' : 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function normalized(value: string): string {
  return value.replace(/\s/g, ' ').trim();
}

function card(page: Page, planName: string) {
  return page.locator('app-plan-card').filter({ hasText: planName });
}

async function expectFinalPrice(page: Page, planName: string, expected: number): Promise<void> {
  const target = card(page, planName);
  expect(await target.locator('data').getAttribute('value')).toBe(String(expected));
  const displayed = normalized((await target.locator('.plan-card__final').innerText()));
  expect(displayed).toContain(normalized(money(expected, 'CO')));
}

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return /\.(ts|html)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [full] : [];
  });
}

test.describe('US-02 Plan List and Simulated Pricing', () => {
  test('US02-E01/E02: shows only active country plans in configured order with local currency', async ({
    page,
  }) => {
    await completeStep1(page, 'CO');

    await expect(page.locator('.plan-card__name')).toHaveText([
      'Plan Básico',
      'Plan Estándar',
      'Plan Todo Riesgo',
    ]);
    await expect(page.getByText('Plan Full')).toHaveCount(0);
    await expect(page.getByText('Plan Básico Ahorro')).toHaveCount(0);
    const coPrices = await page.locator('.plan-card__final').allInnerTexts();
    expect(coPrices).toHaveLength(3);
    for (const [index, price] of coPrices.entries()) {
      const expected = adjustedPrice([350000, 620000, 1150000][index] ?? 0, 0);
      expect(normalized(price)).toContain(normalized(money(expected, 'CO')));
      expect(price).toMatch(/(\$|COP)/);
      expect(price.replace(/\s/g, '')).toMatch(/\d{1,3}\.\d{3}/);
    }

    await completeStep1(page, 'CL');

    await expect(page.locator('.plan-card__name')).toHaveText([
      'Plan Básico',
      'Plan Estándar',
      'Plan Full',
    ]);
    await expect(page.getByText('Plan Todo Riesgo')).toHaveCount(0);
    await expect(page.getByText('Plan Básico Económico')).toHaveCount(0);
    const clPrices = await page.locator('.plan-card__final').allInnerTexts();
    expect(clPrices).toHaveLength(3);
    for (const [index, price] of clPrices.entries()) {
      const expected = adjustedPrice([280000, 490000, 890000][index] ?? 0, 0);
      expect(normalized(price)).toContain(normalized(money(expected, 'CL')));
      expect(price).toMatch(/(\$|CLP)/);
      expect(price.replace(/\s/g, '')).toMatch(/\d{1,3}\.\d{3}/);
    }
  });

  test('US02-E03: badges follow the recommended flag for 1, 2 and 0 plans', async ({ page }) => {
    await completeStep1(page, 'CO');

    const badges = page.locator('.plan-card__badge');
    await expect(badges).toHaveCount(1);
    const recommended = page.locator('app-plan-card').filter({ has: badges });
    await expect(recommended.locator('.plan-card__name')).toHaveText('Plan Estándar');
    await expect(recommended.locator('.plan-card')).toHaveClass(/plan-card--recommended/);
    await expect(badges.first()).toContainText('Recomendado');
    await expect(badges.first().locator('svg[aria-hidden="true"]')).toHaveCount(1);

    const radio = recommended.locator('input[type="radio"]');
    const radioId = await radio.getAttribute('id');
    const describedBy = (await radio.getAttribute('aria-describedby'))?.split(/\s+/).filter(Boolean) ?? [];
    await expect(radio).toHaveAttribute('name', 'selectedPlan');
    expect(describedBy).toContain(await badges.first().getAttribute('id'));
    for (const id of describedBy) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }

    await routePlans(page, mockPlans('CO', { recommended: ['basico', 'estandar'] }));
    await page.reload();
    await expect(page.locator('app-plan-card').first()).toBeVisible();
    await expect(badges).toHaveCount(2);

    await page.unroute(PLANS_ROUTE);
    await routePlans(page, mockPlans('CO', { recommended: [] }));
    await page.reload();
    await expect(page.locator('app-plan-card').first()).toBeVisible();
    await expect(badges).toHaveCount(0);
    await expect(page.locator('input[type="radio"]')).toHaveCount(3);
  });

  test('US02-E04/E14: mouse selection enables Continuar and opens the real Step 3 summary', async ({
    page,
  }) => {
    await completeStep1(page, 'CO');

    const chosen = card(page, 'Plan Básico').locator('input[type="radio"]');
    await chosen.check();
    await expect(chosen).toBeChecked();
    await expect(card(page, 'Plan Básico').locator('label')).toContainText('Seleccionado');
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeEnabled();

    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page).toHaveURL(/\/co\/quote\/summary$/);
    await expect(page.getByTestId('summary-page')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Resumen de tu cotización' })).toBeVisible();
    await expect(page.locator('[aria-current="step"]')).toContainText('Resumen');
    await expect(page.getByTestId('summary-sections')).toBeVisible();

    await expect(page.locator('input[autocomplete^="cc-"]')).toHaveCount(0);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(
      /n[úu]mero de tarjeta|tarjeta de cr[ée]dito|cvv|fecha de expiraci[óo]n|direcci[óo]n de facturaci[óo]n|paypal|stripe/i,
    );

    await page.getByRole('button', { name: 'Cambiar plan' }).click();
    await expect(page).toHaveURL(/\/co\/quote\/plans$/);
    await expect(card(page, 'Plan Básico').locator('input[type="radio"]')).toBeChecked();
  });

  test('US02-E15: summary deep links redirect to Step 1 or plans until both steps are complete', async ({
    page,
  }) => {
    await page.goto('/co/quote/summary');
    await expect(page).toHaveURL(/\/co\/quote$/);

    await completeStep1(page, 'CO');
    await page.waitForTimeout(550);
    await page.goto('/co/quote/summary');
    await expect(page).toHaveURL(/\/co\/quote\/plans$/);
    await expect(page.getByTestId('plans-page')).toBeVisible();
  });

  test('US02-E05: an empty active catalogue renders the exact blocking message', async ({ page }) => {
    await page.route(PLANS_ROUTE, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          plansResponse([]).meta?.pagination
            ? { data: [], meta: { pagination: { page: 1, pageSize: 100, pageCount: 0, total: 0 } } }
            : { data: [] },
        ),
      });
    });

    await completeStep1(page, 'CO', { waitForCards: false });

    const panel = page.locator('[role="status"]');
    await expect(panel).toContainText('No hay planes disponibles para este país en este momento');
    await expect(panel).toContainText('Tus respuestas siguen guardadas.');
    await expect(page.getByRole('button', { name: 'Volver a mis datos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    await expect(page.locator('app-plan-card')).toHaveCount(0);
    await expect(page.locator('input[type="radio"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Continuar' })).toHaveCount(0);
  });

  test('US02-E06: a failed fetch shows retry without losing the selected plan', async ({ page }) => {
    await routePlans(page, mockPlans('CO'));
    await completeStep1(page, 'CO');
    await page.locator('input[type="radio"][value="planco00000000000000002"]').check();
    await page.unroute(PLANS_ROUTE);

    let failFirst = true;
    await page.route(PLANS_ROUTE, async (route) => {
      if (failFirst) {
        failFirst = false;
        await route.abort();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(plansResponse(mockPlans('CO'))),
      });
    });

    await page.reload();
    await expect(page.getByRole('alert')).toContainText('No pudimos cargar los planes.');
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    expect(
      await page.evaluate(() => {
        const raw = sessionStorage.getItem('wizard:state:v1:CO');
        return raw === null ? null : (JSON.parse(raw) as { selectedPlanDocumentId: string | null })
          .selectedPlanDocumentId;
      }),
    ).toBe('planco00000000000000002');

    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.locator('app-plan-card').first()).toBeVisible();
    await expect(
      page.locator('input[type="radio"][value="planco00000000000000002"]'),
    ).toBeChecked();
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  });

  test('US02-E07: a delayed plans response shows skeletons before the cards', async ({ page }) => {
    await page.route(PLANS_ROUTE, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(plansResponse(mockPlans('CO'))),
      });
    });

    await completeStep1(page, 'CO', { waitForCards: false });

    await expect(page.locator('section[aria-busy="true"]')).toBeVisible();
    await expect(page.locator('.skeleton')).toHaveCount(3);
    await expect(page.locator('section[aria-busy="true"]')).toContainText('Cargando los planes…');
    await expect(page.locator('input[type="radio"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Continuar' })).toHaveCount(0);

    await expect(page.locator('app-plan-card').first()).toBeVisible();
    await expect(page.locator('.skeleton')).toHaveCount(0);
  });

  test('US02-E08: back-edit-recalculate keeps the selection and survives reload', async ({ page }) => {
    await routePlans(page, mockPlans('CO'));
    const neutral = { vehicleYear: currentYear() - 5, birthDate: isoYearsAgo(36) };
    await completeStep1(page, 'CO', neutral);

    const baseValues = MOCK_PLANS.CO.map((plan) => adjustedPrice(Number(plan.basePrice), 0));
    expect(
      await page.locator('app-plan-card data').evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('value')),
      ),
    ).toEqual(baseValues.map(String));

    await page.locator('input[type="radio"][value="planco00000000000000002"]').check();
    await page.getByRole('button', { name: 'Volver a mis datos' }).click();
    await expect(page).toHaveURL(/\/co\/quote$/);

    await page.fill('#vehicleYear', String(currentYear() - 7));
    await page.fill('#birthDate', isoYearsAgo(22));
    await page.waitForTimeout(550);
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page).toHaveURL(/\/co\/quote\/plans$/);

    // Age 7 (4%) + age 22 (10%) = +14% from the authoritative formula.
    const editedValues = MOCK_PLANS.CO.map((plan) => adjustedPrice(Number(plan.basePrice), 14));
    await expect(page.locator('app-plan-card data').nth(1)).toHaveAttribute(
      'value',
      String(editedValues[1]),
    );
    await expectFinalPrice(page, 'Plan Estándar', editedValues[1] ?? 0);
    await expect(
      page.locator('input[type="radio"][value="planco00000000000000002"]'),
    ).toBeChecked();

    await page.reload();
    await expect(page.locator('app-plan-card').first()).toBeVisible();
    expect(
      await page.locator('app-plan-card data').evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('value')),
      ),
    ).toEqual(editedValues.map(String));
    await expect(
      page.locator('input[type="radio"][value="planco00000000000000002"]'),
    ).toBeChecked();
  });

  test('US02-E09: a deactivated selected plan is cleared until another is selected', async ({ page }) => {
    let visiblePlans: readonly MockPlan[] = mockPlans('CO');
    await page.route(PLANS_ROUTE, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(plansResponse(visiblePlans)),
      });
    });

    await completeStep1(page, 'CO');
    await page.locator('input[type="radio"][value="planco00000000000000002"]').check();
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeEnabled();

    visiblePlans = mockPlans('CO', { omit: ['estandar'] });
    await page.reload();
    await expect(page.locator('app-plan-card').first()).toBeVisible();
    const notice = page.getByRole('status');
    await expect(notice).toContainText('El plan que habías elegido ya no está disponible.');
    await expect(page.locator('input[type="radio"]:checked')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();

    await page.locator('input[type="radio"][value="planco00000000000000001"]').check();
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  });

  test('US02-E10: keyboard-only selection, advance and return without premature submit', async ({
    page,
  }) => {
    await routePlans(page, mockPlans('CO'));
    await completeStep1(page, 'CO');

    const radios = page.locator('input[type="radio"]');
    await page.locator('#country-switcher').focus();
    await page.keyboard.press('Tab');
    await expect(radios.first()).toBeFocused();
    const outline = await radios
      .first()
      .evaluate((element) => getComputedStyle(element as HTMLElement).outlineStyle);
    expect(outline).not.toBe('none');

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/co\/quote\/plans$/);
    await expect(radios.first()).toBeChecked();

    await page.keyboard.press('ArrowDown');
    await expect(radios.nth(1)).toBeChecked();
    await page.keyboard.press('Space');
    await expect(radios.nth(1)).toBeChecked();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Volver a mis datos' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/co\/quote\/summary$/);

    await page.getByRole('button', { name: 'Cambiar plan' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/co\/quote\/plans$/);
  });

  test('US02-E11: radio group, labels, descriptions and exact integer price data are wired', async ({
    page,
  }) => {
    await routePlans(page, mockPlans('CO'));
    await completeStep1(page, 'CO');

    await expect(page.locator('fieldset')).toContainText('Selecciona tu plan');
    const radios = page.locator('input[type="radio"]');
    const planNames = ['Plan Básico', 'Plan Estándar', 'Plan Todo Riesgo'] as const;
    await expect(radios).toHaveCount(3);
    for (let index = 0; index < 3; index += 1) {
      const radio = radios.nth(index);
      const id = await radio.getAttribute('id');
      await expect(radio).toHaveAttribute('name', 'selectedPlan');
      await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
      const describedBy = (await radio.getAttribute('aria-describedby'))?.split(/\s+/).filter(Boolean) ?? [];
      expect(describedBy.length).toBeGreaterThanOrEqual(2);
      for (const describedId of describedBy) {
        await expect(page.locator(`#${describedId}`)).toHaveCount(1);
      }
      const badge = card(page, planNames[index] ?? '').locator('.plan-card__badge');
      const badgeCount = await badge.count();
      if (index === 1) {
        expect(badgeCount).toBe(1);
        const badgeId = await badge.getAttribute('id');
        expect(badgeId).not.toBeNull();
        if (!badgeId) {
          throw new Error('The recommended badge must expose an id for aria-describedby.');
        }
        expect(describedBy).toContain(badgeId);
        await expect(page.locator(`#${badgeId}`)).toContainText('Recomendado');
      } else {
        expect(badgeCount).toBe(0);
      }
    }

    expect(
      await page.locator('app-plan-card data').evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('value')),
      ),
    ).toEqual(['350000', '620000', '1150000']);
    await expect(page.locator('.plans__footnote')).toHaveText(
      'Los precios son simulados y no constituyen una oferta comercial.',
    );
  });

  test('US02-E12: the browser sends no credentials or writes and production source has no token literals', async ({
    page,
  }) => {
    const apiRequests: Array<{ method: string; authorization: string | undefined }> = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        apiRequests.push({
          method: request.method(),
          authorization: request.headers()['authorization'],
        });
      }
    });

    await routePlans(page, mockPlans('CO'));
    await completeStep1(page, 'CO');

    expect(apiRequests.length).toBeGreaterThan(0);
    for (const request of apiRequests) {
      expect(request.method).toBe('GET');
      expect(request.authorization).toBeUndefined();
    }

    const root = path.resolve(process.cwd(), 'src');
    const forbidden = ['Bearer', 'apiToken', 'api_token'];
    const offenders = sourceFiles(root).filter((file) => {
      const content = fs.readFileSync(file, 'utf8');
      return forbidden.some((token) => content.includes(token));
    });
    expect(offenders).toEqual([]);
  });

  test('US02-E13: Public role allows read-only plan GETs and blocks writes and /users', async ({
    request,
  }) => {
    const getResponse = await request.get(
      `${STRAPI_URL}/api/insurance-plans?filters[country][$eq]=CL&filters[active][$eq]=true`,
    );
    expect(getResponse.status()).toBe(200);
    const payload = (await getResponse.json()) as {
      data: Array<{ country: string; active: boolean; key: string }>;
    };
    expect(payload.data).toHaveLength(3);
    expect(payload.data.every((row) => row.country === 'CL' && row.active === true)).toBe(true);
    expect(payload.data.some((row) => row.key === 'basico-economico-inactivo')).toBe(false);

    const id = 5;
    const post = await request.post(`${STRAPI_URL}/api/insurance-plans`, {
      data: { data: { key: 'hackedPlan' } },
    });
    const put = await request.put(`${STRAPI_URL}/api/insurance-plans/${id}`, {
      data: { data: { name: 'Hacked plan' } },
    });
    const remove = await request.delete(`${STRAPI_URL}/api/insurance-plans/${id}`);
    const users = await request.get(`${STRAPI_URL}/api/users`);

    for (const response of [post, put, remove, users]) {
      expect([401, 403]).toContain(response.status());
    }
  });

  test('US02-E16: responsive grids and touch targets at 375px and 1280px', async ({ page }) => {
    await routePlans(page, mockPlans('CO'));
    await page.setViewportSize({ width: 375, height: 812 });
    await completeStep1(page, 'CO');

    const noMobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(noMobileOverflow).toBe(true);
    const mobileColumns = await page.locator('.plans__grid').evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
    );
    expect(mobileColumns).toBe(1);
    const labelHeight = await page.locator('app-plan-card label').first().evaluate(
      (element) => (element as HTMLElement).getBoundingClientRect().height,
    );
    expect(labelHeight).toBeGreaterThanOrEqual(44);

    await page.setViewportSize({ width: 1280, height: 900 });
    const noDesktopOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(noDesktopOverflow).toBe(true);
    const desktopColumns = await page.locator('.plans__grid').evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
    );
    expect(desktopColumns).toBe(3);
    const containerWidth = await page.locator('.plans').evaluate(
      (element) => (element as HTMLElement).getBoundingClientRect().width,
    );
    expect(containerWidth).toBeLessThanOrEqual(1120);
  });

  test('US02-E17: base price, estimated final price, +14% detail and footnote are visible', async ({
    page,
  }) => {
    await routePlans(page, mockPlans('CO'));
    await completeStep1(page, 'CO', {
      vehicleYear: currentYear() - 7,
      birthDate: isoYearsAgo(22),
    });

    for (const plan of MOCK_PLANS.CO) {
      const target = card(page, plan.name);
      const expected = adjustedPrice(Number(plan.basePrice), 14);
      await expect(target.locator('.plan-card__final')).toContainText('Precio final estimado');
      await expect(target.locator('.plan-card__base')).toContainText('Precio base');
      await expect(target.locator('.plan-card__adjustment')).toContainText('+14%');
      await expect(target.locator('.plan-card__adjustment')).toContainText(
        'por antigüedad del vehículo · por edad del conductor',
      );
      expect(await target.locator('data').getAttribute('value')).toBe(String(expected));
    }

    await expect(page.locator('.plans__footnote')).toHaveText(
      'Los precios son simulados y no constituyen una oferta comercial.',
    );
    const pageText = await page.locator('body').innerText();
    expect(pageText).not.toMatch(/pagar|tarjeta de crédito|payment/i);
  });
});
