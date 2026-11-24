import { expect, test } from '@playwright/test';

const STRAPI_URL = process.env['E2E_STRAPI_URL'] ?? 'http://localhost:1337';

test.describe('US-01 Multi-Country Dynamic Form Wizard', () => {
  test('US01-E01/E02/E03/E17: renders CO and CL Strapi fields in order with zero auth headers and canonical redirect', async ({
    page,
  }) => {
    const apiRequests: Array<{ method: string; url: string; authHeader: string | undefined }> = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/')) {
        apiRequests.push({
          method: req.method(),
          url: req.url(),
          authHeader: req.headers()['authorization'],
        });
      }
    });

    // Root redirects automatically to /co/quote (ADR-001 Checkpoint 2)
    await page.goto('/');
    await expect(page).toHaveURL(/\/co\/quote$/);
    await expect(page.locator('label[for="documentType"]')).toBeVisible();
    await expect(page.locator('label[for="licensePlate"]')).toContainText('Placa del vehículo');
    await expect(page.locator('form label', { hasText: 'RUT' })).toHaveCount(0);

    const coLabels = await page.locator('form label').allInnerTexts();
    expect(coLabels.length).toBe(9);
    expect(coLabels[0]).toContain('Tipo de documento');
    expect(coLabels[6]).toContain('Placa del vehículo');

    // Switch to CL via country switcher -> 8 CL fields, no Tipo de documento
    await page.selectOption('#country-switcher', 'cl');
    await expect(page).toHaveURL(/\/cl\/quote$/);
    await expect(page.locator('label[for="documentNumber"]')).toContainText('RUT');
    await expect(page.locator('label[for="licensePlate"]')).toContainText('Patente del vehículo');
    await expect(page.locator('label[for="documentType"]')).toHaveCount(0);

    const clLabels = await page.locator('form label').allInnerTexts();
    expect(clLabels.length).toBe(8);

    // Invalid country redirects canonically to /co/quote
    await page.goto('/xx/quote');
    await expect(page).toHaveURL(/\/co\/quote$/);

    // Security check (US01-E17): GET-only /api/ requests and zero Authorization headers
    expect(apiRequests.length).toBeGreaterThan(0);
    for (const req of apiRequests) {
      expect(req.method).toBe('GET');
      expect(req.authHeader).toBeUndefined();
    }
  });

  test('US01-E04/E05/E06/E07/E20/E21: validates CO & CL fields with configured error messages, ARIA, and focus management', async ({
    page,
  }) => {
    await page.goto('/co/quote');
    await expect(page.locator('label[for="documentType"]')).toBeVisible();

    // Empty submit stays on Step 1, displays seeded error messages, focuses first invalid control
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page).toHaveURL(/\/co\/quote$/);
    await expect(page.locator('#err-documentType')).toHaveAttribute('role', 'alert');
    await expect(page.locator('#documentType')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#documentType')).toBeFocused();

    // Invalid CO plate shows CO configured error message
    await page.fill('#licensePlate', 'AB1234');
    await page.locator('#licensePlate').blur();
    await expect(page.locator('#err-licensePlate')).toContainText('La placa debe tener el formato ABC123.');

    // Underage birthDate blocks
    await page.fill('#birthDate', '2015-01-01');
    await page.locator('#birthDate').blur();
    await expect(page.locator('#err-birthDate')).toContainText('Debes ser mayor de 18 años para continuar.');

    // CL RUT validation blocks invalid check digit
    await page.goto('/cl/quote');
    await expect(page.locator('#documentNumber')).toBeVisible();
    await page.fill('#documentNumber', '12.345.678-9');
    await page.locator('#documentNumber').blur();
    await expect(page.locator('#err-documentNumber')).toContainText('El RUT ingresado no es válido.');
  });

  test('US01-E10/E11/E15/E16/E19: completes Step 1 via keyboard, keeps data on Back & reload, and isolates CO vs CL drafts', async ({
    page,
  }) => {
    await page.goto('/co/quote');
    await expect(page.locator('#documentType')).toBeVisible();

    await page.selectOption('#documentType', 'CC');
    await page.fill('#documentNumber', '1023456789');
    await page.fill('#fullName', 'Camila Rodríguez');
    await page.fill('#birthDate', '1995-05-15');
    await page.selectOption('#city', 'BOG');
    await page.fill('#licensePlate', 'xyz987');
    await page.selectOption('#vehicleMake', 'MAZDA');
    await page.fill('#vehicleYear', '2022');
    // Wait briefly for 400ms debounced persistence
    await page.waitForTimeout(550);

    // Switch to CL -> clean CL form; switch back to CO -> CO draft preserved (US01-E16)
    await page.selectOption('#country-switcher', 'cl');
    await expect(page).toHaveURL(/\/cl\/quote$/);
    await expect(page.locator('#fullName')).toHaveValue('');
    await page.selectOption('#country-switcher', 'co');
    await expect(page).toHaveURL(/\/co\/quote$/);
    await expect(page.locator('#fullName')).toHaveValue('Camila Rodríguez');

    // Reload preserves draft (US01-E15)
    await page.reload();
    await expect(page.locator('#fullName')).toHaveValue('Camila Rodríguez');
    await expect(page.locator('#licensePlate')).toHaveValue('XYZ987');

    // Submit via keyboard Enter on Continuar -> real Step 2 plan list -> reload -> Back keeps values
    const nextBtn = page.getByRole('button', { name: 'Continuar' });
    await nextBtn.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/co\/quote\/plans$/);
    await expect(page.getByTestId('plans-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Planes', level: 1 })).toBeVisible();
    await expect(page.locator('fieldset')).toContainText('Selecciona tu plan');
    await expect(page.locator('app-plan-card').first()).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('plans-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Planes', level: 1 })).toBeVisible();
    await expect(page.locator('app-plan-card').first()).toBeVisible();

    const backBtn = page.getByRole('button', { name: 'Volver a mis datos' });
    await backBtn.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/co\/quote$/);
    await expect(page.locator('#fullName')).toHaveValue('Camila Rodríguez');
    await expect(page.locator('#documentNumber')).toHaveValue('1023456789');
    await expect(page.locator('#licensePlate')).toHaveValue('XYZ987');
  });

  test('US01-E08/E09/E12/E13/E14: handles dynamic field additions on reload, empty catalogue, and network error + retry', async ({
    page,
  }) => {
    // Error + Retry (US01-E12)
    let failFirst = true;
    await page.route('**/api/form-fields*', async (route) => {
      if (failFirst) {
        failFirst = false;
        await route.abort();
        return;
      }
      await route.continue();
    });

    await page.goto('/co/quote');
    await expect(page.getByRole('alert')).toContainText('No pudimos cargar el formulario.');
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.locator('#documentType')).toBeVisible();
    await page.unroute('**/api/form-fields*');

    // Empty catalogue (US01-E13)
    await page.route('**/api/form-fields*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { pagination: { page: 1, pageSize: 100, pageCount: 0, total: 0 } } }),
      });
    });
    await page.reload();
    await expect(page.getByText('No hay campos configurados para este país')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar' })).toHaveCount(0);
    await page.unroute('**/api/form-fields*');

    // Config change without deployment on reload (US01-E08)
    await page.route('**/api/form-fields*', async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      json.data.push({
        id: 999,
        documentId: 'ffco999',
        key: 'contactEmail',
        label: 'Correo electrónico',
        type: 'text',
        required: true,
        validations: {},
        options: [],
        helpText: 'Para enviarte tu cotización.',
        errorMessage: 'Ingresa un correo válido.',
        order: 10,
        country: 'CO',
        section: 'policyholder',
      });
      await route.fulfill({ response, json });
    });
    await page.reload();
    await expect(page.locator('label[for="contactEmail"]')).toContainText('Correo electrónico');
  });

  test('US01-E22: responsive layout has zero horizontal overflow on 375px mobile and 1280px desktop', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/co/quote');
    await expect(page.locator('#documentType')).toBeVisible();
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(mobileOverflow).toBe(false);

    await page.setViewportSize({ width: 1280, height: 800 });
    const desktopOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(desktopOverflow).toBe(false);
  });

  test('US01-E18: Strapi Public role blocks unauthenticated writes and user listing', async ({ request }) => {
    const postRes = await request.post(`${STRAPI_URL}/api/form-fields`, {
      data: { data: { key: 'hackedField' } },
    });
    expect([401, 403]).toContain(postRes.status());

    const usersRes = await request.get(`${STRAPI_URL}/api/users`);
    expect([401, 403]).toContain(usersRes.status());
  });
});
