-- Public timer/overlay reads now go through privileged server routes,
-- so the SECURITY DEFINER helpers no longer need anon/authenticated EXECUTE.

DROP POLICY IF EXISTS timer_states_public_read ON public.timer_states;

DROP FUNCTION IF EXISTS public.subathon_has_public_overlay(uuid);
DROP FUNCTION IF EXISTS public.get_public_overlay(text);

-- apply_timer_seconds stays service-role only.
REVOKE EXECUTE ON FUNCTION public.apply_timer_seconds(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_timer_seconds(uuid, integer) TO service_role;