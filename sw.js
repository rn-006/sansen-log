// 参戦ログ オフライン対応（Service Worker）
const VER = 'sansen-log-2026.09.24';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
const EXT = 'sansen-log-ext';     // 地図ライブラリ・フォント
const TILE = 'sansen-log-tiles';  // 地図の画像（一定数まで）

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('sansen-log-2') && k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(name, max) {
  const c = await caches.open(name), ks = await c.keys();
  for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]);
}
// アプリ本体：ネットにつながっていれば最新版、つながっていなければ保存しておいた版
async function appShell(req) {
  const c = await caches.open(VER);
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(req, { signal: ctl.signal, cache: 'no-cache' }); clearTimeout(t);
    if (res.ok) c.put(req, res.clone());
    return res;
  } catch (e) {
    return (await c.match(req, { ignoreSearch: true })) || (await c.match('./index.html')) || Response.error();
  }
}
// 外部のファイル：保存しておいた版をすぐ使い、裏で更新
async function staleWhileRevalidate(req, name, max) {
  const c = await caches.open(name), hit = await c.match(req);
  const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) { c.put(req, res.clone()); if (max) trim(name, max); } return res; }).catch(() => hit);
  return hit || net;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === location.origin) { e.respondWith(appShell(req)); return; }
  if (/basemaps\.cartocdn\.com/.test(u.host)) { e.respondWith(staleWhileRevalidate(req, TILE, 600)); return; }
  if (/cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(u.host)) { e.respondWith(staleWhileRevalidate(req, EXT)); return; }
});
