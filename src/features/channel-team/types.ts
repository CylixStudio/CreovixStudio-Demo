/** Domain types for Channel Team. No React, no storage, no network. */

export type SectionId =
  | "commands"
  | "points"
  | "shop"
  | "timers"
  | "marks"
  | "activity"
  | "widgets"
  | "schedule"
  | "bio"
  | "analytics";

export type PermissionKey = `${SectionId}.${string}`;

/** Derived label for one section of a member's permission set. */
export type SectionLevel = "none" | "view" | "manage" | "custom";

export type ChannelId = string;
export type UserId = string;

export type TeamUser = {
  id: UserId;
  username: string;
  displayName: string;
  /** Hue (0-360) used to generate the avatar. */
  hue: number;
  /** Optional platform profile image URL (Kick/Twitch/YouTube). Demo data may use placeholder URLs. */
  avatarUrl?: string | null;
  /** Platform identifier if known (kick, twitch, youtube, tiktok, etc.). */
  platform?: string | null;
};

export type TeamChannel = {
  id: ChannelId;
  ownerId: UserId;
  name: string;
  handle: string;
  hue: number;
};

export type TeamMember = {
  id: string;
  channelId: ChannelId;
  userId: UserId;
  status: "active";
  permissions: PermissionKey[];
  joinedAt: string;
};

export type InvitationStatus = "pending" | "active" | "expired" | "revoked" | "declined";

export type Invitation = {
  id: string;
  channelId: ChannelId;
  method: "username" | "code";
  /** Target user for username invites. Code invites have none until redeemed. */
  inviteeId: UserId | null;
  /** Demo-only code. Local to this browser and not a security token. */
  code: string | null;
  permissions: PermissionKey[];
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  /** Who consumed the invitation (accepted or declined). */
  resolvedBy: UserId | null;
  resolvedAt: string | null;
};

export type AuditEntry = {
  id: string;
  at: string;
  channelId: ChannelId;
  actorId: UserId;
  /** Machine-readable operation, e.g. `commands.edit` or `team.permissions_changed`. */
  action: string;
  section: SectionId | "team";
  /** Free-form target such as a command name or a username. */
  target: string;
};

export type TeamState = {
  v: 1;
  /** Demo identity currently used to browse the studio. */
  actorId: UserId;
  /** Channel currently being managed by the actor. */
  activeChannelId: ChannelId;
  members: TeamMember[];
  invitations: Invitation[];
  audit: AuditEntry[];
};

/** Compact permission snapshot sent to the stateless demo server with each request. */
export type ActorContext = {
  channelId: ChannelId;
  actorId: UserId;
  owner: boolean;
  keys: PermissionKey[];
};

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; section: SectionId | "owner" | "alerts"; reason: string };
