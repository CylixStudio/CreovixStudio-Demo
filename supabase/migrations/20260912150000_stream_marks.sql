CREATE TABLE public.stream_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  author text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'KICK',
  note text NOT NULL DEFAULT '',
  viewer_is_mod boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stream_marks_note_len CHECK (char_length(note) <= 280),
  CONSTRAINT stream_marks_source CHECK (source IN ('KICK', 'TWITCH', 'STUDIO')),
  CONSTRAINT stream_marks_duration CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  CONSTRAINT stream_marks_range CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX stream_marks_user_started_idx
  ON public.stream_marks (user_id, started_at DESC);
CREATE INDEX stream_marks_user_open_idx
  ON public.stream_marks (user_id, started_at DESC)
  WHERE ended_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stream_marks TO authenticated;
GRANT ALL ON public.stream_marks TO service_role;
ALTER TABLE public.stream_marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage stream marks" ON public.stream_marks
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER stream_marks_updated_at BEFORE UPDATE ON public.stream_marks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
