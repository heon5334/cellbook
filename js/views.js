'use strict';
// 탭 화면: 홈 · 내역 · 통계 (자산은 pages.js, 계좌 화면은 acct.js)

/* ---------- 거래 한 줄 ---------- */
const AUTOL = { rec: '정기', chg: '자동 충전', cb: '캐시백', int: '이자', dep: '자동 납입', matx: '만기', fxa: '자동 환전' };
const accS = id => esc(accName(id));
function txRow(r, o = {}) {
  const ctx = o.acct, tags = (r.tags || []).map(g => `<span class="tag">#${esc(g)}</span>`).join('');
  const badge = r.auto ? `<span class="auto">${AUTOL[r.auto]}</span>` : '';
  let ic, m1, m2 = [], amt, sub = '';
  if (r.type === 'fx') {
    const sell = r.side === 'sell';
    ic = `<span class="ci" style="background:#2F6FDB1F;color:#2F6FDB">${ico('fx', 18)}</span>`; m1 = r.memo || `${sell ? '외화 → 원화' : '원화 → 외화'} 환전`;
    m2.push(`환율 ${fmtR(r.rate)}`, accS(r.acct));
    amt = `<span class="${sell ? 'pos' : ''}">${sell ? '+' : '-'}${fmt(r.amt)}</span><small class="fxs">${sell ? '-' : '+'}${fmtF(r.famt, r.cur)}</small>`;
  } else if (r.type === 'move') {
    ic = ciMove(); m1 = r.memo || '내 계좌로 이동'; m2.push(`${accS(r.acct)} → ${accS(r.to)}`);
    const dl = ctx ? (r.cur ? fdelta(r, ctx) : delta(r, ctx)) : 0;
    if (r.cur) amt = ctx ? `<span class="${dl > 0 ? 'pos' : ''}">${dl > 0 ? '+' : '-'}${fmtF(r.famt, r.cur)}</span><small>${fmt(r.amt)}원</small>` : `<span class="mv">${fmtF(r.famt, r.cur)}</span><small>${fmt(r.amt)}원</small>`;
    else amt = ctx ? `<span class="${dl > 0 ? 'pos' : ''}">${dl > 0 ? '+' : '-'}${fmt(r.amt)}</span>` : `<span class="mv">${fmt(r.amt)}</span>`;
  } else if (r.type === 'adj') {
    ic = `<span class="ci" style="background:#6B77851F;color:#6B7785">${ico('adj', 18)}</span>`; m1 = r.memo || '잔액 조정'; m2.push(accS(r.acct));
    amt = r.cur ? `<span class="mv">${r.famt > 0 ? '+' : '-'}${fmtF(Math.abs(r.famt), r.cur)}</span>` : `<span class="mv">${r.amt > 0 ? '+' : '-'}${fmt(Math.abs(r.amt))}</span>`;
  } else {
    const kind = r.type === 'in' ? 'inc' : 'exp';
    ic = r.cat ? ciHTML(r.cat, kind) : `<span class="ci none">${ico('dots', 18)}</span>`;
    m1 = r.memo || r.cat || (r.type === 'in' ? '입금' : '지출');
    if (r.memo) m2.push(r.cat ? esc(r.cat) : '<span class="warnt">미분류</span>'); else if (!r.cat) m2.push('<span class="warnt">미분류</span>');
    m2.push(accS(r.acct));
    if (r._cbUse) m2.push(`캐시백 ${fmt(r._cbUse)} 사용`);
    if (r.cur) amt = `<span class="${r.type === 'in' ? 'pos' : ''}">${r.type === 'in' ? '+' : '-'}${fmtF(r.famt, r.cur)}</span><small>${fmt(r.amt)}원</small>`;
    else amt = r.type === 'in' ? `<span class="pos">+${fmt(r.amt)}</span>` : `-${fmt(r.amt)}`;
    if (r.type === 'out' && !r.auto && !r.cur) { const rf = refundMap()[r.id]; if (rf) sub = `<small>실지출 ${fmt(Math.max(0, r.amt - rf))}</small>`; }
    if (isLinkedIn(r)) sub = '<small class="lkd">정산 연결</small>';
  }
  return `<button class="tx${U.flash === r.id ? ' new' : ''}${r.auto ? ' isauto' : ''}${o.child ? ' child' : ''}"${at('tx', { id: r.id })}>${ic}<span class="mid"><span class="m1">${esc(m1)}${badge}</span><span class="m2">${m2.join(' · ')}${tags}</span></span><span class="am">${amt}${sub}</span></button>`;
}
// 날짜별로 묶기 (최근 날짜가 위). 자동 환전·충전·캐시백은 그 결제 아래에 붙여서
function dayGroups(rows, o = {}) {
  let h = '', cur = '', grp = [];
  const flush = () => {
    if (!grp.length) return;
    let out = 0, inn = 0;
    for (const r of grp) {
      if (r.type === 'fx') continue;
      if (o.acct) { const fd = r.cur ? fdelta(r, o.acct) : 0, d = r.cur ? (fd > 0 ? Math.abs(r.amt) : -Math.abs(r.amt)) : delta(r, o.acct); if (d < 0) out -= d; else inn += d; }
      else if (r.type === 'out') out += netOut(r); else if (r.type === 'in' && !isLinkedIn(r)) inn += r.amt;
    }
    let top = '';
    const body = grp.map(r => { const child = !!r.grp && r.grp !== r.id && top === r.grp; if (!child) top = r.id; return txRow(r, { ...o, child }); }).join('');
    h += `<div class="day" data-d="${cur}"><span>${dayLbl(cur)}</span><span>${inn ? `<b class="pos">+${fmt(inn)}</b>` : ''}${out ? `<b>-${fmt(out)}</b>` : ''}</span></div><div class="card tight">${body}</div>`;
    grp = [];
  };
  for (const r of rows) { if (r.date !== cur) { flush(); cur = r.date; } grp.push(r); }
  flush();
  return h;
}
const byNewest = (a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : (b.seq ?? 0) - (a.seq ?? 0);

/* ---------- 홈 ---------- */
function noAccounts() {
  return `<div class="card empty"><div class="ei">${ico('wallet', 30)}</div><b>계좌가 없어요</b>
    <button class="btn pri big"${at('acctNew')}>계좌 추가</button></div>`;
}
function heroCard() {
  const b = budgetInfo(), m = ym(TODAY()), day = +TODAY().slice(8);
  if (!b.B) {
    const pm = addM(m, -1), pe = `${pm}-${pad2(Math.min(day, lastDay(pm)))}`, prev = rstats(mRange(pm)[0], pe).exp, d = b.spent - prev;
    return `<div class="card hero"><div class="l">이번 달 쓴 돈</div><div class="big">${won(b.spent)}</div>
      <div class="meta"><span>${prev || b.spent ? `지난달 이맘때보다 <b class="${d > 0 ? 'neg' : 'pos'}">${man(Math.abs(d))}원 ${d > 0 ? '더' : '덜'}</b> 썼어요` : '아직 기록이 없어요'}</span>
      <button class="lnk"${at('setBudget')}>예산 정하기</button></div></div>`;
  }
  const over = b.rest < 0;
  return `<div class="card hero"><div class="l">${over ? '예산을 넘었어요' : '오늘 쓸 수 있는 돈'}</div>
    <div class="big ${over ? 'neg' : ''}">${over ? won(-b.rest) : won(Math.max(b.can, 0))}</div>
    ${!over && b.can < 0 ? `<div class="hs neg">오늘 하루 몫보다 ${fmt(-b.can)}원 더 썼어요</div>` : over ? '<div class="hs">이번 달 예산보다 더 쓴 금액이에요</div>' : `<div class="hs">하루 ${fmt(b.daily)}원씩 쓰면 예산에 맞아요</div>`}
    ${pbar(b.spent / b.B * 100, over ? 'over' : b.spent / b.B > (day / lastDay(m)) + .1 ? 'warn' : '')}
    <div class="meta"><span>예산 ${man(b.B)}원 중 ${man(b.spent)}원 씀</span><span>${b.left}일 남음</span></div></div>`;
}
function todoCard() {
  const items = inbox(); if (!items.length) return '';
  const all = U.todoAll || items.length <= 3, show = all ? items : items.slice(0, 3);
  return `<div class="card todo"><div class="ct">확인할 것<span class="r">${items.length}건</span></div>
    ${show.map((it, i) => `<div class="it" data-k="${esc(it.key)}"><button class="itb"${at('todoGo', { i: items.indexOf(it) })}><span class="ic ${it.tone || ''}">${ico(it.ic, 18)}</span><div class="tt">${it.t}${it.s ? `<small>${it.s}</small>` : ''}</div>${ico('next', 16)}</button></div>`).join('')}
    <div class="note in">누르면 바로 고칠 수 있고, 옆으로 밀면 넘어가요.</div>
    ${all ? '' : `<button class="more"${at('todoAll')}>${items.length - 3}건 더 보기</button>`}</div>`;
}
function recapCard() {
  const cm = ym(TODAY()), pm = addM(cm, -1);
  if (+TODAY().slice(8) > 10 || U.recapSeen === pm || pm < ym(S.settings.start)) return '';
  const st = mstats(pm); if (!st.inc && !st.exp) return '';
  const top = Object.entries(st.cats).sort((a, b) => b[1] - a[1])[0];
  return `<div class="card recap"><div class="ct">${mShort(pm)} 결산<button class="x"${at('recapClose', { m: pm })} aria-label="닫기">${ico('close', 16)}</button></div>
    <div class="rk"><div><span>지출</span><b>${man(st.exp)}</b></div><div><span>수입</span><b class="pos">${man(st.inc)}</b></div><div><span>남은 돈</span><b class="${st.net >= 0 ? 'pos' : 'neg'}">${st.net >= 0 ? '+' : '-'}${man(Math.abs(st.net))}</b></div></div>
    ${top ? `<div class="rs">가장 많이 쓴 곳은 <b>${esc(top[0])}</b> ${man(top[1])}원이에요</div>` : ''}
    <button class="lnk"${at('recapMore', { m: pm })}>통계에서 자세히</button></div>`;
}
function budgetCard() {
  const m = ym(TODAY()), st = mstats(m), withB = S.cats.filter(c => c.k === 'exp' && +c.b > 0);
  if (withB.length) {
    const rows = withB.map(c => ({ c, v: st.cats[c.n] || 0 })).sort((a, b) => b.v / b.c.b - a.v / a.c.b);
    return `<div class="card bud"><div class="ct">카테고리 예산<button class="r lnk"${at('openSet', { v: 'cat' })}>설정</button></div>
      ${rows.map(({ c, v }) => { const p = v / c.b * 100; return `<button class="it"${at('goList', { cat: c.n })}>${ciHTML(c.n, 'exp')}<div><div class="nm">${esc(c.n)}<span class="${p > 100 ? 'neg' : ''}">${man(v)} / ${man(c.b)}</span></div>${pbar(p, p > 100 ? 'over' : p > 85 ? 'warn' : '')}</div></button>`; }).join('')}</div>`;
  }
  const cs = Object.entries(st.cats).sort((a, b) => b[1] - a[1]).slice(0, 3); if (!cs.length) return '';
  const mx = cs[0][1];
  return `<div class="card bud"><div class="ct">많이 쓴 곳<span class="r">이번 달</span></div>
    ${cs.map(([k, v]) => `<button class="it"${at('goList', { cat: k })}>${ciHTML(k, 'exp')}<div><div class="nm">${esc(k)}<span>${fmt(v)}원</span></div>${pbar(v / mx * 100, 'soft')}</div></button>`).join('')}
    <button class="lnk"${at('openSet', { v: 'cat' })}>카테고리별 예산 정하기</button></div>`;
}
// 홈의 계좌 묶음: 입출금(통장·카드·충전식 중 최근 60일 거래 많은 3개) · 투자(평가금액 큰 3개)
function homeAccts() {
  const T = TODAY(), from = addD(T, -60), cnt = {};
  for (const t of S.tx) if (t.date >= from && t.date <= T) { cnt[t.acct] = (cnt[t.acct] || 0) + 1; if (t.to) cnt[t.to] = (cnt[t.to] || 0) + 1; }
  const cash = accts().filter(a => ['bank', 'card', 'prepaid'].includes(a.type)).sort((a, b) => (cnt[b.id] || 0) - (cnt[a.id] || 0)).slice(0, 3);
  const inv = accts().filter(a => a.type === 'invest').sort((a, b) => valueAt(b, T) - valueAt(a, T)).slice(0, 3);
  const card = (l, xs) => xs.length ? `<div class="card acs"><div class="ct">${l}<button class="r lnk"${at('tab', { v: 'assets' })}>전체</button></div>${xs.map(acctLine).join('')}</div>` : '';
  return card('입출금', cash) + card('투자', inv);
}
function vHome() {
  const T = TODAY();
  const hdr = `<div class="t">${+T.slice(5, 7)}월 ${+T.slice(8)}일 ${dayName(T)}요일</div><div class="sp"></div>${syncIcon() ? `<button class="ib"${at('syncMenu')} aria-label="동기화">${syncIcon()}</button>` : ''}${ib('gear', 'gear', '설정')}`;
  if (!S.accounts.length) return { hdr, body: noAccounts() };
  const m = ym(T), st = mstats(m), tot = groups(T).total;
  const body = heroCard() + `<div class="trio">
      <button class="c"${at('tab', { v: 'stats' })}><div class="l">${+m.slice(5)}월 지출</div><div class="v">${man(st.exp)}</div></button>
      <button class="c"${at('tab', { v: 'stats' })}><div class="l">${+m.slice(5)}월 수입</div><div class="v pos">${man(st.inc)}</div></button>
      <button class="c"${at('tab', { v: 'assets' })}><div class="l">총자산</div><div class="v">${man(tot)}</div></button></div>`
    + todoCard() + recapCard() + budgetCard() + homeAccts();
  return { hdr, body, qe: true };
}

/* ---------- 내역 ---------- */
const fltOn = () => U.acct || U.flt.t !== 'all' || U.flt.cats.length || U.flt.tag || U.q;
function listRows() {
  const key = 'lr' + JSON.stringify([U.month, U.q, U.acct, U.flt]);
  return MEMO[key] ??= listRows0();
}
function listRows0() {
  const st = S.settings.start, q = U.q.toLowerCase(), f = U.flt, T = TODAY();
  const [s, e] = U.q ? [st, T] : mRange(U.month);
  const hay = r => [r.memo, r.cat, accName(r.acct), r.to ? accName(r.to) : '', ...(r.tags || []).map(g => '#' + g), String(r.amt)].join(' ').toLowerCase();
  return led().filter(r => r.date >= s && r.date <= e && r.date >= st && (!U.acct || r.acct === U.acct || r.to === U.acct) && (f.t === 'all' || r.type === f.t)
    && (!f.cats.length || f.cats.includes(r.cat || '미분류')) && (!f.tag || (r.tags || []).includes(f.tag)) && (!q || hay(r).includes(q))).sort(byNewest);
}
function vList() {
  const searching = !!U.q;
  const hdr = `${searching ? `<div class="t">검색</div>` : monthNav()}<div class="sp"></div>${ib('search', 'search', '검색')}${ib('filter', 'filter', '필터', {}, fltOn() && !searching ? 'on' : '')}`;
  if (!S.accounts.length) return { hdr, body: noAccounts() };
  const rows = listRows(), f = U.flt;
  const chip = (l, a, d = {}) => `<button class="fchip"${at(a, d)}>${l}${ico('close', 13)}</button>`;
  const chips = [U.q && chip(`"${esc(U.q)}"`, 'fltClear', { k: 'q' }), U.acct && chip(accS(U.acct), 'fltClear', { k: 'acct' }), f.t !== 'all' && chip(TXL[f.t], 'fltClear', { k: 't' }),
    ...f.cats.map(c => chip(esc(c), 'fltClear', { k: 'cat', v: c })), f.tag && chip('#' + esc(f.tag), 'fltClear', { k: 'tag' })].filter(Boolean);
  let inn = 0, out = 0;
  for (const r of rows) {
    if (U.acct) { const d = delta(r, U.acct); if (r.type === 'adj') continue; if (d < 0) out -= d; else inn += d; continue; }
    if (!inStats(A(r.acct))) continue;
    if (r.type === 'out') out += netOut(r); else if (r.type === 'in' && !isLinkedIn(r)) inn += r.amt;
  }
  const lim = U.more ? 2000 : 300;
  const body = (chips.length ? `<div class="fchips">${chips.join('')}${chips.length > 1 ? `<button class="lnk"${at('fltReset')}>모두 지우기</button>` : ''}</div>` : '')
    + `<div class="sum3"><span>수입 <b class="pos">${fmt(inn)}</b></span><span>지출 <b>${fmt(out)}</b></span><span class="mut">${rows.length}건</span></div>`
    + (rows.length ? dayGroups(rows.slice(0, lim), { acct: U.acct }) + (rows.length > lim ? `<button class="more card"${at('moreRows')}>${rows.length - lim}건 더 보기</button>` : '')
      : `<div class="card empty sm"><b>${searching || fltOn() ? '찾는 기록이 없어요' : `${mShort(U.month)} 기록이 없어요`}</b></div>`);
  return { hdr, body, qe: true, after: () => { if (U.flash) setTimeout(() => { U.flash = null; }, 1200); } };
}

/* ---------- 통계 ---------- */
function statRange() {
  const T = TODAY(), cm = ym(T);
  if (U.sp === 'prev') { const pm = addM(cm, -1); return { s: mRange(pm)[0], e: mRange(pm)[1], l: mLabel(pm), m: pm }; }
  if (U.sp === '3m') return { s: mRange(addM(cm, -2))[0], e: T, l: '최근 3개월' };
  if (U.sp === 'custom' && U.sr && isDate(U.sr.s) && isDate(U.sr.e)) { const [s, e] = U.sr.s <= U.sr.e ? [U.sr.s, U.sr.e] : [U.sr.e, U.sr.s]; return { s, e, l: `${dLabel(s)} ~ ${dLabel(e)}` }; }
  if (U.sp === 'mon' && U.month) return { s: mRange(U.month)[0], e: endOf(U.month), l: mLabel(U.month), m: U.month };
  return { s: mRange(cm)[0], e: T, l: '이번 달', m: cm };
}
const PAL = ['#2E8B57', '#2F6FDB', '#D2692F', '#7A4FB0', '#1B8A8F', '#B7791F', '#C2416B', '#9A6232', '#5C6BC0', '#6B7785'];
function catColors(keys) {
  const used = new Set(), out = {};
  for (const k of keys) { let c = catIcon(k, 'exp').c; if (used.has(c) || k === '미분류') c = PAL.find(x => !used.has(x)) || '#9AA5B1'; used.add(c); out[k] = c; }
  return out;
}
function donut(parts, total) {
  const R = 46, C = 2 * Math.PI * R; let off = 0;
  const segs = parts.map(([, v, c]) => { const len = v / total * C; const s = `<circle r="${R}" cx="60" cy="60" fill="none" stroke="${c}" stroke-width="18" stroke-dasharray="${Math.max(0, len - 1.5).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`; off += len; return s; });
  return `<svg viewBox="0 0 120 120" class="dn" aria-hidden="true"><g transform="rotate(-90 60 60)"><circle r="${R}" cx="60" cy="60" fill="none" stroke="var(--track)" stroke-width="18"/>${segs.join('')}</g></svg>`;
}
function vStats() {
  const hdr = `<div class="t">통계</div><div class="sp"></div>`;
  if (!S.accounts.length) return { hdr, body: noAccounts() };
  const R = statRange(), st = rstats(R.s, R.e), T = TODAY();
  const days = Math.max(1, dayGap(R.s, R.e < T ? R.e : T) + 1);
  // 비교: 이번 달은 지난달 같은 날까지, 나머지는 바로 앞 같은 길이
  let cmpL = '', ps, pe;
  if (U.sp === 'month' || !U.sp) { const pm = addM(ym(T), -1); ps = mRange(pm)[0]; pe = `${pm}-${pad2(Math.min(+T.slice(8), lastDay(pm)))}`; cmpL = '지난달 이맘때보다'; }
  else if (R.m) { const pm = addM(R.m, -1); [ps, pe] = mRange(pm); cmpL = `${mShort(pm)}보다`; }
  else { const n = dayGap(R.s, R.e) + 1; ps = addD(R.s, -n); pe = addD(R.s, -1); cmpL = '앞 기간보다'; }
  const pv = rstats(ps, pe), d = st.exp - pv.exp;
  const seg = [['month', '이번 달'], ['prev', '지난달'], ['3m', '3개월'], ['custom', '직접']].map(([k, l]) => `<button class="${(U.sp === k || (k === 'month' && U.sp === 'mon')) ? 'on' : ''}"${at('statP', { v: k })}>${l}</button>`).join('');
  const custom = U.sp === 'custom' ? `<div class="row2 dr"><input type="date" class="inp" data-i="sr" data-k="s" value="${esc(U.sr?.s || mRange(ym(T))[0])}" aria-label="시작일"><span>~</span><input type="date" class="inp" data-i="sr" data-k="e" value="${esc(U.sr?.e || T)}" aria-label="종료일"></div>` : '';
  const cs = Object.entries(st.cats).sort((a, b) => b[1] - a[1]), col = catColors(cs.map(x => x[0]));
  const parts = cs.slice(0, 5).map(([k, v]) => [k, v, col[k]]); const rest = cs.slice(5).reduce((x, y) => x + y[1], 0); if (rest) parts.push(['그 밖', rest, '#9AA5B1']);
  const summary = `<div class="card ssum"><div class="l">${esc(R.l)} 지출</div><div class="big">${won(st.exp)}</div>
    <div class="kv"><span>하루 평균 <b>${fmt(st.exp / days)}원</b></span><span>수입 <b class="pos">${fmt(st.inc)}원</b></span></div>
    ${pv.exp || st.exp ? `<div class="cmp ${d > 0 ? 'bad' : 'good'}">${cmpL} <b>${fmt(Math.abs(d))}원 ${d > 0 ? '더' : '덜'}</b> 썼어요</div>` : ''}
    ${st.refund ? `<div class="kv mut">정산·환불 ${fmt(st.refund)}원은 지출에서 뺐어요</div>` : ''}</div>`;
  const chart = cs.length ? `<div class="card"><div class="ct">어디에 썼나</div><div class="donut">${donut(parts, st.exp)}<div class="lg">${parts.map(([k, v, c]) => `<div><i style="background:${c}"></i>${esc(k)}<span>${pct(v, st.exp)}%</span></div>`).join('')}</div></div></div>` : '';
  const isMon = !!R.m;
  const catList = cs.length ? `<div class="card"><div class="ct">카테고리<span class="r">눌러서 태그별 보기</span></div>${cs.map(([k, v]) => {
    const c = catOf(k), b = isMon && +c?.b ? +c.b : 0, open = U.open[k], tg = Object.entries(st.catTags[k] || {}).sort((x, y) => y[1] - x[1]), tsum = tg.reduce((x, y) => x + y[1], 0);
    return `<button class="crow"${at('catOpen', { k })}>${ciHTML(k, 'exp')}<span class="cn">${esc(k)}${b ? `<small class="${v > b ? 'neg' : ''}">예산 ${man(b)} 중 ${pct(v, b)}%</small>` : ''}</span><span class="v">${fmt(v)}</span><span class="p">${pct(v, st.exp)}%</span></button>`
      + (open ? `<div class="sub">${tg.map(([g, x]) => `<button class="trow"${at('goList', { tag: g, cat: k, m: R.m || '' })}>#${esc(g)}<span class="v">${fmt(x)}</span><span class="p">${pct(x, v)}%</span></button>`).join('')}
        ${v - tsum > 0 && tg.length ? `<div class="trow mut">태그 없음<span class="v">${fmt(v - tsum)}</span><span class="p">${pct(v - tsum, v)}%</span></div>` : ''}${!tg.length ? '<div class="trow mut">태그를 단 기록이 없어요</div>' : ''}
        <button class="trow lnk"${at('goList', { cat: k, m: R.m || '' })}>내역 보기</button></div>` : '');
  }).join('')}</div>` : `<div class="card empty sm"><b>이 기간에 쓴 돈이 없어요</b></div>`;
  const top = st.top.slice(0, 5);
  const topCard = top.length ? `<div class="card"><div class="ct">가장 큰 지출</div>${top.map((r, i) => `<button class="rank"${at('tx', { id: r.id })}><span class="k">${i + 1}</span>${ciHTML(r.cat, 'exp')}<span class="cn">${esc(r.memo || r.cat || '지출')}<small>${dLabel(r.date)} · ${accS(r.acct)}</small></span><span class="v">${fmt(r.v)}</span></button>`).join('')}</div>` : '';
  const tgs = Object.entries(st.tags).sort((a, b) => b[1] - a[1]);
  const tagCard = tgs.length ? `<div class="card"><div class="ct">태그</div>${tgs.slice(0, 8).map(([g, v]) => `<button class="crow"${at('goList', { tag: g, m: R.m || '' })}><span class="ci tg">${ico('tag', 17)}</span><span class="cn">#${esc(g)}</span><span class="v">${fmt(v)}</span><span class="p">${pct(v, st.exp)}%</span></button>`).join('')}</div>` : '';
  const ic = Object.entries(st.incCats).sort((a, b) => b[1] - a[1]);
  const incCard = ic.length ? `<div class="card"><div class="ct">수입<span class="r">${fmt(st.inc)}원</span></div>${ic.map(([k, v]) => `<div class="crow">${ciHTML(k, 'inc')}<span class="cn">${esc(k)}</span><span class="v pos">${fmt(v)}</span><span class="p">${pct(v, st.inc)}%</span></div>`).join('')}</div>` : '';
  // 최근 6개월 지출 추이 (막대)
  const cm = ym(T), ms = []; for (let i = 5; i >= 0; i--) { const m = addM(cm, -i); if (mRange(m)[1] >= S.settings.start || archOf(m)) ms.push(m); }
  const mv = ms.map(m => mstats(m).exp), mx = Math.max(...mv, +S.settings.budget || 0, 1), B = +S.settings.budget || 0;
  const trend = ms.length > 1 ? `<div class="card"><div class="ct">달별 지출</div><div class="bars">${ms.map((m, i) => `<button class="bc${R.m === m ? ' on' : ''}"${at('statMon', { m })}><span class="bv">${man(mv[i])}</span><span class="bb"><i style="height:${mv[i] / mx * 100}%"></i></span><span class="bl">${mShort(m)}</span></button>`).join('')}
    ${B ? `<span class="bline" style="bottom:calc(22px + ${B / mx} * (100% - 44px))"><em>예산</em></span>` : ''}</div></div>` : '';
  return { hdr, body: `<div class="seg4">${seg}</div>${custom}${summary}${chart}${catList}${topCard}${tagCard}${incCard}${trend}` };
}
INP.sr = el => { U.sr = { ...(U.sr || { s: mRange(ym(TODAY()))[0], e: TODAY() }), [el.dataset.k]: el.value }; clearTimeout(INP.srT); INP.srT = setTimeout(render, 250); };
