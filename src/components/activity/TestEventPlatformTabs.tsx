import { PlatformAsset } from "@/components/icons/platformAssets";
import { TEST_EVENT_GROUPS, type TestEventGroup } from "@/lib/testEvents";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function TestEventPlatformTabs({
  activePlatform,
  onSelect,
}: {
  activePlatform: TestEventGroup["platform"];
  onSelect: (platform: TestEventGroup["platform"]) => void;
}) {
  const { t } = useLanguage();

  return (
    <div
      className="flex flex-wrap items-end justify-start gap-x-0.5 gap-y-1.5"
      role="tablist"
      aria-label={t("settings.test.platformsAria")}
    >
      {TEST_EVENT_GROUPS.map((group) => {
        const selected = group.platform === activePlatform;
        return (
          <button
            key={group.platform}
            type="button"
            role="tab"
            aria-selected={selected}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => onSelect(group.platform)}
            className={cn(
              "flex flex-col items-center gap-1 bg-transparent px-2.5 pb-1.5 pt-0.5",
              "text-center text-[0.68rem] font-medium leading-none tracking-tight",
              "border-0 border-b border-transparent shadow-none ring-0 outline-none",
              "transition-colors duration-150 ease-out",
              "hover:text-foreground focus-visible:text-foreground",
              selected
                ? "border-b-foreground/70 text-foreground"
                : "text-muted-foreground",
            )}
          >
            <PlatformAsset name={group.icon} size={16} label="" />
            <span className="whitespace-nowrap" dir="auto">
              {t(group.tabKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
