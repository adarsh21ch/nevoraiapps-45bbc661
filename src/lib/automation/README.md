# Platform Automation Engine

Reusable, tenant-isolated event → rule → action pipeline. Not module-specific.
Any product built on NevorAI can emit events and register rules against them.

## Layers

```
Business Modules
      │
      │  emitAutomationEvent({ tenantId, eventType, payload })
      ▼
automation_events (pending)
      │
      │  worker tick (cron → /api/public/hooks/automation-tick)
      ▼
Engine  ── loads enabled rules for (tenant, event_type)
      │
      │  evaluate conditions (AND, path/op/value)
      ▼
Actions  ── resolved to a provider via the registry
      │
      ▼
automation_executions (audit + retries)
```

## Emitting events

From any client or server code:

```ts
import { emitAutomationEvent, AUTOMATION_EVENTS } from "@/lib/automation";

await emitAutomationEvent({
  data: {
    tenantId,
    eventType: AUTOMATION_EVENTS.FeeOverdue,
    sourceModule: "fees",
    sourceId: invoice.id,
    payload: { student_id, amount, days_overdue: 3 },
  },
});
```

The call is asynchronous relative to the domain workflow — it only inserts a
pending row. The worker picks it up on the next tick.

## Rules

Stored in `automation_rules`. Shape:

```json
{
  "event_type": "fee.overdue",
  "conditions": [
    { "path": "days_overdue", "op": "gte", "value": 3 },
    { "path": "amount", "op": "gt", "value": 0 }
  ],
  "actions": [
    {
      "type": "notification.create",
      "params": { "title": "Fee overdue", "body": "…" },
      "max_attempts": 3,
      "dedupe_key": "fee-overdue-{{payload.invoice_id}}"
    }
  ],
  "enabled": true,
  "priority": 100
}
```

## Providers

- `mock` — accepts anything, always succeeds. Default fallback.
- `notification.log` — writes to `notifications`. Default for `notification.create`.

Register a new provider (WhatsApp, Email, SMS, Webhook, …):

```ts
import { registerProvider } from "@/lib/automation/providers";
registerProvider({
  key: "whatsapp.meta",
  handles: ["notification.whatsapp"],
  async dispatch(ctx) { /* … */ return { ok: true, provider: "whatsapp.meta" }; },
});
```

Secrets belong in `add_secret`, never in `automation_provider_configs.config`.

## AI extension points

`src/lib/automation/ai/` exposes `AiProvider` with capabilities:
`personalized_message`, `report_summary`, `parent_notification`,
`owner_summary`, `question_answer`. No provider is registered by default —
the engine works without AI. A future Gemini/Lovable AI provider registers
via `registerAiProvider` and is invoked through the `ai.generate` action.

## Worker

`src/routes/api/public/hooks/automation-tick` — POST with the Supabase anon
key in the `apikey` header. Wire pg_cron to hit it every minute. Two passes:

1. `processPendingEvents` — drains new events.
2. `processDueRetries` — retries failed actions with 30s → 2m → 10m backoff.

## Guarantees

- **Tenant isolation** — RLS on all four tables; emit path verifies membership.
- **No secret leakage** — provider configs store only `secret_ref` names.
- **Deduplication** — `automation_executions.dedupe_key` unique per tenant.
- **Audit** — every action produces one execution row with duration + error.
- **Non-blocking** — business workflows never wait on rule evaluation.
