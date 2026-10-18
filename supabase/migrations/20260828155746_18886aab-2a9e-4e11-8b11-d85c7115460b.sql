CREATE OR REPLACE FUNCTION public.subathon_has_public_overlay(p_subathon_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.overlays o
    WHERE o.subathon_id = p_subathon_id AND o.is_public
  );
$$;

REVOKE ALL ON FUNCTION public.subathon_has_public_overlay(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.subathon_has_public_overlay(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS timer_states_public_read ON public.timer_states;
CREATE POLICY timer_states_public_read ON public.timer_states
  FOR SELECT TO anon, authenticated
  USING (public.subathon_has_public_overlay(subathon_id));