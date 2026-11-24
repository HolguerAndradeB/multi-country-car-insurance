import type { AppLocale, CountryCode, CurrencyCode } from './country.models';

// ---- Summary view models (computed only, never persisted) ----

export interface SummaryRow {
  readonly key: string;
  /** Verbatim form-field.label from the freshly fetched Strapi catalogue. */
  readonly label: string;
  /** Already localized/derived display string (option label, yes/no, formatted date, masked doc, placeholder). */
  readonly value: string;
}

export interface SummarySection {
  readonly id: 'policyholder' | 'vehicle';
  readonly heading: string;
  readonly rows: readonly SummaryRow[];
}

/** Reads only from the US-02 QuotedPlan — never recomputes pricing. */
export interface PlanSummary {
  readonly name: string;
  readonly shortDescription: string;
  readonly basePriceText: string;
  readonly finalPriceText: string;
  readonly adjustmentText: string;
  readonly footnote: string;
  /** Machine-readable integer for <data [attr.value]>. */
  readonly finalPrice: number;
}

/** Shared copy needed to render a QuotedPlan without changing its prices. */
export interface PlanSummaryCopy {
  readonly basePriceLabel: string;
  readonly finalPriceLabel: string;
  readonly adjustmentLabel: string;
  readonly noAdjustment: string;
  /** Preferred key; `simulatedFootnote` is accepted for the shared UI_COPY shape. */
  readonly footnote?: string;
  readonly simulatedFootnote?: string;
}

// ---- Step 3 lifecycle ----

export type SummaryLoadStatus = 'idle' | 'loading' | 'ready' | 'empty-terms' | 'error';
export type PaymentStatus = 'idle' | 'processing' | 'rejected' | 'confirmed';

// ---- Simulated payment boundary (frontend only, zero network, zero card data) ----

export interface SimulatedPaymentRequest {
  readonly country: CountryCode;
  readonly locale: AppLocale;
  readonly planDocumentId: string;
  readonly termsDocumentId: string;
  /** Deterministic failure hook; false for the shipped happy path (§7.4 Q2). */
  readonly shouldFail: boolean;
  /** Injectable in unit tests; default 600 ms in the service. */
  readonly delayMs?: number;
}

export type SimulatedPaymentResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: 'SIMULATED_REJECTION' };

/** Frozen at success; the confirmation view renders ONLY from this object. */
export interface QuoteConfirmation {
  readonly quoteNumber: string;
  readonly country: CountryCode;
  readonly locale: AppLocale;
  readonly currency: CurrencyCode;
  /** ISO timestamp from QuoteClock, formatted for display at render time. */
  readonly issuedAt: string;
  readonly policyholder: readonly SummaryRow[];
  readonly vehicle: readonly SummaryRow[];
  readonly planName: string;
  readonly finalPrice: number;
  readonly formattedFinalPrice: string;
  readonly termsDocumentId: string;
}
