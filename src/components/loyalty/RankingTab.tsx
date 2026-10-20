import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileUp, Pencil, Trash2 } from "lucide-react";

import {
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Modal,
  Pagination,
  SearchBox,
  fieldClass,
  formatNumber,
  formatWatch,
  ghostButton,
  labelClass,
  primaryButton,
  selectClass,
  selectContentClass,
  tableWrap,
  tdClass,
  thClass,
  type Member,
} from "@/components/loyalty/shared";
import { DarkSelect } from "@/components/ui/dark-select";
import {
  BOTRIX_SUMMARY_EVENT,
  clearBotRixSummary,
  importBotRixRows,
  readBotRixSummary,
  type BotRixImportSummary,
} from "@/lib/botrixImportSummary";
import { formatRawValue, parseBotRixFile } from "@/lib/botrixLeaderboard";
import { useLanguage } from "@/lib/i18n";
import { supabase } from "@/lib/supabase/client";
import { isMissingViewerSession } from "@/lib/supabase/sessionError";

export function RankingTab({
  rows,
  loading,
  error,
  onChanged,
}: {
  rows: Member[];
  loading: boolean;
  error: unknown;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Member | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Member | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ranked = useMemo(() => {
    const ordered = rows.map((row, index) => ({ ...row, rank: index + 1 }));
    const needle = query.trim().toLowerCase();
    return needle ? ordered.filter((row) => row.display_name.toLowerCase().includes(needle)) : ordered;
  }, [query, rows]);

  const pageCount = Math.max(1, Math.ceil(ranked.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = ranked.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error: writeError } = await supabase.from("loyalty_members").delete().eq("id", id);
      if (writeError) throw writeError;
    },
    onSuccess: () => {
      setPendingDelete(null);
      onChanged();
    },
  });

  const importFile = async (file: File) => {
    setImporting(true);
    try {
      const parsed = parseBotRixFile(await file.text(), file.name);
      if (!parsed.ok) {
        toast.error(t(parsed.error === "unreadable" ? "loyalty.import.unreadable" : "loyalty.import.noRows"));
        return;
      }
      const summary = await importBotRixRows(file.name, parsed.rows, parsed.invalid);
      if (!summary) {
        toast.error(t("loyalty.import.failed"));
        onChanged();
        return;
      }
      toast.success(
        t("loyalty.import.done", { imported: summary.imported, updated: summary.updated, skipped: summary.skipped }),
      );
      if (parsed.truncated) toast.message(t("loyalty.import.truncated", { count: parsed.rows.length }));
      setQuery("");
      setPage(0);
      onChanged();
    } catch {
      toast.error(t("loyalty.import.failed"));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">{t("loyalty.loading")}</p>;
  if (error && !isMissingViewerSession(error)) {
    return <p className="text-sm text-amber-200/90">{t("loyalty.loadFailed")}</p>;
  }

  return (
    <div className="space-y-4">
      <ImportSummaryCard />
      <section className="surface-card surface-card-pad">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <SearchBox
            className="min-w-[12rem] flex-1"
            label={t("loyalty.searchMembers")}
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(0);
            }}
          />
          <Field label={t("loyalty.rows")} className="w-28">
            <DarkSelect
              className={selectClass}
              contentClassName={selectContentClass}
              aria-label={t("loyalty.rows")}
              value={String(pageSize)}
              onValueChange={(next) => {
                setPageSize(Number(next));
                setPage(0);
              }}
              options={[10, 25, 50].map((size) => ({ value: String(size), label: String(size) }))}
            />
          </Field>
          <input
            ref={fileRef}
            type="file"
            hidden
            data-testid="botrix-file"
            accept=".json,.csv,.txt,application/json,text/csv,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
            }}
          />
          <button type="button" className={ghostButton} disabled={importing} title={t("loyalty.import.hint")} onClick={() => fileRef.current?.click()}>
            <FileUp aria-hidden className="size-4" />
            {importing ? t("loyalty.import.running") : t("loyalty.import.button")}
          </button>
        </div>

        {visible.length === 0 ? (
          <EmptyState>{query.trim() ? t("loyalty.noMatch") : t("loyalty.empty")}</EmptyState>
        ) : (
          <div className={tableWrap}>
            <table className="w-full min-w-[40rem] text-start text-sm">
              <thead className="border-b border-white/5 bg-white/[0.03]">
                <tr>
                  <th className={thClass}>{t("loyalty.col.rank")}</th>
                  <th className={thClass}>{t("loyalty.col.name")}</th>
                  <th className={thClass}>{t("loyalty.col.level")}</th>
                  <th className={thClass}>{t("loyalty.col.points")}</th>
                  <th className={thClass}>{t("loyalty.col.watch")}</th>
                  <th className={`${thClass} text-end`}>
                    <span className="sr-only">{t("loyalty.col.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="border-t border-white/5 transition-colors first:border-t-0 hover:bg-white/[0.03]">
                    <td className={`${tdClass} w-14 tabular-nums ${row.rank <= 3 ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                      {row.rank}
                    </td>
                    <td className={`${tdClass} font-medium`}>{row.display_name}</td>
                    <td className={`${tdClass} tabular-nums`}>{row.level}</td>
                    <td className={`${tdClass} tabular-nums`}>{formatNumber(row.points)}</td>
                    <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                      {formatWatch(row.watch_seconds, (hours, minutes) =>
                        t("loyalty.watchValue", { hours: formatNumber(hours), minutes }),
                      )}
                    </td>
                    <td className={tdClass}>
                      <div className="flex justify-end gap-1">
                        <IconButton label={t("loyalty.edit")} onClick={() => setEditing(row)}>
                          <Pencil aria-hidden className="size-4" />
                        </IconButton>
                        <IconButton label={t("loyalty.delete")} tone="danger" onClick={() => setPendingDelete(row)}>
                          <Trash2 aria-hidden className="size-4" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={safePage} pageCount={pageCount} onPage={setPage} />
      </section>

      {editing ? (
        <MemberDialog
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      ) : null}
      {pendingDelete ? (
        <ConfirmDialog
          title={t("loyalty.confirmDelete")}
          pending={remove.isPending}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => remove.mutate(pendingDelete.id)}
        />
      ) : null}
    </div>
  );
}

function ImportSummaryCard() {
  const { t, lang } = useLanguage();
  const [summary, setSummary] = useState<BotRixImportSummary | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    const sync = () => setSummary(readBotRixSummary());
    sync();
    window.addEventListener(BOTRIX_SUMMARY_EVENT, sync);
    return () => window.removeEventListener(BOTRIX_SUMMARY_EVENT, sync);
  }, []);

  if (!summary) return null;

  const stats: [string, number][] = [
    [t("loyalty.import.stat.rows"), summary.rows],
    [t("loyalty.import.stat.added"), summary.imported],
    [t("loyalty.import.stat.updated"), summary.updated],
    [t("loyalty.import.stat.skipped"), summary.skipped],
    [t("loyalty.import.stat.level"), summary.withLevel],
    [t("loyalty.import.stat.watch"), summary.withWatch],
  ];
  const when = new Date(summary.at).toLocaleString(lang === "ar" ? "ar" : "en-US");

  return (
    <section className="surface-card surface-card-pad" aria-label={t("loyalty.import.summaryTitle")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{t("loyalty.import.summaryTitle")}</h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground" dir="auto">
            {summary.source} · {when}
          </p>
        </div>
        <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={clearBotRixSummary}>
          {t("loyalty.import.dismiss")}
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label} className="surface-inset px-3 py-2">
            <dt className="text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{formatNumber(value)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        {summary.withWatch > 0 ? <p>{t("loyalty.import.watchNote")}</p> : null}
        {summary.levelRaised > 0 ? <p>{t("loyalty.import.levelNote", { count: summary.levelRaised })}</p> : null}
      </div>

      <div className="surface-inset mt-3 px-3 py-3">
        {summary.unmappedFields.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("loyalty.import.noUnmapped")}</p>
        ) : (
          <>
            <p className={labelClass}>{t("loyalty.import.unmappedTitle")}</p>
            <p className="mt-1.5 text-xs text-muted-foreground" dir="auto">
              {t("loyalty.import.unmappedBody", { fields: summary.unmappedFields.join(", ") })}
            </p>
            <button type="button" className="mt-2 text-xs font-medium text-primary" onClick={() => setShowRaw((value) => !value)}>
              {showRaw ? t("loyalty.import.hideRaw") : t("loyalty.import.showRaw")}
            </button>
            {showRaw ? (
              <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-white/5">
                <table className="w-full min-w-[24rem] text-start text-xs">
                  <thead className="bg-white/[0.03]">
                    <tr>
                      <th className={thClass}>{t("loyalty.col.name")}</th>
                      <th className={thClass}>{t("loyalty.import.col.field")}</th>
                      <th className={thClass}>{t("loyalty.import.col.value")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.unmapped.flatMap((entry) =>
                      Object.entries(entry.fields).map(([field, value]) => (
                        <tr key={`${entry.name}-${field}`} className="border-t border-white/5">
                          <td className="px-3 py-1.5">{entry.name}</td>
                          <td className="px-3 py-1.5 font-mono" dir="ltr">
                            {field}
                          </td>
                          <td className="px-3 py-1.5 tabular-nums" dir="ltr">
                            {formatRawValue(value)}
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function MemberDialog({
  member,
  onClose,
  onSaved,
}: {
  member: Member;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(member.display_name);
  const [level, setLevel] = useState(String(member.level));
  const [points, setPoints] = useState(String(member.points));
  const [watch, setWatch] = useState(String(member.watch_seconds));
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const { error: writeError } = await supabase
        .from("loyalty_members")
        .update({
          display_name: name.trim(),
          level: Math.max(1, Number(level) || 1),
          points: Math.max(0, Number(points) || 0),
          watch_seconds: Math.max(0, Number(watch) || 0),
        })
        .eq("id", member.id);
      if (writeError) throw writeError;
    },
    onSuccess: onSaved,
    onError: () => setError(t("loyalty.saveFailed")),
  });

  return (
    <Modal title={t("loyalty.edit")} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <Field label={t("loyalty.col.name")}>
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("loyalty.col.level")}>
            <input className={fieldClass} inputMode="numeric" value={level} onChange={(event) => setLevel(event.target.value)} />
          </Field>
          <Field label={t("loyalty.col.points")}>
            <input className={fieldClass} inputMode="numeric" value={points} onChange={(event) => setPoints(event.target.value)} />
          </Field>
        </div>
        <Field label={t("loyalty.watchSeconds")}>
          <input className={fieldClass} inputMode="numeric" value={watch} onChange={(event) => setWatch(event.target.value)} />
        </Field>
        {error ? <p className="text-xs text-amber-200/90">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={ghostButton} onClick={onClose}>
            {t("loyalty.cancel")}
          </button>
          <button type="submit" disabled={save.isPending} className={primaryButton}>
            {t("loyalty.save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
