CREATE TYPE public.widget_type AS ENUM ('SUBATHON_TIMER','GOAL_BAR','ALERT_BOX','CHAT_BOX','SPIN_WHEEL');

CREATE TABLE public.widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subathon_id uuid REFERENCES public.subathons(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled widget',
  type public.widget_type NOT NULL DEFAULT 'SUBATHON_TIMER',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX widgets_user_id_idx ON public.widgets(user_id);
CREATE INDEX widgets_subathon_id_idx ON public.widgets(subathon_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.widgets TO authenticated;
GRANT ALL ON public.widgets TO service_role;
ALTER TABLE public.widgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY widgets_owner ON public.widgets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id uuid NOT NULL UNIQUE REFERENCES public.widgets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Goal',
  unit text NOT NULL DEFAULT 'USD',
  target_value numeric(14,2) NOT NULL DEFAULT 100,
  current_value numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX goals_user_id_idx ON public.goals(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY goals_owner ON public.goals FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER widgets_set_updated_at BEFORE UPDATE ON public.widgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER goals_set_updated_at BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.rules
  ADD COLUMN widget_id uuid REFERENCES public.widgets(id) ON DELETE CASCADE,
  ADD COLUMN goal_increment numeric(14,2) NOT NULL DEFAULT 0;
CREATE INDEX rules_widget_id_idx ON public.rules(widget_id);

INSERT INTO public.widgets (user_id, subathon_id, name, type, config, public_token)
SELECT s.user_id, o.subathon_id, o.name, 'SUBATHON_TIMER', o.theme, o.public_token
FROM public.overlays o
JOIN public.subathons s ON s.id = o.subathon_id;

CREATE OR REPLACE FUNCTION public.apply_goal_increment(p_widget_id uuid, p_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_value numeric;
BEGIN
  UPDATE public.goals
     SET current_value = current_value + p_amount
   WHERE widget_id = p_widget_id
   RETURNING current_value INTO v_value;
  RETURN v_value;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_goal_increment(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_goal_increment(uuid, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.apply_goal_increment(uuid, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_goal_increment(uuid, numeric) TO service_role;