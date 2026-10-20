import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { OverlayView } from "@/components/overlay/OverlayView";
import { ANIMATION_KEY, LAYOUT_KEY, LayoutMini } from "@/components/widgets/SubathonTimerSidebar";
import { Switch } from "@/components/widgets/SubathonUi";
import { useTimerStream } from "@/hooks/useTimerStream";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/lib/supabase/client";
import { DarkSelect } from "@/components/ui/dark-select";
import { useLanguage } from "@/lib/i18n";
import {
  DEFAULT_OVERLAY_THEME,
  OVERLAY_ANIMATIONS,
  OVERLAY_FONTS,
  OVERLAY_FONT_STYLESHEET,
  OVERLAY_LAYOUTS,
  parseOverlayTheme,
  type OverlayTheme,
} from "@/lib/overlayTheme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/subathons/$id/overlay")({
  head: () => ({
    meta: [
      { title: "CylixStudio — Overlay Builder" },
      {
        name: "description",
        content:
          "Design your OBS subathon overlay: layout, fonts, colors and animations with a live preview and copyable browser source URL.",
      },
      { property: "og:title", content: "CylixStudio — Overlay Builder" },
      {
        property: "og:description",
        content: "Customize the transparent OBS overlay for your subathon timer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: OVERLAY_FONT_STYLESHEET }],
  }),
  component: OverlayBuilder,
});

const cardClass = "surface-card surface-card-pad";
const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
const headingClass = "text-sm font-semibold uppercase tracking-wider text-muted-foreground";

function OverlayBuilder() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const { t } = useLanguage();
  const workspace = useWorkspace(user.id);
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState<OverlayTheme>(DEFAULT_OVERLAY_THEME);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const overlayQuery = useQuery({
    queryKey: ["overlay", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("overlays")
        .select("id, name, public_token, is_public, theme")
        .eq("subathon_id", id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const overlay = overlayQuery.data ?? null;

  useEffect(() => {
    if (overlay) setTheme(parseOverlayTheme(overlay.theme));
  }, [overlay]);

  const publicToken = overlay?.is_public ? (overlay.public_token ?? null) : null;
  const { frame, remaining } = useTimerStream(publicToken);
  const previewRemaining = frame ? remaining : 3 * 3600 + 25 * 60 + 12;
  const overlayUrl = overlay ? `${origin}/overlay/${overlay.public_token}` : "";

  const save = useMutation({
    mutationFn: async (next: OverlayTheme) => {
      if (!overlay) throw new Error(t("sub.overlay.noOverlayError"));
      const { error } = await supabase
        .from("overlays")
        .update({ theme: next as never })
        .eq("id", overlay.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("sub.overlay.savedToast"));
      void queryClient.invalidateQueries({ queryKey: ["overlay", id] });
    },
    onError: (error: Error) => toast.error(error.message || t("sub.overlay.saveFailed")),
  });

  const togglePublic = useMutation({
    mutationFn: async (isPublic: boolean) => {
      if (!overlay) return;
      const { error } = await supabase
        .from("overlays")
        .update({ is_public: isPublic })
        .eq("id", overlay.id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["overlay", id] }),
    onError: (error: Error) => toast.error(error.message || t("sub.overlay.visibilityFailed")),
  });

  const createOverlay = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("overlays")
        .insert({ subathon_id: id, name: "OBS Overlay", is_public: true, theme: theme as never });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("sub.overlay.createdToast"));
      void queryClient.invalidateQueries({ queryKey: ["overlay", id] });
    },
    onError: (error: Error) => toast.error(error.message || t("sub.overlay.createFailed")),
  });

  const subathon = useMemo(
    () => workspace.data?.subathons.find((entry) => entry.id === id) ?? null,
    [workspace.data, id],
  );

  const set = <K extends keyof OverlayTheme>(key: K, value: OverlayTheme[K]) =>
    setTheme((current) => ({ ...current, [key]: value }));

  const copyUrl = async () => {
    if (!overlayUrl) return;
    try {
      await navigator.clipboard.writeText(overlayUrl);
    } catch {
      const input = document.createElement("input");
      input.value = overlayUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppShell
      user={user}
      profile={workspace.data?.profile}
      subathons={workspace.data?.subathons ?? []}
      activeSubathonId={id}
      title={t("sub.overlay.title")}
      subtitle={
        subathon
          ? t("sub.overlay.subtitleNamed", { name: subathon.title })
          : t("sub.overlay.subtitle")
      }
      actions={
        <button
          type="button"
          disabled={!overlay || save.isPending}
          onClick={() => save.mutate(theme)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {save.isPending ? t("sub.overlay.saving") : t("sub.overlay.save")}
        </button>
      }
    >
      {overlayQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("sub.overlay.loading")}</p>
      ) : !overlay ? (
        <div className={cardClass}>
          <h2 className="font-semibold">{t("sub.overlay.noneTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("sub.overlay.noneDesc")}</p>
          <button
            type="button"
            onClick={() => createOverlay.mutate()}
            disabled={createOverlay.isPending}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {t("sub.overlay.create")}
          </button>
          {createOverlay.error ? (
            <p className="mt-3 text-sm text-destructive">{String(createOverlay.error)}</p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <section className={cardClass}>
            <h2 className={headingClass}>{t("sub.overlay.customization")}</h2>

            <div className="mt-4 space-y-4">
              <div>
                <span className="text-sm font-medium">{t("sub.tab.layout")}</span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {OVERLAY_LAYOUTS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={theme.layout === option.value}
                      onClick={() => set("layout", option.value)}
                      className={cn(
                        "flex min-w-0 flex-col overflow-hidden rounded-xl border bg-zinc-950/40 text-start text-sm transition-colors hover:border-primary/50",
                        theme.layout === option.value ? "border-primary" : "border-border",
                      )}
                    >
                      <LayoutMini theme={theme} layout={option.value} />
                      <span className="px-2 py-1.5">
                        <span className="block text-xs font-semibold">{t(LAYOUT_KEY[option.value].name)}</span>
                        <span className="block text-[10px] text-muted-foreground">
                          {t(LAYOUT_KEY[option.value].hint)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="block text-sm font-medium">
                {t("sub.font")}
                <DarkSelect
                  className="mt-2"
                  value={theme.fontFamily}
                  onValueChange={(next) => set("fontFamily", next)}
                  options={OVERLAY_FONTS.map((font) => ({
                    value: font.value,
                    label: font.value.startsWith("system-ui") ? t("sub.font.system") : font.label,
                  }))}
                />
              </label>

              <label className="block text-sm font-medium">
                {t("sub.fontSize")} · <span dir="ltr">{theme.fontSize}px</span>
                <input
                  type="range"
                  min={24}
                  max={200}
                  value={theme.fontSize}
                  onChange={(event) => set("fontSize", Number(event.target.value))}
                  className="mt-2 w-full accent-primary"
                />
              </label>

              <div className="grid grid-cols-3 gap-3">
                <ColorField
                  label={t("sub.color.text")}
                  value={theme.textColor}
                  onChange={(value) => set("textColor", value)}
                />
                <ColorField
                  label={t("sub.color.background")}
                  value={theme.backgroundColor}
                  onChange={(value) => set("backgroundColor", value)}
                />
                <ColorField
                  label={t("sub.color.accent")}
                  value={theme.accentColor}
                  onChange={(value) => set("accentColor", value)}
                />
              </div>

              <label className="block text-sm font-medium">
                {t("sub.opacity")} · <span dir="ltr">{theme.backgroundOpacity}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={theme.backgroundOpacity}
                  onChange={(event) => set("backgroundOpacity", Number(event.target.value))}
                  className="mt-2 w-full accent-primary"
                />
              </label>

              <label className="block text-sm font-medium">
                {t("sub.animation")}
                <DarkSelect
                  className="mt-2"
                  value={theme.animation}
                  onValueChange={(next) => set("animation", next as OverlayTheme["animation"])}
                  options={OVERLAY_ANIMATIONS.map((option) => ({
                    value: option.value,
                    label: t(ANIMATION_KEY[option.value]),
                  }))}
                />
              </label>

              <label className="block text-sm font-medium">
                {t("sub.titleText")}
                <input
                  className={fieldClass}
                  value={theme.label}
                  maxLength={40}
                  dir="auto"
                  onChange={(event) => set("label", event.target.value)}
                />
              </label>

              <div className="space-y-2">
                <Toggle
                  label={t("sub.showTitle")}
                  checked={theme.showLabel}
                  onChange={(value) => set("showLabel", value)}
                />
                <Toggle
                  label={t("sub.showStatus")}
                  checked={theme.showStatus}
                  onChange={(value) => set("showStatus", value)}
                />
                <Toggle
                  label={t("sub.popups")}
                  checked={theme.showAddedPopups}
                  onChange={(value) => set("showAddedPopups", value)}
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTheme(DEFAULT_OVERLAY_THEME)}
                  className="rounded-lg border border-border px-3 py-2 text-sm hover:border-primary hover:text-primary"
                >
                  {t("sub.overlay.reset")}
                </button>
                <button
                  type="button"
                  disabled={save.isPending}
                  onClick={() => save.mutate(theme)}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {t("sub.overlay.save")}
                </button>
              </div>
              {save.error ? (
                <p className="text-sm text-destructive">{String(save.error)}</p>
              ) : save.isSuccess ? (
                <p className="text-sm text-primary">{t("sub.overlay.savedHint")}</p>
              ) : null}
            </div>
          </section>

          <div className="space-y-5">
            <section className={cardClass}>
              <div className="flex items-center justify-between gap-2">
                <h2 className={headingClass}>{t("sub.overlay.preview")}</h2>
                <span className="text-xs text-muted-foreground">
                  {frame ? t("sub.overlay.synced", { status: frame.status }) : t("sub.overlay.sample")}
                </span>
              </div>
              <div
                className="mt-4 grid min-h-[320px] place-items-center overflow-hidden rounded-2xl border border-white/8 p-6"
                dir="ltr"
                style={{
                  backgroundImage:
                    "linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.05) 75%), linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.05) 75%)",
                  backgroundSize: "24px 24px",
                  backgroundPosition: "0 0, 12px 12px",
                }}
              >
                <OverlayView
                  theme={theme}
                  remaining={previewRemaining}
                  frame={frame}
                  scale={theme.fontSize > 110 ? 0.7 : 1}
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{t("sub.overlay.checker")}</p>
            </section>

            <section className={cardClass}>
              <h2 className={headingClass}>{t("sub.extra.obs")}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  readOnly
                  value={overlayUrl}
                  dir="ltr"
                  onFocus={(event) => event.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={copyUrl}
                  className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                  {copied ? t("sub.overlay.copied") : t("sub.overlay.copyUrl")}
                </button>
                <a
                  href={overlayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary hover:text-primary"
                >
                  <ExternalLink className="size-4" aria-hidden /> {t("sub.overlay.open")}
                </a>
              </div>
              <div className="mt-4">
                <Toggle
                  label={t("sub.overlay.public")}
                  checked={overlay.is_public}
                  onChange={(value) => togglePublic.mutate(value)}
                />
              </div>
              <ol className="mt-4 list-decimal space-y-1 ps-5 text-sm text-muted-foreground">
                <li>{t("sub.overlay.step1")}</li>
                <li>{t("sub.overlay.step2")}</li>
                <li>{t("sub.overlay.step3")}</li>
              </ol>
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <span className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="size-7 cursor-pointer rounded border-0 bg-transparent p-0"
          aria-label={label}
        />
        <span className="font-mono text-xs text-muted-foreground" dir="ltr">
          {value}
        </span>
      </span>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="surface-inset flex w-full items-center justify-between gap-3 px-3 py-2.5 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
