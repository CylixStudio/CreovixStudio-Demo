CREATE TABLE public.message_timers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  interval_minutes integer NOT NULL DEFAULT 15,
  enabled boolean NOT NULL DEFAULT true,
  platforms text[] NOT NULL DEFAULT ARRAY['KICK']::text[],
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_timers_message_len CHECK (char_length(message) BETWEEN 1 AND 480),
  CONSTRAINT message_timers_interval CHECK (interval_minutes >= 1 AND interval_minutes <= 1440)
);

CREATE INDEX message_timers_user_enabled_idx
  ON public.message_timers (user_id) WHERE enabled;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_timers TO authenticated;
GRANT ALL ON public.message_timers TO service_role;
ALTER TABLE public.message_timers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage message timers" ON public.message_timers
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER message_timers_updated_at BEFORE UPDATE ON public.message_timers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
