CREATE OR REPLACE FUNCTION public.assign_player_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  prefix text;
  next_num int;
  candidate text;
BEGIN
  IF NEW.player_id IS NOT NULL AND btrim(NEW.player_id) <> '' THEN
    RETURN NEW;
  END IF;

  prefix := public.compute_player_prefix(NEW.tenant_id);

  SELECT COALESCE(
    MAX(NULLIF(regexp_replace(player_id, '^' || prefix, ''), '')::int),
    0
  ) + 1
  INTO next_num
  FROM public.students
  WHERE tenant_id = NEW.tenant_id
    AND player_id ~ ('^' || prefix || '[0-9]{1,4}$');

  IF next_num < 1 THEN next_num := 1; END IF;

  LOOP
    candidate := prefix || lpad(next_num::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.students
      WHERE tenant_id = NEW.tenant_id AND player_id = candidate
    );
    next_num := next_num + 1;
  END LOOP;

  NEW.player_id := candidate;
  RETURN NEW;
END;
$function$;