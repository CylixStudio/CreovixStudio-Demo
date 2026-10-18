import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  ALERT_CATALOG, FREE_MEDIA_BYTES, PRO_MEDIA_BYTES, normalizeConfig,
  normalizeAlertMediaUrl, normalizePlatformAlerts, selectableAlert, inspectUpload,
} from "../src/lib/alertStudio.ts";
import { ALERTS_AR, ALERTS_EN } from "../src/lib/i18n.alerts.ts";

test("selectable catalog omits archived types and respects platforms", () => {
  const names = (platform) => ALERT_CATALOG.filter(x => selectableAlert(x, platform)).map(x => x.title);
  assert.deepEqual(names("KICK"), ["New Follow", "New Subscription", "Resubscription", "Gifted Subs", "Raid", "KICKs"]);
  assert.deepEqual(names("TWITCH"), ["New Follow", "New Subscription", "Resubscription", "Gifted Subs", "Raid", "Cheer / Bits"]);
  const stored = normalizePlatformAlerts({KICK:{"gift-bomb":{message:"legacy {count}"}}});
  assert.equal(stored.KICK["gift-bomb"].message, "legacy {count}");
});

test("URL validation and one-source selection survive normalization", () => {
  for (const url of ["http://example.com/a.png", "https://localhost/a.png", "https://127.0.0.1/a.png", "https://2130706433/a.png", "https://[::1]/a.png", "https://name:pass@example.com/a.png", "https://a.internal/a.png", "https://example.com/a.svg", "data:image/png;base64,eA=="]) {
    assert.equal(normalizeAlertMediaUrl(url, "visual"), "", url);
  }
  assert.equal(normalizeAlertMediaUrl("https://cdn.example.com/a.gif?version=2","visual"),"https://cdn.example.com/a.gif?version=2");
  assert.equal(normalizeAlertMediaUrl("https://cdn.example.com/a.mp4","visual"),"https://cdn.example.com/a.mp4");
  assert.equal(normalizeAlertMediaUrl("https://cdn.example.com/a.mp3","audio"),"https://cdn.example.com/a.mp3");
  assert.equal(normalizeAlertMediaUrl("https://cdn.example.com/a.mp3","visual"),"");
  const cfg = normalizeConfig({ visualSource:"none",visualUrl:"https://cdn.example.com/a.png",audioSource:"url",audioUrl:"https://cdn.example.com/a.wav"}, ALERT_CATALOG[0]);
  assert.equal(cfg.visualSource, "none");
  assert.equal(cfg.audioSource, "url");
  assert.deepEqual(normalizeConfig(JSON.parse(JSON.stringify(cfg)),ALERT_CATALOG[0]),cfg);
});

test("English and Arabic catalogs have matching keys with no Arabic English UI strings", () => {
  assert.deepEqual(Object.keys(ALERTS_AR),Object.keys(ALERTS_EN));
  for(const value of Object.values(ALERTS_EN)) assert.equal(/[\u0600-\u06ff]/.test(value),false,value);
});

test("isolated Demo persistence, gift quantities, variations, media caps and retry deduplication", async () => {
  const repo=process.cwd();
  const tmpRoot=path.join(repo,"tmp");
  fs.mkdirSync(tmpRoot,{recursive:true});
  const sandbox=fs.mkdtempSync(path.join(tmpRoot,"alerts-final-test-"));
  process.chdir(sandbox);
  try {
    const server=await import("../src/lib/alertStudio.server.ts");
    const definition=ALERT_CATALOG.find(x=>x.id==="gift");
    const base=normalizeConfig({message:"{username} gifted {count} subs",durationMs:1000},definition);
    const variationId=randomUUID();
    server.saveAlertStudio({alerts:{KICK:{gift:{...base,variations:[{id:variationId,name:"Large gift",condition:"min-count",threshold:10,config:{...base,message:"{count} gifted subs!"}}]}}},simulation:{count:25,username:"Tester"}});
    assert.equal(server.readAlertStudio().simulation.count,25);
    const run=(count,id=randomUUID())=>server.queueAlertTest({alertId:"gift",platform:"KICK",username:"Tester",count,months:1,requestId:id});
    assert.equal(run(1).event.text,"Tester gifted 1 subs");
    assert.equal(run(7).event.text,"Tester gifted 7 subs");
    const many=run(25);
    assert.equal(many.event.text,"25 gifted subs!");
    assert.equal(many.event.variationId,variationId);
    const id=randomUUID(),first=run(13,id),retry=run(13,id);
    assert.equal(first.event.id,retry.event.id);
    assert.equal(server.listAlertEvents().filter(x=>x.id===first.event.id).length,1);
    assert.equal(run(1.5).event,null);
    assert.equal(run(0).event,null);
    for(const alertId of ["gift-bomb","donation","host"]) assert.equal(server.queueAlertTest({alertId,platform:"KICK",username:"Tester",count:5,months:1}).event,null);
    const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0X8AAAAASUVORK5CYII=","base64");
    const file=await server.storeAlertMedia({platform:"KICK",alertId:"gift",slot:"visual",filename:"fixture.png",bytes:png});
    assert.equal(file.ok,true);
    const stored=server.readAlertStudio().alerts.KICK.gift;
    assert.equal(stored.visualSource,"upload");
    assert.ok(run(1).event.visualId);
    server.saveAlertStudio({alerts:{KICK:{gift:{...stored,visualSource:"url",visualUrl:"https://cdn.example.com/a.mp4",audioSource:"url",audioUrl:"https://cdn.example.com/a.mp3"}}}});
    const remote=run(2).event;
    assert.equal(remote.visualId,null);
    assert.equal(remote.config.audioSource,"url");
    assert.equal(remote.visualUrl,"https://cdn.example.com/a.mp4");
    assert.ok(server.readAlertStudio().media.find(x=>x.id===file.asset.id),"inactive upload retained");
    server.saveAlertStudio({alerts:{KICK:{gift:{...server.readAlertStudio().alerts.KICK.gift,visualSource:"none",audioSource:"none"}}}});
    assert.equal(run(2).event.visualId,null);
    assert.equal(run(2).event.visualUrl,undefined);
    server.saveAlertStudio({plan:"free"});
    const big=new Uint8Array(FREE_MEDIA_BYTES+1);big.set(png);
    const rejected=await server.storeAlertMedia({platform:"KICK",alertId:"gift",slot:"visual",filename:"large.png",bytes:big});
    assert.equal(rejected.ok,false);
    server.saveAlertStudio({plan:"pro"});
    assert.equal((await server.storeAlertMedia({platform:"KICK",alertId:"gift",slot:"visual",variationId,filename:"large.png",bytes:big})).ok,true);
    const overPro=new Uint8Array(PRO_MEDIA_BYTES+1);overPro.set(png);
    assert.equal(inspectUpload(overPro,"large.png","visual","pro").ok,false);
    assert.equal((await server.storeAlertMedia({platform:"KICK",alertId:"gift",slot:"visual",filename:"fake.png",bytes:new TextEncoder().encode("<script>bad</script>")})).ok,false);
  } finally {
    process.chdir(repo);
    const resolved=path.resolve(sandbox);
    assert.ok(resolved.startsWith(path.resolve(tmpRoot)+path.sep) && path.basename(resolved).startsWith("alerts-final-test-"));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
});
