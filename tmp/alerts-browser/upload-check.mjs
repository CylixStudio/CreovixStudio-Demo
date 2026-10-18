import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = 'http://127.0.0.1:3001/api/demo/alert-studio';
const initial = await (await fetch(base)).json();
const scope = randomUUID();
const ids = [];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1sAAAAASUVORK5CYII=', 'base64');
const plan = async (value) => { assert.ok((await fetch(base, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan: value }) })).ok); };
async function upload(bytes, name, slot = 'visual') {
  const form = new FormData(); form.set('file', new Blob([bytes]), name); form.set('platform', 'KICK'); form.set('alertId', 'follow'); form.set('slot', slot); form.set('variationId', scope);
  const response = await fetch(`${base}/media`, { method: 'POST', body: form }); const data = await response.json(); if (data.asset) ids.push(data.asset.id);
  return { status: response.status, data };
}
try {
  await plan('free');
  const overFree = Buffer.alloc(5 * 1024 * 1024 + 1); png.copy(overFree);
  assert.equal((await upload(overFree, 'too-large.png')).status, 413);
  assert.equal((await upload(Buffer.from('<script>alert(1)</script>'), 'fake.png')).status, 400);
  assert.equal((await upload(png, 'wrong.gif')).status, 400);
  const first = await upload(png, 'first.png'); assert.equal(first.status, 200);
  const second = await upload(png, 'replacement.png'); assert.equal(second.status, 200);
  assert.equal((await fetch(`${base}/media/${first.data.asset.id}`)).status, 404);
  console.log('PASS server rejects Free overflow, spoofed content and mismatched extensions; replacement removes old file');
  await plan('pro');
  assert.equal((await upload(overFree, 'pro-large.png')).status, 200);
  const overPro = Buffer.alloc(60 * 1024 * 1024 + 1); png.copy(overPro);
  assert.equal((await upload(overPro, 'over-pro.png')).status, 413);
  const wav = Buffer.alloc(44 + 8000); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22); wav.writeUInt32LE(8000,24); wav.writeUInt32LE(16000,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34); wav.write('data',36); wav.writeUInt32LE(8000,40);
  const sound = await upload(wav, 'test.wav', 'audio'); assert.equal(sound.status, 200);
  const served = await fetch(`${base}/media/${sound.data.asset.id}`); assert.equal(served.headers.get('content-type'), 'audio/wav'); assert.equal((await served.arrayBuffer()).byteLength, wav.length);
  console.log('PASS Pro accepts files above 5 MB, rejects above 60 MB; WAV audio persists and is served');
} finally {
  for (const id of ids) await fetch(`${base}/media/${id}`, { method: 'DELETE' });
  await plan(initial.plan);
}
