create or replace function public.overlay_tiktok_tap_total(p_subathon uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(greatest(coalesce(e.quantity, 1), 1)), 0)::bigint
  from public.events e
  where e.subathon_id = p_subathon
    and e.platform = 'TIKTOK'
    and e.event_type = 'LIKE'
$$;

revoke all on function public.overlay_tiktok_tap_total(uuid) from public, anon, authenticated;
grant execute on function public.overlay_tiktok_tap_total(uuid) to service_role;