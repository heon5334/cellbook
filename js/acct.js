'use strict';
// 계좌별 탭: 계좌 목록, 계좌 화면(넓은 화면은 오른쪽 표), 밀어서 돌아가기
/* ----- 계좌별 ----- */
function vAccts() {
  if (U.detail && A(U.detail)) return vDetail(A(U.detail));
  const base = { sub: '계좌별', tb: tb(monthPill()) };
  if (!S.accounts.length) return { ...base, body: noAccounts() };
  const m = U.month, E = endOf(m), [s] = mRange(m), pm = addM(m, -1), cur = m === ym(TODAY());
  const chOf = a => a.type === 'invest' ? invAt(a, m) - invAt(a, pm) : a.type === 'foreign' ? null : flow(a.id, s, E);
  const WD0 = isWide(); // 넓은 화면 표에서는 0을 '—'로
  const chTxt = (c, pre = '') => c == null ? '' : `<span class="${c > 0 ? 'pos' : c < 0 ? 'neg' : 'mut'}">${c ? pre + sgn(c) : WD0 ? '—' : pre + '변화 없음'}</span>`;
  const sub = (a, v) => {
    if (a.type === 'card') { const pd = payInfo(a); return v < 0 ? `결제 예정${pd ? ' · ' + pd.label : ''}` : '카드'; }
    if (a.type === 'prepaid') { const [c, cb] = poolsAt(a.id, E); return `충전 ${fmt(c)} · <span class="cbx">캐시백 ${fmt(cb)}</span>`; }
    if (isTerm(a)) return `${TYPES[a.type].l}${a.mat ? ` · 만기 ${a.mat}` : ''}`;
    if (a.type === 'invest') { const x = invSeries(a).filter(y => y.m <= m).pop(); return `${a.isa ? 'ISA · ' : '투자 · '}누적 ${x ? (x.rate >= 0 ? '+' : '') + (x.rate * 100).toFixed(1) : '0.0'}%`; }
    if (a.type === 'foreign') return `${(+a.famt || 0).toLocaleString('ko-KR')} ${esc(a.cur || '')}${fxRate(a) ? ' · 환율 ' + fxRate(a).toFixed(2) : ''}`;
    return '입출금';
  };
  const WD = isWide(); // 넓은 화면: 들어온 돈 · 나간 돈 · 변화 · 비중 · 6개월 추이 열을 더함
  const cols = WD ? [{ w: 25 }, { w: 14, on: 1 }, { w: 12 }, { w: 12 }, { w: 12 }, { w: 8 }, { w: 14 }, { w: 3 }] : [{ w: 54 }, { w: 40, on: 1 }, { w: 6 }];
  const rows = []; let n = 1, tot = 0, totc = 0, cnt = 0;
  const seg = [];
  const MS = {}; if (WD) for (const a of accts()) MS[a.id] = a.type === 'foreign' ? null : monthsOf(a, m, 6);
  const io = (a, k) => MS[a.id]?.[MS[a.id].length - 1]?.[k] ?? null;
  const posAll = WD ? accts().reduce((x, a) => x + Math.max(0, valueAt(a, E)), 0) || 1 : 1;
  const amtC = (v, cl) => v == null ? { v: '', c: 'num' } : { v: v ? fmtU(v) : '<span class="mut">—</span>', c: 'num ' + cl };
  if (WD) rows.push({ n: n++, cls: 'frz', cells: [{ v: '계좌', c: 'h' }, { v: '잔액', c: 'h num' }, { v: '들어온 돈', c: 'h num' }, { v: '나간 돈', c: 'h num' }, { v: cur ? '이번 달 변화' : mShort(m) + ' 변화', c: 'h num' }, { v: '비중', c: 'h num' }, { v: '6개월 추이', c: 'h' }, { v: '', c: 'h' }] });
  for (const ty of TORD) {
    const xs = accts().filter(a => a.type === ty); if (!xs.length) continue;
    const vs = xs.map(a => [a, valueAt(a, E), chOf(a)]);
    const sum = vs.reduce((x, y) => x + y[1], 0), sc = vs.reduce((x, y) => x + (y[2] || 0), 0);
    tot += sum; totc += sc; cnt += xs.length; seg.push([ty, sum]);
    const cl = U.col[ty];
    const gl = { v: `<span class="chev">${cl ? '▸' : '▾'}</span><span class="gb" style="background:${TYPES[ty].c}"></span>${TYPES[ty].l}<span class="gn">${xs.length}개</span>` };
    const gs = k => xs.some(a => io(a, k) != null) ? xs.reduce((x, a) => x + (io(a, k) || 0), 0) : null;
    rows.push({ n: n++, cls: 'grp2', attr: at('col', { v: ty }), cells: WD
      ? [gl, { v: fmtU(sum), c: 'num' + (sum < 0 ? ' neg' : '') }, amtC(gs('inn'), 'pos'), amtC(gs('out'), 'neg'), { v: chTxt(sc), c: 'num' }, { v: `${pct(Math.max(0, sum), posAll)}%`, c: 'num mut' }, '', { v: '', c: 'chevc' }]
      : [gl, { v: fmtU(sum), c: 'num' + (sum < 0 ? ' neg' : '') }, { v: '', c: 'chevc' }] });
    if (cl) continue;
    for (const [a, v, c] of vs) {
      const nm = { v: `<div class="an">${esc(a.name)}${a.fav ? ' <span class="star">★</span>' : ''}</div><div class="as">${sub(a, v)}</div>` };
      rows.push({ n: n++, cls: 'acct2', attr: at('detail', { v: a.id }), cells: WD
        ? [nm, { v: `<div class="av${v < 0 ? ' neg' : ''}">${fmtU(v)}</div>`, c: 'num' }, amtC(io(a, 'inn'), 'pos'), amtC(io(a, 'out'), 'neg'), { v: chTxt(c), c: 'num' }, { v: `${pct(Math.max(0, v), posAll)}%`, c: 'num mut' }, { v: MS[a.id] ? mini(MS[a.id].map(x => x.end), colorOf(a)) : '' }, { v: '›', c: 'chevc' }]
        : [nm, { v: `<div class="av${v < 0 ? ' neg' : ''}">${fmtU(v)}</div><div class="ac">${chTxt(c, cur ? '이번 달 ' : mShort(m) + ' ')}</div>`, c: 'num' }, { v: '›', c: 'chevc' }] });
    }
  }
  if (WD) { const ms6 = []; for (let i = 5; i >= 0; i--) { const x = addM(m, -i); if (mRange(x)[1] >= S.settings.start) ms6.push(x); }
    rows.push({ n: n++, cls: 'tot', cells: ['총자산', { v: fmtU(tot), c: 'num' }, '', '', { v: chTxt(totc), c: 'num' }, { v: '100%', c: 'num mut' }, { v: mini(ms6.map(x => groups(endOf(x)).total)) }, { v: '', c: 'chevc' }] }); }
  else rows.push({ n: n++, cls: 'tot', cells: ['총자산', { v: fmtU(tot), c: 'num' }, { v: '', c: 'chevc' }] });
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
  const b = valueAt(a, E), SIDE = a.type !== 'foreign' && sideFits(3);
  if (a.type === 'card') {
    const pd = payInfo(a);
    top = heroCard(a, b < 0 ? '결제 예정' : '잔액', pd ? pd.label : '', `${fmt(Math.abs(b))}원`, SIDE ? [] : [`${cur ? '이번 달' : mShort(m)} 출금 <b>${fmt(st.out)}</b>`, `입금 <b>${fmt(st.inc + sumV(st.mIn))}</b>`, `${st.n}건`]);
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
    top = heroCard(a, '잔액', TYPES[a.type].l, `${fmt(b)}원`, SIDE ? [] : [`${cur ? '이번 달' : mShort(m)} <b>${sgn(fl)}</b>`, `입금 <b>${fmt(st.inc + sumV(st.mIn))}</b>`, `출금 <b>${fmt(st.out + sumV(st.mOut))}</b>`]);
    head('카테고리', '금액', '지난달 대비');
    const inObj = { ...st.inCat }; for (const [k, v] of Object.entries(st.mIn)) inObj['← ' + accName(k)] = v;
    const pin = { ...pst.inCat }; for (const [k, v] of Object.entries(pst.mIn)) pin['← ' + accName(k)] = v;
    const outObj = { ...st.outCat }; for (const [k, v] of Object.entries(st.mOut)) outObj['→ ' + accName(k)] = v;
    const pout = { ...pst.outCat }; for (const [k, v] of Object.entries(pst.mOut)) pout['→ ' + accName(k)] = v;
    const ti = sumV(inObj), to = sumV(outObj);
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
    top = heroCard(a, '잔액', a.mat ? `만기 ${a.mat}${p && p.dday > 0 ? ` · D-${p.dday}` : ''}` : TYPES[a.type].l, `${fmt(b)}원`, SIDE ? (p && p.N ? [`납입 <b>${p.done}/${p.N}회</b>`] : []) : [`${cur ? '이번 달' : mShort(m)} 납입 <b>${fmt(flow(a.id, s, E))}</b>`, p && p.N ? `납입 <b>${p.done}/${p.N}회</b>` : '']);
    if (p) {
      sec('만기 예상', p.dday > 0 ? '' : '만기 지남');
      const r2 = (l, v, sub = '', c = 'num b') => rows.push({ n: n++, cells: [l, { v, c }, { v: sub, c: 'num mut' }] });
      if (a.open) r2('가입일', a.open, '', 'num');
      r2('만기일', a.mat, p.dday > 0 ? `D-${p.dday}` : '지남', 'num');
      if (a.type === 'saving' && +a.mamt) { r2('매달 납입', fmt(+a.mamt), `매달 ${a.mday}일`); r2('출금 계좌', A(a.mfrom) ? esc(accName(a.mfrom)) : '없음', '', 'num'); }
      r2('만기 원금', fmt(p.principal), p.N ? `${p.N}회` : '');
      r2(`이자 (연 ${+a.irate || 0}%)`, `+${fmt(p.interest)}`, a.itax === false ? '비과세' : `세전 ${fmt(p.gross)}`);
      rows.push({ n: n++, cls: 'tot', cells: ['만기 예상 금액', { v: fmt(p.total), c: 'num' }, { v: A(a.mto) ? `→ ${esc(accName(a.mto))}` : '그대로', c: 'num mut' }] });
    } else rows.push({ n: n++, cells: [{ v: '설정에서 만기일과 이율을 입력하면 만기 예상 금액이 표시돼요.', c: 'mut wrap', cs: 3 }, null, null] });
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
  if (a.type !== 'invest' && a.type !== 'foreign' && !SIDE && st.n) link(`거래 ${st.n}건 보기 · 입력 탭 ›`, 'goInput', { acct: a.id }); // 넓은 화면은 오른쪽 거래 목록
  if (a.type === 'card' && st.maxDay) l2 = [`가장 많이 쓴 날 ${dLabel(st.maxDay[0])} · ${fmt(st.maxDay[1])}`];
  return { ...base, top, body: table(cols, rows, { side: SIDE ? detailSide(a, m, E) : null }), items: l2 };
}
// 넓은 화면 계좌 화면의 오른쪽 표
function detailSide(a, m, E) {
  const cols = [{ w: 20 }, { w: 34 }, { w: 23 }, { w: 23 }], rows = [];
  const hd = (...t) => rows.push({ cls: 'frz', cells: t.map((v, i) => ({ v, c: 'h' + (i ? ' num' : '') })) });
  const sc = (t, s = '') => rows.push({ cls: 'sec', cells: [{ v: `${t}${s ? `<small>${s}</small>` : ''}`, cs: 4 }, null, null, null] });
  const T = TODAY(), cur = m === ym(T);
  if (a.type === 'invest') {
    const ser = invSeries(a).filter(x => x.m <= m).slice(-12);
    hd('월', '넣은 돈 (누적)', '월말 평가', '수익률');
    for (const x of ser) rows.push({ cls: x.m === m ? 'cur' : '', cells: [mShort(x.m), { v: fmtU(x.prin), c: 'num' }, { v: x.ent != null ? fmtU(x.v) : '입력 전', c: 'num' + (x.ent != null ? '' : ' ph') }, { v: `${x.rate >= 0 ? '+' : ''}${(x.rate * 100).toFixed(1)}%`, c: 'num ' + (x.rate >= 0 ? 'pos' : 'neg') }] });
    rows.push({ cells: [{ v: spark(ser.map(x => x.v), colorOf(a), ser.map(x => mShort(x.m))), cs: 4, rsp: 3, c: 'spk' }, null, null, null] }, { cells: [] }, { cells: [] });
    return { cols, rows };
  }
  const dd = a.mat ? depDates(a) : [];
  if (dd.length) {
    hd('회차', '납입일', '금액', '상태');
    let k = 0, next = true;
    for (const { m: mm, d } of dd) {
      k++;
      const done = d <= T, skip = done && ovOf(`dep:${a.id}:${mm}`)?.hidden, nx = !done && next; if (nx) next = false;
      rows.push({ cls: nx ? 'cur' : '', cells: [`${k}회`, { v: d, c: 'num' }, { v: skip ? '0' : fmt(+a.mamt), c: 'num' + (skip ? ' mut' : '') }, { v: skip ? '제외' : done ? '완료' : nx ? '다음' : '예정', c: 'num ' + (skip ? 'neg' : done ? 'mut' : nx ? 'b' : '') }] });
    }
  } else {
    const o = monthsOf(a, m, 6);
    hd('월', '들어온 돈', '나간 돈', '월말 잔액');
    for (const x of o) rows.push({ cls: x.m === m ? 'cur' : '', cells: [mShort(x.m), { v: x.inn ? fmtU(x.inn) : '0', c: 'num' + (x.inn ? ' pos' : ' mut') }, { v: x.out ? fmtU(x.out) : '0', c: 'num' + (x.out ? ' neg' : ' mut') }, { v: fmtU(x.end), c: 'num' + (x.end < 0 ? ' neg' : '') }] });
    rows.push({ cells: [{ v: spark(o.map(x => x.end), colorOf(a), o.map(x => mShort(x.m))), cs: 4, rsp: 3, c: 'spk' }, null, null, null] }, { cells: [] }, { cells: [] });
  }
  // 이 달 거래 (최근 것부터)
  const [s] = mRange(m), st = S.settings.start, list = []; let b = startBal(a);
  for (const r of led()) { if (r.date > E) break; if (r.date < st) continue; const dl = delta(r, a.id); if (!dl) continue; b += dl; if (r.date >= s) list.push([r, dl, b]); }
  sc(`${cur ? '이번 달' : mShort(m)} 거래`, `${list.length}건`);
  if (!list.length) rows.push({ cells: [{ v: '거래가 없어요', c: 'mut', cs: 4 }, null, null, null] });
  else rows.push({ cells: [{ v: '날짜', c: 'sub' }, { v: '내용', c: 'sub' }, { v: '금액', c: 'sub num' }, { v: '잔액', c: 'sub num' }] });
  const what = (r, dl) => r.auto === 'int' ? '이자' : r.auto === 'cb' ? '캐시백' : r.auto === 'chg' ? `충전 ← ${esc(accName(r.acct))}` : r.type === 'move' ? (dl > 0 ? `← ${esc(accName(r.acct))}` : `→ ${esc(accName(r.to))}`) : r.type === 'adj' ? '잔액 맞추기' : `${r.cat ? catLbl(r.cat) : '미분류'}${r.memo ? ` <span class="mut">${esc(r.memo)}</span>` : ''}`;
  for (const [r, dl, bb] of list.reverse().slice(0, 25)) rows.push({ attr: at('goInput', { acct: a.id }), cells: [dLabel(r.date), { v: what(r, dl), c: 'ell' }, { v: (dl > 0 ? '+' : '') + fmtU(dl), c: 'num ' + (dl > 0 ? 'ami' : 'amo') }, { v: fmtU(bb), c: 'num mut' }] });
  if (list.length > 25) rows.push({ attr: at('goInput', { acct: a.id }), cells: [{ v: `<span class="link">${list.length - 25}건 더 · 입력 탭에서 보기 ›</span>`, cs: 4 }, null, null, null] });
  return { cols, rows };
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
