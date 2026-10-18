const base = 'http://127.0.0.1:3001/api/demo/alert-studio';
const data = await (await fetch(base)).json();
const config = data.alerts.KICK.follow;
const testIds = config.variations.filter(v => v.name === 'ترحيب خاص').map(v => v.id);
for (const asset of data.media.filter(a => testIds.includes(a.variationId))) await fetch(base + '/media/' + asset.id, {method:'DELETE'});
Object.assign(config, {style:'classic', layout:'stack', volume:65, message:'{username} تابع القناة', variations: config.variations.filter(v => !testIds.includes(v.id)), customCode:{enabled:false, html:'<div class="alert">{username}</div>', javascript:'// تنفيذ الكود في المعاينة غير مفعل في Demo.\n', css:'.alert { color: #bee1fc; }', fields:'{\n  "title": "مرحبًا بالمشاهد"\n}'}});
await fetch(base, {method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({alerts:{KICK:{follow:config}}})});
console.log('Removed temporary test variations and restored original follow settings');
