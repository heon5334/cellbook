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
const sumV = o => Object.values(o).reduce((x, y) => x + y, 0); // 객체 값 합계
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
const GROUPS = { cash: { l: '현금·예적금', c: '#2E8B57' }, invest: { l: '투자', c: '#C98A00' }, foreign: { l: '해외 자산', c: '#7A4FB0' } };
const TXL = { out: '출금', in: '입금', move: '이동', adj: '조정', fx: '환전' };
const CURS = ['USD', 'JPY', 'EUR', 'CNY', 'VND', 'GBP', 'AUD', 'CAD', 'HKD', 'TWD', 'THB'];
const DEF_CATS = [['식비·생활', 'exp'], ['커피·디저트', 'exp'], ['주거·공과금', 'exp'], ['교통', 'exp'], ['쇼핑', 'exp'], ['구독료', 'exp'], ['여가', 'exp'],
  ['사람', 'exp'], ['기타', 'exp'], ['월급', 'inc'], ['기타수입', 'inc'], ['캐시백', 'inc']];
const OLD_DEF_IC = new Set(['🍚', '☕', '🏠', '🚌', '🛍', '🔁', '🎬', '🎁', '·', '💼', '➕', '🎉']);
const COLLS = ['accounts', 'cats', 'tx', 'rec'];
const MAPS = ['val', 'ov', 'arch', 'fxh']; // fxh: 날짜별 환율 이력

const VER = 4; // 2 → 3: 거래에 tags·link·ok, 설정에 budget·remind / 3 → 4: 외화(거래 cur·famt·rate·side, 계좌 fstart·chg·fxAuto·frate, 정기 결제 cur·famt, 환율 이력 fxh), 투자 시작일 invStart, 평가 입력 예수금 c
function blankState() {
  // 기본값은 u:0 — 다른 기기의 실제 데이터보다 항상 오래된 것으로 취급(동기화 시 덮어쓰지 않도록)
  return { ver: VER, settings: { start: TODAY(), invStart: mRange(ym(TODAY()))[0], isaLimit: 20000000, budget: 0, remind: 3, u: 0 }, accounts: [], cats: DEF_CATS.map(([n, k], j) => ({ id: 'c' + j, n, i: '', k, u: 0 })),
    tx: [], rec: [], val: {}, ov: {}, arch: {}, fxh: {}, fx: { u: 0 }, del: {} };
}
// 선택 입력 숫자 칸: 빈 칸·잘못된 값은 null로 통일 (예전 백업은 '' 로 저장돼 있음)
const OPT_NUM = ['th', 'camt', 'cbp', 'cbStart', 'payDay', 'famt', 'rate', 'frate', 'irate', 'iday', 'mamt', 'mday', 'prin'];
const CUR_OK = c => /^[A-Z]{3}$/.test(c) && c !== 'KRW';
const optNum = v => v === '' || v == null ? null : Number.isFinite(+v) ? +v : (num(v) || null);
function cleanAcct(a) {
  const o = { ...a, name: String(a.name ?? '').trim() || '이름 없음', type: TYPES[a.type] ? a.type : 'bank', start: num(a.start) };
  for (const k of OPT_NUM) if (k in o) o[k] = optNum(o[k]);
  if (o.cur) o.cur = String(o.cur).toUpperCase();
  const fs = {}; // 시작 외화 잔액 { 통화: { amt, rate } }
  for (const [c, x] of Object.entries(o.fstart && typeof o.fstart === 'object' ? o.fstart : {})) { const cur = String(c).toUpperCase(); const amt = optNum(x?.amt); if (CUR_OK(cur) && amt) fs[cur] = { amt, rate: optNum(x?.rate) }; }
  if (Object.keys(fs).length) o.fstart = fs; else delete o.fstart;
  if (o.chg !== 'exact' && o.chg !== 'fixed') delete o.chg;
  if (o.fxAuto != null) o.fxAuto = !!o.fxAuto;
  return o;
}
function cleanTags(v) {
  const xs = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[\s,#]+/) : [];
  return [...new Set(xs.map(x => String(x).replace(/^#/, '').trim()).filter(Boolean))].slice(0, 8);
}
function cleanTx(t) {
  const o = { ...t, amt: +t.amt || 0, memo: String(t.memo ?? ''), cat: String(t.cat ?? ''), to: t.to || '' };
  if (!TXL[o.type]) o.type = 'out';
  if (o.type !== 'adj') o.amt = Math.abs(o.amt);
  const tg = cleanTags(o.tags); if (tg.length) o.tags = tg; else delete o.tags;
  if (!o.link || o.type !== 'in') delete o.link;
  if (!Array.isArray(o.ok) || !o.ok.length) delete o.ok;
  if (o.cur) { o.cur = String(o.cur).toUpperCase(); if (!CUR_OK(o.cur)) delete o.cur; }
  if (!o.cur) { delete o.famt; delete o.rate; delete o.side; if (o.type === 'fx') o.type = 'out'; } // 외화 없이는 환전이 될 수 없음
  else {
    o.famt = +o.famt || 0; if (o.type !== 'adj') o.famt = Math.abs(o.famt);
    o.rate = +o.rate > 0 ? +o.rate : (o.famt ? Math.abs(o.amt) / Math.abs(o.famt) : 0);
    if (o.type === 'fx') o.side = o.side === 'sell' ? 'sell' : 'buy'; else delete o.side;
  }
  return o;
}
function normalize(s) {
  const b = blankState();
  const o = { ...b, ...s };
  for (const c of COLLS) o[c] = Array.isArray(o[c]) ? o[c].filter(x => x && x.id) : [];
  for (const c of MAPS) o[c] = o[c] && typeof o[c] === 'object' ? o[c] : {};
  o.cats = o.cats.map(c => { const x = !c.u && OLD_DEF_IC.has(c.i) ? { ...c, i: '' } : { ...c }; x.b = +x.b > 0 ? +x.b : null; if (x.k !== 'inc') x.k = 'exp'; return x; }); // 예전 기본 이모지 아이콘은 비움
  o.accounts = o.accounts.map(cleanAcct);
  o.tx = o.tx.map(cleanTx); // 날짜가 이상한 기록도 지우지 않음 (백업 불러오기에서만 걸러 냄)
  o.rec = o.rec.map(r => { const x = { ...r, amt: Math.abs(num(r.amt)), day: Math.round(num(r.day)) }; if (x.cur) x.cur = String(x.cur).toUpperCase(); if (!x.cur || !CUR_OK(x.cur)) { delete x.cur; delete x.famt; } else x.famt = Math.abs(+x.famt || 0); return x; });
  o.settings = { ...b.settings, ...(o.settings || {}) };
  if (!isDate((s.settings || {}).invStart)) o.settings.invStart = mRange(ym(isDate(o.settings.start) ? o.settings.start : TODAY()))[0]; // 투자 집계 시작일: 기본은 시작일이 속한 달의 1일 (빈 가계부의 기본값이 섞이지 않게 원본으로 판단)
  o.fx = o.fx && typeof o.fx === 'object' ? o.fx : { u: 0 };
  o.del = o.del && typeof o.del === 'object' ? { ...o.del } : {};
  const cut = now() - 400 * 864e5; for (const k of Object.keys(o.del)) if (!(o.del[k] >= cut)) delete o.del[k]; // 오래된 삭제 기록 정리
  o.ver = VER;
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
const txById = id => (MEMO.txm ??= new Map(S.tx.map(t => [t.id, t]))).get(id);
const accts = () => S.accounts.filter(a => !a.hidden);
function removeRec(coll, id) { S[coll] = S[coll].filter(x => x.id !== id); S.del[id] = now(); }
const getVal = (aid, m) => { const x = S.val[aid + '|' + m]; return x && !x.del ? x.v : null; };
const ovOf = id => { const o = S.ov[id]; return o && !o.del ? o : null; };

/* ---------- merge (동기화용, 레코드 단위 최신 우선) ---------- */
function mergeState(a, b) {
  if (!a) return normalize(b); if (!b) return normalize(a);
  a = normalize(a); b = normalize(b);
  const o = { ver: VER };
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
// 적금 납입일 목록: 가입일부터 만기일 전까지, until을 주면 그날까지만 [{ m, d }]
function depDates(a, until) {
  const out = []; if (a.type !== 'saving' || !(+a.mamt > 0) || !(+a.mday)) return out;
  const open = a.open || S.settings.start;
  for (let m = ym(open), g = 0; g < 600; m = addM(m, 1), g++) {
    const d = `${m}-${pad2(Math.min(+a.mday, lastDay(m)))}`;
    if ((a.mat && d >= a.mat) || (until && d > until) || (!a.mat && !until)) break;
    if (d >= open) out.push({ m, d });
  }
  return out;
}
// 시작일 전에 가입한 적금·예금: 시작일 전까지 쌓인 (원금 × 날수)
function preSum(a, st) {
  if (!a.open || a.open >= st) return 0;
  let sum = 0, cnt = 0;
  for (const { d } of depDates(a, st)) if (d < st) { sum += +a.mamt * dayGap(d, st); cnt++; }
  const rest = startBal(a) - cnt * (+a.mamt || 0); if (rest > 0) sum += rest * dayGap(a.open, st);
  return sum;
}
/* ---------- 환율 · 외화 장부 ---------- */
// 통화 표시: $20 · ¥174,652 · €12.5
const CSYM = { USD: '$', JPY: '¥', EUR: '€', GBP: '£', CNY: 'CN¥', HKD: 'HK$', TWD: 'NT$', AUD: 'A$', CAD: 'C$', VND: '₫', THB: '฿' };
const CDEC = { JPY: 0, KRW: 0, VND: 0 };
const fmtF = (v, cur) => (CSYM[cur] || cur + ' ') + (+v || 0).toLocaleString('en-US', { maximumFractionDigits: CDEC[cur] ?? 2 });
const fmtR = r => (+r || 0).toLocaleString('ko-KR', { maximumFractionDigits: +r < 10 ? 3 : 2 });
// 쓰고 있는 통화: 해외 자산 계좌, 시작 외화 잔액, 외화 거래, 외화 정기 결제
function fxCurs() {
  const s = new Set();
  for (const a of S.accounts) { if (a.type === 'foreign' && a.cur) s.add(a.cur); for (const c of Object.keys(a.fstart || {})) s.add(c); }
  for (const t of S.tx) if (t.cur) s.add(t.cur);
  for (const r of S.rec) if (r.cur) s.add(r.cur);
  s.delete('KRW'); return [...s];
}
// 지금 환율 (1단위당 원): 받아 온 환율 → 계좌에 직접 넣은 환율 → 환율 이력 → 환전 기록
function curRate(cur) {
  if (!cur || cur === 'KRW') return 1;
  return MEMO['cr' + cur] ??= (() => {
    if (+S.fx[cur] > 0) return +S.fx[cur];
    const a = S.accounts.find(x => x.cur === cur && +x.rate > 0); if (a) return +a.rate;
    let best = '', v = 0; for (const [d, x] of Object.entries(S.fxh || {})) if (x && !x.del && +x[cur] > 0 && d > best) { best = d; v = +x[cur]; }
    if (v) return v;
    for (let i = S.tx.length - 1; i >= 0; i--) { const t = S.tx[i]; if (t.cur === cur && +t.rate > 0) return +t.rate; }
    return 0;
  })();
}
// 그날 환율: 그날 이전에 마지막으로 받아 온 환율, 없으면 지금 환율
function rateAt(cur, date) {
  if (!cur || cur === 'KRW') return 1;
  return MEMO['ra' + cur + date] ??= (() => {
    let best = '', v = 0;
    for (const [d, x] of Object.entries(S.fxh || {})) if (x && !x.del && +x[cur] > 0 && d <= date && d > best) { best = d; v = +x[cur]; }
    if (S.fx.at && S.fx.at <= date && S.fx.at > best && +S.fx[cur] > 0) v = +S.fx[cur];
    return v || curRate(cur);
  })();
}
const chgMode = a => a.chg === 'exact' || a.chg === 'fixed' ? a.chg : (+a.camt > 0 ? 'fixed' : 'exact'); // 충전식: 정한 금액만큼 / 모자란 만큼만
const fxAutoOf = a => a.fxAuto != null ? !!a.fxAuto : a.type === 'prepaid'; // 외화가 모자라면 원화에서 자동 환전
// 외화 장부 시작값: { 통화: { u: 보유량, c: 매입 원화 합계, rz: 실현 환차손익 } }
function fbase(a) {
  const b = {};
  if (a.type === 'foreign' && a.cur) { const u = +a.famt || 0; b[a.cur] = { u, c: u * (+a.frate || curRate(a.cur)), rz: 0 }; }
  for (const [cur, x] of Object.entries(a.fstart || {})) { const u = +x.amt || 0; if (!u) continue; const e = b[cur] ||= { u: 0, c: 0, rz: 0 }; e.u += u; e.c += u * (+x.rate || curRate(cur)); }
  return b;
}

/* ---------- ledger: 입력 + 정기 결제 + 충전식 자동 행 + 외화 ---------- */
// 원화 잔액 변화. 외화로 오간 돈은 원화 잔액을 바꾸지 않음 (환전의 원화 쪽만)
function delta(r, id) {
  if (r.type === 'fx') return r.acct === id ? (r.side === 'sell' ? r.amt : -r.amt) : 0;
  if (r.cur) return 0;
  if (r.type === 'out') return r.acct === id ? -r.amt : 0;
  if (r.type === 'in') return r.acct === id ? r.amt : 0;
  if (r.type === 'adj') return r.acct === id ? r.amt : 0; // 잔액 조정 (+/-)
  let d = 0; if (r.acct === id) d -= r.amt; if (r.to === id) d += r.amt; return d;
}
// 외화 잔액 변화 (그 통화 단위)
function fdelta(r, id) {
  if (!r.cur) return 0; const f = +r.famt || 0;
  if (r.type === 'fx') return r.acct === id ? (r.side === 'sell' ? -f : f) : 0;
  if (r.type === 'out') return r.acct === id ? -f : 0;
  if (r.type === 'in' || r.type === 'adj') return r.acct === id ? f : 0;
  let d = 0; if (r.acct === id) d -= f; if (r.to === id) d += f; return d;
}
const led = () => LED || (LED = buildLedger());
function buildLedger() {
  const today = TODAY(), st = S.settings.start;
  const rows = S.tx.map((t, i) => ({ ...t, amt: +t.amt || 0, seq: i }));
  let rk = 0;
  for (const r of S.rec) {
    if (!r.start || !(r.cur ? +r.famt : +r.amt) || !(+r.day) || !r.acct) continue;
    let m = ym(r.start); const em = ym(today);
    for (let g = 0; m <= em && g < 600; g++, m = addM(m, 1)) {
      const d = `${m}-${pad2(Math.min(+r.day, lastDay(m)))}`;
      if (d < r.start || d < st || d > today || (r.end && d > r.end)) continue;
      const id = `rec:${r.id}:${m}`, o = ovOf(id);
      if (o?.hidden) continue;
      const row = { id, date: d, acct: r.acct, type: r.type, amt: o?.amt ?? +r.amt, cat: r.type === 'move' ? '' : (r.cat || ''), to: r.type === 'move' ? r.to : '',
        memo: r.name, auto: 'rec', src: r.id, seq: 1e7 + rk++ };
      if (r.cur) { // 외화 결제: 그날 환율로 원화 환산 (원화 금액을 직접 고쳤으면 그 값)
        const f = +(o?.famt ?? r.famt) || 0, rate = o?.amt > 0 && f ? o.amt / f : rateAt(r.cur, d);
        Object.assign(row, { cur: r.cur, famt: f, rate, amt: o?.amt ?? Math.round(f * rate) });
      }
      rows.push(row);
    }
  }
  for (const a of S.accounts) { // 적금 매달 자동 납입 (만기일 전까지)
    if (!A(a.mfrom)) continue;
    for (const { m, d } of depDates(a, today)) {
      if (d < st) continue;
      const id = `dep:${a.id}:${m}`, o = ovOf(id); if (o?.hidden) continue;
      rows.push({ id, date: d, acct: a.mfrom, type: 'move', to: a.id, amt: o?.amt ?? +a.mamt, cat: '', memo: `${a.name} 납입`, auto: 'dep', src: a.id, seq: 1e7 + rk++ });
    }
  }
  rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.seq - b.seq);
  const pp = S.accounts.filter(a => a.type === 'prepaid'), ia = S.accounts.filter(hasInt), ma = S.accounts.filter(hasMat);
  const fa = new Set(); // 외화 잔액을 따라가는 계좌
  for (const a of S.accounts) if (a.type === 'foreign' || Object.keys(a.fstart || {}).length) fa.add(a.id);
  for (const r of rows) if (r.cur) { if (A(r.acct)) fa.add(r.acct); if (r.to && A(r.to)) fa.add(r.to); }
  MEMO.fa = fa;
  if (!pp.length && !ia.length && !ma.length && !fa.size) return rows;
  const bal = {}, cbb = {}; for (const a of [...pp, ...ia, ...ma]) bal[a.id] = startBal(a); for (const a of pp) cbb[a.id] = +a.cbStart || 0; // bal = 잔액(충전식은 충전금 + 캐시백), cbb = 캐시백
  for (const id of fa) { const a = A(id); if (!(id in bal) && a.type !== 'invest' && a.type !== 'foreign') bal[id] = startBal(a); } // 자동 환전에 원화 잔액이 필요
  const FB = {}; for (const id of fa) FB[id] = fbase(A(id));
  const out = [];
  const snap = r => { for (const id of [r.acct, r.to]) if (id in cbb) (r._pp ||= {})[id] = [bal[id] - cbb[id], cbb[id]]; }; // 충전식 줄마다 [충전금, 캐시백]
  const fsnap = r => { for (const id of [r.acct, r.to]) if (FB[id]) (r._fb ||= {})[id] = Object.fromEntries(Object.entries(FB[id]).map(([k, v]) => [k, { ...v }])); }; // 외화 줄마다 장부 사본
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
  const charge = (id, a, r, amt, memo, seq) => { // 충전 행 추가 (연결 계좌 → 충전식)
    const o = ovOf(id); if (o?.hidden) return;
    amt = o?.amt ?? amt; if (!(amt > 0)) return;
    const row = { id, date: r.date, acct: a.link || '', type: 'move', to: a.id, amt, cat: '', memo, auto: 'chg', src: a.id, parent: r.id, grp: r.grp || r.id, seq };
    tick(a.id, r.date); tick(a.link, r.date); out.push(row); bal[a.id] += amt; if (a.link in bal) bal[a.link] -= amt; snap(row);
  };
  // 충전식: 결제(또는 환전)할 원화가 모자라면 먼저 충전 — '모자란 만큼만' 또는 정한 금액의 배수
  const preCharge = (a, need, r, id, seq) => {
    if (!a || !(a.id in cbb)) return;
    let b = bal[a.id] - cbb[a.id]; if (b >= need) return;
    if (chgMode(a) === 'exact') return charge(id, a, r, Math.ceil(need - b), '자동 충전', seq);
    const M = +a.camt || 0; if (!(M > 0)) return;
    let n = 0; while (b < need && n < 100) { b += M; n++; }
    charge(id, a, r, n * M, n > 1 ? `자동 충전 ×${n}` : '자동 충전', seq);
  };
  const book = (id, cur) => (FB[id] ||= {})[cur] ||= { u: 0, c: 0, rz: 0 };
  const avgOf = (b, fallback) => b.u > 1e-9 ? b.c / b.u : fallback; // 평균 매입 환율
  const settle = (id, cur) => { const b = FB[id]?.[cur]; if (b && Math.abs(b.u) < 1e-6) { b.u = 0; b.c = 0; } };
  for (const r of rows) {
    while (ev.length && ev[0].d <= r.date) payInt(ev.shift()); // 그날 거래보다 먼저
    const live = r.date >= st;
    const pa = live && r.type === 'out' && (r.acct in cbb) ? A(r.acct) : null;
    const use = pa && !r.cur ? cbUseOf(pa, r, cbb[pa.id]) : 0;
    if (live && r.cur && r.type === 'out' && FB[r.acct] && fxAutoOf(A(r.acct))) { // ② 외화가 모자라면 원화에서 모자란 만큼 환전
      const b = book(r.acct, r.cur), short = Math.round(((+r.famt || 0) - Math.max(0, b.u)) * 100) / 100;
      if (short > 0) {
        const id = 'fxa:' + r.id, o = ovOf(id);
        if (!o?.hidden) {
          const rate0 = +r.rate || rateAt(r.cur, r.date), amt = o?.amt ?? Math.round(short * rate0), rate = amt / short;
          const row = { id, date: r.date, acct: r.acct, type: 'fx', side: 'buy', cur: r.cur, famt: short, rate, amt, cat: '', to: '', memo: `자동 환전 ${r.cur}`, auto: 'fxa', src: r.acct, parent: r.id, grp: r.id, seq: r.seq - 0.02 };
          if (pa) preCharge(pa, amt, row, 'chgp:' + id, r.seq - 0.03); // ③ 원화도 모자라면 충전 계좌에서
          tick(r.acct, r.date); out.push(row); if (r.acct in bal) bal[r.acct] -= amt; b.u += short; b.c += amt; snap(row); fsnap(row);
        }
      }
    }
    if (pa && !r.cur) preCharge(pa, r.amt - use, r, 'chgp:' + r.id, r.seq - 0.01); // 원화 결제: 충전금이 (결제액 − 쓰는 캐시백)보다 모자라면 먼저 충전
    if (live && r.type === 'fx' && r.side !== 'sell' && (r.acct in cbb)) preCharge(A(r.acct), r.amt, r, 'chgp:' + r.id, r.seq - 0.01); // 직접 적은 환전도 원화가 모자라면 먼저 충전
    out.push(r);
    if (!live) continue;
    for (const id in bal) { const dl = delta(r, id); if (dl) { tick(id, r.date); bal[id] += dl; } }
    if (r.cur) { // 외화 장부: 살 때는 원화 비용을 더하고, 쓸 때는 평균 매입가로 빼며 차액을 실현 환차손익으로
      const f = +r.famt || 0, rate = +r.rate || (f ? Math.abs(r.amt) / Math.abs(f) : curRate(r.cur));
      if (r.type === 'fx') { const b = book(r.acct, r.cur); if (r.side === 'sell') { const avg = avgOf(b, rate); b.u -= f; b.c -= f * avg; b.rz += r.amt - f * avg; } else { b.u += f; b.c += r.amt; } }
      else if (r.type === 'out') { const b = book(r.acct, r.cur), avg = avgOf(b, rate); b.u -= f; b.c -= f * avg; b.rz += r.amt - f * avg; }
      else if (r.type === 'in') { const b = book(r.acct, r.cur); b.u += f; b.c += Math.abs(r.amt); }
      else if (r.type === 'adj') { const b = book(r.acct, r.cur); if (f >= 0) { b.u += f; b.c += f * rate; } else { const avg = avgOf(b, rate); b.u += f; b.c += f * avg; } }
      else if (r.type === 'move') { const b = book(r.acct, r.cur), avg = avgOf(b, rate); b.u -= f; b.c -= f * avg; if (A(r.to)) { const b2 = book(r.to, r.cur); b2.u += f; b2.c += f * avg; } }
      settle(r.acct, r.cur); if (r.to) settle(r.to, r.cur);
      fsnap(r);
    }
    if (r.type === 'adj' && r.pool === 'cb' && r.acct in cbb) cbb[r.acct] += r.amt; // 캐시백 조정
    if (pa) { cbb[pa.id] -= use; if (use) r._cbUse = use; }
    snap(r);
    if (!pa || r.cur) continue;
    const T = +pa.th || 0, P = +pa.cbp || 0, M = +pa.camt || 0;
    if (chgMode(pa) === 'fixed' && M > 0) { // 결제 후 충전금이 기준 이하면 충전
      let n = 0, b = bal[pa.id] - cbb[pa.id]; while (b <= T && n < 100) { b += M; n++; }
      if (n) charge('chg:' + r.id, pa, r, n * M, n > 1 ? `자동 충전 ×${n}` : '자동 충전', r.seq - 0.04);
    }
    if (P > 0) {
      const id = 'cb:' + r.id, o = ovOf(id);
      if (!o?.hidden) {
        const p = o?.pct ?? P, amt = o?.amt ?? Math.floor(r.amt * p / 100);
        if (amt > 0) { const row = { id, date: r.date, acct: pa.id, type: 'in', amt, cat: '캐시백', to: '', memo: `캐시백 ${p}%`, auto: 'cb', src: pa.id, parent: r.id, grp: r.id, pct: p, seq: r.seq - 0.05 }; tick(pa.id, r.date); out.push(row); bal[pa.id] += amt; cbb[pa.id] += amt; snap(row); }
      }
    }
  }
  while (ev.length) payInt(ev.shift());
  return out;
}
const rowById = id => led().find(r => r.id === id);
// 이 거래 직후의 계좌 잔액 (원화) — 앞의 거래가 바뀌면 자동으로 다시 계산됨
function balAfter(rowId, acct) {
  const a = A(acct); if (!a) return null; let b = startBal(a); const st = S.settings.start;
  for (const r of led()) { if (r.date >= st) b += delta(r, acct); if (r.id === rowId) return b; }
  return null;
}
// 함께 처리된 기록 (결제 ← 자동 환전 ← 자동 충전, 캐시백)
function grpRows(r) { const g = r.grp || r.id; return led().filter(x => x.id === g || x.grp === g); }
// 외화 장부: 그날까지의 계좌별 { 통화: { u, c, rz } }
const hasFx = a => (led(), !!(MEMO.fa && MEMO.fa.has(a.id)));
function fbooksAt(upto) { return MEMO['fb' + upto] ??= (() => { const m = {}; for (const r of led()) { if (r.date > upto) break; if (r._fb) Object.assign(m, r._fb); } return m; })(); }
function fbookAt(id, upto) { const a = A(id); if (!a || !hasFx(a)) return {}; return fbooksAt(upto)[id] || fbase(a); }
// 통화별 보유 합계 (숨긴 계좌 제외): { 통화: { u, c, rz, avg, now, val, gain } }
function fxSummary(date = TODAY()) {
  const o = {};
  for (const a of S.accounts) {
    if (a.hidden || !hasFx(a)) continue;
    for (const [cur, b] of Object.entries(fbookAt(a.id, date))) { if (!b.u && !b.rz) continue; const e = o[cur] ||= { u: 0, c: 0, rz: 0 }; e.u += b.u; e.c += b.c; e.rz += b.rz; }
  }
  for (const [cur, e] of Object.entries(o)) { e.now = curRate(cur); e.val = Math.round(e.u * e.now); }
  return o;
}
// 외화 보유의 원화 가치
function holdVal(a, date) {
  let v = 0; for (const [cur, b] of Object.entries(fbookAt(a.id, date))) v += (b.u || 0) * fxNow(a, cur);
  return Math.round(v);
}
// 카드 결제일: 다음 결제일과 D-day
function payInfo(a) {
  if (!(+a.payDay)) return null;
  const t = TODAY(); let m = ym(t); let d = `${m}-${pad2(Math.min(+a.payDay, lastDay(m)))}`;
  if (d < t) { m = addM(m, 1); d = `${m}-${pad2(Math.min(+a.payDay, lastDay(m)))}`; }
  const n = Math.round((new Date(d) - new Date(t)) / 864e5);
  return { date: d, n, label: `${dLabel(d)} 결제 · ${n ? 'D-' + n : 'D-day'}` };
}
// 적금·예금 만기 예상: 지금까지의 거래 + 남은 자동 납입으로 만기까지 (원금 × 날수)를 더해 계산
function matPlan(a) {
  if (!isTerm(a) || !a.mat) return null;
  const st = S.settings.start, T = TODAY(), ch = [];
  for (const r of led()) { if (r.date < st || r.date >= a.mat) continue; const dl = delta(r, a.id); if (dl) ch.push([r.date, dl]); }
  let N = 0, done = 0;
  for (const { m, d } of depDates(a)) { N++; if (d > T) { if (A(a.mfrom)) ch.push([d, +a.mamt]); } else if (d >= st && !ovOf(`dep:${a.id}:${m}`)?.hidden) done++; }
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
// 그날까지 모든 계좌 잔액을 한 번에 (계좌마다 거래 목록을 다시 훑지 않게)
function balsAt(upto) {
  return MEMO['b' + upto] ??= (() => {
    const m = {}, st = S.settings.start; for (const a of S.accounts) m[a.id] = startBal(a);
    for (const r of led()) {
      if (r.date > upto) break; if (r.date < st) continue;
      if (r.acct in m) m[r.acct] += delta(r, r.acct);
      if (r.to && r.to !== r.acct && r.to in m) m[r.to] += delta(r, r.to);
    }
    return m;
  })();
}
function balAt(id, upto) { const m = balsAt(upto); return id in m ? m[id] : startBal(A(id)); }
// 기간 동안 이 계좌에 들어온 돈·나간 돈 (st: 이날부터 셈, 기본은 가계부 시작일)
function flows(id, s, e, st = S.settings.start) {
  const o = { net: 0, inn: 0, out: 0 };
  for (const r of led()) { if (r.date > e) break; if (r.date < s || r.date < st) continue; const d = delta(r, id); if (!d) continue; o.net += d; if (d > 0) o.inn += d; else o.out -= d; }
  return o;
}
const flow = (id, s, e, st) => flows(id, s, e, st).net;
// 투자 집계 시작일: 가계부 시작일과 따로. 투자 계좌의 '시작 자산'은 이날 기준
const invStart = () => isDate(S.settings.invStart) ? S.settings.invStart : mRange(ym(S.settings.start))[0];
// 투자 계좌 달별 흐름. 원금 = 시작 자산 + 넣은 돈 − 뺀 돈, 수익 = 예탁자산 − 원금, 수익률 = 수익 ÷ 원금
// 예탁자산(v)은 입력값(예수금 + 평가금), 안 넣은 달은 지난달 값 + 그 달 넣은 돈으로 봄 (수익 0)
function invSeries(a) {
  return MEMO['inv' + a.id] ??= (() => {
    const ist = invStart(), sm = ym(ist), em = ym(TODAY()), res = [];
    let prev = +a.start || 0, prin = +(a.prin ?? a.start) || 0, inn = 0, out = 0;
    for (let m = sm, g = 0; m <= em && g < 600; m = addM(m, 1), g++) {
      const [s, e] = mRange(m), f = flows(a.id, s, e, ist), c = f.net, x = S.val[a.id + '|' + m], has = x && !x.del;
      const ent = has ? +x.v : null, cash = has && x.c != null ? +x.c : null, v = ent ?? (prev + c);
      prin += c; inn += f.inn; out += f.out;
      res.push({ m, c, inn: f.inn, out: f.out, v, ent, cash, sec: ent != null && cash != null ? ent - cash : null, pl: ent != null ? v - prev - c : null, prin, inn0: inn, out0: out, rate: prin > 0 ? (v - prin) / prin : null });
      prev = v;
    }
    return res;
  })();
}
function invAt(a, m) { let v = +a.start || 0; for (const x of invSeries(a)) { if (x.m > m) break; v = x.v; } return v; }
const fxRate = a => +a.rate || curRate(a.cur);
function valueAt(a, date) {
  if (a.type === 'invest') return invAt(a, ym(date));
  if (a.type === 'foreign') return holdVal(a, date);
  const k = balAt(a.id, date); return hasFx(a) ? k + holdVal(a, date) : k;
}
const archOf = m => { const x = S.arch?.[m]; return x && !x.del && mRange(m)[1] < S.settings.start ? x : null; };
function groups(date) {
  const am = date < S.settings.start ? archOf(ym(date)) : null; if (am) return am.g;
  return MEMO['g' + date] ??= (() => {
    const g = { cash: 0, invest: 0, foreign: 0 };
    for (const a of S.accounts) {
      if (a.type === 'invest') g.invest += invAt(a, ym(date));
      else if (a.type === 'foreign') g.foreign += holdVal(a, date);
      else { g.cash += balAt(a.id, date); if (hasFx(a)) g.foreign += holdVal(a, date); } // 계좌 안의 외화는 해외 자산으로
    }
    g.total = g.cash + g.invest + g.foreign; return g;
  })();
}
function endOf(m) { const t = TODAY(); if (m >= ym(t)) return t; return mRange(m)[1]; }
// 정산·환불 연결: 지출 id → 그 지출에 연결된 입금 합계
function refundMap() {
  return MEMO.rf ??= (() => { const m = {}; for (const t of S.tx) if (t.type === 'in' && t.link && txById(t.link)?.type === 'out') m[t.link] = (m[t.link] || 0) + (+t.amt || 0); return m; })();
}
const isLinkedIn = r => r.type === 'in' && !!r.link && txById(r.link)?.type === 'out';
const netOut = r => Math.max(0, r.amt - (refundMap()[r.id] || 0)); // 실지출
const inStats = a => a && a.type !== 'invest' && a.type !== 'foreign';
// 기간 통계 (지출은 실지출: 연결된 정산·환불을 뺀 금액, 그 입금은 수입에서 뺌)
function rstats(s, e) {
  return MEMO['rs' + s + e] ??= (() => {
    const st = S.settings.start; let inc = 0, exp = 0, refund = 0, n = 0;
    const cats = {}, incCats = {}, tags = {}, catTags = {}, days = {}, top = [];
    for (const r of led()) {
      if (r.date > e) break;
      if (r.date < s || r.date < st || !inStats(A(r.acct))) continue;
      if (r.type === 'in') {
        if (isLinkedIn(r)) { refund += r.amt; continue; }
        inc += r.amt; const k = r.cat || '미분류'; incCats[k] = (incCats[k] || 0) + r.amt;
      } else if (r.type === 'out') {
        const v = netOut(r); if (!v) continue;
        n++; exp += v; const k = r.cat || '미분류'; cats[k] = (cats[k] || 0) + v; days[r.date] = (days[r.date] || 0) + v;
        for (const g of r.tags || []) { tags[g] = (tags[g] || 0) + v; (catTags[k] ||= {})[g] = (catTags[k][g] || 0) + v; }
        top.push({ ...r, v });
      }
    }
    for (let m = ym(s), g = 0; m <= ym(e) && g < 600; m = addM(m, 1), g++) { // 월 마감으로 요약만 남은 달
      const am = archOf(m), [ms, me] = mRange(m); if (!am || ms < s || me > e) continue;
      inc += am.inc; exp += am.exp; for (const [k, v] of Object.entries(am.cats || {})) cats[k] = (cats[k] || 0) + v;
    }
    top.sort((a, b) => b.v - a.v);
    return { inc, exp, net: inc - exp, cats, incCats, tags, catTags, days, top, refund, n };
  })();
}
function mstats(m) {
  const am = archOf(m); if (am) return { inc: am.inc, exp: am.exp, net: am.inc - am.exp, cats: { ...am.cats }, incCats: {}, tags: {}, catTags: {}, days: {}, top: [], refund: 0, n: 0, arch: true };
  return rstats(...mRange(m));
}
// 이번 달 예산: 오늘 쓸 수 있는 돈 = (예산 − 어제까지 쓴 돈) ÷ 남은 날(오늘 포함) − 오늘 쓴 돈
function budgetInfo(t = TODAY()) {
  const B = +S.settings.budget || 0, m = ym(t), [s] = mRange(m);
  const spent = rstats(s, t).exp, today = rstats(t, t).exp, left = lastDay(m) - +t.slice(8) + 1;
  const daily = B ? Math.floor((B - (spent - today)) / left) : 0;
  return { B, spent, today, left, daily, can: daily - today, rest: B - spent };
}
function aStats(id, s, e) {
  const st = S.settings.start;
  const o = { out: 0, inc: 0, n: 0, outCat: {}, inCat: {}, mOut: {}, mIn: {}, chg: 0, chgN: 0, cb: 0, fxBuy: 0, fxSell: 0, maxDay: null };
  const days = {};
  for (const r of led()) {
    if (r.date < s || r.date > e || r.date < st) continue;
    if (r.acct !== id && r.to !== id) continue;
    o.n++;
    if (r.type === 'out' && r.acct === id) { o.out += r.amt; const k = r.cat || '미분류'; o.outCat[k] = (o.outCat[k] || 0) + r.amt; days[r.date] = (days[r.date] || 0) + r.amt; }
    else if (r.type === 'in' && r.acct === id) { o.inc += r.amt; const k = r.cat || '미분류'; o.inCat[k] = (o.inCat[k] || 0) + r.amt; if (r.auto === 'cb') o.cb += r.amt; }
    else if (r.type === 'fx' && r.acct === id) { if (r.side === 'sell') o.fxSell += r.amt; else o.fxBuy += r.amt; }
    else if (r.type === 'move') {
      if (r.acct === id) o.mOut[r.to] = (o.mOut[r.to] || 0) + r.amt;
      if (r.to === id) { o.mIn[r.acct] = (o.mIn[r.acct] || 0) + r.amt; if (r.auto === 'chg') { o.chg += r.amt; o.chgN++; } }
    }
  }
  const md = Object.entries(days).sort((a, b) => b[1] - a[1])[0]; if (md) o.maxDay = md;
  return o;
}
