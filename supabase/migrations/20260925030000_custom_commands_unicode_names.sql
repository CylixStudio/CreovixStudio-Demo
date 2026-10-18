-- Ensure custom chat command tables exist and are visible to PostgREST.
-- Fixes: "Could not find the table 'public.custom_chat_commands' in the schema cache"
-- Columns match the app: name, prefix, response, enabled, platforms, roles, cooldown_seconds.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Profile table (FK target). Safe if already applied by earlier migrations.
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  name TEXT,
  image TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.custom_chat_command_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_prefix text NOT NULL DEFAULT '!',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.custom_chat_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  prefix text,
  response text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  platforms text[] NOT NULL DEFAULT ARRAY['KICK', 'TWITCH']::text[],
  roles text[] NOT NULL DEFAULT ARRAY['Everyone']::text[],
  cooldown_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add any missing columns on older partial installs.
ALTER TABLE public.custom_chat_commands
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS prefix text,
  ADD COLUMN IF NOT EXISTS response text,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS platforms text[] NOT NULL DEFAULT ARRAY['KICK', 'TWITCH']::text[],
  ADD COLUMN IF NOT EXISTS roles text[] NOT NULL DEFAULT ARRAY['Everyone']::text[],
  ADD COLUMN IF NOT EXISTS cooldown_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Make required columns safe if an older row set left them nullable.
UPDATE public.custom_chat_commands SET name = 'command' WHERE name IS NULL OR btrim(name) = '';
UPDATE public.custom_chat_commands SET response = '{user}' WHERE response IS NULL OR btrim(response) = '';
ALTER TABLE public.custom_chat_commands ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.custom_chat_commands ALTER COLUMN response SET NOT NULL;
ALTER TABLE public.custom_chat_commands ALTER COLUMN enabled SET DEFAULT true;
ALTER TABLE public.custom_chat_commands ALTER COLUMN platforms SET DEFAULT ARRAY['KICK', 'TWITCH']::text[];
ALTER TABLE public.custom_chat_commands ALTER COLUMN roles SET DEFAULT ARRAY['Everyone']::text[];
ALTER TABLE public.custom_chat_commands ALTER COLUMN cooldown_seconds SET DEFAULT 0;

-- Unicode-friendly length checks (no ASCII-only name format).
ALTER TABLE public.custom_chat_commands
  DROP CONSTRAINT IF EXISTS custom_chat_commands_name_format;
ALTER TABLE public.custom_chat_commands
  DROP CONSTRAINT IF EXISTS custom_chat_commands_name_ascii;
ALTER TABLE public.custom_chat_commands
  DROP CONSTRAINT IF EXISTS custom_chat_commands_name_len;
ALTER TABLE public.custom_chat_commands
  ADD CONSTRAINT custom_chat_commands_name_len CHECK (char_length(name) BETWEEN 1 AND 32);

ALTER TABLE public.custom_chat_commands
  DROP CONSTRAINT IF EXISTS custom_chat_commands_prefix_len;
ALTER TABLE public.custom_chat_commands
  ADD CONSTRAINT custom_chat_commands_prefix_len CHECK (prefix IS NULL OR char_length(prefix) <= 8);

ALTER TABLE public.custom_chat_commands
  DROP CONSTRAINT IF EXISTS custom_chat_commands_response_len;
ALTER TABLE public.custom_chat_commands
  ADD CONSTRAINT custom_chat_commands_response_len CHECK (char_length(response) BETWEEN 1 AND 480);

ALTER TABLE public.custom_chat_commands
  DROP CONSTRAINT IF EXISTS custom_chat_commands_cooldown;
ALTER TABLE public.custom_chat_commands
  ADD CONSTRAINT custom_chat_commands_cooldown CHECK (cooldown_seconds >= 0 AND cooldown_seconds <= 3600);

DROP INDEX IF EXISTS custom_chat_commands_user_name_idx;
CREATE UNIQUE INDEX custom_chat_commands_user_name_idx
  ON public.custom_chat_commands (user_id, lower(name));
CREATE INDEX IF NOT EXISTS custom_chat_commands_user_enabled_idx
  ON public.custom_chat_commands (user_id) WHERE enabled;

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_chat_command_settings TO authenticated;
GRANT ALL ON public.custom_chat_command_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_chat_commands TO authenticated;
GRANT ALL ON public.custom_chat_commands TO service_role;

ALTER TABLE public.custom_chat_command_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_chat_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage custom chat command settings" ON public.custom_chat_command_settings;
CREATE POLICY "Owners manage custom chat command settings"
  ON public.custom_chat_command_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners manage custom chat commands" ON public.custom_chat_commands;
CREATE POLICY "Owners manage custom chat commands"
  ON public.custom_chat_commands
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS custom_chat_command_settings_updated_at ON public.custom_chat_command_settings;
CREATE TRIGGER custom_chat_command_settings_updated_at
  BEFORE UPDATE ON public.custom_chat_command_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS custom_chat_commands_updated_at ON public.custom_chat_commands;
CREATE TRIGGER custom_chat_commands_updated_at
  BEFORE UPDATE ON public.custom_chat_commands
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Force PostgREST to pick up the tables immediately.
NOTIFY pgrst, 'reload schema';
