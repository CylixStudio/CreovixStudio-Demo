-- Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_roles_read_own ON public.user_roles;
CREATE POLICY user_roles_read_own ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Activation codes
CREATE TABLE IF NOT EXISTS public.activation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  duration_days integer NOT NULL DEFAULT 30,
  is_used boolean NOT NULL DEFAULT false,
  used_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz
);

CREATE INDEX IF NOT EXISTS activation_codes_is_used_idx ON public.activation_codes (is_used, created_at DESC);

GRANT SELECT ON public.activation_codes TO authenticated;
GRANT ALL ON public.activation_codes TO service_role;
ALTER TABLE public.activation_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activation_codes_admin_read ON public.activation_codes;
CREATE POLICY activation_codes_admin_read ON public.activation_codes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Subscriptions
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  subscription_status text NOT NULL DEFAULT 'inactive',
  expires_at timestamptz,
  active_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_subscriptions_status_check CHECK (subscription_status IN ('active','expired','inactive'))
);

GRANT SELECT ON public.user_subscriptions TO authenticated;
GRANT ALL ON public.user_subscriptions TO service_role;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_subscriptions_read_own ON public.user_subscriptions;
CREATE POLICY user_subscriptions_read_own ON public.user_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS user_subscriptions_updated_at ON public.user_subscriptions;
CREATE TRIGGER user_subscriptions_updated_at BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Redeem function (runs as definer, validates the caller)
CREATE OR REPLACE FUNCTION public.redeem_activation_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_code public.activation_codes;
  v_base timestamptz;
  v_expires timestamptz;
  v_norm text := upper(regexp_replace(coalesce(p_code,''), '[^A-Za-z0-9]', '', 'g'));
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  IF length(v_norm) <> 16 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO v_code FROM public.activation_codes WHERE code = v_norm FOR UPDATE;
  IF NOT FOUND OR v_code.is_used THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT CASE
      WHEN s.subscription_status = 'active' AND s.expires_at IS NOT NULL AND s.expires_at > now()
        THEN s.expires_at ELSE now() END
    INTO v_base
  FROM public.user_subscriptions s WHERE s.user_id = v_user;
  IF v_base IS NULL THEN v_base := now(); END IF;

  IF v_code.duration_days >= 36500 THEN
    v_expires := now() + interval '100 years';
  ELSE
    v_expires := v_base + make_interval(days => v_code.duration_days);
  END IF;

  UPDATE public.activation_codes
     SET is_used = true, used_by_user_id = v_user, redeemed_at = now()
   WHERE id = v_code.id;

  INSERT INTO public.user_subscriptions (user_id, subscription_status, expires_at, active_code)
  VALUES (v_user, 'active', v_expires, v_norm)
  ON CONFLICT (user_id) DO UPDATE
    SET subscription_status = 'active', expires_at = v_expires, active_code = v_norm;

  RETURN jsonb_build_object('ok', true, 'expires_at', v_expires, 'duration_days', v_code.duration_days);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_activation_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_activation_code(text) TO authenticated;

-- Admin code generation
CREATE OR REPLACE FUNCTION public.generate_activation_code(p_duration_days integer)
RETURNS public.activation_codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_code text;
  v_row public.activation_codes;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i integer;
BEGIN
  IF v_user IS NULL OR NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_duration_days IS NULL OR p_duration_days < 1 THEN
    RAISE EXCEPTION 'invalid duration';
  END IF;

  LOOP
    v_code := '';
    FOR i IN 1..16 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.activation_codes WHERE code = v_code);
  END LOOP;

  INSERT INTO public.activation_codes (code, duration_days, created_by)
  VALUES (v_code, p_duration_days, v_user)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_activation_code(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_activation_code(integer) TO authenticated;

-- Seed admin for the owner account
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM public.users WHERE email = 'creovix0@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;