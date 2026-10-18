ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS is_lifetime boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.redeem_activation_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
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

  SELECT * INTO v_code FROM public.activation_codes WHERE code = v_clean FOR UPDATE;

  IF v_code.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_code.is_used THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_used');
  END IF;

  v_lifetime := v_code.duration_days >= 36500;

  SELECT expires_at, is_lifetime INTO v_current, v_current_lifetime
  FROM public.user_subscriptions WHERE user_id = v_user;

  -- Stack onto remaining time when the subscription is still active
  v_base := CASE WHEN v_current IS NOT NULL AND v_current > now() THEN v_current ELSE now() END;

  IF v_lifetime OR coalesce(v_current_lifetime, false) THEN
    v_new := now() + interval '100 years';
    v_lifetime := true;
  ELSE
    v_new := v_base + make_interval(days => v_code.duration_days);
  END IF;

  UPDATE public.activation_codes
     SET is_used = true, used_by_user_id = v_user, redeemed_at = now()
   WHERE id = v_code.id;

  INSERT INTO public.user_subscriptions (user_id, subscription_status, expires_at, active_code, is_lifetime)
  VALUES (v_user, 'active', v_new, v_clean, v_lifetime)
  ON CONFLICT (user_id) DO UPDATE
    SET subscription_status = 'active',
        expires_at = EXCLUDED.expires_at,
        active_code = EXCLUDED.active_code,
        is_lifetime = EXCLUDED.is_lifetime,
        updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'expires_at', v_new,
    'is_lifetime', v_lifetime,
    'duration_days', v_code.duration_days
  );
END;
$$;

DROP FUNCTION IF EXISTS public.generate_activation_code(integer);
CREATE OR REPLACE FUNCTION public.generate_activation_code(p_duration_days integer)
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
  IF v_user IS NULL OR NOT public.has_role(v_user, 'admin') THEN
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

  INSERT INTO public.activation_codes (code, duration_days, created_by_user_id)
  VALUES (v_code, v_days, v_user);

  RETURN jsonb_build_object('ok', true, 'code', v_code, 'duration_days', v_days);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_activation_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_activation_code(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_activation_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_activation_code(integer) TO authenticated;