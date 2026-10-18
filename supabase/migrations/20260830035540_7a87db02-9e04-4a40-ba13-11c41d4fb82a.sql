-- 1) Hardcoded admin emails + unified admin check
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = _user_id
      AND lower(u.email) IN ('store@creovix.com', 'creovix0@gmail.com')
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

-- Persist the role row for hardcoded admins that already exist
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE lower(u.email) IN ('store@creovix.com', 'creovix0@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Extra columns on activation_codes
ALTER TABLE public.activation_codes
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS redeemed_by_email text;

-- 3) Admin-only management of codes
DROP POLICY IF EXISTS activation_codes_admin_read ON public.activation_codes;
CREATE POLICY activation_codes_admin_read ON public.activation_codes
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY activation_codes_admin_update ON public.activation_codes
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY activation_codes_admin_delete ON public.activation_codes
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

GRANT SELECT, UPDATE, DELETE ON public.activation_codes TO authenticated;
GRANT ALL ON public.activation_codes TO service_role;

-- 4) Generator with notes + is_admin check
DROP FUNCTION IF EXISTS public.generate_activation_code(integer);
CREATE OR REPLACE FUNCTION public.generate_activation_code(p_duration_days integer, p_notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_code text;
  v_days integer := coalesce(p_duration_days, 30);
BEGIN
  IF v_user IS NULL OR NOT public.is_admin(v_user) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF v_days < 1 OR v_days > 36500 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_duration');
  END IF;

  LOOP
    v_code := upper(translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/=OIL', 'ABCDEF'));
    v_code := substr(regexp_replace(v_code, '[^A-Z0-9]', '', 'g'), 1, 16);
    EXIT WHEN length(v_code) = 16
      AND NOT EXISTS (SELECT 1 FROM public.activation_codes WHERE code = v_code);
  END LOOP;

  INSERT INTO public.activation_codes (code, duration_days, created_by, notes)
  VALUES (v_code, v_days, v_user, nullif(btrim(coalesce(p_notes, '')), ''));

  RETURN jsonb_build_object('ok', true, 'code', v_code, 'duration_days', v_days);
END;
$$;

REVOKE ALL ON FUNCTION public.generate_activation_code(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_activation_code(integer, text) TO authenticated, service_role;

-- 5) Redeem: honour deactivated codes and record redeemer email
CREATE OR REPLACE FUNCTION public.redeem_activation_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_code public.activation_codes;
  v_clean text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_current timestamptz;
  v_current_lifetime boolean := false;
  v_base timestamptz;
  v_new timestamptz;
  v_lifetime boolean;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF length(v_clean) <> 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_format');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user;

  SELECT * INTO v_code FROM public.activation_codes WHERE code = v_clean FOR UPDATE;

  IF v_code.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_code.is_used THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_used');
  END IF;

  IF NOT v_code.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'deactivated');
  END IF;

  v_lifetime := v_code.duration_days >= 36500;

  SELECT expires_at, is_lifetime INTO v_current, v_current_lifetime
  FROM public.user_subscriptions WHERE user_id = v_user;

  v_base := CASE WHEN v_current IS NOT NULL AND v_current > now() THEN v_current ELSE now() END;

  IF v_lifetime OR coalesce(v_current_lifetime, false) THEN
    v_new := now() + interval '100 years';
    v_lifetime := true;
  ELSE
    v_new := v_base + make_interval(days => v_code.duration_days);
  END IF;

  UPDATE public.activation_codes
     SET is_used = true, used_by_user_id = v_user, redeemed_at = now(), redeemed_by_email = v_email
   WHERE id = v_code.id;

  INSERT INTO public.user_subscriptions (user_id, subscription_status, expires_at, active_code, is_lifetime)
  VALUES (v_user, 'active', v_new, v_clean, v_lifetime)
  ON CONFLICT (user_id) DO UPDATE
    SET subscription_status = 'active',
        expires_at = EXCLUDED.expires_at,
        active_code = EXCLUDED.active_code,
        is_lifetime = EXCLUDED.is_lifetime,
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'expires_at', v_new, 'is_lifetime', v_lifetime, 'duration_days', v_code.duration_days);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_activation_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_activation_code(text) TO authenticated, service_role;