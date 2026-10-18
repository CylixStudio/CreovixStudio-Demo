ALTER TABLE public.clips ADD COLUMN IF NOT EXISTS share_url text;

CREATE TABLE IF NOT EXISTS public.kick_stream_buffers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL,
  variant_url text,
  variant_refreshed_at timestamptz,
  segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.kick_stream_buffers TO service_role;
ALTER TABLE public.kick_stream_buffers ENABLE ROW LEVEL SECURITY;
