import { useEffect, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DEMO_CHANGE_EVENT } from "@/demo/overlay";
import { readActiveChannelId } from "@/features/channel-team/storage";
import {
  demoShopIdentities,
  resolveShopIdentity,
  shortShopPath,
  type ShopIdentity,
} from "@/lib/demoShopLinks";
import { readChannelSnapshot } from "@/lib/demoStorefront";
import { useLanguage } from "@/lib/i18n";

export function DemoShopLinks() {
  const { lang } = useLanguage();
  const [identities, setIdentities] = useState<ShopIdentity[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const refresh = () => {
      try {
        const directory = demoShopIdentities(readChannelSnapshot);
        setIdentities(
          directory.filter(
            (identity) =>
              identity.channelId === readActiveChannelId() &&
              resolveShopIdentity(directory, identity.platform, identity.username)?.channelId ===
                identity.channelId,
          ),
        );
        setFailed(false);
      } catch {
        setFailed(true);
        setIdentities([]);
      }
    };
    refresh();
    window.addEventListener(DEMO_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(DEMO_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const ar = lang === "ar";
  if (failed)
    return (
      <p role="alert" className="mb-4 text-sm text-amber-200">
        {ar ? "تعذّرت قراءة روابط المتجر المحفوظة." : "Could not read the saved store links."}
      </p>
    );
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[#141414] p-4">
      <span className="text-xs text-muted-foreground">{ar ? "روابط المتجر" : "Store links"}</span>
      {identities.map((identity) => (
        <div key={identity.platform} className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard
                .writeText(`${window.location.origin}${shortShopPath(identity)}`)
                .then(() => toast.success(ar ? "تم نسخ رابط المتجر" : "Store link copied"))
                .catch(() =>
                  toast.error(ar ? "تعذّر نسخ رابط المتجر" : "Could not copy the store link"),
                );
            }}
          >
            <Copy />
            {identity.platform === "kick" ? "Kick" : "Twitch"}
          </Button>
          <Button variant="outline" size="icon" className="size-8" asChild>
            <a
              href={shortShopPath(identity)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${ar ? "فتح متجر" : "Open store"} ${identity.platform}`}
            >
              <ExternalLink />
            </a>
          </Button>
        </div>
      ))}
      {!identities.length ? (
        <span className="text-xs text-muted-foreground">
          {ar
            ? "لا توجد هوية Kick أو Twitch موثوقة لهذه القناة."
            : "No verified Kick or Twitch identity for this channel."}
        </span>
      ) : null}
    </div>
  );
}
