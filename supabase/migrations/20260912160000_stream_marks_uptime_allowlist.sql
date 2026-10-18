ALTER TABLE public.stream_marks
  ADD COLUMN IF NOT EXISTS uptime_start_seconds integer,
  ADD COLUMN IF NOT EXISTS uptime_end_seconds integer,
  ADD COLUMN IF NOT EXISTS stream_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS offline boolean NOT NULL DEFAULT false;

ALTER TABLE public.stream_marks
  DROP CONSTRAINT IF EXISTS stream_marks_uptime_start;
ALTER TABLE public.stream_marks
  ADD CONSTRAINT stream_marks_uptime_start
  CHECK (uptime_start_seconds IS NULL OR uptime_start_seconds >= 0);

ALTER TABLE public.stream_marks
  DROP CONSTRAINT IF EXISTS stream_marks_uptime_end;
ALTER TABLE public.stream_marks
  ADD CONSTRAINT stream_marks_uptime_end
  CHECK (uptime_end_seconds IS NULL OR uptime_end_seconds >= 0);

CREATE TABLE public.mark_point_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mark_point_allowlist_username_len CHECK (char_length(username) BETWEEN 1 AND 32)
);

CREATE UNIQUE INDEX mark_point_allowlist_user_name_idx
  ON public.mark_point_allowlist (user_id, lower(username));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mark_point_allowlist TO authenticated;
GRANT ALL ON public.mark_point_allowlist TO service_role;
ALTER TABLE public.mark_point_allowlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage mark point allowlist" ON public.mark_point_allowlist
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
