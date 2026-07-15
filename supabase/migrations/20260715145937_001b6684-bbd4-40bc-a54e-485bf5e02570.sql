CREATE TABLE IF NOT EXISTS public.push_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  expo_push_token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios','android','web')),
  app_version TEXT,
  locale TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT push_devices_device_uniq UNIQUE (device_id),
  CONSTRAINT push_devices_token_uniq  UNIQUE (expo_push_token)
);

CREATE INDEX IF NOT EXISTS push_devices_user_idx
  ON public.push_devices(user_id) WHERE enabled;
CREATE INDEX IF NOT EXISTS push_devices_tenant_idx
  ON public.push_devices(tenant_id) WHERE enabled;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_devices TO authenticated;
GRANT ALL ON public.push_devices TO service_role;

ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_devices_owner_all"
  ON public.push_devices
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()))
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_push_devices_updated_at ON public.push_devices;
CREATE TRIGGER trg_push_devices_updated_at
BEFORE UPDATE ON public.push_devices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_comm_channels (channel, display_name, description, enabled)
VALUES ('push', 'Push Notifications', 'Primary notification channel via Expo Push', TRUE)
ON CONFLICT (channel) DO UPDATE
  SET enabled = TRUE,
      display_name = EXCLUDED.display_name,
      description = EXCLUDED.description;

INSERT INTO public.platform_comm_providers
  (channel, adapter_key, display_name, description, ready, enabled, priority)
VALUES
  ('push', 'expo', 'Expo Push (Primary)', 'Expo Push Notification service', TRUE, TRUE, 0)
ON CONFLICT (channel, adapter_key) DO UPDATE
  SET ready = EXCLUDED.ready,
      enabled = EXCLUDED.enabled,
      priority = EXCLUDED.priority,
      display_name = EXCLUDED.display_name;

INSERT INTO public.platform_comm_active (channel, provider_id, account_id)
SELECT 'push', p.id, NULL
FROM public.platform_comm_providers p
WHERE p.channel = 'push' AND p.adapter_key = 'expo'
ON CONFLICT (channel) DO NOTHING;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS subtitle TEXT;

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications(tenant_id, recipient_user_id, read_at NULLS FIRST, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;