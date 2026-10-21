'use strict';
// 데이터: 기본 함수, 저장 형식, 병합, 되돌리기, 거래 목록(정기 결제·자동 충전·캐시백) 계산
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
  deposit: { l: '예금', c: '#5C6BC0', g: 'cash' },
  invest: { l: '투자', c: '#C98A00', g: 'invest' },
  foreign: { l: '해외', c: '#7A4FB0', g: 'foreign' },
};
const TORD = Object.keys(TYPES);
// 계좌 색: 직접 고른 색이 없으면 종류 색. 밝은·어두운 화면 모두에서 보이는 색만
const ACOLORS = ['#2E8B57', '#4CAF50', '#8A9A2E', '#1B8A8F', '#00A3C4', '#2F80ED', '#3D5A80', '#5C6BC0',
  '#7A4FB0', '#B04FA0', '#E0507A', '#C0504D', '#E07B39', '#C98A00', '#8B5E3C', '#6B7785'];
const colorOf = a => a?.color || TYPES[a?.type]?.c || '#888888';
const GROUPS = { cash: { l: '현금·적금', c: '#2E8B57' }, invest: { l: '투자', c: '#C98A00' }, foreign: { l: '해외 자산', c: '#7A4FB0' } };
const TXL = { out: '출금', in: '입금', move: '이동', adj: '조정' };
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
let keepAsked = false;
function persist(sync = true) {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('저장에 실패했어요. 기기 저장 공간을 확인하세요'); }
  if (!keepAsked) { keepAsked = true; navigator.storage?.persist?.().catch(() => { }); } // 브라우저에 기록 보존 요청 (공간이 모자라도 지우지 않게)
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

// 계좌 시작 잔액 (충전식은 충전금 + 캐시백)
const startBal = a => (+a?.start || 0) + (a?.type === 'prepaid' ? +a.cbStart || 0 : 0);
// 이 결제에 쓰는 캐시백: '결제 때 먼저'면 가능한 만큼, '따로 모았다가'면 거래에 표시한 만큼
const cbModeOf = a => a.cbMode || (S.settings.cbAuto ? 'first' : 'keep'); // 계좌 설정이 없으면 기본값 스위치
function cbUseOf(a, r, cb) {
  const lim = Math.max(0, Math.min(cb, r.amt));
  if (cbModeOf(a) === 'first') return r.cbUse === 'none' ? 0 : lim; // 이 결제만 빼기
  return r.cbUse === 'max' ? lim : Math.min(lim, +r.cbUse || 0);
}
// 이자 받는 날: 매달 ○일, 또는 셋째 토요일 다음 날
function intDay(a, m) {
  if (a.irule === 'sat3') { const [y, mo] = m.split('-').map(Number), w = new Date(y, mo - 1, 1).getDay(); return `${m}-${pad2(1 + (6 - w + 7) % 7 + 15)}`; }
  return `${m}-${pad2(Math.min(+a.iday || 1, lastDay(m)))}`;
}
// 적금·예금: 이자는 기본으로 만기에 한 번에 (넣은 날부터 만기까지 날수만큼, 단리)
const isTerm = a => a.type === 'saving' || a.type === 'deposit';
const matPay = a => isTerm(a) && (a.ipay || 'mat') === 'mat';
const hasInt = a => +a.irate > 0 && (a.type === 'bank' || a.type === 'prepaid' || (isTerm(a) && a.ipay === 'month')); // 매달 받는 이자
const hasMat = a => matPay(a) && !!a.mat && (+a.irate > 0 || !!a.mto); // 만기 이자 · 만기 후 옮기기
// 이자 세금: 소득세 14% + 지방소득세(소득세의 10%), 각각 10원 미만 버림 (은행 방식)
const afterTax = g => { const t1 = Math.floor(g * .14 / 10) * 10, t2 = Math.floor(t1 * .1 / 10) * 10; return g - t1 - t2; };
const dayGap = (x, y) => Math.round((Date.parse(y) - Date.parse(x)) / 864e5);
// 시작일 전에 가입한 적금·예금: 시작일 전까지 쌓인 (원금 × 날수)
function preSum(a, st) {
  if (!a.open || a.open >= st) return 0;
  let sum = 0, cnt = 0;
  if (a.type === 'saving' && +a.mamt > 0 && +a.mday) for (let m = ym(a.open), g = 0; g < 600; m = addM(m, 1), g++) {
    const d = `${m}-${pad2(Math.min(+a.mday, lastDay(m)))}`; if (d >= st) break; if (d < a.open) continue; sum += +a.mamt * dayGap(d, st); cnt++;
  }
  const rest = startBal(a) - cnt * (+a.mamt || 0); if (rest > 0) sum += rest * dayGap(a.open, st);
  return sum;
}
/* ---------- ledger: 입력 + 정기 결제 + 충전식 자동 행 ---------- */
function delta(r, id) {
  if (r.type === 'out') return r.acct === id ? -r.amt : 0;
  if (r.type === 'in') return r.acct === id ? r.amt : 0;
  if (r.type === 'adj') return r.acct === id ? r.amt : 0; // 잔액 조정 (+/-)
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
  for (const a of S.accounts) { // 적금 매달 자동 납입 (만기일 전까지)
    if (a.type !== 'saving' || !(+a.mamt > 0) || !(+a.mday) || !A(a.mfrom)) continue;
    const open = a.open || st;
    for (let m = ym(open), g = 0; m <= ym(today) && g < 600; m = addM(m, 1), g++) {
      const d = `${m}-${pad2(Math.min(+a.mday, lastDay(m)))}`;
      if (d < open || d < st || d > today || (a.mat && d >= a.mat)) continue;
      const id = `dep:${a.id}:${m}`, o = ovOf(id); if (o?.hidden) continue;
      rows.push({ id, date: d, acct: a.mfrom, type: 'move', to: a.id, amt: o?.amt ?? +a.mamt, cat: '', memo: `${a.name} 납입`, auto: 'dep', src: a.id, seq: 1e7 });
    }
  }
  rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.seq - b.seq);
  const pp = S.accounts.filter(a => a.type === 'prepaid'), ia = S.accounts.filter(hasInt), ma = S.accounts.filter(hasMat);
  if (!pp.length && !ia.length && !ma.length) return rows;
  const bal = {}, cbb = {}; for (const a of [...pp, ...ia, ...ma]) bal[a.id] = startBal(a); for (const a of pp) cbb[a.id] = +a.cbStart || 0; // bal = 잔액(충전식은 충전금 + 캐시백), cbb = 캐시백
  const out = [];
  const snap = r => { for (const id of [r.acct, r.to]) if (id in cbb) (r._pp ||= {})[id] = [bal[id] - cbb[id], cbb[id]]; }; // 충전식 줄마다 [충전금, 캐시백]
  // 이자: 지난 이자 날부터 이번 이자 날 전날까지 하루하루 잔액의 합 × 연 이율 ÷ 365 (은행·파킹통장·CMA 방식, 세금 15.4% 뗌이 기본)
  const IS = {}; for (const a of [...ia, ...ma]) IS[a.id] = { sum: preSum(a, st), last: st }; // sum: 잔액 × 날수
  const days = dayGap;
  const tick = (id, date) => { const s = IS[id]; if (!s || date <= s.last) return; s.sum += Math.max(0, bal[id]) * days(s.last, date); s.last = date; }; // 잔액이 바뀌기 전에 호출
  const ev = [];
  for (const a of ia) for (let m = ym(st), g = 0; m <= ym(today) && g < 600; m = addM(m, 1), g++) { const d = intDay(a, m); if (d >= st && d <= today) ev.push({ d, a, m }); }
  for (const a of ma) if (a.mat >= st && a.mat <= today) ev.push({ d: a.mat, a, m: 'mat' });
  ev.sort((x, y) => x.d < y.d ? -1 : x.d > y.d ? 1 : 0);
  const payInt = e => {
    const a = e.a, mat = e.m === 'mat', id = `int:${a.id}:${e.m}`, o = ovOf(id); tick(a.id, e.d);
    const s = IS[a.id], yr = +a.irate * (a.iunit === 'm' && !mat ? 12 : 1), gross = Math.floor(s.sum * yr / 100 / 365), calc = a.itax === false ? gross : afterTax(gross); s.sum = 0;
    const amt = o?.hidden ? 0 : o?.amt ?? calc;
    if (amt > 0) {
      const row = { id, date: e.d, acct: a.id, type: 'in', amt, cat: catOf('이자') ? '이자' : catOf('기타수입') ? '기타수입' : '', to: '', memo: mat ? `이자 만기 연 ${+a.irate}%` : `이자 ${a.iunit === 'm' ? '월' : '연'} ${+a.irate}%`, auto: 'int', src: a.id };
      out.push(row); bal[a.id] += amt; snap(row);
    }
    if (mat && A(a.mto)) { // 만기: 원금 + 이자를 정한 계좌로
      const id2 = `matx:${a.id}`, o2 = ovOf(id2), amt2 = o2?.hidden ? 0 : o2?.amt ?? bal[a.id];
      if (amt2 > 0) { tick(a.mto, e.d); const row2 = { id: id2, date: e.d, acct: a.id, type: 'move', to: a.mto, amt: amt2, cat: '', memo: '만기 해지', auto: 'matx', src: a.id }; out.push(row2); bal[a.id] -= amt2; if (a.mto in bal) bal[a.mto] += amt2; snap(row2); }
    }
  };
  const charge = (id, a, r, n, M) => { // 충전 행 추가 (n회 × M원)
    const o = ovOf(id); if (o?.hidden) return;
    const amt = o?.amt ?? n * M;
    const row = { id, date: r.date, acct: a.link || '', type: 'move', to: a.id, amt, cat: '', memo: n > 1 ? `자동 충전 ×${n}` : '자동 충전', auto: 'chg', src: a.id, parent: r.id };
    tick(a.id, r.date); tick(a.link, r.date); out.push(row); bal[a.id] += amt; if (a.link in bal) bal[a.link] -= amt; snap(row);
  };
  for (const r of rows) {
    while (ev.length && ev[0].d <= r.date) payInt(ev.shift()); // 그날 거래보다 먼저
    const pa = r.date >= st && r.type === 'out' && (r.acct in cbb) ? A(r.acct) : null;
    const M = pa ? +pa.camt || 0 : 0;
    const use = pa ? cbUseOf(pa, r, cbb[pa.id]) : 0;
    if (pa && M > 0) { // 충전금이 (결제액 − 쓰는 캐시백)보다 모자라면 결제 전에 먼저 충전
      let n = 0, b = bal[pa.id] - cbb[pa.id]; while (b < r.amt - use && n < 100) { b += M; n++; }
      if (n) charge('chgp:' + r.id, pa, r, n, M);
    }
    out.push(r);
    if (r.date < st) continue;
    for (const id in bal) { const dl = delta(r, id); if (dl) { tick(id, r.date); bal[id] += dl; } }
    if (r.type === 'adj' && r.pool === 'cb' && r.acct in cbb) cbb[r.acct] += r.amt; // 캐시백 조정
    if (pa) { cbb[pa.id] -= use; if (use) r._cbUse = use; }
    snap(r);
    if (!pa) continue;
    const T = +pa.th || 0, P = +pa.cbp || 0;
    if (M > 0) { // 결제 후 충전금이 기준 이하면 충전
      let n = 0, b = bal[pa.id] - cbb[pa.id]; while (b <= T && n < 100) { b += M; n++; }
      if (n) charge('chg:' + r.id, pa, r, n, M);
    }
    if (P > 0) {
      const id = 'cb:' + r.id, o = ovOf(id);
      if (!o?.hidden) {
        const p = o?.pct ?? P, amt = o?.amt ?? Math.floor(r.amt * p / 100);
        if (amt > 0) { const row = { id, date: r.date, acct: pa.id, type: 'in', amt, cat: '캐시백', to: '', memo: `캐시백 ${p}%`, auto: 'cb', src: pa.id, parent: r.id, pct: p }; tick(pa.id, r.date); out.push(row); bal[pa.id] += amt; cbb[pa.id] += amt; snap(row); }
      }
    }
  }
  while (ev.length) payInt(ev.shift());
  return out;
}
const rowById = id => led().find(r => r.id === id);
// 적금·예금 만기 예상: 지금까지의 거래 + 남은 자동 납입으로 만기까지 (원금 × 날수)를 더해 계산
function matPlan(a) {
  if (!isTerm(a) || !a.mat) return null;
  const st = S.settings.start, T = TODAY(), ch = [];
  for (const r of led()) { if (r.date < st || r.date >= a.mat) continue; const dl = delta(r, a.id); if (dl) ch.push([r.date, dl]); }
  let N = 0, done = 0;
  if (a.type === 'saving' && +a.mamt > 0 && +a.mday) { const open = a.open || st;
    for (let m = ym(open), g = 0; g < 600; m = addM(m, 1), g++) { const d = `${m}-${pad2(Math.min(+a.mday, lastDay(m)))}`; if (d >= a.mat) break; if (d < open) continue; N++; if (d > T) { if (A(a.mfrom)) ch.push([d, +a.mamt]); } else if (d >= st && !ovOf(`dep:${a.id}:${m}`)?.hidden) done++; } }
  ch.sort((x, y) => x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0);
  let bal = startBal(a), last = st, sum = preSum(a, st);
  for (const [d, dl] of ch) { if (d > last) { sum += Math.max(0, bal) * dayGap(last, d); last = d; } bal += dl; }
  if (a.mat > last) sum += Math.max(0, bal) * dayGap(last, a.mat);
  const gross = Math.floor(sum * (+a.irate || 0) / 100 / 365), net = a.itax === false ? gross : afterTax(gross);
  return { principal: bal, gross, interest: net, total: bal + net, N, done, dday: dayGap(T, a.mat) };
}
// 충전식 계좌의 [충전금, 캐시백]
function poolsAt(id, upto) {
  const a = A(id); let p = [+a?.start || 0, +a?.cbStart || 0];
  for (const r of led()) { if (r.date > upto) break; if (r._pp?.[id]) p = r._pp[id]; }
  return p;
}
function balAt(id, upto) {
  const a = A(id); let b = startBal(a); const st = S.settings.start;
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
