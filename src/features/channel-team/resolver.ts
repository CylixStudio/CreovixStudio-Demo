import { CHANNEL_BY_ID, TEAM_CHANNELS } from "./fixtures";
import { ALERTS_ROUTE, ALL_KEYS, OWNER_ONLY_ROUTES, matchesRoute, sectionOfKey, sectionsForPath, viewKeyOf } from "./permissions";
import type { AccessDecision, ActorContext, ChannelId, Invitation, PermissionKey, TeamChannel, TeamMember, TeamState, UserId } from "./types";

/**
 * Single permission resolver. Pure functions over TeamState so the same rules can be reused by
 * UI gates, the demo data adapter and (later) a real server-side policy.
 */

export function membershipOf(state: TeamState, userId: UserId, channelId: ChannelId): TeamMember | null {
  return state.members.find((member) => member.userId === userId && member.channelId === channelId && member.status === "active") ?? null;
}

export function isOwner(userId: UserId, channelId: ChannelId): boolean {
  return CHANNEL_BY_ID[channelId]?.ownerId === userId;
}

/** Channels the user owns or moderates, owned channel first. */
export function channelsFor(state: TeamState, userId: UserId): TeamChannel[] {
  const owned = TEAM_CHANNELS.filter((channel) => channel.ownerId === userId);
  const moderated = TEAM_CHANNELS.filter((channel) => channel.ownerId !== userId && membershipOf(state, userId, channel.id));
  return [...owned, ...moderated];
}

export function ownChannelOf(userId: UserId): TeamChannel | null {
  return TEAM_CHANNELS.find((channel) => channel.ownerId === userId) ?? null;
}

export function effectiveChannelId(state: TeamState): ChannelId {
  const options = channelsFor(state, state.actorId);
  return options.find((channel) => channel.id === state.activeChannelId)?.id ?? options[0]?.id ?? state.activeChannelId;
}

export function resolveActor(state: TeamState): ActorContext {
  const channelId = effectiveChannelId(state);
  if (isOwner(state.actorId, channelId)) {
    return { channelId, actorId: state.actorId, owner: true, keys: [...ALL_KEYS] };
  }
  const member = membershipOf(state, state.actorId, channelId);
  return { channelId, actorId: state.actorId, owner: false, keys: member ? [...member.permissions] : [] };
}

export function hasKey(ctx: ActorContext, key: PermissionKey): boolean {
  return ctx.owner || ctx.keys.includes(key);
}

export function decideKey(ctx: ActorContext, key: PermissionKey): AccessDecision {
  if (hasKey(ctx, key)) return { allowed: true };
  return { allowed: false, section: sectionOfKey(key), reason: key };
}

export function decideRoute(ctx: ActorContext, pathname: string): AccessDecision {
  if (OWNER_ONLY_ROUTES.some((route) => matchesRoute(pathname, route)) && !ctx.owner) {
    return { allowed: false, section: "owner", reason: "owner-only" };
  }
  if (matchesRoute(pathname, ALERTS_ROUTE) && !ctx.owner) {
    return { allowed: false, section: "alerts", reason: "admin-early-access" };
  }
  const sections = sectionsForPath(pathname);
  if (sections.length === 0 || ctx.owner) return { allowed: true };
  if (sections.some((section) => ctx.keys.includes(viewKeyOf(section)))) return { allowed: true };
  return { allowed: false, section: sections[0]!, reason: "no-access" };
}

export function pendingInvitationsFor(state: TeamState, userId: UserId): Invitation[] {
  return state.invitations.filter((invite) => invite.status === "pending" && invite.method === "username" && invite.inviteeId === userId);
}

/** Pending invitations whose expiry already passed are reported as expired. */
export function withExpiry(state: TeamState, now = Date.now()): TeamState {
  let changed = false;
  const invitations = state.invitations.map((invite) => {
    if (invite.status === "pending" && Date.parse(invite.expiresAt) <= now) {
      changed = true;
      return { ...invite, status: "expired" as const };
    }
    return invite;
  });
  return changed ? { ...state, invitations } : state;
}
