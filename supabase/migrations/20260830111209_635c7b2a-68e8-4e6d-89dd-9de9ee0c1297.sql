create or replace function public.overlay_stream_events(p_subathon uuid, p_limit integer)
returns table (
  id uuid,
  platform platform_type,
  event_type text,
  actor_name text,
  amount numeric,
  currency text,
  quantity integer,
  seconds_added integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.platform, e.event_type, e.actor_name, e.amount, e.currency,
         e.quantity, e.seconds_added, e.created_at
  from public.events e
  where e.subathon_id = p_subathon
  order by e.created_at desc
  limit greatest(1, least(coalesce(p_limit, 5), 50))
$$;

revoke all on function public.overlay_stream_events(uuid, integer) from public, anon, authenticated;
grant execute on function public.overlay_stream_events(uuid, integer) to service_role;