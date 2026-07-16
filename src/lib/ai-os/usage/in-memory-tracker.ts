import type { TenantDailyUsage, UsageEvent, UsageTracker } from "./types";

export class InMemoryUsageTracker implements UsageTracker {
  private byDay = new Map<string, TenantDailyUsage>();
  events: UsageEvent[] = [];

  async record(event: UsageEvent): Promise<void> {
    this.events.push(event);
    const date = event.at.slice(0, 10);
    const key = `${event.tenantId}|${date}`;
    const cur = this.byDay.get(key) ?? {
      tenantId: event.tenantId,
      date,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      failures: 0,
    };
    cur.requests += 1;
    cur.inputTokens += event.usage.inputTokens;
    cur.outputTokens += event.usage.outputTokens;
    cur.estimatedCostUsd += event.usage.estimatedCostUsd;
    if (!event.ok) cur.failures += 1;
    this.byDay.set(key, cur);
  }

  async dailyUsage(tenantId: string, date: string): Promise<TenantDailyUsage> {
    return (
      this.byDay.get(`${tenantId}|${date}`) ?? {
        tenantId,
        date,
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        failures: 0,
      }
    );
  }
}
