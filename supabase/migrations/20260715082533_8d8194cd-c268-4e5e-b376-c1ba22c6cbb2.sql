
-- =====================================================================
-- Phase 4 — Database scaling foundation
-- Index hygiene: add targeted indexes + drop confirmed redundancies
-- =====================================================================

-- ---------- Targeted new indexes ----------

CREATE INDEX IF NOT EXISTS registrations_tenant_created_idx
  ON public.registrations (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS registrations_tenant_status_idx
  ON public.registrations (tenant_id, status);

CREATE INDEX IF NOT EXISTS attendance_marks_tenant_created_active_idx
  ON public.attendance_marks (tenant_id, created_at DESC)
  WHERE superseded_by IS NULL;

CREATE INDEX IF NOT EXISTS students_tenant_active_idx
  ON public.students (tenant_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS platform_audit_target_idx
  ON public.platform_audit_log (tenant_id, target_type, target_id);

-- ---------- Drop confirmed redundant indexes ----------

DROP INDEX IF EXISTS public.mc_ball_events_innings_idx;
DROP INDEX IF EXISTS public.mc_ball_events_innings_over_idx;
DROP INDEX IF EXISTS public.mc_ball_events_match_created_idx;
DROP INDEX IF EXISTS public.mc_ball_events_match_idx;

DROP INDEX IF EXISTS public.mc_innings_match_idx;

DROP INDEX IF EXISTS public.mc_matches_tenant_status_idx;
DROP INDEX IF EXISTS public.mc_matches_team_a_idx;
DROP INDEX IF EXISTS public.mc_matches_team_b_idx;
DROP INDEX IF EXISTS public.mc_matches_tenant_idx;

DROP INDEX IF EXISTS public.mc_match_squads_athlete_idx;
DROP INDEX IF EXISTS public.mc_match_squads_match_idx;
DROP INDEX IF EXISTS public.mc_match_squads_team_idx;

DROP INDEX IF EXISTS public.idx_mc_recognitions_tenant;
DROP INDEX IF EXISTS public.idx_mc_recognitions_status;

DROP INDEX IF EXISTS public.students_tenant_idx;

-- ---------- Refresh planner stats ----------
ANALYZE public.registrations;
ANALYZE public.attendance_marks;
ANALYZE public.students;
ANALYZE public.platform_audit_log;
ANALYZE public.mc_ball_events;
ANALYZE public.mc_innings;
ANALYZE public.mc_matches;
ANALYZE public.mc_match_squads;
ANALYZE public.mc_recognitions;
