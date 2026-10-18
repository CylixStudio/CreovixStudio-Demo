-- Bento positions, gallery modules, setup-complete flag, public image bucket.

ALTER TABLE public.link_in_bio_profiles
  ADD COLUMN IF NOT EXISTS setup_completed boolean NOT NULL DEFAULT false;

UPDATE public.link_in_bio_profiles p
SET setup_completed = true
WHERE setup_completed = false
  AND (
    p.published
    OR p.display_name <> ''
    OR EXISTS (SELECT 1 FROM public.link_in_bio_links l WHERE l.user_id = p.user_id)
  );

ALTER TABLE public.link_in_bio_links
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'link',
  ADD COLUMN IF NOT EXISTS grid_x integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grid_y integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS col_span integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS row_span integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS gallery_images jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.link_in_bio_links
  DROP CONSTRAINT IF EXISTS link_in_bio_links_kind,
  DROP CONSTRAINT IF EXISTS link_in_bio_links_grid_x,
  DROP CONSTRAINT IF EXISTS link_in_bio_links_grid_y,
  DROP CONSTRAINT IF EXISTS link_in_bio_links_col_span,
  DROP CONSTRAINT IF EXISTS link_in_bio_links_row_span,
  DROP CONSTRAINT IF EXISTS link_in_bio_links_gallery,
  DROP CONSTRAINT IF EXISTS link_in_bio_links_url_len,
  DROP CONSTRAINT IF EXISTS link_in_bio_links_url_ok;

ALTER TABLE public.link_in_bio_links
  ADD CONSTRAINT link_in_bio_links_kind CHECK (kind IN ('link', 'gallery')),
  ADD CONSTRAINT link_in_bio_links_grid_x CHECK (grid_x BETWEEN 0 AND 3),
  ADD CONSTRAINT link_in_bio_links_grid_y CHECK (grid_y BETWEEN 0 AND 40),
  ADD CONSTRAINT link_in_bio_links_col_span CHECK (col_span IN (1, 2)),
  ADD CONSTRAINT link_in_bio_links_row_span CHECK (row_span IN (1, 2)),
  ADD CONSTRAINT link_in_bio_links_gallery CHECK (jsonb_typeof(gallery_images) = 'array'),
  ADD CONSTRAINT link_in_bio_links_url_ok CHECK (
    (kind = 'gallery' AND char_length(url) <= 2048)
    OR (kind = 'link' AND char_length(url) BETWEEN 8 AND 2048)
  );

ALTER TABLE public.link_in_bio_themes
  DROP CONSTRAINT IF EXISTS link_in_bio_themes_layout;

ALTER TABLE public.link_in_bio_themes
  ALTER COLUMN layout SET DEFAULT 'bento';

ALTER TABLE public.link_in_bio_themes
  ADD CONSTRAINT link_in_bio_themes_layout
  CHECK (layout IN ('bento', 'list', 'grid', 'spotlight', 'banner'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'link-in-bio',
  'link-in-bio',
  true,
  524288,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Link in bio: public read" ON storage.objects;
DROP POLICY IF EXISTS "Link in bio: owners upload" ON storage.objects;
DROP POLICY IF EXISTS "Link in bio: owners update" ON storage.objects;
DROP POLICY IF EXISTS "Link in bio: owners delete" ON storage.objects;

CREATE POLICY "Link in bio: public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'link-in-bio');

CREATE POLICY "Link in bio: owners upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'link-in-bio' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Link in bio: owners update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'link-in-bio' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'link-in-bio' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Link in bio: owners delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'link-in-bio' AND (storage.foldername(name))[1] = auth.uid()::text);
