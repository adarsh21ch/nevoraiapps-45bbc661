
-- Grant Data API access to NevorAI chat persistence tables so writes via the
-- caller-scoped Supabase client (from the /api/chat route and conversation
-- server functions) succeed. Previously RLS was enabled but no GRANTs existed
-- for authenticated, and there were no INSERT/UPDATE/DELETE policies — so
-- every write silently failed and the sidebar stayed empty.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversation_turns TO authenticated;
GRANT ALL ON public.ai_conversation_turns TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversation_summaries TO authenticated;
GRANT ALL ON public.ai_conversation_summaries TO service_role;

-- ai_conversations: user owns their own conversations.
DROP POLICY IF EXISTS ai_conv_insert ON public.ai_conversations;
CREATE POLICY ai_conv_insert ON public.ai_conversations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ai_conv_update ON public.ai_conversations;
CREATE POLICY ai_conv_update ON public.ai_conversations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ai_conv_delete ON public.ai_conversations;
CREATE POLICY ai_conv_delete ON public.ai_conversations
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ai_conversation_turns: inserts allowed when the parent conversation belongs
-- to the caller. Reads already covered by existing ai_turns_read policy.
DROP POLICY IF EXISTS ai_turns_insert ON public.ai_conversation_turns;
CREATE POLICY ai_turns_insert ON public.ai_conversation_turns
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ai_conversations c
    WHERE c.id = ai_conversation_turns.conversation_id
      AND c.user_id = auth.uid()
  ));

-- ai_conversation_summaries: inserts/updates allowed when parent conversation
-- belongs to caller (for future summarization work).
DROP POLICY IF EXISTS ai_summ_insert ON public.ai_conversation_summaries;
CREATE POLICY ai_summ_insert ON public.ai_conversation_summaries
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ai_conversations c
    WHERE c.id = ai_conversation_summaries.conversation_id
      AND c.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS ai_summ_update ON public.ai_conversation_summaries;
CREATE POLICY ai_summ_update ON public.ai_conversation_summaries
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ai_conversations c
    WHERE c.id = ai_conversation_summaries.conversation_id
      AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ai_conversations c
    WHERE c.id = ai_conversation_summaries.conversation_id
      AND c.user_id = auth.uid()
  ));
