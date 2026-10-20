import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, Plus, Search, Trash2, X, Zap } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DarkSelect } from "@/components/ui/dark-select";
import { InfoTip } from "@/components/ui/info-tip";
import { SessionAwareError } from "@/components/widgets/SessionAwareError";
import { Switch, subathonFieldClass as fieldClass, subathonLabelClass as labelClass } from "@/components/widgets/SubathonUi";
import { useWorkspace } from "@/hooks/useWorkspace";
import { ensureWidgetSubathon, widgetErrorText } from "@/lib/createWidget";
import { useApplyDefaultPlatform } from "@/lib/defaultPlatform";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { eventsForPlatform, triggerPhrase, type StreamEventType } from "@/lib/platformEvents";
import { supabase } from "@/lib/supabase/client";
import { isMissingViewerSession } from "@/lib/supabase/sessionError";
import type { Database } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type Platform = Database["public"]["Enums"]["platform_type"];
type EventType = Database["public"]["Enums"]["rule_event_type"];
type Rule = Database["public"]["Tables"]["rules"]["Row"];
type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

export type RuleInput = {
  platform: Platform;
  event_type: EventType;
  seconds_per_unit: number;
  goal_increment: number;
  unit_amount: number;
  min_amount: number | null;
  max_seconds_per_event: number | null;
  priority: number;
};

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "TWITCH", label: "🟣 Twitch" },
  { value: "KICK", label: "🟢 Kick" },
  { value: "YOUTUBE", label: "🔴 YouTube" },
  { value: "TIKTOK", label: "🎵 TikTok" },
  { value: "STREAMLABS", label: "🧪 Streamlabs" },
  { value: "STREAMELEMENTS", label: "🔹 StreamElements" },
  { value: "MANUAL", label: "⚙️ Manual" },
];

const PLATFORM_STYLE: Record<Platform, string> = {
  TWITCH: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  KICK: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  TIKTOK: "border-pink-500/40 bg-pink-500/10 text-pink-300",
  STREAMLABS: "border-teal-500/40 bg-teal-500/10 text-teal-300",
  STREAMELEMENTS: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  YOUTUBE: "border-red-500/40 bg-red-500/10 text-red-300",
  X: "border-zinc-400/40 bg-zinc-400/10 text-zinc-200",
  MANUAL: "border-border bg-secondary/40 text-muted-foreground",
};

const PRESETS: {
  platform: Platform;
  event_type: EventType;
  seconds: number;
  min_amount: number | null;
}[] = [
  { platform: "TWITCH", event_type: "FOLLOW", seconds: 60, min_amount: null },
  { platform: "KICK", event_type: "SUBSCRIPTION", seconds: 300, min_amount: null },
  { platform: "TIKTOK", event_type: "DONATION", seconds: 5, min_amount: 1 },
  { platform: "STREAMLABS", event_type: "DONATION", seconds: 60, min_amount: 1 },
  { platform: "TWITCH", event_type: "RAID", seconds: 30, min_amount: null },
];

const platformLabel = (platform: string) =>
  PLATFORMS.find((entry) => entry.value === platform)?.label ?? platform;

function triggerKey(platform: string, eventType: string): TranslationKey {
  return `rules.event.${triggerPhrase(platform, eventType)}` as TranslationKey;
}

function eventForPlatform(platform: Platform, current: EventType): EventType {
  const allowed = eventsForPlatform(platform);
  if (allowed.includes(current as StreamEventType)) return current;
  return (allowed[0] ?? "FOLLOW") as EventType;
}

function formatSeconds(seconds: number, t: Translate) {
  if (seconds >= 60 && seconds % 60 === 0) return t("sub.rules.fmtMin", { n: seconds / 60 });
  return t("sub.rules.fmtSec", { n: seconds });
}

type Draft = {
  seconds_per_unit: string;
  unit_amount: string;
  goal_increment: string;
  min_amount: string;
  max_seconds_per_event: string;
  priority: string;
};

const emptyDraft = (): Draft => ({
  seconds_per_unit: "60",
  unit_amount: "1",
  goal_increment: "1",
  min_amount: "",
  max_seconds_per_event: "",
  priority: "100",
});

const draftFromRule = (rule: Rule): Draft => ({
  seconds_per_unit: String(rule.seconds_per_unit),
  unit_amount: String(rule.unit_amount),
  goal_increment: String(Number(rule.goal_increment)),
  min_amount: rule.min_amount == null ? "" : String(rule.min_amount),
  max_seconds_per_event: rule.max_seconds_per_event == null ? "" : String(rule.max_seconds_per_event),
  priority: String(rule.priority),
});

const inputFromDraft = (platform: Platform, eventType: EventType, draft: Draft): RuleInput => ({
  platform,
  event_type: eventType,
  seconds_per_unit: Number(draft.seconds_per_unit),
  goal_increment: Number(draft.goal_increment),
  unit_amount: Number(draft.unit_amount),
  min_amount: draft.min_amount === "" ? null : Number(draft.min_amount),
  max_seconds_per_event: draft.max_seconds_per_event === "" ? null : Number(draft.max_seconds_per_event),
  priority: Number(draft.priority),
});

function RuleFields({
  draft,
  onChange,
  wide,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  wide: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className={cn("grid grid-cols-2 gap-3", wide && "sm:grid-cols-3")}>
      <label>
        <span className={`${labelClass} inline-flex items-center gap-1.5`}>
          {t("sub.rules.timeAdded")}
          <InfoTip text={t("tooltips.rules.timeAdded")} />
        </span>
        <div className="relative mt-2">
          <input
            type="number"
            min={0}
            className={`${fieldClass} pe-12`}
            value={draft.seconds_per_unit}
            onChange={(event) => onChange({ seconds_per_unit: event.target.value })}
          />
          <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {t("sub.rules.sec")}
          </span>
        </div>
      </label>
      <label>
        <span className={`${labelClass} inline-flex items-center gap-1.5`}>
          {t("sub.rules.perUnits")}
          <InfoTip text={t("tooltips.rules.perUnits")} />
        </span>
        <input
          type="number"
          min={1}
          className={`${fieldClass} mt-2`}
          value={draft.unit_amount}
          onChange={(event) => onChange({ unit_amount: event.target.value })}
        />
      </label>
      <label>
        <span className={`${labelClass} inline-flex items-center gap-1.5`}>
          {t("sub.rules.goalPlus")}
          <InfoTip text={t("tooltips.rules.goalIncrement")} />
        </span>
        <input
          type="number"
          min={0}
          step="0.01"
          className={`${fieldClass} mt-2`}
          value={draft.goal_increment}
          onChange={(event) => onChange({ goal_increment: event.target.value })}
        />
      </label>
      <label>
        <span className={`${labelClass} inline-flex items-center gap-1.5`}>
          {t("sub.rules.minAmount")}
          <InfoTip text={t("tooltips.rules.minAmount")} />
        </span>
        <input
          type="number"
          min={0}
          placeholder={t("sub.rules.any")}
          className={`${fieldClass} mt-2`}
          value={draft.min_amount}
          onChange={(event) => onChange({ min_amount: event.target.value })}
        />
      </label>
      <label>
        <span className={`${labelClass} inline-flex items-center gap-1.5`}>
          {t("sub.rules.maxPerEvent")}
          <InfoTip text={t("tooltips.rules.maxPerEvent")} />
        </span>
        <input
          type="number"
          min={0}
          placeholder={t("sub.rules.none")}
          className={`${fieldClass} mt-2`}
          value={draft.max_seconds_per_event}
          onChange={(event) => onChange({ max_seconds_per_event: event.target.value })}
        />
      </label>
      <label>
        <span className={labelClass}>{t("sub.rules.priority")}</span>
        <input
          type="number"
          className={`${fieldClass} mt-2`}
          value={draft.priority}
          onChange={(event) => onChange({ priority: event.target.value })}
        />
      </label>
    </div>
  );
}

function RuleSummary({ rule }: { rule: Rule }) {
  const { t } = useLanguage();
  const parts = [t("sub.rules.every", { n: rule.unit_amount })];
  if (rule.min_amount != null && Number(rule.min_amount) > 0) {
    parts.push(t("sub.rules.min", { n: rule.min_amount }));
  }
  if (rule.max_seconds_per_event != null) parts.push(t("sub.rules.cap", { n: rule.max_seconds_per_event }));
  if (Number(rule.goal_increment) > 0) parts.push(t("sub.rules.goal", { n: Number(rule.goal_increment) }));
  return <>{parts.join(" · ")}</>;
}

function RuleEditor({
  rule,
  busy,
  canEdit,
  wide,
  onSave,
  onCancel,
  onDelete,
}: {
  rule: Rule;
  busy: boolean;
  canEdit: boolean;
  wide: boolean;
  onSave: (input: RuleInput) => Promise<void>;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<Draft>(() => draftFromRule(rule));
  return (
    <form
      className="space-y-3 border-t border-white/8 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(inputFromDraft(rule.platform, rule.event_type, draft)).then(onCancel, () => undefined);
      }}
    >
      <RuleFields draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} wide={wide} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={busy || !canEdit}
          className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {t("sub.rules.save")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="ms-auto inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
        >
          <Trash2 className="size-3.5" aria-hidden />
          {t("common.delete")}
        </button>
      </div>
    </form>
  );
}

function RuleRow({
  rule,
  open,
  busy,
  canEdit,
  wide,
  onOpenChange,
  onToggleEnabled,
  onSave,
  onDelete,
}: {
  rule: Rule;
  open: boolean;
  busy: boolean;
  canEdit: boolean;
  wide: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleEnabled: (enabled: boolean) => void;
  onSave: (input: RuleInput) => Promise<void>;
  onDelete: () => void;
}) {
  const { t } = useLanguage();
  const rowRef = useRef<HTMLLIElement>(null);
  const toggleOpen = () => {
    onOpenChange(!open);
    if (!open) requestAnimationFrame(() => rowRef.current?.scrollIntoView({ block: "nearest" }));
  };
  return (
    <li
      ref={rowRef}
      className={cn(
        "surface-inset overflow-hidden transition-colors",
        open && "border-primary/40",
      )}
      data-rule-row
    >
      <div className="flex items-center gap-2 ps-1 pe-3">
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? t("sub.rules.collapse") : t("sub.rules.expand")}
          onClick={toggleOpen}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2.5 text-start transition-colors hover:bg-white/[0.03]"
        >
          <ChevronDown
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90 rtl:rotate-90")}
            aria-hidden
          />
          <span className={cn("min-w-0 flex-1", !rule.is_enabled && "opacity-55")}>
            <span className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold",
                  PLATFORM_STYLE[rule.platform],
                )}
              >
                {platformLabel(rule.platform)}
              </span>
              <span className="text-xs font-semibold">{t(triggerKey(rule.platform, rule.event_type))}</span>
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[0.65rem] font-semibold text-primary">
                {formatSeconds(rule.seconds_per_unit, t)}
              </span>
            </span>
            <span className="mt-1 block truncate text-[11px] text-muted-foreground">
              <RuleSummary rule={rule} />
            </span>
          </span>
        </button>
        <Switch
          checked={rule.is_enabled}
          onChange={onToggleEnabled}
          label={t("sub.rules.toggle")}
          disabled={busy}
        />
      </div>
      {open ? (
        <RuleEditor
          rule={rule}
          busy={busy}
          canEdit={canEdit}
          wide={wide}
          onSave={onSave}
          onCancel={() => onOpenChange(false)}
          onDelete={onDelete}
        />
      ) : null}
    </li>
  );
}

function NewRuleEditor({
  rules,
  busy,
  canEdit,
  wide,
  defaultPlatform,
  onSave,
  onClose,
}: {
  rules: Rule[];
  busy: boolean;
  canEdit: boolean;
  wide: boolean;
  defaultPlatform: string | null | undefined;
  onSave: (input: RuleInput) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [platform, setPlatform] = useState<Platform>("TWITCH");
  const [eventType, setEventType] = useState<EventType>("DONATION");
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const pick = (nextPlatform: Platform, nextEvent: EventType) => {
    setPlatform(nextPlatform);
    setEventType(nextEvent);
    const match = rules.find((rule) => rule.platform === nextPlatform && rule.event_type === nextEvent);
    if (match) setDraft(draftFromRule(match));
  };

  useApplyDefaultPlatform(defaultPlatform, (next) => {
    if (!PLATFORMS.some((entry) => entry.value === next)) return;
    setPlatform(next);
    setEventType((current) => eventForPlatform(next, current));
  });

  const existing = rules.some((rule) => rule.platform === platform && rule.event_type === eventType);

  return (
    <form
      className="surface-inset space-y-3 border-primary/40 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(inputFromDraft(platform, eventType, draft)).then(onClose, () => undefined);
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{existing ? t("sub.rules.updateRule") : t("sub.rules.newRule")}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.cancel")}
          className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className={labelClass}>{t("sub.rules.platform")}</span>
          <DarkSelect
            className="mt-2"
            value={platform}
            onValueChange={(next) => {
              const nextPlatform = next as Platform;
              pick(nextPlatform, eventForPlatform(nextPlatform, eventType));
            }}
            options={PLATFORMS}
          />
        </label>
        <label>
          <span className={labelClass}>{t("sub.rules.event")}</span>
          <DarkSelect
            className="mt-2"
            value={eventType}
            onValueChange={(next) => pick(platform, next as EventType)}
            options={eventsForPlatform(platform).map((value) => ({
              value,
              label: t(triggerKey(platform, value)),
            }))}
          />
        </label>
      </div>
      <RuleFields draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} wide={wide} />
      <button
        type="submit"
        disabled={busy || !canEdit}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        <Plus className="size-4" aria-hidden />
        {existing ? t("sub.rules.updateRule") : t("sub.rules.add")}
      </button>
      <p className="text-[11px] text-muted-foreground">{t("sub.rules.oneRuleHint")}</p>
    </form>
  );
}

/**
 * Compact rule list: every rule is one collapsed row (trigger, effect, conditions, switch)
 * and expands into its editor. The list scrolls inside a bounded box so many rules never
 * stretch the page.
 */
export function RulesManager({
  rules,
  loading,
  busy,
  canEdit,
  compact = false,
  defaultPlatform,
  onSave,
  onToggleEnabled,
  onDelete,
}: {
  rules: Rule[];
  loading: boolean;
  busy: boolean;
  canEdit: boolean;
  compact?: boolean;
  defaultPlatform?: string | null | undefined;
  onSave: (input: RuleInput) => Promise<void>;
  onToggleEnabled: (rule: Rule, enabled: boolean) => void;
  onDelete: (rule: Rule) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("ALL");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [adding, setAdding] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Rule | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const ordered = [...rules].sort(
      (a, b) =>
        b.priority - a.priority ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    );
    return ordered.filter((rule) => {
      if (platformFilter !== "ALL" && rule.platform !== platformFilter) return false;
      if (!needle) return true;
      const haystack = [
        rule.platform,
        platformLabel(rule.platform),
        rule.event_type,
        t(triggerKey(rule.platform, rule.event_type)),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [rules, query, platformFilter, t]);

  const setRuleOpen = (id: string, next: boolean) =>
    setOpen((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });

  const filtering = query.trim() !== "" || platformFilter !== "ALL";

  return (
    <div className="space-y-3">
      <div className="surface-inset space-y-2.5 p-2.5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            className={`${fieldClass} ps-9`}
            value={query}
            placeholder={t("sub.rules.search")}
            aria-label={t("sub.rules.search")}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <DarkSelect
            className="h-10 min-w-[9rem] flex-1"
            value={platformFilter}
            aria-label={t("sub.rules.platform")}
            onValueChange={setPlatformFilter}
            options={[{ value: "ALL", label: t("sub.rules.allPlatforms") }, ...PLATFORMS]}
          />
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setAdding((prev) => !prev)}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="size-4" aria-hidden />
            {t("sub.rules.add")}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
          <span aria-live="polite">
            {filtering
              ? t("sub.rules.countFiltered", { shown: filtered.length, total: rules.length })
              : t("sub.rules.count", { n: rules.length })}
          </span>
          <span className="ms-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOpen(new Set(filtered.map((rule) => rule.id)))}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/5 hover:text-foreground disabled:opacity-40"
            >
              <ChevronsUpDown className="size-3.5" aria-hidden />
              {t("sub.rules.expandAll")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(new Set())}
              disabled={open.size === 0}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/5 hover:text-foreground disabled:opacity-40"
            >
              <ChevronsDownUp className="size-3.5" aria-hidden />
              {t("sub.rules.collapseAll")}
            </button>
          </span>
        </div>
      </div>

      <div className="surface-inset">
        <button
          type="button"
          aria-expanded={presetsOpen}
          onClick={() => setPresetsOpen((prev) => !prev)}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <Zap className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">{t("sub.rules.presets")}</span>
          <ChevronDown className={cn("size-4 transition-transform", presetsOpen && "rotate-180")} aria-hidden />
        </button>
        {presetsOpen ? (
          <div className="flex flex-wrap gap-2 border-t border-white/8 p-3">
            {PRESETS.map((preset) => (
              <button
                key={`${preset.platform}-${preset.event_type}`}
                type="button"
                disabled={busy || !canEdit}
                onClick={() =>
                  void onSave({
                    platform: preset.platform,
                    event_type: preset.event_type,
                    seconds_per_unit: preset.seconds,
                    goal_increment: 0,
                    unit_amount: 1,
                    min_amount: preset.min_amount,
                    max_seconds_per_event: null,
                    priority: 100,
                  }).catch(() => undefined)
                }
                className="rounded-full border border-border bg-secondary/40 px-2.5 py-1.5 text-[0.7rem] font-medium transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-50"
              >
                <bdi>{platformLabel(preset.platform)}</bdi>{" "}
                <bdi>{t(triggerKey(preset.platform, preset.event_type))}</bdi>{" "}
                <bdi>{formatSeconds(preset.seconds, t)}</bdi>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {adding ? (
        <NewRuleEditor
          rules={rules}
          busy={busy}
          canEdit={canEdit}
          wide={!compact}
          defaultPlatform={defaultPlatform}
          onSave={onSave}
          onClose={() => setAdding(false)}
        />
      ) : null}

      {loading ? (
        <p className="surface-inset p-4 text-sm text-muted-foreground">{t("sub.rules.loading")}</p>
      ) : rules.length === 0 ? (
        <p className="surface-inset p-4 text-sm text-muted-foreground">{t("sub.rules.empty")}</p>
      ) : filtered.length === 0 ? (
        <p className="surface-inset p-4 text-sm text-muted-foreground">{t("sub.rules.noMatch")}</p>
      ) : (
        <ul
          className={cn(
            "space-y-1.5 overflow-y-auto overscroll-contain pe-1",
            compact ? "max-h-[28rem]" : "max-h-[40rem]",
          )}
          data-rules-list
        >
          {filtered.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              open={open.has(rule.id)}
              busy={busy}
              canEdit={canEdit}
              wide={!compact}
              onOpenChange={(next) => setRuleOpen(rule.id, next)}
              onToggleEnabled={(enabled) => onToggleEnabled(rule, enabled)}
              onSave={onSave}
              onDelete={() => setToDelete(rule)}
            />
          ))}
        </ul>
      )}

      <AlertDialog open={toDelete !== null} onOpenChange={(next) => (next ? undefined : setToDelete(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("sub.rules.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete
                ? t("sub.rules.deleteDesc", {
                    name: `\u2066${platformLabel(toDelete.platform)} · ${t(triggerKey(toDelete.platform, toDelete.event_type))}\u2069`,
                  })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const target = toDelete;
                setToDelete(null);
                if (target) {
                  setRuleOpen(target.id, false);
                  void onDelete(target).catch(() => undefined);
                }
              }}
            >
              {t("sub.rules.deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Per-widget Rules & Logic editor — embeddable in the Subathon sidebar
 * or the standalone `/widgets/$widgetId/rules` page.
 */
export function WidgetRulesPanel({
  widgetId,
  subathonId,
  compact = false,
}: {
  widgetId: string;
  subathonId: string | null;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const sessionUser = useQuery({
    queryKey: ["auth-user-id"],
    staleTime: 60_000,
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? "",
  });
  const workspace = useWorkspace(sessionUser.data ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [linkedSubathonId, setLinkedSubathonId] = useState<string | null>(subathonId);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    setLinkedSubathonId(subathonId);
  }, [subathonId]);

  useEffect(() => {
    if (linkedSubathonId) return;
    let cancelled = false;
    setLinking(true);
    void ensureWidgetSubathon(widgetId)
      .then((id) => {
        if (cancelled) return;
        setLinkedSubathonId(id);
        void queryClient.invalidateQueries({ queryKey: ["widget", widgetId] });
        void queryClient.invalidateQueries({ queryKey: ["workspace"] });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(widgetErrorText(err, t("sub.rules.errLink")));
      })
      .finally(() => {
        if (!cancelled) setLinking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [linkedSubathonId, queryClient, widgetId, t]);

  const activeSubathonId = linkedSubathonId;

  const rulesQuery = useQuery({
    queryKey: ["widget-rules", widgetId],
    queryFn: async () => {
      const { data, error: readError } = await supabase
        .from("rules")
        .select("*")
        .eq("widget_id", widgetId)
        .order("priority", { ascending: false });
      if (readError) throw readError;
      return data as Rule[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["widget-rules", widgetId] });

  const fail = (err: Error, fallback: string) => {
    setNotice(null);
    const message = widgetErrorText(err, fallback);
    setError(message);
    if (!isMissingViewerSession(message)) toast.error(message);
  };

  const saveRule = useMutation({
    mutationFn: async (input: RuleInput) => {
      if (!activeSubathonId) throw new Error(t("sub.rules.linkFirst"));
      const { error: writeError } = await supabase.from("rules").upsert(
        {
          subathon_id: activeSubathonId,
          widget_id: widgetId,
          platform: input.platform,
          event_type: input.event_type,
          unit_amount: Math.max(1, input.unit_amount || 1),
          seconds_per_unit: Math.max(0, input.seconds_per_unit || 0),
          goal_increment: Math.max(0, input.goal_increment || 0),
          min_amount: input.min_amount,
          max_seconds_per_event: input.max_seconds_per_event,
          priority: input.priority || 0,
          is_enabled: true,
        },
        { onConflict: "subathon_id,platform,event_type" },
      );
      if (writeError) throw writeError;
    },
    onError: (err: Error) => fail(err, t("sub.rules.errSave")),
    onSuccess: (_data, input) => {
      setError(null);
      setNotice(
        t("sub.rules.saved", {
          name: `\u2066${platformLabel(input.platform)} · ${t(triggerKey(input.platform, input.event_type))}\u2069`,
        }),
      );
      void invalidate();
    },
  });

  const patchRule = useMutation({
    mutationFn: async ({ ruleId, patch }: { ruleId: string; patch: Partial<Rule> }) => {
      const { error: writeError } = await supabase.from("rules").update(patch).eq("id", ruleId);
      if (writeError) throw writeError;
    },
    onError: (err: Error) => fail(err, t("sub.rules.errUpdate")),
    onSuccess: () => void invalidate(),
  });

  const deleteRule = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error: writeError } = await supabase.from("rules").delete().eq("id", ruleId);
      if (writeError) throw writeError;
    },
    onError: (err: Error) => fail(err, t("sub.rules.errDelete")),
    onSuccess: () => {
      setNotice(t("sub.rules.deleted"));
      void invalidate();
    },
  });

  return (
    <div className="space-y-3">
      <SessionAwareError error={error} signedOutLabel={t("widget.signedOut")} className="text-sm" />
      {notice ? (
        <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary" role="status">
          {notice}
        </p>
      ) : null}

      {!activeSubathonId ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {linking ? t("sub.rules.linking") : t("sub.rules.linkNeeded")}
        </p>
      ) : null}

      <RulesManager
        rules={rulesQuery.data ?? []}
        loading={rulesQuery.isLoading}
        busy={saveRule.isPending || patchRule.isPending || deleteRule.isPending}
        canEdit={Boolean(activeSubathonId)}
        compact={compact}
        defaultPlatform={workspace.data?.profile?.default_platform}
        onSave={(input) => saveRule.mutateAsync(input)}
        onToggleEnabled={(rule, enabled) => patchRule.mutate({ ruleId: rule.id, patch: { is_enabled: enabled } })}
        onDelete={(rule) => deleteRule.mutateAsync(rule.id)}
      />
    </div>
  );
}
