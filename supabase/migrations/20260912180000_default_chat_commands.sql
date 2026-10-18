CREATE TABLE public.default_chat_commands (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  command_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  response text NOT NULL,
  fallback_response text NOT NULL DEFAULT '',
  platforms text[] NOT NULL DEFAULT ARRAY['KICK','TWITCH']::text[],
  cooldown_seconds integer NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, command_id),
  CONSTRAINT default_chat_commands_id_check
    CHECK (command_id IN ('commands', 'followage', 'lurk', 'so', 'welcome')),
  CONSTRAINT default_chat_commands_response_len CHECK (char_length(response) BETWEEN 1 AND 480),
  CONSTRAINT default_chat_commands_fallback_len CHECK (char_length(fallback_response) <= 480),
  CONSTRAINT default_chat_commands_cooldown CHECK (cooldown_seconds >= 0 AND cooldown_seconds <= 3600)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.default_chat_commands TO authenticated;
GRANT ALL ON public.default_chat_commands TO service_role;
ALTER TABLE public.default_chat_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage default chat commands" ON public.default_chat_commands
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER default_chat_commands_updated_at BEFORE UPDATE ON public.default_chat_commands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
