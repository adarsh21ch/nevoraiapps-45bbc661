/**
 * AI OS — global configuration.
 *
 * All values are safe to import from client OR server code. Nothing here
 * references secrets. Provider secrets live in `providers/*.server.ts`.
 */

export const AI_OS_CONFIG = {
  /** Default provider id when the caller does not name one. */
  defaultProvider: "gemini" as const,
  /** Default model id per provider. */
  defaultModels: {
    gemini: "google/gemini-2.5-flash",
  },
  /** Hard timeout for a single provider call. */
  requestTimeoutMs: 30_000,
  /** Retry policy for transient (429 / 5xx) errors. */
  retry: {
    maxAttempts: 3,
    baseDelayMs: 400,
    maxDelayMs: 4_000,
  },
  /** Per-tenant rate limit (soft, in-memory; a durable store lands in 11.1). */
  rateLimit: {
    requestsPerMinute: 30,
    tokensPerDay: 500_000,
  },
  /** Memory / cost controls. */
  memory: {
    maxTurns: 20,
    /** After this many turns, older ones are summarized instead of resent. */
    summarizeAfterTurns: 12,
    /** Approx. char budget per turn stored raw. */
    maxCharsPerTurn: 4_000,
  },
} as const;

export type AIOSConfig = typeof AI_OS_CONFIG;
