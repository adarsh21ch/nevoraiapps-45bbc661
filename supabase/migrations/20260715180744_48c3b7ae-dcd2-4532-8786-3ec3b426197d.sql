
-- =========================================================================
-- PART 1: Revoke anon EXECUTE from all SECURITY DEFINER public functions
-- except an explicit whitelist of public helpers.
-- =========================================================================
DO $$
DECLARE
  r record;
  whitelist text[] := ARRAY[
    'get_public_academy_bundle',
    'get_public_match_bundle',
    'get_public_match_state',
    'get_public_tournament_bundle',
    'check_rate_limit',
    'claim_registration_payment',
    'attach_payment_ref'
  ];
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND p.proname <> ALL(whitelist)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, public',
                   r.proname, r.args);
  END LOOP;
END $$;

-- =========================================================================
-- PART 2: mc_coach_remarks — auto-set submitted_by_role and approval_status
-- =========================================================================
CREATE OR REPLACE FUNCTION public.set_remark_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  -- Only apply on INSERT paths; leave UPDATE alone
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Pick the highest-privilege role this user has in this tenant
  SELECT role::text INTO v_role
  FROM public.user_roles
  WHERE user_id = COALESCE(NEW.author_user_id, auth.uid())
    AND tenant_id = NEW.tenant_id
  ORDER BY CASE role::text
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'head_coach' THEN 3
    WHEN 'coach' THEN 4
    WHEN 'assistant_coach' THEN 5
    ELSE 9
  END
  LIMIT 1;

  -- Fill submitted_by_role if the client did not (or set it wrong)
  NEW.submitted_by_role := v_role;

  -- Coaches & assistant coaches → pending; anyone else → keep default (approved)
  IF v_role IN ('coach', 'assistant_coach') THEN
    NEW.approval_status := 'pending';
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  ELSIF v_role IN ('head_coach', 'admin', 'owner') THEN
    -- Auto-approve; stamp approver
    NEW.approval_status := 'approved';
    NEW.approved_by := COALESCE(NEW.approved_by, auth.uid());
    NEW.approved_at := COALESCE(NEW.approved_at, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_remark_defaults ON public.mc_coach_remarks;
CREATE TRIGGER trg_set_remark_defaults
  BEFORE INSERT ON public.mc_coach_remarks
  FOR EACH ROW EXECUTE FUNCTION public.set_remark_defaults();

-- =========================================================================
-- PART 3: Coach automation event emit triggers
-- =========================================================================

-- Small helper: insert an automation_events row with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public._emit_automation_event(
  _tenant_id uuid,
  _event_type text,
  _source_module text,
  _source_id text,
  _payload jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _tenant_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.automation_events
    (tenant_id, event_type, source_module, source_id, payload, status)
  VALUES
    (_tenant_id, _event_type, _source_module, _source_id, COALESCE(_payload, '{}'::jsonb), 'pending');
END;
$$;
REVOKE EXECUTE ON FUNCTION public._emit_automation_event(uuid, text, text, text, jsonb) FROM anon, public;

-- 3a. coach_assignments → coach.batch_assigned
CREATE OR REPLACE FUNCTION public.trg_emit_coach_batch_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.active IS TRUE AND (TG_OP = 'INSERT' OR OLD.active IS DISTINCT FROM NEW.active) THEN
    PERFORM public._emit_automation_event(
      NEW.tenant_id,
      'coach.batch_assigned',
      'coach_assignments',
      NEW.id::text,
      jsonb_build_object(
        'assignment_id', NEW.id,
        'batch_id', NEW.batch_id,
        'coach_user_id', NEW.coach_user_id,
        'coach_role', NEW.coach_role,
        'assigned_by', NEW.assigned_by
      )
    );
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_coach_assignments_emit ON public.coach_assignments;
CREATE TRIGGER trg_coach_assignments_emit
  AFTER INSERT OR UPDATE OF active ON public.coach_assignments
  FOR EACH ROW EXECUTE FUNCTION public.trg_emit_coach_batch_assigned();

-- 3b. attendance_sessions → coach.schedule_updated
CREATE OR REPLACE FUNCTION public.trg_emit_coach_schedule_updated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._emit_automation_event(
    NEW.tenant_id,
    'coach.schedule_updated',
    'attendance_sessions',
    NEW.id::text,
    jsonb_build_object(
      'session_id', NEW.id,
      'batch_id', NEW.batch_id,
      'session_date', NEW.session_date,
      'op', TG_OP
    )
  );
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_attendance_sessions_emit ON public.attendance_sessions;
CREATE TRIGGER trg_attendance_sessions_emit
  AFTER INSERT OR UPDATE ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trg_emit_coach_schedule_updated();

-- 3c. mc_coach_remarks → coach.approval_required / approved / rejected
CREATE OR REPLACE FUNCTION public.trg_emit_coach_remark_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'remark_id', NEW.id,
    'student_id', NEW.student_id,
    'author_user_id', NEW.author_user_id,
    'submitted_by_role', NEW.submitted_by_role,
    'approval_status', NEW.approval_status
  );

  IF TG_OP = 'INSERT' AND NEW.approval_status = 'pending' THEN
    PERFORM public._emit_automation_event(
      NEW.tenant_id, 'coach.approval_required', 'mc_coach_remarks', NEW.id::text, v_payload
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
    IF NEW.approval_status = 'approved' THEN
      PERFORM public._emit_automation_event(
        NEW.tenant_id, 'coach.remark_approved', 'mc_coach_remarks', NEW.id::text, v_payload
      );
    ELSIF NEW.approval_status = 'rejected' THEN
      PERFORM public._emit_automation_event(
        NEW.tenant_id, 'coach.remark_rejected', 'mc_coach_remarks', NEW.id::text,
        v_payload || jsonb_build_object('rejection_reason', NEW.rejection_reason)
      );
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_coach_remark_events ON public.mc_coach_remarks;
CREATE TRIGGER trg_coach_remark_events
  AFTER INSERT OR UPDATE OF approval_status ON public.mc_coach_remarks
  FOR EACH ROW EXECUTE FUNCTION public.trg_emit_coach_remark_events();

-- =========================================================================
-- PART 4: Default automation rule templates (idempotent seed)
-- =========================================================================
CREATE UNIQUE INDEX IF NOT EXISTS ux_automation_rule_templates_key
  ON public.automation_rule_templates(template_key);

INSERT INTO public.automation_rule_templates
  (template_key, name, description, category, audience, event_type, conditions, actions, default_enabled, priority)
VALUES
  ('coach.batch_assigned.default',
   'Notify coach on batch assignment',
   'Sends an in-app + push notification when a coach is assigned to a batch. WhatsApp & email placeholders included and editable.',
   'coach', 'coach', 'coach.batch_assigned', '[]'::jsonb,
   '[
     {"type":"notification.create","params":{"title":"You have been assigned to a new batch","body":"You are now the {{payload.coach_role}} of batch {{payload.batch_id}}.","deep_link":"/dashboard/coach","priority":"normal"}},
     {"type":"notification.push","params":{"title":"New batch assignment","body":"Open your Coach Dashboard to see details."}},
     {"type":"notification.whatsapp","params":{"template":"coach_batch_assigned","body":"Hi {{recipient.name}}, you have been assigned to a new batch."}},
     {"type":"notification.email","params":{"subject":"New batch assignment","body":"Hi {{recipient.name}}, you have been assigned to a new batch on AcademyOS."}}
   ]'::jsonb, true, 100),

  ('coach.student_assigned.default',
   'Notify coach on new student assignment',
   'Sends notifications when a student is added to a batch under the coach.',
   'coach', 'coach', 'coach.student_assigned', '[]'::jsonb,
   '[
     {"type":"notification.create","params":{"title":"New student in your batch","body":"{{payload.student_name}} was added to your batch.","deep_link":"/dashboard/students"}},
     {"type":"notification.push","params":{"title":"New student","body":"{{payload.student_name}} joined your batch."}}
   ]'::jsonb, true, 100),

  ('coach.attendance_reminder.default',
   'Attendance reminder for coach',
   'Reminds a coach to mark attendance for today''s session.',
   'coach', 'coach', 'coach.attendance_reminder', '[]'::jsonb,
   '[
     {"type":"notification.push","params":{"title":"Mark attendance","body":"Today''s session for batch {{payload.batch_id}} needs attendance."}},
     {"type":"notification.whatsapp","params":{"template":"coach_attendance_reminder","body":"Reminder: mark attendance for today''s session."}}
   ]'::jsonb, true, 90),

  ('coach.session_reminder.default',
   'Session start reminder',
   'Reminds coaches shortly before a session begins.',
   'coach', 'coach', 'coach.session_reminder', '[]'::jsonb,
   '[
     {"type":"notification.push","params":{"title":"Session starting soon","body":"Your session starts at {{payload.start_time}}."}}
   ]'::jsonb, true, 80),

  ('coach.parent_message.default',
   'Notify coach of parent message',
   'Alerts the coach when a parent sends a message.',
   'coach', 'coach', 'coach.parent_message', '[]'::jsonb,
   '[
     {"type":"notification.create","params":{"title":"New parent message","body":"{{payload.parent_name}} sent you a message.","deep_link":"/dashboard/communications"}},
     {"type":"notification.push","params":{"title":"Parent message","body":"{{payload.parent_name}} sent you a message."}}
   ]'::jsonb, true, 100),

  ('coach.announcement.default',
   'Coach announcement broadcast',
   'Broadcasts a coach announcement to parents of the batch.',
   'coach', 'parents', 'coach.announcement', '[]'::jsonb,
   '[
     {"type":"notification.create","params":{"title":"Announcement from your coach","body":"{{payload.message}}","deep_link":"/parent"}},
     {"type":"notification.push","params":{"title":"Coach announcement","body":"{{payload.message}}"}},
     {"type":"notification.whatsapp","params":{"template":"coach_announcement","body":"{{payload.message}}"}}
   ]'::jsonb, true, 100),

  ('coach.approval_required.default',
   'Head-coach approval required',
   'Notifies head coaches that an assistant-coach remark is pending approval.',
   'coach', 'head_coach', 'coach.approval_required', '[]'::jsonb,
   '[
     {"type":"notification.create","params":{"title":"Remark pending approval","body":"An assistant coach submitted a remark that needs your approval.","deep_link":"/dashboard/coach/approvals","priority":"high"}},
     {"type":"notification.push","params":{"title":"Approval needed","body":"A remark is waiting for your review."}}
   ]'::jsonb, true, 110),

  ('coach.remark_approved.default',
   'Coach remark approved',
   'Notifies the author that their remark was approved.',
   'coach', 'coach', 'coach.remark_approved', '[]'::jsonb,
   '[
     {"type":"notification.create","params":{"title":"Remark approved","body":"Your remark was approved and is now visible to parents.","deep_link":"/dashboard/students"}},
     {"type":"notification.push","params":{"title":"Remark approved","body":"Your remark was approved."}}
   ]'::jsonb, true, 90),

  ('coach.remark_rejected.default',
   'Coach remark rejected',
   'Notifies the author that their remark was rejected with a reason.',
   'coach', 'coach', 'coach.remark_rejected', '[]'::jsonb,
   '[
     {"type":"notification.create","params":{"title":"Remark rejected","body":"Reason: {{payload.rejection_reason}}","deep_link":"/dashboard/students","priority":"high"}},
     {"type":"notification.push","params":{"title":"Remark rejected","body":"Your remark was rejected. Tap for details."}}
   ]'::jsonb, true, 100),

  ('coach.schedule_updated.default',
   'Session schedule updated',
   'Notifies affected coaches when a session is created or updated.',
   'coach', 'coach', 'coach.schedule_updated', '[]'::jsonb,
   '[
     {"type":"notification.create","params":{"title":"Session schedule updated","body":"Batch {{payload.batch_id}} on {{payload.session_date}} has been updated.","deep_link":"/dashboard/coach"}},
     {"type":"notification.push","params":{"title":"Schedule updated","body":"A session in your batch was updated."}}
   ]'::jsonb, true, 80)
ON CONFLICT (template_key) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      actions = EXCLUDED.actions,
      updated_at = now();
