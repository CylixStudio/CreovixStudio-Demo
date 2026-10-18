CREATE TABLE IF NOT EXISTS public.giveaway_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword text NOT NULL DEFAULT '+1',
  sub_multiplier integer NOT NULL DEFAULT 1,
  subs_only boolean NOT NULL DEFAULT false,
  spin_duration integer NOT NULL DEFAULT 5,
  claim_seconds integer NOT NULL DEFAULT 120,
  is_open boolean NOT NULL DEFAULT true,
  last_winner jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.giveaway_settings TO authenticated;
GRANT ALL ON public.giveaway_settings TO service_role;
ALTER TABLE public.giveaway_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their giveaway settings" ON public.giveaway_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.giveaway_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  username text NOT NULL,
  entries integer NOT NULL DEFAULT 1,
  is_subscriber boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, username)
);

CREATE INDEX IF NOT EXISTS giveaway_participants_user_idx
  ON public.giveaway_participants (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.giveaway_participants TO authenticated;
GRANT ALL ON public.giveaway_participants TO service_role;
ALTER TABLE public.giveaway_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their giveaway participants" ON public.giveaway_participants
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);