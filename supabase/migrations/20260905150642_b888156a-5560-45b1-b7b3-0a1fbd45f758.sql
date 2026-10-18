CREATE TABLE public.clip_command_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  roles text[] NOT NULL DEFAULT ARRAY['Everyone']::text[],
  default_length integer NOT NULL DEFAULT 30,
  max_length integer NOT NULL DEFAULT 120,
  response text NOT NULL DEFAULT '@{user} {clip_url}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clip_command_settings TO authenticated;
GRANT ALL ON public.clip_command_settings TO service_role;
ALTER TABLE public.clip_command_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage clip command settings" ON public.clip_command_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER clip_command_settings_updated_at BEFORE UPDATE ON public.clip_command_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform public.platform_type NOT NULL DEFAULT 'KICK',
  external_id text,
  title text NOT NULL DEFAULT 'Clip',
  url text NOT NULL,
  thumbnail_url text,
  duration_seconds integer NOT NULL DEFAULT 30,
  view_count integer NOT NULL DEFAULT 0,
  clipped_by text NOT NULL DEFAULT 'viewer',
  clipped_by_platform_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX clips_user_created_idx ON public.clips (user_id, created_at DESC);
CREATE UNIQUE INDEX clips_user_external_idx ON public.clips (user_id, platform, external_id) WHERE external_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clips TO authenticated;
GRANT ALL ON public.clips TO service_role;
ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their clips" ON public.clips
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER clips_updated_at BEFORE UPDATE ON public.clips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();