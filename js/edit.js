'use strict';
// 편집 창과 버튼 동작(ACT)
/* =========================================================
   SHEETS (편집)
   ========================================================= */
function updTx(id, patch) { commit(() => { const t = txById(id); if (t) { Object.assign(t, patch); touch(t); } }); }
const refOf = (id, k) => { const C = U.nav?.ks || (U.acct ? ['date', 'amt', 'cat', 'memo'] : ['date', 'acct', 'amt', 'cat']); const i = C.indexOf(k); return (i >= 0 ? L(i) : '') + (U.rowNo?.[id] || ''); };

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
    ${o.top || ''}<div class="disp"><div class="ex" id="kpx"></div><div class="res" id="kpr">0</div></div>
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
  const TL = { out: '출금', in: '입금', move: '이동' };
  keypad({ ref: refOf(id, 'amt'), title: '금액', init: t.ex || (t.amt ? String(t.amt) : ''), next: t.type === 'move' ? '받는 계좌 ▶' : '카테고리 ▶',
    top: `<div class="seg kpt">${Object.entries(TL).map(([k, l]) => `<button class="${t.type === k ? 'on t-' + k : ''}"${at('kpType', { id, v: k })}>${l}</button>`).join('')}</div>`,
    ok: (v, ex, dir) => {
      const hasOp = /[+\-×÷−]/.test(ex.replace(/^[−-]/, ''));
      updTx(id, { amt: Math.abs(v), ex: hasOp ? ex : '' });
      const t2 = txById(id); if (!t2) return;
      if (dir === 'next') { if (t2.type === 'move') { if (!t2.to) pickTo(id); } else if (!t2.cat) catSheet(id); }
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
  const item = a => { const v = valueAt(a, E); return `<button class="ai${o.cur === a.id ? ' on' : ''}"${at('pickA', { v: a.id })}><span class="d" style="${colorStyle(a)}">${esc(a.name[0])}</span><span class="n">${esc(a.name)}${a.fav ? ' <span class="star">★</span>' : ''}<small>${TYPES[a.type].l}</small></span><span class="v ${v < 0 ? 'neg' : ''}">${fmt(v)}</span><span class="ck">${o.cur === a.id ? '✓' : ''}</span></button>`; };
  let h = '';
  if (o.all) h += `<button class="ai${!o.cur ? ' on' : ''}"${at('pickA', { v: '' })}><span class="d" style="background:#888">∗</span><span class="n">전체 계좌<small>모든 거래 보기 · 계좌 열 표시</small></span><span class="v"></span><span class="ck">${!o.cur ? '✓' : ''}</span></button>`;
  const fav = list.filter(a => a.fav); if (fav.length) h += `<div class="grp">즐겨찾기</div>` + fav.map(item).join('');
  for (const ty of TORD) { const xs = list.filter(a => a.type === ty && !a.fav); if (xs.length) h += `<div class="grp">${TYPES[ty].l}</div>` + xs.map(item).join(''); }
  if (!list.length) h += `<div class="empty">고를 수 있는 계좌가 없어요.<br>설정 탭에서 추가하세요.</div>`;
  openSheet(`${bh(esc(o.title || '계좌 선택'), esc(o.sub || ''))}<div class="alist">${h}</div>`);
}
ACT.pickA = d => { const f = SH.pick; closeSheet(); f && f(d.v || null); };
function pickTo(id) { const t = txById(id); pickAcct({ title: '받는 계좌', sub: '내 계좌로 이동', cur: t.to, exclude: t.acct, onPick: v => v && updTx(id, { to: v }) }); }
ACT.kpType = d => { // 숫자판을 연 채로 출금 · 입금 · 이동 바꾸기
  const t = txById(d.id); if (!t || t.type === d.v) return;
  const ex = KP.ex, p = { type: d.v };
  if (d.v !== 'move') p.to = ''; else p.cat = '';
  if (d.v !== 'move' && t.cat && catOf(t.cat)?.k !== (d.v === 'in' ? 'inc' : 'exp')) p.cat = '';
  updTx(d.id, p); kpTx(d.id); KP.ex = ex; kpShow();
};
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
  if (r.type === 'adj') { render(); return adjSheet(r); }
  if (d.k === 'bal' && r.type === 'out' && A(r.acct)?.type === 'prepaid') { render(); return cbSheet(r); }
  render();
  const k = d.k;
  if (k === 'date') dateSheet(r.id);
  else if (k === 'acct') pickAcct({ title: '계좌', cur: r.acct, onPick: v => { if (!v) return; const p = { acct: v }; if (r.to === v) p.to = ''; updTx(r.id, p); } });
  else if (k === 'amt') kpTx(r.id);
  else if (k === 'cat') r.type === 'move' ? pickAcct({ title: U.acct && r.to === U.acct ? '보낸 계좌' : '받는 계좌', cur: U.acct && r.to === U.acct ? r.acct : r.to, exclude: U.acct && r.to === U.acct ? r.to : r.acct, onPick: v => v && updTx(r.id, U.acct && r.to === U.acct ? { acct: v } : { to: v }) }) : catSheet(r.id);
  else if (k === 'memo') memoSheet(r.id);
};
// 캐시백 사용 창 (충전식 결제의 '충전+캐시백' 칸)
function cbSheet(r) {
  const a = A(r.acct), used = r._cbUse || 0, avail = (r._pp?.[a.id]?.[1] || 0) + used, t = txById(r.id); SH.cbr = r;
  const head = `${bh('캐시백 사용', `${dLabel(r.date)} · 결제 ${fmt(r.amt)}원`)}<div class="hint top lg">이 결제 전 캐시백 <b>${fmt(avail)}원</b> · 지금 ${used ? `<b>${fmt(used)}원</b> 사용` : '사용 안 함'}</div>`;
  if (cbModeOf(a) === 'first') return openSheet(`${head}<div class="hint">결제할 때 캐시백을 자동으로 먼저 쓰는 중이에요.</div>
    <div class="acts" style="margin-top:10px"><button class="btn${t.cbUse === 'none' ? ' pri' : ''}"${at('cbUseSet', { v: t.cbUse === 'none' ? '' : 'none' })}>${t.cbUse === 'none' ? '이 결제도 자동으로 쓰기' : '이 결제는 캐시백 쓰지 않기'}</button></div>`);
  openSheet(`${head}<div class="lbl">쓸 금액</div><div class="cbr"><input id="cbUseIn" class="inp" inputmode="numeric" enterkeyhint="done" value="${used || Math.min(avail, r.amt)}" aria-label="쓸 캐시백"><span>원</span><button class="btn pri"${at('cbUseSet', { v: 'in' })}>적용</button></div>
    <div class="acts" style="margin-top:10px"><button class="btn"${at('cbUseSet', { v: 'max' })}>쓸 수 있는 만큼 모두</button><button class="btn dan"${at('cbUseSet', { v: '' })}>사용 안 함</button></div>`);
}
ACT.cbUseSet = d => {
  const r = SH.cbr; let v = d.v;
  if (v === 'in') { const n = num($('#cbUseIn')?.value); if (!(n >= 0)) return toast('금액을 확인하세요'); v = n > 0 ? n : ''; }
  closeSheet(); updTx(r.id, { cbUse: v });
  toast(v === 'none' ? '이 결제는 캐시백을 쓰지 않아요' : v === '' ? '캐시백을 쓰지 않아요' : v === 'max' ? '쌓인 캐시백을 쓸 수 있는 만큼 써요' : `캐시백 ${fmt(v)}원을 써요`);
};
ACT.ctxGo = d => { ctxClose(); const r = rowById(d.id); if (!r) return; if (d.k === 'auto') autoSheet(r); else if (d.k === 'cb') cbSheet(r); else if (d.k === 'adj') adjSheet(r); };
ACT.delTx = d => { closeSheet(); U.sel = null; commit(() => removeRec('tx', d.id)); toast('삭제했어요 · ↶로 되돌리기'); };
function autoSheet(r) {
  const kind = { rec: '정기 결제·이체', chg: '자동 충전', cb: '캐시백', int: '이자', dep: '적금 자동 납입', matx: '만기 해지' }[r.auto], o = ovOf(r.id);
  SH.auto = r;
  openSheet(`${bh(esc(kind), `${dLabel(r.date)} · ${fmt(r.amt)}원`)}
    <div class="hint top">자동으로 생긴 행이에요. 실제 금액이 다르면 고칠 수 있어요.</div>
    ${r.auto === 'cb' ? `<div class="lbl">이 거래의 캐시백 비율</div><div class="cbr"><input id="cbIn" class="inp" inputmode="decimal" enterkeyhint="done" value="${r.pct ?? ''}" aria-label="캐시백 비율"><span>%</span><button class="btn pri"${at('cbSave')}>적용</button></div>
    <div class="acts" style="margin-top:10px"><button class="btn dan"${at('cbNone')}>이 거래는 캐시백 없음</button></div>` : ''}
    <div class="acts" style="margin-top:10px"><button class="btn${r.auto === 'cb' ? '' : ' pri'}"${at('autoAmt')}>금액 고치기</button>
    ${o ? `<button class="btn"${at('autoReset')}>원래대로 되돌리기</button>` : ''}
    <button class="btn"${at('autoSrc')}>${r.auto === 'rec' ? '정기 결제 설정 열기' : r.auto === 'cb' ? '기본 비율 바꾸기 (계좌 설정)' : r.auto === 'int' ? '이율 · 받는 날 바꾸기 (계좌 설정)' : r.auto === 'dep' || r.auto === 'matx' ? '적금·예금 설정 열기' : '충전식 계좌 설정 열기'}</button></div>`);
}
// ---- 잔액 맞추기: 실제 잔액을 적으면 차액만큼 '조정' 줄 ----
const canAdj = a => a && a.type !== 'invest' && a.type !== 'foreign';
function adjPrepaid(a) { // 충전식: 충전금 → 캐시백 차례로
  const [c, cb] = poolsAt(a.id, TODAY());
  const mk = (diff, pool) => touch({ id: uid(), date: TODAY(), acct: a.id, type: 'adj', amt: diff, cat: '', to: '', memo: pool ? '캐시백 조정' : '잔액 조정', ...(pool ? { pool } : {}) });
  keypad({ ref: esc(a.name), title: '실제 충전금', init: String(c), next: '다음: 캐시백', hint: `앱에서는 충전금 ${fmt(c)}원이에요.`, ok: v => {
    const d1 = Math.round(v - c);
    keypad({ ref: esc(a.name), title: '실제 캐시백', init: String(cb), hint: `앱에서는 캐시백 ${fmt(cb)}원이에요. 차액만큼 조정 줄이 생기고 통계에는 안 들어가요.`, ok: w => {
      const list = [], d2 = Math.round(w - cb); if (d1) list.push(mk(d1)); if (d2) list.push(mk(d2, 'cb'));
      if (!list.length) return toast('이미 맞아요');
      commit(() => S.tx.push(...list)); toast(`맞췄어요${d1 ? ` · 충전금 ${d1 > 0 ? '+' : ''}${fmt(d1)}` : ''}${d2 ? ` · 캐시백 ${d2 > 0 ? '+' : ''}${fmt(d2)}` : ''}`);
    } });
  } });
}
ACT.adjust = d => {
  const a = A(d.id); if (!canAdj(a)) return;
  if (a.type === 'prepaid') return adjPrepaid(a);
  const b = balAt(a.id, TODAY()), card = a.type === 'card', shown = card ? -b : b;
  keypad({ ref: esc(a.name), title: card ? '실제 결제 예정 금액' : '실제 잔액', init: String(shown),
    hint: `앱에서는 ${fmt(shown)}원이에요. 실제 금액을 적으면 차액만큼 '잔액 조정' 줄이 생겨요. 지출·수입 통계에는 들어가지 않아요.`,
    ok: v => {
      const diff = Math.round((card ? -v : v) - b); if (!diff) return toast('이미 맞아요');
      const t = touch({ id: uid(), date: TODAY(), acct: a.id, type: 'adj', amt: diff, cat: '', to: '', memo: '잔액 조정' });
      commit(() => S.tx.push(t)); toast(`잔액 조정 ${diff > 0 ? '+' : ''}${fmt(diff)}원 · ↶로 되돌리기`);
    } });
};
function adjSheet(r) {
  SH.adj = r;
  openSheet(`${bh('잔액 조정', `${dLabel(r.date)} · ${r.amt > 0 ? '+' : ''}${fmt(r.amt)}원`)}
    <div class="hint top">실제 잔액과 맞추려고 넣은 줄이에요. 통계에는 들어가지 않아요. 원인을 찾았으면 지우고 그 거래를 적어 주세요.</div>
    <div class="acts" style="margin-top:10px"><button class="btn"${at('adjAmt')}>금액 고치기</button><button class="btn dan"${at('delTx', { id: r.id })}>삭제</button></div>`);
}
ACT.adjAmt = () => { const r = SH.adj; closeSheet(); keypad({ ref: '잔액 조정', title: '조정 금액 (줄이려면 −)', init: String(r.amt), ok: v => v ? updTx(r.id, { amt: Math.round(v) }) : toast('0은 넣을 수 없어요. 지우려면 삭제를 누르세요') }); };
ACT.autoAmt = () => { const r = SH.auto; closeSheet(); keypad({ ref: '자동 행', title: '실제 금액', init: String(r.amt), ok: v => commit(() => { S.ov[r.id] = { amt: Math.abs(v), u: now() }; }) }); };
ACT.cbSave = () => {
  const r = SH.auto, v = parseFloat(String($('#cbIn')?.value ?? '').replace(/[^\d.]/g, ''));
  if (!(v >= 0 && v <= 100)) return toast('0 ~ 100 사이 숫자로 적어 주세요');
  closeSheet(); commit(() => { S.ov[r.id] = { pct: v, u: now() }; });
};
ACT.cbNone = () => { const r = SH.auto; closeSheet(); commit(() => { S.ov[r.id] = { hidden: 1, u: now() }; }); toast('이 거래의 캐시백을 뺐어요 · ↶로 되돌리기'); };
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

/* filter / search */
function fltSheet() {
  const f = U.flt, segB = (k, v, l) => `<button class="${f[k] === v ? 'on' : ''}"${at('fltSet', { k, v })}>${l}</button>`;
  const cnt = inputRows().length;
  openSheet(`${bh('필터 · 정렬', fltActive() || U.sort === 'desc' ? '조건 적용 중' : '', `<button class="btn"${at('fltReset')}>초기화</button>`)}
    <div class="lbl" style="padding-top:0">정렬</div><div class="seg">${[['desc', '최신 순'], ['asc', '오래된 순']].map(([v, l]) => `<button class="${(U.sort || 'asc') === v ? 'on' : ''}"${at('sortSet', { v })}>${l}</button>`).join('')}</div>
    <div class="lbl">기간</div><div class="seg">${segB('p', 'month', mShort(U.month))}${segB('p', 'prev', '지난 달')}${segB('p', '3m', '3개월')}${segB('p', 'all', '전체')}</div>
    <div class="lbl">구분</div><div class="seg">${segB('t', 'all', '전체')}${segB('t', 'out', '출금')}${segB('t', 'in', '입금')}${segB('t', 'move', '이동')}</div>
    <div class="lbl">카테고리 · 여러 개 선택</div><div class="chips">${S.cats.map(c => `<button class="chip${f.cats.includes(c.n) ? ' on' : ''}" style="min-height:38px;font-size:13px"${at('fltCat', { v: c.n })}>${catLbl(c.n)}</button>`).join('')}</div>
    <button class="bigbtn"${at('close')}>결과 ${cnt}건 보기</button>`);
}
ACT.flt = () => fltSheet();
ACT.fltSet = d => { U.flt = { ...U.flt, [d.k]: d.v }; render(); fltSheet(); };
ACT.fltCat = d => { const c = U.flt.cats.includes(d.v) ? U.flt.cats.filter(x => x !== d.v) : [...U.flt.cats, d.v]; U.flt = { ...U.flt, cats: c }; render(); fltSheet(); };
ACT.fltReset = () => { U.flt = { p: 'month', t: 'all', cats: [] }; U.sort = 'asc'; render(); fltSheet(); };
ACT.sortSet = d => { U.sort = d.v; render(); fltSheet(); };
ACT.search = () => {
  openSheet(`${bh('검색', '메모·카테고리·계좌')}<div class="fld"><input id="qIn" value="${esc(U.q)}" placeholder="예: 스타벅스" autofocus></div>
    <div class="row2" style="margin-top:10px"><button class="btn" style="height:44px"${at('qSet', { clear: 1 })}>지우기</button><button class="btn pri" style="height:44px"${at('qSet')}>검색</button></div>`);
};
ACT.qSet = d => { U.q = d.clear ? '' : $('#qIn').value.trim(); if (U.q && U.flt.p === 'month') U.flt = { ...U.flt, p: 'all' }; closeSheet(); render(); };

/* navigation */
ACT.tab = d => { if (d.v === 'accts' && U.tab === 'accts' && U.detail) return ACT.back(); // 계좌별 탭을 한 번 더 누르면 목록으로
  U.tab = d.v; U.sel = null; U.more = false; if (d.v !== 'accts') U.detail = null; if (d.v !== 'dash' && U.month < ym(S.settings.start)) U.month = ym(S.settings.start); closeSheet(); render(); $('#grid') && ($('#grid').scrollTop = 0); };
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
ACT.detail = d => { U.detail = d.v; detailPush(); render(); $('#grid').scrollTop = 0; };
ACT.detail2 = d => { U.tab = 'accts'; U.detail = d.v; detailPush(); render(); };
ACT.back = () => { U.detail = null; render(); if (history.state?.cbDetail) history.back(); };
const detailPush = () => { try { if (!history.state?.cbDetail) history.pushState({ cbDetail: 1 }, ''); } catch (e) { } };
const setZoom = v => { U.zoom = Math.min(200, Math.max(50, Math.round(v))); render(); };
ACT.moreRows = () => { U.more = true; render(); };
ACT.zoom = d => setZoom(Math.round((U.zoom || 100) / 10) * 10 + d.k * 10);
ACT.zoomDlg = () => {
  const z = U.zoom || 100, op = [200, 150, 125, 100, 90, 75, 50];
  openSheet(`${bh('확대/축소')}<div class="zdlg">${op.map(v => `<label class="zr"><input type="radio" name="zr" value="${v}"${v === z ? ' checked' : ''}>${v}%</label>`).join('')}
    <label class="zr"><input type="radio" name="zr" value="c"${op.includes(z) ? '' : ' checked'}>사용자 지정<input id="zc" class="zin" inputmode="numeric" value="${z}">%</label></div>
    <div class="row2" style="margin-top:14px"><button class="btn" data-a="close" style="height:42px">취소</button><button class="btn pri"${at('zoomOk')} style="height:42px">확인</button></div>`);
};
ACT.zoomOk = () => {
  const r = $('input[name="zr"]:checked'), v = r && r.value !== 'c' ? +r.value : +String($('#zc').value).replace(/[^\d]/g, '');
  if (!(v >= 50 && v <= 200)) return toast('50 ~ 200 사이로 적어 주세요');
  closeSheet(); setZoom(v);
};
ACT.tabStep = d => { const i = Math.max(0, TABS.findIndex(t => t[0] === U.tab)), j = i + +d.k; if (j >= 0 && j < TABS.length) ACT.tab({ v: TABS[j][0] }); };
ACT.goInput = d => { U.tab = 'input'; U.detail = null; if ('acct' in d) U.acct = d.acct || null; U.flt = { p: 'month', t: 'all', cats: d.cat ? [d.cat] : [] }; U.q = ''; U.sel = null; render(); };
ACT.goRow = d => { const r = rowById(d.id); if (!r) return; U.tab = 'input'; U.detail = null; U.month = ym(r.date); U.flt = { p: 'month', t: 'all', cats: [] }; U.q = ''; if (U.acct && r.acct !== U.acct && r.to !== U.acct) U.acct = null; U.sel = { id: r.id, k: missing(r) ? (r.amt ? 'cat' : 'amt') : 'amt' }; render(); scrollSel(); };
ACT.goSetAcct = () => { if (U.tab !== 'set') U.prevTab = U.tab; U.tab = 'set'; U.setTab = 'acct'; render(); acctForm(null); };
ACT.setTab = d => { U.setTab = d.v; render(); };
ACT.gear = () => openGear();
ACT.help = () => { closeSheet(); openHelp(); };
ACT.guideNext = d => { const i = +d.i + 1; if (i < GUIDE.length) return openGuide(i); closeGear(); acctForm(null); };
ACT.guideSkip = () => closeGear();
ACT.tipClose = () => { try { localStorage.setItem(TIPK, '1'); } catch (e) { } render(); };
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
ACT.gearClose = () => closeGear();
ACT.gearGo = d => { if (d.v === 'help') return openHelp(); if (d.v === 'hfix') return ACT.hfix(); if (d.v === 'theme') return ACT.theme(); if (d.v === 'pinMenu') { closeGear(); return ACT.pinMenu(); } closeGear(); if (d.v === 'openBase') return ACT.openBase(); ACT[d.v] && ACT[d.v]({}); };
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
  const startLbl = { bank: '시작 잔액', card: '시작 시점 결제 예정액 (마이너스로, 예: -300000)', prepaid: '시작 충전금', saving: '시작 잔액', deposit: '시작 잔액 (넣어 둔 금액)', invest: '시작 시점 평가금액' }[ty];
  let extra = '';
  if (ty === 'card') extra = `<div class="lbl">결제일 (선택)</div><div class="fld"><input id="fPay" inputmode="numeric" value="${esc(a.payDay || '')}" placeholder="예: 14" data-i="f" data-f="payDay"></div>`;
  const accField = (f, title, ph) => `<button class="fld" style="width:calc(100% - 28px);text-align:left"${at('fAcc', { f, t: title })}><span class="inp" style="display:flex;align-items:center;gap:8px">${A(a[f]) ? `${dotA(A(a[f]))}${esc(accName(a[f]))}` : `<span class="mut">${ph}</span>`}<span style="margin-left:auto;color:var(--muted)">▾</span></span></button>`;
  if (ty === 'saving' || ty === 'deposit') extra = `<div class="row2"><div><div class="lbl" style="padding-left:0">가입일</div><input class="inp" type="date" id="fOpen" value="${esc(a.open || '')}" data-i="f" data-f="open"></div><div><div class="lbl" style="padding-left:0">만기일</div><input class="inp" type="date" id="fMat" value="${esc(a.mat || '')}" data-i="f" data-f="mat"></div></div>
    ${ty === 'saving' ? `<div class="lbl">매달 자동 납입 (선택)</div><div class="rule">매달 <input class="sm" id="fMday" inputmode="numeric" value="${esc(a.mday ?? '')}" placeholder="25" data-i="f" data-f="mday"> 일에 <input id="fMamt" inputmode="numeric" value="${esc(a.mamt ?? '')}" placeholder="300000" data-i="f" data-f="mamt"> 원</div>
    <div style="margin-top:8px">${accField('mfrom', '납입할 때 빠지는 계좌', '빠지는 계좌 선택')}</div>` : ''}
    <div class="lbl">만기 후 (선택)</div>${accField('mto', '만기 때 원금·이자를 받을 계좌', '그대로 두기 · 받을 계좌 선택')}${a.mto ? `<button class="link" style="margin:6px 14px 0;font-size:12.5px"${at('fSet', { f: 'mto', v: '' })}>그대로 두기로 바꾸기</button>` : ''}`;
  if (ty === 'invest') extra = `<button class="tog${a.isa ? ' on' : ''}"${at('fTog', { f: 'isa' })}>ISA 계좌 (연 납입 한도 표시)<i></i></button>`;
  if (ty === 'foreign') extra = `<div class="lbl">통화</div><div class="fld"><select id="fCur" data-i="f" data-f="cur">${CURS.map(c => `<option${a.cur === c ? ' selected' : ''}>${c}</option>`).join('')}</select></div>
    <div class="lbl">보유 외화 금액</div><div class="fld"><input id="fFamt" inputmode="decimal" value="${esc(a.famt ?? '')}" placeholder="예: 1500" data-i="f" data-f="famt"></div>
    <div class="lbl">환율 (원, 비우면 '환율 새로고침' 값 사용)</div><div class="fld"><input id="fRate" inputmode="decimal" value="${esc(a.rate ?? '')}" placeholder="예: 1357.9" data-i="f" data-f="rate"></div>`;
  if (ty === 'prepaid') extra = `<div class="lbl">충전해 주는 계좌</div><button class="fld" style="width:calc(100% - 28px);text-align:left"${at('fLink')}><span class="inp" style="display:flex;align-items:center;gap:8px">${a.link && A(a.link) ? `${dotA(A(a.link))}${esc(accName(a.link))}` : '<span class="mut">계좌 선택</span>'}<span style="margin-left:auto;color:var(--muted)">▾</span></span></button>
    <div class="lbl">자동 충전</div><div class="rule">충전금이 <input id="fTh" inputmode="numeric" value="${esc(a.th ?? 10000)}" data-i="f" data-f="th"> 원 이하가 되면<br><input id="fCamt" inputmode="numeric" value="${esc(a.camt ?? 50000)}" data-i="f" data-f="camt"> 원 충전</div>
    <div class="lbl">캐시백</div><div class="rule">사용액의 <input class="sm" id="fCbp" inputmode="decimal" value="${esc(a.cbp ?? 0)}" data-i="f" data-f="cbp"> % · 충전금과 따로 쌓임</div>
    <div class="lbl">캐시백 쓰는 방식</div><div class="seg">${[['', '기본값대로'], ['keep', '따로 모았다가'], ['first', '결제 때 먼저']].map(([v, l]) => `<button class="${(a.cbMode || '') === v ? 'on' : ''}"${at('fCbMode', { v })}>${l}</button>`).join('')}</div>
    <div class="hint">${(a.cbMode ? '' : `기본값 설정의 '캐시백 자동 사용'(지금 ${S.settings.cbAuto ? '켜짐' : '꺼짐'})을 따라요. `) + (cbModeOf(a) === 'first' ? '결제하면 쌓인 캐시백이 먼저 빠지고, 모자란 만큼 충전금에서 빠져요.' : '캐시백은 쌓이기만 해요. 쓸 결제는 "충전+캐시백" 칸을 누르거나, 빠른 입력에 "캐시백으로"를 붙이세요.')}</div>
    <div class="lbl">시작 캐시백 · ${S.settings.start} 기준</div><div class="fld"><input id="fCbStart" inputmode="numeric" value="${esc(a.cbStart ?? 0)}" data-i="f" data-f="cbStart"></div>
    <div class="prev" id="fPrev"></div>`;
  openSheet(`${bh(a.id ? esc(a.name) : '새 계좌', '계좌 설정', `<button class="btn"${at('close')}>취소</button>`)}
    <div class="lbl" style="padding-top:0">이름</div><div class="fld"><input id="fName" maxlength="20" value="${esc(a.name)}" placeholder="예: 생활비통장" data-i="f" data-f="name"></div>
    <div class="lbl">종류</div><div class="seg" style="flex-wrap:wrap">${segB}</div>
    ${ty !== 'foreign' ? `<div class="lbl">${startLbl} · ${S.settings.start} 기준</div><div class="fld"><input id="fStart" inputmode="numeric" value="${esc(a.start ?? 0)}" data-i="f" data-f="start"></div>` : ''}
    ${extra}
    ${ty === 'bank' || ty === 'saving' || ty === 'deposit' || ty === 'prepaid' ? `<div class="lbl">이자 (선택)</div><div class="rule">${isTerm(a) && (a.ipay || 'mat') === 'mat' ? '연 ' : ''}이율 <input class="sm" id="fIrate" inputmode="decimal" value="${esc(a.irate ?? '')}" placeholder="0" data-i="f" data-f="irate"> %</div>
    ${isTerm(a) ? `<div class="seg" style="margin-top:8px">${[['mat', '만기에 한 번에'], ['month', '매달 받기']].map(([v, l]) => `<button class="${(a.ipay || 'mat') === v ? 'on' : ''}"${at('fSet', { f: 'ipay', v })}>${l}</button>`).join('')}</div>` : ''}
    ${isTerm(a) && (a.ipay || 'mat') === 'mat' ? `<button class="tog${a.itax !== false ? ' on' : ''}"${at('fItax')}>이자소득세 15.4% 떼고 넣기<i></i></button><div class="hint">넣은 날부터 만기일까지 날수만큼 연 이율로 계산해(단리) 만기일에 한 번에 들어와요. 적금은 회차마다 넣은 날부터 계산돼요.</div>` : `
    <div class="seg" style="margin-top:8px">${[['y', '연 이율'], ['m', '월 이율']].map(([v, l]) => `<button class="${(a.iunit || 'y') === v ? 'on' : ''}"${at('fSet', { f: 'iunit', v })}>${l}</button>`).join('')}</div>
    <div class="lbl">이자 받는 날</div><div class="seg">${[['day', '매달 정한 날'], ['sat3', '셋째 토요일 다음 날']].map(([v, l]) => `<button class="${(a.irule || 'day') === v ? 'on' : ''}"${at('fSet', { f: 'irule', v })}>${l}</button>`).join('')}</div>
    ${(a.irule || 'day') === 'day' ? `<div class="fld" style="margin-top:8px"><input id="fIday" inputmode="numeric" value="${esc(a.iday ?? '')}" placeholder="며칠에 받나요? 예: 20" data-i="f" data-f="iday"></div>` : ''}
    <button class="tog${a.itax !== false ? ' on' : ''}"${at('fItax')}>이자소득세 15.4% 떼고 넣기<i></i></button>
    <div class="hint">은행처럼 날마다의 잔액으로 계산해요. 지난 이자 날부터 전날까지 하루하루 잔액 × 연 이율 ÷ 365를 더해 받는 날 자동으로 들어와요. 파킹통장·CMA도 같은 방식이에요. 몇 원 다르면 그 줄을 눌러 고치세요.</div>`}` : ''}
    <div class="lbl">색 <span class="hnote">· 기본은 종류 색(채움), 직접 고른 색은 형광펜처럼 보여요</span></div><div class="swatches">${['', ...ACOLORS].map(c => `<button class="${(a.color || '') === c ? 'on' : ''}${c ? ' hl' : ''}" style="background:${c ? `linear-gradient(var(--bg) 50%, ${c} 50%)` : TYPES[ty].c}"${at('fColor', { v: c })} aria-label="${c ? '색 ' + c : '종류 색'}">${c ? '' : '기본'}</button>`).join('')}</div>
    <button class="tog${a.fav ? ' on' : ''}"${at('fTog', { f: 'fav' })}>★ 즐겨찾기 (계좌 선택 창 위쪽)<i></i></button>
    ${a.id ? `<button class="tog${a.hidden ? ' on' : ''}"${at('fTog', { f: 'hidden' })}>숨기기 (목록에서 빼고 기록은 유지)<i></i></button>` : ''}
    <button class="bigbtn"${at('acctSave')}>저장</button>
    ${a.id ? `<button class="bigbtn dan"${at('acctDel')}>계좌 삭제</button>` : ''}`);
  prevUpd();
}
const INP = {};
INP.zoomS = t => { const p = $('.zm .zp'); if (p) p.textContent = t.value + '%'; $('#app').style.setProperty('--z', t.value / 100); }; // 끄는 동안은 미리보기만
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
ACT.setCbAuto = () => { commit(() => { S.settings = { ...S.settings, cbAuto: !S.settings.cbAuto, u: now() }; }); toast(`캐시백 자동 사용 ${S.settings.cbAuto ? '켬' : '끔'}`); };
ACT.fCbMode = d => { readForm(); F.cbMode = d.v || ''; drawAcctForm(); };
ACT.fAcc = d => { readForm(); const keep = { ...F }; pickAcct({ title: d.t, types: ['bank', 'prepaid', 'saving', 'deposit'], cur: F[d.f], exclude: F.id, onPick: v => { F = { ...keep, [d.f]: v || '' }; drawAcctForm(); } }); };
ACT.fSet = d => { readForm(); F[d.f] = d.v; drawAcctForm(); };
ACT.fItax = () => { readForm(); F.itax = F.itax === false; drawAcctForm(); };
ACT.fColor = d => { readForm(); F.color = d.v || ''; drawAcctForm(); };
ACT.fTog = d => { readForm(); F[d.f] = !F[d.f]; drawAcctForm(); };
ACT.fLink = () => { readForm(); const keep = { ...F }; pickAcct({ title: '충전해 주는 계좌', types: ['bank', 'card'], cur: F.link, exclude: F.id, onPick: v => { F = { ...keep, link: v || '' }; drawAcctForm(); } }); };
ACT.acctSave = () => {
  readForm();
  const name = String(F.name || '').trim();
  if (!name) return toast('이름을 입력하세요');
  if (S.accounts.some(a => a.name === name && a.id !== F.id)) return toast('같은 이름의 계좌가 있어요');
  const o = { ...F, name, start: num(F.start) };
  for (const k of ['th', 'camt', 'cbp', 'cbStart', 'payDay', 'famt', 'rate', 'irate', 'iday', 'mamt', 'mday']) if (k in o) o[k] = o[k] === '' ? '' : num(o[k]);
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
