import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { WidgetRenderer } from "@/components/widgets/WidgetRenderer";
import { useWidgetStream } from "@/hooks/useWidgetStream";
import {
  OVERLAY_FONT_STYLESHEET,
  OVERLAY_LAYOUTS,
  parseOverlayTheme,
  type OverlayLayout,
} from "@/lib/overlayTheme";

const validLayouts = new Set<string>(OVERLAY_LAYOUTS.map((entry) => entry.value));

export const Route = createFileRoute("/overlay/subathon-timer")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
    layout:
      typeof search["layout"] === "string" && validLayouts.has(search["layout"])
        ? (search["layout"] as OverlayLayout)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "CylixStudio — Subathon Timer (OBS)" },
      { name: "description", content: "Transparent live Subathon timer overlay for OBS." },
      { property: "og:title", content: "CylixStudio — Subathon Timer (OBS)" },
      { property: "og:description", content: "Transparent live Subathon timer overlay for OBS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "stylesheet", href: OVERLAY_FONT_STYLESHEET }],
  }),
  component: SubathonTimerOverlayPage,
});

function SubathonTimerOverlayPage() {
  const { token, layout } = Route.useSearch();
  const stream = useWidgetStream(token.trim().length > 0 ? token.trim() : null);

  useEffect(() => {
    document.body.classList.add("overlay-transparent");
    const previousHtml = document.documentElement.style.background;
    document.documentElement.style.background = "transparent";
    return () => {
      document.body.classList.remove("overlay-transparent");
      document.documentElement.style.background = previousHtml;
    };
  }, []);

  if (!stream.widget || stream.widget.type !== "SUBATHON_TIMER") return null;

  const savedTheme = parseOverlayTheme(stream.widget.config);
  const config = { ...savedTheme, layout: layout ?? savedTheme.layout };

  return (
    <main className="grid min-h-screen w-full place-items-center bg-transparent p-6">
      <WidgetRenderer
        type="SUBATHON_TIMER"
        config={config}
        frame={stream.frame}
        remaining={stream.remaining}
        goal={stream.goal}
        events={stream.events}
        spin={stream.spin}
      />
    </main>
  );
}