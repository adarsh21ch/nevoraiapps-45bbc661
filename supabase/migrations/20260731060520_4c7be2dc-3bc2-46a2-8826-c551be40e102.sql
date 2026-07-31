CREATE INDEX IF NOT EXISTS idx_mc_match_squads_tenant ON public.mc_match_squads (tenant_id);
CREATE INDEX IF NOT EXISTS idx_mc_match_squads_team ON public.mc_match_squads (team_id);
CREATE INDEX IF NOT EXISTS idx_mc_scorers_user ON public.mc_scorers (user_id);
CREATE INDEX IF NOT EXISTS idx_mc_scoring_locks_tenant ON public.mc_scoring_locks (tenant_id);
CREATE INDEX IF NOT EXISTS idx_mc_cricket_profiles_tenant ON public.mc_cricket_profiles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_mc_athlete_timeline_tenant ON public.mc_athlete_timeline (tenant_id);
CREATE INDEX IF NOT EXISTS idx_mc_athlete_awards_tenant ON public.mc_athlete_awards (tenant_id);
CREATE INDEX IF NOT EXISTS idx_mc_athlete_achievements_tenant ON public.mc_athlete_achievements (tenant_id);
CREATE INDEX IF NOT EXISTS idx_mc_match_timeline_tenant ON public.mc_match_timeline (tenant_id);
CREATE INDEX IF NOT EXISTS idx_mc_match_audit_log_tenant ON public.mc_match_audit_log (tenant_id);

CREATE INDEX IF NOT EXISTS idx_billing_charges_student ON public.billing_charges (student_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_student ON public.billing_invoices (student_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_student ON public.billing_payments (student_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_student ON public.billing_subscriptions (student_id);
CREATE INDEX IF NOT EXISTS idx_fee_plans_tenant ON public.fee_plans (tenant_id);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_student ON public.reminder_logs (student_id);

CREATE INDEX IF NOT EXISTS idx_batches_tenant ON public.batches (tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON public.profiles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_comm_campaign_recipients_tenant ON public.comm_campaign_recipients (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_tenant ON public.ai_rate_limits (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversation_turns_tenant ON public.ai_conversation_turns (tenant_id);
CREATE INDEX IF NOT EXISTS idx_registrations_student ON public.registrations (student_id);

ANALYZE public.mc_match_squads;
ANALYZE public.billing_invoices;
ANALYZE public.billing_payments;