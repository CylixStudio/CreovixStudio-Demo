import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  Clock3,
  Coins,
  Crown,
  Gamepad2,
  Gift,
  LogIn,
  LogOut,
  Megaphone,
  Music2,
  Package,
  Search,
  ShoppingBag,
  Star,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DEMO_CHANGE_EVENT, dbKeyFor } from "@/demo/overlay";
import {
  readStorefront,
  readChannelSnapshot,
  redeemStoreReward,
  resolveStoreChannel,
  safeStoreImage,
  selectStoreViewer,
  storeAvatar,
  STORE_VIEWER_EVENT,
  STORE_VIEWER_KEY,
  StorefrontError,
  type Storefront,
  type StoreReward,
} from "@/lib/demoStorefront";
import { useLanguage } from "@/lib/i18n";
import { STOREFRONT_COPY } from "@/lib/i18n.storefront";
import {
  demoShopIdentities,
  primaryShopIdentity,
  shortShopPath,
  type ShopPlatform,
  type ShopIdentity,
} from "@/lib/demoShopLinks";

const card = "rounded-2xl border border-white/[0.08] bg-[#141414]";
type Filter = "all" | "inStock" | "affordable";
type PendingReward = { reward: StoreReward; requestId: string; viewerId: string };

function ChannelAvatar({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <img
      src={failed === url ? storeAvatar(name) : url}
      alt=""
      className="size-9 shrink-0 rounded-full border border-white/10 object-cover"
      onError={() => setFailed(url)}
    />
  );
}

function RewardArt({ reward, large = false }: { reward: StoreReward; large?: boolean }) {
  const url = safeStoreImage(reward.image_url);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const Icon = /song|music|أغني|موسيقى/i.test(reward.name)
    ? Music2
    : /vip|badge|شارة/i.test(reward.name)
      ? Crown
      : /game|loadout|1v1|لعب/i.test(reward.name)
        ? Gamepad2
        : /shout|تحية/i.test(reward.name)
          ? Megaphone
          : /hoodie|merch|cookbook|كتاب/i.test(reward.name)
            ? Package
            : Gift;
  return (
    <div
      className={`relative grid shrink-0 place-items-center overflow-hidden bg-[#101010] ${large ? "aspect-square rounded-xl" : "h-[132px]"}`}
    >
      {url && failedUrl !== url ? (
        <img
          src={url}
          alt={reward.name}
          loading="lazy"
          decoding="async"
          className={`${large ? "size-full" : "size-[120px]"} object-contain transition-transform duration-300 motion-safe:group-hover:scale-[1.03]`}
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <div className="grid size-[120px] place-items-center">
          <Icon className="size-10 stroke-[1.25] text-[#bee1fc]" aria-hidden />
        </div>
      )}
    </div>
  );
}

export function DemoPointsStore({ slug, platform }: { slug: string; platform?: ShopPlatform }) {
  const { lang, dir } = useLanguage();
  const c = STOREFRONT_COPY[lang];
  const [data, setData] = useState<Storefront | null>(null);
  const [shopLinks, setShopLinks] = useState<ShopIdentity[]>(() => demoShopIdentities());
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loginOpen, setLoginOpen] = useState(false);
  const [pending, setPending] = useState<PendingReward | null>(null);
  const [busy, setBusy] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const currentSlug = useRef(slug);
  currentSlug.current = slug;
  const number = (value: number) =>
    new Intl.NumberFormat(lang === "ar" ? "ar-SA" : "en-US", {
      numberingSystem: "latn",
    }).format(value);
  const points = (value: number) => `${number(value)} ${c.points}`;

  const load = useCallback(() => {
    try {
      const channel = resolveStoreChannel(slug, platform);
      setShopLinks(demoShopIdentities(readChannelSnapshot));
      setMissing(!channel);
      setData(channel ? readStorefront(channel) : null);
      setLoadError(false);
    } catch {
      setData(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [slug, platform]);

  useEffect(() => {
    setLoading(true);
    setPending(null);
    setNotice(null);
    setRedeemError(null);
    setSearch("");
    setFilter("all");
    load();
    const storage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === STORE_VIEWER_KEY ||
        event.key === dbKeyFor("own") ||
        event.key?.startsWith("cylixstudio-demo:db:v1")
      )
        load();
    };
    window.addEventListener("storage", storage);
    window.addEventListener(DEMO_CHANGE_EVENT, load);
    window.addEventListener(STORE_VIEWER_EVENT, load);
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener(DEMO_CHANGE_EVENT, load);
      window.removeEventListener(STORE_VIEWER_EVENT, load);
    };
  }, [load]);

  const channelName = data?.channel.name;
  useEffect(() => {
    document.title = channelName
      ? `CylixStudio — ${c.store} ${channelName}`
      : `CylixStudio — ${c.title}`;
  }, [channelName, c.store, c.title]);

  const changeViewer = (id: string | null) => {
    try {
      selectStoreViewer(id);
      setLoginOpen(false);
      setPending(null);
      setNotice(null);
      if (id === null) setFilter("all");
    } catch {
      setNotice(c.errors.storage_failed);
      toast.error(c.errors.storage_failed);
    }
  };

  const redeem = async () => {
    if (!data || !pending || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setRedeemError(null);
    const startedSlug = slug;
    try {
      await redeemStoreReward({
        channelId: data.channel.id,
        viewerId: pending.viewerId,
        rewardId: pending.reward.id,
        requestId: pending.requestId,
        expectedCost: pending.reward.cost,
      });
      if (currentSlug.current !== startedSlug) return;
      setPending(null);
      setNotice(c.success);
      toast.success(c.success);
      load();
    } catch (err) {
      if (currentSlug.current !== startedSlug) return;
      const text = c.errors[err instanceof StorefrontError ? err.reason : "storage_failed"];
      setRedeemError(text);
      toast.error(text);
      load();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const balance = data?.member?.points ?? 0;
  const visible =
    data?.rewards.filter((reward) => {
      if (filter === "inStock" && (reward.stock === 0 || reward.enabled === false)) return false;
      if (
        filter === "affordable" &&
        (!data.viewer || reward.cost > balance || reward.stock === 0 || reward.enabled === false)
      )
        return false;
      return `${reward.name} ${reward.description ?? ""}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase());
    }) ?? [];
  const selected = pending ? data?.rewards.find((reward) => reward.id === pending.reward.id) : null;
  const canConfirm =
    selected &&
    data?.viewer?.id === pending?.viewerId &&
    selected.cost === pending?.reward.cost &&
    selected.enabled !== false &&
    selected.stock !== 0 &&
    balance >= selected.cost;

  return (
    <main dir={dir} className="min-h-screen bg-[#0a0a0a] text-zinc-100" data-testid="points-store">
      <div className="border-b border-white/[0.07]">
        <nav
          dir="ltr"
          className="mx-auto flex max-w-[1355px] items-center justify-between gap-4 px-4 py-3 sm:px-6"
          aria-label="CylixStudio"
        >
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 text-sm font-semibold tracking-tight"
          >
            <BrandLogo size="sm" showWordmark />
            <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-[0.6rem] font-medium uppercase text-zinc-400">
              Demo
            </span>
          </Link>
          <LanguageSwitcher />
        </nav>
      </div>
      <div className="mx-auto max-w-[1355px] px-4 py-6 sm:px-6">
        {loading ? (
          <div role="status" aria-label={c.load}>
            <Skeleton className="mx-auto mb-6 h-20 w-60 bg-white/5" />
            <div className="grid gap-[26px] md:grid-cols-[200px_minmax(0,1fr)]">
              <Skeleton className="h-80 bg-white/5" />
              <div className="grid grid-cols-[repeat(auto-fill,205px)] gap-3.5">
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton key={i} className="h-[274px] bg-white/5" />
                ))}
              </div>
            </div>
          </div>
        ) : loadError || missing ? (
          <div className={`${card} mx-auto max-w-xl p-8 text-center`}>
            <ShoppingBag className="mx-auto mb-4 size-8 text-zinc-500" aria-hidden />
            <h1 className="text-lg font-semibold">{loadError ? c.error : c.missing}</h1>
            <p
              role={loadError ? "alert" : undefined}
              className="mt-3 text-sm leading-7 text-zinc-400"
            >
              {loadError ? c.errors.load_failed : c.missingHint}
            </p>
            {loadError ? (
              <Button variant="outline" className="mt-5" onClick={load}>
                {c.retry}
              </Button>
            ) : null}
          </div>
        ) : data ? (
          <>
            <header className="mb-6 text-center">
              <div className="mb-2 flex items-center justify-center gap-2.5">
                <ChannelAvatar url={data.channel.avatar} name={data.channel.name} />
                <h1 className="break-words text-xl font-semibold tracking-tight">
                  {c.store} <bdi>{data.channel.name}</bdi>
                </h1>
              </div>
              <p className="text-xs text-zinc-400">
                {number(
                  data.rewards.filter((reward) => reward.enabled !== false && reward.stock !== 0)
                    .length,
                )}{" "}
                {c.rewards}
              </p>
              {data.channel.description ? (
                <p className="mx-auto mt-2 max-w-xl break-words text-xs leading-5 text-zinc-400">
                  {data.channel.description}
                </p>
              ) : null}
            </header>
            {notice ? (
              <p
                role="status"
                className="mb-6 rounded-xl border border-white/10 bg-[#181818] p-4 text-sm leading-6"
              >
                {notice}
              </p>
            ) : null}
            <div
              dir="ltr"
              className="grid items-start gap-[26px] md:grid-cols-[200px_minmax(0,1fr)]"
            >
              <aside
                dir={dir}
                className={`${card} p-4 md:sticky md:top-5 md:max-h-[calc(100dvh-2.5rem)] md:overflow-y-auto`}
                aria-label={c.viewer}
              >
                {data.viewer && data.member ? (
                  <>
                    <div className="flex flex-col items-center gap-2 text-center">
                      <img
                        src={data.viewer.avatar}
                        alt=""
                        className="size-14 rounded-full border border-white/10"
                      />
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold" dir="auto">
                          {data.viewer.name}
                        </p>
                        <p className="mt-1 text-xs text-zinc-400">{c.member}</p>
                      </div>
                    </div>
                    <div className="my-4 text-center">
                      <p className="text-xs text-zinc-400">{c.balance}</p>
                      <p className="mt-1 flex items-baseline justify-center gap-1.5">
                        <span
                          className="text-2xl font-semibold tabular-nums"
                          data-testid="viewer-balance"
                        >
                          {number(balance)}
                        </span>
                        <span className="text-xs text-zinc-400">{c.points}</span>
                      </p>
                      <p className="mt-2 truncate text-[0.7rem] text-zinc-500">
                        {data.channel.name}
                      </p>
                    </div>
                    <dl className="mb-4 space-y-2.5 text-xs">
                      {data.member.level != null ? (
                        <div className="flex justify-between gap-2">
                          <dt className="flex items-center gap-2 text-zinc-400">
                            <Star className="size-3.5" aria-hidden />
                            {c.level}
                          </dt>
                          <dd>{number(data.member.level)}</dd>
                        </div>
                      ) : null}
                      {data.member.watch_seconds != null ? (
                        <div className="flex justify-between gap-2">
                          <dt className="flex items-center gap-2 text-zinc-400">
                            <Clock3 className="size-3.5" aria-hidden />
                            {c.watch}
                          </dt>
                          <dd>
                            {number(Math.floor(data.member.watch_seconds / 3600))} {c.hours}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                    <Button
                      variant="outline"
                      className="h-8 w-full border-white/10 text-xs"
                      onClick={() => changeViewer(null)}
                      disabled={busy}
                    >
                      <LogOut />
                      {c.logout}
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="mx-auto mb-3 grid size-14 place-items-center rounded-full border border-white/10 bg-white/5">
                      <UserRound className="size-5 text-zinc-300" aria-hidden />
                    </span>
                    <h2 className="text-center text-sm font-semibold">{c.guest}</h2>
                    <p className="my-3 text-center text-xs leading-5 text-zinc-400">
                      {c.guestHint}
                    </p>
                    <Button className="h-8 w-full text-xs" onClick={() => setLoginOpen(true)}>
                      <LogIn />
                      {c.login}
                    </Button>
                  </>
                )}
                <div className="mt-4 border-t border-white/[0.07] pt-4">
                  <h3 className="text-xs font-medium">{c.earn}</h3>
                  <p className="mt-2 text-xs leading-6 text-zinc-400">{c.earnHint}</p>
                </div>
              </aside>
              <section dir={dir} className="min-w-0" aria-label={c.all}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <div className="relative w-full min-[380px]:w-48">
                    <Search
                      className="pointer-events-none absolute start-2.5 top-2 size-3.5 text-zinc-500"
                      aria-hidden
                    />
                    <Input
                      type="search"
                      aria-label={c.search}
                      placeholder={c.search}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="h-8 border-white/10 bg-[#141414] ps-8 text-xs"
                    />
                  </div>
                  <div
                    className="flex max-w-full flex-wrap gap-1 rounded-xl border border-white/[0.08] bg-[#141414] p-1"
                    role="group"
                    aria-label={c.all}
                  >
                    {(["all", "inStock", "affordable"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        disabled={value === "affordable" && !data.viewer}
                        aria-pressed={filter === value}
                        onClick={() => setFilter(value)}
                        className={`rounded-lg px-2 py-1 text-[11px] transition-colors disabled:opacity-40 ${filter === value ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
                      >
                        {c[value]}
                      </button>
                    ))}
                  </div>
                </div>
                {!visible.length ? (
                  <div className={`${card} px-6 py-16 text-center`}>
                    <Gift className="mx-auto mb-4 size-9 stroke-[1.25] text-zinc-500" aria-hidden />
                    <h2 className="text-base font-semibold">
                      {data.rewards.length ? c.noResults : c.empty}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-zinc-400">
                      {data.rewards.length ? c.noResultsHint : c.emptyHint}
                    </p>
                    {data.rewards.length ? (
                      <Button
                        variant="outline"
                        className="mt-5"
                        onClick={() => {
                          setFilter("all");
                          setSearch("");
                        }}
                      >
                        {c.clear}
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div
                    dir="ltr"
                    className="grid grid-cols-[min(205px,100%)] justify-start gap-3.5 min-[380px]:grid-cols-[repeat(2,min(205px,calc((100vw-46px)/2)))] sm:grid-cols-[repeat(auto-fill,205px)]"
                    data-testid="reward-grid"
                  >
                    {visible.map((reward) => {
                      const unavailable = reward.enabled === false;
                      const soldOut = reward.stock === 0;
                      const insufficient = data.viewer !== null && reward.cost > balance;
                      const label = unavailable
                        ? c.unavailable
                        : soldOut
                          ? c.soldOut
                          : !data.viewer
                            ? c.login
                            : insufficient
                              ? c.insufficient
                              : c.redeem;
                      return (
                        <article
                          key={reward.id}
                          data-reward-id={reward.id}
                          dir={dir}
                          className={`${card} group flex h-[274px] min-w-0 flex-col overflow-hidden rounded-xl transition-[border-color,box-shadow] duration-200 hover:border-white/20 hover:shadow-lg hover:shadow-black/15`}
                        >
                          <RewardArt reward={reward} />
                          <div className="flex min-h-0 flex-1 flex-col p-3">
                            <h2
                              className="truncate text-xs font-semibold leading-5"
                              title={reward.name}
                            >
                              {reward.name}
                            </h2>
                            <p
                              className="mt-1 line-clamp-2 break-words text-[11px] leading-4 text-zinc-400"
                              title={reward.description ?? ""}
                            >
                              {reward.description}
                            </p>
                            <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/[0.07] pt-2">
                              <div className="min-w-0">
                                <p
                                  aria-label={points(reward.cost)}
                                  className="flex items-center gap-1 text-xs font-semibold tabular-nums"
                                >
                                  <Coins className="size-3 shrink-0 text-[#bee1fc]" aria-hidden />
                                  {number(reward.cost)}
                                </p>
                                <p
                                  className={`mt-1 text-[10px] ${soldOut ? "text-amber-300" : "text-zinc-500"}`}
                                >
                                  {reward.stock === null
                                    ? c.unlimited
                                    : `${number(reward.stock)} ${c.stock}`}
                                </p>
                              </div>
                              <Button
                                variant={
                                  unavailable || soldOut || insufficient ? "outline" : "default"
                                }
                                className="h-8 max-w-[88px] shrink-0 whitespace-normal px-2 text-[10px] leading-3"
                                disabled={unavailable || soldOut || insufficient || busy}
                                onClick={() => {
                                  if (!data.viewer) {
                                    setLoginOpen(true);
                                    return;
                                  }
                                  setPending({
                                    reward,
                                    viewerId: data.viewer.id,
                                    requestId: crypto.randomUUID(),
                                  });
                                  setRedeemError(null);
                                }}
                              >
                                {label}
                              </Button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </>
        ) : null}
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.07] pt-6 text-xs text-zinc-500">
          <p className="max-w-xl leading-5">
            CylixStudio · {c.demo} — {c.demoHint}
          </p>
          <nav className="flex flex-wrap items-center gap-4" aria-label={c.visit}>
            {[
              ["own", "DemoUser"],
              ["streamer-a", "Streamer A"],
              ["streamer-b", "Streamer B"],
            ].map(([id, name]) => {
              const identity = primaryShopIdentity(id ?? "", shopLinks);
              return identity ? (
                <a key={id} href={shortShopPath(identity)}>
                  {name}
                </a>
              ) : null;
            })}
          </nav>
        </footer>
      </div>
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent
          dir={dir}
          closeLabel={c.close}
          className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto border-white/10 bg-[#141414]"
        >
          <DialogHeader>
            <DialogTitle>{c.signInTitle}</DialogTitle>
            <DialogDescription className="leading-7">{c.signInHint}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {data?.viewers.map((viewer) => (
              <button
                key={viewer.id}
                type="button"
                onClick={() => changeViewer(viewer.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#1b1b1b] p-4 text-start transition-colors hover:border-[#bee1fc]/40"
              >
                <img src={viewer.avatar} className="size-11 rounded-full" alt="" />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-medium">{viewer.name}</span>
                  <span className="mt-1 block text-xs text-zinc-400">{c.member}</span>
                </span>
                <LogIn className="size-4 text-zinc-400" aria-hidden />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !inFlight.current) {
            setPending(null);
            setRedeemError(null);
          }
        }}
      >
        <DialogContent
          dir={dir}
          closeLabel={c.close}
          className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto border-white/10 bg-[#141414]"
        >
          <DialogHeader>
            <DialogTitle>{c.confirmTitle}</DialogTitle>
            <DialogDescription>{c.confirmHint}</DialogDescription>
          </DialogHeader>
          {pending ? (
            <>
              <div className="mx-auto w-full max-w-48">
                <RewardArt reward={pending.reward} large />
              </div>
              <h2 className="text-center text-base font-semibold">{pending.reward.name}</h2>
              <dl className="space-y-3 rounded-xl bg-[#0a0a0a] p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-400">{c.price}</dt>
                  <dd>{points(pending.reward.cost)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-400">{c.balance}</dt>
                  <dd>{points(balance)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-white/10 pt-3">
                  <dt className="text-zinc-400">{c.after}</dt>
                  <dd>{points(Math.max(0, balance - pending.reward.cost))}</dd>
                </div>
              </dl>
              {redeemError || !canConfirm ? (
                <p
                  role="alert"
                  className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-sm leading-6 text-amber-200"
                >
                  {redeemError ??
                    (!data?.viewer || data.viewer.id !== pending.viewerId
                      ? c.errors.signed_out
                      : selected?.stock === 0
                        ? c.errors.out_of_stock
                        : balance < pending.reward.cost
                          ? c.errors.insufficient_points
                          : c.errors.unavailable)}
                </p>
              ) : null}
              <DialogFooter className="gap-2">
                <Button variant="outline" disabled={busy} onClick={() => setPending(null)}>
                  {c.cancel}
                </Button>
                <Button disabled={busy || !canConfirm} onClick={() => void redeem()}>
                  <Check />
                  {busy ? c.processing : c.confirm}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
