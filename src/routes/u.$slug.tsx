import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { LinkInBioPage } from "@/components/link-in-bio/LinkInBioPage";
import {
  loadTestLinkInBio,
  publicLinkInBioPayload,
  type PublicLinkInBio,
} from "@/lib/linkInBio";
import { isTestMode } from "@/lib/testMode";

export const Route = createFileRoute("/u/$slug")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: `CylixStudio — ${params.slug}` },
      { name: "description", content: "Creator links, streams, and socials." },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: PublicLinkInBioRoute,
});

function PublicLinkInBioRoute() {
  const { slug } = Route.useParams();
  const [data, setData] = useState<PublicLinkInBio | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      const response = await fetch(`/api/public/link-in-bio/${encodeURIComponent(slug)}/live`, {
        cache: "no-store",
      });
      if (stopped) return;
      if (response.ok) {
        setData((await response.json()) as PublicLinkInBio);
        setMissing(false);
        return;
      }
      if (isTestMode()) {
        const test = loadTestLinkInBio();
        if (test.profile.slug === slug.toLowerCase() && test.profile.published) {
          setData(publicLinkInBioPayload(test));
          setMissing(false);
          return;
        }
      }
      setMissing(true);
    };
    void load();
    return () => {
      stopped = true;
    };
  }, [slug]);

  if (missing) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0a0a0a] px-6 text-neutral-300">
        <div className="max-w-sm rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-10 text-center">
          <p className="text-base font-semibold text-neutral-100">Page unavailable</p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            This Link in Bio page is unpublished or does not exist.
          </p>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0a0a0a] px-6 text-neutral-500">
        <div className="flex flex-col items-center gap-3">
          <span className="size-2 animate-pulse rounded-full bg-neutral-500" aria-hidden />
          <p className="text-sm">Loading page…</p>
        </div>
      </div>
    );
  }
  return <LinkInBioPage data={data} />;
}
