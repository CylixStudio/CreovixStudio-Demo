ALTER TABLE public.activation_codes
  ADD COLUMN IF NOT EXISTS is_revoked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revoked_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.revoke_activation_code(p_code_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_code public.activation_codes;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_code FROM public.activation_codes WHERE id = p_code_id FOR UPDATE;

  IF v_code.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  UPDATE public.activation_codes
     SET is_revoked = true, is_active = false, revoked_at = now()
   WHERE id = p_code_id;

  IF v_code.used_by_user_id IS NOT NULL THEN
    UPDATE public.user_subscriptions
       SET subscription_status = 'inactive',
           expires_at = now(),
           is_lifetime = false,
           active_code = NULL,
           updated_at = now()
     WHERE user_id = v_code.used_by_user_id
       AND (active_code = v_code.code OR active_code IS NULL);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.revoke_activation_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_activation_code(uuid) TO authenticated;