# NevorAI Tool Catalog

Every tool the AI can invoke. Read tools return data; write tools mutate and
require explicit user confirmation via the orchestrator.

All tools reuse existing helpers — no new business logic, no raw
`supabase.from(...)` outside the helper it delegates to.

| Tool | Purpose | Allowed roles | Required feature | Required plan | Confirmation | Underlying helper | Write-capable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `dashboard_summary` | Top-level tenant KPIs | owner, admin | — | — | no | `dashboard-queries#fetchKpis` | no |
| `finance_summary` | Billing KPIs (collected, outstanding, overdue) | owner, admin | — | — | no | `billing#fetchBillingKpis` | no |
| `fee_summary` | Fee status for a student (role-scoped) | owner, admin, parent, student | — | — | no | `dashboard-queries#fetchStudent`, `fees#studentDue` | no |
| `invoice_details` | Single invoice + lines + payments | owner, admin | — | — | no | `billing#fetchInvoice`, `fetchInvoiceLines`, `fetchPaymentsForInvoice` | no |
| `attendance_summary` | Today's attendance snapshot | owner, admin, coach | — | — | no | `attendance/queries#fetchAttendanceToday` | no |
| `player_profile` | Student profile (role-scoped) | owner, admin, coach, parent, student | — | — | no | `dashboard-queries#fetchStudent` | no |
| `admissions_summary` | Pipeline counts per stage | owner, admin | — | — | no | `admissions#leadsPipelineQuery` | no |
| `communications_summary` | Recent broadcasts / campaigns | owner, admin | — | — | no | `communications#campaignsQueryOptions` | no |
| `automation_status` | Recent automation executions | owner, admin | — | — | no | existing `automation_executions` (RLS) | no |
| `notifications_summary` | Caller's recent notifications | all | — | — | no | existing `notifications` (RLS) | no |
| `reports_summary` | Revenue trend + engagement signals | owner, admin | — | — | no | `dashboard-queries#fetchDashboardInsights` | no |
| `subscription_status` | Current subscription state | owner, admin | — | — | no | `tenants` (subscription columns) | no |
| `founder_intelligence` | Platform-wide executive KPIs | platform_admin | — | — | no | `founder-intelligence#fetchIntelligenceSnapshot` | no |
| `send_fee_reminder` | Queue a fee reminder (owner still dispatches) | owner, admin | — | — | **yes** | `reminder_logs` insert (same surface as fee-reminders cron) | yes |

## Response envelope

```ts
type ToolSuccess = {
  ok: true;
  title?: string;
  summary?: string;
  data: unknown;                // machine-readable payload
  structured_data?: unknown;    // optional chart/card structure
  recommended_actions?: Array<{ id: string; label: string; href?: string; tool?: string }>;
  citations?: string[];         // helpers that produced the data
};

type ToolFailure = {
  ok: false;
  reason: "forbidden" | "invalid_input" | "not_found"
        | "feature_unavailable" | "subscription_required"
        | "tool_unavailable" | "timeout" | "provider_failure" | "internal";
  code?: string;
  message: string;
  feature?: string;
  requiredPlan?: string;
};
```

## Guarantees

* Every tool enforces role via `allowedRoles` and (where relevant) `canUse(ctx)`.
* Every tool inherits registry-level entitlement checks (`requiredFeature`,
  `requiredPlan`) and confirmation gating before `execute` runs.
* Every result flows through the AI event bus (`ai.tool_called` /
  `ai.tool_failed`) so the Automation Engine + analytics sink see it.
* Every tool cites the helper(s) it reused — no direct table access outside
  those helpers.

## Forbidden actions

The AI has **no tool** for any of the following, and no tool may be added
without an explicit product review:

* Deleting records
* Approving payments
* Approving admissions
* Changing subscriptions / plans
* Assigning or changing roles
* Executing SQL, running migrations, or calling `supabaseAdmin` from the
  browser
