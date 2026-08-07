# Engineering Decisions

## Money & Billing
- **Source of Truth**: The `public.payments` table is the single canonical source of truth for all financial transactions and balances.
- **Billing V2 Status**: Billing V2 (`billing_*` tables) is parked. It is currently used only for dual-writes to keep the data path warm.
- **Reporting**: All UI surfaces and AI agents must read from `payments`, `students`, and `fee_plans` to compute dues and collections. Never use `billing_invoices` or `billing_payments` for reporting to users.
- **Shared Helpers**: Use the canonical helpers in `src/lib/fees.ts` for all money calculations:
  - `resolveEffectiveMonthlyFee`: Computes the correct fee considering `custom_fee`, gender pricing, and plan defaults.
  - `getPaidPeriodSet`: Extracts valid paid periods (type='monthly') from a payment list.
- **Idempotency**: Use `newIdempotencyKey()` from `src/lib/billing.ts` to dedupe true double-submits. Do not use business data (amount/period) as idempotency keys.
