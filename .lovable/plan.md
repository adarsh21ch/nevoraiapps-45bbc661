# Phase 6 — Coach & Staff Operations

Phase 6 is huge (18 parts). I want to confirm scope and sequencing before I ship, because a single-turn "everything at once" build will be low-quality and hard to review. Everything below EXTENDS what exists — no rewrites of attendance, students, Match Center, automation, notifications, or the dashboard shell.

## Current state (verified from code)

- `user_roles` table + `has_role()` / `current_role()` RPCs already exist.
- `usePermissions()` collapses everything to `owner | admin | platform_admin | student`. There is no `coach` role wired end-to-end yet — `profiles.role` is still `owner | coach` legacy, and the UI maps `coach → admin`.
- Attendance, batches, students, Match Center, tournaments, automation, push, notifications, communications, dashboard shell — all shipped and reused as-is.
- No invitation flow exists. No staff management screen. No coach-scoped dashboard, batch view, or activity feed.

## Proposed sequencing (3 chunks, one turn each)

I recommend shipping in 3 chunks so each turn stays reviewable. Ship order optimizes for the critical path: **role foundation → staff mgmt → coach surfaces**.

### Chunk A — Role foundation + RLS (this turn if you approve)

Database:
- Extend `app_role` enum with `coach`, `assistant_coach`, `head_coach`, `staff`.
- `coach_assignments` table (coach_id, tenant_id, batch_id, role, assigned_at, active) with RLS + GRANTs.
- `staff_invitations` table (tenant_id, email, phone, role, token, expires_at, accepted_at, invited_by) with RLS + GRANTs.
- `staff_activity_log` view over existing `platform_audit_log` scoped to tenant.
- Helper RPCs: `is_coach_for_batch(_batch_id)`, `list_my_batches()`, `accept_invitation(_token, _password)`.
- Attendance/session RLS: add policy `coach can write iff is_coach_for_batch(batch_id)`.

Client:
- Extend `PermissionFeature` union with `canManageStaff`, `canInviteCoach`, `canViewCoachAnalytics`, `canManageAssignedBatches`.
- Update `RULES` map and role normalization to recognize `coach` / `head_coach` / `assistant_coach` distinctly.
- No UI yet — just the plumbing.

### Chunk B — Staff Management + Invitations (next turn)

- `dashboard.staff.tsx` — list/invite/disable/reset/remove; owner+admin only.
- Invitation server functions (`createServerFn` under `src/lib/staff/`): `inviteStaff`, `revokeInvitation`, `resendInvitation`, `acceptInvitation`, `disableStaff`.
- `auth.tsx` extended to accept `?invite=<token>` and route through `acceptInvitation`.
- Coach assignment UI inside `dashboard.batches.tsx` (assign multiple coaches per batch).
- Staff activity feed component reusing `AuditFeed`.
- Notifications: `staff.invited`, `staff.accepted`, `staff.disabled` automation events wired to existing engine.

### Chunk C — Coach surfaces + analytics (turn after)

- New routes under `_authenticated` (or `dashboard.*` since that's the pattern):
  - `dashboard.coach.index.tsx` — coach dashboard (Today's Sessions, Attendance Pending, Upcoming Matches, Announcements, Quick Actions).
  - `dashboard.coach.batches.tsx` — my batches.
  - `dashboard.coach.sessions.tsx` — session mgmt (session objective/duration/weather/equipment/notes/completion).
  - `dashboard.coach.players.$id.tsx` — player profile with coach-only private notes.
  - `dashboard.coach.analytics.tsx`.
- Reuse existing components: `AttendanceGrid`, `StudentProfilePanel`, `NotificationCenter`, `ModuleHeader`, `BottomNav`.
- `mc_coach_remarks` already exists — reuse for private notes.
- New: `coach_session_notes` table for session metadata (objective, weather, equipment, completion).
- Nav-config entry that only renders when `role in {coach, head_coach, assistant_coach, owner, admin}`.
- Communication: coach-scoped composer that emits automation events (`coach.announcement`, `session.cancelled`, `session.shifted`) — no direct provider calls.

## Not in this phase (explicitly)

- Payment gateway, subscription self-serve, AI, CRM, marketing — deferred as instructed.
- OTP-based invitation (only temporary-password + email/mobile invite this phase; OTP is a follow-up).
- Native Coach app — everything stays inside AcademyOS.

## Questions before I start Chunk A

1. **Route prefix for coach surfaces**: keep everything under `dashboard.coach.*` (single app, role-gated), or introduce a top-level `/coach/*` alias like the existing `/parent` and `/student` shells? Recommendation: `dashboard.coach.*` — matches your "no separate Coach app" rule and reuses `DashboardShell`.
2. **`profiles.role` legacy column**: leave it (still `owner|coach`) and drive everything off `user_roles`? Recommendation: yes — `user_roles` becomes the source of truth, `profiles.role` stays for backward compat.
3. **Approve shipping Chunk A now** (role foundation + RLS + migrations only, no UI)? Or would you rather I attempt all three chunks in this turn?

Once you confirm, I'll start with Chunk A: one migration + permission-hook extension + type updates + typecheck.
