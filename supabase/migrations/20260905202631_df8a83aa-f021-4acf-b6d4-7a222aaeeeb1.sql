ALTER TABLE public.giveaway_settings
  ADD COLUMN IF NOT EXISTS overlay_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS draw_state jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS giveaway_settings_overlay_token_key ON public.giveaway_settings (overlay_token);