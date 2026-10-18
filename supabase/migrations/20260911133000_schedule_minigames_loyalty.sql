-- Stream schedule, chat minigames, and loyalty economy.
-- Owner RLS matches custom_chat_commands: authenticated users manage their own rows.
-- Public reads (share URLs, webhooks) go through service_role.

-- ---------------------------------------------------------------------------
-- Schedule
-- ---------------------------------------------------------------------------
CREATE TABLE public.stream_schedule_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  timezone text NOT NULL DEFAULT 'UTC',
  title text NOT NULL DEFAULT 'Stream schedule',
  reminder_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stream_schedule_settings_title_len CHECK (char_length(title) BETWEEN 1 AND 80),
  CONSTRAINT stream_schedule_settings_note_len CHECK (char_length(reminder_note) <= 280),
  CONSTRAINT stream_schedule_settings_tz_len CHECK (char_length(timezone) BETWEEN 1 AND 64)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stream_schedule_settings TO authenticated;
GRANT ALL ON public.stream_schedule_settings TO service_role;
ALTER TABLE public.stream_schedule_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage stream schedule settings" ON public.stream_schedule_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER stream_schedule_settings_updated_at BEFORE UPDATE ON public.stream_schedule_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.stream_schedule_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday smallint NOT NULL,
  start_minutes integer NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 180,
  game text NOT NULL DEFAULT '',
  title text NOT NULL,
  notes text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stream_schedule_slots_weekday CHECK (weekday >= 0 AND weekday <= 6),
  CONSTRAINT stream_schedule_slots_start CHECK (start_minutes >= 0 AND start_minutes < 1440),
  CONSTRAINT stream_schedule_slots_duration CHECK (duration_minutes >= 15 AND duration_minutes <= 1440),
  CONSTRAINT stream_schedule_slots_title_len CHECK (char_length(title) BETWEEN 1 AND 80),
  CONSTRAINT stream_schedule_slots_game_len CHECK (char_length(game) <= 80),
  CONSTRAINT stream_schedule_slots_notes_len CHECK (char_length(notes) <= 280)
);

CREATE INDEX stream_schedule_slots_user_idx ON public.stream_schedule_slots (user_id, weekday, start_minutes);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stream_schedule_slots TO authenticated;
GRANT ALL ON public.stream_schedule_slots TO service_role;
ALTER TABLE public.stream_schedule_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage stream schedule slots" ON public.stream_schedule_slots
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER stream_schedule_slots_updated_at BEFORE UPDATE ON public.stream_schedule_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Chat minigames
-- ---------------------------------------------------------------------------
CREATE TABLE public.chat_minigames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_type text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  prize_text text NOT NULL DEFAULT '',
  duration_seconds integer NOT NULL DEFAULT 60,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_minigames_type CHECK (game_type IN ('guessing', 'treasure', 'quiz')),
  CONSTRAINT chat_minigames_duration CHECK (duration_seconds >= 10 AND duration_seconds <= 600),
  CONSTRAINT chat_minigames_prize_len CHECK (char_length(prize_text) <= 160)
);

CREATE UNIQUE INDEX chat_minigames_user_type_idx ON public.chat_minigames (user_id, game_type);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_minigames TO authenticated;
GRANT ALL ON public.chat_minigames TO service_role;
ALTER TABLE public.chat_minigames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage chat minigames" ON public.chat_minigames
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER chat_minigames_updated_at BEFORE UPDATE ON public.chat_minigames
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.chat_minigame_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.chat_minigames(id) ON DELETE CASCADE,
  game_type text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  prompt text NOT NULL,
  secret text,
  prize_text text NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  winner_username text,
  winner_platform text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_minigame_rounds_status CHECK (status IN ('active', 'won', 'expired')),
  CONSTRAINT chat_minigame_rounds_type CHECK (game_type IN ('guessing', 'treasure', 'quiz'))
);

CREATE UNIQUE INDEX chat_minigame_rounds_one_active
  ON public.chat_minigame_rounds (user_id) WHERE status = 'active';
CREATE INDEX chat_minigame_rounds_user_idx ON public.chat_minigame_rounds (user_id, started_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_minigame_rounds TO authenticated;
GRANT ALL ON public.chat_minigame_rounds TO service_role;
ALTER TABLE public.chat_minigame_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage chat minigame rounds" ON public.chat_minigame_rounds
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER chat_minigame_rounds_updated_at BEFORE UPDATE ON public.chat_minigame_rounds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Loyalty
-- ---------------------------------------------------------------------------
CREATE TABLE public.loyalty_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  redeem_command text NOT NULL DEFAULT 'redeem',
  chat_points integer NOT NULL DEFAULT 1,
  chat_cooldown_seconds integer NOT NULL DEFAULT 60,
  watch_bonus_points integer NOT NULL DEFAULT 5,
  watch_window_minutes integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_settings_command_len CHECK (char_length(redeem_command) BETWEEN 1 AND 24),
  CONSTRAINT loyalty_settings_chat_points CHECK (chat_points >= 0 AND chat_points <= 50),
  CONSTRAINT loyalty_settings_cooldown CHECK (chat_cooldown_seconds >= 10 AND chat_cooldown_seconds <= 600),
  CONSTRAINT loyalty_settings_watch_bonus CHECK (watch_bonus_points >= 0 AND watch_bonus_points <= 100),
  CONSTRAINT loyalty_settings_watch_window CHECK (watch_window_minutes >= 5 AND watch_window_minutes <= 60)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_settings TO authenticated;
GRANT ALL ON public.loyalty_settings TO service_role;
ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage loyalty settings" ON public.loyalty_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER loyalty_settings_updated_at BEFORE UPDATE ON public.loyalty_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.loyalty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  cost integer NOT NULL,
  reward_type text NOT NULL,
  payload text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_rewards_name_len CHECK (char_length(name) BETWEEN 1 AND 48),
  CONSTRAINT loyalty_rewards_slug_len CHECK (char_length(slug) BETWEEN 1 AND 32),
  CONSTRAINT loyalty_rewards_cost CHECK (cost >= 1 AND cost <= 100000),
  CONSTRAINT loyalty_rewards_type CHECK (reward_type IN ('sound', 'song', 'highlight')),
  CONSTRAINT loyalty_rewards_payload_len CHECK (char_length(payload) <= 160)
);

CREATE UNIQUE INDEX loyalty_rewards_user_slug_idx ON public.loyalty_rewards (user_id, lower(slug));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_rewards TO authenticated;
GRANT ALL ON public.loyalty_rewards TO service_role;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage loyalty rewards" ON public.loyalty_rewards
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER loyalty_rewards_updated_at BEFORE UPDATE ON public.loyalty_rewards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.loyalty_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewer_key text NOT NULL,
  username text NOT NULL,
  platform text NOT NULL DEFAULT 'KICK',
  points integer NOT NULL DEFAULT 0,
  last_chat_at timestamptz,
  last_watch_bonus_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_balances_points CHECK (points >= 0)
);

CREATE UNIQUE INDEX loyalty_balances_user_viewer_idx ON public.loyalty_balances (user_id, viewer_key);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_balances TO authenticated;
GRANT ALL ON public.loyalty_balances TO service_role;
ALTER TABLE public.loyalty_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage loyalty balances" ON public.loyalty_balances
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER loyalty_balances_updated_at BEFORE UPDATE ON public.loyalty_balances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.loyalty_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id uuid REFERENCES public.loyalty_rewards(id) ON DELETE SET NULL,
  viewer_key text NOT NULL,
  username text NOT NULL,
  platform text NOT NULL DEFAULT 'KICK',
  reward_name text NOT NULL,
  reward_type text NOT NULL,
  cost integer NOT NULL,
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_redemptions_status CHECK (status IN ('queued', 'done', 'cancelled'))
);

CREATE INDEX loyalty_redemptions_user_idx ON public.loyalty_redemptions (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_redemptions TO authenticated;
GRANT ALL ON public.loyalty_redemptions TO service_role;
ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage loyalty redemptions" ON public.loyalty_redemptions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
