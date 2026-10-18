-- ENUMS
CREATE TYPE public.timer_status AS ENUM ('IDLE','RUNNING','PAUSED','ENDED');
CREATE TYPE public.platform_type AS ENUM ('TWITCH','KICK','STREAMELEMENTS','STREAMLABS','MANUAL');
CREATE TYPE public.rule_event_type AS ENUM ('FOLLOW','SUBSCRIPTION','GIFT_SUB','BITS','DONATION');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- USERS
CREATE TABLE public.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  image TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own" ON public.users FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ACCOUNTS
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'oauth',
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT accounts_provider_unique UNIQUE (provider, provider_account_id)
);
CREATE INDEX accounts_user_id_idx ON public.accounts(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts_own" ON public.accounts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SESSIONS
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON public.sessions(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_own" ON public.sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- PLATFORM CONNECTIONS
CREATE TABLE public.platform_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  platform public.platform_type NOT NULL,
  platform_user_id TEXT,
  username TEXT,
  access_token TEXT,
  refresh_token TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_connections_unique UNIQUE (user_id, platform, platform_user_id)
);
CREATE INDEX platform_connections_user_idx ON public.platform_connections(user_id, platform);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_connections TO authenticated;
GRANT ALL ON public.platform_connections TO service_role;
ALTER TABLE public.platform_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_connections_own" ON public.platform_connections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER platform_connections_updated_at BEFORE UPDATE ON public.platform_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SUBATHONS
CREATE TABLE public.subathons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  initial_seconds INTEGER NOT NULL DEFAULT 3600,
  max_duration_seconds INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subathons_slug_unique UNIQUE (user_id, slug)
);
CREATE INDEX subathons_user_idx ON public.subathons(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subathons TO authenticated;
GRANT ALL ON public.subathons TO service_role;
ALTER TABLE public.subathons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subathons_own" ON public.subathons FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER subathons_updated_at BEFORE UPDATE ON public.subathons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.owns_subathon(_subathon_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.subathons s WHERE s.id = _subathon_id AND s.user_id = auth.uid());
$$;

-- OVERLAYS
CREATE TABLE public.overlays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subathon_id UUID NOT NULL REFERENCES public.subathons(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default overlay',
  public_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'),
  is_public BOOLEAN NOT NULL DEFAULT true,
  theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX overlays_subathon_idx ON public.overlays(subathon_id);
GRANT SELECT ON public.overlays TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.overlays TO authenticated;
GRANT ALL ON public.overlays TO service_role;
ALTER TABLE public.overlays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "overlays_owner" ON public.overlays FOR ALL TO authenticated USING (public.owns_subathon(subathon_id)) WITH CHECK (public.owns_subathon(subathon_id));
CREATE POLICY "overlays_public_read" ON public.overlays FOR SELECT TO anon, authenticated USING (is_public = true);
CREATE TRIGGER overlays_updated_at BEFORE UPDATE ON public.overlays FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.has_public_overlay(_subathon_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.overlays o WHERE o.subathon_id = _subathon_id AND o.is_public);
$$;

-- TIMER STATE
CREATE TABLE public.timer_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subathon_id UUID NOT NULL UNIQUE REFERENCES public.subathons(id) ON DELETE CASCADE,
  status public.timer_status NOT NULL DEFAULT 'IDLE',
  remaining_seconds INTEGER NOT NULL DEFAULT 0,
  total_added_seconds INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  last_tick_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX timer_states_status_idx ON public.timer_states(status);
GRANT SELECT ON public.timer_states TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timer_states TO authenticated;
GRANT ALL ON public.timer_states TO service_role;
ALTER TABLE public.timer_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "timer_states_owner" ON public.timer_states FOR ALL TO authenticated USING (public.owns_subathon(subathon_id)) WITH CHECK (public.owns_subathon(subathon_id));
CREATE POLICY "timer_states_public_read" ON public.timer_states FOR SELECT TO anon, authenticated USING (public.has_public_overlay(subathon_id));
CREATE TRIGGER timer_states_updated_at BEFORE UPDATE ON public.timer_states FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- EVENTS
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subathon_id UUID NOT NULL REFERENCES public.subathons(id) ON DELETE CASCADE,
  platform public.platform_type NOT NULL,
  event_type public.rule_event_type NOT NULL,
  provider_event_id TEXT,
  actor_name TEXT,
  actor_platform_id TEXT,
  amount NUMERIC(12,2),
  quantity INTEGER NOT NULL DEFAULT 1,
  currency TEXT,
  seconds_added INTEGER NOT NULL DEFAULT 0,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT events_provider_dedup UNIQUE (platform, provider_event_id)
);
CREATE INDEX events_subathon_created_idx ON public.events(subathon_id, created_at DESC);
CREATE INDEX events_type_idx ON public.events(subathon_id, event_type);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_owner" ON public.events FOR ALL TO authenticated USING (public.owns_subathon(subathon_id)) WITH CHECK (public.owns_subathon(subathon_id));

-- RULES
CREATE TABLE public.rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subathon_id UUID NOT NULL REFERENCES public.subathons(id) ON DELETE CASCADE,
  platform public.platform_type NOT NULL DEFAULT 'MANUAL',
  event_type public.rule_event_type NOT NULL,
  seconds_per_unit INTEGER NOT NULL DEFAULT 0,
  unit_amount NUMERIC(12,2) NOT NULL DEFAULT 1,
  min_amount NUMERIC(12,2),
  max_seconds_per_event INTEGER,
  priority INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rules_unique_per_event UNIQUE (subathon_id, platform, event_type)
);
CREATE INDEX rules_lookup_idx ON public.rules(subathon_id, event_type, priority DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rules TO authenticated;
GRANT ALL ON public.rules TO service_role;
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rules_owner" ON public.rules FOR ALL TO authenticated USING (public.owns_subathon(subathon_id)) WITH CHECK (public.owns_subathon(subathon_id));
CREATE TRIGGER rules_updated_at BEFORE UPDATE ON public.rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AUDIT LOG
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  subathon_id UUID REFERENCES public.subathons(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_user_idx ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX audit_logs_subathon_idx ON public.audit_logs(subathon_id, created_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_own_read" ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- SEED
INSERT INTO public.users (id, email, name, image, timezone)
VALUES ('00000000-0000-4000-8000-000000000001', 'demo@creovix.dev', 'Demo Streamer', NULL, 'Europe/Berlin');

INSERT INTO public.subathons (id, user_id, title, slug, description, starts_at, initial_seconds, max_duration_seconds, is_active, settings)
VALUES ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Demo Subathon', 'demo-subathon',
        'Default demo subathon with a starter rule set.', now(), 7200, 604800, true,
        '{"tick_interval_ms":1000,"show_recent_events":true}'::jsonb);

INSERT INTO public.timer_states (subathon_id, status, remaining_seconds, total_added_seconds, paused_at, last_tick_at)
VALUES ('00000000-0000-4000-8000-000000000002', 'PAUSED', 7200, 0, now(), now());

INSERT INTO public.rules (subathon_id, platform, event_type, seconds_per_unit, unit_amount, min_amount, max_seconds_per_event, priority)
VALUES
  ('00000000-0000-4000-8000-000000000002', 'TWITCH', 'FOLLOW', 30, 1, NULL, 30, 10),
  ('00000000-0000-4000-8000-000000000002', 'TWITCH', 'SUBSCRIPTION', 300, 1, NULL, 3600, 20),
  ('00000000-0000-4000-8000-000000000002', 'TWITCH', 'GIFT_SUB', 300, 1, NULL, 18000, 30),
  ('00000000-0000-4000-8000-000000000002', 'TWITCH', 'BITS', 6, 100, 100, 7200, 40),
  ('00000000-0000-4000-8000-000000000002', 'STREAMELEMENTS', 'DONATION', 60, 1, 1, 7200, 50);

INSERT INTO public.overlays (subathon_id, name, public_token, is_public, theme)
VALUES ('00000000-0000-4000-8000-000000000002', 'Default overlay', 'demo-overlay-token', true,
        '{"accent":"#22d3ee","font":"Space Grotesk","layout":"centered","showEvents":true}'::jsonb);

INSERT INTO public.audit_logs (user_id, subathon_id, action, entity, entity_id, metadata)
VALUES ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'seed.bootstrap', 'subathon', '00000000-0000-4000-8000-000000000002', '{"source":"seed"}'::jsonb);