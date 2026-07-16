
ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.ai_conversation_turns
  ADD COLUMN IF NOT EXISTS parts JSONB;

CREATE INDEX IF NOT EXISTS ai_conversations_user_pinned_idx
  ON public.ai_conversations (user_id, pinned DESC, updated_at DESC)
  WHERE deleted_at IS NULL;
