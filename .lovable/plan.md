
# Phase 03.3 — Enrollment & Admissions OS

## Architecture review & challenge

The brief asks for a Lead pipeline with ~10 stages (Lead → Contacted → Counselling scheduled → Counselling done → Trial scheduled → Trial done → Waiting decision → Approved → Rejected → Registration pending → Student created). Building this literally would create three parallel state machines (`leads.status`, `registrations.status`, `students.status`) with duplicated audit trails and drag-drop UI that admins won't use on a phone.

**Simpler operational flow (recommended):**

1. Collapse to **one linear pipeline** on `leads`: `new → contacted → counselling → trial → decision → approved | rejected → converted`. Registration/Student rows are outcomes, not stages. When approved, we deep-link into the existing `/register` form pre-filled from the lead — no duplicate data entry. When registration is approved, existing `approve_registration` RPC already creates the student. We just chain the lead to it.
2. Keep counselling / trial as **scheduled events on the lead row** (`counselling_at`, `trial_at`, `trial_rating`, `trial_remarks`, `assigned_to`) — no new tables. A trial is just a lead in stage=`trial`. Reuses lead RLS.
3. **One audit table** `admission_timeline` (append-only) captures every transition + actor + remark, feeding the checklist, timeline, and notifications. Player Timeline already exists — we post-create link the admission timeline to the student.
4. **Convert-to-Registration** is a single button that opens `/register?lead=<id>` with a `lead_id` prefill query. `submit_registration` gains an optional `_lead_id` argument; on success the lead moves to `converted` automatically inside the RPC. No new endpoint.
5. **Admission Checklist** is a derived view (`admission_progress` DB view or client memo) — reads existing `leads`, `registrations`, `students`, `mc_parent_links`, `attendance_marks`. Zero new writes.

This cuts the phase from ~10 new components + 3 new tables to **2 new components + 1 new table + 1 extended RPC**, while satisfying every stated requirement.

**Role model (locked in):** Owner sees everything; Admin sees lead pipeline, trials, registrations approval, students, attendance, match center — but the existing nav already hides billing/fees/subscription/reports from admins. Confirmed by `src/lib/nav-config.ts`. Only tightening needed: hide "Recorded payment" fields on registration drawer for admins, and add role gate on `/dashboard/billing`, `/dashboard/fees`, `/dashboard/fee-plans`, `/dashboard/subscription`, `/dashboard/reports` routes.

## Database changes (1 migration)

```sql
-- 1. Extend leads with pipeline fields
ALTER TABLE public.leads
  ADD COLUMN pipeline_stage text NOT NULL DEFAULT 'new'
    CHECK (pipeline_stage IN ('new','contacted','counselling','trial',
                              'decision','approved','rejected','converted')),
  ADD COLUMN assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN counselling_at timestamptz,
  ADD COLUMN trial_at timestamptz,
  ADD COLUMN trial_rating int CHECK (trial_rating BETWEEN 1 AND 5),
  ADD COLUMN trial_remarks text,
  ADD COLUMN converted_registration_id uuid REFERENCES public.registrations(id) ON DELETE SET NULL,
  ADD COLUMN converted_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;
CREATE INDEX leads_tenant_pipeline_idx ON public.leads(tenant_id, pipeline_stage);

-- 2. Admission timeline (append-only)
CREATE TABLE public.admission_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  registration_id uuid REFERENCES public.registrations(id) ON DELETE SET NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  event_type text NOT NULL,          -- stage_changed, remark, trial_scheduled, ...
  from_stage text,
  to_stage text,
  remark text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admission_timeline TO authenticated;
GRANT ALL ON public.admission_timeline TO service_role;
ALTER TABLE public.admission_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant scope timeline" ON public.admission_timeline
  FOR ALL TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()))
  WITH CHECK (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));

-- 3. RPC: advance_lead_stage(lead, new_stage, remark) — writes lead + timeline atomically
-- 4. Extend submit_registration with _lead_id, auto-close lead on convert
-- 5. Extend approve_registration to link lead → student and append timeline row
```

## Files changed

- **New**
  - `src/routes/dashboard.leads.tsx` — replace inbox with pipeline board (column-per-stage on desktop, stage-filter chip strip on mobile). Same file, redesigned in place — count against reuse.
  - `src/components/dashboard/LeadCard.tsx` — quick actions (call, WhatsApp, schedule trial, advance, convert).
  - `src/components/dashboard/TrialDrawer.tsx` — date/rating/remarks form on a lead in stage=`trial`.
  - `src/components/dashboard/AdmissionChecklist.tsx` — reused on lead drawer + student detail.
  - `src/lib/admissions.ts` — queries (`leadsPipelineQuery`, `admissionTimelineQuery`) + mutations (`advanceLeadStage`, `scheduleTrial`, `recordTrial`, `convertLeadToRegistration`).
- **Extended**
  - `src/routes/register.tsx` — reads `?lead=<id>`, pre-fills name/phone/whatsapp/guardian from lead; passes `_lead_id` to `submit_registration`.
  - `src/routes/dashboard.registrations.tsx` — after `approve_registration` also links back to lead + posts admission timeline row.
  - `src/routes/dashboard.students.$id.tsx` — inject Admission Timeline section (reads `admission_timeline` by student_id).
  - `src/routes/dashboard.tsx` + `src/lib/nav-config.ts` — role-gate billing/fees/subscription/reports routes to owner-only (route-level `beforeLoad` redirect + already-correct nav filter).
  - `src/components/dashboard/GlobalSearch.tsx` — extend existing search (or create if absent) to cover leads.player_id/phone/email.

## Reuse

- Components: `Card/Button/Badge/Drawer/Tabs/Textarea`, `BulkImportLeads`, `PersonAvatar`, `SiteHeader`, existing registration form, `NotificationBell`.
- Queries/hooks: `useDashboard`, `dashboard-queries`, `feePlansQuery`, `batchesQuery`, existing `students`/`registrations`/`leads` reads.
- RPCs: `submit_registration` (extended, backward-compatible), `approve_registration` (extended), `publish_notification`, `is_tenant_member`, `is_tenant_owner`.

## Notifications

On stage advance to `trial`, `approved`, `converted`: publish via existing `publish_notification` RPC to the assigned admin (`assigned_to`) and to all tenant owners for approvals. No new channel wiring.

## Search

Extend the global search box already in the dashboard header (`GlobalSearch`) to also query `leads` by name/phone/email/player_id (via converted_student_id join). Single debounced React Query; no new endpoint.

## Security

- New RPC `advance_lead_stage` = `SECURITY DEFINER`, verifies `is_tenant_member`.
- `admission_timeline` INSERT gated by same tenant-membership check.
- Route-level owner gate on `/dashboard/billing`, `/dashboard/fees`, `/dashboard/fee-plans`, `/dashboard/subscription`, `/dashboard/reports` (`beforeLoad` throws redirect to `/dashboard` when role != owner).
- No change to existing RLS.

## Performance

- Reuses cached `dashboardStudentsQuery` / `batchesQuery`.
- Pipeline uses a single `leads` query filtered client-side by stage — <1000 rows per tenant realistic; still adds `tenant_id, pipeline_stage` index.
- Admission timeline paginated to last 50 by default.

## Out of scope (defer)

- Drag-and-drop between columns (chip-tap advance covers it in one click on mobile).
- Trial photo/video upload (uses existing student-photo capability post-conversion).
- Multi-child family accounts (parent portal already handles siblings).

## Acceptance

- Owner can see full pipeline + convert lead → registration → approve → student without duplicate typing.
- Admin sees the same but zero billing UI anywhere.
- Every stage transition appears in admission_timeline + student timeline after conversion.
- Global search finds a person by phone across lead/registration/student.
