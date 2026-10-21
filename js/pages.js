'use strict';
// 탭 화면: 계좌별, 투자, 기본값 설정, 첫 화면
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
    if (a.type === 'prepaid') { const [c, cb] = poolsAt(a.id, E); return `충전 ${fmt(c)} · <span class="cbx">캐시백 ${fmt(cb)}</span>`; }
    if (isTerm(a)) return `${TYPES[a.type].l}${a.mat ? ` · 만기 ${a.mat}` : ''}`;
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
  const c = colorOf(a);
  return `<div class="acard" style="background:linear-gradient(135deg,${c},${shade(c)});box-shadow:0 4px 12px ${c}40"><div class="t"><span>${esc(a.name)} · ${title}</span><span>${right}</span></div>
    <div class="v">${value}</div><div class="s">${subs.map(x => `<span>${x}</span>`).join('')}${canAdj(a) ? `<button class="aadj"${at('adjust', { id: a.id })}>잔액 맞추기</button>` : ''}</div></div>`;
}
function shade(hex) { const n = parseInt(hex.slice(1), 16), f = .78; return `rgb(${Math.round((n >> 16) * f)},${Math.round((n >> 8 & 255) * f)},${Math.round((n & 255) * f)})`; }
function vDetail(a) {
  const m = U.month, E = endOf(m), [s] = mRange(m), pm = addM(m, -1);
  const cur = m === ym(TODAY()), day = cur ? +TODAY().slice(8) : lastDay(m);
  const [ps] = mRange(pm), pe = `${pm}-${pad2(Math.min(day, lastDay(pm)))}`;
  const st = aStats(a.id, s, E), pst = aStats(a.id, ps, pe);
  const base = { sub: '계좌별', tb: tb(acctPill(a.id, 'detail'), sep, monthPill()), l: '' };
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
    const [pc, pcb] = poolsAt(a.id, E);
    top = heroCard(a, '잔액 (충전금 + 캐시백)', `충전식 · ← ${esc(a.link ? accName(a.link) : '연결 없음')}`, `${fmt(b)}원`, [`충전금 <b>${fmt(pc)}</b>`, `캐시백 <b>${fmt(pcb)}</b>`, `${cbModeOf(a) === 'first' ? '결제 때 캐시백 먼저' : '캐시백은 따로'}`]);
    head('카테고리', '금액 · 비중', '지난달 대비'); catRows(st.outCat, pst.outCat);
    rows.push({ n: n++, cls: 'tot', cells: ['사용 합계', { v: fmtU(st.out), c: 'num' }, { v: arrow(st.out - pst.out, true), c: 'num' }] });
    sec('충전 · 캐시백', cur ? '이번 달' : mShort(m));
    rows.push({ n: n++, cells: ['자동 충전', { v: fmtU(st.chg), c: 'num chg' }, { v: `${st.chgN}회`, c: 'num mut' }] });
    rows.push({ n: n++, cells: [{ v: `&nbsp;&nbsp;← ${esc(a.link ? accName(a.link) : '연결 계좌 없음')}`, c: 'mut' }, '', ''] });
    rows.push({ n: n++, cells: [`캐시백 ${+a.cbp || 0}%`, { v: '+' + fmtU(st.cb), c: 'num cb' }, { v: '수입으로 기록', c: 'num mut' }] });
    rows.push({ n: n++, cls: 'tot', cells: ['실제 부담', { v: fmtU(st.out - st.cb), c: 'num' }, { v: '사용 − 캐시백', c: 'num mut' }] });
    l2 = [`다음 충전까지 ${fmt(Math.max(0, poolsAt(a.id, TODAY())[0] - (+a.th || 0)))} 남음`];
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
  } else if (isTerm(a)) {
    const p = matPlan(a);
    top = heroCard(a, '잔액', a.mat ? `만기 ${a.mat}${p && p.dday > 0 ? ` · D-${p.dday}` : ''}` : TYPES[a.type].l, `${fmt(b)}원`, [`${cur ? '이번 달' : mShort(m)} 납입 <b>${fmt(flow(a.id, s, E))}</b>`, p && p.N ? `납입 <b>${p.done}/${p.N}회</b>` : '']);
    if (p) {
      sec('만기 예상', p.dday > 0 ? `D-${p.dday}` : '만기 지남');
      const r2 = (l, v, sub = '', c = 'num b') => rows.push({ n: n++, cells: [l, { v, c }, { v: sub, c: 'num mut' }] });
      if (a.open) r2('가입일', a.open, '', 'num');
      r2('만기일', a.mat, p.dday > 0 ? `D-${p.dday}` : '지남', 'num');
      if (a.type === 'saving' && +a.mamt) r2('매달 납입', fmt(+a.mamt), `${a.mday}일 ← ${A(a.mfrom) ? esc(shortName(accName(a.mfrom))) : '없음'}`);
      r2('만기 원금', fmt(p.principal), p.N ? `${p.N}회` : '');
      r2(`이자 (연 ${+a.irate || 0}%)`, `+${fmt(p.interest)}`, a.itax === false ? '세금 안 뗌' : `세전 ${fmt(p.gross)}`);
      rows.push({ n: n++, cls: 'tot', cells: ['만기 예상 금액', { v: fmt(p.total), c: 'num' }, { v: A(a.mto) ? `→ ${esc(accName(a.mto))}` : '그대로', c: 'num mut' }] });
    } else rows.push({ n: n++, cells: [{ v: '설정에서 만기일과 이율을 넣으면 만기 예상 금액이 보여요.', c: 'mut wrap', cs: 3 }, null, null] });
    head('월', '납입', '월말 잔액');
    const sm = ym(S.settings.start); for (let mm = sm, g = 0; mm <= ym(TODAY()) && g < 120; mm = addM(mm, 1), g++) { const [x, y] = mRange(mm); rows.push({ n: n++, cls: mm === m ? 'cur' : '', cells: [mShort(mm), { v: fmt(flow(a.id, x, y)), c: 'num' }, { v: fmt(balAt(a.id, endOf(mm))), c: 'num' }] }); }
    link('설정에서 수정 ›', 'acctEdit', { id: a.id });
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
      rows.push({ n: n++, attr: at('acctEdit', { id: a.id }), cells: [`<span class="sw" style="${colorStyle(a)}"></span>${esc(a.name)}${a.fav ? ' <span class="star">★</span>' : ''}${a.hidden ? '<span class="lab">숨김</span>' : ''}`, `<span class="chip-a" style="background:${TYPES[a.type].c}1A;color:${TYPES[a.type].c}">${TYPES[a.type].l}</span>`,
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
  row('캐시백 자동 사용', S.settings.cbAuto ? '켜짐' : '꺼짐', 'setCbAuto', {}, 'link');
  rows.push({ n: n++, cells: [{ v: '시작일은 계좌 시작 잔액의 기준일이에요. 캐시백 자동 사용을 켜면 충전식 계좌에서 결제할 때마다 쌓인 캐시백을 먼저 써요 (계좌 설정이 "기본값대로"인 계좌).', c: 'mut wrap', cs: 2 }, null] });
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
      <button class="bigbtn ghost"${at('importJson')}>백업 파일 불러오기</button>
      <button class="link wlink"${at('help')}>사용법 보기</button>
    </div>
    <div class="note2">${Sync.status !== 'off' ? '데이터는 이 기기에 먼저 저장돼요.<br>로그인하면 기기에서 암호화한 뒤 동기화해요.' : '데이터는 이 기기에만 저장됩니다.'}</div></div>`;
}
function vLocked() {
  return `<div class="welcome"><div class="logo">${LOGO}</div><h1>잠금 해제</h1><p>이 계정의 가계부는 암호로 보호돼 있어요.<br>가계부 암호를 입력하세요.</p>
    <div style="width:100%;margin-top:26px"><button class="bigbtn"${at('syncMenu')}>암호 입력</button></div></div>`;
}

/* ---------- 계좌 화면: 오른쪽으로 밀어서 돌아가기 (아이폰처럼) ---------- */
const BACK = { on: false, go: false, x: 0, y: 0, dx: 0, els: [] };
function bkStart(e) {
  if (U.tab !== 'accts' || !U.detail || e.button > 0 || $('#sheet-root').classList.contains('on') || e.target.closest?.('.app, .tabs, .stabs')) return;
  Object.assign(BACK, { on: true, go: false, x: e.clientX, y: e.clientY, dx: 0, els: [] });
}
function bkDrag(e) {
  if (!BACK.on) return;
  const dx = e.clientX - BACK.x, dy = e.clientY - BACK.y;
  if (!BACK.go) { if (Math.abs(dy) > 12) { BACK.on = false; return; } if (dx < 12) return; BACK.go = true; BACK.els = [...document.querySelectorAll(isWide() ? '.main > :not(.stabs)' : '#app > :not(.app):not(.tabs)')]; }
  BACK.dx = Math.max(0, dx);
  for (const el of BACK.els) { el.style.transition = 'none'; el.style.transform = `translateX(${BACK.dx}px)`; el.style.boxShadow = '-6px 0 16px rgba(0,0,0,.08)'; }
}
function bkEnd() {
  if (!BACK.on) return; BACK.on = false; if (!BACK.go) return;
  SW.eat = Date.now(); // 민 뒤에 따라오는 클릭은 무시
  const go = BACK.dx > Math.min(110, innerWidth * .28), els = BACK.els;
  for (const el of els) { el.style.transition = 'transform .18s ease-out'; el.style.transform = go ? `translateX(${innerWidth}px)` : ''; }
  if (go) setTimeout(() => ACT.back(), 170); else setTimeout(() => els.forEach(el => { el.style.boxShadow = ''; el.style.transition = ''; }), 200);
}
