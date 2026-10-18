CREATE TABLE public.custom_chat_command_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_prefix text NOT NULL DEFAULT '!',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_chat_command_settings TO authenticated;
GRANT ALL ON public.custom_chat_command_settings TO service_role;
ALTER TABLE public.custom_chat_command_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage custom chat command settings" ON public.custom_chat_command_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER custom_chat_command_settings_updated_at BEFORE UPDATE ON public.custom_chat_command_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.custom_chat_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  prefix text,
  response text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  platforms text[] NOT NULL DEFAULT ARRAY['KICK','TWITCH']::text[],
  roles text[] NOT NULL DEFAULT ARRAY['Everyone']::text[],
  cooldown_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT custom_chat_commands_name_len CHECK (char_length(name) BETWEEN 1 AND 32),
  CONSTRAINT custom_chat_commands_prefix_len CHECK (prefix IS NULL OR char_length(prefix) <= 8),
  CONSTRAINT custom_chat_commands_response_len CHECK (char_length(response) BETWEEN 1 AND 480),
  CONSTRAINT custom_chat_commands_cooldown CHECK (cooldown_seconds >= 0 AND cooldown_seconds <= 3600)
);

CREATE UNIQUE INDEX custom_chat_commands_user_name_idx
  ON public.custom_chat_commands (user_id, lower(name));
CREATE INDEX custom_chat_commands_user_enabled_idx
  ON public.custom_chat_commands (user_id) WHERE enabled;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_chat_commands TO authenticated;
GRANT ALL ON public.custom_chat_commands TO service_role;
ALTER TABLE public.custom_chat_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage custom chat commands" ON public.custom_chat_commands
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER custom_chat_commands_updated_at BEFORE UPDATE ON public.custom_chat_commands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
