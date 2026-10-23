import { useRef } from "react";
import { Download, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/lib/i18n";
import { assertDemoImportLayoutAccess } from "@/lib/demoLayoutImport";

const PREFIX = "cylixstudio-demo:";
const quietBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/5 px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground disabled:opacity-50";

const copy = {
  ar: {
    title: "بيانات الديمو",
    hint: "تُحفظ تعديلاتك في متصفحك فقط. يمكنك تصديرها إلى ملف JSON أو استيرادها في متصفح آخر، أو العودة للإعدادات الأصلية.",
    exportBtn: "تصدير بيانات الديمو",
    importBtn: "استيراد بيانات الديمو",
    resetBtn: "إعادة ضبط الديمو",
    confirmReset: "سيتم حذف كل تعديلاتك والعودة للبيانات الأصلية. هل تريد المتابعة؟",
    exported: "تم تصدير بيانات الديمو",
    imported: "تم استيراد بيانات الديمو",
    invalid: "ملف غير صالح",
    resetDone: "تمت إعادة ضبط الديمو",
  },
  en: {
    title: "Demo data",
    hint: "Your edits are saved in this browser only. Export them to a JSON file, import them in another browser, or reset to the original data.",
    exportBtn: "Export demo data",
    importBtn: "Import demo data",
    resetBtn: "Reset demo data",
    confirmReset: "This removes all your edits and restores the original demo data. Continue?",
    exported: "Demo data exported",
    imported: "Demo data imported",
    invalid: "Invalid file",
    resetDone: "Demo data reset",
  },
} as const;

function demoKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  return keys;
}

export function DemoDataPanel() {
  const { lang } = useLanguage();
  const c = lang === "ar" ? copy.ar : copy.en;
  const fileRef = useRef<HTMLInputElement>(null);

  const exportData = () => {
    const entries: Record<string, string> = {};
    for (const key of demoKeys()) entries[key] = window.localStorage.getItem(key) ?? "";
    const blob = new Blob([JSON.stringify({ app: "cylixstudio-demo", v: 1, entries }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cylixstudio-demo-data.json";
    link.click();
    URL.revokeObjectURL(url);
    toast.success(c.exported);
  };

  const importData = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { app?: string; entries?: Record<string, unknown> };
      if (parsed.app !== "cylixstudio-demo" || !parsed.entries || typeof parsed.entries !== "object") {
        throw new Error("invalid");
      }
      assertDemoImportLayoutAccess(parsed.entries);
      for (const key of demoKeys()) window.localStorage.removeItem(key);
      for (const [key, value] of Object.entries(parsed.entries)) {
        if (key.startsWith(PREFIX) && typeof value === "string") window.localStorage.setItem(key, value);
      }
      toast.success(c.imported);
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      toast.error(error instanceof Error && /requires Pro/i.test(error.message) ? error.message : c.invalid);
    }
  };

  const reset = () => {
    if (!window.confirm(c.confirmReset)) return;
    for (const key of demoKeys()) window.localStorage.removeItem(key);
    toast.success(c.resetDone);
    window.setTimeout(() => window.location.reload(), 400);
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{c.title}</h3>
      <p className="mt-1 max-w-xl text-[0.8rem] text-muted-foreground">{c.hint}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={quietBtn} onClick={exportData}>
          <Download className="h-4 w-4" /> {c.exportBtn}
        </button>
        <button type="button" className={quietBtn} onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> {c.importBtn}
        </button>
        <button type="button" className={quietBtn} onClick={reset} data-testid="demo-reset">
          <RotateCcw className="h-4 w-4" /> {c.resetBtn}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void importData(file);
          }}
        />
      </div>
    </div>
  );
}
