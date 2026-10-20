import { useEffect, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";

import { useLanguage } from "@/lib/i18n";

export type Member = {
  id: string;
  display_name: string;
  level: number;
  points: number;
  watch_seconds: number;
};

export type ShopItem = {
  id: string;
  name: string;
  description: string;
  cost: number;
  enabled: boolean;
  is_active: boolean;
  image_url: string | null;
  stock: number | null;
};

export type Sale = {
  id: string;
  member_id: string | null;
  item_name: string;
  points: number;
  created_at: string;
};

export const fieldClass =
  "h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60";

export const selectClass = "h-10 w-full border-white/10 bg-white/[0.04] hover:border-white/20";
export const selectContentClass = "border-white/10 bg-[#141414]";

export const labelClass = "text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground";

export const primaryButton =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

export const ghostButton =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-foreground transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50";

export const formatNumber = (value: number) => value.toLocaleString("en-US");

export function formatWatch(seconds: number, hoursMinutes: (hours: number, minutes: number) => string): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return hoursMinutes(Math.floor(safe / 3600), Math.floor((safe % 3600) / 60));
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className={labelClass}>{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export function SearchBox({
  value,
  onChange,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <label className={`relative block ${className ?? ""}`}>
      <span className="sr-only">{label}</span>
      <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        className={`${fieldClass} ps-9`}
        type="text"
        placeholder={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function IconButton({
  label,
  onClick,
  tone = "default",
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.08] disabled:opacity-50 ${
        tone === "danger" ? "hover:text-red-400" : "hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function Pagination({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (next: number) => void;
}) {
  const { t, dir } = useLanguage();
  const Prev = dir === "rtl" ? ChevronRight : ChevronLeft;
  const Next = dir === "rtl" ? ChevronLeft : ChevronRight;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span className="whitespace-nowrap">{t("loyalty.page", { page: page + 1, pages: pageCount })}</span>
      <div className="flex gap-2">
        <button type="button" disabled={page === 0} className={`${ghostButton} h-9 px-3`} onClick={() => onPage(Math.max(0, page - 1))}>
          <Prev aria-hidden className="size-4" />
          {t("loyalty.prev")}
        </button>
        <button
          type="button"
          disabled={page >= pageCount - 1}
          className={`${ghostButton} h-9 px-3`}
          onClick={() => onPage(page + 1)}
        >
          {t("loyalty.next")}
          <Next aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useLanguage();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`surface-card surface-card-pad my-auto w-full shadow-2xl shadow-black/60 ${wide ? "max-w-xl" : "max-w-md"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <button type="button" aria-label={t("loyalty.cancel")} title={t("loyalty.cancel")} onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-white/[0.08] hover:text-foreground">
            <X aria-hidden className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLanguage();
  return (
    <Modal title={t("loyalty.delete")} onClose={onCancel}>
      <p className="text-sm text-muted-foreground">{title}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className={ghostButton} onClick={onCancel}>
          {t("loyalty.cancel")}
        </button>
        <button
          type="button"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          onClick={onConfirm}
        >
          {t("loyalty.delete")}
        </button>
      </div>
    </Modal>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="surface-inset px-4 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

export const tableWrap = "surface-inset overflow-x-auto";
export const thClass = "whitespace-nowrap px-3 py-2.5 text-start text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground";
export const tdClass = "px-3 py-2.5";
