
-- ============================================================
-- Phase 03.4 — Communication & Broadcast OS
-- ============================================================

-- 1. comm_templates
CREATE TABLE public.comm_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category notification_category NOT NULL DEFAULT 'system',
  title_template text NOT NULL,
  body_template text,
  default_channels notification_channel[] NOT NULL DEFAULT ARRAY['in_app']::notification_channel[],
  variables_used jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comm_templates TO authenticated;
GRANT ALL ON public.comm_templates TO service_role;
ALTER TABLE public.comm_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comm_templates tenant read"
  ON public.comm_templates FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "comm_templates tenant write"
  ON public.comm_templates FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));
CREATE TRIGGER comm_templates_touch BEFORE UPDATE ON public.comm_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX comm_templates_tenant_idx ON public.comm_templates(tenant_id);

-- 2. comm_campaigns
CREATE TABLE public.comm_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  template_id uuid REFERENCES public.comm_templates(id) ON DELETE SET NULL,
  category notification_category NOT NULL DEFAULT 'system',
  message_type text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text,
  deep_link text,
  priority notification_priority NOT NULL DEFAULT 'normal',
  channels notification_channel[] NOT NULL DEFAULT ARRAY['in_app']::notification_channel[],
  audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft', -- draft|scheduled|sending|sent|failed|cancelled
  scheduled_for timestamptz,
  sent_at timestamptz,
  recipient_count int NOT NULL DEFAULT 0,
  delivered_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence_rule text,
  last_error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comm_campaigns TO authenticated;
GRANT ALL ON public.comm_campaigns TO service_role;
ALTER TABLE public.comm_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comm_campaigns tenant read"
  ON public.comm_campaigns FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "comm_campaigns tenant write"
  ON public.comm_campaigns FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));
CREATE TRIGGER comm_campaigns_touch BEFORE UPDATE ON public.comm_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX comm_campaigns_tenant_status_idx ON public.comm_campaigns(tenant_id, status);
CREATE INDEX comm_campaigns_scheduled_idx ON public.comm_campaigns(status, scheduled_for) WHERE status = 'scheduled';

-- 3. comm_campaign_recipients (audit trail)
CREATE TABLE public.comm_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.comm_campaigns(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL,
  notification_id uuid,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, recipient_user_id)
);
GRANT SELECT ON public.comm_campaign_recipients TO authenticated;
GRANT ALL ON public.comm_campaign_recipients TO service_role;
ALTER TABLE public.comm_campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comm_campaign_recipients tenant read"
  ON public.comm_campaign_recipients FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));
CREATE INDEX comm_campaign_recipients_campaign_idx ON public.comm_campaign_recipients(campaign_id);

-- 4. notifications.campaign_id link
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS campaign_id uuid;
CREATE INDEX IF NOT EXISTS notifications_campaign_idx ON public.notifications(campaign_id) WHERE campaign_id IS NOT NULL;

-- 5. Extend publish_notification with optional _campaign_id (additive default)
CREATE OR REPLACE FUNCTION public.publish_notification(
  _recipient_user_id uuid,
  _category notification_category,
  _type text,
  _title text,
  _body text DEFAULT NULL,
  _deep_link text DEFAULT NULL,
  _priority notification_priority DEFAULT 'normal',
  _payload jsonb DEFAULT '{}'::jsonb,
  _tenant_id uuid DEFAULT NULL,
  _dedupe_key text DEFAULT NULL,
  _expires_at timestamptz DEFAULT NULL,
  _channels notification_channel[] DEFAULT ARRAY['in_app'::notification_channel],
  _campaign_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  actor uuid := auth.uid();
  authorized boolean := false;
  existing_id uuid;
  new_id uuid;
  ch public.notification_channel;
  pref_enabled boolean;
BEGIN
  IF _recipient_user_id IS NULL THEN RAISE EXCEPTION 'recipient required'; END IF;
  IF _title IS NULL OR btrim(_title) = '' THEN RAISE EXCEPTION 'title required'; END IF;

  IF actor IS NULL THEN authorized := true;
  ELSIF public.is_platform_admin(actor) THEN authorized := true;
  ELSIF actor = _recipient_user_id THEN authorized := true;
  ELSIF _tenant_id IS NOT NULL AND public.is_tenant_member(actor, _tenant_id) THEN authorized := true;
  END IF;
  IF NOT authorized THEN RAISE EXCEPTION 'Not authorized to publish notification'; END IF;

  IF _dedupe_key IS NOT NULL THEN
    SELECT id INTO existing_id FROM public.notifications
      WHERE recipient_user_id = _recipient_user_id AND dedupe_key = _dedupe_key;
    IF existing_id IS NOT NULL THEN RETURN existing_id; END IF;
  END IF;

  INSERT INTO public.notifications
    (recipient_user_id, tenant_id, category, type, title, body, deep_link,
     priority, payload, dedupe_key, expires_at, created_by, campaign_id)
  VALUES
    (_recipient_user_id, _tenant_id, _category, _type, _title, _body, _deep_link,
     _priority, COALESCE(_payload, '{}'::jsonb), _dedupe_key, _expires_at, actor, _campaign_id)
  RETURNING id INTO new_id;

  FOREACH ch IN ARRAY COALESCE(_channels, ARRAY['in_app']::public.notification_channel[]) LOOP
    SELECT enabled INTO pref_enabled FROM public.notification_preferences
      WHERE user_id = _recipient_user_id AND category = _category AND channel = ch;
    IF pref_enabled IS FALSE THEN
      INSERT INTO public.notification_deliveries(notification_id, channel, status)
      VALUES (new_id, ch, 'skipped');
      CONTINUE;
    END IF;
    IF ch = 'in_app' THEN
      INSERT INTO public.notification_deliveries(notification_id, channel, status, delivered_at)
      VALUES (new_id, ch, 'delivered', now());
    ELSE
      INSERT INTO public.notification_deliveries(notification_id, channel, status)
      VALUES (new_id, ch, 'queued');
      INSERT INTO public.notification_outbox(notification_id, channel, payload)
      VALUES (new_id, ch, jsonb_build_object('title', _title, 'body', _body, 'deep_link', _deep_link));
    END IF;
  END LOOP;

  RETURN new_id;
END;
$function$;

-- 6. Template preview render (client-side helper via RPC)
CREATE OR REPLACE FUNCTION public.render_template_preview(_title text, _body text, _vars jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  k text; v text; rendered_title text := COALESCE(_title,''); rendered_body text := COALESCE(_body,'');
BEGIN
  IF _vars IS NULL THEN
    RETURN jsonb_build_object('title', rendered_title, 'body', rendered_body);
  END IF;
  FOR k, v IN SELECT key, value FROM jsonb_each_text(_vars) LOOP
    rendered_title := replace(rendered_title, '{{' || k || '}}', COALESCE(v,''));
    rendered_body := replace(rendered_body, '{{' || k || '}}', COALESCE(v,''));
  END LOOP;
  RETURN jsonb_build_object('title', rendered_title, 'body', rendered_body);
END; $$;

-- 7. schedule / cancel
CREATE OR REPLACE FUNCTION public.schedule_campaign(_campaign_id uuid, _when timestamptz)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE c public.comm_campaigns%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.comm_campaigns WHERE id = _campaign_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found'; END IF;
  IF NOT (public.is_tenant_member(auth.uid(), c.tenant_id) OR public.is_platform_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF c.status NOT IN ('draft','scheduled') THEN
    RAISE EXCEPTION 'Only draft/scheduled campaigns can be (re)scheduled';
  END IF;
  UPDATE public.comm_campaigns
     SET status = 'scheduled', scheduled_for = _when, last_error = NULL
   WHERE id = _campaign_id;
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_campaign(_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE c public.comm_campaigns%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.comm_campaigns WHERE id = _campaign_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found'; END IF;
  IF NOT (public.is_tenant_member(auth.uid(), c.tenant_id) OR public.is_platform_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF c.status NOT IN ('draft','scheduled') THEN
    RAISE EXCEPTION 'Only draft/scheduled campaigns can be cancelled';
  END IF;
  UPDATE public.comm_campaigns SET status = 'cancelled' WHERE id = _campaign_id;
END; $$;

-- 8. send_campaign — resolves audience and fans out via publish_notification
CREATE OR REPLACE FUNCTION public.send_campaign(_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  c public.comm_campaigns%ROWTYPE;
  aud jsonb;
  aud_kind text;
  batch_ids uuid[];
  student_ids uuid[];
  parent_ids uuid[];
  admin_ids uuid[];
  include_students boolean;
  include_parents boolean;
  include_admins boolean;
  rec_uid uuid;
  rec_name text;
  rec_student_id uuid;
  rendered_title text;
  rendered_body text;
  notif_id uuid;
  total int := 0; delivered int := 0; failed int := 0;
  var_map jsonb;
  academy_name text;
BEGIN
  SELECT * INTO c FROM public.comm_campaigns WHERE id = _campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found'; END IF;
  IF NOT (public.is_tenant_member(auth.uid(), c.tenant_id) OR public.is_platform_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF c.category = 'billing' AND NOT (public.is_tenant_owner(auth.uid(), c.tenant_id) OR public.is_platform_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Only owners can send billing campaigns';
  END IF;
  IF c.status NOT IN ('draft','scheduled','failed') THEN
    RAISE EXCEPTION 'Campaign already % — cannot send', c.status;
  END IF;

  UPDATE public.comm_campaigns SET status = 'sending', last_error = NULL WHERE id = _campaign_id;

  SELECT name INTO academy_name FROM public.tenants WHERE id = c.tenant_id;
  aud := COALESCE(c.audience, '{}'::jsonb);
  aud_kind := COALESCE(aud->>'kind', 'all');
  batch_ids := COALESCE((SELECT array_agg((v)::uuid) FROM jsonb_array_elements_text(COALESCE(aud->'batch_ids','[]'::jsonb)) v), '{}'::uuid[]);
  student_ids := COALESCE((SELECT array_agg((v)::uuid) FROM jsonb_array_elements_text(COALESCE(aud->'student_ids','[]'::jsonb)) v), '{}'::uuid[]);
  parent_ids := COALESCE((SELECT array_agg((v)::uuid) FROM jsonb_array_elements_text(COALESCE(aud->'parent_ids','[]'::jsonb)) v), '{}'::uuid[]);
  admin_ids := COALESCE((SELECT array_agg((v)::uuid) FROM jsonb_array_elements_text(COALESCE(aud->'admin_ids','[]'::jsonb)) v), '{}'::uuid[]);
  include_students := COALESCE((aud->>'include_students')::boolean, aud_kind IN ('all','students'));
  include_parents  := COALESCE((aud->>'include_parents')::boolean,  aud_kind IN ('all','parents'));
  include_admins   := COALESCE((aud->>'include_admins')::boolean,   aud_kind IN ('all','admins'));

  -- Resolve into a temp set of (user_id, student_id, name)
  CREATE TEMP TABLE _campaign_targets (
    user_id uuid PRIMARY KEY,
    student_id uuid,
    name text
  ) ON COMMIT DROP;

  -- Students in tenant (optionally batch/id filtered)
  IF include_students OR aud_kind = 'students' OR array_length(student_ids,1) IS NOT NULL THEN
    INSERT INTO _campaign_targets(user_id, student_id, name)
    SELECT DISTINCT s.user_id, s.id, s.name
      FROM public.students s
     WHERE s.tenant_id = c.tenant_id
       AND s.user_id IS NOT NULL
       AND s.archived_at IS NULL
       AND (array_length(batch_ids,1) IS NULL OR s.batch_id = ANY(batch_ids))
       AND (array_length(student_ids,1) IS NULL OR s.id = ANY(student_ids))
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Parents linked to tenant students
  IF include_parents OR aud_kind = 'parents' OR array_length(parent_ids,1) IS NOT NULL THEN
    INSERT INTO _campaign_targets(user_id, student_id, name)
    SELECT DISTINCT l.parent_user_id, l.student_id, s.name
      FROM public.mc_parent_links l
      JOIN public.students s ON s.id = l.student_id
     WHERE s.tenant_id = c.tenant_id
       AND (array_length(batch_ids,1) IS NULL OR s.batch_id = ANY(batch_ids))
       AND (array_length(student_ids,1) IS NULL OR s.id = ANY(student_ids))
       AND (array_length(parent_ids,1) IS NULL OR l.parent_user_id = ANY(parent_ids))
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Tenant staff (owners + admins)
  IF include_admins OR aud_kind = 'admins' OR array_length(admin_ids,1) IS NOT NULL THEN
    INSERT INTO _campaign_targets(user_id, student_id, name)
    SELECT DISTINCT p.user_id, NULL, NULL
      FROM public.profiles p
     WHERE p.tenant_id = c.tenant_id
       AND p.role IN ('owner','admin','coach','staff')
       AND (array_length(admin_ids,1) IS NULL OR p.user_id = ANY(admin_ids))
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Fan out
  FOR rec_uid, rec_student_id, rec_name IN SELECT user_id, student_id, name FROM _campaign_targets LOOP
    total := total + 1;
    BEGIN
      var_map := jsonb_build_object(
        'student_name', COALESCE(rec_name, ''),
        'academy', COALESCE(academy_name, ''),
        'date', to_char(now(), 'DD Mon YYYY')
      );
      rendered_title := c.title;
      rendered_body := COALESCE(c.body, '');
      SELECT (r->>'title'), (r->>'body') INTO rendered_title, rendered_body
        FROM public.render_template_preview(c.title, c.body, var_map) r;

      notif_id := public.publish_notification(
        _recipient_user_id := rec_uid,
        _category := c.category,
        _type := c.message_type,
        _title := rendered_title,
        _body := rendered_body,
        _deep_link := c.deep_link,
        _priority := c.priority,
        _payload := jsonb_build_object('campaign_id', c.id, 'student_id', rec_student_id),
        _tenant_id := c.tenant_id,
        _dedupe_key := NULL,
        _expires_at := NULL,
        _channels := c.channels,
        _campaign_id := c.id
      );
      INSERT INTO public.comm_campaign_recipients(tenant_id, campaign_id, recipient_user_id, notification_id)
      VALUES (c.tenant_id, c.id, rec_uid, notif_id)
      ON CONFLICT DO NOTHING;
      delivered := delivered + 1;
    EXCEPTION WHEN OTHERS THEN
      failed := failed + 1;
    END;
  END LOOP;

  UPDATE public.comm_campaigns
     SET status = CASE WHEN failed > 0 AND delivered = 0 THEN 'failed' ELSE 'sent' END,
         sent_at = now(),
         recipient_count = total,
         delivered_count = delivered,
         failed_count = failed
   WHERE id = _campaign_id;

  RETURN jsonb_build_object('total', total, 'delivered', delivered, 'failed', failed);
END; $$;
