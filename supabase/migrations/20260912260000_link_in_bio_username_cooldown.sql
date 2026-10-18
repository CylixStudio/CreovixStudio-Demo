ALTER TABLE public.link_in_bio_profiles
  ADD COLUMN IF NOT EXISTS username_changed_at timestamptz;
