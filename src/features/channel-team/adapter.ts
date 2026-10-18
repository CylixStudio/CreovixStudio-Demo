import { CHANNEL_BY_ID, TEAM_USERS, USER_BY_ID } from "./fixtures";
import { normalizeKeys } from "./permissions";
import { isOwner, membershipOf, effectiveChannelId, channelsFor } from "./resolver";
import { readTeamState, updateTeamState, writeTeamState, TEAM_KEY, ACTIVE_CHANNEL_KEY } from "./storage";
import type { AuditEntry, ChannelId, Invitation, PermissionKey, SectionId, TeamState, TeamUser, UserId } from "./types";

/**
 * Demo Data Adapter for Channel Team. Every mutation is authorized against the acting identity
 * and logged. This enforces rules for the local simulation only; it is not server security and
 * must be replaced by an authenticated backend with row level security in production.
 */

export type TeamError =
  | "not_owner"
  | "not_found"
  | "already_member"
  | "already_invited"
  | "is_owner"
  | "not_pending"
  | "expired"
  | "revoked"
  | "used"
  | "wrong_user"
  | "no_permissions"
  | "invalid_code";

export type TeamResult<T = undefined> = { ok: true; value?: T } | { ok: false; error: TeamError };

const ok = <T = undefined>(value?: T): TeamResult<T> => ({ ok: true, value });
const fail = (error: TeamError): { ok: false; error: TeamError } => ({ ok: false, error });

let counter = 0;
function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}${Math.random().toString(36).slice(2, 6)}`;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Random demo code. Math.random is fine here: the code is a simulation label, not a secret. */
export function generateDemoCode(): string {
  const block = (n: number) =>
    Array.from({ length: n }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
  return `CYLX-${block(4)}-${block(4)}`;
}

function audit(state: TeamState, entry: Omit<AuditEntry, "id" | "at">): TeamState {
  const next: AuditEntry = { ...entry, id: newId("aud"), at: new Date().toISOString() };
  return { ...state, audit: [next, ...state.audit].slice(0, 300) };
}

function ownerGuard(state: TeamState, channelId: ChannelId): boolean {
  return isOwner(state.actorId, channelId);
}

export function userLabel(userId: UserId): string {
  return USER_BY_ID[userId]?.displayName ?? userId;
}

/** Users that can still be invited to the channel (not the owner, not already a member). */
export function searchInvitableUsers(state: TeamState, channelId: ChannelId, query: string): TeamUser[] {
  const needle = query.trim().toLowerCase().replace(/^@/, "");
  return TEAM_USERS.filter((user) => {
    if (isOwner(user.id, channelId)) return false;
    if (membershipOf(state, user.id, channelId)) return false;
    if (!needle) return true;
    return user.username.toLowerCase().includes(needle) || user.displayName.toLowerCase().includes(needle);
  });
}

export function inviteByUsername(
  channelId: ChannelId,
  inviteeId: UserId,
  permissions: readonly PermissionKey[],
  expiresInDays = 7,
): TeamResult<Invitation> {
  const state = readTeamState();
  if (!ownerGuard(state, channelId)) return fail("not_owner");
  if (!USER_BY_ID[inviteeId]) return fail("not_found");
  if (isOwner(inviteeId, channelId)) return fail("is_owner");
  if (membershipOf(state, inviteeId, channelId)) return fail("already_member");
  const keys = normalizeKeys(permissions);
  if (keys.length === 0) return fail("no_permissions");
  if (state.invitations.some((i) => i.channelId === channelId && i.status === "pending" && i.inviteeId === inviteeId)) {
    return fail("already_invited");
  }
  const now = Date.now();
  const invite: Invitation = {
    id: newId("inv"),
    channelId,
    method: "username",
    inviteeId,
    code: null,
    permissions: keys,
    status: "pending",
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + expiresInDays * 86_400_000).toISOString(),
    resolvedBy: null,
    resolvedAt: null,
  };
  const next = audit(
    { ...state, invitations: [invite, ...state.invitations] },
    { channelId, actorId: state.actorId, action: "team.invite_created", section: "team", target: userLabel(inviteeId) },
  );
  writeTeamState(next);
  return ok(invite);
}

export function createInviteCode(channelId: ChannelId, permissions: readonly PermissionKey[], expiresInHours: number): TeamResult<Invitation> {
  const state = readTeamState();
  if (!ownerGuard(state, channelId)) return fail("not_owner");
  const keys = normalizeKeys(permissions);
  if (keys.length === 0) return fail("no_permissions");
  const now = Date.now();
  let code = generateDemoCode();
  while (state.invitations.some((i) => i.code === code)) code = generateDemoCode();
  const invite: Invitation = {
    id: newId("inv"),
    channelId,
    method: "code",
    inviteeId: null,
    code,
    permissions: keys,
    status: "pending",
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + Math.max(0.01, expiresInHours) * 3_600_000).toISOString(),
    resolvedBy: null,
    resolvedAt: null,
  };
  const next = audit(
    { ...state, invitations: [invite, ...state.invitations] },
    { channelId, actorId: state.actorId, action: "team.code_created", section: "team", target: code },
  );
  writeTeamState(next);
  return ok(invite);
}

export function updateInvitationPermissions(invitationId: string, permissions: readonly PermissionKey[]): TeamResult {
  const state = readTeamState();
  const invite = state.invitations.find((i) => i.id === invitationId);
  if (!invite) return fail("not_found");
  if (!ownerGuard(state, invite.channelId)) return fail("not_owner");
  if (invite.status !== "pending") return fail("not_pending");
  const keys = normalizeKeys(permissions);
  if (keys.length === 0) return fail("no_permissions");
  const next = audit(
    { ...state, invitations: state.invitations.map((i) => (i.id === invitationId ? { ...i, permissions: keys } : i)) },
    {
      channelId: invite.channelId,
      actorId: state.actorId,
      action: "team.invite_updated",
      section: "team",
      target: invite.inviteeId ? userLabel(invite.inviteeId) : (invite.code ?? ""),
    },
  );
  writeTeamState(next);
  return ok();
}

export function revokeInvitation(invitationId: string): TeamResult {
  const state = readTeamState();
  const invite = state.invitations.find((i) => i.id === invitationId);
  if (!invite) return fail("not_found");
  if (!ownerGuard(state, invite.channelId)) return fail("not_owner");
  if (invite.status !== "pending") return fail("not_pending");
  const next = audit(
    { ...state, invitations: state.invitations.map((i) => (i.id === invitationId ? { ...i, status: "revoked" as const } : i)) },
    {
      channelId: invite.channelId,
      actorId: state.actorId,
      action: "team.invite_revoked",
      section: "team",
      target: invite.inviteeId ? userLabel(invite.inviteeId) : (invite.code ?? ""),
    },
  );
  writeTeamState(next);
  return ok();
}

function checkConsumable(state: TeamState, invite: Invitation, userId: UserId): TeamError | null {
  if (invite.status === "revoked") return "revoked";
  if (invite.status === "expired" || Date.parse(invite.expiresAt) <= Date.now()) return "expired";
  if (invite.status !== "pending") return "used";
  if (invite.method === "username" && invite.inviteeId !== userId) return "wrong_user";
  if (isOwner(userId, invite.channelId)) return "is_owner";
  if (membershipOf(state, userId, invite.channelId)) return "already_member";
  return null;
}

/** Accepting is performed by the invited demo user (simulated invitee). */
export function acceptInvitation(invitationId: string, userId: UserId): TeamResult {
  const state = readTeamState();
  const invite = state.invitations.find((i) => i.id === invitationId);
  if (!invite) return fail("not_found");
  const problem = checkConsumable(state, invite, userId);
  if (problem) {
    if (problem === "expired" && invite.status === "pending") {
      writeTeamState({ ...state, invitations: state.invitations.map((i) => (i.id === invite.id ? { ...i, status: "expired" as const } : i)) });
    }
    return fail(problem);
  }
  const now = new Date().toISOString();
  const next = audit(
    {
      ...state,
      invitations: state.invitations.map((i) =>
        i.id === invite.id ? { ...i, status: "active" as const, inviteeId: i.inviteeId ?? userId, resolvedBy: userId, resolvedAt: now } : i,
      ),
      members: [
        ...state.members,
        { id: newId("tm"), channelId: invite.channelId, userId, status: "active", permissions: invite.permissions, joinedAt: now },
      ],
    },
    { channelId: invite.channelId, actorId: userId, action: "team.invite_accepted", section: "team", target: userLabel(userId) },
  );
  writeTeamState(next);
  return ok();
}

export function declineInvitation(invitationId: string, userId: UserId): TeamResult {
  const state = readTeamState();
  const invite = state.invitations.find((i) => i.id === invitationId);
  if (!invite) return fail("not_found");
  const problem = checkConsumable(state, invite, userId);
  if (problem) return fail(problem);
  const now = new Date().toISOString();
  const next = audit(
    {
      ...state,
      invitations: state.invitations.map((i) =>
        i.id === invite.id ? { ...i, status: "declined" as const, inviteeId: i.inviteeId ?? userId, resolvedBy: userId, resolvedAt: now } : i,
      ),
    },
    { channelId: invite.channelId, actorId: userId, action: "team.invite_declined", section: "team", target: userLabel(userId) },
  );
  writeTeamState(next);
  return ok();
}

/** Redeems a demo code as the given demo user. A code works once. */
export function redeemInviteCode(code: string, userId: UserId): TeamResult {
  const state = readTeamState();
  const wanted = code.trim().toUpperCase();
  const invite = state.invitations.find((i) => i.method === "code" && i.code === wanted);
  if (!invite) return fail("invalid_code");
  return acceptInvitation(invite.id, userId);
}

export function updateMemberPermissions(memberId: string, permissions: readonly PermissionKey[]): TeamResult {
  const state = readTeamState();
  const member = state.members.find((m) => m.id === memberId);
  if (!member) return fail("not_found");
  if (!ownerGuard(state, member.channelId)) return fail("not_owner");
  const keys = normalizeKeys(permissions);
  const next = audit(
    { ...state, members: state.members.map((m) => (m.id === memberId ? { ...m, permissions: keys } : m)) },
    { channelId: member.channelId, actorId: state.actorId, action: "team.permissions_changed", section: "team", target: userLabel(member.userId) },
  );
  writeTeamState(next);
  return ok();
}

export function removeMember(memberId: string): TeamResult {
  const state = readTeamState();
  const member = state.members.find((m) => m.id === memberId);
  if (!member) return fail("not_found");
  if (!ownerGuard(state, member.channelId)) return fail("not_owner");
  const next = audit(
    { ...state, members: state.members.filter((m) => m.id !== memberId) },
    { channelId: member.channelId, actorId: state.actorId, action: "team.member_removed", section: "team", target: userLabel(member.userId) },
  );
  writeTeamState(next);
  return ok();
}

export function setActor(userId: UserId): void {
  if (!USER_BY_ID[userId]) return;
  updateTeamState((state) => {
    const options = channelsFor({ ...state, actorId: userId }, userId);
    const active = options.find((c) => c.id === state.activeChannelId) ? state.activeChannelId : (options[0]?.id ?? state.activeChannelId);
    return { ...state, actorId: userId, activeChannelId: active };
  });
}

export function setActiveChannel(channelId: ChannelId): boolean {
  const state = readTeamState();
  if (!CHANNEL_BY_ID[channelId]) return false;
  if (!channelsFor(state, state.actorId).some((c) => c.id === channelId)) return false;
  if (effectiveChannelId(state) === channelId) return true;
  writeTeamState({ ...state, activeChannelId: channelId });
  return true;
}

/** Records an operation a moderator really performed through the demo data layer. */
export function recordOperation(entry: { channelId: ChannelId; actorId: UserId; action: string; section: SectionId; target: string }): void {
  updateTeamState((state) => audit(state, entry));
}

export function clearTeamStorage(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TEAM_KEY);
  window.localStorage.removeItem(ACTIVE_CHANNEL_KEY);
}
