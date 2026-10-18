import { DEMO_USER_ID } from "@/lib/demoMode";

import { normalizeKeys, sectionKeys, viewKeyOf, ALL_KEYS } from "./permissions";
import type { AuditEntry, Invitation, PermissionKey, TeamChannel, TeamMember, TeamState, TeamUser } from "./types";

export const OWN_CHANNEL_ID = "own";
export const CHANNEL_A_ID = "streamer-a";
export const CHANNEL_B_ID = "streamer-b";

const U = (id: string, username: string, displayName: string, hue: number): TeamUser => ({ id, username, displayName, hue });

export const TEAM_USERS: readonly TeamUser[] = [
  U(DEMO_USER_ID, "demouser", "DemoUser", 205),
  U("tu-novaplays", "novaplays", "NovaPlays", 280),
  U("tu-atlastv", "atlastv", "AtlasTV", 28),
  U("tu-modmaya", "modmaya", "ModMaya", 330),
  U("tu-modomar", "modomar", "ModOmar", 150),
  U("tu-modlayla", "modlayla", "ModLayla", 48),
  U("tu-modkarim", "modkarim", "ModKarim", 190),
  U("tu-modsara", "modsara", "ModSara", 310),
  U("tu-modzed", "modzed", "ModZed", 90),
  U("tu-modnora", "modnora", "ModNora", 260),
  U("tu-modadam", "modadam", "ModAdam", 10),
  U("tu-modhana", "modhana", "ModHana", 170),
  U("tu-modyusuf", "modyusuf", "ModYusuf", 230),
  U("tu-mintmoon", "mintmoon", "MintMoon", 140),
  U("tu-roxyrae", "roxyrae", "RoxyRae", 350),
  U("tu-pixelpete", "pixelpete", "PixelPete", 60),
  U("tu-turbotaz", "turbotaz", "TurboTaz", 20),
  U("tu-zaynabg", "zaynab_g", "Zaynab_G", 290),
  U("tu-chillali", "chill_ali", "Chill_Ali", 200),
];

export const TEAM_CHANNELS: readonly TeamChannel[] = [
  { id: OWN_CHANNEL_ID, ownerId: DEMO_USER_ID, name: "My Channel", handle: "demouser", hue: 205 },
  { id: CHANNEL_A_ID, ownerId: "tu-novaplays", name: "Streamer A", handle: "novaplays", hue: 280 },
  { id: CHANNEL_B_ID, ownerId: "tu-atlastv", name: "Streamer B", handle: "atlastv", hue: 28 },
];

export const USER_BY_ID: Record<string, TeamUser> = Object.fromEntries(TEAM_USERS.map((user) => [user.id, user]));
export const CHANNEL_BY_ID: Record<string, TeamChannel> = Object.fromEntries(TEAM_CHANNELS.map((channel) => [channel.id, channel]));

const k = (...parts: Array<readonly PermissionKey[]>) => normalizeKeys(parts.flat());

const MOD_PERMISSIONS: Array<[string, PermissionKey[]]> = [
  // Mod A: commands + points + shop
  ["tu-modmaya", k(sectionKeys("commands"), sectionKeys("points"), sectionKeys("shop"), [viewKeyOf("activity")])],
  // Mod B: shop only
  ["tu-modomar", k(sectionKeys("shop"))],
  // Mod C: analytics view only
  ["tu-modlayla", k([viewKeyOf("analytics")])],
  ["tu-modkarim", k(sectionKeys("timers"), ["commands.view", "commands.toggle"])],
  ["tu-modsara", k(sectionKeys("schedule"), ["bio.view", "bio.links"])],
  ["tu-modzed", k(sectionKeys("marks"), [viewKeyOf("activity")])],
  ["tu-modnora", k(["widgets.view", "widgets.test"])],
  ["tu-modadam", k(["widgets.view", "widgets.edit"], [viewKeyOf("analytics")])],
  ["tu-modhana", k([viewKeyOf("points"), viewKeyOf("shop")])],
  ["tu-modyusuf", k(ALL_KEYS.filter((key) => key.endsWith(".view")))],
];

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

export function buildInitialTeamState(now = Date.now()): TeamState {
  const members: TeamMember[] = [];
  MOD_PERMISSIONS.forEach(([userId, permissions], i) => {
    members.push({
      id: `tm-own-${i + 1}`,
      channelId: OWN_CHANNEL_ID,
      userId,
      status: "active",
      permissions,
      joinedAt: iso(now - (60 - i * 5) * DAY),
    });
  });
  // The demo user is a moderator on two other channels.
  members.push({
    id: "tm-a-1",
    channelId: CHANNEL_A_ID,
    userId: DEMO_USER_ID,
    status: "active",
    permissions: k(sectionKeys("commands"), sectionKeys("points"), sectionKeys("shop"), ["timers.view", "marks.view", "activity.view"]),
    joinedAt: iso(now - 40 * DAY),
  });
  members.push({
    id: "tm-a-2",
    channelId: CHANNEL_A_ID,
    userId: "tu-modmaya",
    status: "active",
    permissions: k(sectionKeys("marks")),
    joinedAt: iso(now - 30 * DAY),
  });
  members.push({
    id: "tm-b-1",
    channelId: CHANNEL_B_ID,
    userId: DEMO_USER_ID,
    status: "active",
    permissions: k(["analytics.view", "schedule.view", "bio.view", "activity.view"]),
    joinedAt: iso(now - 25 * DAY),
  });
  members.push({
    id: "tm-b-2",
    channelId: CHANNEL_B_ID,
    userId: "tu-modomar",
    status: "active",
    permissions: k(sectionKeys("shop")),
    joinedAt: iso(now - 20 * DAY),
  });

  const invitations: Invitation[] = [
    {
      id: "inv-1",
      channelId: OWN_CHANNEL_ID,
      method: "username",
      inviteeId: "tu-mintmoon",
      code: null,
      permissions: k(sectionKeys("shop")),
      status: "pending",
      createdAt: iso(now - 1 * DAY),
      expiresAt: iso(now + 6 * DAY),
      resolvedBy: null,
      resolvedAt: null,
    },
    {
      id: "inv-2",
      channelId: OWN_CHANNEL_ID,
      method: "username",
      inviteeId: "tu-roxyrae",
      code: null,
      permissions: k(["commands.view"], ["timers.view"]),
      status: "pending",
      createdAt: iso(now - 2 * DAY),
      expiresAt: iso(now + 5 * DAY),
      resolvedBy: null,
      resolvedAt: null,
    },
    {
      id: "inv-3",
      channelId: OWN_CHANNEL_ID,
      method: "code",
      inviteeId: null,
      code: "CYLX-7QK2-M9PD",
      permissions: k(sectionKeys("schedule")),
      status: "pending",
      createdAt: iso(now - 12 * 3_600_000),
      expiresAt: iso(now + 5 * DAY),
      resolvedBy: null,
      resolvedAt: null,
    },
    {
      id: "inv-4",
      channelId: OWN_CHANNEL_ID,
      method: "code",
      inviteeId: null,
      code: "CYLX-OLD1-X4WZ",
      permissions: k([viewKeyOf("analytics")]),
      status: "expired",
      createdAt: iso(now - 9 * DAY),
      expiresAt: iso(now - 2 * DAY),
      resolvedBy: null,
      resolvedAt: null,
    },
    {
      id: "inv-5",
      channelId: OWN_CHANNEL_ID,
      method: "username",
      inviteeId: "tu-pixelpete",
      code: null,
      permissions: k(sectionKeys("marks")),
      status: "revoked",
      createdAt: iso(now - 6 * DAY),
      expiresAt: iso(now + 1 * DAY),
      resolvedBy: null,
      resolvedAt: null,
    },
    {
      id: "inv-6",
      channelId: OWN_CHANNEL_ID,
      method: "username",
      inviteeId: "tu-modmaya",
      code: null,
      permissions: k(sectionKeys("commands"), sectionKeys("points"), sectionKeys("shop")),
      status: "active",
      createdAt: iso(now - 61 * DAY),
      expiresAt: iso(now - 54 * DAY),
      resolvedBy: "tu-modmaya",
      resolvedAt: iso(now - 60 * DAY),
    },
    // A pending invitation on another channel, so the invitee side can be tried by switching identity.
    {
      id: "inv-7",
      channelId: CHANNEL_B_ID,
      method: "username",
      inviteeId: "tu-chillali",
      code: null,
      permissions: k(["schedule.view"]),
      status: "pending",
      createdAt: iso(now - 3_600_000),
      expiresAt: iso(now + 6 * DAY),
      resolvedBy: null,
      resolvedAt: null,
    },
  ];

  const A = (n: number, hoursAgo: number, channelId: string, actorId: string, action: string, section: AuditEntry["section"], target: string): AuditEntry => ({
    id: `aud-${n}`,
    at: iso(now - hoursAgo * 3_600_000),
    channelId,
    actorId,
    action,
    section,
    target,
  });
  const audit: AuditEntry[] = [
    A(1, 2, OWN_CHANNEL_ID, "tu-modmaya", "commands.edit", "commands", "!discord"),
    A(2, 5, OWN_CHANNEL_ID, "tu-modomar", "shop.approve", "shop", "Song Request"),
    A(3, 9, OWN_CHANNEL_ID, DEMO_USER_ID, "team.permissions_changed", "team", "ModLayla"),
    A(4, 20, OWN_CHANNEL_ID, "tu-modmaya", "points.add", "points", "NovaKnight (+250)"),
    A(5, 27, OWN_CHANNEL_ID, "tu-modkarim", "timers.edit", "timers", "Follow reminder"),
    A(6, 30, OWN_CHANNEL_ID, "tu-modsara", "schedule.create", "schedule", "Viewer Games"),
    A(7, 50, OWN_CHANNEL_ID, DEMO_USER_ID, "team.invite_revoked", "team", "PixelPete"),
    A(8, 52, OWN_CHANNEL_ID, "tu-modzed", "marks.edit", "marks", "Boss fight win"),
    A(9, 70, OWN_CHANNEL_ID, "tu-modomar", "shop.add", "shop", "VIP Badge"),
    A(10, 96, OWN_CHANNEL_ID, DEMO_USER_ID, "team.invite_created", "team", "MintMoon"),
    A(11, 120, OWN_CHANNEL_ID, "tu-modadam", "widgets.edit", "widgets", "Follower Counter"),
    A(12, 4, CHANNEL_A_ID, DEMO_USER_ID, "commands.create", "commands", "!hype"),
    A(13, 26, CHANNEL_A_ID, "tu-novaplays", "team.member_added", "team", "ModMaya"),
    A(14, 8, CHANNEL_B_ID, "tu-atlastv", "team.permissions_changed", "team", "ModOmar"),
  ];

  return { v: 1, actorId: DEMO_USER_ID, activeChannelId: OWN_CHANNEL_ID, members, invitations, audit };
}
