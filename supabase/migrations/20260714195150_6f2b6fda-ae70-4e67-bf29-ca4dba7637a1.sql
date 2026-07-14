-- Phase 03.1: Notifications & Communication Platform
-- + Security fix: drop overly-permissive anon SELECT on tenants (marketing data
--   is already exposed via public.get_public_academy_bundle SECURITY DEFINER).

DROP POLICY IF EXISTS "anon read active tenant marketing cols" ON public.tenants;

-- =============================================================
-- Enums
-- =============================================================
DO $$ BEGIN
  CREATE TYPE public.notification_priority AS ENUM ('low','normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_channel AS ENUM ('in_app','push','email','whatsapp');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_delivery_status AS ENUM ('queued','sent','delivered','failed','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_category AS ENUM (
    'attendance','billing','registration','match','coach','achievement','system'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================
-- notifications
-- =============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL,
  tenant_id uuid,
  category public.notification_category NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  deep_link text,
  priority public.notification_priority NOT NULL DEFAULT 'normal',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text,
  read_at timestamptz,
  archived_at timestamptz,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipient reads own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid() OR public.is_platform_admin(auth.uid()));

CREATE POLICY "recipient updates own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());

-- No INSERT/DELETE policies: writes only via SECURITY DEFINER RPC.

CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
  ON public.notifications (recipient_user_id, archived_at, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications (recipient_user_id, created_at DESC)
  WHERE read_at IS NULL AND archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_uidx
  ON public.notifications (recipient_user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE TRIGGER notifications_touch_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============================================================
-- notification_deliveries
-- =============================================================
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  channel public.notification_channel NOT NULL,
  status public.notification_delivery_status NOT NULL DEFAULT 'queued',
  attempted_at timestamptz,
  delivered_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.notification_deliveries TO service_role;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated/anon → no client access.

CREATE INDEX IF NOT EXISTS notification_deliveries_notif_idx
  ON public.notification_deliveries (notification_id);
CREATE INDEX IF NOT EXISTS notification_deliveries_status_idx
  ON public.notification_deliveries (channel, status);

CREATE TRIGGER notification_deliveries_touch_updated_at
  BEFORE UPDATE ON public.notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============================================================
-- notification_outbox (future push/email/whatsapp workers)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  channel public.notification_channel NOT NULL,
  status public.notification_delivery_status NOT NULL DEFAULT 'queued',
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked_by text,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.notification_outbox TO service_role;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated/anon → no client access.

CREATE INDEX IF NOT EXISTS notification_outbox_pickup_idx
  ON public.notification_outbox (status, scheduled_for)
  WHERE status = 'queued';

CREATE TRIGGER notification_outbox_touch_updated_at
  BEFORE UPDATE ON public.notification_outbox
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============================================================
-- notification_preferences (per-user per-type per-channel opt-in)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category public.notification_category NOT NULL,
  channel public.notification_channel NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category, channel)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user manages own notification preferences"
  ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER notification_preferences_touch_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============================================================
-- RPCs
-- =============================================================

-- Publish a notification (single write path).
CREATE OR REPLACE FUNCTION public.publish_notification(
  _recipient_user_id uuid,
  _category public.notification_category,
  _type text,
  _title text,
  _body text DEFAULT NULL,
  _deep_link text DEFAULT NULL,
  _priority public.notification_priority DEFAULT 'normal',
  _payload jsonb DEFAULT '{}'::jsonb,
  _tenant_id uuid DEFAULT NULL,
  _dedupe_key text DEFAULT NULL,
  _expires_at timestamptz DEFAULT NULL,
  _channels public.notification_channel[] DEFAULT ARRAY['in_app']::public.notification_channel[]
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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

  -- Authorization: platform admin, self-send, or tenant member sending within
  -- the same tenant. service_role bypasses (auth.uid() is NULL).
  IF actor IS NULL THEN
    authorized := true;
  ELSIF public.is_platform_admin(actor) THEN
    authorized := true;
  ELSIF actor = _recipient_user_id THEN
    authorized := true;
  ELSIF _tenant_id IS NOT NULL AND public.is_tenant_member(actor, _tenant_id) THEN
    authorized := true;
  END IF;
  IF NOT authorized THEN RAISE EXCEPTION 'Not authorized to publish notification'; END IF;

  -- Dedupe
  IF _dedupe_key IS NOT NULL THEN
    SELECT id INTO existing_id FROM public.notifications
      WHERE recipient_user_id = _recipient_user_id AND dedupe_key = _dedupe_key;
    IF existing_id IS NOT NULL THEN RETURN existing_id; END IF;
  END IF;

  INSERT INTO public.notifications
    (recipient_user_id, tenant_id, category, type, title, body, deep_link,
     priority, payload, dedupe_key, expires_at, created_by)
  VALUES
    (_recipient_user_id, _tenant_id, _category, _type, _title, _body, _deep_link,
     _priority, COALESCE(_payload, '{}'::jsonb), _dedupe_key, _expires_at, actor)
  RETURNING id INTO new_id;

  -- Deliveries + outbox rows per requested channel, honoring preferences.
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
$$;

GRANT EXECUTE ON FUNCTION public.publish_notification(uuid, public.notification_category, text, text, text, text, public.notification_priority, jsonb, uuid, text, timestamptz, public.notification_channel[]) TO authenticated, service_role;

-- Read helpers
CREATE OR REPLACE FUNCTION public.unread_notification_count()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.notifications
   WHERE recipient_user_id = auth.uid()
     AND read_at IS NULL AND archived_at IS NULL
     AND (expires_at IS NULL OR expires_at > now());
$$;
GRANT EXECUTE ON FUNCTION public.unread_notification_count() TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_notification_read(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.notifications SET read_at = COALESCE(read_at, now())
   WHERE id = _id AND recipient_user_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE n int;
BEGIN
  UPDATE public.notifications SET read_at = now()
   WHERE recipient_user_id = auth.uid() AND read_at IS NULL AND archived_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

CREATE OR REPLACE FUNCTION public.archive_notification(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.notifications SET archived_at = now()
   WHERE id = _id AND recipient_user_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.archive_notification(uuid) TO authenticated;

-- =============================================================
-- Realtime
-- =============================================================
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_object THEN NULL; END $$;
