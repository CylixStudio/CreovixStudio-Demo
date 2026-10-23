import { useEffect, useState, type ReactNode } from "react";
import {
  Ban,
  Check,
  Copy,
  Download,
  FlaskConical,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DarkSelect } from "@/components/ui/dark-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  addDemoCode,
  createDemoAdminState,
  DEMO_ADMIN_KEY,
  demoAdminSchema,
  demoCodesCsv,
  demoCodeStatus,
  editDemoCode,
  filterDemoCodes,
  setDemoEarlyAccess,
  updateDemoCode,
  type DemoAdminCode,
  type DemoAdminState,
  type DemoCodeFilter,
  type DemoCodeStatus,
} from "@/lib/demoAdmin";
import { isDemoBuild } from "@/lib/demoMode";
import { useLanguage } from "@/lib/i18n";
import { ADMIN_COPY } from "@/lib/i18n.admin";

const surface = "min-w-0 rounded-2xl border border-white/[0.08] bg-[#141414] p-5 sm:p-6";
const field = "border-white/10 bg-[#0a0a0a] text-foreground";
const statusStyle: Record<DemoCodeStatus, string> = {
  available: "bg-emerald-400/10 text-emerald-300",
  disabled: "bg-amber-400/10 text-amber-300",
  redeemed: "bg-white/10 text-zinc-200",
  revoked: "bg-red-400/10 text-red-300",
};

function SectionTitle({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span
        className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300 [&>svg]:size-4"
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold sm:text-base">{title}</h3>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

type Confirmation =
  | { kind: "delete" | "revoke"; code: DemoAdminCode }
  | { kind: "access"; userId: string }
  | { kind: "reset" };

export function DemoAdminPanel() {
  const { lang, dir } = useLanguage();
  const c = ADMIN_COPY[lang];
  const [data, setData] = useState<DemoAdminState | null>(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState("");
  const [duration, setDuration] = useState("30");
  const [customDays, setCustomDays] = useState("7");
  const [notes, setNotes] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [filter, setFilter] = useState<DemoCodeFilter>("all");
  const [editing, setEditing] = useState<DemoAdminCode | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isDemoBuild()) return;
    const load = () => {
      try {
        const raw = window.localStorage.getItem(DEMO_ADMIN_KEY);
        const next = raw === null ? createDemoAdminState() : demoAdminSchema.parse(JSON.parse(raw));
        setData(next);
        setVersion(next.version);
        setError(false);
      } catch {
        setData(null);
        setError(true);
      }
    };
    load();
    const onStorage = (event: StorageEvent) => {
      if (event.key === DEMO_ADMIN_KEY || event.key === null) load();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!isDemoBuild()) return null;

  const commit = (change: () => DemoAdminState, success: string): boolean => {
    try {
      const next = demoAdminSchema.parse(change());
      window.localStorage.setItem(DEMO_ADMIN_KEY, JSON.stringify(next));
      setData(next);
      setMessage(success);
      toast.success(success);
      return true;
    } catch (err) {
      const text =
        err instanceof Error && err.message === "duplicate_code" ? c.duplicate : c.failure;
      setMessage(text);
      toast.error(text);
      return false;
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      toast.success(c.copied);
    } catch {
      toast.error(c.copyFailed);
    }
  };
  const date = (value: string) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-SA" : "en-GB", {
      dateStyle: "medium",
      calendar: "gregory",
    }).format(new Date(value));
  const durationText = (days: number) => (days === 36500 ? c.lifetime : `${days} ${c.days}`);
  const filters: DemoCodeFilter[] = ["all", "available", "redeemed", "disabled", "revoked"];
  const rows = data ? filterDemoCodes(data, filter, search) : [];
  const users =
    data?.users.filter((user) =>
      `${user.name} ${user.email}`
        .toLocaleLowerCase()
        .includes(userSearch.trim().toLocaleLowerCase()),
    ) ?? [];

  const confirm = () => {
    if (!confirmation) return;
    if (confirmation.kind === "reset") {
      const defaults = createDemoAdminState();
      if (commit(() => defaults, c.resetDone)) {
        setVersion(defaults.version);
        setError(false);
        setGenerated(null);
        setCopied(null);
        setDuration("30");
        setCustomDays("7");
        setNotes("");
        setSearch("");
        setUserSearch("");
        setFilter("all");
        setConfirmation(null);
      }
      return;
    }
    if (!data) return;
    const saved =
      confirmation.kind === "access"
        ? commit(() => setDemoEarlyAccess(data, confirmation.userId, false), c.roleSaved)
        : commit(
            () => updateDemoCode(data, confirmation.code.id, confirmation.kind),
            confirmation.kind === "delete" ? c.deleted : c.subscriptionRevoked,
          );
    if (saved) {
      if ("code" in confirmation && confirmation.code.code === generated) setGenerated(null);
      setConfirmation(null);
    }
  };

  const exportCsv = () => {
    if (!data) return;
    if (!data.codes.some((code) => demoCodeStatus(code) === "available")) {
      toast.error(c.noExport);
      return;
    }
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", demoCodesCsv(data)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "cylixstudio-demo-codes.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success(c.exported);
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6" dir={dir} data-testid="demo-admin">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{c.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{c.subtitle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setConfirmation({ kind: "reset" })}>
          <RotateCcw />
          {c.reset}
        </Button>
      </header>
      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 text-xs leading-6 text-muted-foreground">
        <FlaskConical className="mt-1 size-4 shrink-0" aria-hidden />
        <p>
          <strong className="me-2 font-medium text-foreground">{c.sandbox}</strong>
          {c.sandboxHint}
        </p>
      </div>
      {message ? (
        <p
          role="status"
          className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300"
        >
          {c.loadFailure}
        </p>
      ) : null}
      {!data && !error ? (
        <p role="status" className="py-10 text-muted-foreground">
          {c.loading}
        </p>
      ) : null}
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: c.codes, value: data.codes.length },
              {
                label: c.available,
                value: data.codes.filter((row) => demoCodeStatus(row) === "available").length,
              },
              {
                label: c.redeemed,
                value: data.codes.filter((row) => demoCodeStatus(row) === "redeemed").length,
              },
              { label: c.accessCount, value: data.users.filter((user) => user.earlyAccess).length },
            ].map((item) => (
              <div
                className="rounded-2xl border border-white/[0.07] bg-[#141414] px-5 py-4"
                key={item.label}
              >
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <section className={surface} aria-label={c.version}>
              <SectionTitle icon={<Send />} title={c.version} hint={c.versionHint} />
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-4 py-3">
                <span className="text-xs text-muted-foreground">{c.currentVersion}</span>
                <span className="font-mono text-sm" dir="ltr">
                  {data.version}
                </span>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (
                    commit(
                      () => ({
                        ...data,
                        version: version.trim(),
                        lastBroadcast: new Date().toISOString(),
                      }),
                      c.versionSaved,
                    )
                  )
                    setVersion(version.trim());
                }}
              >
                <label className="block space-y-2 text-xs text-muted-foreground">
                  <span>{c.versionLabel}</span>
                  <Input
                    className={field}
                    value={version}
                    maxLength={40}
                    required
                    dir="ltr"
                    onChange={(event) => setVersion(event.target.value)}
                    placeholder="0.2.4"
                  />
                </label>
                <Button type="submit" disabled={!version.trim()} className="mt-4 w-full sm:w-auto">
                  <Send />
                  {c.broadcast}
                </Button>
              </form>
              <p className="mt-4 text-xs leading-6 text-muted-foreground">
                {c.lastBroadcast}: {data.lastBroadcast ? date(data.lastBroadcast) : c.never}
              </p>
            </section>
            <section className={surface} aria-label={c.generator}>
              <SectionTitle icon={<KeyRound />} title={c.generator} hint={c.generatorHint} />
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const days = Number(duration === "custom" ? customDays : duration);
                  if (!Number.isInteger(days) || days < 1 || days > 36500) {
                    toast.error(c.invalid);
                    return;
                  }
                  let code = "";
                  if (
                    commit(() => {
                      const next = addDemoCode(
                        data,
                        days,
                        notes,
                        crypto.randomUUID(),
                        crypto.randomUUID(),
                      );
                      code = next.codes[0]?.code ?? "";
                      return next;
                    }, c.generated)
                  ) {
                    setGenerated(code);
                    setCopied(null);
                    setNotes("");
                  }
                }}
                className="space-y-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-xs text-muted-foreground">
                    <span className="block">{c.duration}</span>
                    <DarkSelect
                      value={duration}
                      onValueChange={setDuration}
                      className={`h-10 w-full ${field}`}
                      aria-label={c.duration}
                      options={[30, 60, 90, 365, 36500]
                        .map((days) => ({ value: String(days), label: durationText(days) }))
                        .concat([{ value: "custom", label: c.custom }])}
                    />
                  </label>
                  {duration === "custom" ? (
                    <label className="space-y-2 text-xs text-muted-foreground">
                      <span className="block">{c.custom}</span>
                      <Input
                        className={field}
                        value={customDays}
                        onChange={(event) => setCustomDays(event.target.value)}
                        type="number"
                        min={1}
                        max={36500}
                        step={1}
                        required
                        dir="ltr"
                      />
                    </label>
                  ) : null}
                  <label
                    className={`space-y-2 text-xs text-muted-foreground ${duration === "custom" ? "sm:col-span-2" : ""}`}
                  >
                    <span className="block">{c.notes}</span>
                    <Input
                      className={field}
                      value={notes}
                      maxLength={500}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder={c.notesPlaceholder}
                    />
                  </label>
                </div>
                <Button type="submit" className="w-full sm:w-auto">
                  <Plus />
                  {c.generate}
                </Button>
              </form>
              {generated ? (
                <div className="mt-5 rounded-xl border border-white/10 bg-[#0a0a0a] p-4">
                  <p className="mb-2 text-xs text-muted-foreground">{c.generated}</p>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <code
                      className="break-all font-mono text-sm tracking-wider"
                      dir="ltr"
                      data-testid="generated-code"
                    >
                      {generated}
                    </code>
                    <Button variant="outline" size="sm" onClick={() => void copy(generated)}>
                      {copied === generated ? <Check /> : <Copy />}
                      {c.copy}
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
          <section className={surface} aria-label={c.early}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <SectionTitle icon={<ShieldCheck />} title={c.early} hint={c.earlyHint} />
              <div className="relative w-full sm:w-64">
                <Search
                  className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  className={`${field} ps-9`}
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder={c.userSearch}
                  aria-label={c.userSearch}
                  type="search"
                />
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex min-w-0 flex-col gap-4 rounded-xl border border-white/[0.07] bg-[#101010] p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/5 text-muted-foreground">
                      <Users className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium" dir="auto">
                        {user.name}
                      </p>
                      <p
                        className="truncate text-xs text-muted-foreground"
                        dir="ltr"
                        title={user.email}
                      >
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md bg-white/5 px-2 py-1">
                      {user.earlyAccess ? "Early Access" : c.standard}
                    </span>
                    <span className="text-muted-foreground">
                      {c.plan}: {user.plan === "Pro" ? c.pro : c.free}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      if (user.earlyAccess) setConfirmation({ kind: "access", userId: user.id });
                      else commit(() => setDemoEarlyAccess(data, user.id, true), c.roleSaved);
                    }}
                  >
                    {user.earlyAccess ? <ShieldOff /> : <ShieldCheck />}
                    {user.earlyAccess ? c.withdraw : c.grant}
                  </Button>
                </div>
              ))}
            </div>
            {!users.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{c.noUsers}</p>
            ) : null}
          </section>
          <section className={`${surface} !px-0 !pb-0`} aria-label={c.codes}>
            <div className="px-5 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <SectionTitle icon={<KeyRound />} title={c.codes} hint={c.manageHint} />
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  <Download />
                  {c.export}
                </Button>
              </div>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div
                  className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-[#0a0a0a] p-1"
                  role="group"
                  aria-label={c.status}
                >
                  {filters.map((value) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={filter === value}
                      onClick={() => setFilter(value)}
                      className={`rounded-lg px-3 py-2 text-xs transition-colors ${filter === value ? "bg-white/10 font-medium text-white" : "text-muted-foreground hover:bg-white/5 hover:text-white"}`}
                    >
                      {c[value]}
                    </button>
                  ))}
                </div>
                <div className="relative w-full sm:w-72">
                  <Search
                    className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={c.codeSearch}
                    aria-label={c.codeSearch}
                    className={`${field} ps-9`}
                  />
                </div>
              </div>
            </div>
            <div className="md:overflow-x-auto">
              <table className="block w-full text-start text-xs md:table md:min-w-[800px]">
                <caption className="sr-only">
                  {c.codes} — {c.sandbox}
                </caption>
                <thead className="sr-only border-y border-white/[0.07] bg-white/[0.025] text-muted-foreground md:not-sr-only md:table-header-group">
                  <tr>
                    {[c.code, c.duration, c.status, c.created, c.user, c.actions].map((text) => (
                      <th key={text} scope="col" className="px-5 py-3 text-start font-medium">
                        {text}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="block divide-y divide-white/[0.06] md:table-row-group">
                  {rows.map((row) => {
                    const status = demoCodeStatus(row);
                    const user = data.users.find((item) => item.id === row.userId);
                    return (
                      <tr
                        key={row.id}
                        className="relative grid grid-cols-2 gap-x-3 gap-y-2 px-5 py-4 transition-colors hover:bg-white/[0.025] md:table-row md:p-0"
                      >
                        <td className="col-span-2 min-w-0 pe-12 md:max-w-64 md:px-5 md:py-3.5">
                          <code className="block break-all font-mono text-[0.78rem]" dir="ltr">
                            {row.code}
                          </code>
                          {row.notes ? (
                            <p
                              className="mt-1 max-w-56 truncate text-[0.7rem] text-muted-foreground"
                              title={row.notes}
                            >
                              {row.notes}
                            </p>
                          ) : null}
                        </td>
                        <td className="min-w-0 text-muted-foreground md:whitespace-nowrap md:px-5 md:py-3.5">
                          <span className="mb-1 block text-[0.65rem] md:hidden">{c.duration}</span>
                          {durationText(row.days)}
                        </td>
                        <td className="min-w-0 md:px-5 md:py-3.5">
                          <span className="mb-1 block text-[0.65rem] text-muted-foreground md:hidden">
                            {c.status}
                          </span>
                          <span
                            className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-[0.68rem] font-medium ${statusStyle[status]}`}
                          >
                            {c[status]}
                          </span>
                        </td>
                        <td className="min-w-0 text-muted-foreground md:whitespace-nowrap md:px-5 md:py-3.5">
                          <span className="mb-1 block text-[0.65rem] md:hidden">{c.created}</span>
                          {date(row.createdAt)}
                        </td>
                        <td className="min-w-0 md:px-5 md:py-3.5">
                          <span className="mb-1 block text-[0.65rem] text-muted-foreground md:hidden">
                            {c.user}
                          </span>
                          {user ? (
                            <>
                              <p dir="auto">{user.name}</p>
                              <p
                                className="mt-1 break-all text-[0.7rem] text-muted-foreground"
                                dir="ltr"
                              >
                                {user.email}
                              </p>
                            </>
                          ) : (
                            <span className="text-muted-foreground">{c.unused}</span>
                          )}
                          {row.redeemedAt ? (
                            <p className="mt-1 text-[0.65rem] text-muted-foreground">
                              {c.redeemedAt}: {date(row.redeemedAt)}
                            </p>
                          ) : null}
                        </td>
                        <td className="absolute end-5 top-4 md:static md:px-5 md:py-3.5">
                          <DropdownMenu dir={dir}>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="size-8"
                                aria-label={`${c.actions}: ${row.code}`}
                              >
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="min-w-48 border-white/10 bg-[#1a1a1a]"
                            >
                              <DropdownMenuItem
                                onSelect={() => {
                                  setEditing(row);
                                  setEditCode(row.code);
                                  setEditNotes(row.notes);
                                }}
                              >
                                <Pencil />
                                {c.edit}
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => void copy(row.code)}>
                                <Copy />
                                {c.copy}
                              </DropdownMenuItem>
                              {!row.userId && !row.revoked ? (
                                <DropdownMenuItem
                                  onSelect={() =>
                                    commit(() => updateDemoCode(data, row.id, "toggle"), c.updated)
                                  }
                                >
                                  {row.active ? <Ban /> : <RotateCcw />}
                                  {row.active ? c.deactivate : c.activate}
                                </DropdownMenuItem>
                              ) : null}
                              {row.userId && !row.revoked ? (
                                <DropdownMenuItem
                                  onSelect={() => setConfirmation({ kind: "revoke", code: row })}
                                >
                                  <ShieldOff />
                                  {c.revoke}
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuSeparator className="bg-white/10" />
                              <DropdownMenuItem
                                className="text-red-300 focus:bg-red-400/10 focus:text-red-300"
                                onSelect={() => setConfirmation({ kind: "delete", code: row })}
                              >
                                <Trash2 />
                                {c.delete}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!rows.length ? (
              <div className="px-5 py-12 text-center">
                <Search className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">{c.empty}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.emptyHint}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                >
                  {c.clear}
                </Button>
              </div>
            ) : null}
            <p className="border-t border-white/[0.07] px-5 py-3 text-xs text-muted-foreground sm:px-6">
              {rows.length} / {data.codes.length} {c.entries}
            </p>
          </section>
        </>
      ) : null}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent
          dir={dir}
          closeLabel={c.close}
          className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto border-white/10 bg-[#141414]"
        >
          <DialogHeader>
            <DialogTitle>{c.edit}</DialogTitle>
            <DialogDescription>{c.editHint}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                data &&
                editing &&
                commit(() => editDemoCode(data, editing.id, editCode, editNotes), c.updated)
              ) {
                if (editing.code === generated) {
                  setGenerated(editing.userId ? editing.code : editCode.trim());
                  setCopied(null);
                }
                setEditing(null);
              }
            }}
          >
            <label className="block space-y-2 text-xs text-muted-foreground">
              <span>{c.code}</span>
              <Input
                className={field}
                value={editCode}
                onChange={(event) => setEditCode(event.target.value)}
                disabled={Boolean(editing?.userId)}
                maxLength={80}
                required
                dir="ltr"
              />
            </label>
            <label className="block space-y-2 text-xs text-muted-foreground">
              <span>{c.notes}</span>
              <Textarea
                className={`${field} min-h-24`}
                value={editNotes}
                onChange={(event) => setEditNotes(event.target.value)}
                maxLength={500}
              />
            </label>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                {c.cancel}
              </Button>
              <Button type="submit" disabled={!editCode.trim()}>
                {c.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <AlertDialogContent dir={dir} className="w-[calc(100%-2rem)] border-white/10 bg-[#141414]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation?.kind === "reset"
                ? c.resetTitle
                : confirmation?.kind === "access"
                  ? c.roleTitle
                  : confirmation?.kind === "revoke"
                    ? c.revokeTitle
                    : c.deleteTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.kind === "reset"
                ? c.resetBody
                : confirmation?.kind === "access"
                  ? c.roleBody
                  : confirmation?.kind === "revoke"
                    ? c.revokeBody
                    : c.deleteBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmation && "code" in confirmation ? (
            <code
              dir="ltr"
              className="break-all rounded-xl border border-white/10 bg-[#0a0a0a] p-3 text-sm"
            >
              {confirmation.code.code}
            </code>
          ) : null}
          {confirmation?.kind === "access" ? (
            <p className="text-sm" dir="auto">
              {data?.users.find((user) => user.id === confirmation.userId)?.name}
            </p>
          ) : null}
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>{c.cancel}</AlertDialogCancel>
            <Button variant="destructive" onClick={confirm}>
              {c.confirm}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
