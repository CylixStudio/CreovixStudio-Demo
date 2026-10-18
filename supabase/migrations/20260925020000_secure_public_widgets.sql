-- Ensure public.widgets (+ goals) exist and are visible to PostgREST.
-- Fixes: "Could not find the table 'public.widgets' in the schema cache"
-- Matches app columns: id, user_id, type, name, config, state, public_token, is_enabled, subathon_id, timestamps.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Profile table (widgets.user_id FK target). Safe if already applied.
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  name TEXT,
  image TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  CREATE TYPE public.widget_type AS ENUM (
    'SUBATHON_TIMER',
    'GOAL_BAR',
    'ALERT_BOX',
    'CHAT_BOX',
    'SPIN_WHEEL'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE public.widget_type ADD VALUE IF NOT EXISTS 'EMOTE_RAIN';
ALTER TYPE public.widget_type ADD VALUE IF NOT EXISTS 'CHAT_SPOTLIGHT';
ALTER TYPE public.widget_type ADD VALUE IF NOT EXISTS 'TIKTOK_TAPPERS';
ALTER TYPE public.widget_type ADD VALUE IF NOT EXISTS 'TIKTOK_TAP_GOAL';

CREATE TABLE IF NOT EXISTS public.widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subathon_id uuid NULL,
  name text NOT NULL DEFAULT 'Untitled widget',
  type public.widget_type NOT NULL DEFAULT 'SUBATHON_TIMER',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Optional FK to subathons when that table already exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subathons'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'widgets_subathon_id_fkey'
      AND conrelid = 'public.widgets'::regclass
  ) THEN
    BEGIN
      ALTER TABLE public.widgets
        ADD CONSTRAINT widgets_subathon_id_fkey
        FOREIGN KEY (subathon_id) REFERENCES public.subathons(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'widgets_subathon_id_fkey not added: %', SQLERRM;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS widgets_user_id_idx ON public.widgets(user_id);
CREATE INDEX IF NOT EXISTS widgets_subathon_id_idx ON public.widgets(subathon_id);
CREATE INDEX IF NOT EXISTS widgets_public_token_idx ON public.widgets(public_token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.widgets TO authenticated;
GRANT ALL ON public.widgets TO service_role;

ALTER TABLE public.widgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS widgets_owner ON public.widgets;
CREATE POLICY widgets_owner
  ON public.widgets
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS widgets_set_updated_at ON public.widgets;
CREATE TRIGGER widgets_set_updated_at
  BEFORE UPDATE ON public.widgets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Goal rows for GOAL_BAR widgets (createWidget inserts here).
CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id uuid NOT NULL UNIQUE REFERENCES public.widgets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Goal',
  unit text NOT NULL DEFAULT 'USD',
  target_value numeric(14, 2) NOT NULL DEFAULT 100,
  current_value numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goals_user_id_idx ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS goals_widget_id_idx ON public.goals(widget_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS goals_owner ON public.goals;
CREATE POLICY goals_owner
  ON public.goals
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS goals_set_updated_at ON public.goals;
CREATE TRIGGER goals_set_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

NOTIFY pgrst, 'reload schema';
