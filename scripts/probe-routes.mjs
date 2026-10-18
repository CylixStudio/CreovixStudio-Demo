// Route probe: node scripts/probe-routes.mjs [baseUrl]
// Requests every page and public GET API route and prints status codes.
const base = process.argv[2] || "http://localhost:3001";

const pages = [
  "/", "/login", "/docs", "/privacy", "/terms", "/mod-queue", "/overlay/demo-giveaway", "/overlay/giveaway",
  "/overlay/media-request", "/overlay/schedule", "/overlay/subathon-timer", "/overlay/tiktok-tap-goal",
  "/overlay/tiktok-tappers", "/overlay/demo-alerts/demo-alerts-token", "/overlay/demo-follower-counter",
  "/overlay/demo-chat", "/overlay/demo-subathon-timer", "/bio/demo", "/u/demodemo", "/store/demo",
  "/commands/demodemo", "/marks/demo-marks", "/marks/demo-marks/demo-mark-1",
  "/dashboard", "/activity-feed", "/alerts", "/alerts/demo-alert", "/analytics", "/custom-commands",
  "/giveaway", "/link-in-bio", "/live-counter", "/loyalty", "/mark-points", "/media-requests", "/schedule",
  "/settings", "/subscription", "/welcome", "/widgets", "/tools/wheel", "/widgets/demo-follower-counter",
  "/widgets/demo-chat/goal", "/widgets/demo-chat/rules", "/widgets/demo-chat/control",
  "/subathons/demo-subathon/control", "/subathons/demo-subathon/overlay", "/subathons/demo-subathon/rules",
];
const api = [
  "/api/demo/state", "/api/public/overlay/demo-chat/live", "/api/public/overlay/demo-chat/meta",
  "/api/public/giveaway/demo-giveaway/live", "/api/public/link-in-bio/demo/live",
  "/api/public/marks/demo-marks/live", "/api/public/marks/demo-marks/status",
  "/api/public/media-request/demo-media/live", "/api/public/mod-queue/demo-mod/queue",
  "/api/public/schedule/demo-schedule/live", "/api/public/schedule/demo-schedule/ics",
  "/api/public/targets/demo-targets", "/api/live-counter/lookup?q=demo",
  "/api/demo/alert-studio", "/api/demo/alert-studio/overlay/demo-alerts-token/live",
];

let bad = 0;
for (const p of [...pages, ...api]) {
  const started = Date.now();
  let status = "ERR";
  try {
    const res = await fetch(base + p, { redirect: "manual", signal: AbortSignal.timeout(60_000) });
    status = res.status;
    await res.arrayBuffer();
  } catch (e) {
    status = `ERR ${e?.message ?? e}`;
  }
  const ok = typeof status === "number" && status < 400;
  if (!ok) bad += 1;
  console.log(`${ok ? "OK " : "BAD"} ${status} ${p} ${Date.now() - started}ms`);
}
console.log(`bad=${bad}`);
