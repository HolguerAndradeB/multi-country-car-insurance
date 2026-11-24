import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SimulatedPaymentRequest } from '../models';
import {
  SIMULATED_PAYMENT_DELAY_MS,
  SIMULATED_PAYMENT_FAILURE_HOOK,
  SimulatedPaymentService,
} from './simulated-payment.service';

const REQUEST: SimulatedPaymentRequest = {
  country: 'CO',
  locale: 'es-CO',
  planDocumentId: 'planco00000000000000002',
  termsDocumentId: 'cfgcol0000000000000001',
  shouldFail: false,
  delayMs: 0,
};

interface ServiceOptions {
  readonly useDefaultProviders?: boolean;
  readonly delayMs?: number;
  readonly failureHook?: () => boolean;
}

async function createService(options: ServiceOptions = {}): Promise<SimulatedPaymentService> {
  TestBed.resetTestingModule();
  const providers = options.useDefaultProviders
    ? []
    : [
        { provide: SIMULATED_PAYMENT_DELAY_MS, useValue: options.delayMs ?? 0 },
        {
          provide: SIMULATED_PAYMENT_FAILURE_HOOK,
          useValue: options.failureHook ?? (() => false),
        },
      ];

  await TestBed.configureTestingModule({ providers }).compileComponents();
  return TestBed.inject(SimulatedPaymentService);
}

describe('SimulatedPaymentService (US03-U10, US03-U11)', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let originalFetch: typeof globalThis.fetch;
  let xhrOpenSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchSpy = vi.fn(() => Promise.reject(new Error('The simulated payment must not use fetch.')));
    Reflect.set(globalThis, 'fetch', fetchSpy);
    xhrOpenSpy = vi.spyOn(XMLHttpRequest.prototype, 'open');
    Reflect.deleteProperty(globalThis, '__WIZARD_SIMULATE_PAYMENT_FAILURE__');
  });

  afterEach(() => {
    Reflect.set(globalThis, 'fetch', originalFetch);
    xhrOpenSpy.mockRestore();
    Reflect.deleteProperty(globalThis, '__WIZARD_SIMULATE_PAYMENT_FAILURE__');
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('US03-U10: resolves the success result without any network or sensitive request keys', async () => {
    const service = await createService();

    await expect(service.pay(REQUEST)).resolves.toEqual({ ok: true });

    expect(Object.keys(REQUEST).sort()).toEqual([
      'country',
      'delayMs',
      'locale',
      'planDocumentId',
      'shouldFail',
      'termsDocumentId',
    ]);
    expect(JSON.stringify(REQUEST)).not.toMatch(
      /card|cvv|expiry|expiration|billing|address|token|gateway|paypal|stripe/i,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpenSpy).not.toHaveBeenCalled();
  });

  it('US03-U11: returns a rejection result value for shouldFail instead of throwing', async () => {
    const service = await createService({ failureHook: () => false });

    await expect(service.pay({ ...REQUEST, shouldFail: true })).resolves.toEqual({
      ok: false,
      code: 'SIMULATED_REJECTION',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpenSpy).not.toHaveBeenCalled();
  });

  it('US03-U11: honours the injected deterministic failure hook', async () => {
    const hook = vi.fn(() => true);
    const service = await createService({ failureHook: hook });

    await expect(service.pay(REQUEST)).resolves.toEqual({
      ok: false,
      code: 'SIMULATED_REJECTION',
    });
    expect(hook).toHaveBeenCalledTimes(1);
  });

  it('US03-U11: the default hook reads the non-UI globalThis test flag', async () => {
    const service = await createService({ useDefaultProviders: true });

    await expect(service.pay(REQUEST)).resolves.toEqual({ ok: true });

    Reflect.set(globalThis, '__WIZARD_SIMULATE_PAYMENT_FAILURE__', true);
    await expect(service.pay(REQUEST)).resolves.toEqual({
      ok: false,
      code: 'SIMULATED_REJECTION',
    });

    Reflect.set(globalThis, '__WIZARD_SIMULATE_PAYMENT_FAILURE__', () => false);
    await expect(service.pay(REQUEST)).resolves.toEqual({ ok: true });
  });

  it('US03-U10: uses the 600 ms default delay and no retry loop', async () => {
    vi.useFakeTimers();
    const service = await createService({ useDefaultProviders: true });
    const request = { ...REQUEST, delayMs: undefined };

    let settled = false;
    const payment = service.pay(request).then((result) => {
      settled = true;
      return result;
    });

    await vi.advanceTimersByTimeAsync(599);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(payment).resolves.toEqual({ ok: true });
    expect(settled).toBe(true);

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpenSpy).not.toHaveBeenCalled();
  });
});
