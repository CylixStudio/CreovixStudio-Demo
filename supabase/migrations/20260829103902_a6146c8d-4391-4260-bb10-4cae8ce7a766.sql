-- Restrict privileged SECURITY DEFINER routine to trusted server-side code only
REVOKE ALL ON FUNCTION public.apply_timer_seconds(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_timer_seconds(uuid, integer) TO service_role;

-- Public overlay lookup stays callable (token-gated), but not by PUBLIC broadly
REVOKE ALL ON FUNCTION public.get_public_overlay(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_overlay(text) TO anon, authenticated, service_role;

-- RLS helper: required by policies evaluated as the calling role
REVOKE ALL ON FUNCTION public.subathon_has_public_overlay(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subathon_has_public_overlay(uuid) TO anon, authenticated, service_role;

-- Audit logs: read-only for users, writes only via service role
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;