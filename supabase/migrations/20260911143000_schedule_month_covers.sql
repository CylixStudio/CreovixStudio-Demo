-- Dated one-off sessions + circular cover images for the month calendar.
ALTER TABLE public.stream_schedule_slots
  ADD COLUMN IF NOT EXISTS occurs_on date,
  ADD COLUMN IF NOT EXISTS cover_url text NOT NULL DEFAULT '';

ALTER TABLE public.stream_schedule_slots
  DROP CONSTRAINT IF EXISTS stream_schedule_slots_cover_len;
ALTER TABLE public.stream_schedule_slots
  ADD CONSTRAINT stream_schedule_slots_cover_len CHECK (char_length(cover_url) <= 40000);

ALTER TABLE public.stream_schedule_slots
  DROP CONSTRAINT IF EXISTS stream_schedule_slots_date_weekday;
ALTER TABLE public.stream_schedule_slots
  ADD CONSTRAINT stream_schedule_slots_date_weekday CHECK (
    occurs_on IS NULL OR weekday = (EXTRACT(DOW FROM occurs_on))::smallint
  );

CREATE INDEX IF NOT EXISTS stream_schedule_slots_occurs_on_idx
  ON public.stream_schedule_slots (user_id, occurs_on)
  WHERE occurs_on IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'schedule-covers',
  'schedule-covers',
  true,
  524288,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Schedule covers: public read" ON storage.objects;
DROP POLICY IF EXISTS "Schedule covers: owners upload" ON storage.objects;
DROP POLICY IF EXISTS "Schedule covers: owners update" ON storage.objects;
DROP POLICY IF EXISTS "Schedule covers: owners delete" ON storage.objects;

CREATE POLICY "Schedule covers: public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'schedule-covers');

CREATE POLICY "Schedule covers: owners upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'schedule-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Schedule covers: owners update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'schedule-covers' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'schedule-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Schedule covers: owners delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'schedule-covers' AND (storage.foldername(name))[1] = auth.uid()::text);
