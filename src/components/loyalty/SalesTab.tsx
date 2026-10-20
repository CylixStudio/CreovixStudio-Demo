import { useMemo, useState } from "react";

import {
  EmptyState,
  Field,
  Pagination,
  SearchBox,
  formatNumber,
  selectClass,
  selectContentClass,
  tableWrap,
  tdClass,
  thClass,
  type Member,
  type Sale,
} from "@/components/loyalty/shared";
import { DarkSelect } from "@/components/ui/dark-select";
import { useLanguage } from "@/lib/i18n";
import { isMissingViewerSession } from "@/lib/supabase/sessionError";

const ALL = "__all__";

function formatSaleTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute} UTC`;
}

export function SalesTab({
  rows,
  members,
  loading,
  error,
}: {
  rows: Sale[];
  members: Member[];
  loading: boolean;
  error: unknown;
}) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [product, setProduct] = useState(ALL);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const names = useMemo(() => new Map(members.map((member) => [member.id, member.display_name])), [members]);

  const products = useMemo(() => [...new Set(rows.map((row) => row.item_name))].sort((a, b) => a.localeCompare(b)), [rows]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (product !== ALL && row.item_name !== product) return false;
      if (!needle) return true;
      const buyer = row.member_id ? (names.get(row.member_id) ?? "") : "";
      return `${buyer} ${row.item_name}`.toLowerCase().includes(needle);
    });
  }, [names, product, query, rows]);

  const totals = useMemo(() => {
    const byProduct = new Map<string, number>();
    const buyers = new Set<string>();
    let points = 0;
    for (const row of filtered) {
      points += row.points;
      byProduct.set(row.item_name, (byProduct.get(row.item_name) ?? 0) + 1);
      if (row.member_id) buyers.add(row.member_id);
    }
    const top = [...byProduct.entries()].sort((a, b) => b[1] - a[1])[0];
    return { points, buyers: buyers.size, top: top ? top[0] : "—" };
  }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  if (loading) return <p className="text-sm text-muted-foreground">{t("loyalty.loading")}</p>;
  if (error && !isMissingViewerSession(error)) {
    return <p className="text-sm text-amber-200/90">{t("loyalty.loadFailed")}</p>;
  }
  if (rows.length === 0) return <EmptyState>{t("loyalty.sales.empty")}</EmptyState>;

  const stats: { label: string; value: string }[] = [
    { label: t("loyalty.sales.stat.count"), value: formatNumber(filtered.length) },
    { label: t("loyalty.sales.stat.points"), value: formatNumber(totals.points) },
    { label: t("loyalty.sales.stat.buyers"), value: formatNumber(totals.buyers) },
    { label: t("loyalty.sales.stat.top"), value: totals.top },
  ];

  return (
    <section className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="surface-card min-w-0 p-4">
            <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{stat.label}</dt>
            <dd className="mt-1 truncate text-xl font-semibold tabular-nums" dir="auto" title={stat.value}>
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="surface-card surface-card-pad">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <SearchBox
            className="min-w-[12rem] flex-1"
            label={t("loyalty.sales.search")}
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(0);
            }}
          />
          <Field label={t("loyalty.sales.product")} className="w-full sm:w-52">
            <DarkSelect
              className={selectClass}
              contentClassName={selectContentClass}
              aria-label={t("loyalty.sales.product")}
              value={product}
              onValueChange={(next) => {
                setProduct(next);
                setPage(0);
              }}
              options={[{ value: ALL, label: t("loyalty.sales.allProducts") }, ...products.map((name) => ({ value: name, label: name }))]}
            />
          </Field>
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
        </div>

        {visible.length === 0 ? (
          <EmptyState>{t("loyalty.sales.noMatch")}</EmptyState>
        ) : (
          <div className={tableWrap}>
            <table className="w-full min-w-[36rem] text-start text-sm">
              <thead className="border-b border-white/5 bg-white/[0.03]">
                <tr>
                  <th className={thClass}>{t("loyalty.sales.username")}</th>
                  <th className={thClass}>{t("loyalty.sales.product")}</th>
                  <th className={`${thClass} text-end`}>{t("loyalty.sales.spent")}</th>
                  <th className={thClass}>{t("loyalty.sales.time")}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="border-t border-white/5 transition-colors first:border-t-0 hover:bg-white/[0.03]">
                    <td className={`${tdClass} font-medium`}>{row.member_id ? (names.get(row.member_id) ?? "—") : "—"}</td>
                    <td className={tdClass}>{row.item_name}</td>
                    <td className={`${tdClass} text-end tabular-nums`}>{formatNumber(row.points)}</td>
                    <td className={`${tdClass} whitespace-nowrap text-muted-foreground`} dir="ltr">
                      {formatSaleTime(row.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-white/10 bg-white/[0.03]">
                <tr>
                  <td className={`${tdClass} text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground`} colSpan={2}>
                    {t("loyalty.sales.stat.points")}
                  </td>
                  <td className={`${tdClass} text-end font-semibold tabular-nums`}>{formatNumber(totals.points)}</td>
                  <td className={tdClass} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <Pagination page={safePage} pageCount={pageCount} onPage={setPage} />
      </div>
    </section>
  );
}
