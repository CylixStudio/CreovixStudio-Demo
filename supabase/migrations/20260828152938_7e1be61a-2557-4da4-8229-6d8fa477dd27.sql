CREATE OR REPLACE FUNCTION public.apply_timer_seconds(p_subathon_id uuid, p_seconds integer)
RETURNS public.timer_states
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max integer;
  v_row public.timer_states;
BEGIN
  SELECT max_duration_seconds INTO v_max FROM public.subathons WHERE id = p_subathon_id;

  UPDATE public.timer_states t
  SET
    remaining_seconds = GREATEST(
      0,
      CASE
        WHEN v_max IS NOT NULL THEN LEAST(t.remaining_seconds + p_seconds, v_max)
        ELSE t.remaining_seconds + p_seconds
      END
    ),
    total_added_seconds = t.total_added_seconds + GREATEST(p_seconds, 0),
    last_tick_at = now(),
    expires_at = CASE
      WHEN t.status = 'RUNNING' THEN now() + make_interval(secs => GREATEST(
        0,
        CASE
          WHEN v_max IS NOT NULL THEN LEAST(t.remaining_seconds + p_seconds, v_max)
          ELSE t.remaining_seconds + p_seconds
        END
      ))
      ELSE t.expires_at
    END
  WHERE t.subathon_id = p_subathon_id
  RETURNING t.* INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_timer_seconds(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_timer_seconds(uuid, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_timer_seconds(uuid, integer) TO service_role;