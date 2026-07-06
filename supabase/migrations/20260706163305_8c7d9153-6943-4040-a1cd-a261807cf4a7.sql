
DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM ('new','contacted','won','lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  message text,
  source text NOT NULL DEFAULT 'site',
  status public.lead_status NOT NULL DEFAULT 'new',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_tenant_created_idx ON public.leads(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leads_tenant_status_idx ON public.leads(tenant_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant scope leads" ON public.leads FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.leads_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS leads_touch_updated_at ON public.leads;
CREATE TRIGGER leads_touch_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_touch_updated_at();

-- Public enquiry RPC — validates active tenant, inserts as anon safely.
CREATE OR REPLACE FUNCTION public.submit_lead(
  _tenant_id uuid,
  _name text,
  _phone text,
  _message text DEFAULT NULL,
  _source text DEFAULT 'site'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF _name IS NULL OR btrim(_name) = '' THEN RAISE EXCEPTION 'Name is required'; END IF;
  IF _phone IS NULL OR btrim(_phone) = '' THEN RAISE EXCEPTION 'Phone is required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = _tenant_id AND status = 'active') THEN
    RAISE EXCEPTION 'Academy not accepting enquiries';
  END IF;
  INSERT INTO public.leads (tenant_id, name, phone, message, source)
  VALUES (_tenant_id, btrim(_name), btrim(_phone), NULLIF(btrim(_message),''), COALESCE(NULLIF(btrim(_source),''),'site'))
  RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

REVOKE ALL ON FUNCTION public.submit_lead(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_lead(uuid, text, text, text, text) TO anon, authenticated;
