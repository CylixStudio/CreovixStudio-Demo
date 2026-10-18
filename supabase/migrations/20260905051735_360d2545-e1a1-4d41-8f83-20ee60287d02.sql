CREATE TABLE public.media_request_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  kick_reward_id TEXT,
  require_approval BOOLEAN NOT NULL DEFAULT true,
  max_duration_seconds INTEGER NOT NULL DEFAULT 300 CHECK (max_duration_seconds BETWEEN 15 AND 21600),
  min_view_count BIGINT NOT NULL DEFAULT 1000 CHECK (min_view_count >= 0),
  keyword_blacklist TEXT[] NOT NULL DEFAULT '{}',
  user_blacklist TEXT[] NOT NULL DEFAULT '{}',
  display_mode TEXT NOT NULL DEFAULT 'VIDEO' CHECK (display_mode IN ('VIDEO', 'AUDIO_ONLY')),
  volume INTEGER NOT NULL DEFAULT 80 CHECK (volume BETWEEN 0 AND 100),
  overlay_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_request_settings TO authenticated;
GRANT ALL ON public.media_request_settings TO service_role;
ALTER TABLE public.media_request_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "media_request_settings_owner" ON public.media_request_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER media_request_settings_updated_at BEFORE UPDATE ON public.media_request_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.media_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider_event_id TEXT,
  reward_redemption_id TEXT,
  reward_id TEXT,
  requester_platform_id TEXT,
  requester_username TEXT NOT NULL,
  requester_avatar_url TEXT,
  youtube_video_id TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
  view_count BIGINT CHECK (view_count IS NULL OR view_count >= 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'QUEUED', 'PLAYING', 'PLAYED', 'REJECTED', 'SKIPPED')),
  position BIGINT,
  rejection_reason TEXT,
  refunded_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT media_requests_provider_event_unique UNIQUE (provider_event_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_requests TO authenticated;
GRANT ALL ON public.media_requests TO service_role;
ALTER TABLE public.media_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "media_requests_owner" ON public.media_requests FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX media_requests_queue_idx ON public.media_requests(user_id, status, position, created_at);
CREATE INDEX media_requests_video_idx ON public.media_requests(user_id, youtube_video_id);
CREATE UNIQUE INDEX media_requests_active_video_unique ON public.media_requests(user_id, youtube_video_id) WHERE status IN ('PENDING', 'QUEUED', 'PLAYING');
CREATE TRIGGER media_requests_updated_at BEFORE UPDATE ON public.media_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.media_playback_state (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  current_request_id UUID REFERENCES public.media_requests(id) ON DELETE SET NULL,
  playback_status TEXT NOT NULL DEFAULT 'IDLE' CHECK (playback_status IN ('IDLE', 'PLAYING', 'PAUSED')),
  position_seconds NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (position_seconds >= 0),
  started_at TIMESTAMPTZ,
  volume INTEGER NOT NULL DEFAULT 80 CHECK (volume BETWEEN 0 AND 100),
  revision BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_playback_state TO authenticated;
GRANT ALL ON public.media_playback_state TO service_role;
ALTER TABLE public.media_playback_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "media_playback_state_owner" ON public.media_playback_state FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER media_playback_state_updated_at BEFORE UPDATE ON public.media_playback_state FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.media_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.media_playback_state;