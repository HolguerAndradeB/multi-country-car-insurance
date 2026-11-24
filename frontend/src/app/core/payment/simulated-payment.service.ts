import { inject, Injectable, InjectionToken } from '@angular/core';

import type { SimulatedPaymentRequest, SimulatedPaymentResult } from '../models';

/** Default simulated delay; unit tests can override this token with 0. */
export const SIMULATED_PAYMENT_DELAY_MS = new InjectionToken<number>('SIMULATED_PAYMENT_DELAY_MS', {
  providedIn: 'root',
  factory: () => 600,
});

/** Non-UI test hook approved in Checkpoint 3 Q2 Option A. */
export const SIMULATED_PAYMENT_FAILURE_HOOK = new InjectionToken<() => boolean>(
  'SIMULATED_PAYMENT_FAILURE_HOOK',
  {
    providedIn: 'root',
    factory: () => () => {
      const flag = (globalThis as {
        __WIZARD_SIMULATE_PAYMENT_FAILURE__?: boolean | (() => boolean);
      }).__WIZARD_SIMULATE_PAYMENT_FAILURE__;
      return typeof flag === 'function' ? flag() : flag === true;
    },
  },
);

/**
 * Frontend-only simulated payment boundary: no HTTP, no storage, no card or
 * token data. A rejection is a result value, never an exception.
 */
@Injectable({ providedIn: 'root' })
export class SimulatedPaymentService {
  private readonly defaultDelayMs = inject(SIMULATED_PAYMENT_DELAY_MS);
  private readonly failureHook = inject(SIMULATED_PAYMENT_FAILURE_HOOK);

  pay(request: SimulatedPaymentRequest): Promise<SimulatedPaymentResult> {
    const delayMs = Math.max(0, request.delayMs ?? this.defaultDelayMs);
    const shouldFail = request.shouldFail || this.failureHook();

    return new Promise<SimulatedPaymentResult>((resolve) => {
      setTimeout(() => {
        resolve(
          shouldFail
            ? { ok: false, code: 'SIMULATED_REJECTION' }
            : { ok: true },
        );
      }, delayMs);
    });
  }
}
