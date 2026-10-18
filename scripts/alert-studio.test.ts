import assert from "node:assert/strict";
import test from "node:test";

import {
  ALERT_CATALOG,
  FREE_MEDIA_BYTES,
  PRO_MEDIA_BYTES,
  detectMedia,
  inspectUpload,
  normalizePlatformAlerts,
  renderAlertText,
  supportFor,
  normalizeConfig,
  normalizeSimulation,
  selectAlertVariation,
} from "../src/lib/alertStudio.ts";

const png = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

test("alert text stays plain and fills variables", () => {
  const text = renderAlertText("مرحبًا {username} · {count} · {months}", {
    username: "<b>Creovix</b>",
    count: 12,
    months: 4,
  });
  assert.equal(text.includes("<"), false);
  assert.equal(text, "مرحبًا bCreovix/b · 12 · 4");
});

test("free rejects a file over 5 MB and pro accepts it under 60 MB", () => {
  const overFree = new Uint8Array(FREE_MEDIA_BYTES + 1);
  overFree.set(png);
  const free = inspectUpload(overFree, "alert.png", "visual", "free");
  assert.equal(free.ok, false);
  const pro = inspectUpload(overFree, "alert.png", "visual", "pro");
  assert.equal(pro.ok, true);
  const overPro = new Uint8Array(PRO_MEDIA_BYTES + 1);
  overPro.set(png);
  const rejected = inspectUpload(overPro, "alert.png", "visual", "pro");
  assert.equal(rejected.ok, false);
});

test("a renamed html file is rejected", () => {
  const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
  const result = inspectUpload(html, "alert.png", "visual", "pro");
  assert.equal(result.ok, false);
});

test("kick and twitch keep separate alert text", () => {
  const alerts = normalizePlatformAlerts({
    KICK: { follow: { message: "كيك {username}" } },
    TWITCH: { follow: { message: "تويتش {username}" } },
  });
  assert.equal(alerts.KICK.follow.message, "كيك {username}");
  assert.equal(alerts.TWITCH.follow.message, "تويتش {username}");
  assert.equal(alerts.KICK.cheer.enabled, false);
  assert.equal(alerts.TWITCH.cheer.enabled, true);
});

test("cheer is unavailable on Kick and gift bombs are derived", () => {
  const cheer = ALERT_CATALOG.find((item) => item.id === "cheer");
  const bomb = ALERT_CATALOG.find((item) => item.id === "gift-bomb");
  assert.ok(cheer && bomb);
  assert.equal(supportFor(cheer, "KICK").level, "unavailable");
  assert.equal(supportFor(cheer, "TWITCH").level, "webhook");
  assert.equal(supportFor(bomb, "KICK").level, "derived");
  assert.equal(detectMedia(png)?.ext, "png");
});

test("variation conditions prefer matching thresholds and ignore disabled variations", () => {
  const definition = ALERT_CATALOG[0]!;
  const base = normalizeConfig({}, definition);
  const config = normalizeConfig(
    {
      ...base,
      variations: [
        {
          id: "00000000-0000-4000-a000-000000000001",
          name: "Random",
          condition: "random",
          config: { ...base, message: "random" },
        },
        {
          id: "00000000-0000-4000-a000-000000000002",
          name: "Count",
          condition: "min-count",
          threshold: 10,
          config: { ...base, message: "count" },
        },
        {
          id: "00000000-0000-4000-a000-000000000003",
          name: "Disabled",
          condition: "min-count",
          threshold: 20,
          config: { ...base, enabled: false },
        },
      ],
    },
    definition,
  );
  assert.equal(
    selectAlertVariation(config, normalizeSimulation({ count: 25 }))?.config.message,
    "count",
  );
  assert.equal(
    selectAlertVariation(config, normalizeSimulation({ count: 2 }), () => 0)?.config.message,
    "random",
  );
  assert.equal(config.message, definition.defaultMessage);
});

test("custom code round trips as inert strings and nested variations are removed", () => {
  const definition = ALERT_CATALOG[0]!;
  const script = "<script>globalThis.unsafe = true</script>";
  const config = normalizeConfig(
    {
      durationMs: 2000,
      textStartMs: 9000,
      textEndMs: -10,
      customCode: {
        enabled: true,
        html: script,
        javascript: "alert(1)",
        css: ".alert {}",
        fields: '{"x":1}',
      },
      variations: [
        {
          id: "00000000-0000-4000-a000-000000000001",
          config: {
            message: "independent",
            variations: [{ id: "00000000-0000-4000-a000-000000000002" }],
          },
        },
      ],
    },
    definition,
  );
  assert.equal(config.customCode.html, script);
  assert.equal(config.customCode.javascript, "alert(1)");
  assert.equal(config.customCode.css, ".alert {}");
  assert.equal(config.customCode.fields, '{"x":1}');
  assert.equal(config.variations[0]?.config.message, "independent");
  assert.deepEqual(config.variations[0]?.config.variations, []);
  assert.equal(config.textStartMs, 1950);
  assert.equal(config.textEndMs, 2000);
});

test("all documented variables render plain text", () => {
  assert.equal(
    renderAlertText("{name} {amount} {message}", {
      username: "Fan",
      count: 5,
      months: 3,
      amount: 42,
      message: "<img> Nice!",
    }),
    "Fan 42 img Nice!",
  );
});
