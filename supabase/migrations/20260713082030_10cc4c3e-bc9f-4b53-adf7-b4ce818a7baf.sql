
ALTER TABLE public.mc_matches
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid,
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS player_of_match_athlete_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS winning_margin integer,
  ADD COLUMN IF NOT EXISTS winning_margin_type text,
  ADD COLUMN IF NOT EXISTS victory_type text,
  ADD COLUMN IF NOT EXISTS match_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scorecard_generated boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS mc_matches_finalized_idx ON public.mc_matches(tenant_id, finalized_at DESC);

-- Timeline
CREATE TABLE IF NOT EXISTS public.mc_match_timeline (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.mc_matches(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  label text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_match_timeline TO authenticated;
GRANT ALL ON public.mc_match_timeline TO service_role;
ALTER TABLE public.mc_match_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mc_match_timeline tenant members"
  ON public.mc_match_timeline FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS mc_match_timeline_match_idx ON public.mc_match_timeline(match_id, occurred_at);

-- Audit log
CREATE TABLE IF NOT EXISTS public.mc_match_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.mc_matches(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid,
  reason text,
  diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_match_audit_log TO authenticated;
GRANT ALL ON public.mc_match_audit_log TO service_role;
ALTER TABLE public.mc_match_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mc_match_audit_log tenant members"
  ON public.mc_match_audit_log FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS mc_match_audit_log_match_idx ON public.mc_match_audit_log(match_id, created_at DESC);
