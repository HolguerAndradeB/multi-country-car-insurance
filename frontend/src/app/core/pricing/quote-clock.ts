import { Injectable } from '@angular/core';

/** Injectable local-date boundary so pricing helpers stay pure and testable. */
@Injectable({ providedIn: 'root' })
export class QuoteClock {
  /** Captured once; local calendar date with no UTC conversion (US-02 G8). */
  readonly today: Date = new Date();
  readonly currentYear: number = this.today.getFullYear();
}
