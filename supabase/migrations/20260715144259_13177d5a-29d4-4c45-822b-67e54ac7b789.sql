-- Remove BotBiz provider registry entry; Meta is the sole real WhatsApp adapter now.
DELETE FROM public.platform_comm_active
 WHERE provider_id IN (SELECT id FROM public.platform_comm_providers WHERE adapter_key = 'botbiz');
DELETE FROM public.platform_comm_accounts
 WHERE provider_id IN (SELECT id FROM public.platform_comm_providers WHERE adapter_key = 'botbiz');
DELETE FROM public.platform_comm_providers WHERE adapter_key = 'botbiz';

UPDATE public.platform_comm_providers
   SET display_name = 'Meta WhatsApp Cloud API',
       description  = 'Official Meta WhatsApp Business Cloud API (Graph API). Sends template + text messages directly.',
       priority     = 10
 WHERE channel = 'whatsapp' AND adapter_key = 'meta';