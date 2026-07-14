
-- Policy kinds
DO $$ BEGIN
  CREATE TYPE public.policy_kind AS ENUM (
    'terms','privacy','refund','fee','conduct','leave','medical'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- policy_documents: versioned CMS pages per tenant + kind
CREATE TABLE IF NOT EXISTS public.policy_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind public.policy_kind NOT NULL,
  version integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  body_md text NOT NULL DEFAULT '',
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kind, version)
);

CREATE INDEX IF NOT EXISTS idx_policy_documents_tenant_kind
  ON public.policy_documents(tenant_id, kind, is_published, version DESC);

GRANT SELECT ON public.policy_documents TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.policy_documents TO authenticated;
GRANT ALL ON public.policy_documents TO service_role;

ALTER TABLE public.policy_documents ENABLE ROW LEVEL SECURITY;

-- Public can read only published rows
CREATE POLICY "policy_docs_public_read_published"
  ON public.policy_documents FOR SELECT
  USING (is_published = true);

-- Owners / platform admins can read all versions in their tenant
CREATE POLICY "policy_docs_owner_read_all"
  ON public.policy_documents FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_owner(auth.uid(), tenant_id)
    OR public.is_platform_admin(auth.uid())
  );

-- Owners / platform admins can insert
CREATE POLICY "policy_docs_owner_insert"
  ON public.policy_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_tenant_owner(auth.uid(), tenant_id)
    OR public.is_platform_admin(auth.uid())
  );

-- Owners / platform admins can update
CREATE POLICY "policy_docs_owner_update"
  ON public.policy_documents FOR UPDATE
  TO authenticated
  USING (
    public.is_tenant_owner(auth.uid(), tenant_id)
    OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    public.is_tenant_owner(auth.uid(), tenant_id)
    OR public.is_platform_admin(auth.uid())
  );

-- Owners / platform admins can delete
CREATE POLICY "policy_docs_owner_delete"
  ON public.policy_documents FOR DELETE
  TO authenticated
  USING (
    public.is_tenant_owner(auth.uid(), tenant_id)
    OR public.is_platform_admin(auth.uid())
  );

CREATE TRIGGER trg_policy_documents_touch
  BEFORE UPDATE ON public.policy_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Track policy acceptances on registrations (append-only jsonb array)
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS policy_acceptances jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Extend get_public_academy_bundle to also include latest published policies
CREATE OR REPLACE FUNCTION public.get_public_academy_bundle(_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant public.tenants%ROWTYPE;
  v_config public.mc_website_config%ROWTYPE;
  result JSONB;
BEGIN
  SELECT * INTO v_tenant FROM public.tenants
    WHERE slug = _slug OR custom_domain = _slug
    LIMIT 1;

  IF v_tenant.id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_config FROM public.mc_website_config WHERE tenant_id = v_tenant.id;

  result := jsonb_build_object(
    'academy', jsonb_build_object(
      'id', v_tenant.id, 'slug', v_tenant.slug,
      'name', v_tenant.name, 'custom_domain', v_tenant.custom_domain
    ),
    'config', COALESCE(to_jsonb(v_config), jsonb_build_object(
      'theme','modern','is_published',true,
      'widgets','[]'::jsonb,'hero','{}'::jsonb,'seo','{}'::jsonb
    )),
    'upcoming_matches', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'scheduled_date', m.scheduled_date,
        'team_a_id', m.team_a_id, 'team_b_id', m.team_b_id,
        'venue', m.venue, 'format', m.format
      ) ORDER BY m.scheduled_date ASC)
      FROM public.mc_matches m
      WHERE m.tenant_id = v_tenant.id
        AND m.status IN ('scheduled','live')
        AND (m.scheduled_date IS NULL OR m.scheduled_date >= now() - interval '1 day')
      LIMIT 10
    ), '[]'::jsonb),
    'recent_results', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'scheduled_date', m.scheduled_date,
        'team_a_id', m.team_a_id, 'team_b_id', m.team_b_id,
        'result', m.result, 'winner_team', m.winner_team
      ) ORDER BY m.scheduled_date DESC)
      FROM public.mc_matches m
      WHERE m.tenant_id = v_tenant.id AND m.status = 'finalized'
      LIMIT 10
    ), '[]'::jsonb),
    'academy_records', COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.record_type)
      FROM public.mc_academy_records r WHERE r.tenant_id = v_tenant.id LIMIT 50
    ), '[]'::jsonb),
    'hall_of_fame', COALESCE((
      SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at DESC)
      FROM public.mc_hall_of_fame h WHERE h.tenant_id = v_tenant.id LIMIT 20
    ), '[]'::jsonb),
    'recognitions', COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC)
      FROM public.mc_recognitions r
      WHERE r.tenant_id = v_tenant.id AND r.status = 'published' LIMIT 20
    ), '[]'::jsonb),
    'policies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'kind', p.kind, 'version', p.version, 'title', p.title,
        'body_md', p.body_md, 'published_at', p.published_at
      ) ORDER BY p.kind)
      FROM public.policy_documents p
      WHERE p.tenant_id = v_tenant.id
        AND p.is_published = true
        AND p.version = (
          SELECT MAX(p2.version) FROM public.policy_documents p2
          WHERE p2.tenant_id = p.tenant_id AND p2.kind = p.kind AND p2.is_published = true
        )
    ), '[]'::jsonb)
  );
  RETURN result;
END;
$function$;
