DROP POLICY IF EXISTS overlays_public_read ON public.overlays;

CREATE OR REPLACE FUNCTION public.get_public_overlay(p_token text)
RETURNS TABLE (
  id uuid,
  name text,
  theme jsonb,
  subathon_id uuid,
  subathon_title text,
  max_duration_seconds integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.theme, o.subathon_id, s.title, s.max_duration_seconds
  FROM public.overlays o
  JOIN public.subathons s ON s.id = o.subathon_id
  WHERE o.is_public = true
    AND p_token IS NOT NULL
    AND length(p_token) >= 16
    AND o.public_token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_overlay(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_overlay(text) TO anon, authenticated, service_role;