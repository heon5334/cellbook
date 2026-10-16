'use strict';
/* =========================================================
   셀가계부 — 스프레드시트 감성 가계부 (기기 우선 저장 + 선택적 암호화 동기화)
   ========================================================= */

/* ---------- utils ---------- */
const $ = (s, e = document) => e.querySelector(s);
const TESTMODE = new URLSearchParams(location.search).has('test'); // 자동 점검은 실제 가계부와 다른 저장 공간을 쓴다
const KEY = TESTMODE ? 'cellbook.test' : 'cellbook.v1', UIKEY = KEY + '.ui';
const pad2 = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const TODAY = () => ymd(new Date());
const ym = s => s.slice(0, 7);
const lastDay = m => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); };
const mRange = m => [`${m}-01`, `${m}-${pad2(lastDay(m))}`];
const addM = (m, k) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + k, 1); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; };
const addD = (s, k) => { const [y, m, d] = s.split('-').map(Number); return ymd(new Date(y, m - 1, d + k)); };
const mLabel = m => `${m.slice(0, 4)}년 ${+m.slice(5)}월`;
const mShort = m => `${+m.slice(5)}월`;
const dLabel = s => `${+s.slice(5, 7)}/${s.slice(8)}`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Math.round(n || 0).toLocaleString('ko-KR');
const sgn = n => (n > 0 ? '+' : n < 0 ? '-' : '') + fmt(Math.abs(n));
const now = () => Date.now();
const uid = () => now().toString(36) + Math.random().toString(36).slice(2, 8);
const num = s => { const v = Number(String(s ?? '').replace(/[^\d.-]/g, '')); return Number.isFinite(v) ? v : 0; };
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

/* ---------- model ---------- */
const TYPES = {
  bank: { l: '입출금', c: '#2E8B57', g: 'cash' },
  card: { l: '카드', c: '#C0504D', g: 'cash' },
  prepaid: { l: '충전식', c: '#1B8A8F', g: 'cash' },
  saving: { l: '적금', c: '#3D5A80', g: 'cash' },
  invest: { l: '투자', c: '#C98A00', g: 'invest' },
  foreign: { l: '해외', c: '#7A4FB0', g: 'foreign' },
};
const TORD = Object.keys(TYPES);
const GROUPS = { cash: { l: '현금·적금', c: '#2E8B57' }, invest: { l: '투자', c: '#C98A00' }, foreign: { l: '해외 자산', c: '#7A4FB0' } };
const TXL = { out: '출금', in: '입금', move: '이동' };
const TAGS = ['', '#F2C94C', '#EB5757', '#2F80ED', '#27AE60'];
const CURS = ['USD', 'JPY', 'EUR', 'CNY', 'VND', 'GBP', 'AUD', 'CAD', 'HKD', 'TWD', 'THB'];
const DEF_CATS = [['식비·생활', 'exp'], ['커피·디저트', 'exp'], ['주거·공과금', 'exp'], ['교통', 'exp'], ['쇼핑', 'exp'], ['구독료', 'exp'], ['여가', 'exp'],
  ['사람', 'exp'], ['기타', 'exp'], ['월급', 'inc'], ['기타수입', 'inc'], ['캐시백', 'inc']];
const OLD_DEF_IC = new Set(['🍚', '☕', '🏠', '🚌', '🛍', '🔁', '🎬', '🎁', '·', '💼', '➕', '🎉']);
const COLLS = ['accounts', 'cats', 'tx', 'rec'];
const MAPS = ['val', 'ov', 'arch'];

function blankState() {
  // 기본값은 u:0 — 다른 기기의 실제 데이터보다 항상 오래된 것으로 취급(동기화 시 덮어쓰지 않도록)
  return { ver: 2, settings: { start: TODAY(), isaLimit: 20000000, u: 0 }, accounts: [], cats: DEF_CATS.map(([n, k], j) => ({ id: 'c' + j, n, i: '', k, u: 0 })),
    tx: [], rec: [], val: {}, ov: {}, arch: {}, fx: { u: 0 }, del: {} };
}
function normalize(s) {
  const b = blankState();
  const o = { ...b, ...s };
  for (const c of COLLS) o[c] = Array.isArray(o[c]) ? o[c].filter(x => x && x.id) : [];
  for (const c of MAPS) o[c] = o[c] && typeof o[c] === 'object' ? o[c] : {};
  o.cats = o.cats.map(c => !c.u && OLD_DEF_IC.has(c.i) ? { ...c, i: '' } : c); // 예전 기본 이모지 아이콘은 비움
  o.settings = { ...b.settings, ...(o.settings || {}) };
  o.fx = o.fx && typeof o.fx === 'object' ? o.fx : { u: 0 };
  o.del = o.del && typeof o.del === 'object' ? o.del : {};
  o.ver = 2;
  return o;
}
let S = null;
function load() { try { const t = localStorage.getItem(KEY); return t ? normalize(JSON.parse(t)) : null; } catch (e) { return null; } }
function persist(sync = true) {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('저장에 실패했어요. 기기 저장 공간을 확인하세요'); }
  if (sync) Sync.dirty();
}

const A = id => S.accounts.find(a => a.id === id);
const accName = id => A(id)?.name || '(계좌 없음)';
const catOf = n => S.cats.find(c => c.n === n);
const catLbl = n => { const i = catOf(n)?.i; return (i && i !== '·' ? esc(i) + ' ' : '') + esc(n); }; // 사용자가 아이콘을 넣은 경우만 앞에 붙임
const touch = o => (o.u = now(), o);
const txById = id => S.tx.find(t => t.id === id);
const accts = () => S.accounts.filter(a => !a.hidden);
function removeRec(coll, id) { S[coll] = S[coll].filter(x => x.id !== id); S.del[id] = now(); }
const getVal = (aid, m) => { const x = S.val[aid + '|' + m]; return x && !x.del ? x.v : null; };
const ovOf = id => { const o = S.ov[id]; return o && !o.del ? o : null; };

/* ---------- merge (동기화용, 레코드 단위 최신 우선) ---------- */
function mergeState(a, b) {
  if (!a) return normalize(b); if (!b) return normalize(a);
  a = normalize(a); b = normalize(b);
  const o = { ver: 2 };
  const del = { ...a.del };
  for (const [k, v] of Object.entries(b.del)) del[k] = Math.max(del[k] || 0, v);
  for (const c of COLLS) {
    const m = new Map();
    for (const x of [...a[c], ...b[c]]) { const y = m.get(x.id); if (!y || (x.u || 0) > (y.u || 0)) m.set(x.id, x); }
    o[c] = [...m.values()].filter(x => !((del[x.id] || 0) >= (x.u || 0)));
  }
  for (const c of MAPS) {
    o[c] = { ...a[c] };
    for (const [k, v] of Object.entries(b[c])) { const y = o[c][k]; if (!y || (v.u || 0) > (y.u || 0)) o[c][k] = v; }
  }
  o.settings = (b.settings.u || 0) > (a.settings.u || 0) ? b.settings : a.settings;
  o.fx = (b.fx.u || 0) > (a.fx.u || 0) ? b.fx : a.fx;
  const cut = now() - 400 * 864e5;
  for (const k of Object.keys(del)) if (del[k] < cut) delete del[k];
  o.del = del;
  if (a.demo && b.demo) o.demo = true;
  return o;
}
// 되돌리기 시, 바뀐 레코드에 새 시각을 찍어 동기화에서도 되돌린 상태가 이기도록
function stampRestore(cur, old) {
  const t = now();
  for (const c of COLLS) {
    const cm = new Map(cur[c].map(x => [x.id, x])), om = new Map(old[c].map(x => [x.id, x]));
    for (const [id, x] of om) { const y = cm.get(id); if (!y || JSON.stringify(y) !== JSON.stringify(x)) { x.u = t; delete old.del[id]; } }
    for (const id of cm.keys()) if (!om.has(id)) old.del[id] = t;
  }
  for (const c of MAPS) {
    for (const k of new Set([...Object.keys(cur[c]), ...Object.keys(old[c])])) {
      const x = cur[c][k], y = old[c][k];
      if (JSON.stringify(x) !== JSON.stringify(y)) { if (y) y.u = t; else old[c][k] = { del: 1, u: t }; }
    }
  }
  if (JSON.stringify(cur.settings) !== JSON.stringify(old.settings)) old.settings.u = t;
  if (JSON.stringify(cur.fx) !== JSON.stringify(old.fx)) old.fx.u = t;
  return old;
}

/* ---------- history ---------- */
const hist = [], fut = [];
let LED = null, MEMO = {};
function invalidate() { LED = null; MEMO = {}; }
function commit(fn, { silent } = {}) {
  hist.push(JSON.stringify(S)); if (hist.length > 60) hist.shift(); fut.length = 0;
  fn(); invalidate(); persist(); if (!silent) render();
}
function undo() {
  if (!hist.length) return toast('되돌릴 작업이 없어요');
  fut.push(JSON.stringify(S)); S = stampRestore(S, JSON.parse(hist.pop())); invalidate(); persist(); render(); toast('되돌렸어요');
}
function redo() {
  if (!fut.length) return toast('다시 실행할 작업이 없어요');
  hist.push(JSON.stringify(S)); S = stampRestore(S, JSON.parse(fut.pop())); invalidate(); persist(); render();
}

/* ---------- ledger: 입력 + 정기 결제 + 충전식 자동 행 ---------- */
function delta(r, id) {
  if (r.type === 'out') return r.acct === id ? -r.amt : 0;
  if (r.type === 'in') return r.acct === id ? r.amt : 0;
  let d = 0; if (r.acct === id) d -= r.amt; if (r.to === id) d += r.amt; return d;
}
const led = () => LED || (LED = buildLedger());
function buildLedger() {
  const today = TODAY(), st = S.settings.start;
  const rows = S.tx.map((t, i) => ({ ...t, amt: +t.amt || 0, seq: i }));
  for (const r of S.rec) {
    if (!r.start || !(+r.amt) || !(+r.day) || !r.acct) continue;
    let m = ym(r.start); const em = ym(today);
    for (let g = 0; m <= em && g < 600; g++, m = addM(m, 1)) {
      const d = `${m}-${pad2(Math.min(+r.day, lastDay(m)))}`;
      if (d < r.start || d < st || d > today || (r.end && d > r.end)) continue;
      const id = `rec:${r.id}:${m}`, o = ovOf(id);
      if (o?.hidden) continue;
      rows.push({ id, date: d, acct: r.acct, type: r.type, amt: o?.amt ?? +r.amt, cat: r.type === 'move' ? '' : (r.cat || ''), to: r.type === 'move' ? r.to : '',
        memo: r.name, auto: 'rec', src: r.id, seq: 1e7 });
    }
  }
  rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.seq - b.seq);
  const pp = S.accounts.filter(a => a.type === 'prepaid');
  if (!pp.length) return rows;
  const bal = {}; for (const a of pp) bal[a.id] = +a.start || 0;
  const out = [];
  const charge = (id, a, r, n, M) => { // 충전 행 추가 (n회 × M원)
    const o = ovOf(id); if (o?.hidden) return;
    const amt = o?.amt ?? n * M;
    out.push({ id, date: r.date, acct: a.link || '', type: 'move', to: a.id, amt, cat: '', memo: n > 1 ? `자동 충전 ×${n}` : '자동 충전', auto: 'chg', src: a.id, parent: r.id });
    bal[a.id] += amt; if (a.link in bal) bal[a.link] -= amt;
  };
  for (const r of rows) {
    const pa = r.date >= st && r.type === 'out' && (r.acct in bal) ? A(r.acct) : null;
    const M = pa ? +pa.camt || 0 : 0;
    if (pa && M > 0) { // 잔액이 결제액보다 모자라면 결제 전에 먼저 충전
      let n = 0, b = bal[pa.id]; while (b < r.amt && n < 100) { b += M; n++; }
      if (n) charge('chgp:' + r.id, pa, r, n, M);
    }
    out.push(r);
    if (r.date < st) continue;
    for (const id in bal) bal[id] += delta(r, id);
    if (!pa) continue;
    const T = +pa.th || 0, P = +pa.cbp || 0;
    if (M > 0) { // 결제 후 잔액이 기준 이하면 충전
      let n = 0, b = bal[pa.id]; while (b <= T && n < 100) { b += M; n++; }
      if (n) charge('chg:' + r.id, pa, r, n, M);
    }
    if (P > 0) {
      const id = 'cb:' + r.id, o = ovOf(id);
      if (!o?.hidden) {
        const amt = o?.amt ?? Math.floor(r.amt * P / 100);
        if (amt > 0) { out.push({ id, date: r.date, acct: pa.id, type: 'in', amt, cat: '캐시백', to: '', memo: `캐시백 ${P}%`, auto: 'cb', src: pa.id, parent: r.id }); bal[pa.id] += amt; }
      }
    }
  }
  return out;
}
const rowById = id => led().find(r => r.id === id);
function balAt(id, upto) {
  const a = A(id); let b = +a?.start || 0; const st = S.settings.start;
  for (const r of led()) { if (r.date > upto) break; if (r.date < st) continue; b += delta(r, id); }
  return b;
}
function flow(id, s, e) {
  let b = 0; const st = S.settings.start;
  for (const r of led()) { if (r.date > e) break; if (r.date < s || r.date < st) continue; b += delta(r, id); }
  return b;
}
function invSeries(a) {
  return MEMO['inv' + a.id] ??= (() => {
    const sm = ym(S.settings.start), em = ym(TODAY()), res = [];
    let prev = +a.start || 0, prin = +(a.prin ?? a.start) || 0;
    for (let m = sm, g = 0; m <= em && g < 600; m = addM(m, 1), g++) {
      const [s, e] = mRange(m), c = flow(a.id, s, e), ent = getVal(a.id, m), v = ent ?? (prev + c);
      prin += c;
      res.push({ m, c, v, ent, pl: ent != null ? v - prev - c : null, prin, rate: prin ? (v - prin) / prin : 0 });
      prev = v;
    }
    return res;
  })();
}
function invAt(a, m) { let v = +a.start || 0; for (const x of invSeries(a)) { if (x.m > m) break; v = x.v; } return v; }
const fxRate = a => +a.rate || +S.fx[a.cur] || 0;
const fxVal = a => Math.round((+a.famt || 0) * fxRate(a));
function valueAt(a, date) {
  if (a.type === 'invest') return invAt(a, ym(date));
  if (a.type === 'foreign') return fxVal(a);
  return balAt(a.id, date);
}
const archOf = m => { const x = S.arch?.[m]; return x && !x.del && mRange(m)[1] < S.settings.start ? x : null; };
function groups(date) {
  const am = date < S.settings.start ? archOf(ym(date)) : null; if (am) return am.g;
  return MEMO['g' + date] ??= (() => {
    const g = { cash: 0, invest: 0, foreign: 0 };
    for (const a of S.accounts) g[TYPES[a.type].g] += valueAt(a, date);
    g.total = g.cash + g.invest + g.foreign; return g;
  })();
}
function endOf(m) { const t = TODAY(); if (m >= ym(t)) return t; return mRange(m)[1]; }
function mstats(m) {
  const am = archOf(m); if (am) return { inc: am.inc, exp: am.exp, net: am.inc - am.exp, cats: { ...am.cats }, top: [], arch: true };
  const [s, e] = mRange(m);
  const st = S.settings.start; let inc = 0, exp = 0; const cats = {}, top = [];
  for (const r of led()) {
    if (r.date < s || r.date > e || r.date < st) continue;
    const a = A(r.acct); if (!a || a.type === 'invest' || a.type === 'foreign') continue;
    if (r.type === 'in') inc += r.amt;
    else if (r.type === 'out') { exp += r.amt; const k = r.cat || '미분류'; cats[k] = (cats[k] || 0) + r.amt; top.push(r); }
  }
  top.sort((a, b) => b.amt - a.amt);
  return { inc, exp, net: inc - exp, cats, top };
}
function aStats(id, s, e) {
  const st = S.settings.start;
  const o = { out: 0, inc: 0, n: 0, outCat: {}, inCat: {}, mOut: {}, mIn: {}, chg: 0, chgN: 0, cb: 0, maxDay: null };
  const days = {};
  for (const r of led()) {
    if (r.date < s || r.date > e || r.date < st) continue;
    if (r.acct !== id && r.to !== id) continue;
    o.n++;
    if (r.type === 'out' && r.acct === id) { o.out += r.amt; const k = r.cat || '미분류'; o.outCat[k] = (o.outCat[k] || 0) + r.amt; days[r.date] = (days[r.date] || 0) + r.amt; }
    else if (r.type === 'in' && r.acct === id) { o.inc += r.amt; const k = r.cat || '미분류'; o.inCat[k] = (o.inCat[k] || 0) + r.amt; if (r.auto === 'cb') o.cb += r.amt; }
    else if (r.type === 'move') {
      if (r.acct === id) o.mOut[r.to] = (o.mOut[r.to] || 0) + r.amt;
      if (r.to === id) { o.mIn[r.acct] = (o.mIn[r.acct] || 0) + r.amt; if (r.auto === 'chg') { o.chg += r.amt; o.chgN++; } }
    }
  }
  const md = Object.entries(days).sort((a, b) => b[1] - a[1])[0]; if (md) o.maxDay = md;
  return o;
}

/* ---------- 앱 버전 · 화면 테마 · 화면 높이 ---------- */
const APP_VER = '2026.10.17-8';
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
const isIOSApp = () => (navigator.standalone || matchMedia('(display-mode: standalone)').matches) && /iPhone|iPad|iPod/.test(navigator.userAgent);
const HFK = KEY + '.hfix';
const hfixOn = () => { try { return (localStorage.getItem(HFK) ?? localStorage.getItem('cellbook.hfix')) !== 'off'; } catch (e) { return true; } };
function fitHeight() {
  const de = document.documentElement, b = document.body, app = document.getElementById('app');
  if (!b || !app) return;
  if (!isIOSApp() || !hfixOn()) { de.style.height = b.style.height = app.style.height = ''; app.style.bottom = ''; return; }
  const portrait = matchMedia('(orientation: portrait)').matches;
  const h = Math.max(window.innerHeight, portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height));
  de.style.height = b.style.height = app.style.height = h + 'px'; app.style.bottom = 'auto';
}

/* ---------- UI state ---------- */
const U = { tab: 'dash', month: ym(TODAY()), acct: null, detail: null, sel: null, unit: 'won', showBal: false, sort: 'asc', q: '',
  flt: { p: 'month', t: 'all', cats: [] }, col: {}, setTab: 'acct' };
try { Object.assign(U, JSON.parse(localStorage.getItem(UIKEY) || '{}'), { month: ym(TODAY()), sel: null, q: '' }); } catch (e) { }
function saveUI() { try { const { tab, acct, unit, showBal, sort, col, setTab, recapSeen } = U; localStorage.setItem(UIKEY, JSON.stringify({ tab, acct, unit, showBal, sort, col, setTab, recapSeen })); } catch (e) { } }
const fmtU = n => { if (U.unit !== 'man' || Math.abs(n) < 10000) return fmt(n); const v = n / 10000; return (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toFixed(1)) + '만'; };

/* ---------- rendering helpers ---------- */
const at = (a, d = {}) => ` data-a="${a}"` + Object.entries(d).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
const L = i => String.fromCharCode(65 + i);
function table(cols, rows) {
  let h = `<table class="sh"><colgroup><col class="rnc">${cols.map(c => `<col style="width:${c.w}%">`).join('')}</colgroup>`;
  h += `<thead><tr><th></th>${cols.map((c, i) => `<th class="${c.on ? 'on' : ''}">${L(i)}</th>`).join('')}</tr></thead><tbody>`;
  for (const r of rows) {
    h += `<tr${r.cls ? ` class="${r.cls}"` : ''}${r.attr || ''}><td class="rn${r.on ? ' on' : ''}"${r.rnA || ''}${r.h ? ` style="height:${r.h}px"` : ''}>${r.n}</td>`;
    for (const c of r.cells) {
      if (c === null) continue;
      const o = c && typeof c === 'object' ? c : { v: c };
      h += `<td${o.cs ? ` colspan="${o.cs}"` : ''} class="${o.c || ''}"${o.at || ''}${o.st ? ` style="${o.st}"` : ''}>${o.v ?? ''}</td>`;
    }
    h += '</tr>';
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
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  cloud: '<path d="M18 10h-1.3A7 7 0 1 0 9 19h9a4.5 4.5 0 0 0 0-9z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  ruler: '<rect x="3" y="8" width="18" height="8" rx="1"/><path d="M7 8v3M11 8v4M15 8v3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  theme: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  face: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9 16c1.7 1.2 4.3 1.2 6 0"/>',
};
const ico = (k, sz = 22) => `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICP[k]}</svg>`;
/* ---------- frame ---------- */
const TABS = [['dash', '한눈에 보기'], ['input', '입력'], ['accts', '계좌별'], ['invest', '투자']];
function appBar(sub) {
  const si = syncIcon();
  return `<div class="app">${si ? `<button class="ic" data-a="syncMenu" aria-label="동기화">${si}</button>` : ''}
    <div class="ttl"><span class="doc">₩</span>셀가계부 <small>· ${esc(sub)}</small></div>
    <button class="unit${U.unit === 'man' ? ' on' : ''}"${at('unit')} aria-label="금액 단위: ${U.unit === 'man' ? '만원' : '원'} (누르면 바뀜)">₩${U.unit === 'man' ? '<sup>만</sup>' : ''}</button><button class="ic${hist.length ? '' : ' off'}" data-a="undo" aria-label="되돌리기">↶</button><button class="ic${fut.length ? '' : ' off'}" data-a="redo" aria-label="다시 실행">↷</button><button class="ic gear" data-a="gear" aria-label="설정"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button></div>`;
}
const stat = (l, items = [], err) => `<div class="stat">${err ? `<span class="err">${err}</span>` : `<span class="l">${l || ''}</span>`}${items.map(x => `<span>${x}</span>`).join('')}</div>`;
const tabsBar = () => `<div class="tabs">${TABS.map(([k, l]) => `<button class="tab${U.tab === k ? ' on' : ''}"${at('tab', { v: k })}>${l}</button>`).join('')}</div>`;
const sep = '<div class="sep"></div>';
const tb = (...x) => `<div class="tb">${x.join('')}</div>`;
const monthPill = () => `<div class="pill"><button class="ar"${at('mon', { k: -1 })} aria-label="이전 달">◀</button><span>${mLabel(U.month)}</span><button class="ar"${at('mon', { k: 1 })} aria-label="다음 달">▶</button></div>`;
function acctPill(id, mode) {
  const a = id && A(id);
  return `<button class="pill"${at('pickPill', { m: mode })}>${a ? `${dotA(a)}${esc(a.name)}` : '<span class="dot" style="background:#888">∗</span>전체 계좌'} ▾</button>`;
}

let LAST_VIEW = '';
function render() {
  const app = $('#app');
  if (!S) { app.innerHTML = Sync.status === 'lock' ? vLocked() : vWelcome(); return; }
  if (U.detail && !A(U.detail)) U.detail = null;
  if (U.acct && !A(U.acct)) U.acct = null;
  const g = $('#grid'), sc = g ? g.scrollTop : 0, key = U.tab + '|' + (U.detail || '') + '|' + (U.tab === 'set' ? U.setTab : '');
  const V = ({ dash: vDash, input: vInput, accts: vAccts, invest: vInvest, set: vSet }[U.tab] || vDash)();
  app.innerHTML = appBar(V.sub) + (V.tb || '') + (V.qbar || '') + (V.top || '') +
    `<div class="grid" id="grid">${V.body}</div>` + (V.bottom || '') + stat(V.l, V.items, V.err) + tabsBar();
  if (key === LAST_VIEW) $('#grid').scrollTop = sc;
  LAST_VIEW = key;
  if (V.after) V.after();
  if (QE.focus) { const q = $('#qeIn'); if (q) q.focus(); QE.focus = false; }
  saveUI();
}
function scrollSel() { requestAnimationFrame(() => { const el = $('#grid .sel'); if (el) el.scrollIntoView({ block: 'nearest' }); }); }

/* =========================================================
   VIEWS
   ========================================================= */
function noAccounts() {
  return `<div class="empty">아직 계좌가 없어요.<br>설정 탭에서 통장·카드·투자 계좌를 추가하면<br>여기에 표시돼요.<br><br><button class="btn pri"${at('goSetAcct')}>계좌 추가하기</button></div>`;
}

/* ----- 한눈에 보기 ----- */
function vDash() {
  const base = { sub: '한눈에 보기', tb: tb(monthPill()) };
  if (!S.accounts.length) return { ...base, body: noAccounts() };
  const m = U.month, E = endOf(m), pm = addM(m, -1), PE = mRange(pm)[1];
  const g = groups(E), pg = groups(PE), st = mstats(m), ps = mstats(pm);
  const ch = g.total - pg.total, chp = pg.total ? ch / Math.abs(pg.total) * 100 : 0;
  const cols = [{ w: 33, on: 1 }, { w: 34 }, { w: 33 }];
  const kpi = (l, v, c = '') => ({ v: `<span class="kl">${l}</span><span class="kv ${c}">${v}</span>`, c: 'k' });
  const rows = []; let n = 1;
  rows.push({ n: n++, on: 1, h: 112, cls: 'hero', cells: [{ v: `<span class="kl">총자산 · ${+E.slice(5, 7)}월 ${+E.slice(8)}일 기준</span><span class="kv">${fmtU(g.total)}${U.unit === 'man' ? '' : '<small>원</small>'}</span><br>
    <span class="badge ${ch >= 0 ? 'up' : 'dn'}">${ch >= 0 ? '▲' : '▼'} ${fmtU(Math.abs(ch))} · ${chp >= 0 ? '+' : ''}${chp.toFixed(1)}% <span style="font-weight:400;opacity:.8">지난달보다</span></span>`, c: 'k sel', cs: 3 }, null, null] });
  rows.push({ n: n++, h: 62, cells: [kpi('들어온 돈', fmtU(st.inc), 'pos'), kpi('지출', fmtU(st.exp)), kpi('순수입', (st.net > 0 ? '+' : '') + fmtU(st.net), st.net >= 0 ? 'pos' : 'neg')] });
  rows.push({ n: n++, cls: 'sec', attr: at('tab', { v: 'accts' }), cells: [{ v: '자산 구성', cs: 3 }, null, null] });
  const gk = Object.keys(GROUPS).filter(k => S.accounts.some(a => TYPES[a.type].g === k));
  const pos = gk.reduce((s, k) => s + Math.max(0, g[k]), 0) || 1;
  rows.push({ n: n++, h: 34, cells: [{ v: `<div class="stk">${gk.map(k => `<i style="width:${Math.max(0, g[k]) / pos * 100}%;background:${GROUPS[k].c}"></i>`).join('')}</div>`, cs: 3 }, null, null] });
  for (const k of gk) {
    const d = pg[k] ? (g[k] - pg[k]) / Math.abs(pg[k]) * 100 : 0;
    // 이번 달 평가금액을 아직 안 넣은 투자 계좌가 있으면 변화율 대신 '입력 전'
    const pend = k === 'invest' && !archOf(m) && accts().some(a => a.type === 'invest' && getVal(a.id, m) == null);
    rows.push({ n: n++, attr: at(pend ? 'tab' : 'tab', { v: pend ? 'invest' : 'accts' }), cells: [`<span class="lg" style="background:${GROUPS[k].c}"></span>${GROUPS[k].l}`, { v: fmtU(g[k]), c: 'num b' },
      { v: `${pct(Math.max(0, g[k]), pos)}% &nbsp;${pend ? '<span class="mut">입력 전</span>' : `<span class="arr ${d >= 0 ? 'up' : 'dn'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)}%</span>`}`, c: 'num' }] });
  }
  rows.push({ n: n++, cls: 'sec', attr: at('goInput', { acct: '' }), cells: [{ v: `${m === ym(TODAY()) ? '이번 달' : mShort(m)} 큰 지출 TOP 3<small>입력 탭에서 보기 ›</small>`, cs: 3 }, null, null] });
  if (!st.top.length) rows.push({ n: n++, cells: [{ v: st.arch ? '정리된 달이라 개별 거래는 남아 있지 않아요' : '지출 기록이 없어요', c: 'mut', cs: 3 }, null, null] });
  for (const r of st.top.slice(0, 3)) rows.push({ n: n++, attr: at('goRow', { id: r.id }), cells: [`${dLabel(r.date)} ${esc(r.memo || r.cat)}`, { v: esc(accName(r.acct)), c: 'mut' }, { v: fmtU(r.amt), c: 'num' }] });
  rows.push({ n: n++, cls: 'sec', cells: [{ v: `카테고리<small>${m === ym(TODAY()) ? '이번 달' : mShort(m)} · 지출 큰 순</small>`, cs: 2 }, null, { v: '<span class="hnote">지난달 대비</span>', c: 'num' }] });
  const cs = Object.entries(st.cats).sort((a, b) => b[1] - a[1]), mx = cs[0]?.[1] || 1;
  for (const [k, v] of cs) rows.push({ n: n++, attr: k === '미분류' ? at('fixUncat') : at('goInput', { cat: k }), cells: [k === '미분류' ? '미분류 <span class="lab">정리 ›</span>' : catLbl(k), dbar(v / mx * 100, fmtU(v)), { v: arrow(v - (ps.cats[k] || 0), true), c: 'num' }] });
  if (!cs.length) rows.push({ n: n++, cells: [{ v: '지출 기록이 없어요', c: 'mut', cs: 3 }, null, null] });
  rows.push({ n: n++, cls: 'tot', cells: ['합계', { v: fmtU(st.exp), c: 'num' }, { v: arrow(st.exp - ps.exp, true), c: 'num' }] });
  const bud = S.cats.filter(c => c.k === 'exp' && +c.b > 0);
  if (bud.length) {
    rows.push({ n: n++, cls: 'sec', cells: [{ v: '예산', cs: 2 }, null, { v: '<span class="hnote">남은 금액</span>', c: 'num' }] });
    for (const c of bud) {
      const u = st.cats[c.n] || 0, p = u / c.b * 100, over = u > c.b;
      rows.push({ n: n++, attr: at('catEdit', { id: c.id }), cells: [catLbl(c.n), dbar(p, `${fmtU(u)} <span class="lab">/ ${fmtU(c.b)}</span>`, over ? 'var(--bar-over)' : p > 80 ? 'var(--bar-warn)' : 'var(--bar-good)'),
        { v: over ? `<span class="neg">${fmtU(u - c.b)} 초과</span>` : fmtU(c.b - u), c: 'num' }] });
    }
  }
  rows.push({ n: n++, cls: 'sec', cells: [{ v: '월별 추이<small>최근 6개월 총자산</small>', cs: 3 }, null, null] });
  const ms = []; for (let i = 5; i >= 0; i--) { const mm = addM(m, -i); if (mm >= ym(S.settings.start) || archOf(mm)) ms.push(mm); }
  rows.push({ n: n++, h: 66, cells: [{ v: spark(ms.map(mm => groups(endOf(mm)).total), '#217346', ms.map(mShort)), cs: 3 }, null, null] });
  rows.push({ n: n++, cells: [{ v: '월', c: 'h' }, { v: '총자산', c: 'h num' }, { v: '순수입', c: 'h num' }] });
  for (const mm of ms.slice(-3)) {
    const nt = mstats(mm).net;
    rows.push({ n: n++, cls: mm === m ? 'cur' : '', cells: [{ v: mShort(mm), c: mm === m ? 'b' : '' }, { v: fmtU(groups(endOf(mm)).total), c: 'num' + (mm === m ? ' b' : '') }, { v: (nt > 0 ? '+' : '') + fmtU(nt), c: 'num ' + (nt >= 0 ? 'pos' : 'neg') }] });
  }
  return { ...base, body: backupNudge() + table(cols, rows), items: [`${dLabel(mRange(m)[0])} ~ ${dLabel(E)}`] };
}

/* ----- 입력 ----- */
function periodRange() {
  const p = U.flt.p, m = U.month;
  if (p === 'month') return mRange(m);
  if (p === 'prev') return mRange(addM(m, -1));
  if (p === '3m') return [mRange(addM(m, -2))[0], mRange(m)[1]];
  return ['0000-01-01', '9999-12-31'];
}
const fltActive = () => U.flt.p !== 'month' || U.flt.t !== 'all' || U.flt.cats.length;
function inputRows() {
  const [s, e] = periodRange(), id = U.acct, st = S.settings.start;
  let L0 = led().filter(r => r.date >= s && r.date <= e);
  if (id) {
    L0 = L0.filter(r => r.acct === id || r.to === id);
    let b = s <= st ? (+A(id).start || 0) : balAt(id, addD(s, -1));
    L0 = L0.map(r => { if (r.date >= st) b += delta(r, id); return { ...r, _bal: b }; });
  }
  if (U.flt.t !== 'all') L0 = L0.filter(r => r.type === U.flt.t);
  if (U.flt.cats.length) L0 = L0.filter(r => U.flt.cats.includes(r.cat || '미분류'));
  if (U.q) { const q = U.q.toLowerCase(); L0 = L0.filter(r => [r.memo, r.cat, accName(r.acct), r.to ? accName(r.to) : ''].join(' ').toLowerCase().includes(q)); }
  if (U.sort === 'desc') L0.reverse();
  return L0;
}
const missing = r => !r.auto && (!(+r.amt) || (r.type === 'move' ? !r.to : !r.cat));
function cellHTML(r, k, acc) {
  const sign = acc ? delta(r, acc.id) : 0;
  switch (k) {
    case 'date': return r.auto ? '' : dLabel(r.date);
    case 'acct': return `<span class="chip-a" style="background:${A(r.acct) ? TYPES[A(r.acct).type].c : '#888'}1A;color:${A(r.acct) ? TYPES[A(r.acct).type].c : '#888'}">${esc(r.acct ? accName(r.acct) : '없음')}</span>`;
    case 'type': return r.auto ? '자동' : TXL[r.type];
    case 'amt': return r.amt ? (acc ? (sign > 0 ? '+' : '') + fmtU(r.amt) : (r.type === 'in' ? '+' : '') + fmtU(r.amt)) : '';
    case 'cat':
      if (r.auto === 'chg') return `<b class="chg">충전</b> ← ${esc(r.acct ? accName(r.acct) : '연결 없음')}`;
      if (r.auto === 'cb') return `<b class="cb">캐시백</b> ${esc(r.memo.replace('캐시백 ', ''))}`;
      if (r.type === 'move') return acc && r.to === acc.id ? `← ${esc(accName(r.acct))}` : (r.to ? `→ ${esc(accName(r.to))}` : '');
      return r.cat ? catLbl(r.cat) : '';
    case 'memo': return esc(r.memo || '');
    case 'bal': return fmtU(r._bal);
  }
  return '';
}
function vInput() {
  const acc = U.acct ? A(U.acct) : null;
  const showBal = acc && (acc.type === 'prepaid' || U.showBal);
  const C = acc
    ? [{ k: 'date', w: 15, l: '날짜' }, { k: 'type', w: 12, l: '구분' }, { k: 'amt', w: 22, l: '금액', n: 1 }, { k: 'cat', w: 29, l: '카테고리' }, showBal ? { k: 'bal', w: 22, l: '잔액', n: 1 } : { k: 'memo', w: 22, l: '메모' }]
    : [{ k: 'date', w: 14, l: '날짜' }, { k: 'acct', w: 23, l: '계좌' }, { k: 'type', w: 12, l: '구분' }, { k: 'amt', w: 21, l: '금액', n: 1 }, { k: 'cat', w: 30, l: '카테고리' }];
  const list = inputRows();
  const rows = [{ n: 1, cls: 'frz', cells: C.map(c => ({ v: c.l, c: 'h' + (c.n ? ' num' : '') })) }];
  const ROWNO = {};
  let n = 2, miss = 0, firstMiss = null;
  for (const r of list) {
    ROWNO[r.id] = n;
    const ms = missing(r); if (ms) { miss++; firstMiss ??= r.id; }
    const on = U.sel?.id === r.id;
    const cells = C.map(c => {
      const sel = on && U.sel.k === c.k;
      let cl = (c.n ? 'num ' : '') + (sel ? 'sel ' : '');
      if (c.k === 'amt' && !r.auto) cl += r.type === 'in' || (acc && delta(r, acc.id) > 0 && r.type === 'move') ? 'pos b ' : r.type === 'move' ? 'mut ' : 'b ';
      if (c.k === 'amt' && r.auto) cl += r.auto === 'chg' ? 'chg ' : r.auto === 'cb' ? 'cb ' : '';
      if (c.k === 'type' && r.type === 'in' && !r.auto) cl += 'pos ';
      if (c.k === 'type' && r.type === 'move') cl += 'mut ';
      if (c.k === 'date' && !r.auto) cl += 'mut ';
      if (c.k === 'memo' || c.k === 'bal') cl += 'mut ';
      if (ms && ((c.k === 'cat' && (r.type === 'move' ? !r.to : !r.cat)) || (c.k === 'amt' && !(+r.amt)))) cl += 'warn note ';
      return { v: cellHTML(r, c.k, acc), c: cl, at: at('cell', { id: r.id, k: c.k }), st: c.k === 'date' && r.tag ? `box-shadow:inset 4px 0 0 ${r.tag}` : '' };
    });
    rows.push({ n: n++, on, cls: r.auto ? 'auto' : '', rnA: at('row', { id: r.id }), cells });
  }
  for (let i = 0; i < 4; i++) rows.push({ n: n++, attr: at('newRow'), cells: C.map(() => '') });
  U.rowNo = ROWNO;
  // 선택한 계좌의 잔액은 상태 표시줄에 짧게
  let accLbl = '전체';
  if (acc) { const b = balAt(acc.id, TODAY()); accLbl = `${esc(acc.name)} · ${acc.type === 'card' && b < 0 ? `결제 예정 ${fmt(-b)}` : `잔액 ${fmt(b)}`}`; }
  const qbar = `<div class="qbar"><span class="f">fx</span><input id="qeDate" class="qd" data-i="qe" inputmode="numeric" autocomplete="off" value="${dLabel(defDate())}" placeholder="${dLabel(defDate())}" aria-label="날짜 (예: 10/14, 비우면 오늘)"><input id="qeIn" data-i="qe" enterkeyhint="done" autocomplete="off" placeholder="예: 커피 4500, 체크카드 점심 9000" aria-label="빠른 입력"></div><div class="qprev" id="qePrev"></div>`;
  // stats
  let o = 0, i2 = 0, cnt = 0; for (const r of list) { if (!acc) { if (r.type === 'out') o += r.amt; if (r.type === 'in') i2 += r.amt; } else { const d = delta(r, acc.id); if (d < 0) o -= d; else i2 += d; } cnt++; }
  const items = U.sel && rowById(U.sel.id) && U.sel.k === 'amt' ? [`선택: ${fmt(rowById(U.sel.id).amt)}`] : [`출금 ${fmtU(o)}`, `입금 ${fmtU(i2)}`, `${cnt}건`];
  // quick bar
  QS = quickList();
  const bottom = QS.length ? `<div class="quickbar">${QS.map((q, i) => `<button class="q"${at('quick', { i })}>${esc(q.memo || q.cat)}<small>${fmt(q.amt)}${acc ? '' : ' · ' + esc(accName(q.acct))}</small></button>`).join('')}</div>` : '';
  const periodLbl = { month: mLabel(U.month), prev: mLabel(addM(U.month, -1)), '3m': '최근 3개월', all: '전체 기간' }[U.flt.p];
  return {
    sub: '입력', tb: tb(acctPill(U.acct, 'filter'), sep,
      `<button class="t${fltActive() ? ' on' : ''}"${at('flt')} aria-label="필터">▽</button>`,
      `<button class="t${U.sort === 'desc' ? ' on' : ''}"${at('sort')} aria-label="정렬">⇅</button>`,
      `<button class="t${U.q ? ' on' : ''}"${at('search')} aria-label="검색">${ico('search', 19)}</button>`,
      acc && acc.type !== 'prepaid' ? `<button class="t txt${U.showBal ? ' on' : ''}"${at('bal')}>잔액</button>` : '',
      U.flt.p === 'month' ? `<div class="pill mini"><button class="ar"${at('mon', { k: -1 })} aria-label="이전 달">◀</button><span>${mShort(U.month)}</span><button class="ar"${at('mon', { k: 1 })} aria-label="다음 달">▶</button></div>` : `<span class="t txt" style="color:var(--muted)">${periodLbl}</span>`),
    qbar: S.accounts.length ? qbar : '', body: S.accounts.length ? recapCard() + table(C, rows) : noAccounts(), bottom,
    l: accLbl, items, err: miss ? `<button${at('fixMissing', { id: firstMiss })}>빈 칸 ${miss}개 채우기 ›</button>` : '',
    after: () => U.sel && scrollSel(),
  };
}
/* ---------- 지난달 결산 카드 (새 달 입력 탭 맨 위) ---------- */
function recapCard() {
  const cm = ym(TODAY()), pm = addM(cm, -1);
  if (U.month !== cm || U.flt.p !== 'month' || U.recapSeen === pm) return '';
  const st = mstats(pm); if (!st.inc && !st.exp) return '';
  const cs = Object.entries(st.cats).sort((a, b) => b[1] - a[1]).slice(0, 4), mx = cs[0]?.[1] || 1;
  let pl = 0, miss = 0, has = 0;
  for (const a of accts().filter(x => x.type === 'invest')) {
    const am = archOf(pm); if (am?.inv?.[a.id]) { if (am.inv[a.id].pl != null) { pl += am.inv[a.id].pl; has++; } continue; }
    const x = invSeries(a).find(y => y.m === pm); if (!x) continue;
    if (x.ent == null) miss++; else { pl += x.pl; has++; }
  }
  const inv = miss ? `<button class="link"${at('tab', { v: 'invest' })}>${mShort(pm)} 말 평가금액 입력이 ${miss}개 남았어요 ›</button>`
    : has ? `투자 수익 <b class="${pl >= 0 ? 'pos' : 'neg'}">${sgn(pl)}</b>` : '';
  return `<div class="recap"><div class="rh"><b>${mLabel(pm)} 결산</b><button class="x"${at('recapClose', { m: pm })}>닫기 ✕</button></div>
    <div class="rk"><div><span>수입</span><b class="pos">${fmt(st.inc)}</b></div><div><span>지출</span><b>${fmt(st.exp)}</b></div><div><span>순수입</span><b class="${st.net >= 0 ? 'pos' : 'neg'}">${sgn(st.net)}</b></div></div>
    ${cs.length ? `<div class="rc">${cs.map(([k, v]) => `<div class="rr"><span class="rn2">${catLbl(k)}</span><span class="rb"><i style="width:${v / mx * 100}%"></i></span><span class="rv">${fmt(v)}</span></div>`).join('')}</div>` : ''}
    ${inv ? `<div class="ri">${inv}</div>` : ''}
    <div class="rf"><button class="link"${at('recapMore', { m: pm })}>한눈에 보기에서 자세히 ›</button></div></div>`;
}

/* ---------- 오래된 거래 정리 (월 마감) ---------- */
function closeMonths() {
  const out = [], cm = ym(TODAY());
  for (let m = ym(S.settings.start), g = 0; m < cm && g < 600; m = addM(m, 1), g++) {
    const e = mRange(m)[1]; out.push([m, S.tx.filter(t => t.date <= e && t.date >= S.settings.start).length]);
  }
  return out;
}
function doClose(M) {
  const C = mRange(M)[1], ns = addD(C, 1);
  if (C < S.settings.start) return toast('이미 정리된 달이에요');
  if (M >= ym(TODAY())) return toast('이번 달은 정리할 수 없어요');
  const st0 = S.settings.start;
  commit(() => {
    // 1) 달별 요약 저장 (지우기 전 데이터로 계산)
    for (let m = ym(st0), g = 0; m <= M && g < 600; m = addM(m, 1), g++) {
      const [s, e] = mRange(m), stt = mstats(m), gg = groups(endOf(m)), inv = {};
      let isa = 0;
      for (const a of S.accounts.filter(x => x.type === 'invest')) { const x = invSeries(a).find(y => y.m === m); if (x) inv[a.id] = { v: x.v, pl: x.pl, c: x.c }; }
      for (const a of S.accounts.filter(x => x.isa)) for (const r of led()) { if (r.date < s || r.date > e || r.date < st0) continue; if ((r.type === 'move' && r.to === a.id) || (r.type === 'in' && r.acct === a.id)) isa += r.amt; }
      S.arch[m] = { inc: stt.inc, exp: stt.exp, cats: stt.cats, g: { cash: gg.cash, invest: gg.invest, foreign: gg.foreign, total: gg.total }, inv, isa, n: S.tx.filter(t => t.date >= s && t.date <= e).length, u: now() };
    }
    // 2) 정리 시점 잔액·투자 원금을 새 시작값으로
    const nb = {};
    for (const a of S.accounts) {
      if (a.type === 'invest') { const x = invSeries(a).filter(y => y.m <= M).pop(); if (x) nb[a.id] = { start: x.v, prin: x.prin }; }
      else if (a.type !== 'foreign') nb[a.id] = { start: balAt(a.id, C) };
    }
    for (const a of S.accounts) if (nb[a.id]) { Object.assign(a, nb[a.id]); touch(a); }
    // 3) 그 달까지의 거래 삭제
    const gone = new Set(S.tx.filter(t => t.date <= C).map(t => t.id)), t = now();
    S.tx = S.tx.filter(x => !gone.has(x.id)); for (const id of gone) S.del[id] = t;
    S.settings = { ...S.settings, start: ns, u: now() };
  });
  hist.length = 0; fut.length = 0; render();
  toast(`${mLabel(M)}까지 정리했어요 · 요약만 남았어요`);
}
/* ---------- 빠른 입력 (수식 입력줄 자리) ---------- */
const QE = { focus: false };
const KW = [[/커피|카페|스벅|스타벅스|디저트|빵|케이크|음료/, '커피·디저트'], [/점심|저녁|아침|식당|밥|마트|장보기|편의점|배달|식비|반찬|간식/, '식비·생활'],
  [/버스|지하철|택시|기차|ktx|srt|주유|교통|주차/i, '교통'], [/관리비|전기|가스|수도|월세|통신|공과금|인터넷/, '주거·공과금'], [/쿠팡|옷|쇼핑|온라인|다이소/, '쇼핑'],
  [/넷플릭스|유튜브|구독|멜론|icloud|애플뮤직|티빙|웨이브/i, '구독료'], [/영화|공연|여행|게임|여가|노래방|헬스/, '여가'], [/선물|경조사|축의|조의|모임|회비/, '사람'],
  [/월급|급여|보너스|상여/, '월급'], [/캐시백|환급|이자|용돈|중고/, '기타수입']];
const escRe = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function parseQuick(text) {
  let t = ' ' + String(text || '').replace(/\s+/g, ' ').trim() + ' ';
  if (!t.trim()) return null;
  const o = { date: defDate(), acct: '', type: 'out', amt: 0, ex: '', cat: '', to: '', memo: '' };
  const findAcct = str => { let best = null; const l = str.toLowerCase(); for (const a of accts()) { const nm = a.name.toLowerCase(); if (nm && l.includes(nm) && (!best || nm.length > best.name.length)) best = a; } return best; };
  const cut = (str, name) => str.replace(new RegExp(escRe(name), 'i'), ' ');
  const mv = t.split(/→|->|＞|>/);
  // 이름 일부만 쓴 경우 (예: '동백' → 동백전) — 계좌 하나로 정해질 때만
  const norm = x => x.toLowerCase().replace(/\s+/g, '');
  const partial = (str, ex) => { for (const tk of str.trim().split(' ')) {
    if (tk.length < 2 || /\d/.test(tk) || S.cats.some(c => c.n === tk) || ['오늘', '어제', '그제', '그저께'].includes(tk)) continue;
    const hit = accts().filter(x => x.id !== ex && norm(x.name).includes(norm(tk)));
    if (hit.length === 1) return [hit[0], tk];
  } return null; };
  if (mv.length === 2) {
    let b = findAcct(mv[1]), part = mv[1];
    if (b) part = cut(mv[1], b.name); else { const p = partial(mv[1]); if (p) { b = p[0]; part = (' ' + mv[1] + ' ').replace(' ' + p[1] + ' ', ' '); } }
    if (b) { o.type = 'move'; o.to = b.id; t = mv[0] + ' ' + part + ' '; }
  }
  const a = findAcct(t); if (a && a.id !== o.to) { o.acct = a.id; t = cut(t, a.name); }
  if (!o.acct) { const p = partial(t, o.to); if (p) { o.acct = p[0].id; t = t.replace(' ' + p[1] + ' ', ' '); } }
  o.given = !!o.acct;
  const dw = [['그저께', -2], ['그제', -2], ['어제', -1], ['오늘', 0]];
  for (const [w, k] of dw) if (t.includes(' ' + w + ' ')) { o.date = addD(TODAY(), k); o.dateGiven = true; t = t.replace(' ' + w + ' ', ' '); break; }
  const dm = t.match(/\s(\d{1,2})[/.](\d{1,2})\s/);
  if (dm) { const d = `${TODAY().slice(0, 4)}-${pad2(dm[1])}-${pad2(dm[2])}`; if (isDate(d) && !isNaN(new Date(d))) { o.date = d; o.dateGiven = true; t = t.replace(dm[0], ' '); } }
  const rest = [];
  for (const tk of t.trim().split(' ').filter(Boolean)) {
    if (!o.amt) {
      const m = tk.match(/^([+＋])?(\d[\d,.]*(?:[+\-×÷*/x]\d[\d,.]*)*)(만|천)?원?$/);
      if (m) {
        const ex = m[2].replace(/x/g, '×'); let v = calc(ex);
        if (v != null && v !== 0) {
          if (m[3] === '만') v *= 10000; if (m[3] === '천') v *= 1000;
          o.amt = Math.round(Math.abs(v));
          if (/[+\-×÷*/]/.test(ex)) o.ex = ex.replace(/\*/g, '×').replace(/\//g, '÷');
          if (m[1] && o.type !== 'move') o.type = 'in';
          continue;
        }
      }
    }
    rest.push(tk);
  }
  if (o.type !== 'move') {
    const kind = () => o.type === 'in' ? 'inc' : 'exp';
    const ci = rest.findIndex(tk => tk.length >= 2 && S.cats.some(c => c.n === tk || c.n.startsWith(tk)));
    if (ci >= 0) { const c = S.cats.find(c => c.n === rest[ci]) || S.cats.find(c => c.n.startsWith(rest[ci])); o.cat = c.n; if (c.k === 'inc') o.type = 'in'; if (c.n === rest[ci]) rest.splice(ci, 1); }
    const memo = rest.join(' ');
    if (!o.cat && memo) { const g = guessCat(memo, o.type) || guessCat(memo, 'in'); if (g) { o.cat = g; if (catOf(g)?.k === 'inc') o.type = 'in'; } }
    if (!o.acct && !U.acct && memo) for (let i = S.tx.length - 1; i >= 0; i--) if (S.tx[i].memo === memo && A(S.tx[i].acct)) { o.acct = S.tx[i].acct; break; } // 같은 메모를 쓴 계좌를 기본으로
    if (o.cat && catOf(o.cat) && catOf(o.cat).k !== kind()) o.cat = '';
  }
  o.memo = rest.join(' ').slice(0, 60);
  if (!o.acct) o.acct = U.acct || lastAcct() || '';
  if (o.type === 'move' && o.acct === o.to) o.acct = accts().find(x => x.id !== o.to && x.type !== 'invest' && x.type !== 'foreign')?.id || '';
  return o;
}
function quickPreview(o) {
  if (!o) return '';
  const parts = [!U.acct && !o.given ? '<span class="neg b">계좌 이름도 적어 주세요</span>' : `<b>${esc(o.acct ? accName(o.acct) : '계좌 없음')}</b>`, `${TXL[o.type]} <b>${o.amt ? fmt(o.amt) : '금액?'}</b>`];
  if (o.type === 'move') parts.push(`→ <b>${esc(accName(o.to))}</b>`);
  else parts.push(o.cat ? `${catLbl(o.cat)}` : '<span class="neg">카테고리 빈 칸</span>');
  parts.push(o.date === TODAY() ? '오늘' : dLabel(o.date));
  if (o.memo) parts.push(`"${esc(o.memo)}"`);
  return '↳ ' + parts.join(' · ') + ' <span style="color:var(--muted)">· Enter로 추가</span>';
}
// 날짜 칸: 비우면 오늘(보는 달 기준), 10/14 · 14 · 1014 · 2026-10-14
function qDate(v) {
  v = String(v ?? '').trim(); if (!v) return defDate();
  const base = U.month; let m;
  if (isDate(v)) return v;
  if ((m = v.match(/^(\d{1,2})[/.\-\s](\d{1,2})$/)) || (m = v.match(/^(\d{2})(\d{2})$/))) {
    let y = +TODAY().slice(0, 4); if (`${y}-${pad2(m[1])}` > ym(TODAY())) y--;
    const d = `${y}-${pad2(m[1])}-${pad2(m[2])}`; return +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= lastDay(ym(d)) ? d : null;
  }
  if ((m = v.match(/^(\d{1,2})$/))) return +m[1] >= 1 && +m[1] <= lastDay(base) ? `${base}-${pad2(m[1])}` : null;
  return null;
}
function qeParse() {
  const o = parseQuick($('#qeIn')?.value || ''); if (!o) return null;
  if (!o.dateGiven) { const d = qDate($('#qeDate')?.value); if (d) o.date = d; else o.badDate = true; }
  return o;
}
function qeInput() { const p = $('#qePrev'); if (!p) return; const o = qeParse(); p.innerHTML = quickPreview(o) + (o?.badDate ? ' <span class="neg">· 날짜를 확인하세요 (예: 10/14)</span>' : ''); p.classList.toggle('on', !!o); }
function qeAdd() {
  const el = $('#qeIn'); if (!el) return;
  const o = qeParse();
  if (!o) { el.focus(); return toast('예: 체크카드 커피 4500 · 어제 버스 1500 · +2850000 월급'); }
  if (o.badDate) return toast('날짜를 확인하세요 (예: 10/14, 비우면 오늘)');
  if (!o.amt) return toast('금액을 넣어 주세요 (예: 4500, 1.5만)');
  if (!accts().length) return toast('설정 탭에서 계좌를 먼저 추가하세요');
  const finish = acct => {
    const t = touch({ id: uid(), date: o.date, acct, type: o.type, amt: o.amt, ex: o.ex, cat: o.cat, to: o.to, memo: o.memo });
    const moved = !U.acct;
    if (moved) U.acct = acct;   // 전체 계좌에서 입력하면 그 계좌 화면으로
    if (U.flt.t !== 'all' || U.flt.cats.length || U.q) { U.flt = { ...U.flt, t: 'all', cats: [] }; U.q = ''; }
    if (ym(o.date) !== U.month && U.flt.p !== 'all') U.month = ym(o.date);
    U.sel = { id: t.id, k: 'amt' }; QE.focus = true;
    commit(() => S.tx.push(t)); scrollSel();
    toast(`추가했어요 · ${o.memo || o.cat || TXL[o.type]} ${fmt(o.amt)}${moved ? ` · ${accName(acct)} 화면으로 이동` : ''}${o.type !== 'move' && !o.cat ? ' (카테고리 빈 칸)' : ''}`);
  };
  if (!U.acct && !o.given) {
    el.blur();
    return pickAcct({ title: '어느 계좌인가요?', sub: o.type === 'move' ? '보내는 계좌' : '고르면 그 계좌 화면으로 넘어가요', cur: o.acct, exclude: o.to, onPick: v => v && finish(v) });
  }
  if (!o.acct) return toast('계좌를 찾지 못했어요');
  finish(o.acct);
}

let QS = [];
function quickList() {
  const m = new Map();
  const src = S.tx.filter(t => +t.amt && (t.type === 'move' ? t.to : t.cat) && (!U.acct || t.acct === U.acct)).slice(-200);
  for (const t of src) { const k = [t.acct, t.type, t.cat, t.to, t.memo, t.amt].join('|'); const x = m.get(k) || { ...t, n: 0, last: 0 }; x.n++; x.last = Math.max(x.last, t.u || 0); m.set(k, x); }
  return [...m.values()].sort((a, b) => b.n - a.n || b.last - a.last).slice(0, 4);
}
function payInfo(a) {
  if (!(+a.payDay)) return null;
  const t = TODAY(); let m = ym(t); let d = `${m}-${pad2(Math.min(+a.payDay, lastDay(m)))}`;
  if (d < t) { m = addM(m, 1); d = `${m}-${pad2(Math.min(+a.payDay, lastDay(m)))}`; }
  const n = Math.round((new Date(d) - new Date(t)) / 864e5);
  return { date: d, n, label: `${dLabel(d)} 결제 · ${n ? 'D-' + n : 'D-day'}` };
}

/* ----- 계좌별 ----- */
function vAccts() {
  if (U.detail && A(U.detail)) return vDetail(A(U.detail));
  const base = { sub: '계좌별', tb: tb(monthPill()) };
  if (!S.accounts.length) return { ...base, body: noAccounts() };
  const m = U.month, E = endOf(m), [s] = mRange(m), pm = addM(m, -1), cur = m === ym(TODAY());
  const chOf = a => a.type === 'invest' ? invAt(a, m) - invAt(a, pm) : a.type === 'foreign' ? null : flow(a.id, s, E);
  const chTxt = (c, pre = '') => c == null ? '' : `<span class="${c > 0 ? 'pos' : c < 0 ? 'neg' : 'mut'}">${pre}${c ? sgn(c) : '변화 없음'}</span>`;
  const sub = (a, v) => {
    if (a.type === 'card') { const pd = payInfo(a); return v < 0 ? `결제 예정${pd ? ' · ' + pd.label : ''}` : '카드'; }
    if (a.type === 'prepaid') return `충전식 · ← ${a.link ? esc(accName(a.link)) : '연결 계좌 없음'}`;
    if (a.type === 'saving') return a.mat ? `적금 · 만기 ${a.mat}` : '적금';
    if (a.type === 'invest') { const x = invSeries(a).filter(y => y.m <= m).pop(); return `${a.isa ? 'ISA · ' : '투자 · '}누적 ${x ? (x.rate >= 0 ? '+' : '') + (x.rate * 100).toFixed(1) : '0.0'}%`; }
    if (a.type === 'foreign') return `${(+a.famt || 0).toLocaleString('ko-KR')} ${esc(a.cur || '')}${fxRate(a) ? ' · 환율 ' + fxRate(a).toFixed(2) : ''}`;
    return '입출금';
  };
  const cols = [{ w: 54 }, { w: 40, on: 1 }, { w: 6 }];
  const rows = []; let n = 1, tot = 0, totc = 0, cnt = 0;
  const seg = [];
  for (const ty of TORD) {
    const xs = accts().filter(a => a.type === ty); if (!xs.length) continue;
    const vs = xs.map(a => [a, valueAt(a, E), chOf(a)]);
    const sum = vs.reduce((x, y) => x + y[1], 0), sc = vs.reduce((x, y) => x + (y[2] || 0), 0);
    tot += sum; totc += sc; cnt += xs.length; seg.push([ty, sum]);
    const cl = U.col[ty];
    rows.push({ n: n++, cls: 'grp2', attr: at('col', { v: ty }), cells: [
      { v: `<span class="chev">${cl ? '▸' : '▾'}</span><span class="gb" style="background:${TYPES[ty].c}"></span>${TYPES[ty].l}<span class="gn">${xs.length}개</span>` },
      { v: fmtU(sum), c: 'num' + (sum < 0 ? ' neg' : '') }, { v: '', c: 'chevc' }] });
    if (cl) continue;
    for (const [a, v, c] of vs) rows.push({ n: n++, cls: 'acct2', attr: at('detail', { v: a.id }), cells: [
      { v: `<div class="an">${esc(a.name)}${a.fav ? ' <span class="star">★</span>' : ''}</div><div class="as">${sub(a, v)}</div>` },
      { v: `<div class="av${v < 0 ? ' neg' : ''}">${fmtU(v)}</div><div class="ac">${chTxt(c, cur ? '이번 달 ' : mShort(m) + ' ')}</div>`, c: 'num' },
      { v: '›', c: 'chevc' }] });
  }
  rows.push({ n: n++, cls: 'tot', cells: ['총자산', { v: fmtU(tot), c: 'num' }, { v: '', c: 'chevc' }] });
  const pos = seg.reduce((x, y) => x + Math.max(0, y[1]), 0) || 1;
  const top = `<div class="asum"><div class="l">총자산 · ${+E.slice(5, 7)}월 ${+E.slice(8)}일 기준</div>
    <div class="v">${fmtU(tot)}${U.unit === 'man' ? '' : '<small>원</small>'}</div>
    <div class="c">${chTxt(totc, cur ? '이번 달 ' : mShort(m) + ' ')}</div>
    <div class="stk">${seg.map(([ty, v]) => `<i style="width:${Math.max(0, v) / pos * 100}%;background:${TYPES[ty].c}"></i>`).join('')}</div>
    <div class="leg">${seg.filter(([, v]) => pct(Math.max(0, v), pos) > 0).map(([ty, v]) => `<span><span class="lg" style="background:${TYPES[ty].c}"></span>${TYPES[ty].l} ${pct(Math.max(0, v), pos)}%</span>`).join('')}</div></div>`;
  return { ...base, body: top + table(cols, rows), l: `계좌 ${cnt}개` };
}
function heroCard(a, title, right, value, subs) {
  const c = TYPES[a.type].c;
  return `<div class="acard" style="background:linear-gradient(135deg,${c},${shade(c)});box-shadow:0 4px 12px ${c}40"><div class="t"><span>${esc(a.name)} · ${title}</span><span>${right}</span></div>
    <div class="v">${value}</div><div class="s">${subs.map(x => `<span>${x}</span>`).join('')}</div></div>`;
}
function shade(hex) { const n = parseInt(hex.slice(1), 16), f = .78; return `rgb(${Math.round((n >> 16) * f)},${Math.round((n >> 8 & 255) * f)},${Math.round((n & 255) * f)})`; }
function vDetail(a) {
  const m = U.month, E = endOf(m), [s] = mRange(m), pm = addM(m, -1);
  const cur = m === ym(TODAY()), day = cur ? +TODAY().slice(8) : lastDay(m);
  const [ps] = mRange(pm), pe = `${pm}-${pad2(Math.min(day, lastDay(pm)))}`;
  const st = aStats(a.id, s, E), pst = aStats(a.id, ps, pe);
  const base = { sub: '계좌별', tb: tb(acctPill(a.id, 'detail'), sep, monthPill()), l: `<button${at('back')}>◀ 계좌별</button>` };
  const cols = [{ w: 38 }, { w: 33, on: 1 }, { w: 29 }];
  const rows = []; let n = 1;
  const link = (t, act, d) => rows.push({ n: n++, attr: at(act, d), cells: [{ v: `<span class="link">${t}</span>`, cs: 3 }, null, null] });
  const catRows = (obj, prevObj, goodDown = true) => {
    const cs = Object.entries(obj).sort((x, y) => y[1] - x[1]), tot = cs.reduce((x, y) => x + y[1], 0) || 1, mx = cs[0]?.[1] || 1;
    for (const [k, v] of cs) rows.push({ n: n++, attr: at('goInput', { acct: a.id, cat: k }), cells: [`${catLbl(k)}`, dbar(v / mx * 100, `${fmtU(v)} <span class="lab">${pct(v, tot)}%</span>`), { v: arrow(v - (prevObj[k] || 0), goodDown), c: 'num' }] });
    if (!cs.length) rows.push({ n: n++, cells: [{ v: '기록이 없어요', c: 'mut', cs: 3 }, null, null] });
  };
  const head = (t1, t2, t3) => rows.push({ n: n++, cls: 'frz', cells: [{ v: t1, c: 'h' }, { v: t2, c: 'h num' }, { v: t3, c: 'h num' }] });
  const sec = (t, small = '') => rows.push({ n: n++, cls: 'sec', cells: [{ v: `${t}${small ? `<small>${small}</small>` : ''}`, cs: 3 }, null, null] });
  const cmp = () => {
    sec('지난달 같은 기간과 비교', `1일 ~ ${day}일`);
    const mx = Math.max(st.out, pst.out) || 1;
    rows.push({ n: n++, cells: [{ v: cur ? '이번 달' : mShort(m), c: 'b' }, { ...dbar(st.out / mx * 100, fmtU(st.out), 'var(--bar-good)'), cs: 2 }, null] });
    rows.push({ n: n++, cells: [{ v: mShort(pm), c: 'mut' }, { ...dbar(pst.out / mx * 100, fmtU(pst.out), 'var(--bar-prev)'), c: 'dbar num', cs: 2 }, null] });
    const d = st.out - pst.out;
    rows.push({ n: n++, cells: [{ v: `<span class="arr ${d <= 0 ? 'good' : 'bad'} b">${fmt(Math.abs(d))}원 ${d <= 0 ? '덜' : '더'} 썼어요</span> <span class="lab">· 하루 평균 ${fmt(st.out / day)}원</span>`, cs: 3 }, null, null] });
  };
  let top = '', l2 = [];
  const b = valueAt(a, E);
  if (a.type === 'card') {
    const pd = payInfo(a);
    top = heroCard(a, b < 0 ? '결제 예정' : '잔액', pd ? pd.label : '', `${fmt(Math.abs(b))}원`, [`${cur ? '이번 달' : mShort(m)} 출금 <b>${fmt(st.out)}</b>`, `입금 <b>${fmt(st.inc + Object.values(st.mIn).reduce((x, y) => x + y, 0))}</b>`, `${st.n}건`]);
    head('카테고리', '금액 · 비중', '지난달 대비'); catRows(st.outCat, pst.outCat);
    rows.push({ n: n++, cls: 'tot', cells: ['합계', { v: fmtU(st.out), c: 'num' }, { v: arrow(st.out - pst.out, true), c: 'num' }] });
    cmp();
  } else if (a.type === 'prepaid') {
    top = heroCard(a, '잔액', `충전식 · ← ${esc(a.link ? accName(a.link) : '연결 없음')}`, `${fmt(b)}원`, [`사용 <b>${fmt(st.out)}</b>`, `충전 <b>${st.chgN}회</b>`, `캐시백 <b>+${fmt(st.cb)}</b>`]);
    head('카테고리', '금액 · 비중', '지난달 대비'); catRows(st.outCat, pst.outCat);
    rows.push({ n: n++, cls: 'tot', cells: ['사용 합계', { v: fmtU(st.out), c: 'num' }, { v: arrow(st.out - pst.out, true), c: 'num' }] });
    sec('충전 · 캐시백', cur ? '이번 달' : mShort(m));
    rows.push({ n: n++, cells: ['자동 충전', { v: fmtU(st.chg), c: 'num chg' }, { v: `${st.chgN}회`, c: 'num mut' }] });
    rows.push({ n: n++, cells: [{ v: `&nbsp;&nbsp;← ${esc(a.link ? accName(a.link) : '연결 계좌 없음')}`, c: 'mut' }, '', ''] });
    rows.push({ n: n++, cells: [`캐시백 ${+a.cbp || 0}%`, { v: '+' + fmtU(st.cb), c: 'num cb' }, { v: '수입으로 기록', c: 'num mut' }] });
    rows.push({ n: n++, cls: 'tot', cells: ['실제 부담', { v: fmtU(st.out - st.cb), c: 'num' }, { v: '사용 − 캐시백', c: 'num mut' }] });
    l2 = [`다음 충전까지 ${fmt(Math.max(0, balAt(a.id, TODAY()) - (+a.th || 0)))} 남음`];
  } else if (a.type === 'bank') {
    const fl = flow(a.id, s, E);
    top = heroCard(a, '잔액', TYPES[a.type].l, `${fmt(b)}원`, [`${cur ? '이번 달' : mShort(m)} <b>${sgn(fl)}</b>`, `입금 <b>${fmt(st.inc + Object.values(st.mIn).reduce((x, y) => x + y, 0))}</b>`, `출금 <b>${fmt(st.out + Object.values(st.mOut).reduce((x, y) => x + y, 0))}</b>`]);
    head('카테고리', '금액', '지난달 대비');
    const inObj = { ...st.inCat }; for (const [k, v] of Object.entries(st.mIn)) inObj['← ' + accName(k)] = v;
    const pin = { ...pst.inCat }; for (const [k, v] of Object.entries(pst.mIn)) pin['← ' + accName(k)] = v;
    const outObj = { ...st.outCat }; for (const [k, v] of Object.entries(st.mOut)) outObj['→ ' + accName(k)] = v;
    const pout = { ...pst.outCat }; for (const [k, v] of Object.entries(pst.mOut)) pout['→ ' + accName(k)] = v;
    const ti = Object.values(inObj).reduce((x, y) => x + y, 0), to = Object.values(outObj).reduce((x, y) => x + y, 0);
    sec('들어온 돈', '+' + fmt(ti));
    const lines = (obj, prev, good, color) => { const cs = Object.entries(obj).sort((x, y) => y[1] - x[1]), mx = cs[0]?.[1] || 1; if (!cs.length) rows.push({ n: n++, cells: [{ v: '없음', c: 'mut', cs: 3 }, null, null] }); for (const [k, v] of cs) rows.push({ n: n++, cells: [`${k.startsWith('←') || k.startsWith('→') ? esc(k) : catLbl(k)}`, dbar(v / mx * 100, fmtU(v), color), { v: arrow(v - (prev[k] || 0), good), c: 'num' }] }); };
    lines(inObj, pin, false, 'var(--bar-good)');
    sec('출금 및 이동', '-' + fmt(to));
    lines(outObj, pout, true);
    rows.push({ n: n++, cls: 'tot', cells: ['잔액', { v: fmtU(b), c: 'num' }, { v: sgn(fl), c: 'num ' + (fl >= 0 ? 'pos' : 'neg') }] });
    if (to) {
      const parts = Object.entries(outObj).sort((x, y) => y[1] - x[1]); const pal = ['#C98A00', '#2E8B57', '#3D5A80', '#9AA5B1']; const top3 = parts.slice(0, 3); const rest = parts.slice(3).reduce((x, y) => x + y[1], 0); if (rest) top3.push(['기타', rest]);
      sec('돈이 어디로 갔나', '출금 및 이동 기준');
      rows.push({ n: n++, h: 40, cells: [{ v: `<div class="stk" style="height:18px">${top3.map(([, v], i) => `<i style="width:${v / to * 100}%;background:${pal[i]}"></i>`).join('')}</div>`, cs: 3 }, null, null] });
      rows.push({ n: n++, cells: [{ v: top3.map(([k, v], i) => `<span class="lg" style="background:${pal[i]}"></span>${esc(k.replace(/^→ /, ''))} ${pct(v, to)}%`).join(' &nbsp; '), c: 'mut wrap', cs: 3 }, null, null] });
    }
  } else if (a.type === 'saving') {
    const pd = a.mat ? Math.ceil((new Date(a.mat) - new Date(TODAY())) / 864e5) : null;
    top = heroCard(a, '잔액', a.mat ? `만기 ${a.mat}` : '적금', `${fmt(b)}원`, [`${cur ? '이번 달' : mShort(m)} 납입 <b>${fmt(flow(a.id, s, E))}</b>`, pd != null ? (pd > 0 ? `만기까지 <b>${Math.floor(pd / 30.4)}개월</b>` : '<b>만기</b>') : '']);
    head('월', '납입', '월말 잔액');
    const sm = ym(S.settings.start); for (let mm = sm, g = 0; mm <= ym(TODAY()) && g < 120; mm = addM(mm, 1), g++) { const [x, y] = mRange(mm); rows.push({ n: n++, cls: mm === m ? 'cur' : '', cells: [mShort(mm), { v: fmt(flow(a.id, x, y)), c: 'num' }, { v: fmt(balAt(a.id, endOf(mm))), c: 'num' }] }); }
  } else if (a.type === 'invest') {
    const ser = invSeries(a), last = ser[ser.length - 1] || { v: +a.start || 0, prin: +a.start || 0 };
    const v = invAt(a, m), prin = ser.find(x => x.m === m)?.prin ?? last.prin, prof = v - prin;
    top = heroCard(a, '평가금액', `${mShort(m)} 기준`, `${fmt(v)}원`, [`넣은 돈 <b>${fmt(prin)}</b>`, `누적 수익 <b>${sgn(prof)} (${prin ? (prof / prin * 100).toFixed(1) : '0.0'}%)</b>`]);
    head('월', '월말 평가금액', '이번 달 수익');
    for (const x of ser.slice(-6)) rows.push({ n: n++, cls: x.m === ym(TODAY()) ? 'cur' : '', attr: at('val', { id: a.id, m: x.m }), cells: [{ v: mShort(x.m), c: x.m === ym(TODAY()) ? 'b' : '' }, { v: x.ent != null ? fmt(x.v) : '입력 전', c: 'num' + (x.ent != null ? '' : ' ph') }, { v: x.pl != null ? sgn(x.pl) : '—', c: 'num ' + (x.pl > 0 ? 'pos' : x.pl < 0 ? 'neg' : 'mut') }] });
    rows.push({ n: n++, h: 66, cells: [{ v: spark(ser.slice(-6).map(x => x.v), TYPES.invest.c, ser.slice(-6).map(x => mShort(x.m))), cs: 3 }, null, null] });
    if (a.isa) isaRows(rows, () => n++);
    link('투자 탭에서 평가금액 입력 ›', 'tab', { v: 'invest' });
  } else if (a.type === 'foreign') {
    top = heroCard(a, '원화 환산', a.cur || '', `${fmt(fxVal(a))}원`, [`보유 <b>${(+a.famt || 0).toLocaleString('ko-KR')} ${esc(a.cur || '')}</b>`, `환율 <b>${fxRate(a) ? fxRate(a).toFixed(2) : '없음'}</b>`]);
    head('항목', '값', '');
    rows.push({ n: n++, cells: ['보유 외화', { v: (+a.famt || 0).toLocaleString('ko-KR') + ' ' + esc(a.cur || ''), c: 'num' }, ''] });
    rows.push({ n: n++, cells: ['환율', { v: fxRate(a) ? fxRate(a).toFixed(4) : '없음', c: 'num' }, { v: a.rate ? '직접 입력' : S.fx.at ? `${dLabel(S.fx.at)} 기준` : '', c: 'num mut' }] });
    link('설정에서 수정 ›', 'acctEdit', { id: a.id });
    link('환율 새로고침 ›', 'fxRefresh', {});
  }
  if (a.type !== 'invest' && a.type !== 'foreign') link(`거래 ${st.n}건 보기 · 입력 탭 ›`, 'goInput', { acct: a.id });
  if (a.type === 'card' && st.maxDay) l2 = [`가장 많이 쓴 날 ${dLabel(st.maxDay[0])} · ${fmt(st.maxDay[1])}`];
  return { ...base, top, body: table(cols, rows), items: l2 };
}
function isaRows(rows, nn) {
  const y = TODAY().slice(0, 4), lim = +S.settings.isaLimit || 20000000; let paid = 0;
  for (const a of S.accounts.filter(x => x.isa)) for (const r of led()) { if (r.date.slice(0, 4) !== y || r.date < S.settings.start) continue; if ((r.type === 'move' && r.to === a.id) || (r.type === 'in' && r.acct === a.id)) paid += r.amt; }
  for (const [m, x] of Object.entries(S.arch || {})) if (x && !x.del && m.startsWith(y)) paid += x.isa || 0;
  rows.push({ n: nn(), cls: 'sec', cells: [{ v: `올해 ISA 납입 한도<small>연 ${fmt(lim / 10000)}만 원</small>`, cs: 3 }, null, null] });
  rows.push({ n: nn(), h: 40, cells: [{ v: `<div class="stk" style="height:18px"><i style="width:${Math.min(100, paid / lim * 100)}%;background:${TYPES.invest.c}"></i></div>`, cs: 3 }, null, null] });
  rows.push({ n: nn(), cells: ['납입', { v: fmt(paid), c: 'num b' }, { v: `남음 ${fmt(Math.max(0, lim - paid))}`, c: 'num mut' }] });
}

/* ----- 투자 ----- */
function vInvest() {
  const inv = accts().filter(a => a.type === 'invest'), fo = accts().filter(a => a.type === 'foreign');
  const base = { sub: '투자', tb: tb(`<button class="t"${at('fxRefresh')} aria-label="환율 새로고침" title="환율 새로고침">${ico('fx', 19)}</button>`), l: '월말 평가금액만 입력' };
  if (!inv.length && !fo.length) return { ...base, body: `<div class="empty">투자·해외 계좌가 없어요.<br>설정 탭에서 종류를 '투자' 또는 '해외'로 추가하세요.<br><br><button class="btn pri"${at('goSetAcct')}>계좌 추가하기</button></div>` };
  const cols = [{ w: 15 }, { w: 22 }, { w: 25, on: 1 }, { w: 21 }, { w: 17 }];
  const rows = []; let n = 1;
  rows.push({ n: n++, cls: 'frz', cells: [{ v: '월', c: 'sub' }, { v: '넣은 돈', c: 'sub num' }, { v: '월말 평가', c: 'sub num' }, { v: '수익', c: 'sub num' }, { v: '수익률', c: 'sub num' }] });
  if (inv.some(a => a.isa)) {
    const tmp = []; isaRows(tmp, () => 0);
    rows.push({ n: n++, cls: 'sec', cells: [{ v: tmp[0].cells[0].v, cs: 5 }, null, null, null, null] });
    rows.push({ n: n++, h: 40, cells: [{ v: tmp[1].cells[0].v, cs: 5 }, null, null, null, null] });
    rows.push({ n: n++, cells: [{ v: '납입', cs: 2 }, null, { v: tmp[2].cells[1].v, c: 'num b' }, { v: tmp[2].cells[2].v, c: 'num mut', cs: 2 }, null] });
  }
  let todo = 0;
  for (const a of inv) {
    const ser = invSeries(a), last = ser[ser.length - 1];
    rows.push({ n: n++, attr: at('detail2', { v: a.id }), cells: [{ v: '', c: '' }, { v: `${esc(a.name)}${last ? `<span style="font-weight:400;opacity:.85;margin-left:8px">${last.rate >= 0 ? '+' : ''}${(last.rate * 100).toFixed(1)}%</span>` : ''}`, c: 'h', cs: 4 }, null, null, null] });
    for (const x of ser) {
      const isCur = x.m === ym(TODAY());
      if (x.ent == null && !isCur) todo++;
      rows.push({ n: n++, cls: isCur ? 'cur' : '', cells: [{ v: mShort(x.m) + (x.m.slice(0, 4) !== TODAY().slice(0, 4) ? `<span class="lab">${x.m.slice(2, 4)}</span>` : ''), c: isCur ? 'b' : '' }, { v: fmtU(x.c), c: 'num' },
        { v: x.ent != null ? fmtU(x.v) : '탭해서 입력', c: 'num ' + (x.ent != null ? '' : 'ph' + (isCur ? '' : ' warn')), at: at('val', { id: a.id, m: x.m }) },
        { v: x.pl != null ? sgn(x.pl) : '', c: 'num ' + (x.pl > 0 ? 'pos' : x.pl < 0 ? 'neg' : '') }, { v: x.ent != null ? `${x.rate >= 0 ? '+' : ''}${(x.rate * 100).toFixed(1)}%` : '', c: 'num ' + (x.rate >= 0 ? 'pos' : 'neg') }] });
    }
  }
  if (fo.length) {
    rows.push({ n: n++, cls: 'sec', cells: [{ v: `해외 자산<small>${S.fx.at ? `환율 ${dLabel(S.fx.at)} 기준` : '환율: 직접 입력 또는 새로고침'}</small>`, cs: 5 }, null, null, null, null] });
    rows.push({ n: n++, cells: [{ v: '자산', c: 'sub', cs: 2 }, null, { v: '보유 외화', c: 'sub num' }, { v: '환율', c: 'sub num' }, { v: '원화', c: 'sub num' }] });
    for (const a of fo) rows.push({ n: n++, attr: at('acctEdit', { id: a.id }), cells: [{ v: esc(a.name), cs: 2 }, null, { v: `${(+a.famt || 0).toLocaleString('ko-KR')} ${esc(a.cur || '')}`, c: 'num' }, { v: fxRate(a) ? fxRate(a).toFixed(2) : '없음', c: 'num' + (fxRate(a) ? '' : ' warn') }, { v: fmtU(fxVal(a)), c: 'num b' }] });
  }
  return { ...base, body: table(cols, rows), items: todo ? [`입력 안 한 달 ${todo}개`] : ['평가금액 모두 입력됨'] };
}

/* ----- 기본값 설정 ----- */
function vSet() {
  const segs = [['acct', '계좌'], ['cat', '카테고리'], ['rec', '정기 결제'], ['base', '기타']];
  if (!segs.some(x => x[0] === U.setTab)) U.setTab = 'acct';
  const base = { sub: '기본값 설정', tb: tb(`<button class="t txt done"${at('setDone')}>✓ 완료</button>`, sep, ...segs.map(([k, l]) => `<button class="t txt${U.setTab === k ? ' on' : ''}"${at('setTab', { v: k })}>${l}</button>`)) };
  const rows = []; let n = 1;
  if (U.setTab === 'acct') {
    const cols = [{ w: 30, on: 1 }, { w: 18 }, { w: 26 }, { w: 26 }];
    rows.push({ n: n++, cls: 'frz', cells: [{ v: '계좌', c: 'h' }, { v: '종류', c: 'h' }, { v: '시작 잔액', c: 'h num' }, { v: '비고', c: 'h' }] });
    for (const ty of TORD) for (const a of S.accounts.filter(x => x.type === ty)) {
      const note = a.type === 'prepaid' ? `← ${a.link ? accName(a.link) : '연결 필요'}` : a.type === 'card' && a.payDay ? `${a.payDay}일 결제` : a.type === 'saving' && a.mat ? `만기 ${a.mat.slice(2)}` : a.type === 'invest' && a.isa ? 'ISA' : a.type === 'foreign' ? `${a.cur || ''}` : '';
      rows.push({ n: n++, attr: at('acctEdit', { id: a.id }), cells: [`${esc(a.name)}${a.fav ? ' <span class="star">★</span>' : ''}${a.hidden ? '<span class="lab">숨김</span>' : ''}`, `<span class="chip-a" style="background:${TYPES[a.type].c}1A;color:${TYPES[a.type].c}">${TYPES[a.type].l}</span>`,
        { v: a.type === 'foreign' ? `${(+a.famt || 0).toLocaleString('ko-KR')}` : fmt(a.start), c: 'num' + (+a.start < 0 ? ' neg' : '') }, { v: esc(note), c: 'mut' + (a.type === 'prepaid' && !a.link ? ' warn' : '') }] });
    }
    rows.push({ n: n++, attr: at('acctNew'), cells: [{ v: '<span class="link">＋ 계좌 추가</span>', cs: 4 }, null, null, null] });
    rows.push({ n: n++, cells: [{ v: `시작 잔액 기준일 ${S.settings.start}`, c: 'mut wrap', cs: 4 }, null, null, null] });
    return { ...base, body: table(cols, rows), l: `계좌 ${S.accounts.length}개` };
  }
  if (U.setTab === 'cat') {
    const cols = [{ w: 46, on: 1 }, { w: 22 }, { w: 32 }];
    const ms = mstats(ym(TODAY()));
    for (const [k, l] of [['exp', '지출 카테고리'], ['inc', '수입 카테고리']]) {
      rows.push({ n: n++, cls: 'sec', cells: [{ v: l, cs: 3 }, null, null] });
      for (const c of S.cats.filter(x => x.k === k)) rows.push({ n: n++, attr: at('catEdit', { id: c.id }), cells: [`${catLbl(c.n)}`, { v: k === 'exp' ? '지출' : '수입', c: 'mut' }, { v: k === 'exp' ? fmt(ms.cats[c.n] || 0) + (+c.b ? ` / ${fmt(c.b)}` : '') : '', c: 'num mut' }] });
      rows.push({ n: n++, attr: at('catNew', { kind: k }), cells: [{ v: '<span class="link">＋ 추가</span>', cs: 3 }, null, null] });
    }
    return { ...base, body: table(cols, rows), l: `카테고리 ${S.cats.length}개` };
  }
  if (U.setTab === 'rec') {
    const cols = [{ w: 30, on: 1 }, { w: 14 }, { w: 24 }, { w: 32 }];
    rows.push({ n: n++, cls: 'frz', cells: [{ v: '이름', c: 'h' }, { v: '날짜', c: 'h num' }, { v: '금액', c: 'h num' }, { v: '계좌', c: 'h' }] });
    for (const r of S.rec) rows.push({ n: n++, attr: at('recEdit', { id: r.id }), cells: [`${esc(r.name)}`, { v: `${r.day}일`, c: 'num' }, { v: fmt(r.amt), c: 'num' + (r.type === 'in' ? ' pos' : '') + (!r.start ? ' warn note' : '') }, { v: `${esc(accName(r.acct))}${r.type === 'move' ? ' → ' + esc(accName(r.to)) : ''}`, c: 'mut' }] });
    rows.push({ n: n++, attr: at('recNew'), cells: [{ v: '<span class="link">＋ 정기 결제·이체 추가</span>', cs: 4 }, null, null, null] });
    rows.push({ n: n++, cells: [{ v: '매달 지정한 날짜에 자동으로 기록돼요.', c: 'mut wrap', cs: 4 }, null, null, null] });
    const bad = S.rec.filter(r => !r.start).length;
    return { ...base, body: table(cols, rows), l: `${S.rec.length}건`, err: bad ? `시작일 없는 항목 ${bad}개 (자동 기록 안 됨)` : '' };
  }
  // 기타 (시작일·ISA 한도)
  const cols = [{ w: 55, on: 1 }, { w: 45 }];
  const row = (l, v, a, d = {}, cl = '') => rows.push({ n: n++, attr: a ? at(a, d) : '', cells: [l, { v, c: 'num ' + cl }] });
  row('시작일 (잔액 기준일)', S.settings.start, 'setStart', {}, 'link');
  row('ISA 연 납입 한도', fmt(S.settings.isaLimit), 'setIsa', {}, 'link');
  rows.push({ n: n++, cells: [{ v: '계좌 시작 잔액의 기준일이에요.', c: 'mut wrap', cs: 2 }, null] });
  return { ...base, body: table(cols, rows), l: '기타 설정' };
}

/* ----- welcome / locked ----- */
const LOGO = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="6" y="9" width="36" height="30" rx="3" stroke="#fff" stroke-width="3"/><path d="M6 19h36M6 29h36M18 9v30M30 9v30" stroke="#fff" stroke-width="2.4" opacity=".7"/><rect x="18" y="19" width="12" height="10" fill="#fff"/></svg>`;
function vWelcome() {
  return `<div class="welcome"><div class="logo">${LOGO}</div><h1>셀가계부</h1>
    <p>표로 정리하는 가계부</p>
    <div style="width:100%;margin-top:26px">
      ${Sync.status !== 'off' ? `<button class="bigbtn"${at('signIn')}>구글 로그인해서 이어 쓰기</button>` : ''}
      <button class="bigbtn${Sync.status !== 'off' ? ' ghost' : ''}"${at('startNew')}>새로 시작하기</button>
      <button class="bigbtn ghost"${at('importCsv')}>구글 시트 CSV 가져오기</button>
      <button class="bigbtn ghost"${at('importJson')}>백업 파일 불러오기</button>
    </div>
    <div class="note2">${Sync.status !== 'off' ? '데이터는 이 기기에 먼저 저장돼요.<br>로그인하면 기기에서 암호화한 뒤 동기화해요.' : '데이터는 이 기기에만 저장됩니다.'}</div></div>`;
}
function vLocked() {
  return `<div class="welcome"><div class="logo">${LOGO}</div><h1>잠금 해제</h1><p>이 계정의 가계부는 암호로 보호돼 있어요.<br>가계부 암호를 입력하세요.</p>
    <div style="width:100%;margin-top:26px"><button class="bigbtn"${at('syncMenu')}>암호 입력</button></div></div>`;
}

/* ---------- 카테고리 추정 (같은 메모의 예전 기록 → 키워드) ---------- */
function guessCat(memo, type) {
  if (!memo || type === 'move') return '';
  for (let i = S.tx.length - 1; i >= 0; i--) { const x = S.tx[i]; if (x.memo === memo && x.cat && x.type === type) return x.cat; }
  const kind = type === 'in' ? 'inc' : 'exp';
  for (const [re, c] of KW) if (re.test(memo) && catOf(c)?.k === kind) return c;
  return '';
}

/* ---------- 백업 알림 ---------- */
const BK = KEY + '.bk';
const bkGet = () => { try { return JSON.parse(localStorage.getItem(BK) || '{}'); } catch (e) { return {}; } };
const bkSet = o => { try { localStorage.setItem(BK, JSON.stringify({ ...bkGet(), ...o })); } catch (e) { } };
function backupNudge() {
  if (!S || S.tx.length < 10) return '';
  const b = bkGet(), t = TODAY();
  if (b.snooze && b.snooze > t) return '';
  const since = b.last || S.tx.reduce((m, x) => x.date < m ? x.date : m, t);
  const days = Math.round((new Date(t) - new Date(since)) / 864e5);
  if (days < (b.last ? 30 : 14)) return '';
  return `<div class="nudge"><span>${b.last ? `마지막 백업 ${days}일 전` : '아직 백업한 적이 없어요'}</span><button class="btn pri"${at('exportJson')}>백업</button><button class="btn"${at('bkLater')}>나중에</button></div>`;
}

/* ---------- 미분류 정리 ---------- */
let UQ = [];
const uncatQueue = () => S.tx.filter(t => t.type !== 'move' && !t.cat && +t.amt && t.date >= S.settings.start).sort((a, b) => a.date < b.date ? 1 : -1).map(t => t.id);
function uncatSheet(i) {
  const t = txById(UQ[i]);
  if (!t) { closeSheet(); return toast(i ? '미분류 정리를 마쳤어요' : '미분류 거래가 없어요'); }
  const kind = t.type === 'in' ? 'inc' : 'exp', g = guessCat(t.memo, t.type);
  openSheet(`${bh('미분류 정리', `${i + 1} / ${UQ.length}`, `<button class="btn"${at('uncatSkip', { i })}>건너뛰기</button>`)}
    <div class="uq"><div><b>${fmt(t.amt)}</b>원 <span class="mut">${TXL[t.type]}</span></div><div class="mut">${dLabel(t.date)} · ${esc(accName(t.acct))}${t.memo ? ' · ' + esc(t.memo) : ''}</div></div>
    <div class="chips">${S.cats.filter(c => c.k === kind).map(c => `<button class="chip${c.n === g ? ' on' : ''}"${at('uncatSet', { i, v: c.n })}>${catLbl(c.n)}</button>`).join('')}</div>`);
}

/* ---------- 은행·카드 내역 CSV ---------- */
async function readText(f) { // 은행 파일은 EUC-KR인 경우가 많음
  const buf = await f.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^\uFEFF/, ''); } catch (e) { }
  try { return new TextDecoder('euc-kr').decode(buf); } catch (e) { return new TextDecoder().decode(buf); }
}
function bankParse(rows) {
  const has = (c, re) => re.test(String(c || '').replace(/\s/g, ''));
  const RE = { date: /거래일|일자|날짜|일시|이용일|승인일|사용일/, out: /출금|지출|이용금액|결제금액|사용금액|승인금액|찾으신/, inn: /입금|맡기신/, amt: /^금액|거래금액/,
    memo: /내용|적요|거래처|가맹점|이용처|사용처|기재|메모|받는분|보낸분|상호/ };
  const hi = rows.findIndex(r => r.some(c => has(c, RE.date)) && r.some(c => has(c, RE.out) || has(c, RE.inn) || has(c, RE.amt)));
  if (hi < 0) return { items: [] };
  const h = rows[hi], col = re => h.findIndex(c => has(c, re));
  const ci = { date: col(RE.date), out: col(RE.out), inn: col(RE.inn), amt: col(RE.amt), memo: col(RE.memo) };
  const body = rows.slice(hi + 1), signed = ci.amt >= 0 && body.some(r => num(r[ci.amt]) < 0);
  const items = [];
  for (const r of body) {
    const date = toDate(r[ci.date]); if (!date) continue;
    const o = ci.out >= 0 ? Math.abs(num(r[ci.out])) : 0, i = ci.inn >= 0 ? Math.abs(num(r[ci.inn])) : 0;
    let type, amt;
    if (o) { type = 'out'; amt = o; } else if (i) { type = 'in'; amt = i; }
    else if (ci.amt >= 0 && num(r[ci.amt])) { const v = num(r[ci.amt]); type = v < 0 || !signed ? 'out' : 'in'; amt = Math.abs(v); }
    else continue;
    items.push({ date, type, amt: Math.round(amt), memo: ci.memo >= 0 ? String(r[ci.memo] || '').trim().slice(0, 60) : '' });
  }
  return { items };
}
function bankImport(items, acct) {
  // 이미 입력한 거래(같은 날짜·구분·금액)는 건너뜀 — 손으로 적은 메모가 달라도 중복으로 봄
  const k = t => [t.date, t.type, t.amt].join('|'), have = {};
  for (const t of S.tx) if (t.acct === acct) have[k(t)] = (have[k(t)] || 0) + 1;
  const list = []; let dup = 0, unc = 0, early = 0;
  for (const it of items) {
    if (have[k(it)]) { have[k(it)]--; dup++; continue; }
    const cat = guessCat(it.memo, it.type); if (!cat) unc++; if (it.date < S.settings.start) early++;
    list.push(touch({ id: uid(), date: it.date, acct, type: it.type, amt: it.amt, cat, to: '', memo: it.memo }));
  }
  if (list.length) commit(() => S.tx.push(...list));
  return { add: list.length, dup, unc, early };
}

/* ---------- 앱 잠금 (PIN + Face ID) ---------- */
const PINK = KEY + '.pin', BIOK = KEY + '.bio';
const pinGet = () => { try { return JSON.parse(localStorage.getItem(PINK) || 'null'); } catch (e) { return null; } };
const bioGet = () => { try { return localStorage.getItem(BIOK) || ''; } catch (e) { return ''; } };
async function pinHash(pin, salt) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
// Face ID: 아이폰 패스키(WebAuthn)로 기기에서 본인 확인만 받는다. 서버 없음.
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = x => Uint8Array.from(atob(x), c => c.charCodeAt(0));
async function bioAvailable() { try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (e) { return false; } }
async function bioEnroll() {
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: '셀가계부' },
    user: { id: crypto.getRandomValues(new Uint8Array(16)), name: '셀가계부', displayName: '셀가계부 잠금' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
    timeout: 60000, attestation: 'none' } });
  localStorage.setItem(BIOK, b64(cred.rawId));
}
async function bioCheck() {
  const id = bioGet(); if (!id) return false;
  const a = await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)),
    allowCredentials: [{ type: 'public-key', id: unb64(id), transports: ['internal'] }], userVerification: 'required', timeout: 60000 } });
  return !!(new Uint8Array(a.response.authenticatorData)[32] & 0x04); // UV 플래그: Face ID(또는 기기 암호)로 확인됨
}
const LAK = KEY + '.lockAfter', LA_LBL = { 0: '바로', 1: '1분 뒤', 5: '5분 뒤', 30: '30분 뒤', launch: '앱을 켤 때만' };
const lockAfter = () => { try { return localStorage.getItem(LAK) || '1'; } catch (e) { return '1'; } };
const LK = { buf: '', mode: '', first: '', fails: 0, until: 0, hiddenAt: 0, busy: false, change: false };
function showLock(mode) {
  LK.mode = mode; LK.buf = ''; const r = $('#lock'); if (!r) return; r.classList.add('on'); drawLock();
  if (mode === 'unlock' && bioGet()) setTimeout(() => bioUnlock(false), 250);
}
function hideLock() { const r = $('#lock'); if (r) { r.classList.remove('on'); r.innerHTML = ''; } LK.buf = ''; LK.mode = ''; }
function drawLock(msg = '') {
  const title = { unlock: 'PIN 입력', set: '새 PIN 4자리', set2: '한 번 더 입력', off: '현재 PIN 입력' }[LK.mode];
  $('#lock').innerHTML = `<div class="lk"><div class="ltop"><div class="logo">${LOGO}</div><div class="lt">${title}</div>
    <div class="ld">${[0, 1, 2, 3].map(() => '<i></i>').join('')}</div><div class="lm"></div></div>
    <div class="lp">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(k => k ? `<button${at('pinKey', { k })}>${k}</button>` : '<span></span>').join('')}</div>
    <div class="lbot">${LK.mode === 'unlock' && bioGet() ? `<button class="lbio"${at('bioUnlock')}>${ico('face', 18)}Face ID</button>` : ''}
    ${LK.mode === 'unlock' ? `<button class="lf"${at('pinForgot')}>PIN을 잊었어요</button>` : `<button class="lf"${at('pinCancel')}>취소</button>`}</div></div>`;
  lockDots(msg);
}
// 숫자를 누를 때는 동그라미와 안내만 바꾼다 (화면 전체를 다시 그리지 않아 빠름)
function lockDots(msg = '') {
  const r = $('#lock'); if (!r) return;
  r.querySelectorAll('.ld i').forEach((el, i) => el.classList.toggle('on', i < LK.buf.length));
  const m = r.querySelector('.lm'); if (m) m.textContent = msg;
}
async function bioUnlock(manual) {
  try { if (await bioCheck()) { LK.fails = 0; hideLock(); } }
  catch (e) { if (manual) lockDots('Face ID를 쓸 수 없어요. PIN을 입력하세요'); }
}
async function pinKey(k) {
  if (LK.busy) return;
  if (Date.now() < LK.until) return lockDots(`${Math.ceil((LK.until - Date.now()) / 1000)}초 뒤에 다시 시도하세요`);
  if (k === '⌫') { LK.buf = LK.buf.slice(0, -1); return lockDots(); }
  if (LK.buf.length >= 4) return;
  LK.buf += k; lockDots();
  if (LK.buf.length < 4) return;
  const pin = LK.buf; LK.busy = true;
  try {
    if (LK.mode === 'set') { LK.first = pin; LK.mode = 'set2'; LK.buf = ''; return drawLock(); }
    if (LK.mode === 'set2') {
      if (pin !== LK.first) { LK.mode = 'set'; LK.buf = ''; return drawLock('두 번 입력한 PIN이 달라요'); }
      const salt = [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(PINK, JSON.stringify({ salt, h: await pinHash(pin, salt) }));
      hideLock(); toast('앱 잠금을 켰어요');
      if (!bioGet() && await bioAvailable()) openSheet(`${bh('Face ID도 쓸까요?')}<div class="hint top">잠금 화면에서 Face ID로 바로 열 수 있어요. 안 되면 PIN으로 열면 돼요.</div>
        <div class="row2" style="margin-top:12px"><button class="btn" style="height:46px"${at('close')}>나중에</button><button class="btn pri" style="height:46px"${at('bioToggle')}>Face ID 켜기</button></div>`);
      return;
    }
    const p = pinGet();
    if (!p || await pinHash(pin, p.salt) !== p.h) {
      LK.fails++; LK.buf = '';
      if (LK.fails >= 5) { LK.fails = 0; LK.until = Date.now() + 30000; return lockDots('5번 틀려서 30초 동안 잠겨요'); }
      return lockDots('PIN이 맞지 않아요');
    }
    LK.fails = 0;
    if (LK.mode === 'off' && LK.change) { LK.change = false; LK.mode = 'set'; LK.buf = ''; return drawLock(); }
    if (LK.mode === 'off') { localStorage.removeItem(PINK); localStorage.removeItem(BIOK); hideLock(); return toast('앱 잠금을 껐어요'); }
    hideLock();
  } finally { LK.busy = false; }
}
/* ---------- 설정 창 (⚙) ---------- */
function openGear() {
  const r = $('#modal-root'); if (!r || !S) return;
  const syncLbl = Sync.status === 'off' ? '이 기기에만 저장' : (Sync.label ? Sync.label() : '');
  const tile = (ic, l, a, sub = '', cls = '') => `<button class="tile ${cls}"${at('gearGo', { v: a })}><span class="ti">${ico(ic)}</span><span class="tl">${l}</span>${sub ? `<span class="ts">${esc(sub)}</span>` : ''}</button>`;
  r.innerHTML = `<div class="mdim"${at('gearClose')}></div><div class="mbox" role="dialog" aria-modal="true" aria-label="설정">
    <div class="mh"><b>설정</b><button class="mx"${at('gearClose')} aria-label="닫기">✕</button></div>
    <div class="mbody">
      <div class="mgrp">데이터 · 동기화</div>
      <div class="tiles">
        ${tile(Sync.status === 'off' ? 'phone' : 'cloud', '동기화', 'syncMenu', syncLbl)}
        ${tile('down', '백업 내보내기', 'exportJson', bkGet().last ? `${dLabel(bkGet().last)} 마지막` : '')}
        ${tile('up', '백업 불러오기', 'importJson')}
        ${tile('bank', '내역 가져오기', 'importBank', '은행·카드 CSV')}
        ${tile('file', '시트 가져오기', 'importCsv', '구글 시트 CSV')}
        ${tile('archive', '월 마감', 'closeMenu', '오래된 거래 정리')}
      </div>
      <div class="mgrp">기타</div>
      <div class="tiles">
        ${tile('theme', '화면 테마', 'theme', { auto: '자동', light: '밝게', dark: '어둡게' }[themePref()])}
        ${tile('lock', '앱 잠금', 'pinMenu', pinGet() ? (bioGet() ? 'PIN + Face ID' : '켜짐') : '꺼짐')}
        ${tile('fx', '환율 새로고침', 'fxRefresh')}
        ${tile('refresh', '앱 업데이트', 'appUpdate', `버전 ${APP_VER}`)}
        ${isIOSApp() ? tile('ruler', '화면 높이 보정', 'hfix', hfixOn() ? '켜짐' : '꺼짐') : ''}
        ${tile('trash', '초기화', 'reset', '이 기기', 'dan')}
      </div>
      <div class="mnote">데이터는 이 기기에만 저장돼요. 백업을 가끔 내보내 두세요.<br><span style="color:var(--muted)">버전 ${APP_VER}</span></div>
    </div>
    <button class="mbase"${at('gearGo', { v: 'openBase' })}>기본값 설정<small>계좌 · 카테고리 · 정기 결제 · 시작일</small></button>
  </div>`;
  r.classList.add('on');
}
function closeGear() { const r = $('#modal-root'); if (r) { r.classList.remove('on'); r.innerHTML = ''; } }
/* =========================================================
   SHEETS (편집)
   ========================================================= */
function updTx(id, patch) { commit(() => { const t = txById(id); if (t) { Object.assign(t, patch); touch(t); } }); }
const refOf = (id, k) => { const C = U.acct ? ['date', 'type', 'amt', 'cat', 'memo'] : ['date', 'acct', 'type', 'amt', 'cat']; const i = C.indexOf(k); return (i >= 0 ? L(i) : '') + (U.rowNo?.[id] || ''); };

/* keypad */
let KP = null;
function calc(s) {
  s = String(s || '').replace(/,/g, '').replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/\s/g, '');
  if (!s) return 0;
  const t = s.match(/\d+(?:\.\d+)?|[+\-*/]/g); if (!t || t.join('') !== s) return null;
  const nums = [], ops = [], prec = o => (o === '+' || o === '-') ? 1 : 2;
  const ap = () => { const b = nums.pop(), a = nums.pop(), o = ops.pop(); if (a == null || b == null) throw 0; nums.push(o === '+' ? a + b : o === '-' ? a - b : o === '*' ? a * b : b === 0 ? NaN : a / b); };
  let expect = true, neg = false;
  try {
    for (const x of t) {
      if (/\d/.test(x)) { nums.push(neg ? -Number(x) : Number(x)); neg = false; expect = false; }
      else { if (expect) { if (x === '-') { neg = !neg; continue; } return null; } while (ops.length && prec(ops[ops.length - 1]) >= prec(x)) ap(); ops.push(x); expect = true; }
    }
    if (expect && ops.length) ops.pop();
    while (ops.length) ap();
  } catch (e) { return null; }
  const v = nums.pop(); return Number.isFinite(v) ? v : null;
}
function keypad(o) {
  KP = { ...o, ex: o.init == null ? '' : String(o.init) };
  const q = [['+1000', '+1천'], ['+5000', '+5천'], ['+10000', '+1만'], ['+50000', '+5만'], ['C', '지우기']];
  openSheet(`${bh(o.ref || '', o.title || '금액', `${o.prev ? `<button class="btn"${at('kpGo', { d: 'prev' })}>${o.prev}</button>` : ''}<button class="btn pri"${at('kpGo', { d: 'next' })}>${o.next || '완료'}</button>`)}
    <div class="disp"><div class="ex" id="kpx"></div><div class="res" id="kpr">0</div></div>
    <div class="quick">${q.map(([k, l]) => `<button${at('kp', { k })}>${l}</button>`).join('')}</div>
    <div class="pad">${['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '00', '0', '⌫', '+'].map(k => `<button class="${'÷×−+'.includes(k) ? 'op' : ''}"${at('kp', { k })}>${k}</button>`).join('')}</div>
    ${o.hint ? `<div class="hint">${o.hint}</div>` : ''}`);
  kpShow();
}
function kpShow() {
  const v = calc(KP.ex), hasOp = /[+\-×÷−]/.test(KP.ex.replace(/^[−-]/, ''));
  $('#kpx').textContent = hasOp ? '= ' + KP.ex.replace(/\d+/g, x => Number(x).toLocaleString('ko-KR')) : '';
  $('#kpr').textContent = v == null ? '수식 확인' : (KP.ex === '' && KP.allowEmpty ? '비움' : fmt(v));
}
const ACT = {};
ACT.kp = d => {
  let k = d.k, e = KP.ex;
  if (k === '⌫') e = e.slice(0, -1);
  else if (k === 'C') e = '';
  else if (k[0] === '+' && k.length > 1) { const v = calc(e) || 0; e = String(Math.round(v) + Number(k.slice(1))); }
  else {
    if ('÷×−+'.includes(k)) { if (!e) { if (k !== '−') return; } else if ('÷×−+'.includes(e.slice(-1))) e = e.slice(0, -1); }
    if (e.length > 40) return; e += k;
  }
  KP.ex = e; kpShow();
};
ACT.kpGo = d => {
  const v = calc(KP.ex); if (v == null) return toast('수식을 확인하세요');
  const o = KP; closeSheet(); o.ok(Math.round(v), o.ex, d.d);
};
function kpTx(id) {
  const t = txById(id); if (!t) return;
  keypad({ ref: refOf(id, 'amt'), title: '금액', init: t.ex || (t.amt ? String(t.amt) : ''), prev: '◀ 구분', next: t.type === 'move' ? '받는 계좌 ▶' : '카테고리 ▶',
    ok: (v, ex, dir) => {
      const hasOp = /[+\-×÷−]/.test(ex.replace(/^[−-]/, ''));
      updTx(id, { amt: Math.abs(v), ex: hasOp ? ex : '' });
      const t2 = txById(id); if (!t2) return;
      if (dir === 'next') { if (t2.type === 'move') { if (!t2.to) pickTo(id); } else if (!t2.cat) catSheet(id); }
      else if (dir === 'prev') typeSheet(id);
    } });
}
function recentCats(acct, kind) {
  const c = {}; for (const t of S.tx.slice(-300)) if (t.acct === acct && t.cat && catOf(t.cat)?.k === kind) c[t.cat] = (c[t.cat] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 3);
}
function catSheet(id) {
  const t = txById(id); if (!t) return;
  const kind = t.type === 'in' ? 'inc' : 'exp', cs = S.cats.filter(c => c.k === kind), rc = recentCats(t.acct, kind);
  openSheet(`${bh(refOf(id, 'cat'), '카테고리', `<button class="btn"${at('cellGo', { id, k: 'amt' })}>◀ 금액</button><button class="btn pri"${at('close')}>완료</button>`)}
    <div class="chips">${cs.map(c => `<button class="chip${t.cat === c.n ? ' on' : ''}"${at('setCat', { id, v: c.n })}>${catLbl(c.n)}</button>`).join('')}
    <button class="chip add"${at('catNew', { kind, tx: id })}>＋ 새 카테고리 (설정에 자동 추가)</button></div>
    ${rc.length ? `<div class="lbl">이 계좌에서 자주 쓴 항목</div><div class="recent">${rc.map(([nm, c]) => `<button${at('setCat', { id, v: nm })}>${catLbl(nm)} · ${c}회</button>`).join('')}</div>` : ''}`);
}
ACT.setCat = d => { closeSheet(); updTx(d.id, { cat: d.v }); };
ACT.cellGo = d => { closeSheet(); ACT.cell({ id: d.id, k: d.k }); };
function pickAcct(o) {
  SH.pick = o.onPick;
  const list = accts().filter(a => a.id !== o.exclude && (!o.types || o.types.includes(a.type)));
  const E = TODAY();
  const item = a => { const v = valueAt(a, E); return `<button class="ai${o.cur === a.id ? ' on' : ''}"${at('pickA', { v: a.id })}><span class="d" style="background:${TYPES[a.type].c}">${esc(a.name[0])}</span><span class="n">${esc(a.name)}${a.fav ? ' <span class="star">★</span>' : ''}<small>${TYPES[a.type].l}</small></span><span class="v ${v < 0 ? 'neg' : ''}">${fmt(v)}</span><span class="ck">${o.cur === a.id ? '✓' : ''}</span></button>`; };
  let h = '';
  if (o.all) h += `<button class="ai${!o.cur ? ' on' : ''}"${at('pickA', { v: '' })}><span class="d" style="background:#888">∗</span><span class="n">전체 계좌<small>모든 거래 보기 · 계좌 열 표시</small></span><span class="v"></span><span class="ck">${!o.cur ? '✓' : ''}</span></button>`;
  const fav = list.filter(a => a.fav); if (fav.length) h += `<div class="grp">즐겨찾기</div>` + fav.map(item).join('');
  for (const ty of TORD) { const xs = list.filter(a => a.type === ty && !a.fav); if (xs.length) h += `<div class="grp">${TYPES[ty].l}</div>` + xs.map(item).join(''); }
  if (!list.length) h += `<div class="empty">고를 수 있는 계좌가 없어요.<br>설정 탭에서 추가하세요.</div>`;
  openSheet(`${bh(esc(o.title || '계좌 선택'), esc(o.sub || ''))}<div class="alist">${h}</div>`);
}
ACT.pickA = d => { const f = SH.pick; closeSheet(); f && f(d.v || null); };
function pickTo(id) { const t = txById(id); pickAcct({ title: '받는 계좌', sub: '내 계좌로 이동', cur: t.to, exclude: t.acct, onPick: v => v && updTx(id, { to: v }) }); }
function typeSheet(id) {
  const t = txById(id); if (!t) return;
  const lb = { out: '출금 · 돈이 나감', in: '입금 · 돈이 들어옴', move: '이동 · 내 계좌끼리' };
  openSheet(`${bh(refOf(id, 'type'), '구분')}<div class="acts">${['out', 'in', 'move'].map(k => `<button class="btn${t.type === k ? ' pri' : ''}"${at('setType', { id, v: k })}>${lb[k]}</button>`).join('')}</div>`);
}
ACT.setType = d => {
  const t = txById(d.id); if (!t) return; closeSheet();
  const p = { type: d.v };
  if (d.v !== 'move') p.to = ''; else p.cat = '';
  if (d.v !== 'move' && t.cat && catOf(t.cat)?.k !== (d.v === 'in' ? 'inc' : 'exp')) p.cat = '';
  updTx(d.id, p);
  const t2 = txById(d.id);
  if (!(+t2.amt)) kpTx(d.id); else if (d.v === 'move' && !t2.to) pickTo(d.id); else if (d.v !== 'move' && !t2.cat) catSheet(d.id);
};
function dateSheet(id) {
  const t = txById(id);
  openSheet(`${bh(refOf(id, 'date'), '날짜')}<div class="fld"><input type="date" id="dIn" value="${t.date}"></div>
    <div class="row2" style="margin-top:10px"><button class="btn"${at('setDate', { id, v: TODAY() })} style="height:44px">오늘</button><button class="btn"${at('setDate', { id, v: addD(TODAY(), -1) })} style="height:44px">어제</button><button class="btn pri"${at('setDate', { id, v: '' })} style="height:44px">완료</button></div>`);
}
ACT.setDate = d => { const v = d.v || $('#dIn')?.value; closeSheet(); if (isDate(v)) updTx(d.id, { date: v }); };
function memoSheet(id) {
  const t = txById(id);
  openSheet(`${bh(refOf(id, 'memo'), '메모')}<div class="fld"><input id="mIn" maxlength="60" value="${esc(t.memo || '')}" placeholder="예: 회사 앞 카페" autofocus></div>
    <div class="row2" style="margin-top:10px"><button class="btn pri"${at('setMemo', { id })} style="height:44px">완료</button></div>`);
}
ACT.setMemo = d => { const v = $('#mIn').value.trim(); closeSheet(); updTx(d.id, { memo: v }); };

ACT.cell = d => {
  const r = rowById(d.id); if (!r) return;
  U.sel = { id: d.id, k: d.k };
  if (r.auto) { render(); return autoSheet(r); }
  render();
  const k = d.k;
  if (k === 'date') dateSheet(r.id);
  else if (k === 'acct') pickAcct({ title: '계좌', cur: r.acct, onPick: v => { if (!v) return; const p = { acct: v }; if (r.to === v) p.to = ''; updTx(r.id, p); } });
  else if (k === 'type') typeSheet(r.id);
  else if (k === 'amt') kpTx(r.id);
  else if (k === 'cat') r.type === 'move' ? pickAcct({ title: U.acct && r.to === U.acct ? '보낸 계좌' : '받는 계좌', cur: U.acct && r.to === U.acct ? r.acct : r.to, exclude: U.acct && r.to === U.acct ? r.to : r.acct, onPick: v => v && updTx(r.id, U.acct && r.to === U.acct ? { acct: v } : { to: v }) }) : catSheet(r.id);
  else if (k === 'memo') memoSheet(r.id);
};
ACT.row = d => {
  const r = rowById(d.id); if (!r) return;
  U.sel = { id: d.id, k: 'date' }; render();
  if (r.auto) return autoSheet(r);
  const t = txById(r.id);
  openSheet(`${bh(`${U.rowNo?.[r.id] || ''}행`, `${dLabel(r.date)} · ${TXL[r.type]} ${fmt(r.amt)}`)}
    <div class="acts"><button class="btn"${at('dupTx', { id: r.id })}>복제 (오늘 날짜로)</button><button class="btn dan"${at('delTx', { id: r.id })}>삭제</button></div>
    <div class="lbl">색 태그 · 나만의 표시</div><div class="tags">${TAGS.map(c => `<button class="${(t.tag || '') === c ? 'on' : ''}" style="background:${c || '#fff'}"${at('setTag', { id: r.id, v: c })}>${c ? '' : '✕'}</button>`).join('')}</div>`);
};
ACT.dupTx = d => { const t = txById(d.id); closeSheet(); const c = touch({ ...t, id: uid(), date: TODAY() }); delete c.tag; commit(() => S.tx.push(c)); U.sel = { id: c.id, k: 'amt' }; scrollSel(); toast('복제했어요'); };
ACT.delTx = d => { closeSheet(); U.sel = null; commit(() => removeRec('tx', d.id)); toast('삭제했어요 · ↶로 되돌리기'); };
ACT.setTag = d => { closeSheet(); updTx(d.id, { tag: d.v }); };
function autoSheet(r) {
  const kind = { rec: '정기 결제·이체', chg: '자동 충전', cb: '캐시백' }[r.auto], o = ovOf(r.id);
  SH.auto = r;
  openSheet(`${bh(esc(kind), `${dLabel(r.date)} · ${fmt(r.amt)}원`)}
    <div class="hint top">자동으로 생긴 행이에요. 실제 금액이 다르면 고칠 수 있어요.</div>
    <div class="acts" style="margin-top:10px"><button class="btn pri"${at('autoAmt')}>금액 고치기</button>
    ${o ? `<button class="btn"${at('autoReset')}>원래대로 되돌리기</button>` : ''}
    <button class="btn"${at('autoSrc')}>${r.auto === 'rec' ? '정기 결제 설정 열기' : '충전식 계좌 설정 열기'}</button></div>`);
}
ACT.autoAmt = () => { const r = SH.auto; closeSheet(); keypad({ ref: '자동 행', title: '실제 금액', init: String(r.amt), ok: v => commit(() => { S.ov[r.id] = { amt: Math.abs(v), u: now() }; }) }); };
ACT.autoReset = () => { const r = SH.auto; closeSheet(); commit(() => { S.ov[r.id] = { del: 1, u: now() }; }); };
ACT.autoSrc = () => { const r = SH.auto; closeSheet(); r.auto === 'rec' ? recForm(r.src) : acctForm(r.src); };

/* new row / quick */
function defDate() { const [s, e] = mRange(U.month), t = TODAY(); return t >= s && t <= e ? t : t < s ? s : e; }
function lastAcct() {
  for (let i = S.tx.length - 1; i >= 0; i--) { const a = A(S.tx[i].acct); if (a && !a.hidden && a.type !== 'invest' && a.type !== 'foreign') return a.id; }
  return accts().find(a => a.type !== 'invest' && a.type !== 'foreign')?.id || accts()[0]?.id || null;
}
ACT.newRow = () => {
  const acct = U.acct || lastAcct();
  if (!acct) { toast('설정 탭에서 계좌를 먼저 추가하세요'); return; }
  if (U.flt.t !== 'all' || U.flt.cats.length || U.q) { U.flt = { ...U.flt, t: 'all', cats: [] }; U.q = ''; }
  const t = touch({ id: uid(), date: defDate(), acct, type: 'out', amt: 0, cat: '', to: '', memo: '' });
  U.sel = { id: t.id, k: 'amt' };
  commit(() => S.tx.push(t)); scrollSel(); kpTx(t.id);
};
ACT.quick = d => {
  const q = QS[+d.i]; if (!q) return;
  const t = touch({ id: uid(), date: qDate($('#qeDate')?.value) || defDate(), acct: U.acct || q.acct, type: q.type, amt: q.amt, cat: q.cat, to: q.to, memo: q.memo });
  U.sel = { id: t.id, k: 'amt' }; commit(() => S.tx.push(t)); scrollSel(); toast(`추가했어요 · ${q.memo || q.cat} ${fmt(q.amt)}`);
};

/* filter / search */
function fltSheet() {
  const f = U.flt, segB = (k, v, l) => `<button class="${f[k] === v ? 'on' : ''}"${at('fltSet', { k, v })}>${l}</button>`;
  const cnt = inputRows().length;
  openSheet(`${bh('필터', fltActive() ? '조건 적용 중' : '', `<button class="btn"${at('fltReset')}>초기화</button>`)}
    <div class="lbl" style="padding-top:0">기간</div><div class="seg">${segB('p', 'month', mShort(U.month))}${segB('p', 'prev', '지난 달')}${segB('p', '3m', '3개월')}${segB('p', 'all', '전체')}</div>
    <div class="lbl">구분</div><div class="seg">${segB('t', 'all', '전체')}${segB('t', 'out', '출금')}${segB('t', 'in', '입금')}${segB('t', 'move', '이동')}</div>
    <div class="lbl">카테고리 · 여러 개 선택</div><div class="chips">${S.cats.map(c => `<button class="chip${f.cats.includes(c.n) ? ' on' : ''}" style="min-height:38px;font-size:13px"${at('fltCat', { v: c.n })}>${catLbl(c.n)}</button>`).join('')}</div>
    <button class="bigbtn"${at('close')}>결과 ${cnt}건 보기</button>`);
}
ACT.flt = () => fltSheet();
ACT.fltSet = d => { U.flt = { ...U.flt, [d.k]: d.v }; render(); fltSheet(); };
ACT.fltCat = d => { const c = U.flt.cats.includes(d.v) ? U.flt.cats.filter(x => x !== d.v) : [...U.flt.cats, d.v]; U.flt = { ...U.flt, cats: c }; render(); fltSheet(); };
ACT.fltReset = () => { U.flt = { p: 'month', t: 'all', cats: [] }; render(); fltSheet(); };
ACT.sort = () => { U.sort = U.sort === 'desc' ? 'asc' : 'desc'; render(); toast(U.sort === 'desc' ? '최신 거래가 위로' : '날짜 순서대로'); };
ACT.bal = () => { U.showBal = !U.showBal; render(); };
ACT.search = () => {
  openSheet(`${bh('검색', '메모·카테고리·계좌')}<div class="fld"><input id="qIn" value="${esc(U.q)}" placeholder="예: 스타벅스" autofocus></div>
    <div class="row2" style="margin-top:10px"><button class="btn" style="height:44px"${at('qSet', { clear: 1 })}>지우기</button><button class="btn pri" style="height:44px"${at('qSet')}>검색</button></div>`);
};
ACT.qSet = d => { U.q = d.clear ? '' : $('#qIn').value.trim(); if (U.q && U.flt.p === 'month') U.flt = { ...U.flt, p: 'all' }; closeSheet(); render(); };

/* navigation */
ACT.tab = d => { U.tab = d.v; U.sel = null; if (d.v !== 'accts') U.detail = null; if (d.v !== 'dash' && U.month < ym(S.settings.start)) U.month = ym(S.settings.start); closeSheet(); render(); $('#grid') && ($('#grid').scrollTop = 0); };
ACT.mon = d => {
  const m = addM(U.month, +d.k);
  if (m > ym(TODAY())) return toast('미래 달은 아직 볼 수 없어요');
  if (m < ym(S.settings.start)) { if (!archOf(m)) return toast('더 이전 기록이 없어요'); if (U.tab !== 'dash') return toast('정리된 달은 한눈에 보기에서 요약으로 볼 수 있어요'); }
  U.month = m; render();
};
ACT.recapClose = d => { U.recapSeen = d.m; render(); };
ACT.recapMore = d => { U.tab = 'dash'; U.detail = null; U.month = d.m; render(); };
ACT.closeMenu = () => {
  const ms = closeMonths();
  if (!ms.length) return toast('정리할 지난달이 없어요');
  openSheet(`${bh('오래된 거래 정리', '월 마감')}
    <div class="hint top lg">고른 달까지의 <b>거래를 지우고 달별 요약만</b> 남겨요 (수입·지출, 카테고리별 합계, 투자 수익, 총자산).<br>
    계좌 잔액과 투자 원금은 그대로 이어져요. <b class="neg">지운 거래는 되돌릴 수 없어요.</b></div>
    <div class="acts" style="margin-top:10px">${ms.map(([m, n]) => `<button class="btn"${at('closePick', { m })}>${mLabel(m)}까지 · 거래 ${n}건</button>`).join('')}</div>`);
};
ACT.closePick = d => {
  const n = closeMonths().find(x => x[0] === d.m)?.[1] || 0;
  SH.closeM = d.m;
  openSheet(`${bh(`${mLabel(d.m)}까지 정리`, '되돌릴 수 없어요')}
    <div class="hint top lg">거래 <b>${n}건</b>을 지우고 요약만 남겨요.<br>지우기 전에 백업 파일을 내보내 두는 걸 권해요.</div>
    <button class="bigbtn ghost"${at('exportJson')}>백업 파일 먼저 내보내기</button>
    <button class="bigbtn dan"${at('closeGo')}>정리하기</button><button class="bigbtn ghost"${at('close')}>취소</button>`);
};
ACT.closeGo = () => { const m = SH.closeM; closeSheet(); doClose(m); };
ACT.unit = () => { U.unit = U.unit === 'man' ? 'won' : 'man'; render(); toast(U.unit === 'man' ? '만원 단위로 보기' : '원 단위로 보기'); };
ACT.pickPill = d => {
  if (d.m === 'filter') pickAcct({ title: '계좌 선택', sub: '새 행에 자동으로 들어가요', all: true, cur: U.acct, onPick: v => { U.acct = v; U.sel = null; render(); } });
  else pickAcct({ title: '계좌 선택', cur: U.detail, onPick: v => { if (v) { U.detail = v; render(); } } });
};
ACT.col = d => { U.col = { ...U.col, [d.v]: !U.col[d.v] }; render(); };
ACT.detail = d => { U.detail = d.v; render(); $('#grid').scrollTop = 0; };
ACT.detail2 = d => { U.tab = 'accts'; U.detail = d.v; render(); };
ACT.back = () => { U.detail = null; render(); };
ACT.goInput = d => { U.tab = 'input'; U.detail = null; if ('acct' in d) U.acct = d.acct || null; U.flt = { p: 'month', t: 'all', cats: d.cat ? [d.cat] : [] }; U.q = ''; U.sel = null; render(); };
ACT.goRow = d => { const r = rowById(d.id); if (!r) return; U.tab = 'input'; U.detail = null; U.month = ym(r.date); U.flt = { p: 'month', t: 'all', cats: [] }; U.q = ''; if (U.acct && r.acct !== U.acct && r.to !== U.acct) U.acct = null; U.sel = { id: r.id, k: missing(r) ? (r.amt ? 'cat' : 'amt') : 'amt' }; render(); scrollSel(); };
ACT.goSetAcct = () => { if (U.tab !== 'set') U.prevTab = U.tab; U.tab = 'set'; U.setTab = 'acct'; render(); acctForm(null); };
ACT.setTab = d => { U.setTab = d.v; render(); };
ACT.gear = () => openGear();
ACT.theme = () => { // 자동 → 밝게 → 어둡게 순서로
  const nx = { auto: 'light', light: 'dark', dark: 'auto' }[themePref()];
  try { localStorage.setItem(THK, nx); } catch (e) { }
  applyTheme(); openGear(); toast(`화면 테마: ${{ auto: '자동 (휴대폰 설정)', light: '밝게', dark: '어둡게' }[nx]}`);
};
ACT.bkLater = () => { bkSet({ snooze: addD(TODAY(), 7) }); render(); };
ACT.fixUncat = () => { UQ = uncatQueue(); uncatSheet(0); };
ACT.fixMissing = d => { if (uncatQueue().length) ACT.fixUncat(); else ACT.goRow(d); };
ACT.uncatSet = d => { const i = +d.i, id = UQ[i]; commit(() => { const t = txById(id); if (t) { t.cat = d.v; touch(t); } }); uncatSheet(i + 1); };
ACT.uncatSkip = d => uncatSheet(+d.i + 1);
ACT.importBank = () => { FILEMODE = 'bank'; const f = $('#file'); f.accept = '.csv,text/csv'; f.multiple = false; f.value = ''; f.click(); };
ACT.pinMenu = async () => {
  if (!pinGet()) return showLock('set');
  const bio = await bioAvailable();
  openSheet(`${bh('앱 잠금', bioGet() ? 'PIN + Face ID' : 'PIN')}<div class="acts">
    ${bio ? `<button class="btn${bioGet() ? '' : ' pri'}"${at('bioToggle')}>${bioGet() ? 'Face ID 끄기' : 'Face ID 켜기'}</button>` : ''}
    <button class="btn"${at('lockAfter')}>다시 잠그기: ${LA_LBL[lockAfter()]}</button>
    <button class="btn"${at('pinChange')}>PIN 바꾸기</button><button class="btn dan"${at('pinOff')}>잠금 끄기</button></div>
    ${bio ? '' : '<div class="hint">이 기기에서는 Face ID를 쓸 수 없어요.</div>'}`);
};
ACT.bioToggle = async () => {
  closeSheet();
  if (bioGet()) { localStorage.removeItem(BIOK); return toast('Face ID를 껐어요'); }
  try { await bioEnroll(); toast('Face ID를 켰어요'); } catch (e) { toast('Face ID를 켜지 못했어요'); }
};
ACT.bioUnlock = () => bioUnlock(true);
ACT.lockAfter = () => { const o = ['0', '1', '5', '30', 'launch'], nx = o[(o.indexOf(lockAfter()) + 1) % o.length]; try { localStorage.setItem(LAK, nx); } catch (e) { } ACT.pinMenu(); toast(`다른 앱에 갔다 오면: ${LA_LBL[nx]} 잠금`); };
ACT.pinChange = () => { closeSheet(); LK.change = true; showLock('off'); };
ACT.pinOff = () => { closeSheet(); LK.change = false; showLock('off'); };
ACT.pinKey = d => pinKey(d.k);
ACT.pinCancel = () => { LK.change = false; hideLock(); };
ACT.pinForgot = () => {
  $('#lock').innerHTML = `<div class="lk msg"><div class="lt">PIN을 잊었나요?</div><div class="lm" style="color:var(--ink2);line-height:1.7">PIN은 이 기기에만 있어서 찾을 수 없어요.<br>잠금을 풀려면 이 기기의 가계부를 지워야 해요.<br>백업 파일이 있으면 지운 뒤 불러오세요.</div>
    <button class="bigbtn dan"${at('pinWipe')}>가계부 지우고 잠금 풀기</button><button class="bigbtn ghost"${at('pinBack')}>돌아가기</button></div>`;
};
ACT.pinBack = () => drawLock();
ACT.pinWipe = () => { try { localStorage.removeItem(KEY); localStorage.removeItem(PINK); localStorage.removeItem(BIOK); } catch (e) { } location.reload(); };
ACT.hfix = () => { try { localStorage.setItem(HFK, hfixOn() ? 'off' : 'on'); } catch (e) { } fitHeight(); openGear(); toast(`화면 높이 보정 ${hfixOn() ? '켬' : '끔'}`); };
ACT.appUpdate = async () => {
  toast('최신 버전을 받는 중…');
  try {
    if ('serviceWorker' in navigator) { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); }
    if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); }
  } catch (e) { }
  location.reload();   // 가계부 데이터(localStorage)는 그대로
};
ACT.gearClose = () => closeGear();
ACT.gearGo = d => { if (d.v === 'hfix') return ACT.hfix(); if (d.v === 'theme') return ACT.theme(); if (d.v === 'pinMenu') { closeGear(); return ACT.pinMenu(); } closeGear(); if (d.v === 'openBase') return ACT.openBase(); ACT[d.v] && ACT[d.v]({}); };
ACT.openBase = () => { if (U.tab !== 'set') U.prevTab = U.tab; U.tab = 'set'; U.detail = null; U.sel = null; closeSheet(); render(); $('#grid') && ($('#grid').scrollTop = 0); };
ACT.setDone = () => { U.tab = U.prevTab && U.prevTab !== 'set' ? U.prevTab : 'dash'; render(); };
ACT.undo = () => undo();
ACT.redo = () => redo();
ACT.close = () => closeSheet();
ACT.okSheet = () => { const f = SH.ok; closeSheet(); f && f(); };
ACT.syncMenu = () => Sync.menu();
ACT.signIn = () => Sync.signIn();

/* investment value entry */
ACT.val = d => {
  const a = A(d.id); const cur = getVal(d.id, d.m);
  keypad({ ref: `${esc(a.name)}`, title: `${mLabel(d.m)} 말 평가금액`, init: cur == null ? '' : String(cur), allowEmpty: true, hint: '증권 앱의 원화 평가금액을 그대로 입력하세요. 비우고 완료하면 입력이 지워져요.',
    ok: (v, ex) => commit(() => { S.val[`${d.id}|${d.m}`] = ex === '' ? { del: 1, u: now() } : { v: Math.abs(v), u: now() }; }) });
};
ACT.fxRefresh = () => {
  const curs = [...new Set(S.accounts.filter(a => a.type === 'foreign' && a.cur).map(a => a.cur))];
  if (!curs.length) return toast('해외 자산 계좌가 없어요');
  toast('환율을 가져오는 중…');
  fetch('https://open.er-api.com/v6/latest/KRW', { referrerPolicy: 'no-referrer', credentials: 'omit' }).then(r => r.json()).then(j => {
    if (j.result !== 'success' || !j.rates) throw new Error('rate');
    commit(() => { const fx = { ...S.fx }; for (const c of curs) if (j.rates[c]) fx[c] = 1 / j.rates[c]; fx.at = TODAY(); fx.u = now(); S.fx = fx; });
    toast('환율을 업데이트했어요');
  }).catch(() => toast('환율을 가져오지 못했어요. 계좌 설정에서 직접 입력하세요'));
};

/* ---------- 기본값 설정 입력 창 (계좌 · 정기 결제 · 카테고리) ---------- */
let F = null;
const fv = id => $('#' + id)?.value ?? '';
function acctForm(id) {
  const a = id ? A(id) : null;
  F = a ? { ...a } : { id: null, name: '', type: 'bank', start: 0, fav: false };
  drawAcctForm();
}
function drawAcctForm() {
  const a = F, ty = a.type;
  const segB = TORD.map(k => `<button class="${ty === k ? 'on' : ''}"${at('fType', { v: k })}>${TYPES[k].l}</button>`).join('');
  const startLbl = { bank: '시작 잔액', card: '시작 시점 결제 예정액 (마이너스로, 예: -300000)', prepaid: '시작 잔액', saving: '시작 잔액', invest: '시작 시점 평가금액' }[ty];
  let extra = '';
  if (ty === 'card') extra = `<div class="lbl">결제일 (선택)</div><div class="fld"><input id="fPay" inputmode="numeric" value="${esc(a.payDay || '')}" placeholder="예: 14" data-i="f" data-f="payDay"></div>`;
  if (ty === 'saving') extra = `<div class="lbl">만기일 (선택)</div><div class="fld"><input type="date" id="fMat" value="${esc(a.mat || '')}" data-i="f" data-f="mat"></div>`;
  if (ty === 'invest') extra = `<button class="tog${a.isa ? ' on' : ''}"${at('fTog', { f: 'isa' })}>ISA 계좌 (연 납입 한도 표시)<i></i></button>`;
  if (ty === 'foreign') extra = `<div class="lbl">통화</div><div class="fld"><select id="fCur" data-i="f" data-f="cur">${CURS.map(c => `<option${a.cur === c ? ' selected' : ''}>${c}</option>`).join('')}</select></div>
    <div class="lbl">보유 외화 금액</div><div class="fld"><input id="fFamt" inputmode="decimal" value="${esc(a.famt ?? '')}" placeholder="예: 1500" data-i="f" data-f="famt"></div>
    <div class="lbl">환율 (원, 비우면 '환율 새로고침' 값 사용)</div><div class="fld"><input id="fRate" inputmode="decimal" value="${esc(a.rate ?? '')}" placeholder="예: 1357.9" data-i="f" data-f="rate"></div>`;
  if (ty === 'prepaid') extra = `<div class="lbl">충전해 주는 계좌</div><button class="fld" style="width:calc(100% - 28px);text-align:left"${at('fLink')}><span class="inp" style="display:flex;align-items:center;gap:8px">${a.link && A(a.link) ? `${dotA(A(a.link))}${esc(accName(a.link))}` : '<span class="mut">계좌 선택</span>'}<span style="margin-left:auto;color:var(--muted)">▾</span></span></button>
    <div class="lbl">자동 충전</div><div class="rule">잔액이 <input id="fTh" inputmode="numeric" value="${esc(a.th ?? 10000)}" data-i="f" data-f="th"> 원 이하가 되면<br><input id="fCamt" inputmode="numeric" value="${esc(a.camt ?? 50000)}" data-i="f" data-f="camt"> 원 충전</div>
    <div class="lbl">캐시백</div><div class="rule">사용액의 <input class="sm" id="fCbp" inputmode="decimal" value="${esc(a.cbp ?? 0)}" data-i="f" data-f="cbp"> % · 사용 즉시 적립</div>
    <div class="prev" id="fPrev"></div>`;
  openSheet(`${bh(a.id ? esc(a.name) : '새 계좌', '계좌 설정', `<button class="btn"${at('close')}>취소</button>`)}
    <div class="lbl" style="padding-top:0">이름</div><div class="fld"><input id="fName" maxlength="20" value="${esc(a.name)}" placeholder="예: 생활비통장" data-i="f" data-f="name"></div>
    <div class="lbl">종류</div><div class="seg" style="flex-wrap:wrap">${segB}</div>
    ${ty !== 'foreign' ? `<div class="lbl">${startLbl} · ${S.settings.start} 기준</div><div class="fld"><input id="fStart" inputmode="numeric" value="${esc(a.start ?? 0)}" data-i="f" data-f="start"></div>` : ''}
    ${extra}
    <button class="tog${a.fav ? ' on' : ''}"${at('fTog', { f: 'fav' })}>★ 즐겨찾기 (계좌 선택 창 위쪽)<i></i></button>
    ${a.id ? `<button class="tog${a.hidden ? ' on' : ''}"${at('fTog', { f: 'hidden' })}>숨기기 (목록에서 빼고 기록은 유지)<i></i></button>` : ''}
    <button class="bigbtn"${at('acctSave')}>저장</button>
    ${a.id ? `<button class="bigbtn dan"${at('acctDel')}>계좌 삭제</button>` : ''}`);
  prevUpd();
}
const INP = {};
INP.f = el => { F[el.dataset.f] = el.value; prevUpd(); };
function prevUpd() {
  const el = $('#fPrev'); if (!el || !F) return;
  const st = num(F.start), th = num(F.th), ca = num(F.camt), cb = num(F.cbp), sp = 5400;
  let b = st - sp, n = 0; const b1 = b; while (ca > 0 && b <= th && n < 100) { b += ca; n++; }
  const c = Math.floor(sp * cb / 100); b += c;
  el.innerHTML = `미리보기 · 잔액 <b>${fmt(st)}</b>에서 <b>${fmt(sp)}</b> 사용<br>→ <b>${fmt(b1)}</b>${n ? ` (${fmt(th)} 이하) → <b>+${fmt(n * ca)}</b> 충전` : ''}${c ? ` → <b>+${fmt(c)}</b> 캐시백` : ''} → 잔액 <b>${fmt(b)}</b>`;
}
function readForm() { for (const el of document.querySelectorAll('#sheet-root [data-i="f"]')) F[el.dataset.f] = el.value; }
ACT.fType = d => { readForm(); F.type = d.v; drawAcctForm(); };
ACT.fTog = d => { readForm(); F[d.f] = !F[d.f]; drawAcctForm(); };
ACT.fLink = () => { readForm(); const keep = { ...F }; pickAcct({ title: '충전해 주는 계좌', types: ['bank', 'card'], cur: F.link, exclude: F.id, onPick: v => { F = { ...keep, link: v || '' }; drawAcctForm(); } }); };
ACT.acctSave = () => {
  readForm();
  const name = String(F.name || '').trim();
  if (!name) return toast('이름을 입력하세요');
  if (S.accounts.some(a => a.name === name && a.id !== F.id)) return toast('같은 이름의 계좌가 있어요');
  const o = { ...F, name, start: num(F.start) };
  for (const k of ['th', 'camt', 'cbp', 'payDay', 'famt', 'rate']) if (k in o) o[k] = o[k] === '' ? '' : num(o[k]);
  if (o.type === 'prepaid' && !o.link) toast('충전 계좌가 없으면 자동 충전 행의 출금 계좌가 비어 있어요');
  closeSheet();
  commit(() => {
    if (o.id) { const i = S.accounts.findIndex(a => a.id === o.id); S.accounts[i] = touch(o); }
    else { o.id = uid(); S.accounts.push(touch(o)); }
  });
  toast('저장했어요');
};
ACT.acctDel = () => {
  const id = F.id, n = S.tx.filter(t => t.acct === id || t.to === id).length, r = S.rec.filter(x => x.acct === id || x.to === id).length;
  confirmSheet('계좌 삭제', `<b>${esc(F.name)}</b>을(를) 삭제할까요?${n || r ? `<br>이 계좌의 거래 <b>${n}건</b>${r ? `과 정기 결제 <b>${r}건</b>` : ''}도 함께 삭제돼요.<br>기록을 남기려면 '숨기기'를 쓰세요.` : ''}`, '삭제', () => {
    commit(() => {
      for (const t of S.tx.filter(t => t.acct === id || t.to === id)) removeRec('tx', t.id);
      for (const x of S.rec.filter(x => x.acct === id || x.to === id)) removeRec('rec', x.id);
      for (const a of S.accounts) if (a.link === id) { a.link = ''; touch(a); }
      removeRec('accounts', id);
    });
    if (U.acct === id) U.acct = null; if (U.detail === id) U.detail = null; render();
  }, true);
};
ACT.acctEdit = d => acctForm(d.id);
ACT.acctNew = () => acctForm(null);

function recForm(id) {
  const r = id ? S.rec.find(x => x.id === id) : null;
  F = r ? { ...r } : { id: null, name: '', type: 'out', amt: '', day: '', acct: lastAcct() || '', to: '', cat: '', start: TODAY(), end: '' };
  drawRecForm();
}
function drawRecForm() {
  const r = F, kind = r.type === 'in' ? 'inc' : 'exp';
  const accBtn = (f, l) => `<div class="lbl">${l}</div><button class="fld" style="width:calc(100% - 28px);text-align:left"${at('rPick', { f })}><span class="inp" style="display:flex;align-items:center;gap:8px">${r[f] && A(r[f]) ? `${dotA(A(r[f]))}${esc(accName(r[f]))}` : '<span class="mut">계좌 선택</span>'}<span style="margin-left:auto;color:var(--muted)">▾</span></span></button>`;
  openSheet(`${bh(r.id ? esc(r.name) : '새 정기 결제·이체', '매달 자동 기록', `<button class="btn"${at('close')}>취소</button>`)}
    <div class="lbl" style="padding-top:0">이름</div><div class="fld"><input id="rName" maxlength="20" value="${esc(r.name)}" placeholder="예: 음악 구독" data-i="r" data-f="name"></div>
    <div class="lbl">구분</div><div class="seg">${[['out', '출금'], ['in', '입금'], ['move', '이동']].map(([k, l]) => `<button class="${r.type === k ? 'on' : ''}"${at('rType', { v: k })}>${l}</button>`).join('')}</div>
    <div class="row2" style="padding:0"><div><div class="lbl">금액</div><div class="fld"><input inputmode="numeric" value="${esc(r.amt)}" placeholder="8900" data-i="r" data-f="amt"></div></div>
      <div><div class="lbl">매월 날짜</div><div class="fld"><input inputmode="numeric" value="${esc(r.day)}" placeholder="1~31" data-i="r" data-f="day"></div></div></div>
    ${accBtn('acct', r.type === 'in' ? '들어오는 계좌' : '빠지는 계좌')}
    ${r.type === 'move' ? accBtn('to', '받는 계좌') : `<div class="lbl">카테고리</div><div class="fld"><select data-i="r" data-f="cat"><option value="">선택</option>${S.cats.filter(c => c.k === kind).map(c => `<option${r.cat === c.n ? ' selected' : ''} value="${esc(c.n)}">${catLbl(c.n)}</option>`).join('')}</select></div>`}
    <div class="row2" style="padding:0"><div><div class="lbl">시작일</div><div class="fld"><input type="date" value="${esc(r.start)}" data-i="r" data-f="start"></div></div>
      <div><div class="lbl">종료일 (선택)</div><div class="fld"><input type="date" value="${esc(r.end || '')}" data-i="r" data-f="end"></div></div></div>
    <div class="hint">31일로 정하면 짧은 달에는 말일에 기록돼요.</div>
    <button class="bigbtn"${at('recSave')}>저장</button>${r.id ? `<button class="bigbtn dan"${at('recDel')}>삭제</button>` : ''}`);
}
INP.r = el => { F[el.dataset.f] = el.value; };
const readR = () => { for (const el of document.querySelectorAll('#sheet-root [data-i="r"]')) F[el.dataset.f] = el.value; };
ACT.rType = d => { readR(); F.type = d.v; if (d.v === 'move') F.cat = ''; else F.to = ''; drawRecForm(); };
ACT.rPick = d => { readR(); const keep = { ...F }; pickAcct({ title: d.f === 'to' ? '받는 계좌' : '계좌', cur: F[d.f], exclude: d.f === 'to' ? F.acct : '', onPick: v => { F = { ...keep, [d.f]: v || '' }; drawRecForm(); } }); };
ACT.recSave = () => {
  readR();
  const o = { ...F, name: String(F.name || '').trim(), amt: Math.abs(num(F.amt)), day: Math.round(num(F.day)) };
  if (!o.name) return toast('이름을 입력하세요');
  if (!o.amt) return toast('금액을 입력하세요');
  if (o.day < 1 || o.day > 31) return toast('매월 날짜는 1~31이에요');
  if (!o.acct) return toast('계좌를 고르세요');
  if (o.type === 'move' && !o.to) return toast('받는 계좌를 고르세요');
  if (!isDate(o.start)) return toast('시작일을 입력하세요');
  if (o.end && !isDate(o.end)) o.end = '';
  closeSheet();
  commit(() => { if (o.id) { const i = S.rec.findIndex(x => x.id === o.id); S.rec[i] = touch(o); } else { o.id = uid(); S.rec.push(touch(o)); } });
  toast('저장했어요');
};
ACT.recDel = () => { const id = F.id; confirmSheet('정기 결제 삭제', '이 항목을 삭제할까요? 이미 자동으로 기록된 행도 함께 사라져요.', '삭제', () => commit(() => removeRec('rec', id)), true); };
ACT.recEdit = d => recForm(d.id);
ACT.recNew = () => recForm(null);

function catForm(id, kind, txId) {
  const c = id ? S.cats.find(x => x.id === id) : null;
  F = c ? { ...c, old: c.n } : { id: null, n: '', i: '', k: kind || 'exp', tx: txId };
  openSheet(`${bh(c ? esc(c.n) : '새 카테고리', c ? (c.k === 'exp' ? '지출' : '수입') : '')}
    <div class="row2" style="padding:0"><div style="flex:0 0 90px"><div class="lbl">아이콘 (선택)</div><div class="fld" style="margin-right:0"><input id="cIc" maxlength="2" value="${esc(F.i)}" style="text-align:center"></div></div>
    <div><div class="lbl">이름</div><div class="fld" style="margin-left:0"><input id="cNm" maxlength="12" value="${esc(F.n)}" placeholder="예: 반려동물" autofocus></div></div></div>
    ${c ? '' : `<div class="lbl">종류</div><div class="seg">${[['exp', '지출'], ['inc', '수입']].map(([k, l]) => `<button class="${F.k === k ? 'on' : ''}"${at('cKind', { v: k })}>${l}</button>`).join('')}</div>`}
    ${F.k === 'exp' ? `<div class="lbl">월 예산 (선택)</div><div class="fld"><input id="cBud" inputmode="numeric" value="${+F.b ? fmt(F.b) : ''}" placeholder="비우면 예산 없음"></div>` : ''}
    <button class="bigbtn"${at('catSave')}>저장</button>${c ? `<button class="bigbtn dan"${at('catDel')}>삭제</button>` : ''}`);
}
ACT.cKind = d => { const n = fv('cNm'), i = fv('cIc'), tx = F.tx; catForm(null, d.v, tx); $('#cNm').value = n; $('#cIc').value = i; };
ACT.catSave = () => {
  const n = fv('cNm').trim(), i = fv('cIc').trim(), b = Math.abs(num(fv('cBud')));
  if (!n) return toast('이름을 입력하세요');
  if (S.cats.some(c => c.n === n && c.id !== F.id)) return toast('같은 이름이 있어요');
  const f = F; closeSheet();
  commit(() => {
    if (f.id) {
      const c = S.cats.find(x => x.id === f.id); Object.assign(c, { n, i, b }); touch(c);
      if (f.old !== n) { for (const t of S.tx) if (t.cat === f.old) { t.cat = n; touch(t); } for (const r of S.rec) if (r.cat === f.old) { r.cat = n; touch(r); } }
    } else { S.cats.push(touch({ id: uid(), n, i, b, k: f.k })); if (f.tx) { const t = txById(f.tx); if (t) { t.cat = n; touch(t); } } }
  });
};
ACT.catDel = () => {
  const f = F, used = S.tx.filter(t => t.cat === f.n).length;
  confirmSheet('카테고리 삭제', `<b>${esc(f.n)}</b>을(를) 삭제할까요?${used ? `<br>이 카테고리를 쓴 거래 <b>${used}건</b>은 빈 칸이 돼요.` : ''}`, '삭제', () => commit(() => {
    for (const t of S.tx) if (t.cat === f.n) { t.cat = ''; touch(t); }
    removeRec('cats', f.id);
  }), true);
};
ACT.catEdit = d => catForm(d.id);
ACT.catNew = d => { if (d.tx) closeSheet(); catForm(null, d.kind, d.tx); };

ACT.setStart = () => {
  openSheet(`${bh('시작일', '잔액 기준일')}<div class="hint top">계좌의 '시작 잔액'이 이날 기준이에요. 이날 이전 거래는 계산에서 빠져요.</div>
    <div class="fld" style="margin-top:8px"><input type="date" id="stIn" value="${S.settings.start}"></div><button class="bigbtn"${at('setStartOk')}>저장</button>`);
};
ACT.setStartOk = () => { const v = fv('stIn'); if (!isDate(v)) return toast('날짜를 확인하세요'); closeSheet(); commit(() => { S.settings = { ...S.settings, start: v, u: now() }; }); };
ACT.setIsa = () => keypad({ ref: 'ISA', title: '연 납입 한도', init: String(S.settings.isaLimit), ok: v => commit(() => { S.settings = { ...S.settings, isaLimit: Math.abs(v), u: now() }; }) });

/* ---------- 데이터: 새로 시작 · 초기화 · 백업 · 가져오기 ---------- */
ACT.startNew = () => { S = blankState(); persist(); U.tab = 'set'; U.setTab = 'acct'; render(); acctForm(null); };
ACT.reset = () => confirmSheet('이 기기 데이터 초기화', '이 기기에 저장된 가계부를 모두 지울까요?<br>로그인 동기화 중이면 클라우드 데이터는 남아 있어요.', '초기화', () => {
  try { localStorage.removeItem(KEY); } catch (e) { }
  S = null; hist.length = 0; fut.length = 0; invalidate(); Sync.onReset && Sync.onReset(); render();
}, true);
ACT.exportJson = () => {
  const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `셀가계부_백업_${TODAY()}.json`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  bkSet({ last: TODAY(), snooze: '' }); toast('백업 파일을 저장했어요'); if (S) render();
};
let FILEMODE = '';
ACT.importJson = () => { FILEMODE = 'json'; const f = $('#file'); f.accept = '.json,application/json'; f.multiple = false; f.value = ''; f.click(); };
ACT.importCsv = () => { FILEMODE = 'csv'; const f = $('#file'); f.accept = '.csv,text/csv'; f.multiple = true; f.value = ''; f.click(); };
async function onFiles(files) {
  if (!files.length) return;
  if (FILEMODE === 'json') {
    try {
      const d = JSON.parse(await files[0].text());
      if (!d || !Array.isArray(d.accounts) || !Array.isArray(d.tx)) throw 0;
      const go = () => { const old = S; if (old) hist.push(JSON.stringify(old)); S = stampAll(normalize(d)); if (old) for (const c of COLLS) for (const x of old[c]) if (!S[c].some(y => y.id === x.id)) S.del[x.id] = now(); delete S.demo; invalidate(); persist(); render(); toast(`불러왔어요 · 거래 ${S.tx.length}건`); };
      if (S && (S.tx.length || S.accounts.length)) confirmSheet('백업 불러오기', '지금 가계부를 이 백업 파일로 <b>바꿀까요?</b>', '바꾸기', go, true); else go();
    } catch (e) { toast('셀가계부 백업 파일이 아니에요'); }
    return;
  }
  if (FILEMODE === 'bank') {
    const p = bankParse(parseCsv(await readText(files[0])));
    if (!p.items.length) return openSheet(`${bh('내역 가져오기')}<div class="hint top lg">날짜와 금액 열을 찾지 못했어요.<br>은행·카드 앱에서 거래내역을 <b>CSV</b>로 받아 주세요. 엑셀(xlsx) 파일이면 엑셀에서 'CSV로 저장'한 뒤 고르면 돼요.</div><button class="bigbtn"${at('close')}>확인</button>`);
    return pickAcct({ title: '어느 계좌의 내역인가요?', sub: `거래 ${p.items.length}건`, onPick: id => {
      if (!id) return;
      const r = bankImport(p.items, id);
      openSheet(`${bh('내역 가져오기 결과', esc(accName(id)))}<div class="hint top lg">추가 ${r.add}건${r.dup ? `<br>이미 있는 거래 ${r.dup}건은 건너뛰었어요` : ''}${r.early ? `<br>시작일 이전 ${r.early}건은 잔액 계산에서 빠져요` : ''}${r.unc ? `<br>카테고리를 못 정한 거래 ${r.unc}건` : ''}</div>
        ${r.unc ? `<button class="bigbtn"${at('fixUncat')}>미분류 정리하기</button>` : ''}<button class="bigbtn ghost"${at('close')}>확인</button>`);
    } });
  }
  const texts = []; for (const f of files) texts.push(await readText(f));
  if (!S) S = blankState();
  hist.push(JSON.stringify(S));
  const rep = importCsv(texts.map(parseCsv));
  S.demo = false; invalidate(); persist(); if (S.tx.length || S.accounts.length) { U.tab = 'dash'; } render();
  openSheet(`${bh('가져오기 결과')}<div class="hint top lg">${rep.join('<br>') || '가져올 내용을 찾지 못했어요. 구글 시트의 탭을 CSV로 받았는지 확인하세요.'}</div><button class="bigbtn"${at('close')}>확인</button>`);
}
function stampAll(s) { const t = now(); for (const c of COLLS) for (const x of s[c]) x.u = t; for (const c of MAPS) for (const k in s[c]) s[c][k].u = t; s.settings.u = t; s.fx.u = t; return s; }
function parseCsv(t) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(x => x.trim()));
}
function toDate(s) {
  s = String(s || '').trim(); let m;
  if ((m = s.match(/^(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/))) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return `${m[3]}-${pad2(m[1])}-${pad2(m[2])}`;
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})(?:\D|$)/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if (/^\d{5}$/.test(s)) { const d = new Date(Date.UTC(1899, 11, 30) + (+s) * 864e5); return d.toISOString().slice(0, 10); }
  return '';
}
const TYPE_KO = { '입출금': 'bank', '카드': 'card', '충전식': 'prepaid', '적금': 'saving', '투자': 'invest', '해외': 'foreign' };
function ensureAcct(name, type = 'bank') {
  name = String(name || '').trim(); if (!name) return '';
  let a = S.accounts.find(x => x.name === name);
  if (!a) { a = touch({ id: uid(), name, type, start: 0 }); S.accounts.push(a); }
  return a.id;
}
function ensureCat(n, kind) { if (n && !catOf(n)) S.cats.push(touch({ id: uid(), n, i: '·', k: kind })); }
function importCsv(sheets) {
  const rep = [];
  // 1) 설정·월말잔액 먼저 (계좌 종류·시작 잔액)
  for (const rows of sheets) {
    if (!rows.some(r => r.some(c => c === '시작 잔액') || r.some(c => c === '정기 결제·이체 (매달 자동 기록)'))) continue;
    let na = 0, nr = 0;
    for (const r of rows) {
      if (r[0] === '시작일' && toDate(r[1])) { S.settings = { ...S.settings, start: toDate(r[1]), u: now() }; rep.push(`시작일: ${S.settings.start}`); }
      if (r[0] === 'ISA 연 납입한도' && num(r[1])) S.settings.isaLimit = num(r[1]);
      if ((r[7] === '지출' || r[7] === '수입') && r[6] && r[6] !== '카테고리') ensureCat(r[6], r[7] === '수입' ? 'inc' : 'exp');
      const ty = TYPE_KO[r[1]];
      if (ty && r[0] && r[0] !== '계좌' && r[0] !== '해외 자산') {
        const id = ensureAcct(r[0], ty), a = A(id); a.type = ty;
        if (ty === 'foreign') { a.famt = num(r[2]); a.cur = (r[3] || '').toUpperCase(); if (num(r[4])) a.rate = num(r[4]); }
        else { a.start = num(r[2]); if (ty === 'saving' && toDate(r[3])) a.mat = toDate(r[3]); if (ty === 'invest' && /ISA/i.test(r[0])) a.isa = true; }
        touch(a); na++;
      }
    }
    const hi = rows.findIndex(r => r[0] === '이름' && r[1] === '구분' && r[2] === '금액');
    if (hi >= 0) for (const r of rows.slice(hi + 1)) {
      if (!r[0] || !num(r[2])) continue;
      const type = r[1] === '입금' ? 'in' : r[1] === '내 계좌로 이동' ? 'move' : 'out';
      const x = { id: uid(), name: r[0], type, amt: num(r[2]), day: num(r[3]), acct: ensureAcct(r[4]), to: type === 'move' ? ensureAcct(r[5]) : '', cat: type === 'move' ? '' : (r[6] || ''), start: toDate(r[7]) || S.settings.start, end: toDate(r[8]) || '' };
      if (x.cat) ensureCat(x.cat, type === 'in' ? 'inc' : 'exp');
      S.rec.push(touch(x)); nr++;
    }
    if (na || nr) rep.push(`설정: 계좌 ${na}개, 정기 결제 ${nr}건`);
  }
  // 2) 입력
  for (const rows of sheets) {
    const h = rows[0] || []; if (!(h.includes('날짜') && h.includes('계좌') && h.includes('금액') && h.includes('구분'))) continue;
    const ix = k => h.indexOf(k); let n = 0, skip = 0;
    for (const r of rows.slice(1)) {
      const d = toDate(r[ix('날짜')]), amt = Math.abs(num(r[ix('금액')]));
      if (!d || !amt || !r[ix('계좌')]) { if (r.some(Boolean)) skip++; continue; }
      const g = r[ix('구분')], type = g === '입금' ? 'in' : (g === '내 계좌로 이동' || g === '이동') ? 'move' : 'out';
      const cat = type === 'move' ? '' : (r[ix('카테고리')] || '');
      if (cat) ensureCat(cat, type === 'in' ? 'inc' : 'exp');
      S.tx.push(touch({ id: uid(), date: d, acct: ensureAcct(r[ix('계좌')]), type, amt, cat, to: type === 'move' ? ensureAcct(r[ix('받는 계좌')]) : '', memo: ix('메모') >= 0 ? (r[ix('메모')] || '') : '' }));
      n++;
    }
    rep.push(`입력: 거래 ${n}건${skip ? ` (빈 줄 등 ${skip}건 건너뜀)` : ''}`);
  }
  // 3) 투자 기록 (월말 평가금액)
  for (const rows of sheets) {
    const hi = rows.findIndex(r => r[0] === '가계월'); if (hi < 1) continue;
    const H = rows[hi], names = rows[hi - 1]; let n = 0;
    H.forEach((c, j) => {
      if (c !== '월말 평가금액') return;
      let k = j; while (k > 0 && !names[k]) k--; const nm = names[k]; if (!nm) return;
      const a = S.accounts.find(x => x.name === nm) || A(ensureAcct(nm, 'invest'));
      for (const r of rows.slice(hi + 1)) { const m = String(r[0] || '').match(/(\d{4})년\s*(\d{1,2})월/); if (!m) continue; const v = num(r[j]); if (v) { S.val[`${a.id}|${m[1]}-${pad2(m[2])}`] = { v, u: now() }; n++; } }
    });
    if (n) rep.push(`투자 기록: 월말 평가 ${n}건`);
  }
  return rep;
}

INP.qe = qeInput;
ACT.qadd = qeAdd;

/* ---------- boot ---------- */
document.addEventListener('pointerdown', e => {
  const b = e.target.closest && e.target.closest('#lock [data-a="pinKey"]'); if (!b) return;
  e.preventDefault(); b.classList.add('pr'); setTimeout(() => b.classList.remove('pr'), 120); pinKey(b.dataset.k);
});
document.addEventListener('click', e => {
  const t = e.target.closest('[data-a]'); if (!t) return;
  if (t.dataset.a === 'pinKey' && window.PointerEvent) return; // 이미 pointerdown에서 처리
  const f = ACT[t.dataset.a]; if (!f) return;
  e.preventDefault(); f(t.dataset, t, e);
});
document.addEventListener('focusin', e => { if (e.target.matches && e.target.matches('#qeDate')) setTimeout(() => e.target.select(), 0); });
document.addEventListener('input', e => { const t = e.target.closest('[data-i]'); if (t && INP[t.dataset.i]) INP[t.dataset.i](t); });
document.addEventListener('keydown', e => {
  if ($('#lock')?.classList.contains('on')) { if (/^\d$/.test(e.key)) pinKey(e.key); else if (e.key === 'Backspace') pinKey('⌫'); return; }
  if (e.key === 'Escape' && $('#sheet-root').classList.contains('on')) closeSheet();
  else if (e.key === 'Escape' && $('#modal-root')?.classList.contains('on')) closeGear();
  if (e.key === 'Enter' && e.target.matches('#mIn')) ACT.setMemo({ id: $('[data-a="setMemo"]').dataset.id });
  if (e.key === 'Enter' && e.target.matches('#qIn')) ACT.qSet({});
  if (e.key === 'Enter' && e.target.matches('#qeIn')) { e.preventDefault(); ACT.qadd(); }
  if (e.key === 'Enter' && e.target.matches('#qeDate')) { e.preventDefault(); $('#qeIn')?.focus(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.target.matches('input')) { e.preventDefault(); undo(); }
});
window.addEventListener('resize', fitHeight);
window.addEventListener('orientationchange', () => setTimeout(fitHeight, 300));
window.addEventListener('pageshow', fitHeight);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { LK.hiddenAt = Date.now(); return; }
  fitHeight();
  const la = lockAfter();
  if (pinGet() && !LK.mode && la !== 'launch' && Date.now() - LK.hiddenAt >= (+la) * 60000) showLock('unlock');
});
document.addEventListener('DOMContentLoaded', () => {
  fitHeight();
  if (pinGet()) showLock('unlock');
  $('#file').addEventListener('change', e => onFiles([...e.target.files]));
  S = load();
  if (S && U.month > ym(TODAY())) U.month = ym(TODAY());
  render();
  if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey) {
    import('./sync.js').then(m => m.init({
      get: () => S, set: s => { S = s; invalidate(); persist(false); render(); }, merge: mergeState, normalize, blank: blankState,
      render, toast, openSheet, closeSheet, confirmSheet, Sync, esc, at, bh, ACT,
      clear: () => { try { localStorage.removeItem(KEY); } catch (e) { } S = null; hist.length = 0; fut.length = 0; invalidate(); render(); },
    })).catch(err => { console.error(err); Sync.status = 'err'; Sync.label = () => '동기화 모듈을 불러오지 못했어요'; render(); });
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !TESTMODE) {
    const had = !!navigator.serviceWorker.controller; let reloaded = false;
    // 새 버전이 설치돼 이 화면을 맡게 되면 한 번 새로고침해서 바로 적용
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => { });
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
});
// 자동 점검(test.html)용 연결 고리
window.__cb = { get S() { return S; }, U, ACT, parseQuick, doClose, valueAt, recapCard, render, led, groups, mstats, invSeries, calc, mergeState, importCsv, parseCsv, balAt,
  util: { blankState, TODAY, mRange, addM, addD, ym }, applyTheme, fmtU, guessCat, bankParse, bankImport, uncatQueue, showLock, pinGet, load: x => { S = normalize(x); hist.length = 0; fut.length = 0; invalidate(); persist(); render(); } };
