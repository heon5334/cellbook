'use strict';
// 입력·수정 창과 버튼 동작(ACT)
function updTx(id, patch, msg) { commit(() => { const t = txById(id); if (t) { Object.assign(t, patch); touch(t); } }); if (msg) toast(msg, true); }

/* ---------- 숫자판 (예산·평가금액·잔액 맞추기) ---------- */
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
// 1.5만 · 3천 · 18600÷3 같은 금액 글자 → 숫자 (못 읽으면 null)
function amtOf(s) {
  const m = String(s || '').replace(/[,원\s]/g, '').match(/^(.*?)(만|천)?$/); if (!m) return null;
  const v = calc(m[1].replace(/x/gi, '×')); if (v == null) return null;
  return v * (m[2] === '만' ? 10000 : m[2] === '천' ? 1000 : 1);
}
function keypad(o) {
  KP = { ...o, ex: o.init == null ? '' : String(o.init) };
  const q = [['+1000', '+1천'], ['+5000', '+5천'], ['+10000', '+1만'], ['+50000', '+5만'], ['C', '지우기']];
  openSheet(`${bh(o.ref ? `${o.ref}<small class="pre">${esc(o.title || '')}</small>` : esc(o.title || '금액'), '', `<button class="btn pri"${at('kpGo', { d: 'next' })}>${o.next || '완료'}</button>`)}
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

/* ---------- 고르는 창: 계좌 · 카테고리 · 날짜 ---------- */
function pickAcct(o) {
  SH.pick = o.onPick;
  const list = accts().filter(a => a.id !== o.exclude && (!o.types || o.types.includes(a.type)));
  const E = TODAY();
  const item = a => { const v = valueAt(a, E); return `<button class="ai${o.cur === a.id ? ' on' : ''}"${at('pickA', { v: a.id })}><span class="d" style="${colorStyle(a)}">${esc([...a.name][0])}</span><span class="n">${esc(a.name)}${a.fav ? ' <span class="star">★</span>' : ''}<small>${TYPES[a.type].l}</small></span><span class="v ${v < 0 ? 'neg' : ''}">${fmt(v)}</span><span class="ck">${o.cur === a.id ? ico('check', 18) : ''}</span></button>`; };
  let h = '';
  if (o.all) h += `<button class="ai${!o.cur ? ' on' : ''}"${at('pickA', { v: '' })}><span class="d" style="background:#86908A">·</span><span class="n">모든 계좌</span><span class="v"></span><span class="ck">${!o.cur ? ico('check', 18) : ''}</span></button>`;
  if (o.none) h += `<button class="ai"${at('pickA', { v: '' })}><span class="d" style="background:#B9C0BC">·</span><span class="n">${esc(o.none)}</span><span class="v"></span><span class="ck"></span></button>`;
  const fav = list.filter(a => a.fav); if (fav.length) h += `<div class="grp">즐겨찾기</div>` + fav.map(item).join('');
  for (const ty of TORD) { const xs = list.filter(a => a.type === ty && !a.fav); if (xs.length) h += `<div class="grp">${TYPES[ty].l}</div>` + xs.map(item).join(''); }
  if (!list.length) h += `<div class="empty sm">고를 수 있는 계좌가 없어요.<br>자산 탭에서 추가하세요.</div>`;
  openSheet(`${bh(esc(o.title || '계좌 선택'), esc(o.sub || ''))}<div class="alist">${h}</div>`, { onClose: o.onClose });
}
ACT.pickA = d => { const f = SH.pick; SH.pick = null; closeSheet(); f && f(d.v || null); };
const catGrid = (kind, cur, act, data = {}) => `<div class="cgrid">${S.cats.filter(c => c.k === kind).map(c => `<button class="cg${cur === c.n ? ' on' : ''}"${at(act, { ...data, v: c.n })}>${ciHTML(c.n, kind)}<span>${esc(c.n)}</span></button>`).join('')}
  <button class="cg add"${at('catNew', { kind, back: act })}><span class="ci">${ico('plus', 18)}</span><span>추가</span></button></div>`;
function catPick(o) {
  SH.cpick = o.onPick;
  openSheet(`${bh(o.title || '카테고리')}${catGrid(o.kind, o.cur, 'cpickA')}`);
}
ACT.cpickA = d => { const f = SH.cpick; SH.cpick = null; closeSheet(); f && f(d.v); };
function dateSheet(o) {
  SH.dpick = o.onPick; const T = TODAY();
  openSheet(`${bh(esc(o.title || '날짜'))}<div class="row3">${[[T, '오늘'], [addD(T, -1), '어제'], [addD(T, -2), '그제']].map(([v, l]) => `<button class="btn big${o.cur === v ? ' pri' : ''}"${at('dpickA', { v })}>${l}</button>`).join('')}</div>
    <div class="fld mt"><input type="date" id="dIn" value="${esc(o.cur || T)}"></div><button class="bigbtn"${at('dpickA')}>이 날짜로</button>`);
}
ACT.dpickA = d => { const v = d.v || $('#dIn')?.value; if (!isDate(v)) return toast('날짜를 확인하세요'); const f = SH.dpick; SH.dpick = null; closeSheet(); f && f(v); };

/* ---------- 기록 입력·수정 창 ---------- */
let F = null;
function lastAcct() {
  for (let i = S.tx.length - 1; i >= 0; i--) { const a = A(S.tx[i].acct); if (a && !a.hidden && a.type !== 'invest' && a.type !== 'foreign') return a.id; }
  return accts().find(a => a.type !== 'invest' && a.type !== 'foreign')?.id || accts()[0]?.id || null;
}
function txForm(id, init = {}) {
  if (!accts().length) return toast('자산 탭에서 계좌를 먼저 추가하세요');
  const t = id ? txById(id) : null;
  if (t) {
    F = { ...t, tags: (t.tags || []).map(g => '#' + g).join(' ') };
    if (t.type === 'fx') { F.famt = String(t.famt || ''); F.rate = String(t.rate || ''); F.kamt = String(t.amt || ''); F.amt = ''; }
    else if (t.cur) { F.amt = String(t.famt || ''); F.rate = String(t.rate || ''); }
    else F.amt = t.ex || (t.amt ? fmt(t.amt) : '');
  } else F = { id: null, type: 'out', amt: '', acct: QE.acct || lastAcct() || '', to: '', cat: '', date: QE.date || TODAY(), memo: '', tags: '', cur: '', ...init };
  drawTxForm();
}
function readTf() { for (const el of document.querySelectorAll('#sheet-root [data-i="tf"]')) F[el.dataset.f] = el.value; }
const numOf = v => amtOf(v) || 0; // 환율처럼 소수가 있는 숫자 (못 읽으면 0)
function tfAmtHint() {
  const el = $('#tfAmtH'); if (!el || F.type === 'fx') return; const v = amtOf(F.amt);
  if (F.cur) { const rate = numOf(F.rate) || curRate(F.cur); el.textContent = v ? `= ${fmt(Math.abs(v) * rate)}원 (환율 ${fmtR(rate)})` : (rate ? '' : '환율을 넣으세요'); return; }
  el.textContent = v == null ? (F.amt ? '금액을 확인하세요' : '') : /[+\-×÷*/만천]/.test(String(F.amt).replace(/^-/, '')) ? `= ${fmt(Math.abs(v))}원` : '';
}
function drawTxForm() {
  const t = F, isNew = !t.id, isFx = t.type === 'fx', kind = t.type === 'in' ? 'inc' : 'exp';
  const used = fxCurs(), curs = isFx ? [...new Set([...used, ...CURS])] : used;
  if (isFx && !curs.includes(t.cur)) t.cur = used[0] || 'USD';
  if (!isFx && t.cur && !curs.includes(t.cur)) t.cur = '';
  const cur = t.cur || '';
  const accBtn = (f, l, ph) => `<button class="frow pick"${at('tfAcc', { f })}><span class="fk">${l}</span><span class="fv">${A(t[f]) ? `${dotA(A(t[f]))}${esc(accName(t[f]))}` : `<span class="mut">${ph || '고르세요'}</span>`}</span>${ico('next', 16)}</button>`;
  const memos = [...new Set(S.tx.slice(-400).reverse().map(x => x.memo).filter(Boolean))].slice(0, 60);
  let link = '';
  if (t.type === 'in' && !cur) {
    const x = t.link && txById(t.link);
    link = x ? `<div class="lkbox">${ico('link', 18)}<div><b>${esc(x.memo || x.cat || '지출')}</b> ${fmt(x.amt)}원과 연결됨<small>${dLabel(x.date)} · 통계에는 실제로 쓴 돈만 잡혀요</small></div><button class="btn sm"${at('tfUnlink')}>해제</button></div>`
      : `<button class="frow pick"${at('tfLink')}><span class="fk">정산</span><span class="fv mut">나눠 낸 지출과 연결</span>${ico('next', 16)}</button>`;
  }
  if (t.type === 'out' && t.id) {
    const ins = S.tx.filter(x => x.type === 'in' && x.link === t.id), sum = ins.reduce((a, x) => a + (+x.amt || 0), 0);
    if (ins.length) link = `<div class="lkbox">${ico('link', 18)}<div>정산·환불 <b>+${fmt(sum)}원</b> 연결됨<small>실제로 쓴 돈 ${fmt(Math.max(0, (+txById(t.id).amt || 0) - sum))}원</small></div></div>`;
  }
  const a = A(t.acct), r = t.id ? rowById(t.id) : null;
  const cb = t.id && t.type === 'out' && !cur && a?.type === 'prepaid' && r ? `<button class="frow pick"${at('tfCb')}><span class="fk">캐시백</span><span class="fv">${r._cbUse ? `${fmt(r._cbUse)}원 사용` : '<span class="mut">사용 안 함</span>'}</span>${ico('next', 16)}</button>` : '';
  const held = a && cur ? (fbookAt(a.id, TODAY())[cur]?.u || 0) : 0;
  const curSel = curs.length ? `<div class="frow"><span class="fk">통화</span><select class="fin sel" data-i="tf" data-f="cur" aria-label="통화">${(isFx ? [] : [['', '원화 (KRW)']]).concat(curs.map(c => [c, `${c}${CSYM[c] ? ' ' + CSYM[c] : ''}`])).map(([v, l]) => `<option value="${v}"${cur === v ? ' selected' : ''}>${l}</option>`).join('')}</select>${a && cur && !isFx ? `<span class="fq mut sm">${held ? `${fmtF(held, cur)} 있음` : '잔액 없음'}</span>` : ''}</div>` : '';
  let amtBox, rateRow = '';
  if (isFx) {
    const sell = t.side === 'sell';
    amtBox = `<div class="amtbox"><input id="tfAmt" class="amtin" inputmode="decimal" placeholder="0" value="${ev(t.famt)}" data-i="tf" data-f="famt" autocomplete="off"${isNew && !t.famt ? ' autofocus' : ''} aria-label="외화 금액"><span>${esc(cur)}</span></div>
      <div class="amth" id="tfAmtH">${a ? (held ? `지금 ${esc(a.name)}에 ${fmtF(held, cur)} 있어요` : `${esc(a.name)}에 ${esc(cur)} 잔액이 없어요`) : ''}</div>
      <div class="seg mt2">${[['buy', '원화로 외화 사기'], ['sell', '외화 팔아 원화로']].map(([v, l]) => `<button class="${(t.side || 'buy') === v ? 'on' : ''}"${at('tfSide', { v })}>${l}</button>`).join('')}</div>`;
    rateRow = `<div class="frow"><span class="fk">환율</span><input class="fin" inputmode="decimal" value="${ev(t.rate)}" data-i="tf" data-f="rate" aria-label="환율"><span class="fq mut sm">1${esc(cur)}당 원</span></div>
      <div class="frow"><span class="fk">${sell ? '받는 원화' : '쓰는 원화'}</span><input class="fin" inputmode="numeric" value="${ev(t.kamt)}" data-i="tf" data-f="kamt" aria-label="원화 금액"><span class="fq mut sm">원</span></div>`;
  } else {
    amtBox = `<div class="amtbox"><input id="tfAmt" class="amtin" inputmode="decimal" placeholder="0" value="${esc(t.amt)}" data-i="tf" data-f="amt" autocomplete="off"${isNew && !t.amt ? ' autofocus' : ''} aria-label="금액"><span>${cur ? esc(cur) : '원'}</span></div><div class="amth" id="tfAmtH"></div>`;
    if (cur) rateRow = `<div class="frow"><span class="fk">환율</span><input class="fin" inputmode="decimal" value="${ev(t.rate)}" data-i="tf" data-f="rate" aria-label="환율"><span class="fq mut sm">1${esc(cur)}당 원</span></div>`;
  }
  const gb = r ? grpBox(r) : '';
  openSheet(`${bh(isNew ? '새 기록' : '기록 수정')}
    <div class="seg3">${[['out', '지출'], ['in', '수입'], ['move', '이동'], ['fx', '환전']].map(([k, l]) => `<button class="${t.type === k ? 'on t-' + k : ''}"${at('tfType', { v: k })}>${l}</button>`).join('')}</div>
    ${amtBox}
    ${isFx ? accBtn('acct', '계좌', '원화와 외화를 함께 두는 계좌') : t.type === 'move' ? accBtn('acct', '보내는 곳') + accBtn('to', '받는 곳') : `${catGrid(kind, t.cat, 'tfCat')}${accBtn('acct', t.type === 'in' ? '들어온 곳' : '나간 곳')}`}
    ${curSel}${rateRow}
    <div class="frow"><span class="fk">날짜</span><input type="date" class="fin" value="${esc(t.date)}" data-i="tf" data-f="date" aria-label="날짜"><span class="fq"><button class="btn sm"${at('tfDay', { k: 0 })}>오늘</button><button class="btn sm"${at('tfDay', { k: -1 })}>어제</button></span></div>
    <div class="frow"><span class="fk">메모</span><input class="fin" list="memoList" maxlength="60" value="${esc(t.memo || '')}" data-i="tf" data-f="memo" aria-label="메모"></div>
    <datalist id="memoList">${memos.map(m => `<option value="${esc(m)}">`).join('')}</datalist>
    ${isFx ? '' : `<div class="frow"><span class="fk">태그</span><input class="fin" maxlength="60" value="${esc(t.tags || '')}" data-i="tf" data-f="tags" aria-label="태그"></div>`}
    ${link}${cb}${gb}
    <button class="bigbtn"${at('tfSave')}>저장</button>
    ${isNew ? '' : `<div class="row2 mt"><button class="btn big"${at('tfDup')}>${ico('copy', 17)}오늘로 복제</button><button class="btn big dan"${at('delTx', { id: t.id })}>${ico('trash', 17)}삭제</button></div>`}`, { cls: 'txf' });
  tfAmtHint();
}
INP.tf = el => {
  const f = el.dataset.f; F[f] = el.value;
  if (f === 'cur') { readTf(); F.rate = F.cur ? String(curRate(F.cur) || '') : ''; if (F.type === 'fx') { const famt = amtOf(F.famt), rate = numOf(F.rate); F.kamt = famt && rate ? String(Math.round(famt * rate)) : F.kamt; } drawTxForm(); return; }
  if (F.type === 'fx') { // 외화·환율·원화 중 둘을 넣으면 나머지를 채움
    const famt = amtOf(F.famt), rate = numOf(F.rate), kamt = amtOf(F.kamt), set = (k, v) => { F[k] = v; const x = $(`#sheet-root [data-f="${k}"]`); if (x) x.value = v; };
    if ((f === 'famt' || f === 'rate') && famt && rate) set('kamt', String(Math.round(famt * rate)));
    else if (f === 'kamt' && famt && kamt) set('rate', String(Math.round(kamt / famt * 10000) / 10000));
    return;
  }
  if (f === 'amt' || f === 'rate') tfAmtHint();
};
ACT.tfType = d => { readTf(); if (F.type === d.v) return; F.type = d.v; if (d.v === 'move' || d.v === 'fx') F.cat = ''; if (d.v !== 'move') F.to = ''; if (d.v !== 'move' && F.cat && catOf(F.cat)?.k !== (d.v === 'in' ? 'inc' : 'exp')) F.cat = '';
  if (d.v === 'fx') { if (!F.cur) F.cur = fxCurs()[0] || 'USD'; F.side = F.side || 'buy'; F.rate = F.rate || String(curRate(F.cur) || ''); if (A(F.acct)?.type === 'foreign') F.acct = ''; } drawTxForm(); };
ACT.tfSide = d => { readTf(); F.side = d.v; drawTxForm(); };
ACT.tfCat = d => { readTf(); F.cat = F.cat === d.v ? '' : d.v; drawTxForm(); };
ACT.tfDay = d => { readTf(); F.date = addD(TODAY(), +d.k); drawTxForm(); };
ACT.tfAcc = d => { readTf(); const keep = { ...F }; pickAcct({ title: d.f === 'to' ? '받는 계좌' : '계좌', cur: F[d.f], exclude: d.f === 'to' ? F.acct : F.type === 'move' ? F.to : '', types: F.type === 'fx' ? ['bank', 'prepaid', 'card', 'saving', 'deposit'] : null, onPick: v => { F = { ...keep }; if (v) F[d.f] = v; drawTxForm(); } }); };
ACT.tfLink = () => { readTf(); const keep = { ...F }; linkSheet({ amt: amtOf(F.amt) || 0, date: F.date, memo: F.memo, cur: F.link, onPick: v => { F = { ...keep, link: v || '' }; drawTxForm(); }, onBack: () => { F = keep; drawTxForm(); } }); };
ACT.tfUnlink = () => { readTf(); F.link = ''; drawTxForm(); };
ACT.tfCb = () => { readTf(); const r = rowById(F.id); if (r) cbSheet(r); };
function tfBuild() {
  readTf();
  if (!A(F.acct)) { toast('계좌를 고르세요'); return null; }
  if (!isDate(F.date)) { toast('날짜를 확인하세요'); return null; }
  const memo = String(F.memo || '').trim().slice(0, 60);
  const o = { date: F.date, acct: F.acct, type: F.type, memo, cat: '', to: '', ex: '' };
  if (F.type === 'fx') {
    const cur = F.cur || '', famt = Math.round((amtOf(F.famt) || 0) * 100) / 100, kamt = Math.round(amtOf(F.kamt) || 0); let rate = numOf(F.rate);
    if (!cur) { toast('통화를 고르세요'); return null; }
    if (!(famt > 0)) { toast('외화 금액을 넣으세요'); return null; }
    if (!(kamt > 0) && !(rate > 0)) { toast('환율이나 원화 금액을 넣으세요'); return null; }
    if (A(F.acct).type === 'foreign') { toast('원화가 있는 계좌를 고르세요'); return null; }
    const amt = kamt > 0 ? kamt : Math.round(famt * rate); if (!(rate > 0) || kamt > 0) rate = amt / famt;
    return Object.assign(o, { amt, cur, famt, rate: Math.round(rate * 10000) / 10000, side: F.side === 'sell' ? 'sell' : 'buy' });
  }
  const v = amtOf(F.amt); if (!v) { toast('금액을 입력하세요'); return null; }
  if (F.type === 'move' && !A(F.to)) { toast('받는 계좌를 고르세요'); return null; }
  if (F.type === 'move' && F.to === F.acct) { toast('보내는 곳과 받는 곳이 같아요'); return null; }
  if (F.cur) {
    const famt = Math.round(Math.abs(v) * 100) / 100, rate = numOf(F.rate) || curRate(F.cur);
    if (!(rate > 0)) { toast('환율을 넣으세요'); return null; }
    Object.assign(o, { amt: Math.round(famt * rate), cur: F.cur, famt, rate: Math.round(rate * 10000) / 10000 });
  } else {
    const hasOp = /[+\-×÷*/]/.test(String(F.amt).replace(/^-/, ''));
    o.amt = Math.abs(Math.round(v)); o.ex = hasOp ? String(F.amt).trim() : '';
  }
  o.cat = F.type === 'move' ? '' : (F.cat || guessCat(memo, F.type) || ''); o.to = F.type === 'move' ? F.to : '';
  const tags = cleanTags(F.tags); if (tags.length) o.tags = tags;
  if (F.type === 'in' && !F.cur && F.link && txById(F.link)) o.link = F.link;
  return o;
}
const TX_OPT = ['tags', 'link', 'cur', 'famt', 'rate', 'side', 'ex', 'cbUse'];
const txLbl = o => `${o.memo || o.cat || TXL[o.type]} ${o.cur ? fmtF(o.famt, o.cur) : fmt(o.amt)}`;
ACT.tfSave = () => {
  const o = tfBuild(); if (!o) return;
  const id = F.id; closeSheet();
  commit(() => {
    if (id) { const t = txById(id); if (!t) return; for (const k of TX_OPT) if (!(k in o)) delete t[k]; Object.assign(t, o); touch(t); }
    else { const t = touch({ id: uid(), ...o }); S.tx.push(t); U.flash = t.id; }
  });
  toast(id ? '고쳤어요' : `기록했어요 · ${txLbl(o)}`, true);
};
ACT.tfDup = () => {
  const o = tfBuild(); if (!o) return; closeSheet();
  delete o.link; o.date = TODAY(); const t = touch({ id: uid(), ...o }); U.flash = t.id;
  commit(() => S.tx.push(t)); toast('오늘 날짜로 복제했어요', true);
};
// 함께 처리된 기록 (결제 ← 자동 환전 ← 자동 충전 · 캐시백)
function grpBox(r) {
  const xs = grpRows(r); if (xs.length < 2) return '';
  return `<div class="lbl">함께 처리된 기록</div><div class="card tight grpb">${xs.map(x => txRow(x, { child: x.id !== (r.grp || r.id) })).join('')}</div>`;
}
// 숫자 하나 넣는 작은 창
function numSheet(o) {
  SH.num = o;
  openSheet(`${bh(esc(o.title), esc(o.sub || ''))}<div class="fld"><input id="nIn" class="inp" inputmode="decimal" value="${ev(o.init)}" enterkeyhint="done" autofocus aria-label="${esc(o.title)}"></div>
    ${o.hint ? `<div class="hint">${o.hint}</div>` : ''}<button class="bigbtn"${at('numOk')}>${esc(o.okLabel || '저장')}</button>`);
}
ACT.numOk = () => { const o = SH.num; if (!o) return; const raw = fv('nIn').trim(), v = amtOf(raw); if (raw && v == null) return toast('숫자를 확인하세요'); SH.num = null; closeSheet(); o.ok(raw === '' ? null : v, raw); };
ACT.tx = d => { const r = rowById(d.id); if (!r) return; if (r.auto) return autoSheet(r); if (r.type === 'adj') return adjSheet(r); txForm(d.id); };
ACT.txNew = () => txForm(null);
ACT.delTx = d => {
  closeSheet();
  if (rowById(d.id)?.auto) { commit(() => { S.ov[d.id] = { hidden: 1, u: now() }; }); return toast('이번 것만 지웠어요', true); } // 자동 기록은 그달 것만 숨김
  commit(() => removeRec('tx', d.id)); toast('삭제했어요', true);
};

/* ---------- 정산·환불 연결 ---------- */
function linkSheet(o) {
  SH.link = o; const d0 = o.date || TODAY(), words = String(o.memo || '').split(/\s+/).filter(w => w.length >= 2);
  const cand = S.tx.filter(x => x.type === 'out' && +x.amt && (!o.amt || +x.amt >= o.amt || x.id === o.cur) && x.date >= addD(d0, -60) && x.date <= addD(d0, 3) && x.id !== o.self)
    .map(x => { const near = Math.abs(dayGap(x.date, d0)); let sc = 100 - near; if (o.amt && x.amt > o.amt) sc += 30; if (o.amt && x.amt % o.amt === 0 && x.amt > o.amt) sc += 20; if (words.some(w => (x.memo || '').includes(w))) sc += 40; if (x.id === o.cur) sc += 999; return { x, sc }; })
    .sort((a, b) => b.sc - a.sc).slice(0, 12);
  const rf = refundMap();
  openSheet(`${bh('어느 지출과 연결할까요?', o.amt ? `받은 돈 ${fmt(o.amt)}원` : '')}
    <div class="hint top">연결하면 통계에서 그 지출은 받은 만큼 줄어들고, 받은 돈은 수입에서 빠져요.</div>
    <div class="opts">${cand.length ? cand.map(({ x }) => { const after = Math.max(0, x.amt - (rf[x.id] || 0) - (x.id === o.cur ? 0 : o.amt || 0));
      return `<button class="opt${x.id === o.cur ? ' on' : ''}"${at('linkPick', { v: x.id })}>${ciHTML(x.cat, 'exp')}<span class="ot">${esc(x.memo || x.cat || '지출')}<small>${dLabel(x.date)} · ${accS(x.acct)}</small></span><span class="v">${fmt(x.amt)}<small>실지출 ${fmt(after)}</small></span></button>`; }).join('')
      : '<div class="empty sm">최근 60일 안에 연결할 지출이 없어요</div>'}</div>
    ${o.inbox ? `<button class="lnk blk"${at('linkNo')}>연결하지 않고 수입으로 두기</button>` : ''}`, { onClose: () => { SH.link = null; } });
}
ACT.linkPick = d => { const o = SH.link; SH.link = null; closeSheet(); o?.onPick(d.v); };
ACT.linkNo = () => { const o = SH.link; SH.link = null; closeSheet(); if (o?.id) ACT.dismiss({ id: o.id, k: 'link' }); };
ACT.linkOpen = d => {
  const t = txById(d.id); if (!t) return;
  linkSheet({ id: t.id, inbox: true, amt: +t.amt, date: t.date, memo: t.memo, cur: t.link, onPick: v => { updTx(t.id, { link: v }, '지출과 연결했어요'); } });
};

/* ---------- 확인할 것 ---------- */
ACT.dismiss = d => { commit(() => { for (const id of [d.id, d.p].filter(Boolean)) { const t = txById(id); if (t) { t.ok = [...new Set([...(t.ok || []), d.k])]; touch(t); } } }); };
ACT.xferFix = d => {
  const o = txById(d.id); if (!o) return;
  const go = to => { commit(() => { const t = txById(d.id); if (!t) return; Object.assign(t, { type: 'move', to, cat: '' }); delete t.tags; touch(t); if (d.p) removeRec('tx', d.p); }); toast(`${accName(to)}(으)로 이동으로 바꿨어요`, true); };
  if (d.p) { const p = txById(d.p); if (p) return go(p.acct); }
  pickAcct({ title: '어느 계좌로 옮겼나요?', sub: `${accName(o.acct)}에서 ${fmt(o.amt)}원`, cur: d.to, exclude: o.acct, onPick: v => v && go(v) });
};
ACT.catFix = d => updTx(d.id, { cat: d.v }, `${d.v}(으)로 바꿨어요`);
ACT.todoAll = () => { U.todoAll = true; render(); };
ACT.focusQ = () => { const q = $('#qeIn'); if (q) q.focus(); };
ACT.remindLater = () => { try { localStorage.setItem(REMK, TODAY()); } catch (e) { } invalidate(); render(); };
ACT.bkLater = () => { bkSet({ snooze: addD(TODAY(), 7) }); invalidate(); render(); toast('7일 뒤에 다시 알려 줄게요'); };
ACT.fixUncat = () => { UQ = uncatQueue(); uncatSheet(0); };
ACT.uncatSet = d => { const i = +d.i, id = UQ[i]; commit(() => { const t = txById(id); if (t) { t.cat = d.v; touch(t); } }); uncatSheet(i + 1); };
ACT.uncatSkip = d => uncatSheet(+d.i + 1);

/* ---------- 캐시백 · 자동 기록 · 잔액 조정 ---------- */
function cbSheet(r) {
  const a = A(r.acct), used = r._cbUse || 0, avail = (r._pp?.[a.id]?.[1] || 0) + used, t = txById(r.id); SH.cbr = r;
  const head = `${bh('캐시백 사용', `${dLabel(r.date)} · 결제 ${fmt(r.amt)}원`)}<div class="hint top lg">이 결제 전 캐시백 <b>${fmt(avail)}원</b> · 지금 ${used ? `<b>${fmt(used)}원</b> 사용` : '사용 안 함'}</div>`;
  if (cbModeOf(a) === 'first') return openSheet(`${head}<div class="hint">결제할 때 캐시백을 자동으로 먼저 쓰는 중이에요.</div>
    <div class="acts"><button class="btn big${t.cbUse === 'none' ? ' pri' : ''}"${at('cbUseSet', { v: t.cbUse === 'none' ? '' : 'none' })}>${t.cbUse === 'none' ? '이 결제도 자동으로 쓰기' : '이 결제는 캐시백 쓰지 않기'}</button></div>`);
  openSheet(`${head}<div class="lbl">쓸 금액</div><div class="cbr"><input id="cbUseIn" class="inp" inputmode="numeric" enterkeyhint="done" value="${used || Math.min(avail, r.amt)}" aria-label="쓸 캐시백"><span>원</span><button class="btn pri"${at('cbUseSet', { v: 'in' })}>적용</button></div>
    <div class="acts"><button class="btn big"${at('cbUseSet', { v: 'max' })}>쓸 수 있는 만큼 모두</button><button class="btn big dan"${at('cbUseSet', { v: '' })}>사용 안 함</button></div>`);
}
ACT.cbUseSet = d => {
  const r = SH.cbr; let v = d.v;
  if (v === 'in') { const n = num($('#cbUseIn')?.value); if (!(n >= 0)) return toast('금액을 확인하세요'); v = n > 0 ? n : ''; }
  closeSheet(); updTx(r.id, { cbUse: v });
  toast(v === 'none' ? '이 결제는 캐시백을 쓰지 않아요' : v === '' ? '캐시백을 쓰지 않아요' : v === 'max' ? '쌓인 캐시백을 쓸 수 있는 만큼 써요' : `캐시백 ${fmt(v)}원을 써요`, true);
};
function autoSheet(r) {
  const kind = { rec: '정기 결제·이체', chg: '자동 충전', cb: '캐시백', int: '이자', dep: '적금 자동 납입', matx: '만기 해지', fxa: '자동 환전' }[r.auto], o = ovOf(r.id);
  SH.auto = r;
  const big = r.type === 'fx' ? `<div class="amtshow">${fmtF(r.famt, r.cur)}<small> ← ${fmt(r.amt)}원 · 환율 ${fmtR(r.rate)}</small></div>`
    : r.cur ? `<div class="amtshow">${fmtF(r.famt, r.cur)}<small> ≈ ${fmt(r.amt)}원 · 환율 ${fmtR(r.rate)}</small></div>`
    : `<div class="amtshow">${r.type === 'in' ? '+' : ''}${fmt(r.amt)}<small>원</small></div>`;
  const what = r.auto === 'fxa' ? `${accS(r.acct)}의 ${esc(r.cur)}이(가) 모자라서 원화에서 모자란 만큼 환전했어요. 실제 환전된 원화 금액과 다르면 고치세요.` : r.auto === 'chg' ? '결제할 돈이 모자라서 충전 계좌에서 가져온 기록이에요.' : '자동으로 기록됐어요. 실제 금액과 다르면 고치세요.';
  openSheet(`${bh(esc(r.memo || kind), `${kind} · ${dLabel(r.date)}`)}${big}
    <div class="hint top">${what}${o ? ' 지금은 고친 값이에요.' : ''}</div>
    ${r.auto === 'cb' ? `<div class="lbl">이 결제의 캐시백 비율</div><div class="cbr"><input id="cbIn" class="inp" inputmode="decimal" enterkeyhint="done" value="${r.pct ?? ''}" aria-label="캐시백 비율"><span>%</span><button class="btn pri"${at('cbSave')}>적용</button></div>` : ''}
    <div class="acts">${r.cur && r.type !== 'fx' ? `<button class="btn big pri"${at('autoFamt')}>외화 금액 고치기</button><button class="btn big"${at('autoAmt')}>원화 금액 고치기</button>` : `<button class="btn big pri"${at('autoAmt')}>${r.type === 'fx' ? '원화 금액 고치기' : '금액 고치기'}</button>`}
    ${o ? `<button class="btn big"${at('autoReset')}>원래대로</button>` : ''}
    <button class="btn big"${at('autoSrc')}>${r.auto === 'rec' ? '정기 결제 설정 열기' : '계좌 설정 열기'}</button>
    <button class="btn big dan"${at('delTx', { id: r.id })}>${r.auto === 'cb' ? '이 결제는 캐시백 없음' : r.auto === 'fxa' ? '이번엔 환전 안 함' : '이번 것만 지우기'}</button></div>${grpBox(r)}`);
}
ACT.autoFamt = () => { const r = SH.auto; closeSheet(); numSheet({ title: `실제 ${r.cur} 금액`, sub: esc(r.memo || ''), init: String(r.famt), ok: v => { if (!(v > 0)) return toast('0보다 큰 금액을 넣으세요'); commit(() => { S.ov[r.id] = { ...(ovOf(r.id) || {}), famt: Math.round(v * 100) / 100, u: now() }; delete S.ov[r.id].del; }); toast('고쳤어요', true); } }); };
function adjPrepaid(a) { // 충전식: 충전금 → 캐시백 차례로
  const [c, cb] = poolsAt(a.id, TODAY());
  const mk = (diff, pool) => touch({ id: uid(), date: TODAY(), acct: a.id, type: 'adj', amt: diff, cat: '', to: '', memo: pool ? '캐시백 조정' : '잔액 조정', ...(pool ? { pool } : {}) });
  keypad({ ref: esc(a.name), title: '실제 충전금', init: String(c), next: '다음', hint: `앱에서는 충전금 ${fmt(c)}원이에요.`, ok: v => {
    const d1 = Math.round(v - c);
    keypad({ ref: esc(a.name), title: '실제 캐시백', init: String(cb), hint: `앱에서는 캐시백 ${fmt(cb)}원이에요. 차액만큼 조정 기록이 생기고 통계에는 안 들어가요.`, ok: w => {
      const list = [], d2 = Math.round(w - cb); if (d1) list.push(mk(d1)); if (d2) list.push(mk(d2, 'cb'));
      if (!list.length) return toast('이미 맞아요');
      commit(() => S.tx.push(...list)); toast(`맞췄어요${d1 ? ` · 충전금 ${d1 > 0 ? '+' : ''}${fmt(d1)}` : ''}${d2 ? ` · 캐시백 ${d2 > 0 ? '+' : ''}${fmt(d2)}` : ''}`, true);
    } });
  } });
}
ACT.adjust = d => {
  const a = A(d.id); if (!canAdj(a)) return;
  if (a.type === 'prepaid') return adjPrepaid(a);
  const b = balAt(a.id, TODAY()), card = a.type === 'card', shown = card ? -b : b;
  keypad({ ref: esc(a.name), title: card ? '실제 결제 예정 금액' : '실제 잔액', init: String(shown),
    hint: `앱에서는 ${fmt(shown)}원이에요. 실제 금액을 넣으면 차액만큼 '잔액 조정' 기록이 생겨요. 지출·수입 통계에는 안 들어가요.`,
    ok: v => {
      const diff = Math.round((card ? -v : v) - b); if (!diff) return toast('이미 맞아요');
      const t = touch({ id: uid(), date: TODAY(), acct: a.id, type: 'adj', amt: diff, cat: '', to: '', memo: '잔액 조정' });
      commit(() => S.tx.push(t)); toast(`잔액 조정 ${diff > 0 ? '+' : ''}${fmt(diff)}원`, true);
    } });
};
function adjSheet(r) {
  SH.adj = r;
  openSheet(`${bh('잔액 조정', `${dLabel(r.date)} · ${accName(r.acct)}`)}<div class="amtshow">${r.amt > 0 ? '+' : ''}${fmt(r.amt)}<small>원</small></div>
    <div class="hint top">실제 잔액과 맞추려고 넣은 기록이에요. 통계에는 안 들어가요. 원인을 찾았으면 이 기록을 지우고 빠진 거래를 적으세요.</div>
    <div class="row2 mt"><button class="btn big"${at('adjAmt')}>금액 고치기</button><button class="btn big dan"${at('delTx', { id: r.id })}>삭제</button></div>`);
}
ACT.adjAmt = () => { const r = SH.adj; closeSheet(); keypad({ ref: '잔액 조정', title: '조정 금액 (줄이려면 −)', init: String(r.amt), ok: v => v ? updTx(r.id, { amt: Math.round(v) }) : toast('0은 넣을 수 없어요. 지우려면 삭제를 누르세요') }); };
ACT.autoAmt = () => { const r = SH.auto; closeSheet(); keypad({ ref: esc(r.memo || '자동 기록'), title: '실제 금액', init: String(r.amt), ok: v => { commit(() => { S.ov[r.id] = { amt: Math.abs(v), u: now() }; }); toast('고쳤어요', true); } }); };
ACT.cbSave = () => {
  const r = SH.auto, v = parseFloat(String($('#cbIn')?.value ?? '').replace(/[^\d.]/g, ''));
  if (!(v >= 0 && v <= 100)) return toast('0~100 사이 숫자를 넣으세요');
  closeSheet(); commit(() => { S.ov[r.id] = { pct: v, u: now() }; });
};
ACT.autoReset = () => { const r = SH.auto; closeSheet(); commit(() => { S.ov[r.id] = { del: 1, u: now() }; }); };
ACT.autoSrc = () => { const r = SH.auto; closeSheet(); r.auto === 'rec' ? recForm(r.src) : acctForm(r.src); };

/* ---------- 내역: 검색 · 필터 ---------- */
function fltSheet() {
  const f = U.flt, tags = [...new Set(S.tx.flatMap(t => t.tags || []))].slice(0, 30);
  openSheet(`${bh('필터', '', `<button class="btn"${at('fltReset')}>초기화</button><button class="btn pri"${at('close')}>${listRows().length}건 보기</button>`)}
    <div class="lbl first">구분</div><div class="seg">${[['all', '전체'], ['out', '지출'], ['in', '수입'], ['move', '이동'], ...(fxCurs().length ? [['fx', '환전']] : [])].map(([v, l]) => `<button class="${f.t === v ? 'on' : ''}"${at('fltSet', { k: 't', v })}>${l}</button>`).join('')}</div>
    <div class="lbl">계좌</div><div class="chips"><button class="chip${!U.acct ? ' on' : ''}"${at('fltAcct', { v: '' })}>모든 계좌</button>${accts().map(a => `<button class="chip${U.acct === a.id ? ' on' : ''}"${at('fltAcct', { v: a.id })}>${esc(a.name)}</button>`).join('')}</div>
    <div class="lbl">카테고리 · 여러 개</div><div class="chips">${[...S.cats.map(c => c.n), '미분류'].map(n => `<button class="chip${f.cats.includes(n) ? ' on' : ''}"${at('fltCat', { v: n })}>${esc(n)}</button>`).join('')}</div>
    ${tags.length ? `<div class="lbl">태그</div><div class="chips">${tags.map(g => `<button class="chip${f.tag === g ? ' on' : ''}"${at('fltTag', { v: g })}>#${esc(g)}</button>`).join('')}</div>` : ''}`);
}
ACT.filter = () => fltSheet();
ACT.fltSet = d => { U.flt = { ...U.flt, [d.k]: d.v }; render(); fltSheet(); };
ACT.fltAcct = d => { U.acct = d.v || null; render(); fltSheet(); };
ACT.fltCat = d => { const c = U.flt.cats.includes(d.v) ? U.flt.cats.filter(x => x !== d.v) : [...U.flt.cats, d.v]; U.flt = { ...U.flt, cats: c }; render(); fltSheet(); };
ACT.fltTag = d => { U.flt = { ...U.flt, tag: U.flt.tag === d.v ? '' : d.v }; render(); fltSheet(); };
ACT.fltReset = () => { U.flt = { t: 'all', cats: [], tag: '' }; U.acct = null; U.q = ''; if (sheetOpen()) { render(); fltSheet(); } else render(); };
ACT.fltClear = d => { if (d.k === 'q') U.q = ''; else if (d.k === 'acct') U.acct = null; else if (d.k === 'cat') U.flt = { ...U.flt, cats: U.flt.cats.filter(x => x !== d.v) }; else U.flt = { ...U.flt, [d.k]: d.k === 't' ? 'all' : '' }; render(); };
ACT.search = () => {
  openSheet(`${bh('검색', '메모 · 카테고리 · 계좌 · #태그 · 금액')}<div class="fld"><input id="qIn" value="${esc(U.q)}" enterkeyhint="search" autofocus aria-label="검색어"></div>
    <div class="row2 mt"><button class="btn big"${at('qSet', { clear: 1 })}>지우기</button><button class="btn big pri"${at('qSet')}>검색</button></div>`);
};
ACT.qSet = d => { U.q = d.clear ? '' : ($('#qIn')?.value || '').trim(); closeSheet(); render(); };
ACT.moreRows = () => { U.more = true; render(); };

/* ---------- 이동 ---------- */
const NAV = { pushed: false, skip: false };
const navPush = () => { try { if (!NAV.pushed) { history.pushState({ cb: 1 }, ''); NAV.pushed = true; } } catch (e) { } };
const navPop = () => { if (NAV.pushed) { NAV.pushed = false; NAV.skip = true; try { history.back(); } catch (e) { NAV.skip = false; } } };
function goTop() { const b = $('#body'); if (b) b.scrollTop = 0; }
ACT.tab = d => {
  if (d.v === 'assets' && U.tab === 'assets' && U.detail) return ACT.back();
  const same = U.tab === d.v; U.tab = d.v; U.detail = null; U.setTab = ''; U.more = false; navPop();
  if (d.v === 'list' && !same && U.month < ym(S.settings.start)) U.month = ym(TODAY());
  if (d.v === 'stats' && U.sp === 'mon') U.sp = 'month';
  closeSheet(); render(); goTop();
};
ACT.mon = d => {
  const m = addM(U.month, +d.k);
  if (m > ym(TODAY())) return toast('아직 오지 않은 달이에요');
  if (m < ym(S.settings.start)) return toast(archOf(m) ? '정리된 달은 통계에서 요약으로 볼 수 있어요' : '더 이전 기록이 없어요');
  U.month = m; U.more = false; render(); goTop(); dateFromScroll(); // 달을 바꾸면 그 달의 맨 위 날짜로
};
ACT.detail = d => { U.tab = 'assets'; U.detail = d.v; U.month = ym(TODAY()); navPush(); render(); goTop(); };
ACT.back = () => { if (U.fxv) { U.fxv = null; U.more = false; render(); goTop(); return; } U.detail = null; U.month = ym(TODAY()); navPop(); render(); };
ACT.gear = () => { if (U.tab !== 'set') U.prevTab = U.tab; U.tab = 'set'; U.setTab = ''; U.detail = null; navPush(); render(); goTop(); };
ACT.openSet = d => { if (U.tab !== 'set') { U.prevTab = U.tab; navPush(); } U.tab = 'set'; U.setTab = d.v || ''; closeSheet(); render(); goTop(); };
ACT.setBack = () => { if (U.setTab) { U.setTab = ''; render(); return; } U.tab = U.prevTab && U.prevTab !== 'set' ? U.prevTab : 'home'; navPop(); render(); };
ACT.goList = d => {
  U.tab = 'list'; U.detail = null; U.q = ''; U.acct = d.acct || null; U.more = false;
  U.flt = { t: 'all', cats: d.cat ? [d.cat] : [], tag: d.tag || '' };
  U.month = d.m || ym(TODAY()); closeSheet(); render(); goTop();
};
ACT.statP = d => { U.sp = d.v; if (d.v === 'custom' && !U.sr) U.sr = { s: mRange(ym(TODAY()))[0], e: TODAY() }; render(); };
ACT.statMon = d => { U.sp = d.m === ym(TODAY()) ? 'month' : 'mon'; U.month = d.m; render(); };
ACT.catOpen = d => { U.open = { ...U.open, [d.k]: !U.open[d.k] }; render(); };
ACT.showHidden = () => { U.showHidden = !U.showHidden; render(); };
ACT.recapClose = d => { U.recapSeen = d.m; render(); };
ACT.recapMore = () => { U.tab = 'stats'; U.sp = 'prev'; render(); goTop(); };
ACT.help = () => { closeSheet(); openHelp(); };
ACT.gearClose = () => closeGear();
ACT.undo = () => undo();
ACT.redo = () => redo();
ACT.close = () => closeSheet();
ACT.okSheet = () => { const f = SH.ok; closeSheet(); f && f(); };
ACT.syncMenu = () => Sync.menu();
ACT.signIn = () => Sync.signIn();

/* ---------- 설정 값 ---------- */
ACT.setBudget = () => keypad({ ref: '', title: '한 달 예산', init: +S.settings.budget ? String(S.settings.budget) : '', allowEmpty: true,
  hint: '카드값, 생활비처럼 한 달에 쓰는 돈 전체예요. 비우면 예산을 쓰지 않아요. 카테고리마다 따로 정하려면 설정 → 카테고리에서 정하세요.',
  ok: (v, ex) => { commit(() => { S.settings = { ...S.settings, budget: ex === '' ? 0 : Math.abs(v), u: now() }; }); toast(ex === '' || !v ? '예산을 껐어요' : `한 달 예산 ${man(Math.abs(v))}원`); } });
const optSheet = (title, sub, opts, cur, act) => openSheet(`${bh(esc(title), esc(sub))}<div class="opts">${opts.map(([v, l]) => `<button class="opt${String(cur) === String(v) ? ' on' : ''}"${at(act, { v })}><span class="ot">${l}</span><span class="v">${String(cur) === String(v) ? ico('check', 18) : ''}</span></button>`).join('')}</div>`);
ACT.remindSet = () => optSheet('기록 알림', '이만큼 기록이 없으면 홈에서 알려 줘요', [[0, '끄기'], [2, '2일'], [3, '3일'], [5, '5일'], [7, '7일']], +S.settings.remind || 0, 'remindPick');
ACT.remindPick = d => { closeSheet(); commit(() => { S.settings = { ...S.settings, remind: +d.v, u: now() }; }); };
ACT.bkEvery = () => optSheet('백업 알림', '마지막 백업에서 이만큼 지나면 알려 줘요', [[7, '7일마다'], [14, '14일마다'], [30, '30일마다'], [0, '끄기']], bkGet().every ?? 30, 'bkPick');
ACT.bkPick = d => { closeSheet(); bkSet({ every: +d.v }); invalidate(); render(); };
ACT.setCbAuto = () => { commit(() => { S.settings = { ...S.settings, cbAuto: !S.settings.cbAuto, u: now() }; }); toast(`캐시백 자동 사용 ${S.settings.cbAuto ? '켬' : '끔'}`); };
ACT.theme = () => {
  const nx = { auto: 'light', light: 'dark', dark: 'auto' }[themePref()];
  try { localStorage.setItem(THK, nx); } catch (e) { }
  applyTheme(); render(); toast(`화면 테마: ${{ auto: '휴대폰 설정 따라감', light: '밝게', dark: '어둡게' }[nx]}`);
};
ACT.setStart = () => {
  openSheet(`${bh('시작일', '잔액 기준일')}<div class="hint top">계좌의 '시작 잔액'이 이날 기준이에요. 이날 이전 거래는 계산에서 빠져요.</div>
    <div class="fld mt"><input type="date" id="stIn" value="${S.settings.start}"></div><button class="bigbtn"${at('setStartOk')}>저장</button>`);
};
const fv = id => $('#' + id)?.value ?? '';
ACT.setStartOk = () => { const v = fv('stIn'); if (!isDate(v)) return toast('날짜를 확인하세요'); closeSheet(); commit(() => { S.settings = { ...S.settings, start: v, u: now() }; }); };
ACT.setIsa = () => keypad({ ref: 'ISA', title: '연 납입 한도', init: String(S.settings.isaLimit), ok: v => commit(() => { S.settings = { ...S.settings, isaLimit: Math.abs(v), u: now() }; }) });

/* ---------- 잠금 ---------- */
ACT.pinMenu = async () => {
  if (!pinGet()) return showLock('set');
  const bio = await bioAvailable();
  openSheet(`${bh('앱 잠금', bioGet() ? 'PIN + Face ID' : 'PIN')}<div class="acts">
    ${bio ? `<button class="btn big${bioGet() ? '' : ' pri'}"${at('bioToggle')}>${bioGet() ? 'Face ID 끄기' : 'Face ID 켜기'}</button>` : ''}
    <button class="btn big"${at('lockAfter')}>다시 잠그기: ${LA_LBL[lockAfter()]}</button>
    <button class="btn big"${at('pinChange')}>PIN 변경</button><button class="btn big dan"${at('pinOff')}>잠금 끄기</button></div>
    ${bio ? '' : '<div class="hint">이 기기에서는 Face ID를 쓸 수 없어요.</div>'}`);
};
ACT.bioToggle = async () => {
  closeSheet();
  if (bioGet()) { localStorage.removeItem(BIOK); render(); return toast('Face ID를 껐어요'); }
  try { await bioEnroll(); render(); toast('Face ID를 켰어요'); } catch (e) { toast('Face ID를 켜지 못했어요'); }
};
ACT.bioUnlock = () => bioUnlock(true);
ACT.lockAfter = () => { const o = ['0', '1', '5', '30', 'launch'], nx = o[(o.indexOf(lockAfter()) + 1) % o.length]; try { localStorage.setItem(LAK, nx); } catch (e) { } ACT.pinMenu(); toast(`다른 앱에 갔다 오면: ${LA_LBL[nx]} 잠금`); };
ACT.pinChange = () => { closeSheet(); LK.change = true; showLock('off'); };
ACT.pinOff = () => { closeSheet(); LK.change = false; showLock('off'); };
ACT.pinKey = d => pinKey(d.k);
ACT.pinCancel = () => { LK.change = false; hideLock(); render(); };
ACT.pinForgot = () => {
  $('#lock').innerHTML = `<div class="lk msg"><div class="lt">PIN을 잊었나요?</div><div class="lm" style="color:var(--ink2);line-height:1.7">PIN은 이 기기에만 있어서 찾을 수 없어요.<br>잠금을 풀려면 이 기기의 가계부를 지워야 해요.<br>백업 파일이 있으면 지운 뒤 불러오세요.</div>
    <button class="bigbtn dan"${at('pinWipe')}>가계부 지우고 잠금 풀기</button><button class="bigbtn ghost"${at('pinBack')}>돌아가기</button></div>`;
};
ACT.pinBack = () => drawLock();
ACT.pinWipe = () => { try { localStorage.removeItem(KEY); localStorage.removeItem(PINK); localStorage.removeItem(BIOK); } catch (e) { } location.reload(); };

/* ---------- 투자 평가 입력 (예수금 + 평가금 = 예탁자산) · 환율 ---------- */
function valSheet(id, m) {
  const a = A(id), x = S.val[`${id}|${m}`], has = x && !x.del;
  const cash = has && x.c != null ? x.c : '', sec = has ? (x.c != null ? x.v - x.c : x.v) : '';
  SH.val = { id, m };
  openSheet(`${bh(esc(a.name), `${mLabel(m)} 말 기준`)}
    <div class="row2"><div><div class="lbl">예수금 (현금)</div><div class="fld"><input id="vCash" class="inp" inputmode="numeric" value="${cash === '' ? '' : fmt(cash)}" data-i="val" aria-label="예수금"></div></div>
    <div><div class="lbl">평가금 (유가증권)</div><div class="fld"><input id="vSec" class="inp" inputmode="numeric" value="${sec === '' ? '' : fmt(sec)}" data-i="val" autofocus aria-label="평가금"></div></div></div>
    <div class="amth" id="vSum"></div>
    <div class="hint">증권사 앱의 숫자를 그대로 넣으세요. 둘을 더한 값이 예탁자산이고, 수익은 예탁자산 − 원금으로 계산해요. 예수금을 모르면 비워도 돼요.</div>
    <button class="bigbtn"${at('valOk')}>저장</button>${has ? `<button class="bigbtn dan"${at('valDel')}>이 달 입력 지우기</button>` : ''}`);
  INP.val();
}
INP.val = () => { const el = $('#vSum'); if (!el) return; const c = amtOf(fv('vCash')) || 0, s = amtOf(fv('vSec')) || 0; el.textContent = c || s ? `예탁자산 ${fmt(c + s)}원` : ''; };
ACT.val = d => valSheet(d.id, d.m);
ACT.valOk = () => {
  const { id, m } = SH.val, cr = fv('vCash').trim(), sr = fv('vSec').trim(), c = amtOf(cr), s = amtOf(sr);
  if ((cr && c == null) || (sr && s == null)) return toast('숫자를 확인하세요');
  if (!cr && !sr) return toast('예수금이나 평가금을 넣으세요');
  closeSheet();
  commit(() => { S.val[`${id}|${m}`] = { v: Math.abs((c || 0) + (s || 0)), ...(cr ? { c: Math.abs(c || 0) } : {}), u: now() }; });
  toast('예탁자산을 넣었어요', true);
};
ACT.valDel = () => { const { id, m } = SH.val; closeSheet(); commit(() => { S.val[`${id}|${m}`] = { del: 1, u: now() }; }); toast('지웠어요', true); };
// 환율 받아오기. silent: 앱을 열 때 자동으로 (알림 없음, 되돌리기에 안 남음, 실패하면 조용히 다음 기회에)
let FX_BUSY = false;
function fxFetch(silent) {
  const curs = fxCurs();
  if (!curs.length) { if (!silent) toast('외화를 쓰는 계좌가 없어요'); return; }
  if (FX_BUSY) return; FX_BUSY = true;
  if (!silent) toast('환율을 가져오는 중…');
  fetch('https://open.er-api.com/v6/latest/KRW', { referrerPolicy: 'no-referrer', credentials: 'omit', cache: 'no-store' }).then(r => r.json()).then(j => {
    if (j.result !== 'success' || !j.rates) throw new Error('rate');
    const apply = () => {
      const fx = { ...S.fx }, h = {}; for (const c of curs) if (j.rates[c]) { fx[c] = 1 / j.rates[c]; h[c] = fx[c]; }
      fx.at = TODAY(); fx.u = now(); S.fx = fx; S.fxh[TODAY()] = { ...h, u: now() }; // 날짜별 이력도 남김 (지난 날짜의 자동 환전에 씀)
    };
    if (silent) { apply(); invalidate(); persist(); render(); } else { commit(apply); toast('환율을 오늘 기준으로 바꿨어요'); }
  }).catch(() => { if (!silent) toast('환율을 가져오지 못했어요. 인터넷을 확인하거나 계좌 설정에서 직접 넣을 수 있어요'); }).finally(() => { FX_BUSY = false; });
}
ACT.fxRefresh = () => fxFetch(false);
// 앱을 열거나 다시 돌아왔을 때: 오늘 아직 안 받았으면 자동으로 (인터넷이 없으면 다음에)
function fxAutoRefresh() { if (!S || TESTMODE || !fxCurs().length || S.fx.at === TODAY() || navigator.onLine === false) return; fxFetch(true); }
ACT.fxNew = d => txForm(null, { type: 'fx', acct: d.id || QE.acct || '', side: 'buy', cur: fxCurs()[0] || 'USD', rate: String(curRate(fxCurs()[0] || 'USD') || '') });
// 해외 자산 계좌를 다른 계좌의 외화 잔액으로 합치기
ACT.fMerge = d => {
  const a = A(d.id); if (!a || a.type !== 'foreign') return;
  pickAcct({ title: '어느 계좌 안으로 옮길까요?', sub: `${a.name}의 ${a.cur}`, types: ['prepaid', 'bank'], onPick: v => {
    if (!v) return; const b = fbookAt(a.id, TODAY())[a.cur] || { u: +a.famt || 0, c: 0 };
    SH.merge = { from: a.id, to: v, cur: a.cur, u: b.u };
    openSheet(`${bh(`${esc(accName(v))} 안으로 옮기기`, `${fmtF(b.u, a.cur)}`)}
      <div class="lbl first">옮길 금액 (${esc(a.cur)})</div><div class="fld"><input id="mgAmt" class="inp" inputmode="decimal" value="${b.u}"></div>
      <div class="lbl">평균 매입 환율 (1${esc(a.cur)}당 원)</div><div class="fld"><input id="mgRate" class="inp" inputmode="decimal" value="${+a.frate || (b.u > 1e-9 && b.c ? Math.round(b.c / b.u * 10000) / 10000 : '') || curRate(a.cur) || ''}" autofocus></div>
      <div class="hint">이 환율이 환차손익의 기준이 돼요. 모르면 지금 환율을 두세요. 옮긴 뒤 ${esc(a.name)} 계좌는 거래가 없으면 지우고, 있으면 숨겨요.</div>
      <button class="bigbtn"${at('fMergeGo')}>옮기기</button>`);
  } });
};
ACT.fMergeGo = () => {
  const m = SH.merge; if (!m) return; const amt = amtOf(fv('mgAmt')), rate = numOf(fv('mgRate'));
  if (!(amt > 0)) return toast('옮길 금액을 확인하세요');
  if (!(rate > 0)) return toast('매입 환율을 넣으세요');
  SH.merge = null; closeSheet();
  const from = A(m.from), to = A(m.to), used = S.tx.some(t => t.acct === m.from || t.to === m.from) || S.rec.some(r => r.acct === m.from || r.to === m.from);
  commit(() => {
    const fs = { ...(to.fstart || {}) }, old = fs[m.cur];
    if (old && +old.amt) { const tot = +old.amt + amt, w = (+old.amt * (+old.rate || rate) + amt * rate) / tot; fs[m.cur] = { amt: tot, rate: Math.round(w * 10000) / 10000 }; } // 이미 있으면 가중 평균
    else fs[m.cur] = { amt, rate };
    to.fstart = fs; touch(to);
    if (used) { from.hidden = true; from.famt = 0; touch(from); } else removeRec('accounts', m.from);
  });
  if (U.detail === m.from) U.detail = m.to; render();
  toast(`${to.name}의 ${m.cur} 잔액으로 옮겼어요${used ? ' · 예전 계좌는 숨김' : ''}`, true);
};
ACT.setInvStart = () => {
  openSheet(`${bh('투자 집계 시작일', '가계부 시작일과 따로')}<div class="hint top">투자 계좌의 '시작 자산'이 이날 기준이고, 수익은 이날부터 넣고 뺀 돈을 원금에 반영해 계산해요.</div>
    <div class="fld mt"><input type="date" id="isIn" value="${invStart()}"></div><button class="bigbtn"${at('setInvStartOk')}>저장</button>`);
};
ACT.setInvStartOk = () => { const v = fv('isIn'); if (!isDate(v)) return toast('날짜를 확인하세요'); closeSheet(); commit(() => { S.settings = { ...S.settings, invStart: v, u: now() }; }); toast(`투자 집계를 ${v}부터 해요`); };

/* ---------- 계좌 설정 ---------- */
// 시작 외화 잔액 편집 칸 (충전식·입출금 계좌)
function fstartRows(a) {
  const fs = a.fstart || {}, curs = Object.keys(fs);
  return `<div class="lbl">외화 <span class="hnote">· 이 계좌 안의 외화 지갑</span></div>
    ${curs.map(c => `<div class="fsr"><b>${esc(c)}</b><input class="inp" inputmode="decimal" value="${ev(fs[c].amt)}" data-i="f" data-f="fs.${c}.amt" aria-label="${c} 시작 잔액" placeholder="시작 잔액"><input class="inp" inputmode="decimal" value="${ev(fs[c].rate)}" data-i="f" data-f="fs.${c}.rate" aria-label="${c} 매입 환율" placeholder="매입 환율"><button class="ib"${at('fsDel', { c })} aria-label="${c} 빼기">${ico('close', 18)}</button></div>`).join('')}
    <button class="lnk"${at('fsAdd')}>+ 통화 추가</button>
    <button class="tog${fxAutoOf(a) ? ' on' : ''}"${at('fTog', { f: 'fxAuto' })}>외화가 모자라면 원화에서 자동 환전<i></i></button>
    <div class="hint">${curs.length ? `시작 잔액은 ${S.settings.start} 기준이고, 매입 환율은 환차손익의 기준이에요 (모르면 비움).` : '외화로 결제하거나 환전하려면 통화를 추가하세요. 외화 자동결제는 정기 결제에서 통화를 고르면 돼요.'}</div>`;
}
const accPick = (id, act, data, ph = '계좌 선택') => `<button class="frow pick"${at(act, data)}><span class="fv">${A(id) ? `${dotA(A(id))}${esc(accName(id))}` : `<span class="mut">${ph}</span>`}</span>${ico('next', 16)}</button>`;
function acctForm(id) {
  const a = id ? A(id) : null;
  F = a ? { ...a, fstart: Object.fromEntries(Object.entries(a.fstart || {}).map(([k, v]) => [k, { ...v }])) } : { id: null, name: '', type: 'bank', start: 0, fav: false };
  drawAcctForm();
}
const ev = v => esc(v ?? '');
function drawAcctForm() {
  const a = F, ty = a.type;
  const segB = TORD.map(k => `<button class="${ty === k ? 'on' : ''}"${at('fType', { v: k })}>${TYPES[k].l}</button>`).join('');
  const startLbl = { bank: '지금 잔액', card: '아직 결제 안 된 금액 (마이너스)', prepaid: '지금 충전금', saving: '지금까지 넣은 금액', deposit: '넣어 둔 금액', invest: '시작 자산 (예탁자산 = 예수금 + 평가금)' }[ty];
  let extra = '';
  if (ty === 'card') extra = `<div class="lbl">결제일 (선택)</div><div class="fld"><input inputmode="numeric" value="${ev(a.payDay)}" data-i="f" data-f="payDay"></div>`;
  const accField = (f, title, ph) => accPick(a[f], 'fAcc', { f, t: title }, ph);
  if (ty === 'saving' || ty === 'deposit') extra = `<div class="row2"><div><div class="lbl">가입일</div><input class="inp" type="date" value="${ev(a.open)}" data-i="f" data-f="open"></div><div><div class="lbl">만기일 ${ty === 'saving' ? '(청약은 비움)' : ''}</div><input class="inp" type="date" value="${ev(a.mat)}" data-i="f" data-f="mat"></div></div>
    ${ty === 'saving' ? `<div class="lbl">매달 자동 납입 (선택)</div><div class="rule">매달 <input class="sm" inputmode="numeric" value="${ev(a.mday)}" data-i="f" data-f="mday"> 일에 <input inputmode="numeric" value="${ev(a.mamt)}" data-i="f" data-f="mamt"> 원</div>
    <div class="lbl">납입할 때 돈이 나가는 계좌</div>${accField('mfrom', '납입 출금 계좌', '고르면 매달 자동으로 이동이 기록돼요')}` : ''}
    <div class="lbl">만기 후 (선택)</div>${accField('mto', '만기 시 입금 계좌', '그대로 둠')}${a.mto ? `<button class="lnk"${at('fSet', { f: 'mto', v: '' })}>입금 계좌 지정 해제</button>` : ''}`;
  if (ty === 'invest') extra = `<button class="tog${a.isa ? ' on' : ''}"${at('fTog', { f: 'isa' })}>ISA 계좌 (연 납입 한도 보기)<i></i></button>`;
  if (ty === 'foreign') extra = `<div class="lbl">통화</div><div class="fld"><select data-i="f" data-f="cur">${CURS.map(c => `<option${a.cur === c ? ' selected' : ''}>${c}</option>`).join('')}</select></div>
    <div class="lbl">가진 외화 금액 <span class="hnote">· ${S.settings.start} 기준</span></div><div class="fld"><input inputmode="decimal" value="${ev(a.famt)}" data-i="f" data-f="famt"></div>
    <div class="lbl">평균 매입 환율 (선택) <span class="hnote">· 환차손익의 기준</span></div><div class="fld"><input inputmode="decimal" value="${ev(a.frate)}" data-i="f" data-f="frate"></div>
    <div class="lbl">지금 환율 (비우면 새로고침한 환율)</div><div class="fld"><input inputmode="decimal" value="${ev(a.rate)}" data-i="f" data-f="rate"></div>
    ${a.id ? `<button class="btn big mt"${at('fMerge', { id: a.id })}>${ico('move', 18)}다른 계좌 안으로 옮기기</button>` : ''}`;
  if (ty === 'prepaid') extra = `<div class="lbl">충전해 주는 계좌</div>${accPick(a.link, 'fLink', {})}
    <div class="lbl">자동 충전</div><div class="seg">${[['exact', '모자란 만큼만'], ['fixed', '정한 금액만큼']].map(([v, l]) => `<button class="${chgMode(a) === v ? 'on' : ''}"${at('fSet', { f: 'chg', v })}>${l}</button>`).join('')}</div>
    ${chgMode(a) === 'fixed' ? `<div class="rule mt2">충전금이 <input inputmode="numeric" value="${ev(a.th ?? 10000)}" data-i="f" data-f="th"> 원 이하가 되면<br><input inputmode="numeric" value="${ev(a.camt ?? 50000)}" data-i="f" data-f="camt"> 원 충전</div>` : '<div class="hint">결제할 돈이 모자라면 그만큼만 충전 계좌에서 가져와요 (하나머니, 네이버페이 방식).</div>'}
    <div class="lbl">캐시백</div><div class="rule">쓴 돈의 <input class="sm" inputmode="decimal" value="${ev(a.cbp ?? 0)}" data-i="f" data-f="cbp"> % · 충전금과 따로 쌓임</div>
    <div class="lbl">캐시백 쓰는 방식</div><div class="seg">${[['', '기본값대로'], ['keep', '모았다가'], ['first', '결제 때 먼저']].map(([v, l]) => `<button class="${(a.cbMode || '') === v ? 'on' : ''}"${at('fCbMode', { v })}>${l}</button>`).join('')}</div>
    <div class="lbl">지금 캐시백</div><div class="fld"><input inputmode="numeric" value="${ev(a.cbStart ?? 0)}" data-i="f" data-f="cbStart"></div>${fstartRows(a)}`;
  if (ty === 'bank') extra = fstartRows(a);
  const interest = ty === 'bank' || ty === 'saving' || ty === 'deposit' || ty === 'prepaid' ? `<div class="lbl">이자 (선택)</div><div class="rule">${isTerm(a) && (a.ipay || 'mat') === 'mat' ? '연 ' : ''}이율 <input class="sm" inputmode="decimal" value="${ev(a.irate)}" data-i="f" data-f="irate"> %</div>
    ${isTerm(a) ? `<div class="seg mt">${[['mat', '만기에 한 번에'], ['month', '매달 받기']].map(([v, l]) => `<button class="${(a.ipay || 'mat') === v ? 'on' : ''}"${at('fSet', { f: 'ipay', v })}>${l}</button>`).join('')}</div>` : ''}
    ${isTerm(a) && (a.ipay || 'mat') === 'mat' ? `<button class="tog${a.itax !== false ? ' on' : ''}"${at('fItax')}>이자소득세 15.4% 떼기<i></i></button>` : `
    <div class="seg mt">${[['y', '연 이율'], ['m', '월 이율']].map(([v, l]) => `<button class="${(a.iunit || 'y') === v ? 'on' : ''}"${at('fSet', { f: 'iunit', v })}>${l}</button>`).join('')}</div>
    <div class="lbl">이자 받는 날</div><div class="seg">${[['day', '매달 정한 날'], ['sat3', '셋째 토요일 다음 날']].map(([v, l]) => `<button class="${(a.irule || 'day') === v ? 'on' : ''}"${at('fSet', { f: 'irule', v })}>${l}</button>`).join('')}</div>
    ${(a.irule || 'day') === 'day' ? `<div class="fld mt"><input inputmode="numeric" value="${ev(a.iday)}" data-i="f" data-f="iday"></div>` : ''}
    <button class="tog${a.itax !== false ? ' on' : ''}"${at('fItax')}>이자소득세 15.4% 떼기<i></i></button>`}` : '';
  openSheet(`${bh(a.id ? esc(a.name) : '새 계좌', '계좌 설정')}
    <div class="lbl first">이름</div><div class="fld"><input maxlength="20" value="${ev(a.name)}" data-i="f" data-f="name" ${a.id ? '' : 'autofocus'}></div>
    <div class="lbl">종류</div><div class="seg wrap">${segB}</div>
    ${ty !== 'foreign' ? `<div class="lbl">${startLbl} <span class="hnote">· ${ty === 'invest' ? invStart() : S.settings.start} 기준</span></div><div class="fld"><input inputmode="numeric" value="${ev(a.start ?? 0)}" data-i="f" data-f="start"></div>` : ''}
    ${extra}${interest}
    <div class="lbl">색</div><div class="swatches">${['', ...ACOLORS].map(c => `<button class="${(a.color || '') === c ? 'on' : ''}" style="background:${c || TYPES[ty].c}"${at('fColor', { v: c })} aria-label="${c ? '색 ' + c : '종류 색'}">${c ? '' : '기본'}</button>`).join('')}</div>
    <button class="tog${a.fav ? ' on' : ''}"${at('fTog', { f: 'fav' })}>즐겨찾기 (계좌 고를 때 위쪽)<i></i></button>
    ${a.id ? `<button class="tog${a.hidden ? ' on' : ''}"${at('fTog', { f: 'hidden' })}>숨기기 (기록은 남기고 목록에서 빼기)<i></i></button>` : ''}
    <button class="bigbtn"${at('acctSave')}>저장</button>
    ${a.id ? `<button class="bigbtn dan"${at('acctDel')}>계좌 삭제</button>` : ''}`);
}
const setF = (f, v) => { const m = f.match(/^fs\.([A-Z]{3})\.(amt|rate)$/); if (m) { ((F.fstart ||= {})[m[1]] ||= {})[m[2]] = v; } else F[f] = v; };
INP.f = el => setF(el.dataset.f, el.value);
function readForm() { for (const el of document.querySelectorAll('#sheet-root [data-i="f"]')) setF(el.dataset.f, el.value); }
ACT.fsAdd = () => { readForm(); const have = Object.keys(F.fstart || {}), rest = [...new Set([...fxCurs(), ...CURS])].filter(c => !have.includes(c)); const keep = { ...F };
  optSheet('통화 추가', '', rest.map(c => [c, `${c}${CSYM[c] ? ' ' + CSYM[c] : ''}`]), '', 'fsPick'); SH.fsKeep = keep; };
ACT.fsPick = d => { closeSheet(); F = SH.fsKeep || F; (F.fstart ||= {})[d.v] = { amt: '', rate: '' }; drawAcctForm(); };
ACT.fsDel = d => { readForm(); if (F.fstart) delete F.fstart[d.c]; drawAcctForm(); };
ACT.fType = d => { readForm(); F.type = d.v; drawAcctForm(); };
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
  if (!name) return toast('이름을 넣으세요');
  if (S.accounts.some(a => a.name === name && a.id !== F.id)) return toast('같은 이름의 계좌가 있어요');
  const o = { ...F, name, start: num(F.start) };
  for (const k of OPT_NUM) if (k in o) o[k] = optNum(o[k]);
  const fs = {}; for (const [c, x] of Object.entries(o.fstart || {})) { const amt = optNum(x.amt), rate = optNum(x.rate); if (amt) fs[c] = { amt, rate }; else if (rate) fs[c] = { amt: 0, rate }; }
  for (const c of Object.keys(fs)) if (!fs[c].amt) delete fs[c];
  if (Object.keys(fs).length) o.fstart = fs; else delete o.fstart;
  if (o.type === 'foreign' && o.cur) o.cur = String(o.cur).toUpperCase();
  if (o.type === 'prepaid' && !o.link) toast('충전 계좌를 정하지 않아 자동 충전 기록의 출금 계좌가 비어 있어요');
  closeSheet();
  commit(() => {
    if (o.id) { const i = S.accounts.findIndex(a => a.id === o.id); S.accounts[i] = touch(o); }
    else { o.id = uid(); S.accounts.push(touch(o)); }
  });
  toast('저장했어요');
};
ACT.acctDel = () => {
  const id = F.id, n = S.tx.filter(t => t.acct === id || t.to === id).length, r = S.rec.filter(x => x.acct === id || x.to === id).length;
  confirmSheet('계좌 삭제', `<b>${esc(F.name)}</b>을(를) 삭제할까요?${n || r ? `<br>이 계좌의 거래 <b>${n}건</b>${r ? `과 정기 결제 <b>${r}건</b>` : ''}도 함께 지워져요.<br>기록을 남기려면 '숨기기'를 쓰세요.` : ''}`, '삭제', () => {
    commit(() => {
      for (const t of S.tx.filter(t => t.acct === id || t.to === id)) removeRec('tx', t.id);
      for (const x of S.rec.filter(x => x.acct === id || x.to === id)) removeRec('rec', x.id);
      for (const a of S.accounts) if (a.link === id) { a.link = ''; touch(a); }
      removeRec('accounts', id);
    });
    if (U.acct === id) U.acct = null; if (U.detail === id) { U.detail = null; navPop(); } render(); toast('삭제했어요', true);
  }, true);
};
ACT.acctEdit = d => acctForm(d.id);
ACT.acctNew = () => acctForm(null);

/* ---------- 정기 결제 ---------- */
function recForm(id) {
  const r = id ? S.rec.find(x => x.id === id) : null;
  F = r ? { ...r, amt: r.cur ? r.famt : r.amt } : { id: null, name: '', type: 'out', amt: '', day: '', acct: lastAcct() || '', to: '', cat: '', start: TODAY(), end: '', cur: '' };
  drawRecForm();
}
function drawRecForm() {
  const r = F, kind = r.type === 'in' ? 'inc' : 'exp';
  const accBtn = (f, l) => `<div class="lbl">${l}</div>${accPick(r[f], 'rPick', { f })}`;
  openSheet(`${bh(r.id ? esc(r.name) : '새 정기 결제 · 이체', '매달 자동으로 기록돼요')}
    <div class="lbl first">이름</div><div class="fld"><input maxlength="20" value="${ev(r.name)}" data-i="r" data-f="name"></div>
    <div class="lbl">구분</div><div class="seg">${[['out', '지출'], ['in', '수입'], ['move', '이동']].map(([k, l]) => `<button class="${r.type === k ? 'on' : ''}"${at('rType', { v: k })}>${l}</button>`).join('')}</div>
    <div class="row2"><div><div class="lbl">금액${r.cur ? ` (${esc(r.cur)})` : ''}</div><div class="fld"><input inputmode="decimal" value="${ev(r.amt)}" data-i="r" data-f="amt"></div></div>
      <div><div class="lbl">매달 며칠</div><div class="fld"><input inputmode="numeric" value="${ev(r.day)}" data-i="r" data-f="day" placeholder="1~31"></div></div></div>
    ${r.type !== 'move' ? `<div class="lbl">통화</div><div class="fld"><select data-i="r" data-f="cur" aria-label="통화"><option value="">원화 (KRW)</option>${[...new Set([...fxCurs(), ...CURS])].map(c => `<option value="${c}"${r.cur === c ? ' selected' : ''}>${c}${CSYM[c] ? ' ' + CSYM[c] : ''}</option>`).join('')}</select></div>
    ${r.cur ? `<div class="hint">결제일에 그날 환율로 원화로 바꿔 기록해요. 계좌에 ${esc(r.cur)}이(가) 모자라면 원화에서 모자란 만큼 환전하고, 원화도 모자라면 충전 계좌에서 가져와요. 지금 환율로는 약 ${curRate(r.cur) ? fmt((amtOf(r.amt) || 0) * curRate(r.cur)) + '원' : '— (환율을 새로고침하세요)'}</div>` : ''}` : ''}
    ${accBtn('acct', r.type === 'in' ? '들어오는 계좌' : r.type === 'move' ? '보내는 계좌' : '나가는 계좌')}
    ${r.type === 'move' ? accBtn('to', '받는 계좌') : `<div class="lbl">카테고리</div>${catGrid(kind, r.cat, 'rCat')}`}
    <div class="row2"><div><div class="lbl">시작일</div><div class="fld"><input type="date" value="${ev(r.start)}" data-i="r" data-f="start"></div></div>
      <div><div class="lbl">끝나는 날 (선택)</div><div class="fld"><input type="date" value="${ev(r.end)}" data-i="r" data-f="end"></div></div></div>
    <div class="hint">31일로 정하면 짧은 달에는 말일에 기록돼요.</div>
    <button class="bigbtn"${at('recSave')}>저장</button>${r.id ? `<button class="bigbtn dan"${at('recDel')}>삭제</button>` : ''}`);
}
INP.r = el => { F[el.dataset.f] = el.value; if (el.dataset.f === 'cur') { readR(); drawRecForm(); } };
const readR = () => { for (const el of document.querySelectorAll('#sheet-root [data-i="r"]')) F[el.dataset.f] = el.value; };
ACT.rType = d => { readR(); F.type = d.v; if (d.v === 'move') { F.cat = ''; F.cur = ''; } else { F.to = ''; if (F.cat && catOf(F.cat)?.k !== (d.v === 'in' ? 'inc' : 'exp')) F.cat = ''; } drawRecForm(); };
ACT.rCat = d => { readR(); F.cat = d.v; drawRecForm(); };
ACT.rPick = d => { readR(); const keep = { ...F }; pickAcct({ title: d.f === 'to' ? '받는 계좌' : '계좌', cur: F[d.f], exclude: d.f === 'to' ? F.acct : '', onPick: v => { F = { ...keep, [d.f]: v || '' }; drawRecForm(); } }); };
ACT.recSave = () => {
  readR();
  const o = { ...F, name: String(F.name || '').trim(), amt: Math.abs(num(F.amt)), day: Math.round(num(F.day)) };
  if (!o.name) return toast('이름을 넣으세요');
  if (o.type === 'move') o.cur = '';
  if (o.cur) { o.famt = Math.round(Math.abs(amtOf(F.amt) || 0) * 100) / 100; if (!o.famt) return toast('금액을 넣으세요'); if (!curRate(o.cur)) return toast('먼저 자산 탭에서 환율을 새로고침하세요'); o.amt = Math.round(o.famt * curRate(o.cur)); }
  else { delete o.cur; delete o.famt; }
  if (!o.amt) return toast('금액을 넣으세요');
  if (o.day < 1 || o.day > 31) return toast('날짜는 1~31 사이로 넣으세요');
  if (!o.acct) return toast('계좌를 고르세요');
  if (o.type === 'move' && !o.to) return toast('받는 계좌를 고르세요');
  if (o.type !== 'move' && !o.cat) return toast('카테고리를 고르세요');
  if (!isDate(o.start)) return toast('시작일을 넣으세요');
  if (o.end && !isDate(o.end)) o.end = '';
  closeSheet();
  commit(() => { if (o.id) { const i = S.rec.findIndex(x => x.id === o.id); S.rec[i] = touch(o); } else { o.id = uid(); S.rec.push(touch(o)); } });
  toast('저장했어요');
};
ACT.recDel = () => { const id = F.id; confirmSheet('정기 결제 삭제', '이 항목을 삭제할까요? 이미 자동으로 기록된 것도 함께 사라져요.', '삭제', () => { commit(() => removeRec('rec', id)); toast('삭제했어요', true); }, true); };
ACT.recEdit = d => recForm(d.id);
ACT.recNew = () => recForm(null);

/* ---------- 카테고리 ---------- */
function catForm(id, kind, back) {
  const c = id ? S.cats.find(x => x.id === id) : null;
  const keepF = F && !c && back ? F : null; // 기록 창에서 '추가'로 왔으면 그 창으로 돌아감
  F = c ? { ...c, old: c.n } : { id: null, n: '', i: '', k: kind || 'exp', back, keepF };
  openSheet(`${bh(c ? esc(c.n) : '새 카테고리', c ? (c.k === 'exp' ? '지출' : '수입') : '')}
    <div class="row2"><div style="flex:0 0 88px"><div class="lbl">아이콘 (선택)</div><div class="fld"><input id="cIc" maxlength="2" value="${ev(F.i)}" style="text-align:center" placeholder="자동"></div></div>
    <div><div class="lbl">이름</div><div class="fld"><input id="cNm" maxlength="12" value="${ev(F.n)}" autofocus></div></div></div>
    ${c ? '' : `<div class="lbl">종류</div><div class="seg">${[['exp', '지출'], ['inc', '수입']].map(([k, l]) => `<button class="${F.k === k ? 'on' : ''}"${at('cKind', { v: k })}>${l}</button>`).join('')}</div>`}
    ${F.k === 'exp' ? `<div class="lbl">월 예산 (선택)</div><div class="fld"><input id="cBud" inputmode="numeric" value="${+F.b ? fmt(F.b) : ''}" placeholder="비우면 예산 없음"></div>` : ''}
    <button class="bigbtn"${at('catSave')}>저장</button>${c ? `<button class="bigbtn dan"${at('catDel')}>삭제</button>` : ''}`);
}
ACT.cKind = d => { const n = fv('cNm'), i = fv('cIc'), f = F; catForm(null, d.v, f.back); F.keepF = f.keepF; $('#cNm').value = n; $('#cIc').value = i; };
ACT.catSave = () => {
  const n = fv('cNm').trim(), i = fv('cIc').trim(), b = Math.abs(num(fv('cBud'))) || null;
  if (!n) return toast('이름을 넣으세요');
  if (S.cats.some(c => c.n === n && c.id !== F.id)) return toast('같은 이름이 있어요');
  const f = F; closeSheet();
  commit(() => {
    if (f.id) {
      const c = S.cats.find(x => x.id === f.id); Object.assign(c, { n, i, b }); touch(c);
      if (f.old !== n) { for (const t of S.tx) if (t.cat === f.old) { t.cat = n; touch(t); } for (const r of S.rec) if (r.cat === f.old) { r.cat = n; touch(r); } }
    } else S.cats.push(touch({ id: uid(), n, i, b, k: f.k }));
  }, { silent: !!f.keepF });
  if (f.keepF) { F = { ...f.keepF, cat: n }; if (f.back === 'rCat') drawRecForm(); else if (f.back === 'tfCat') drawTxForm(); else render(); }
};
ACT.catDel = () => {
  const f = F, used = S.tx.filter(t => t.cat === f.n).length;
  confirmSheet('카테고리 삭제', `<b>${esc(f.n)}</b>을(를) 삭제할까요?${used ? `<br>이 카테고리를 쓴 기록 <b>${used}건</b>은 미분류가 돼요.` : ''}`, '삭제', () => commit(() => {
    for (const t of S.tx) if (t.cat === f.n) { t.cat = ''; touch(t); }
    removeRec('cats', f.id);
  }), true);
};
ACT.catEdit = d => catForm(d.id);
ACT.catNew = d => { if (d.back === 'tfCat') readTf(); else if (d.back === 'rCat') readR(); else if (d.back !== 'cpickA') F = null; catForm(null, d.kind, d.back === 'cpickA' ? '' : d.back); };
