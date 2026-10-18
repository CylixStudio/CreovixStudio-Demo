ALTER TABLE public.link_in_bio_links
  DROP CONSTRAINT IF EXISTS link_in_bio_links_platform;

ALTER TABLE public.link_in_bio_links
  ADD CONSTRAINT link_in_bio_links_platform CHECK (
    platform IN ('kick', 'twitch', 'youtube', 'tiktok', 'instagram', 'x', 'discord', 'whatsapp', 'custom')
  );

ALTER TABLE public.link_in_bio_themes
  ADD COLUMN IF NOT EXISTS font_custom_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS font_custom_href text NOT NULL DEFAULT '';

ALTER TABLE public.link_in_bio_themes
  DROP CONSTRAINT IF EXISTS link_in_bio_themes_font_custom_name_len,
  DROP CONSTRAINT IF EXISTS link_in_bio_themes_font_custom_href_len;

ALTER TABLE public.link_in_bio_themes
  ADD CONSTRAINT link_in_bio_themes_font_custom_name_len CHECK (char_length(font_custom_name) <= 40),
  ADD CONSTRAINT link_in_bio_themes_font_custom_href_len CHECK (char_length(font_custom_href) <= 2048);
