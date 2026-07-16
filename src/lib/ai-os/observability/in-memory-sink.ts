import type { AIAnalyticsRecord, AIAnalyticsSink } from "./types";

export class InMemoryAnalyticsSink implements AIAnalyticsSink {
  private records: AIAnalyticsRecord[] = [];

  async record(entry: AIAnalyticsRecord): Promise<void> {
    this.records.push(entry);
    // Cap in-memory buffer.
    if (this.records.length > 500) this.records.splice(0, this.records.length - 500);
  }

  async recent(tenantId: string, limit = 50): Promise<AIAnalyticsRecord[]> {
    return this.records
      .filter((r) => r.tenantId === tenantId)
      .slice(-limit)
      .reverse();
  }
}
