ALTER TABLE public.link_in_bio_profiles
  ADD COLUMN IF NOT EXISTS header_url text NOT NULL DEFAULT '';

ALTER TABLE public.link_in_bio_profiles
  DROP CONSTRAINT IF EXISTS link_in_bio_profiles_header_len;

ALTER TABLE public.link_in_bio_profiles
  ADD CONSTRAINT link_in_bio_profiles_header_len CHECK (char_length(header_url) <= 80000);

ALTER TABLE public.link_in_bio_themes
  ADD COLUMN IF NOT EXISTS schedule_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS widget_banner_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS countdown_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS countdown_label text NOT NULL DEFAULT 'Going live',
  ADD COLUMN IF NOT EXISTS countdown_ends_at timestamptz;

ALTER TABLE public.link_in_bio_themes
  DROP CONSTRAINT IF EXISTS link_in_bio_themes_banner_len,
  DROP CONSTRAINT IF EXISTS link_in_bio_themes_countdown_label_len;

ALTER TABLE public.link_in_bio_themes
  ADD CONSTRAINT link_in_bio_themes_banner_len CHECK (char_length(widget_banner_url) <= 80000),
  ADD CONSTRAINT link_in_bio_themes_countdown_label_len CHECK (char_length(countdown_label) <= 80);
