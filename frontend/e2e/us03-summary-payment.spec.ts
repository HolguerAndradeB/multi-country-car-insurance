import { expect, test, type Page, type Request, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const APP_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const STRAPI_URL =
  process.env['E2E_STRAPI_URL'] ?? process.env['STRAPI_URL'] ?? 'http://localhost:1337';
const PLANS_ROUTE = /\/api\/insurance-plans(?:\?|$)/;
const CONFIG_ROUTE = /\/api\/country-configs(?:\?|$)/;
const FIELDS_ROUTE = /\/api\/form-fields(?:\?|$)/;

const COPY = {
  summaryHeading: 'Resumen de tu cotización',
  policyholderHeading: 'Tomador',
  vehicleHeading: 'Vehículo',
  planHeading: 'Plan elegido',
  termsHeading: 'Términos y condiciones',
  acceptTerms: 'Acepto los términos y condiciones',
  processing: 'Procesando pago simulado...',
  rejection:
    'No pudimos procesar el pago simulado. Inténtalo de nuevo; tus datos siguen guardados.',
  retryPayment: 'Reintentar pago',
  confirmation: '¡Pago simulado confirmado!',
  quoteNumber: 'Número de cotización',
  newQuote: 'Nueva cotización',
  editData: 'Editar datos',
  changePlan: 'Cambiar plan',
} as const;

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

interface ConfigRow {
  readonly country: CountryCode;
  readonly documentId: string;
  readonly currency: 'COP' | 'CLP';
  readonly localeCode: 'es-CO' | 'es-CL';
  readonly termsAndConditions: string;
  readonly documentMaskVisibleEnd: number;
}

interface FieldOption {
  readonly value: string;
  readonly label: string;
}

interface FieldRow {
  readonly key: string;
  readonly label: string;
  readonly options: readonly FieldOption[] | null;
}

interface ListPayload<T> {
  readonly data: readonly T[];
}

interface PersistedState {
  readonly schemaVersion: number;
  readonly country: CountryCode;
  readonly selectedPlanDocumentId: string | null;
  readonly step1: Readonly<Record<string, string | number | boolean | null>>;
}

const PLAN_IDS: Readonly<Record<CountryCode, { standard: string; alternative: string }>> = {
  CO: { standard: 'planco00000000000000002', alternative: 'planco00000000000000003' },
  CL: { standard: 'plancl00000000000000002', alternative: 'plancl00000000000000003' },
};

const MOCK_PLANS: Readonly<Record<CountryCode, readonly MockPlan[]>> = {
  CO: [
    {
      id: 1,
      documentId: 'planco00000000000000001',
      key: 'basico',
      name: 'Plan Básico',
      shortDescription: 'Protección ficticia esencial.',
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
      documentId: PLAN_IDS['CO'].standard ?? 'planco00000000000000002',
      key: 'estandar',
      name: 'Plan Estándar',
      shortDescription: 'Equilibrio ficticio entre cobertura y precio.',
      basePrice: '620000',
      currency: 'COP',
      coverages: [{ name: 'Responsabilidad civil', limit: 200000000, deductible: null }],
      benefits: ['Asistencia vial 24 horas'],
      order: 2,
      recommended: true,
      active: true,
      country: 'CO',
      publishedAt: '2026-11-23T10:00:00.000Z',
    },
    {
      id: 3,
      documentId: PLAN_IDS['CO'].alternative ?? 'planco00000000000000003',
      key: 'todo-riesgo',
      name: 'Plan Todo Riesgo',
      shortDescription: 'Cobertura ficticia amplia.',
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
      shortDescription: 'Protección ficticia esencial.',
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
      documentId: PLAN_IDS['CL'].standard ?? 'plancl00000000000000002',
      key: 'estandar',
      name: 'Plan Estándar',
      shortDescription: 'Equilibrio ficticio entre cobertura y precio.',
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
      documentId: PLAN_IDS['CL'].alternative ?? 'plancl00000000000000003',
      key: 'full',
      name: 'Plan Full',
      shortDescription: 'Cobertura ficticia completa.',
      basePrice: '890000',
      currency: 'CLP',
      coverages: [{ name: 'Asistencia premium', limit: 8000000, deductible: null }],
      benefits: ['Vehículo de reemplazo por 15 días'],
      order: 3,
      recommended: false,
      active: true,
      country: 'CL',
      publishedAt: '2026-11-23T10:00:00.000Z',
    },
  ],
};

function isoYearsAgo(years: number): string {
  const now = new Date();
  const date = new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function currentYear(): number {
  return new Date().getFullYear();
}

function normalized(value: string): string {
  return value.replace(/\s/g, ' ').trim();
}

function money(value: number, country: CountryCode): string {
  return new Intl.NumberFormat(country === 'CO' ? 'es-CO' : 'es-CL', {
    style: 'currency',
    currency: country === 'CO' ? 'COP' : 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

async function installPlanMocks(page: Page, country: CountryCode): Promise<void> {
  await page.route(PLANS_ROUTE, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: MOCK_PLANS[country],
        meta: {
          pagination: { page: 1, pageSize: 100, pageCount: 1, total: MOCK_PLANS[country].length },
        },
      }),
    });
  });
}

async function reachPlans(page: Page, country: CountryCode): Promise<void> {
  const segment = country.toLowerCase();
  await page.goto(`${APP_URL}/${segment}/quote`);
  await expect(page.locator('#fullName')).toBeVisible();

  if (country === 'CO') {
    await page.selectOption('#documentType', 'CC');
    await page.fill('#documentNumber', '123456789');
    await page.selectOption('#city', 'BOG');
    await page.fill('#licensePlate', 'ABC123');
    await page.selectOption('#vehicleMake', 'MAZDA');
    await page.fill('#fullName', 'Ana Ejemplo');
  } else {
    await page.fill('#documentNumber', '10000478-K');
    await page.selectOption('#city', 'SCL');
    await page.fill('#licensePlate', 'ABCD12');
    await page.selectOption('#vehicleMake', 'TOYOTA');
    await page.fill('#fullName', 'Carlos Ejemplo');
  }

  await page.fill('#birthDate', isoYearsAgo(36));
  await page.fill('#vehicleYear', String(currentYear() - 5));
  await page.waitForTimeout(550);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(new RegExp(`/${segment}/quote/plans$`));
  await expect(page.getByTestId('plans-page')).toBeVisible();
  await expect(page.locator('app-plan-card').first()).toBeVisible();
}

async function selectPlan(page: Page, planId: string): Promise<void> {
  const radio = page.locator(`input[type="radio"][value="${planId}"]`);
  await radio.check();
  await expect(radio).toBeChecked();
}

async function continueToSummary(page: Page, country: CountryCode): Promise<void> {
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(new RegExp(`/${country.toLowerCase()}/quote/summary$`));
  await expect(page.getByTestId('summary-sections')).toBeVisible();
}

async function reachSummary(page: Page, country: CountryCode): Promise<void> {
  await installPlanMocks(page, country);
  await reachPlans(page, country);
  await selectPlan(page, PLAN_IDS[country].standard);
  await continueToSummary(page, country);
}

async function acceptTermsWithPointer(page: Page): Promise<void> {
  await page.getByRole('checkbox', { name: COPY.acceptTerms }).check();
  await expect(page.getByTestId('pay-button')).toBeEnabled();
}

async function pay(page: Page): Promise<void> {
  await expect(page.getByTestId('pay-button')).toBeEnabled();
  await page.getByTestId('pay-button').click();
}

async function expectConfirmation(page: Page): Promise<string> {
  await expect(page.getByTestId('quote-confirmation')).toBeVisible();
  const quoteNumber = await page.locator('.confirmation__quote').textContent();
  if (quoteNumber === null) {
    throw new Error('The confirmation must expose a quote number.');
  }
  expect(quoteNumber).toMatch(/^COT-(CO|CL)-\d{8}-[0-9A-Z]{6}$/);
  return quoteNumber.trim();
}

async function storageFor(page: Page, country: CountryCode): Promise<string | null> {
  return page.evaluate((code) => sessionStorage.getItem(`wizard:state:v1:${code}`), country);
}

async function configFromStrapi(request: Request | undefined, country: CountryCode): Promise<ConfigRow> {
  if (request === undefined) {
    throw new Error('The Playwright request fixture is required for the Strapi contract.');
  }
  const response = await request.get(
    `${STRAPI_URL}/api/country-configs?filters[country][$eq]=${country}`,
  );
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as ListPayload<ConfigRow>;
  const row = payload.data[0];
  if (row === undefined) {
    throw new Error(`Strapi must publish a country config for ${country}.`);
  }
  return row;
}

async function termsFromStrapi(request: Request | undefined, country: CountryCode): Promise<string> {
  return (await configFromStrapi(request, country)).termsAndConditions;
}

async function fulfillModifiedPayload<T>(
  route: Route,
  modify: (payload: ListPayload<T>) => void,
): Promise<void> {
  const response = await route.fetch();
  const payload = (await response.json()) as ListPayload<T>;
  modify(payload);
  await route.fulfill({
    response,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

async function tabUntilFocused(page: Page, selector: string, maxTabs = 16): Promise<void> {
  for (let attempt = 0; attempt < maxTabs; attempt += 1) {
    await page.keyboard.press('Tab');
    const focused = await page
      .locator(selector)
      .evaluate((element) => element === document.activeElement);
    if (focused) {
      return;
    }
  }
  throw new Error(`Keyboard Tab did not reach ${selector}.`);
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

test.describe('US-03 Summary and Simulated Payment', () => {
  test.afterEach(async ({ page }) => {
    await page
      .evaluate(() => {
        Reflect.deleteProperty(globalThis, '__WIZARD_SIMULATE_PAYMENT_FAILURE__');
        Reflect.deleteProperty(globalThis, '__failureHookCalls');
      })
      .catch(() => undefined);
  });

  test('US03-E01: the CO summary shows masked data, Strapi labels and COP prices', async ({
    page,
    request,
  }) => {
    const config = await configFromStrapi(request, 'CO');
    expect(config.currency).toBe('COP');
    expect(config.localeCode).toBe('es-CO');
    await reachSummary(page, 'CO');
    const sections = page.getByTestId('summary-sections');

    await expect(page.getByRole('heading', { level: 1, name: COPY.summaryHeading })).toBeVisible();
    await expect(sections.getByRole('heading', { name: COPY.policyholderHeading })).toBeVisible();
    await expect(sections.getByRole('heading', { name: COPY.vehicleHeading })).toBeVisible();
    await expect(page.getByText(COPY.planHeading, { exact: true })).toBeVisible();
    await expect(sections.getByText('Número de documento')).toBeVisible();
    await expect(sections.getByText('Nombre completo')).toBeVisible();
    await expect(sections.getByText('Placa del vehículo')).toBeVisible();
    await expect(sections.getByText('•••••6789', { exact: true })).toBeVisible();
    await expect(sections.getByText('Ana Ejemplo')).toBeVisible();
    await expect(sections.getByText('ABC123')).toBeVisible();

    const sectionText = await sections.innerText();
    expect(sectionText).not.toContain('123456789');
    await expect(page.locator('[data-testid="payment-panel"] data')).toHaveAttribute(
      'value',
      '620000',
    );
    expect(normalized(await page.locator('[data-testid="payment-panel"]').innerText())).toContain(
      normalized(money(620000, config.country)),
    );
    await expect(page.locator('html')).toHaveAttribute('lang', config.localeCode);
  });

  test('US03-E02: the CL summary shows es-CL labels, a masked RUT and CLP prices', async ({
    page,
    request,
  }) => {
    const config = await configFromStrapi(request, 'CL');
    expect(config.currency).toBe('CLP');
    expect(config.localeCode).toBe('es-CL');
    await reachSummary(page, 'CL');
    const sections = page.getByTestId('summary-sections');

    await expect(sections.getByRole('heading', { name: COPY.policyholderHeading })).toBeVisible();
    await expect(sections.getByText('RUT', { exact: true })).toBeVisible();
    await expect(sections.getByText('Patente del vehículo')).toBeVisible();
    await expect(sections.getByText('••••••78-K', { exact: true })).toBeVisible();
    await expect(sections.getByText('Carlos Ejemplo')).toBeVisible();
    await expect(sections.getByText('Santiago')).toBeVisible();
    await expect(sections.getByText('ABCD12')).toBeVisible();

    const sectionText = await sections.innerText();
    expect(sectionText).not.toContain('10000478-K');
    await expect(page.locator('[data-testid="payment-panel"] data')).toHaveAttribute(
      'value',
      '490000',
    );
    expect(normalized(await page.locator('[data-testid="payment-panel"]').innerText())).toContain(
      normalized(money(490000, config.country)),
    );
    await expect(page.locator('html')).toHaveAttribute('lang', config.localeCode);
  });

  test('US03-E03: CO terms match the published Strapi value', async ({ page, request }) => {
    await reachSummary(page, 'CO');
    const expected = await termsFromStrapi(request, 'CO');

    expect(await page.locator('.terms__text').textContent()).toBe(expected);
    await expect(page.getByRole('heading', { name: COPY.termsHeading })).toBeVisible();
  });

  test('US03-E04: CL terms match Strapi and differ from CO', async ({ page, request }) => {
    await reachSummary(page, 'CL');
    const [clTerms, coTerms] = await Promise.all([
      termsFromStrapi(request, 'CL'),
      termsFromStrapi(request, 'CO'),
    ]);

    expect(await page.locator('.terms__text').textContent()).toBe(clTerms);
    expect(clTerms).not.toBe(coTerms);
    expect(clTerms).not.toContain('COLOMBIA');
    expect(clTerms).toContain('CHILE');
  });

  test('US03-E05: Strapi edits to terms, mask and field copy appear after reload', async ({
    page,
  }) => {
    const editedTerms = 'TÉRMINOS EDITADOS EN STRAPI PARA PRUEBA AUTOMATIZADA.';
    const editedLabel = 'Número de documento (editado en Strapi)';
    const editedOption = 'Bogotá D.C. (editada en Strapi)';
    await reachSummary(page, 'CO');

    await page.route(CONFIG_ROUTE, async (route) => {
      await fulfillModifiedPayload<ConfigRow>(route, (payload) => {
        const row = payload.data[0];
        if (row !== undefined) {
          Reflect.set(row, 'termsAndConditions', editedTerms);
          Reflect.set(row, 'documentMaskVisibleEnd', 2);
        }
      });
    });
    await page.route(FIELDS_ROUTE, async (route) => {
      await fulfillModifiedPayload<FieldRow>(route, (payload) => {
        for (const row of payload.data) {
          if (row.key === 'documentNumber') {
            Reflect.set(row, 'label', editedLabel);
          }
          if (row.key === 'city') {
            const options = [...(row.options ?? [])];
            const bogota = options.find((option) => option.value === 'BOG');
            if (bogota !== undefined) {
              Reflect.set(bogota, 'label', editedOption);
            }
            Reflect.set(row, 'options', options);
          }
        }
      });
    });

    await page.reload();
    await expect(page.getByTestId('summary-sections')).toBeVisible();

    expect(await page.locator('.terms__text').textContent()).toBe(editedTerms);
    await expect(page.getByTestId('summary-sections').getByText(editedLabel)).toBeVisible();
    await expect(page.getByTestId('summary-sections').getByText(editedOption)).toBeVisible();
    await expect(
      page.getByTestId('summary-sections').getByText('•••••••89', { exact: true }),
    ).toBeVisible();
  });

  test('US03-E06: Pay stays disabled until the terms checkbox is toggled by keyboard', async ({
    page,
  }) => {
    await reachSummary(page, 'CO');
    const pay = page.getByTestId('pay-button');
    const checkbox = page.getByRole('checkbox', { name: COPY.acceptTerms });

    await expect(pay).toBeDisabled();
    await expect(pay).toHaveAttribute('aria-disabled', 'true');
    await expect(checkbox).not.toBeChecked();

    await page.getByTestId('terms-region').focus();
    await page.keyboard.press('PageDown');
    const scrollTop = await page
      .getByTestId('terms-region')
      .evaluate((element) => element.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);

    await page.keyboard.press('Tab');
    await expect(checkbox).toBeFocused();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
    await expect(pay).toBeEnabled();
    await expect(pay).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('US03-E07: blank terms block the form and retry restores the ready state', async ({
    page,
  }) => {
    await installPlanMocks(page, 'CO');
    await reachPlans(page, 'CO');
    await selectPlan(page, PLAN_IDS['CO'].standard);

    const blankTermsHandler = async (route: Route): Promise<void> => {
      await fulfillModifiedPayload<ConfigRow>(route, (payload) => {
        const row = payload.data[0];
        if (row !== undefined) {
          Reflect.set(row, 'termsAndConditions', '   ');
        }
      });
    };
    await page.route(CONFIG_ROUTE, blankTermsHandler);
    await continueToSummaryExpecting(page, /\/co\/quote\/summary$/);

    await expect(page.getByTestId('summary-empty-terms')).toBeVisible();
    await expect(page.getByTestId('summary-empty-terms')).toHaveAttribute('role', 'alert');
    await expect(page.getByText('No pudimos cargar los términos y condiciones para este país.')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: COPY.acceptTerms })).toHaveCount(0);
    await expect(page.getByTestId('pay-button')).toHaveCount(0);

    await page.unroute(CONFIG_ROUTE, blankTermsHandler);
    await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await expect(page.getByTestId('summary-sections')).toBeVisible();
    await expect(page.getByTestId('pay-button')).toBeDisabled();
  });

  test('US03-E08: loading, failed config retry and storage preservation are explicit', async ({
    page,
  }) => {
    await installPlanMocks(page, 'CO');
    await reachPlans(page, 'CO');
    await selectPlan(page, PLAN_IDS['CO'].standard);

    let releaseLoading = (): void => undefined;
    const loadingGate = new Promise<void>((resolve) => {
      releaseLoading = resolve;
    });
    const delayedHandler = async (route: Route): Promise<void> => {
      await loadingGate;
      await route.continue();
    };
    await page.route(CONFIG_ROUTE, delayedHandler);

    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page).toHaveURL(/\/co\/quote\/summary$/);
    await expect(page.getByTestId('summary-loading')).toBeVisible();
    await expect(page.getByTestId('summary-loading')).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByTestId('summary-loading').locator('.skeleton')).toHaveCount(3);
    await expect(page.getByRole('checkbox', { name: COPY.acceptTerms })).toHaveCount(0);
    await expect(page.getByTestId('pay-button')).toHaveCount(0);

    releaseLoading();
    await expect(page.getByTestId('summary-sections')).toBeVisible();
    await page.unroute(CONFIG_ROUTE, delayedHandler);
    const beforeError = await storageFor(page, 'CO');

    await page.getByRole('button', { name: COPY.changePlan }).click();
    await expect(page).toHaveURL(/\/co\/quote\/plans$/);
    const abortHandler = async (route: Route): Promise<void> => {
      await route.abort('failed');
    };
    await page.route(CONFIG_ROUTE, abortHandler);
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByTestId('summary-error')).toBeVisible();
    await expect(page.getByTestId('summary-error')).toHaveAttribute('role', 'alert');
    await expect(page.getByText('No pudimos cargar la configuración de tu país.')).toBeVisible();
    expect(await storageFor(page, 'CO')).toBe(beforeError);

    await page.unroute(CONFIG_ROUTE, abortHandler);
    await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await expect(page.getByTestId('summary-sections')).toBeVisible();
    expect(await storageFor(page, 'CO')).toBe(beforeError);
  });

  test('US03-E09: accepted payment locks the button and shows a deterministic confirmation', async ({
    page,
  }) => {
    await reachSummary(page, 'CO');
    await acceptTermsWithPointer(page);
    await page.evaluate(() => Reflect.set(globalThis, '__WIZARD_SIMULATE_PAYMENT_FAILURE__', false));

    await pay(page);
    await expect(page.getByTestId('pay-button')).toBeDisabled();
    await expect(page.locator('.payment__processing')).toHaveText(COPY.processing);
    await expectConfirmation(page);

    await expect(page.getByText('•••••6789', { exact: true })).toBeVisible();
    expect(await page.locator('body').innerText()).not.toContain('123456789');
    await expect(page.getByRole('button', { name: COPY.newQuote })).toBeVisible();
    await expect(page.getByTestId('pay-button')).toHaveCount(0);
  });

  test('US03-E10: rapid double submit produces exactly one attempt and one quote', async ({
    page,
  }) => {
    await reachSummary(page, 'CO');
    await acceptTermsWithPointer(page);
    await page.evaluate(() => {
      let calls = 0;
      Reflect.set(globalThis, '__failureHookCalls', 0);
      // One submission reads the hook twice (store request + service boundary).
      // Any second submission would read it a third time and be rejected.
      Reflect.set(globalThis, '__WIZARD_SIMULATE_PAYMENT_FAILURE__', () => {
        calls += 1;
        Reflect.set(globalThis, '__failureHookCalls', calls);
        return calls > 2;
      });
    });

    await page.getByTestId('pay-button').dblclick();
    await expect(page.locator('.payment__processing')).toHaveText(COPY.processing);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    const quoteNumber = await expectConfirmation(page);

    const hookCalls = await page.evaluate(
      () => Reflect.get(globalThis, '__failureHookCalls') as number,
    );
    expect(hookCalls).toBe(2);
    await expect(page.getByTestId('payment-rejected')).toHaveCount(0);
    await expect(page.locator('.confirmation__quote')).toHaveCount(1);
    expect((await page.locator('body').innerText()).split(quoteNumber).length - 1).toBe(1);
  });

  test('US03-E11: rejection preserves data and retry succeeds without re-entry', async ({
    page,
  }) => {
    await reachSummary(page, 'CO');
    await acceptTermsWithPointer(page);
    const beforeStorage = await storageFor(page, 'CO');
    await page.evaluate(() => Reflect.set(globalThis, '__WIZARD_SIMULATE_PAYMENT_FAILURE__', true));

    await pay(page);
    await expect(page.getByTestId('payment-rejected')).toBeVisible();
    await expect(page.getByTestId('payment-rejected')).toHaveAttribute('role', 'alert');
    await expect(page.getByText(COPY.rejection)).toBeVisible();
    await expect(page.getByRole('checkbox', { name: COPY.acceptTerms })).toBeChecked();
    await expect(page.getByTestId('summary-sections').getByText('•••••6789', { exact: true })).toBeVisible();
    expect(await storageFor(page, 'CO')).toBe(beforeStorage);

    await page.evaluate(() => Reflect.set(globalThis, '__WIZARD_SIMULATE_PAYMENT_FAILURE__', false));
    await page.getByRole('button', { name: COPY.retryPayment }).click();
    await expectConfirmation(page);
    expect(await storageFor(page, 'CO')).toBe(beforeStorage);
  });

  test('US03-E12: Editar datos restores raw values and the selected plan survives re-entry', async ({
    page,
  }) => {
    await reachSummary(page, 'CO');

    await page.getByRole('button', { name: COPY.editData }).click();
    await expect(page).toHaveURL(/\/co\/quote$/);
    await expect(page.locator('#documentNumber')).toHaveValue('123456789');
    await expect(page.locator('#licensePlate')).toHaveValue('ABC123');
    const saved = JSON.parse((await storageFor(page, 'CO')) ?? '{}') as PersistedState;
    expect(saved.schemaVersion).toBe(1);
    expect(saved.selectedPlanDocumentId).toBe(PLAN_IDS['CO'].standard);

    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page).toHaveURL(/\/co\/quote\/plans$/);
    await expect(
      page.locator(`input[type="radio"][value="${PLAN_IDS['CO'].standard}"]`),
    ).toBeChecked();
    await continueToSummary(page, 'CO');
    await expect(page.getByTestId('summary-sections').getByText('•••••6789', { exact: true })).toBeVisible();
    await expect(page.getByText('Plan Estándar', { exact: true })).toBeVisible();
  });

  test('US03-E13: Cambiar plan preserves data and renders the newly selected plan price', async ({
    page,
  }) => {
    await reachSummary(page, 'CO');

    await page.getByRole('button', { name: COPY.changePlan }).click();
    await expect(page).toHaveURL(/\/co\/quote\/plans$/);
    await expect(
      page.locator(`input[type="radio"][value="${PLAN_IDS['CO'].standard}"]`),
    ).toBeChecked();
    await selectPlan(page, PLAN_IDS['CO'].alternative);
    await continueToSummary(page, 'CO');

    await expect(page.getByText('Plan Todo Riesgo', { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="payment-panel"] data')).toHaveAttribute(
      'value',
      '1150000',
    );
    expect(normalized(await page.locator('[data-testid="payment-panel"]').innerText())).toContain(
      normalized(money(1150000, 'CO')),
    );
    await expect(page.getByTestId('summary-sections').getByText('•••••6789', { exact: true })).toBeVisible();
  });

  test('US03-E14: Nueva cotización clears storage; reload after confirmation stays in memory', async ({
    page,
  }) => {
    await reachSummary(page, 'CO');
    await acceptTermsWithPointer(page);
    await page.evaluate(() => Reflect.set(globalThis, '__WIZARD_SIMULATE_PAYMENT_FAILURE__', false));
    await pay(page);
    const quoteNumber = await expectConfirmation(page);

    await page.getByRole('button', { name: COPY.newQuote }).click();
    await expect(page).toHaveURL(/\/co\/quote$/);
    expect(await storageFor(page, 'CO')).toBeNull();
    await expect(page.locator('#documentNumber')).toHaveValue('');
    await expect(page.locator('#fullName')).toHaveValue('');

    await reachPlans(page, 'CO');
    await selectPlan(page, PLAN_IDS['CO'].standard);
    await continueToSummary(page, 'CO');
    await acceptTermsWithPointer(page);
    await page.evaluate(() => Reflect.set(globalThis, '__WIZARD_SIMULATE_PAYMENT_FAILURE__', false));
    await pay(page);
    await expectConfirmation(page);

    await page.reload();
    await expect(page).toHaveURL(/\/co\/quote\/summary$/);
    await expect(page.getByTestId('summary-sections')).toBeVisible();
    await expect(page.getByTestId('quote-confirmation')).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: COPY.acceptTerms })).not.toBeChecked();
    expect(await page.locator('body').innerText()).not.toContain(quoteNumber);
    expect(await storageFor(page, 'CO')).not.toBeNull();
    const restored = JSON.parse((await storageFor(page, 'CO')) ?? '{}') as PersistedState;
    expect(restored.step1['documentNumber']).toBe('123456789');
    expect(restored.selectedPlanDocumentId).toBe(PLAN_IDS['CO'].standard);
  });

  test('US03-E15: the full retry-and-pay path is keyboard-only with ARIA wiring', async ({
    page,
  }) => {
    await installPlanMocks(page, 'CO');
    await reachPlans(page, 'CO');
    await selectPlan(page, PLAN_IDS['CO'].standard);
    const continueButton = page.getByRole('button', { name: 'Continuar' });
    await expect(continueButton).toBeEnabled();
    await continueButton.focus();
    await expect(continueButton).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/co\/quote\/summary$/);
    await expect(page.getByTestId('summary-sections')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: COPY.summaryHeading })).toBeFocused();

    await tabUntilFocused(page, '[data-testid="terms-region"]');
    const termsRegion = page.getByTestId('terms-region');
    expect(
      await termsRegion.evaluate((element) => getComputedStyle(element).outlineStyle),
    ).not.toBe('none');
    await page.keyboard.press('PageDown');
    expect(await termsRegion.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

    await page.keyboard.press('Tab');
    const checkbox = page.getByRole('checkbox', { name: COPY.acceptTerms });
    await expect(checkbox).toBeFocused();
    const describedBy = (await checkbox.getAttribute('aria-describedby'))?.split(/\s+/).filter(Boolean) ?? [];
    expect(describedBy.length).toBeGreaterThan(0);
    for (const id of describedBy) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    expect(await checkbox.getAttribute('aria-invalid')).toBeNull();
    await page.keyboard.press('Shift+Tab');
    await expect(termsRegion).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: COPY.editData })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: COPY.changePlan })).toBeFocused();
    const pay = page.getByTestId('pay-button');
    await expect(pay).toBeEnabled();
    await page.keyboard.press('Tab');
    await expect(pay).toBeFocused();
    expect(await pay.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
    expect(await pay.getAttribute('value')).toBeNull();
    await expect(page.locator('[data-testid="payment-panel"] data')).toHaveAttribute(
      'value',
      '620000',
    );

    await page.evaluate(() => Reflect.set(globalThis, '__WIZARD_SIMULATE_PAYMENT_FAILURE__', true));
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('payment-rejected')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: COPY.summaryHeading })).toBeFocused();

    await tabUntilFocused(page, '[data-testid="payment-rejected"] button');
    await page.evaluate(() => Reflect.set(globalThis, '__WIZARD_SIMULATE_PAYMENT_FAILURE__', false));
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('quote-confirmation')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: COPY.summaryHeading })).toBeFocused();

    await tabUntilFocused(page, '.confirmation__action');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/co\/quote$/);
  });

  test('US03-E16: responsive layout, zero network on Pay and read-only security hold', async ({
    page,
    request,
  }) => {
    const apiRequests: Array<{ method: string; authorization: string | undefined }> = [];
    page.on('request', (captured) => {
      if (captured.url().includes('/api/')) {
        apiRequests.push({
          method: captured.method(),
          authorization: captured.headers()['authorization'],
        });
      }
    });

    await page.setViewportSize({ width: 375, height: 812 });
    await reachSummary(page, 'CO');
    await acceptTermsWithPointer(page);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    const checkboxBox = await page.getByRole('checkbox', { name: COPY.acceptTerms }).boundingBox();
    expect(checkboxBox?.width).toBeGreaterThanOrEqual(44);
    expect(checkboxBox?.height).toBeGreaterThanOrEqual(44);
    const payBox = await page.getByTestId('pay-button').boundingBox();
    expect(payBox?.height).toBeGreaterThanOrEqual(44);
    expect(payBox?.width).toBeGreaterThanOrEqual(300);
    const editBox = await page.getByRole('button', { name: COPY.editData }).boundingBox();
    const changeBox = await page.getByRole('button', { name: COPY.changePlan }).boundingBox();
    expect(editBox?.height).toBeGreaterThanOrEqual(44);
    expect(changeBox?.height).toBeGreaterThanOrEqual(44);
    const mobileGrid = await page.getByTestId('summary-sections').evaluate((element) => {
      const style = getComputedStyle(element);
      return style.gridTemplateColumns.trim().split(/\s+/).length;
    });
    expect(mobileGrid).toBe(1);
    const termsScrollStyle = await page.getByTestId('terms-region').evaluate((element) => {
      const style = getComputedStyle(element);
      return { overflowY: style.overflowY, maxHeight: Number.parseFloat(style.maxHeight) };
    });
    expect(termsScrollStyle.overflowY).toBe('auto');
    expect(termsScrollStyle.maxHeight).toBeLessThanOrEqual(330);

    await page.setViewportSize({ width: 768, height: 900 });
    const tabletGrid = await page.getByTestId('summary-sections').evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        columns: style.gridTemplateColumns.trim().split(/\s+/).length,
        gap: Number.parseFloat(style.columnGap || style.gap),
      };
    });
    expect(tabletGrid.columns).toBe(2);
    expect(tabletGrid.gap).toBeGreaterThanOrEqual(15);

    await page.setViewportSize({ width: 1280, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    const pageWidth = await page.locator('.summary-page').evaluate(
      (element) => (element as HTMLElement).getBoundingClientRect().width,
    );
    expect(pageWidth).toBeLessThanOrEqual(1120);
    const desktopGridGap = await page.getByTestId('summary-sections').evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).columnGap || getComputedStyle(element).gap),
    );
    expect(desktopGridGap).toBeGreaterThanOrEqual(23);
    const priceOverflow = await page.locator('.payment__price--final').evaluate(
      (element) => getComputedStyle(element).textOverflow,
    );
    expect(priceOverflow).not.toBe('ellipsis');

    const beforePay = apiRequests.length;
    await page.evaluate(() => Reflect.set(globalThis, '__WIZARD_SIMULATE_PAYMENT_FAILURE__', false));
    await pay(page);
    await expectConfirmation(page);
    const newQuoteBox = await page.getByRole('button', { name: COPY.newQuote }).boundingBox();
    expect(newQuoteBox?.height).toBeGreaterThanOrEqual(44);
    expect(apiRequests).toHaveLength(beforePay);
    for (const captured of apiRequests) {
      expect(captured.method).toBe('GET');
      expect(captured.authorization).toBeUndefined();
    }
    expect(await page.locator('input[autocomplete^="cc-"]')).toHaveCount(0);

    const writePaths = ['country-configs', 'form-fields', 'insurance-plans'];
    for (const resource of writePaths) {
      const post = await request.post(`${STRAPI_URL}/api/${resource}`, {
        data: { data: { key: 'hacked' } },
      });
      const put = await request.put(`${STRAPI_URL}/api/${resource}/1`, {
        data: { data: { key: 'hacked' } },
      });
      const remove = await request.delete(`${STRAPI_URL}/api/${resource}/1`);
      for (const response of [post, put, remove]) {
        expect([401, 403]).toContain(response.status());
      }
    }

    const forbidden = ['Bearer', 'apiToken', 'api_token', 'cardNumber', 'cvv'];
    const offenders = sourceFiles(path.resolve(process.cwd(), 'src')).filter((file) => {
      const content = fs.readFileSync(file, 'utf8');
      return forbidden.some((token) => content.includes(token));
    });
    expect(offenders).toEqual([]);
  });
});

async function continueToSummaryExpecting(page: Page, url: RegExp): Promise<void> {
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(url);
}
