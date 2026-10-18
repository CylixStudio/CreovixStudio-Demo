ALTER TABLE public.link_in_bio_themes
  ADD COLUMN IF NOT EXISTS ambient_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ambient_preset text NOT NULL DEFAULT 'glow';

ALTER TABLE public.link_in_bio_themes
  DROP CONSTRAINT IF EXISTS link_in_bio_themes_ambient;

ALTER TABLE public.link_in_bio_themes
  ADD CONSTRAINT link_in_bio_themes_ambient
    CHECK (ambient_preset IN ('none', 'glow', 'orbits', 'haze', 'ripple'));
