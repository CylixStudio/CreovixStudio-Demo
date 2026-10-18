import { hasKey } from "./resolver";
import { sectionOfKey } from "./permissions";
import type { ActorContext, PermissionKey, SectionId } from "./types";

/**
 * Maps demo database writes to Channel Team permissions. This is the Demo Adapter layer: it keeps
 * a moderator from changing data in a section they cannot manage even if the UI is bypassed.
 * It runs inside the browser/demo server of this demo, so it is NOT transferable server security.
 */

type Row = Record<string, unknown>;
export type WriteMode = "insert" | "update" | "delete" | "upsert";
export type WriteOp = { table: string; mode: WriteMode; before: Row | null; after: Row | null };

export type WriteVerdict =
  | { allowed: true; audit: { section: SectionId; action: PermissionKey; target: string } | null }
  | { allowed: false; key: PermissionKey | "owner"; message: string };

const IGNORED = new Set(["updated_at", "created_at"]);

function changedColumns(before: Row | null, after: Row | null): string[] {
  if (!before || !after) return ["*"];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => !IGNORED.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

const str = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

export function describeRow(table: string, row: Row | null): string {
  if (!row) return "";
  switch (table) {
    case "custom_chat_commands":
      return `${str(row.prefix) || "!"}${str(row.name)}`;
    case "default_chat_commands":
      return `${str(row.prefix) || "!"}${str(row.command_id ?? row.name ?? row.id)}`;
    case "message_timers":
      return str(row.message).slice(0, 40);
    case "loyalty_members":
      return str(row.display_name);
    case "loyalty_shop_items":
      return str(row.name);
    case "stream_marks":
      return str(row.note || row.author);
    case "mark_point_allowlist":
      return str(row.username);
    case "stream_schedule_slots":
      return str(row.title);
    case "link_in_bio_links":
      return str(row.title);
    case "widgets":
      return str(row.name ?? row.type);
    default:
      return "";
  }
}

type Rule = { key: PermissionKey; target?: string } | "allow" | "owner";

function ruleFor(op: WriteOp): Rule {
  const { table, mode, before, after } = op;
  const row = after ?? before;
  const changed = changedColumns(before, after);
  const onlyToggle = changed.length > 0 && changed.every((column) => column === "enabled");
  const target = describeRow(table, row);
  const insertLike = !before && mode !== "delete";

  switch (table) {
    case "custom_chat_commands":
      if (mode === "delete") return { key: "commands.delete", target };
      if (insertLike) return { key: "commands.create", target };
      return { key: onlyToggle ? "commands.toggle" : "commands.edit", target };
    case "default_chat_commands":
      return { key: onlyToggle ? "commands.toggle" : "commands.edit", target };
    case "custom_chat_command_settings":
    case "chat_text_alerts":
      return { key: "commands.edit", target };
    case "message_timers":
      if (mode === "delete") return { key: "timers.delete", target };
      return { key: insertLike ? "timers.add" : "timers.edit", target };
    case "loyalty_members": {
      if (mode === "delete") return { key: "points.remove", target };
      if (insertLike) return { key: "points.add", target };
      const delta = Number(after?.points ?? 0) - Number(before?.points ?? 0);
      return { key: delta < 0 ? "points.remove" : "points.add", target: delta ? `${target} (${delta > 0 ? "+" : ""}${delta})` : target };
    }
    case "loyalty_shop_items":
      if (mode === "delete") return { key: "shop.delete", target };
      return { key: insertLike ? "shop.add" : "shop.edit", target };
    case "loyalty_sales":
      return { key: "shop.edit", target };
    case "stream_marks":
      if (mode === "delete") return { key: "marks.delete", target };
      return { key: insertLike ? "marks.add" : "marks.edit", target };
    case "mark_point_allowlist":
    case "mark_point_settings":
      return { key: "marks.edit", target };
    case "stream_schedule_slots":
      if (mode === "delete") return { key: "schedule.delete", target };
      return { key: insertLike ? "schedule.create" : "schedule.edit", target };
    case "stream_schedule_settings":
      return { key: "schedule.edit", target };
    case "link_in_bio_links":
      return { key: "bio.links", target };
    case "link_in_bio_profiles":
    case "link_in_bio_themes":
      return { key: "bio.appearance", target };
    case "widgets":
    case "goals":
    case "subathons":
    case "rules":
    case "timer_states":
    case "overlays":
    case "media_request_settings":
    case "media_requests":
    case "media_playback_state":
      return { key: "widgets.edit", target };
    case "platform_connections":
    case "user_subscriptions":
    case "studio_settings":
    case "users":
      return "owner";
    default:
      // System tables (events, kv, logs, ...) are written by the platform, not by a section.
      return "allow";
  }
}

const DENIED_PREFIX = "Permission denied";

export function denialMessage(key: PermissionKey | "owner"): string {
  return `${DENIED_PREFIX} (Channel Team demo): ${key === "owner" ? "owner only" : key}`;
}

export function isDenialMessage(message: string | undefined | null): boolean {
  return typeof message === "string" && message.startsWith(DENIED_PREFIX);
}

export function evaluateWrite(ctx: ActorContext, op: WriteOp): WriteVerdict {
  if (ctx.owner) return { allowed: true, audit: null };
  // Writes that change nothing (idempotent "ensure row" upserts) never need a permission.
  if (op.mode !== "delete" && op.before && op.after && changedColumns(op.before, op.after).length === 0) {
    return { allowed: true, audit: null };
  }
  const rule = ruleFor(op);
  if (rule === "allow") return { allowed: true, audit: null };
  if (rule === "owner") return { allowed: false, key: "owner", message: denialMessage("owner") };
  if (!hasKey(ctx, rule.key)) return { allowed: false, key: rule.key, message: denialMessage(rule.key) };
  return { allowed: true, audit: { section: sectionOfKey(rule.key), action: rule.key, target: rule.target ?? "" } };
}
