import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { TikTokTappersView } from "@/components/widgets/WidgetRenderer";
import { useWidgetStream } from "@/hooks/useWidgetStream";
import { OVERLAY_FONT_STYLESHEET } from "@/lib/overlayTheme";

export const Route = createFileRoute("/overlay/tiktok-tappers")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
  head: () => ({
    meta: [
      { title: "CylixStudio — TikTok Top Tappers (OBS)" },
      {
        name: "description",
        content:
          "Transparent OBS browser source showing the live TikTok top tappers leaderboard with animated ranks.",
      },
      { property: "og:title", content: "CylixStudio — TikTok Top Tappers (OBS)" },
      {
        property: "og:description",
        content: "Live TikTok tap leaderboard overlay for OBS and Streamlabs Desktop.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "stylesheet", href: OVERLAY_FONT_STYLESHEET }],
  }),
  component: TappersOverlayPage,
});

function TappersOverlayPage() {
  const { token } = Route.useSearch();
  const { widget, tappers } = useWidgetStream(token.trim().length > 0 ? token.trim() : null);

  // OBS composites the page over the scene, so nothing may paint a background.
  useEffect(() => {
    document.body.classList.add("overlay-transparent");
    const previousHtml = document.documentElement.style.background;
    document.documentElement.style.background = "transparent";
    return () => {
      document.body.classList.remove("overlay-transparent");
      document.documentElement.style.background = previousHtml;
    };
  }, []);

  return (
    <main className="min-h-screen w-full bg-transparent p-6">
      {widget ? <TikTokTappersView config={widget.config} tappers={tappers} /> : null}
    </main>
  );
}
