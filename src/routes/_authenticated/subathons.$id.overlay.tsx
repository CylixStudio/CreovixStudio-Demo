import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { OverlayView } from "@/components/overlay/OverlayView";
import { useTimerStream } from "@/hooks/useTimerStream";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/lib/supabase/client";
import { DarkSelect } from "@/components/ui/dark-select";
import {
  DEFAULT_OVERLAY_THEME,
  OVERLAY_ANIMATIONS,
  OVERLAY_FONTS,
  OVERLAY_FONT_STYLESHEET,
  OVERLAY_LAYOUTS,
  parseOverlayTheme,
  type OverlayTheme,
} from "@/lib/overlayTheme";

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

const cardClass = "rounded-2xl border border-border bg-card p-5";
const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function OverlayBuilder() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
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
      if (!overlay) throw new Error("No overlay exists for this subathon yet.");
      const { error } = await supabase
        .from("overlays")
        .update({ theme: next as never })
        .eq("id", overlay.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Overlay saved");
      void queryClient.invalidateQueries({ queryKey: ["overlay", id] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not save overlay"),
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
    onError: (error: Error) => toast.error(error.message || "Could not update visibility"),
  });

  const createOverlay = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("overlays")
        .insert({ subathon_id: id, name: "OBS Overlay", is_public: true, theme: theme as never });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Overlay created");
      void queryClient.invalidateQueries({ queryKey: ["overlay", id] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not create overlay"),
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
      title="Overlay builder"
      subtitle={subathon ? `${subathon.title} · OBS browser source` : "Design your OBS overlay"}
      actions={
        <button
          type="button"
          disabled={!overlay || save.isPending}
          onClick={() => save.mutate(theme)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save overlay"}
        </button>
      }
    >
      {overlayQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading overlay…</p>
      ) : !overlay ? (
        <div className={cardClass}>
          <h2 className="font-semibold">No overlay yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a public browser source for this subathon to start designing.
          </p>
          <button
            type="button"
            onClick={() => createOverlay.mutate()}
            disabled={createOverlay.isPending}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Create overlay
          </button>
          {createOverlay.error ? (
            <p className="mt-3 text-sm text-destructive">{String(createOverlay.error)}</p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <section className={cardClass}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Customization
            </h2>

            <div className="mt-4 space-y-4">
              <div>
                <span className="text-sm font-medium">Layout</span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {OVERLAY_LAYOUTS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => set("layout", option.value)}
                      className={`rounded-xl border p-3 text-start text-sm transition-colors ${
                        theme.layout === option.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background hover:border-primary/60"
                      }`}
                    >
                      <span className="block font-semibold">{option.label}</span>
                      <span className="block text-xs text-muted-foreground">{option.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="block text-sm font-medium">
                Font
                <DarkSelect
                  className="mt-2"
                  value={theme.fontFamily}
                  onValueChange={(next) => set("fontFamily", next)}
                  options={OVERLAY_FONTS.map((font) => ({
                    value: font.value,
                    label: font.label,
                  }))}
                />
              </label>

              <label className="block text-sm font-medium">
                Font size · {theme.fontSize}px
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
                  label="Text"
                  value={theme.textColor}
                  onChange={(value) => set("textColor", value)}
                />
                <ColorField
                  label="Background"
                  value={theme.backgroundColor}
                  onChange={(value) => set("backgroundColor", value)}
                />
                <ColorField
                  label="Accent"
                  value={theme.accentColor}
                  onChange={(value) => set("accentColor", value)}
                />
              </div>

              <label className="block text-sm font-medium">
                Background opacity · {theme.backgroundOpacity}%
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
                Animation on time added
                <DarkSelect
                  className="mt-2"
                  value={theme.animation}
                  onValueChange={(next) => set("animation", next as OverlayTheme["animation"])}
                  options={OVERLAY_ANIMATIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                />
              </label>

              <label className="block text-sm font-medium">
                Label
                <input
                  className={fieldClass}
                  value={theme.label}
                  maxLength={40}
                  onChange={(event) => set("label", event.target.value)}
                />
              </label>

              <div className="space-y-2">
                <Toggle
                  label="Show label"
                  checked={theme.showLabel}
                  onChange={(value) => set("showLabel", value)}
                />
                <Toggle
                  label="Show timer status"
                  checked={theme.showStatus}
                  onChange={(value) => set("showStatus", value)}
                />
                <Toggle
                  label='Show floating "+time" popups'
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
                  Reset to defaults
                </button>
                <button
                  type="button"
                  disabled={save.isPending}
                  onClick={() => save.mutate(theme)}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  Save overlay
                </button>
              </div>
              {save.error ? (
                <p className="text-sm text-destructive">{String(save.error)}</p>
              ) : save.isSuccess ? (
                <p className="text-sm text-primary">Saved — OBS picks it up within 15s.</p>
              ) : null}
            </div>
          </section>

          <div className="space-y-5">
            <section className={cardClass}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Live preview
                </h2>
                <span className="text-xs text-muted-foreground">
                  {frame ? `synced · ${frame.status}` : "sample time"}
                </span>
              </div>
              <div
                className="mt-4 grid min-h-[320px] place-items-center rounded-2xl border border-border p-6"
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
              <p className="mt-3 text-xs text-muted-foreground">
                The checkerboard marks transparency — OBS composites your scene there.
              </p>
            </section>

            <section className={cardClass}>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                OBS browser source
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  readOnly
                  value={overlayUrl}
                  onFocus={(event) => event.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={copyUrl}
                  className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                  {copied ? "Copied" : "Copy URL"}
                </button>
                <a
                  href={overlayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary hover:text-primary"
                >
                  <ExternalLink className="size-4" aria-hidden /> Open
                </a>
              </div>
              <div className="mt-4">
                <Toggle
                  label="Overlay is publicly reachable (required by OBS)"
                  checked={overlay.is_public}
                  onChange={(value) => togglePublic.mutate(value)}
                />
              </div>
              <ol className="mt-4 list-decimal space-y-1 ps-5 text-sm text-muted-foreground">
                <li>In OBS add a Browser source and paste the URL above.</li>
                <li>Set width 1920, height 1080 and leave the background transparent.</li>
                <li>Enable “Shutdown source when not visible” off so the timer stays connected.</li>
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
          aria-label={`${label} color`}
        />
        <span className="font-mono text-xs text-muted-foreground">{value}</span>
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
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-start text-sm"
    >
      <span>{label}</span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-secondary"
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-background transition-all ${
            checked ? "start-[1.125rem]" : "start-0.5"
          }`}
        />
      </span>
    </button>
  );
}
