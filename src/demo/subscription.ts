import type { DemoDb, Row } from "@/demo/db";

export function demoSubscriptionIsActive(row: Row | undefined, now = Date.now()): boolean {
  return row?.["subscription_status"] === "active" &&
    (row["is_lifetime"] === true ||
      (typeof row["expires_at"] === "string" && new Date(row["expires_at"]).getTime() > now));
}

export function demoUserHasActivePro(db: DemoDb, userId: string): boolean {
  return demoSubscriptionIsActive(db.rows("user_subscriptions").find((row) => row["user_id"] === userId));
}
