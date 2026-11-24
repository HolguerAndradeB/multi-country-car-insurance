import type { CountryCode, CurrencyCode } from './country.models';

/** One coverage row from the typed `coverages` JSON column. */
export interface PlanCoverageItem {
  readonly name: string;
  /** Money amount in the plan's currency; formatted with `formatCurrency()`. */
  readonly limit: number;
  /** `null` (or absent) is rendered as "No aplica". */
  readonly deductible: number | null;
}

/** Raw Strapi 5 flattened record — no v4 `.attributes` nesting. */
export interface InsurancePlanDto {
  readonly id: number;
  readonly documentId: string;
  readonly key: string;
  readonly name: string;
  readonly shortDescription: string;
  /** Strapi `biginteger` is serialised as a JSON string. */
  readonly basePrice: number | string;
  readonly currency: CurrencyCode;
  readonly coverages: readonly PlanCoverageItem[] | null;
  readonly benefits: readonly string[] | null;
  readonly order: number;
  readonly recommended: boolean;
  readonly active: boolean;
  readonly country: CountryCode;
  readonly publishedAt: string | null;
}

/** Domain model used by the UI — never the raw Strapi payload. */
export interface InsurancePlan {
  readonly id: number;
  readonly documentId: string;
  readonly key: string;
  readonly name: string;
  readonly shortDescription: string;
  /** Integer >= 0 after `Number()` coercion of the DTO string. */
  readonly basePrice: number;
  readonly currency: CurrencyCode;
  readonly coverages: readonly PlanCoverageItem[];
  readonly benefits: readonly string[];
  readonly order: number;
  readonly recommended: boolean;
  readonly country: CountryCode;
}

/** Output of the pure, deterministic simulated-pricing rule (US-02 §2.2). */
export interface PriceAdjustmentResult {
  /** Integer percent added to `basePrice`; 0 when neither factor applies. */
  readonly adjustmentPercent: number;
  /** Neutral-Spanish reasons, e.g. "por antigüedad del vehículo". */
  readonly reasons: readonly string[];
  /** Rounded integer price in the country's currency. */
  readonly finalPrice: number;
}

/** One card's fully derived view model (computed, never persisted). */
export interface QuotedPlan {
  readonly plan: InsurancePlan;
  readonly basePrice: number;
  readonly finalPrice: number;
  readonly formattedBasePrice: string;
  readonly formattedFinalPrice: string;
  readonly adjustment: PriceAdjustmentResult;
}
