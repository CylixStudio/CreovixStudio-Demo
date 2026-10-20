import { useMemo, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";

import {
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Modal,
  SearchBox,
  fieldClass,
  formatNumber,
  ghostButton,
  primaryButton,
  selectClass,
  selectContentClass,
  type ShopItem,
} from "@/components/loyalty/shared";
import { SessionAwareError } from "@/components/widgets/SessionAwareError";
import { DarkSelect } from "@/components/ui/dark-select";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/lib/i18n";
import { supabase } from "@/lib/supabase/client";
import { SIGNED_OUT_ERROR, isMissingViewerSession } from "@/lib/supabase/sessionError";
import { isTestMode } from "@/lib/testMode";

const SHOP_BUCKET = "loyalty-shop";

type ShopDraft = {
  name: string;
  description: string;
  cost: string;
  stock: string;
  imageUrl: string;
  file: File | null;
  active: boolean;
};

const emptyShopDraft = (): ShopDraft => ({
  name: "",
  description: "",
  cost: "100",
  stock: "",
  imageUrl: "",
  file: null,
  active: true,
});

type StatusFilter = "all" | "active" | "stopped";
type StockFilter = "all" | "unlimited" | "limited" | "out";

function stockKind(item: ShopItem): Exclude<StockFilter, "all"> {
  if (item.stock == null) return "unlimited";
  return item.stock <= 0 ? "out" : "limited";
}

export function ShopTab({
  rows,
  loading,
  error,
  userId,
  guest,
  onChanged,
}: {
  rows: ShopItem[];
  loading: boolean;
  error: unknown;
  userId: string;
  guest: boolean;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<ShopDraft>(emptyShopDraft);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ShopItem | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [stock, setStock] = useState<StockFilter>("all");

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setDraft(emptyShopDraft());
    setNotice(null);
  };

  const failure = (err: { code?: string; message?: string }) => {
    if (isMissingViewerSession(err) || err.message === SIGNED_OUT_ERROR) {
      setNotice(SIGNED_OUT_ERROR);
      return;
    }
    setNotice(err.code === "23505" ? t("loyalty.duplicate") : t("loyalty.saveFailed"));
  };

  const save = useMutation({
    mutationFn: async () => {
      if (guest || isTestMode()) throw new Error(SIGNED_OUT_ERROR);
      const imageUrl = await resolveShopImage(draft, userId);
      const stockValue = draft.stock.trim() === "" ? null : Math.max(0, Math.round(Number(draft.stock) || 0));
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim().slice(0, 400),
        cost: Math.max(0, Math.round(Number(draft.cost) || 0)),
        stock: stockValue,
        image_url: imageUrl,
        is_active: draft.active,
        enabled: draft.active,
      };
      if (editingId) {
        const { error: writeError } = await supabase
          .from("loyalty_shop_items")
          .update(payload)
          .eq("id", editingId)
          .eq("user_id", userId);
        if (writeError) throw writeError;
        return;
      }
      const { error: writeError } = await supabase.from("loyalty_shop_items").insert({
        user_id: userId,
        ...payload,
      });
      if (writeError) throw writeError;
    },
    onSuccess: () => {
      closeForm();
      onChanged();
    },
    onError: failure,
  });

  const toggle = useMutation({
    mutationFn: async ({ item, active }: { item: ShopItem; active: boolean }) => {
      if (guest || isTestMode()) throw new Error(SIGNED_OUT_ERROR);
      const { error: writeError } = await supabase
        .from("loyalty_shop_items")
        .update({ is_active: active, enabled: active })
        .eq("id", item.id)
        .eq("user_id", userId);
      if (writeError) throw writeError;
    },
    onSuccess: onChanged,
    onError: (err: { message?: string }) => {
      toast.error(isMissingViewerSession(err) || err.message === SIGNED_OUT_ERROR ? t("loyalty.signedOut") : t("loyalty.saveFailed"));
    },
  });

  const remove = useMutation({
    mutationFn: async (item: ShopItem) => {
      if (guest || isTestMode()) throw new Error(SIGNED_OUT_ERROR);
      const { error: writeError } = await supabase.from("loyalty_shop_items").delete().eq("id", item.id).eq("user_id", userId);
      if (writeError) throw writeError;
    },
    onSuccess: () => {
      setPendingDelete(null);
      onChanged();
    },
    onError: (err: { message?: string }) => {
      setPendingDelete(null);
      toast.error(isMissingViewerSession(err) || err.message === SIGNED_OUT_ERROR ? t("loyalty.signedOut") : t("loyalty.saveFailed"));
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) return;
    save.mutate();
  };

  const startEdit = (item: ShopItem) => {
    setEditingId(item.id);
    setNotice(null);
    setDraft({
      name: item.name,
      description: item.description,
      cost: String(item.cost),
      stock: item.stock == null ? "" : String(item.stock),
      imageUrl: item.image_url ?? "",
      file: null,
      active: item.is_active,
    });
    setFormOpen(true);
  };

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((item) => {
      if (needle && !`${item.name} ${item.description}`.toLowerCase().includes(needle)) return false;
      if (status !== "all" && item.is_active !== (status === "active")) return false;
      if (stock !== "all" && stockKind(item) !== stock) return false;
      return true;
    });
  }, [query, rows, status, stock]);

  if (loading) return <p className="text-sm text-muted-foreground">{t("loyalty.loading")}</p>;
  if (error && !isMissingViewerSession(error)) {
    return <p className="text-sm text-amber-200/90">{t("loyalty.loadFailed")}</p>;
  }

  return (
    <section className="space-y-4">
      <div className="surface-card surface-card-pad">
        <div className="flex flex-wrap items-end gap-3">
          <SearchBox className="min-w-[12rem] flex-1" label={t("loyalty.shop.search")} value={query} onChange={setQuery} />
          <Field label={t("loyalty.shop.status")} className="w-full sm:w-44">
            <DarkSelect
              className={selectClass}
              contentClassName={selectContentClass}
              aria-label={t("loyalty.shop.status")}
              value={status}
              onValueChange={(next) => setStatus(next as StatusFilter)}
              options={[
                { value: "all", label: t("loyalty.shop.filter.status") },
                { value: "active", label: t("loyalty.shop.available") },
                { value: "stopped", label: t("loyalty.shop.stopped") },
              ]}
            />
          </Field>
          <Field label={t("loyalty.shop.stock")} className="w-full sm:w-44">
            <DarkSelect
              className={selectClass}
              contentClassName={selectContentClass}
              aria-label={t("loyalty.shop.stock")}
              value={stock}
              onValueChange={(next) => setStock(next as StockFilter)}
              options={[
                { value: "all", label: t("loyalty.shop.filter.stock") },
                { value: "unlimited", label: t("loyalty.shop.unlimited") },
                { value: "limited", label: t("loyalty.shop.stock.limited") },
                { value: "out", label: t("loyalty.shop.stock.out") },
              ]}
            />
          </Field>
          <button
            type="button"
            className={`${primaryButton} w-full sm:w-auto`}
            onClick={() => {
              setEditingId(null);
              setDraft(emptyShopDraft());
              setNotice(null);
              setFormOpen(true);
            }}
          >
            <Plus aria-hidden className="size-4" />
            {t("loyalty.shop.addProduct")}
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("loyalty.shop.count", { shown: visible.length, total: rows.length })}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState>{t("loyalty.shop.empty")}</EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState>{t("loyalty.shop.noMatch")}</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <ProductCard
              key={item.id}
              item={item}
              busy={toggle.isPending}
              onEdit={() => startEdit(item)}
              onDelete={() => setPendingDelete(item)}
              onToggle={(active) => toggle.mutate({ item, active })}
            />
          ))}
        </ul>
      )}

      {formOpen ? (
        <Modal title={editingId ? t("loyalty.shop.editProduct") : t("loyalty.shop.addProduct")} onClose={closeForm} wide>
          <form className="space-y-3" onSubmit={onSubmit}>
            <SessionAwareError error={notice} signedOutLabel={t("loyalty.signedOut")} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("loyalty.shop.name")}>
                <input className={fieldClass} required value={draft.name} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} />
              </Field>
              <Field label={t("loyalty.shop.cost")}>
                <input className={fieldClass} inputMode="numeric" value={draft.cost} onChange={(event) => setDraft((prev) => ({ ...prev, cost: event.target.value }))} />
              </Field>
              <Field label={t("loyalty.shop.description")} className="sm:col-span-2">
                <textarea
                  className={`${fieldClass} h-auto min-h-20 py-2`}
                  value={draft.description}
                  onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                />
              </Field>
              <Field label={t("loyalty.shop.stock")}>
                <input className={fieldClass} inputMode="numeric" value={draft.stock} onChange={(event) => setDraft((prev) => ({ ...prev, stock: event.target.value }))} />
                <span className="mt-1 block text-[0.7rem] text-muted-foreground">{t("loyalty.shop.stockHint")}</span>
              </Field>
              <Field label={t("loyalty.shop.status")}>
                <DarkSelect
                  className={selectClass}
                  contentClassName={selectContentClass}
                  aria-label={t("loyalty.shop.status")}
                  value={draft.active ? "active" : "stopped"}
                  onValueChange={(next) => setDraft((prev) => ({ ...prev, active: next === "active" }))}
                  options={[
                    { value: "active", label: t("loyalty.shop.available") },
                    { value: "stopped", label: t("loyalty.shop.stopped") },
                  ]}
                />
              </Field>
              <Field label={t("loyalty.shop.image")} className="sm:col-span-2">
                <input
                  className={`${fieldClass} py-1.5 file:me-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-xs file:text-foreground`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setDraft((prev) => ({ ...prev, file: event.target.files?.[0] ?? null }))}
                />
              </Field>
              <Field label={t("loyalty.shop.imageUrl")} className="sm:col-span-2">
                <input className={fieldClass} dir="ltr" value={draft.imageUrl} onChange={(event) => setDraft((prev) => ({ ...prev, imageUrl: event.target.value }))} />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className={ghostButton} onClick={closeForm}>
                {t("loyalty.cancel")}
              </button>
              <button type="submit" disabled={save.isPending} className={primaryButton}>
                {editingId ? t("loyalty.save") : t("loyalty.shop.add")}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title={t("loyalty.shop.confirmDelete", { name: pendingDelete.name })}
          pending={remove.isPending}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => remove.mutate(pendingDelete)}
        />
      ) : null}
    </section>
  );
}

function ProductCard({
  item,
  busy,
  onEdit,
  onDelete,
  onToggle,
}: {
  item: ShopItem;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (active: boolean) => void;
}) {
  const { t } = useLanguage();
  const kind = stockKind(item);
  const stockLabel =
    kind === "unlimited"
      ? t("loyalty.shop.unlimited")
      : kind === "out"
        ? t("loyalty.shop.stock.out")
        : t("loyalty.shop.left", { count: formatNumber(item.stock ?? 0) });

  return (
    <li className={`surface-card flex flex-col overflow-hidden ${item.is_active ? "" : "opacity-80"}`}>
      <div className="relative">
        <ShopImage key={item.image_url ?? "none"} url={item.image_url} alt={item.name} emptyLabel={t("loyalty.shop.noImage")} />
        <span
          className={`absolute start-3 top-3 rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold backdrop-blur ${
            item.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-black/60 text-muted-foreground"
          }`}
        >
          {item.is_active ? t("loyalty.shop.available") : t("loyalty.shop.stopped")}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 break-words text-sm font-semibold leading-snug" dir="auto">
            {item.name}
          </h3>
          <span className="surface-inset shrink-0 px-2.5 py-1 text-xs font-semibold tabular-nums text-primary">
            {t("loyalty.shop.price", { count: formatNumber(item.cost) })}
          </span>
        </div>
        <p className="line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-muted-foreground" dir="auto">
          {item.description || "—"}
        </p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className={kind === "out" ? "font-medium text-red-400" : "text-muted-foreground"}>
            {t("loyalty.shop.stock")}: {stockLabel}
          </span>
          <button
            type="button"
            title={t("loyalty.shop.copyCommand")}
            aria-label={t("loyalty.shop.copyCommand")}
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-white/[0.05] px-2 py-1 font-mono text-[0.7rem] text-primary transition-colors hover:bg-white/[0.09]"
            dir="ltr"
            onClick={() => {
              void navigator.clipboard.writeText(`!buy ${item.name}`);
              toast.success(t("loyalty.shop.copied"));
            }}
          >
            <Copy aria-hidden className="size-3 shrink-0" />
            <span className="truncate">!buy {item.name}</span>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/5 px-4 py-2.5">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch
            checked={item.is_active}
            disabled={busy}
            aria-label={item.is_active ? t("loyalty.shop.disable") : t("loyalty.shop.enable")}
            onCheckedChange={onToggle}
          />
          {item.is_active ? t("loyalty.shop.disable") : t("loyalty.shop.enable")}
        </label>
        <div className="flex gap-1">
          <IconButton label={t("loyalty.edit")} onClick={onEdit}>
            <Pencil aria-hidden className="size-4" />
          </IconButton>
          <IconButton label={t("loyalty.delete")} tone="danger" onClick={onDelete}>
            <Trash2 aria-hidden className="size-4" />
          </IconButton>
        </div>
      </div>
    </li>
  );
}

async function resolveShopImage(draft: ShopDraft, userId: string): Promise<string | null> {
  if (draft.file) {
    const ext = draft.file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(SHOP_BUCKET).upload(path, draft.file, {
      contentType: draft.file.type || "image/png",
      upsert: false,
    });
    if (error) throw error;
    return supabase.storage.from(SHOP_BUCKET).getPublicUrl(path).data.publicUrl;
  }
  const pasted = draft.imageUrl.trim();
  return pasted || null;
}

function ShopImage({ url, alt, emptyLabel }: { url: string | null; alt: string; emptyLabel: string }) {
  const [broken, setBroken] = useState(false);
  if (!url || broken) {
    return (
      <div className="flex aspect-[16/9] flex-col items-center justify-center gap-1.5 bg-white/[0.03] text-xs text-muted-foreground">
        <ImageIcon aria-hidden className="size-6 opacity-60" />
        {emptyLabel}
      </div>
    );
  }
  return <img src={url} alt={alt} className="aspect-[16/9] w-full object-cover" onError={() => setBroken(true)} />;
}
