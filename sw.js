// 오프라인 실행용 서비스 워커 — 앱 파일만 캐시하고, 가계부 데이터는 다루지 않는다.
const VER = 'cellbook-v1';
const SHELL = ['./', './index.html', './app.css', './app.js', './sync.js', './err.js', './config.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];
const FB = 'https://www.gstatic.com/firebasejs/';

self.addEventListener('install', e => { e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const same = u.origin === self.location.origin, fb = r.url.startsWith(FB);
  if (!same && !fb) return; // 로그인·데이터·환율 요청은 손대지 않음
  if (same && (r.mode === 'navigate' || /\.(js|css|html|webmanifest)$/.test(u.pathname))) {
    // 앱 파일: 네트워크 우선(업데이트 반영), 실패하면 캐시
    e.respondWith(fetch(r).then(res => { const c = res.clone(); caches.open(VER).then(x => x.put(r, c)); return res; }).catch(() => caches.match(r).then(m => m || caches.match('./index.html'))));
    return;
  }
  // 아이콘·Firebase 라이브러리(버전 고정): 캐시 우선
  e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(VER).then(x => x.put(r, c)); } return res; })));
});
