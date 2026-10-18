create or replace function public.overlay_tiktok_tappers(p_subathon uuid, p_limit integer)
returns table (
  actor_key text,
  actor_name text,
  avatar_url text,
  taps bigint,
  last_tap_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(e.actor_platform_id, e.actor_name, 'anonymous') as actor_key,
    coalesce(max(e.actor_name), 'Anonymous') as actor_name,
    max(nullif(e.raw_payload->>'avatarUrl', '')) as avatar_url,
    sum(greatest(coalesce(e.quantity, 1), 1))::bigint as taps,
    max(e.created_at) as last_tap_at
  from public.events e
  where e.subathon_id = p_subathon
    and e.platform = 'TIKTOK'
    and e.event_type = 'LIKE'
  group by 1
  order by taps desc, last_tap_at desc
  limit greatest(1, least(coalesce(p_limit, 5), 25))
$$;

revoke all on function public.overlay_tiktok_tappers(uuid, integer) from public, anon, authenticated;
grant execute on function public.overlay_tiktok_tappers(uuid, integer) to service_role;