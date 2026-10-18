-- Link-in-bio: one profile per user, globally unique slugs (reserved even when unpublished).

CREATE TABLE public.link_in_bio_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  avatar_url text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT link_in_bio_profiles_slug_format
    CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$'),
  CONSTRAINT link_in_bio_profiles_display_name_len CHECK (char_length(display_name) <= 80),
  CONSTRAINT link_in_bio_profiles_bio_len CHECK (char_length(bio) <= 400),
  CONSTRAINT link_in_bio_profiles_avatar_len CHECK (char_length(avatar_url) <= 80000)
);

CREATE UNIQUE INDEX link_in_bio_profiles_slug_unique
  ON public.link_in_bio_profiles (slug);

CREATE TABLE public.link_in_bio_themes (
  user_id uuid PRIMARY KEY REFERENCES public.link_in_bio_profiles(user_id) ON DELETE CASCADE,
  glass_intensity integer NOT NULL DEFAULT 45,
  hairline_borders boolean NOT NULL DEFAULT true,
  glow_strength integer NOT NULL DEFAULT 35,
  gradient_style text NOT NULL DEFAULT 'soft',
  font_family text NOT NULL DEFAULT 'manrope',
  palette_bg text NOT NULL DEFAULT '#0f1117',
  palette_fg text NOT NULL DEFAULT '#f4f4f5',
  palette_accent text NOT NULL DEFAULT '#7c8cff',
  palette_muted text NOT NULL DEFAULT '#a1a1aa',
  surface_style text NOT NULL DEFAULT 'glass',
  layout text NOT NULL DEFAULT 'list',
  default_card_size text NOT NULL DEFAULT 'm',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT link_in_bio_themes_glass CHECK (glass_intensity BETWEEN 0 AND 100),
  CONSTRAINT link_in_bio_themes_glow CHECK (glow_strength BETWEEN 0 AND 100),
  CONSTRAINT link_in_bio_themes_gradient CHECK (gradient_style IN ('none', 'soft', 'aurora', 'horizon')),
  CONSTRAINT link_in_bio_themes_font CHECK (char_length(font_family) BETWEEN 1 AND 40),
  CONSTRAINT link_in_bio_themes_surface CHECK (surface_style IN ('flat', 'glass')),
  CONSTRAINT link_in_bio_themes_layout CHECK (layout IN ('list', 'grid', 'spotlight', 'banner')),
  CONSTRAINT link_in_bio_themes_card CHECK (default_card_size IN ('s', 'm', 'l')),
  CONSTRAINT link_in_bio_themes_hex_bg CHECK (palette_bg ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT link_in_bio_themes_hex_fg CHECK (palette_fg ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT link_in_bio_themes_hex_accent CHECK (palette_accent ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT link_in_bio_themes_hex_muted CHECK (palette_muted ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE TABLE public.link_in_bio_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.link_in_bio_profiles(user_id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  platform text NOT NULL DEFAULT 'custom',
  card_size text NOT NULL DEFAULT 'inherit',
  sort_order integer NOT NULL DEFAULT 0,
  featured boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT link_in_bio_links_title_len CHECK (char_length(title) BETWEEN 1 AND 80),
  CONSTRAINT link_in_bio_links_url_len CHECK (char_length(url) BETWEEN 8 AND 2048),
  CONSTRAINT link_in_bio_links_platform CHECK (
    platform IN ('kick', 'twitch', 'youtube', 'tiktok', 'instagram', 'x', 'discord', 'custom')
  ),
  CONSTRAINT link_in_bio_links_card CHECK (card_size IN ('inherit', 's', 'm', 'l'))
);

CREATE INDEX link_in_bio_links_user_order_idx
  ON public.link_in_bio_links (user_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.link_in_bio_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.link_in_bio_themes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.link_in_bio_links TO authenticated;
GRANT ALL ON public.link_in_bio_profiles TO service_role;
GRANT ALL ON public.link_in_bio_themes TO service_role;
GRANT ALL ON public.link_in_bio_links TO service_role;

ALTER TABLE public.link_in_bio_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_in_bio_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_in_bio_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage link-in-bio profiles" ON public.link_in_bio_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners manage link-in-bio themes" ON public.link_in_bio_themes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners manage link-in-bio links" ON public.link_in_bio_links
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER link_in_bio_profiles_updated_at BEFORE UPDATE ON public.link_in_bio_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER link_in_bio_themes_updated_at BEFORE UPDATE ON public.link_in_bio_themes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER link_in_bio_links_updated_at BEFORE UPDATE ON public.link_in_bio_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
