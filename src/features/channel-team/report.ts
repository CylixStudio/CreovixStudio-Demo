import type { GuardReport } from "./guard";
import { DENIED_EVENT } from "./guard";

/** Applies what the demo server's permission guard reported for one request. */
export async function applyGuardReport(encoded: string): Promise<void> {
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const report = JSON.parse(atob(padded)) as GuardReport;
    if (report.audit.length > 0) {
      const { recordOperation } = await import("./adapter");
      for (const entry of [...report.audit].reverse()) recordOperation(entry as Parameters<typeof recordOperation>[0]);
    }
    for (const item of report.denied.slice(0, 1)) {
      window.dispatchEvent(new CustomEvent(DENIED_EVENT, { detail: { key: item.key } }));
    }
  } catch {
    /* malformed report: ignore */
  }
}
