ALTER TABLE public.media_requests
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'YOUTUBE',
  ADD COLUMN IF NOT EXISTS artist TEXT;

ALTER TABLE public.media_requests
  DROP CONSTRAINT IF EXISTS media_requests_platform_check;

ALTER TABLE public.media_requests
  ADD CONSTRAINT media_requests_platform_check
  CHECK (platform IN ('YOUTUBE', 'SPOTIFY', 'ANGHAMI', 'SOUNDCLOUD'));

CREATE INDEX IF NOT EXISTS media_requests_platform_idx
  ON public.media_requests (user_id, platform);
