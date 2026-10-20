'use strict';
// 화면 공통: 테마, 화면 높이, 화면 상태, 표 그리기, 아래 창, 위·아래 틀
/* ---------- 앱 버전 · 화면 테마 · 화면 높이 ---------- */
const APP_VER = '2026.10.21-5';
// 화면 테마: auto(휴대폰 설정 따라감) / light / dark
const THK = KEY + '.theme';
const themePref = () => { try { return localStorage.getItem(THK) || 'auto'; } catch (e) { return 'auto'; } };
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const p = themePref(), t = p === 'auto' ? (darkMQ.matches ? 'dark' : 'light') : p;
  document.documentElement.dataset.theme = t;
}
applyTheme();
darkMQ.addEventListener?.('change', applyTheme);
// 아이폰 홈 화면 앱: 처음 켤 때 화면 높이를 상태 표시줄만큼 짧게 계산하는 버그 보정.
// 바깥 틀(html·body)과 앱을 모두 실제 화면 높이로 맞춘다. 설정 창에서 끌 수 있음.
const isIPad = () => /iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const isIOSApp = () => (navigator.standalone || matchMedia('(display-mode: standalone)').matches) && (/iPhone|iPod/.test(navigator.userAgent) || isIPad());
const HFK = KEY + '.hfix';
const hfixOn = () => { try { return (localStorage.getItem(HFK) ?? localStorage.getItem('cellbook.hfix')) !== 'off'; } catch (e) { return true; } };
function fitHeight() {
  const de = document.documentElement, b = document.body, app = document.getElementById('app');
  if (!b || !app) return;
  if (!isIOSApp() || !hfixOn()) { de.style.height = b.style.height = app.style.height = ''; app.style.bottom = ''; return; }
  const portrait = matchMedia('(orientation: portrait)').matches;
  const sh = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  const sw = portrait ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
  // 아이패드는 창 크기를 바꿀 수 있어서, 화면을 꽉 채운 경우에만 보정
  const h = isIPad() && window.innerWidth < sw - 2 ? window.innerHeight : Math.max(window.innerHeight, sh);
  de.style.height = b.style.height = app.style.height = h + 'px'; app.style.bottom = 'auto';
}

// 넓은 화면(아이패드·컴퓨터): 왼쪽 목록 + 넓은 표. 폭이 바뀌면 다시 그림
const WIDE = matchMedia('(min-width: 760px)');
const isWide = () => WIDE.matches;
WIDE.addEventListener?.('change', () => render());
let lastW = innerWidth, rT = 0;
window.addEventListener('resize', () => { if (!isWide() || innerWidth === lastW) return; lastW = innerWidth; clearTimeout(rT); rT = setTimeout(render, 150); });
// 확대·축소 (넓은 화면 상태 표시줄)
const zoomF = () => isWide() ? (U.zoom || 100) / 100 : 1;

/* ---------- UI state ---------- */
const U = { tab: 'dash', month: ym(TODAY()), acct: null, detail: null, sel: null, unit: 'won', showBal: false, sort: 'asc', q: '',
  flt: { p: 'month', t: 'all', cats: [] }, col: {}, setTab: 'acct' };
try { Object.assign(U, JSON.parse(localStorage.getItem(UIKEY) || '{}'), { month: ym(TODAY()), sel: null, q: '' }); } catch (e) { }
function saveUI() { try { const { tab, acct, unit, showBal, sort, col, setTab, recapSeen, zoom } = U; localStorage.setItem(UIKEY, JSON.stringify({ tab, acct, unit, showBal, sort, col, setTab, recapSeen, zoom })); } catch (e) { } }
const fmtU = n => { if (U.unit !== 'man' || Math.abs(n) < 10000) return fmt(n); const v = n / 10000; return (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toFixed(1)) + '만'; };

/* ---------- rendering helpers ---------- */
const at = (a, d = {}) => ` data-a="${a}"` + Object.entries(d).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
const L = i => (i >= 26 ? L(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + i % 26); // A … Z, AA, AB …
function gridW() {
  return (($('#app')?.clientWidth || innerWidth)) / zoomF() - 34 - 18;
}
function table(cols, rows, opt = {}) {
  let f = null; // 넓은 화면: 내용 열은 고정 폭, 남는 자리는 빈 열(D, E, F…)
  if (isWide() && !opt.nofill) { const W = gridW(), base = Math.min(W, Math.max(560, cols.length * 170)); f = { base, n: Math.min(40, Math.max(0, Math.floor((W - base) / 64))) }; }
  const cw = c => f ? (c.w * f.base / 100).toFixed(1) + 'px' : c.w + '%', fill = f ? '<td></td>'.repeat(f.n + 1) : '';
  let h = `<table class="sh"><colgroup><col class="rnc">${cols.map(c => `<col style="width:${cw(c)}">`).join('')}${f ? '<col style="width:64px">'.repeat(f.n) + '<col>' : ''}</colgroup>`;
  const o = opt.off || 0; // 앞 표에서 이어지는 열 글자
  h += `<thead><tr><th></th>${cols.map((c, i) => `<th class="${c.on ? 'on' : ''}">${L(o + i)}</th>`).join('')}${f ? Array.from({ length: f.n + 1 }, (_, i) => `<th>${L(o + cols.length + i)}</th>`).join('') : ''}</tr></thead><tbody>`;
  for (const r of rows) {
    h += `<tr${r.cls ? ` class="${r.cls}"` : ''}${r.attr || ''}><td class="rn${r.on ? ' on' : ''}"${r.rnA || ''}${r.h ? ` style="height:${r.h}px"` : ''}>${r.n}</td>`;
    for (const c of r.cells) {
      if (c === null) continue;
      const o = c && typeof c === 'object' ? c : { v: c };
      h += `<td${o.cs ? ` colspan="${o.cs}"` : ''} class="${o.c || ''}"${o.at || ''}${o.st ? ` style="${o.st}"` : ''}>${o.v ?? ''}</td>`;
    }
    h += fill + '</tr>';
  }
  return h + '</tbody></table>';
}
const dotA = a => `<span class="dot" style="background:${TYPES[a.type].c}">${esc(a.name[0] || '?')}</span>`;
const arrow = (d, goodWhenDown) => {
  if (!d) return '<span class="mut">— 0</span>';
  const up = d > 0, good = goodWhenDown ? !up : up;
  return `<span class="arr ${good ? 'good' : 'bad'}">${up ? '▲' : '▼'} ${fmtU(Math.abs(d))}</span>`;
};
const dbar = (p, inner, color) => ({ v: `<i style="width:calc(${Math.max(1, Math.min(100, p))}% - 8px)${color ? `;background:${color}` : ''}"></i><span>${inner}</span>`, c: 'dbar num b' });
function spark(vals, color = '#217346', labels = []) {
  if (vals.length < 2) return '<div class="mut" style="font-size:12px;padding:6px 4px">데이터가 쌓이면 추이가 보여요</div>';
  const W = 340, H = 60, mn = Math.min(...vals), mx = Math.max(...vals), rg = (mx - mn) || 1;
  const x = i => 14 + i * (W - 28) / (vals.length - 1), y = v => H - 18 - (v - mn) / rg * (H - 28);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="xMidYMid meet">
    <polyline points="${vals.map((v, i) => `${x(i)},${y(v)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2.4"/>
    ${vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="${i === vals.length - 1 ? 4.5 : 2.8}" style="fill:${i === vals.length - 1 ? color : 'var(--bg)'}" stroke="${color}" stroke-width="2"/>`).join('')}
    ${labels.map((l, i) => `<text x="${x(i)}" y="${H - 2}" font-size="10" style="fill:var(--muted)" text-anchor="middle">${esc(l)}</text>`).join('')}</svg>`;
}

/* ---------- toast / sheet ---------- */
let TT;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(TT); TT = setTimeout(() => t.classList.remove('on'), 2400); }
const SH = {};
function openSheet(html, { onClose, locked } = {}) {
  const r = $('#sheet-root');
  r.innerHTML = `<div class="dim"${locked ? '' : ' data-a="close"'}></div><div class="bs" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  r.classList.add('on'); SH.onClose = onClose;
  const f = r.querySelector('[autofocus]'); if (f) setTimeout(() => f.focus(), 60);
}
function closeSheet() { const r = $('#sheet-root'); r.classList.remove('on'); r.innerHTML = ''; const f = SH.onClose; SH.onClose = null; f && f(); }
const bh = (ref, small = '', nav = '') => `<div class="bh"><div class="ref">${ref}${small ? `<small>${small}</small>` : ''}</div><div class="nav">${nav}</div></div>`;
function confirmSheet(title, msg, okLabel, onOk, danger) {
  SH.ok = onOk;
  openSheet(`${bh(esc(title))}<div class="hint top lg">${msg}</div>
    <div class="row2" style="margin-top:14px"><button class="btn" data-a="close" style="height:46px">취소</button>
    <button class="btn ${danger ? 'dan' : 'pri'}" data-a="okSheet" style="height:46px">${esc(okLabel)}</button></div>`);
}

/* ---------- sync bridge (sync.js가 덮어씀) ---------- */
const Sync = { status: 'off', dirty() { }, menu() { toast('지금은 로그인 없이 이 기기에만 저장해요'); }, signIn() { }, };
const syncIcon = () => ({ off: '', out: '<span title="로그인 안 됨">⊘</span>', lock: '🔒', sync: '⟳', ok: '☁', err: '⚠' }[Sync.status] ?? '');

/* 선 아이콘 (색 없이 주변 글자색을 따름) */
const ICP = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  fx: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  down: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  up: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h8"/>',
  bank: '<path d="M3 10h18M12 3l9 5H3zM5 10v8M9.7 10v8M14.3 10v8M19 10v8M3 21h18"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>',
  cloud: '<path d="M18 10h-1.3A7 7 0 1 0 9 19h9a4.5 4.5 0 0 0 0-9z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  ruler: '<rect x="3" y="8" width="18" height="8" rx="1"/><path d="M7 8v3M11 8v4M15 8v3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  theme: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.5v.5M12 17v.01"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  face: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9 16c1.7 1.2 4.3 1.2 6 0"/>',
};
const ico = (k, sz = 22) => `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICP[k]}</svg>`;
/* ---------- frame ---------- */
const TABS = [['dash', '한눈에 보기'], ['input', '입력'], ['accts', '계좌별'], ['invest', '투자']];
function appBar(sub) {
  const si = syncIcon();
  return `<div class="app">${si ? `<button class="ic" data-a="syncMenu" aria-label="동기화">${si}</button>` : ''}
    <div class="ttl"><span class="doc">₩</span>셀가계부 <small>· ${esc(sub)}</small></div>
    <button class="unit${U.unit === 'man' ? ' on' : ''}"${at('unit')} aria-label="금액 단위: ${U.unit === 'man' ? '만원' : '원'} (누르면 바뀜)">₩${U.unit === 'man' ? '<sup>만</sup>' : ''}</button><button class="ic${hist.length ? '' : ' off'}" data-a="undo" aria-label="되돌리기">↶</button><button class="ic${fut.length ? '' : ' off'}" data-a="redo" aria-label="다시 실행">↷</button><button class="ic gear" data-a="gear" aria-label="설정">${ico('gear', 21)}</button></div>`;
}
const stat = (l, items = [], err, tail = '') => `<div class="stat">${err ? `<span class="err">${err}</span>` : `<span class="l">${l || ''}</span>`}${items.map(x => `<span>${x}</span>`).join('')}${tail}</div>`;
const tabsBar = () => `<div class="tabs">${TABS.map(([k, l]) => `<button class="tab${U.tab === k ? ' on' : ''}"${at('tab', { v: k })}>${l}</button>`).join('')}</div>`;
const sep = '<div class="sep"></div>';
const tb = (...x) => `<div class="tb">${x.join('')}</div>`;
const monthPill = () => `<div class="pill"><button class="ar"${at('mon', { k: -1 })} aria-label="이전 달">◀</button><span>${mLabel(U.month)}</span><button class="ar"${at('mon', { k: 1 })} aria-label="다음 달">▶</button></div>`;
function acctPill(id, mode) {
  const a = id && A(id);
  return `<button class="pill"${at('pickPill', { m: mode })}>${a ? `${dotA(a)}${esc(a.name)}` : '<span class="dot" style="background:#888">∗</span>전체 계좌'} ▾</button>`;
}


function fillRows() {
  const g = $('#grid'); if (!g) return;
  const ts = [...g.querySelectorAll(':scope > table.sh')]; if (ts.length !== 1) return;
  const rh = (matchMedia('(pointer: fine)').matches ? 20 : 28) * zoomF(), gb = g.getBoundingClientRect().bottom - 20;
  for (const t of ts) {
    const tb = t.tBodies[0], last = tb.rows[tb.rows.length - 1]; if (!last) continue;
    const k = Math.floor((gb - t.getBoundingClientRect().bottom) / rh); if (k <= 0) continue;
    const nc = t.querySelectorAll('col').length - 1, a = U.tab === 'input' ? ' data-a="newRow"' : '';
    let n = +last.cells[0].textContent || tb.rows.length, h = '';
    for (let i = 0; i < k; i++) h += `<tr${a}><td class="rn">${++n}</td>${'<td></td>'.repeat(nc)}</tr>`;
    tb.insertAdjacentHTML('beforeend', h);
  }
}
const zoomBar = () => { const z = U.zoom || 100; return `<span class="zm"><button${at('zoom', { k: -1 })} aria-label="축소">−</button><input type="range" id="zoomS" data-i="zoomS" min="50" max="200" step="5" value="${z}" aria-label="확대 비율"><button${at('zoom', { k: 1 })} aria-label="확대">+</button><button class="zp"${at('zoomDlg')} title="확대/축소">${z}%</button></span>`; };
// 엑셀처럼 아래쪽 시트 탭
const sheetTabs = () => `<div class="stabs"><button class="snv"${at('tabStep', { k: -1 })} aria-label="이전 시트">◀</button><button class="snv"${at('tabStep', { k: 1 })} aria-label="다음 시트">▶</button>${TABS.map(([k, l]) => `<button class="st${U.tab === k ? ' on' : ''}"${at('tab', { v: k })}>${l}</button>`).join('')}</div>`;

let LAST_VIEW = '';
function render() {
  const app = $('#app');
  const wide = !!S && isWide();
  document.documentElement.classList.toggle('wide', wide);
  document.documentElement.classList.toggle('wide-start', !S && isWide()); // 넓은 화면의 첫 화면은 가운데 상자로
  if (!S) { app.innerHTML = Sync.status === 'lock' ? vLocked() : vWelcome(); return; }
  if (U.detail && !A(U.detail)) U.detail = null;
  if (U.acct && !A(U.acct)) U.acct = null;
  const g = $('#grid'), sc = g ? g.scrollTop : 0, key = U.tab + '|' + (U.detail || '') + '|' + (U.tab === 'set' ? U.setTab : '');
  const V = ({ dash: vDash, input: vInput, accts: vAccts, invest: vInvest, set: vSet }[U.tab] || vDash)();
  app.style.setProperty('--z', zoomF());
  const inner = (V.tb || '') + (V.qbar || '') + (V.top || '') + `<div class="grid t-${U.tab}" id="grid">${V.body}</div>` + (V.bottom || '') + (wide ? sheetTabs() : '') + stat(V.l, V.items, V.err, wide ? zoomBar() : '');
  app.innerHTML = wide ? appBar(V.sub) + `<div class="main">${inner}</div>` : appBar(V.sub) + inner + tabsBar();
  if (wide) fillRows();
  if (key === LAST_VIEW) $('#grid').scrollTop = sc;
  LAST_VIEW = key;
  if (V.after) V.after();
  if (QE.focus) { const q = $('#qeIn'); if (q) q.focus(); QE.focus = false; }
  saveUI();
}
function selPaint() {
  const g = $('#grid'), tr = g?.querySelector(`tr[data-a="cell"][data-id="${CSS.escape(U.sel.id)}"]`);
  if (!tr) return render();
  g.querySelectorAll('td.sel').forEach(x => x.classList.remove('sel'));
  g.querySelectorAll('td.rn.on, thead th.on').forEach(x => x.classList.remove('on'));
  tr.querySelector(`td[data-k="${U.sel.k}"]`)?.classList.add('sel'); tr.cells[0].classList.add('on');
  g.querySelectorAll('thead th')[(U.nav?.ks.indexOf(U.sel.k) ?? -1) + 1]?.classList.add('on');
  const nb = $('.nbox'); if (nb) nb.textContent = refOf(U.sel.id, U.sel.k);
  const r = rowById(U.sel.id), sp = $('.stat'); // 상태 표시줄: 금액 셀이면 선택 금액
  if (sp && r) sp.querySelectorAll(':scope > span:not(.l):not(.err)').forEach((x, i) => { if (!i && U.sel.k === 'amt') x.textContent = `선택: ${fmt(r.amt)}`; });
}
function scrollSel() { requestAnimationFrame(() => { const el = $('#grid .sel'); if (el) el.scrollIntoView({ block: 'nearest' }); }); }
