ALTER TABLE public.stream_marks
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.stream_marks
  DROP CONSTRAINT IF EXISTS stream_marks_status;
ALTER TABLE public.stream_marks
  ADD CONSTRAINT stream_marks_status
  CHECK (status IN ('pending', 'approved', 'rejected'));

CREATE TABLE IF NOT EXISTS public.mark_point_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token text NOT NULL DEFAULT encode(gen_random_bytes(18), 'hex'),
  kick_username text NOT NULL DEFAULT '',
  cached_staff text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mark_point_settings_share_token_idx
  ON public.mark_point_settings (share_token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mark_point_settings TO authenticated;
GRANT ALL ON public.mark_point_settings TO service_role;
ALTER TABLE public.mark_point_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage mark point settings" ON public.mark_point_settings;
CREATE POLICY "Owners manage mark point settings" ON public.mark_point_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS mark_point_settings_updated_at ON public.mark_point_settings;
CREATE TRIGGER mark_point_settings_updated_at BEFORE UPDATE ON public.mark_point_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
