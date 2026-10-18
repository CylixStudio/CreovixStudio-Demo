ALTER TABLE public.link_in_bio_themes
  ADD COLUMN IF NOT EXISTS bento_color_mode text NOT NULL DEFAULT 'brand',
  ADD COLUMN IF NOT EXISTS bento_custom_fill text NOT NULL DEFAULT '#1a1c24',
  ADD COLUMN IF NOT EXISTS bento_custom_accent text NOT NULL DEFAULT '#7c8cff';

ALTER TABLE public.link_in_bio_themes
  DROP CONSTRAINT IF EXISTS link_in_bio_themes_bento_color_mode;

ALTER TABLE public.link_in_bio_themes
  ADD CONSTRAINT link_in_bio_themes_bento_color_mode CHECK (
    bento_color_mode IN ('brand', 'mono', 'gradient', 'glow', 'glass', 'custom')
  );
