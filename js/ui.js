'use strict';
// 화면 공통: 테마, 화면 높이, 화면 상태, 아이콘, 아래 창, 알림, 틀(머리·탭)
const APP_VER = '2026.11.11-1';
const THK = KEY + '.theme';
const themePref = () => { try { return localStorage.getItem(THK) || 'auto'; } catch (e) { return 'auto'; } };
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const p = themePref(), t = p === 'auto' ? (darkMQ.matches ? 'dark' : 'light') : p;
  document.documentElement.dataset.theme = t;
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t === 'dark' ? '#111513' : '#F4F6F5';
}
applyTheme();
darkMQ.addEventListener?.('change', applyTheme);

/* ---------- 화면 높이 (아이폰 홈 화면 앱 보정 · 키보드) ---------- */
const isIPad = () => /iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const isIOSApp = () => (navigator.standalone || matchMedia('(display-mode: standalone)').matches) && (/iPhone|iPod/.test(navigator.userAgent) || isIPad());
const HFK = KEY + '.hfix';
const hfixOn = () => { try { return (localStorage.getItem(HFK) ?? localStorage.getItem('cellbook.hfix')) !== 'off'; } catch (e) { return true; } };
const kbOpen = () => document.documentElement.classList.contains('kb');
function fitHeight() {
  const de = document.documentElement, b = document.body, app = document.getElementById('app');
  if (!b || !app || kbOpen()) return;
  if (!isIOSApp() || !hfixOn()) { de.style.height = b.style.height = app.style.height = ''; app.style.bottom = ''; app.style.top = ''; return; }
  const portrait = matchMedia('(orientation: portrait)').matches;
  const sh = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  const sw = portrait ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
  const h = isIPad() && window.innerWidth < sw - 2 ? window.innerHeight : Math.max(window.innerHeight, sh);
  de.style.height = b.style.height = app.style.height = h + 'px'; app.style.bottom = 'auto'; app.style.top = '';
}
// 키보드가 올라오면 앱을 보이는 부분에 맞춰 줄여서, 아래 입력창이 키보드 바로 위에 붙게
function kbFit() {
  const vv = window.visualViewport, app = $('#app'); if (!vv || !app) return;
  const open = innerHeight - vv.height > 120 && !!document.activeElement?.matches?.('input,textarea');
  const de = document.documentElement, was = kbOpen();
  de.classList.toggle('kb', open);
  if (open) { app.style.height = vv.height + 'px'; app.style.top = vv.offsetTop + 'px'; app.style.bottom = 'auto'; }
  else if (was) { app.style.top = ''; app.style.height = ''; app.style.bottom = ''; fitHeight(); }
}
window.visualViewport?.addEventListener('resize', kbFit);
window.visualViewport?.addEventListener('scroll', kbFit);

/* ---------- 버튼 동작(ACT) · 입력 동작(INP) 모음 ---------- */
const ACT = {}, INP = {};

/* ---------- 화면 상태 ---------- */
const U = { tab: 'home', month: ym(TODAY()), acct: null, detail: null, q: '', flt: { t: 'all', cats: [], tag: '' }, setTab: '', sp: 'month', sr: null, open: {} };
try { const o = JSON.parse(localStorage.getItem(UIKEY) || '{}'); if (['home', 'list', 'stats', 'assets'].includes(o.tab)) U.tab = o.tab; if (o.sp) U.sp = o.sp; if (o.sr) U.sr = o.sr; if (o.recapSeen) U.recapSeen = o.recapSeen; } catch (e) { }
function saveUI() { try { const { tab, sp, sr, recapSeen } = U; localStorage.setItem(UIKEY, JSON.stringify({ tab: tab === 'set' ? 'home' : tab, sp, sr, recapSeen })); } catch (e) { } }
// 큰 금액 줄여 쓰기: 58.4만 · 1,240만
const man = n => { const a = Math.abs(n); if (a < 10000) return fmt(n); const v = n / 10000; return (a >= 1e6 ? Math.round(v).toLocaleString('ko-KR') : (Math.round(v * 10) / 10).toLocaleString('ko-KR')) + '만'; };
const fmtU = fmt;
const won = n => `${fmt(n)}<small>원</small>`;

/* ---------- 그리기 도우미 ---------- */
const at = (a, d = {}) => ` data-a="${a}"` + Object.entries(d).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
function shortName(n) {
  const s = String(n || '').trim(), sp = s.indexOf(' ');
  if (sp > 0) return s.slice(0, sp);
  const max = /^[\x00-\x7F]+$/.test(s) ? 6 : 3;
  return [...s].slice(0, max).join('');
}
const colorStyle = (a, tint) => { const c = colorOf(a); return tint ? `background:${c}1F;color:${c}` : `background:${c}`; };
const dotA = a => `<span class="dot" style="${colorStyle(a)}">${esc([...(a.name || '?')][0])}</span>`;
const dayName = d => '일월화수목금토'[new Date(d + 'T00:00').getDay()];
const dayLbl = d => { const t = TODAY(); return d === t ? '오늘' : d === addD(t, -1) ? '어제' : `${+d.slice(5, 7)}월 ${+d.slice(8)}일 (${dayName(d)})`; };
const pbar = (p, cls = '') => `<div class="pbar ${cls}"><i style="width:${Math.max(0, Math.min(100, p))}%"></i></div>`;
function spark(vals, color = '#1E7A4C', labels = []) {
  if (vals.length < 2) return '<div class="mut sm">데이터가 쌓이면 추이가 보여요</div>';
  const W = 340, H = 64, mn = Math.min(...vals), mx = Math.max(...vals), rg = (mx - mn) || 1;
  const x = i => 14 + i * (W - 28) / (vals.length - 1), y = v => H - 18 - (v - mn) / rg * (H - 28);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="xMidYMid meet">
    <polyline points="${vals.map((v, i) => `${x(i)},${y(v)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round"/>
    ${vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="${i === vals.length - 1 ? 4.5 : 2.8}" style="fill:${i === vals.length - 1 ? color : 'var(--card)'}" stroke="${color}" stroke-width="2"/>`).join('')}
    ${labels.map((l, i) => `<text x="${x(i)}" y="${H - 2}" font-size="10.5" style="fill:var(--muted)" text-anchor="middle">${esc(l)}</text>`).join('')}</svg>`;
}

/* ---------- 선 아이콘 (주변 글자색을 따름) ---------- */
const ICP = {
  food: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-2.5 5-2.5 8H17v10"/>',
  cafe: '<path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2M8 3v2M12 3v2"/>',
  fun: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M7 6 9 3M17 6l-2-3M10 10.5v5l4-2.5z"/>',
  sub: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/>',
  move: '<path d="M4 8h14l-4-4M20 16H6l4 4"/>',
  pay: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12.5h2M3 10h18"/>',
  shop: '<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
  bus: '<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M8 18v3M16 18v3M8.5 14.5h.01M15.5 14.5h.01"/>',
  house: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10M10 20v-5h4v5"/>',
  gift: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8c-1.5-3-5-4-5-1.5S10 8 12 8zM12 8c1.5-3 5-4 5-1.5S14 8 12 8z"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M8 8.5l1.7 7 2.3-5.2 2.3 5.2 1.7-7M7 11.6h10"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  dots: '<path d="M6 12h.01M12 12h.01M18 12h.01"/>',
  adj: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  alert: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
  send: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  home: '<path d="M3 11 12 4l9 7v9h-6v-6H9v6H3z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  pie: '<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h12v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/><path d="M16 14.5h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  filter: '<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  prev: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><path d="M7.5 8h.01"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  fx: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  down: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  up: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h8"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>',
  cloud: '<path d="M18 10h-1.3A7 7 0 1 0 9 19h9a4.5 4.5 0 0 0 0-9z"/>',
  ruler: '<rect x="3" y="8" width="18" height="8" rx="1"/><path d="M7 8v3M11 8v4M15 8v3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  theme: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.5v.5M12 17v.01"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  face: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9 16c1.7 1.2 4.3 1.2 6 0"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chart: '<path d="M4 17l5-5 4 4 7-7M15 9h5v5"/>',
};
const ico = (k, sz = 22) => `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICP[k] || ICP.dots}</svg>`;
// 카테고리 아이콘: 이름으로 모양·색을 고름 (직접 넣은 글자 아이콘이 있으면 그것)
const CIC = [[/커피|카페|디저트|음료/, 'cafe', '#9A6232'], [/식|밥|마트|생활|장보기/, 'food', '#2E8B57'], [/주거|공과|관리|월세|통신/, 'house', '#B7791F'],
  [/교통|차|주유|택시/, 'bus', '#1B8A8F'], [/쇼핑|옷|미용/, 'shop', '#D2692F'], [/구독/, 'sub', '#2F6FDB'], [/여가|문화|여행|취미/, 'fun', '#7A4FB0'],
  [/사람|경조|선물|모임/, 'gift', '#C2416B'], [/의료|병원|약|건강/, 'heart', '#D43F3A'], [/월급|급여|상여|보너스/, 'pay', '#1F8A4C'],
  [/캐시백|이자|환급|수입|용돈/, 'coin', '#A27B00'], [/교육|학원|책/, 'file', '#3D5A80'], [/보험|저축/, 'lock', '#5C6BC0']];
function catIcon(n, kind) {
  const c = catOf(n), own = c?.i && c.i !== '·' ? c.i : '';
  const hit = CIC.find(([re]) => re.test(n || '')) || (kind === 'inc' || c?.k === 'inc' ? [, 'coin', '#A27B00'] : [, 'dots', '#6B7785']);
  return { k: hit[1], c: hit[2], own };
}
function ciHTML(n, kind, extra = '') {
  const x = catIcon(n, kind);
  return `<span class="ci${extra}" style="background:${x.c}1F;color:${x.c}">${x.own ? `<b>${esc(x.own)}</b>` : ico(x.k, 18)}</span>`;
}
const ciMove = () => `<span class="ci" style="background:#6B77851F;color:#6B7785">${ico('move', 18)}</span>`;

/* ---------- 알림 (되돌리기 버튼) ---------- */
let TT;
function toast(m, undoable) {
  const t = $('#toast'); if (!t) return;
  t.innerHTML = `<span>${esc(m)}</span>${undoable ? `<button${at('undo')}>되돌리기</button>` : ''}`;
  t.classList.toggle('btn', !!undoable); t.classList.add('on'); clearTimeout(TT); TT = setTimeout(() => t.classList.remove('on'), undoable ? 4200 : 2400);
}

/* ---------- 아래에서 올라오는 창 ---------- */
const SH = {};
function openSheet(html, { onClose, locked, cls = '' } = {}) {
  const r = $('#sheet-root');
  r.innerHTML = `<div class="dim"${locked ? '' : ' data-a="close"'}></div><div class="bs ${cls}" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  r.classList.add('on'); SH.onClose = onClose;
  const f = r.querySelector('[autofocus]'); if (f) setTimeout(() => f.focus(), 60);
}
const sheetOpen = () => $('#sheet-root')?.classList.contains('on');
function closeSheet() { const r = $('#sheet-root'); r.classList.remove('on'); r.innerHTML = ''; const f = SH.onClose; SH.onClose = null; f && f(); }
// 창 머리: 제목, 작은 설명, 오른쪽 버튼 (없으면 닫기)
const bh = (ref, small = '', nav = '') => `<div class="bh"><div class="ref">${ref}${small ? `<small>${small}</small>` : ''}</div><div class="nav">${nav || `<button class="x"${at('close')} aria-label="닫기">${ico('close', 20)}</button>`}</div></div>`;
function confirmSheet(title, msg, okLabel, onOk, danger) {
  SH.ok = onOk;
  openSheet(`${bh(esc(title))}<div class="hint top lg">${msg}</div>
    <div class="row2 mt"><button class="btn big" data-a="close">취소</button>
    <button class="btn big ${danger ? 'dan' : 'pri'}" data-a="okSheet">${esc(okLabel)}</button></div>`);
}

/* ---------- 동기화 연결 (sync.js가 덮어씀) ---------- */
const Sync = { status: 'off', dirty() { }, menu() { toast('지금은 로그인 없이 이 기기에만 저장해요'); }, signIn() { }, };
const syncIcon = () => ({ off: '', out: '로그인', lock: ico('lock', 19), sync: ico('cloud', 19), ok: ico('cloud', 19), err: ico('alert', 19) }[Sync.status] ?? '');

/* ---------- 틀 ---------- */
const TABS = [['home', '홈', 'home'], ['list', '내역', 'list'], ['stats', '통계', 'pie'], ['assets', '자산', 'wallet']];
const tabsBar = () => `<nav class="tabs">${TABS.map(([k, l, i]) => `<button class="tab${U.tab === k ? ' on' : ''}"${at('tab', { v: k })}>${ico(i, 23)}<span>${l}</span></button>`).join('')}</nav>`;
const ib = (a, i, label, d = {}, cls = '') => `<button class="ib ${cls}"${at(a, d)} aria-label="${esc(label)}">${ico(i, 21)}</button>`;
const monthNav = () => `<div class="mo"><button class="ar"${at('mon', { k: -1 })} aria-label="이전 달">${ico('prev', 18)}</button><span>${U.month === ym(TODAY()) ? `${+U.month.slice(5)}월` : (U.month.slice(0, 4) === TODAY().slice(0, 4) ? `${+U.month.slice(5)}월` : mLabel(U.month))}</span><button class="ar${U.month >= ym(TODAY()) ? ' off' : ''}"${at('mon', { k: 1 })} aria-label="다음 달">${ico('next', 18)}</button></div>`;

let LAST_VIEW = '';
function render() {
  const app = $('#app');
  if (!S) { app.innerHTML = Sync.status === 'lock' ? vLocked() : vWelcome(); document.documentElement.classList.add('start'); return; }
  document.documentElement.classList.remove('start');
  if (U.detail && !A(U.detail)) U.detail = null;
  if (U.acct && !A(U.acct)) U.acct = null;
  const b = $('#body'), sc = b ? b.scrollTop : 0, key = U.tab + '|' + (U.detail || '') + '|' + U.setTab;
  QE.acct = null; // 계좌 화면이면 after()에서 그 계좌로
  const V = U.tab === 'set' ? vSet() : U.tab === 'assets' && U.detail ? vDetail(A(U.detail)) : ({ home: vHome, list: vList, stats: vStats, assets: vAssets }[U.tab] || vHome)();
  const keepQ = V.qe && $('#qeIn') ? $('#qeIn').value : '';
  app.innerHTML = `<header class="hdr">${V.hdr}</header><main class="body t-${U.tab}" id="body">${V.body}<div class="endsp"></div></main>${V.qe ? qeBar() : ''}${tabsBar()}`;
  app.classList.toggle('hasq', !!V.qe);
  if (key === LAST_VIEW) $('#body').scrollTop = sc;
  LAST_VIEW = key;
  if (V.qe) qeRestore(keepQ);
  if (V.after) V.after();
  saveUI();
}
