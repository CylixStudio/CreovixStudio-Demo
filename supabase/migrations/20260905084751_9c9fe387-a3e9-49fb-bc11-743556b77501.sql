ALTER TABLE public.media_request_settings
  ADD COLUMN IF NOT EXISTS request_mode text NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS mod_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex');

UPDATE public.media_request_settings
  SET request_mode = CASE WHEN require_approval THEN 'MANUAL' ELSE 'AUTO' END;

ALTER TABLE public.media_request_settings
  DROP CONSTRAINT IF EXISTS media_request_settings_request_mode_check;
ALTER TABLE public.media_request_settings
  ADD CONSTRAINT media_request_settings_request_mode_check
  CHECK (request_mode IN ('AUTO', 'MANUAL', 'PAUSED'));

CREATE UNIQUE INDEX IF NOT EXISTS media_request_settings_mod_token_key
  ON public.media_request_settings (mod_token);