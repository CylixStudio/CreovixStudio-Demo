-- Pro purchase → activation code delivery (manual redeem only; no auto-activate).
-- Extends activation_codes with purchase linkage and adds pro_purchases ledger.

ALTER TABLE public.activation_codes
  ADD COLUMN IF NOT EXISTS purchaser_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS purchase_id uuid,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS code_expires_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activation_codes_source_check'
  ) THEN
    ALTER TABLE public.activation_codes
      ADD CONSTRAINT activation_codes_source_check
      CHECK (source IN ('admin', 'purchase', 'manual'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS activation_codes_purchaser_idx
  ON public.activation_codes (purchaser_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activation_codes_unused_idx
  ON public.activation_codes (is_used, is_active)
  WHERE is_used = false AND is_active = true;

CREATE TABLE IF NOT EXISTS public.pro_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  billing_interval text NOT NULL,
  duration_days integer NOT NULL CHECK (duration_days >= 1 AND duration_days <= 36500),
  amount_cents integer,
  currency text NOT NULL DEFAULT 'USD',
  provider text NOT NULL DEFAULT 'checkout',
  provider_payment_id text NOT NULL,
  status text NOT NULL DEFAULT 'paid',
  activation_code_id uuid REFERENCES public.activation_codes(id) ON DELETE SET NULL,
  code_delivered_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pro_purchases_interval_check
    CHECK (billing_interval IN ('monthly', 'six_months', 'yearly', 'lifetime', 'custom')),
  CONSTRAINT pro_purchases_status_check
    CHECK (status IN ('paid', 'refunded', 'failed')),
  CONSTRAINT pro_purchases_provider_payment_unique
    UNIQUE (provider, provider_payment_id)
);

CREATE INDEX IF NOT EXISTS pro_purchases_user_idx
  ON public.pro_purchases (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pro_purchases_email_idx
  ON public.pro_purchases (lower(email), created_at DESC);

GRANT SELECT ON public.pro_purchases TO authenticated;
GRANT ALL ON public.pro_purchases TO service_role;

ALTER TABLE public.pro_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pro_purchases_read_own ON public.pro_purchases;
CREATE POLICY pro_purchases_read_own ON public.pro_purchases
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS pro_purchases_updated_at ON public.pro_purchases;
CREATE TRIGGER pro_purchases_updated_at
  BEFORE UPDATE ON public.pro_purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Back-link purchase_id on codes once both rows exist (nullable FK without cycle).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activation_codes_purchase_id_fkey'
  ) THEN
    ALTER TABLE public.activation_codes
      ADD CONSTRAINT activation_codes_purchase_id_fkey
      FOREIGN KEY (purchase_id) REFERENCES public.pro_purchases(id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'activation_codes_purchase_id_fkey skipped: %', SQLERRM;
END $$;

-- Redeem: honour revoked codes + unused-code expiry; still MANUAL (caller must redeem).
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
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated', 'error', 'not_authenticated');
  END IF;

  IF length(v_clean) <> 16 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid', 'error', 'invalid_format');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user;

  SELECT * INTO v_code FROM public.activation_codes WHERE code = v_clean FOR UPDATE;

  IF NOT FOUND OR v_code.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid', 'error', 'not_found');
  END IF;

  IF v_code.is_used THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid', 'error', 'already_used');
  END IF;

  IF coalesce(v_code.is_revoked, false) OR NOT coalesce(v_code.is_active, true) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid', 'error', 'deactivated');
  END IF;

  IF v_code.code_expires_at IS NOT NULL AND v_code.code_expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired', 'error', 'code_expired');
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
     SET is_used = true,
         used_by_user_id = v_user,
         redeemed_at = now(),
         redeemed_by_email = v_email
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

REVOKE ALL ON FUNCTION public.redeem_activation_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_activation_code(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
