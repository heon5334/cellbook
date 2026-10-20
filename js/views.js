'use strict';
// 탭 화면: 한눈에 보기, 입력, 지난달 결산, 월 마감
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
  const W = isWide() ? gridW() : 0, nb = W >= 1300 ? 3 : W >= 940 ? 2 : 1; // 넓으면 블록을 나란히
  const kpi = (l, v, c = '') => ({ v: `<span class="kl">${l}</span><span class="kv ${c}">${v}</span>`, c: 'k' });
  const sec = (v, attr, right) => ({ cls: 'sec', attr, cells: right ? [{ v, cs: 2 }, null, { v: `<span class="hnote">${right}</span>`, c: 'num' }] : [{ v, cs: 3 }, null, null] });
  const one = (v, c = 'mut') => ({ cells: [{ v, c, cs: 3 }, null, null] });
  const hero = { on: 1, h: 112, cls: 'hero', cells: [{ v: `<span class="kl">총자산 · ${+E.slice(5, 7)}월 ${+E.slice(8)}일 기준</span><span class="kv">${fmtU(g.total)}${U.unit === 'man' ? '' : '<small>원</small>'}</span><br>
    <span class="badge ${ch >= 0 ? 'up' : 'dn'}">${ch >= 0 ? '▲' : '▼'} ${fmtU(Math.abs(ch))} · ${chp >= 0 ? '+' : ''}${chp.toFixed(1)}% <span style="font-weight:400;opacity:.8">지난달보다</span></span>`, c: 'k sel', cs: 3 }, null, null] };
  const kpis = { h: 62, cells: [kpi('들어온 돈', fmtU(st.inc), 'pos'), kpi('지출', fmtU(st.exp)), kpi('순수입', (st.net > 0 ? '+' : '') + fmtU(st.net), st.net >= 0 ? 'pos' : 'neg')] };
  // 자산 구성
  const gk = Object.keys(GROUPS).filter(k => S.accounts.some(a => TYPES[a.type].g === k));
  const pos = gk.reduce((s, k) => s + Math.max(0, g[k]), 0) || 1;
  const comp = [sec('자산 구성', at('tab', { v: 'accts' })), { h: nb > 1 ? 0 : 34, cells: [{ v: `<div class="stk">${gk.map(k => `<i style="width:${Math.max(0, g[k]) / pos * 100}%;background:${GROUPS[k].c}"></i>`).join('')}</div>`, cs: 3 }, null, null] }];
  for (const k of gk) {
    const d = pg[k] ? (g[k] - pg[k]) / Math.abs(pg[k]) * 100 : 0;
    // 이번 달 평가금액을 아직 안 넣은 투자 계좌가 있으면 변화율 대신 '입력 전'
    const pend = k === 'invest' && !archOf(m) && accts().some(a => a.type === 'invest' && getVal(a.id, m) == null);
    comp.push({ attr: at('tab', { v: pend ? 'invest' : 'accts' }), cells: [`<span class="lg" style="background:${GROUPS[k].c}"></span>${GROUPS[k].l}`, { v: fmtU(g[k]), c: 'num b' },
      { v: `${pct(Math.max(0, g[k]), pos)}% &nbsp;${pend ? '<span class="mut">입력 전</span>' : `<span class="arr ${d >= 0 ? 'up' : 'dn'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)}%</span>`}`, c: 'num' }] });
  }
  // 큰 지출
  const when = m === ym(TODAY()) ? '이번 달' : mShort(m);
  const top = [sec(`${when} 큰 지출 TOP 3<small>입력 탭에서 보기 ›</small>`, at('goInput', { acct: '' }))];
  if (!st.top.length) top.push(one(st.arch ? '정리된 달이라 개별 거래는 남아 있지 않아요' : '지출 기록이 없어요'));
  for (const r of st.top.slice(0, 3)) top.push({ attr: at('goRow', { id: r.id }), cells: [`${dLabel(r.date)} ${esc(r.memo || r.cat)}`, { v: esc(accName(r.acct)), c: 'mut' }, { v: fmtU(r.amt), c: 'num' }] });
  // 카테고리 · 예산
  const cat = [sec(`카테고리<small>${when} · 지출 큰 순</small>`, '', '지난달 대비')];
  const cs = Object.entries(st.cats).sort((a, b) => b[1] - a[1]), mx = cs[0]?.[1] || 1;
  for (const [k, v] of cs) cat.push({ attr: k === '미분류' ? at('fixUncat') : at('goInput', { cat: k }), cells: [k === '미분류' ? '미분류 <span class="lab">정리 ›</span>' : catLbl(k), dbar(v / mx * 100, fmtU(v)), { v: arrow(v - (ps.cats[k] || 0), true), c: 'num' }] });
  if (!cs.length) cat.push(one('지출 기록이 없어요'));
  cat.push({ cls: 'tot', cells: ['합계', { v: fmtU(st.exp), c: 'num' }, { v: arrow(st.exp - ps.exp, true), c: 'num' }] });
  const bud = S.cats.filter(c => c.k === 'exp' && +c.b > 0);
  if (bud.length) {
    cat.push(sec('예산', '', '남은 금액'));
    for (const c of bud) {
      const u = st.cats[c.n] || 0, p = u / c.b * 100, over = u > c.b;
      cat.push({ attr: at('catEdit', { id: c.id }), cells: [catLbl(c.n), dbar(p, `${fmtU(u)} <span class="lab">/ ${fmtU(c.b)}</span>`, over ? 'var(--bar-over)' : p > 80 ? 'var(--bar-warn)' : 'var(--bar-good)'),
        { v: over ? `<span class="neg">${fmtU(u - c.b)} 초과</span>` : fmtU(c.b - u), c: 'num' }] });
    }
  }
  // 월별 추이 (넓은 화면은 6개월 모두 표로)
  const ms = []; for (let i = 5; i >= 0; i--) { const mm = addM(m, -i); if (mm >= ym(S.settings.start) || archOf(mm)) ms.push(mm); }
  const sp = spark(ms.map(mm => groups(endOf(mm)).total), '#217346', ms.map(mShort));
  const mon = [{ cells: [{ v: '월', c: 'h' }, { v: '총자산', c: 'h num' }, { v: '순수입', c: 'h num' }] }];
  for (const mm of ms.slice(nb > 1 ? -6 : -3)) {
    const nt = mstats(mm).net;
    mon.push({ cls: mm === m ? 'cur' : '', cells: [{ v: mShort(mm), c: mm === m ? 'b' : '' }, { v: fmtU(groups(endOf(mm)).total), c: 'num' + (mm === m ? ' b' : '') }, { v: (nt > 0 ? '+' : '') + fmtU(nt), c: 'num ' + (nt >= 0 ? 'pos' : 'neg') }] });
  }
  const trendSec = sec('월별 추이<small>최근 6개월 총자산</small>'), sparkRow = { h: 66, cells: [{ v: sp, cs: 3 }, null, null] };
  let body;
  if (nb === 1) {
    const rows = [hero, kpis, ...comp, ...top, ...cat, trendSec, sparkRow, ...mon];
    rows.forEach((r, i) => r.n = i + 1);
    body = table([{ w: 33, on: 1 }, { w: 34 }, { w: 33 }], rows);
  } else {
    const band = [hero, kpis];
    if (nb === 3) band.push({ cells: [{ v: `<span class="kl">총자산 추이 · 최근 6개월</span>${sp}`, c: 'k', cs: 3 }, null, null] });
    body = dashSheet(nb, band, [[...comp, null, ...top], cat, nb === 3 ? [sec('월별'), ...mon] : [trendSec, sparkRow, ...mon]]);
  }
  return { ...base, body: backupNudge() + body };
}
// 넓은 화면 한눈에 보기: 시트 하나에 3열짜리 블록을 나란히 (블록 사이는 좁은 빈 열)
function dashSheet(nb, band, blocks) {
  const stacks = Array.from({ length: nb }, () => []);
  for (const b of blocks) { const s = stacks.reduce((a, x) => x.length < a.length ? x : a); if (s.length) s.push(null); s.push(...b); }
  const bw = (100 - (nb - 1) * 1.6) / nb, cols = [];
  for (let i = 0; i < nb; i++) { if (i) cols.push({ w: 1.6 }); cols.push({ w: bw * .38, on: !i }, { w: bw * .32 }, { w: bw * .30 }); }
  const XC = { sec: 'xsec', tot: 'xtot', cur: 'xcur', hero: 'hero' };
  const cellsOf = r => !r ? ['', '', ''] : r.cells.map(c => {
    if (c === null) return null;
    const o = c && typeof c === 'object' ? { ...c } : { v: c };
    if (XC[r.cls]) o.c = (o.c || '') + ' ' + XC[r.cls];
    if (r.attr) o.at = (o.at || '') + r.attr; // 줄 대신 블록의 셀마다 클릭
    return o;
  });
  const line = rs => rs.flatMap((r, j) => [...(j ? [{ v: '', c: 'gap' }] : []), ...cellsOf(r)]);
  const rows = [{ h: 108, on: 1, cells: line(band) }];
  const len = Math.max(...stacks.map(s => s.length));
  for (let i = 0; i < len; i++) { const rs = stacks.map(s => s[i]); rows.push({ h: Math.max(0, ...rs.map(r => r?.h || 0)), cells: line(rs) }); }
  rows.forEach((r, i) => r.n = i + 1);
  return table(cols, rows, { nofill: 1 });
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
const missing = r => !r.auto && r.type !== 'adj' && (!(+r.amt) || (r.type === 'move' ? !r.to : !r.cat));
function cellHTML(r, k, acc) {
  const sign = acc ? delta(r, acc.id) : 0;
  switch (k) {
    case 'date': return r.auto ? '' : dLabel(r.date);
    case 'acct': return `<span class="chip-a" style="background:${A(r.acct) ? TYPES[A(r.acct).type].c : '#888'}1A;color:${A(r.acct) ? TYPES[A(r.acct).type].c : '#888'}">${esc(r.acct ? accName(r.acct) : '없음')}</span>`;
    case 'type': return r.auto ? '자동' : TXL[r.type];
    case 'amt': if (r.type === 'adj') return (r.amt > 0 ? '+' : '') + fmtU(r.amt);
      return r.amt ? (acc ? (sign > 0 ? '+' : '') + fmtU(r.amt) : (r.type === 'in' ? '+' : '') + fmtU(r.amt)) : '';
    case 'cat':
      if (r.auto === 'chg') return `<b class="chg">충전</b> ← ${esc(r.acct ? accName(r.acct) : '연결 없음')}`;
      if (r.auto === 'cb') return `<b class="cb">캐시백</b> ${esc(r.memo.replace('캐시백 ', ''))}`;
      if (r.type === 'adj') return '<span class="mut">잔액 조정</span>';
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
  const C = isWide()
    ? (acc ? [{ k: 'date', w: 11, l: '날짜' }, { k: 'type', w: 9, l: '구분' }, { k: 'amt', w: 17, l: '금액', n: 1 }, { k: 'cat', w: 23, l: '카테고리' }, ...(showBal ? [{ k: 'bal', w: 16, l: '잔액', n: 1 }] : []), { k: 'memo', w: showBal ? 24 : 40, l: '메모' }]
      : [{ k: 'date', w: 10, l: '날짜' }, { k: 'acct', w: 17, l: '계좌' }, { k: 'type', w: 8, l: '구분' }, { k: 'amt', w: 15, l: '금액', n: 1 }, { k: 'cat', w: 21, l: '카테고리' }, { k: 'memo', w: 29, l: '메모' }])
    : acc
    ? [{ k: 'date', w: 15, l: '날짜' }, { k: 'type', w: 12, l: '구분' }, { k: 'amt', w: 22, l: '금액', n: 1 }, { k: 'cat', w: 29, l: '카테고리' }, showBal ? { k: 'bal', w: 22, l: '잔액', n: 1 } : { k: 'memo', w: 22, l: '메모' }]
    : [{ k: 'date', w: 14, l: '날짜' }, { k: 'acct', w: 23, l: '계좌' }, { k: 'type', w: 12, l: '구분' }, { k: 'amt', w: 21, l: '금액', n: 1 }, { k: 'cat', w: 30, l: '카테고리' }];
  const list = inputRows();
  for (const c of C) c.on = U.sel?.k === c.k;
  const rows = [{ n: 1, cls: 'frz', cells: C.map(c => ({ v: c.l, c: 'h' + (c.n ? ' num' : '') })) }];
  const ROWNO = {};
  let n = 2, miss = 0, firstMiss = null;
  for (const r of list) if (missing(r)) { miss++; firstMiss ??= r.id; }
  // 줄이 아주 많으면(전체 기간 등) 최근 300줄만 그리고 나머지는 접어 둠
  const CAP = 300, cut = !U.more && list.length > CAP ? list.length - CAP : 0;
  const shown = !cut ? list : U.sort === 'desc' ? list.slice(0, CAP) : list.slice(-CAP);
  const moreRow = () => rows.push({ n: '', attr: at('moreRows'), cells: [{ v: `이전 거래 ${cut}건 더 보기`, c: 'mut', st: 'text-align:center', cs: C.length }, ...C.slice(1).map(() => null)] });
  if (cut && U.sort !== 'desc') moreRow();
  for (const r of shown) {
    ROWNO[r.id] = n;
    const ms = missing(r);
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
      return { v: cellHTML(r, c.k, acc), c: cl, at: ` data-k="${c.k}"`, st: c.k === 'date' && r.tag ? `box-shadow:inset 4px 0 0 ${r.tag}` : '' };
    });
    rows.push({ n: n++, on, cls: r.auto ? 'auto' : '', attr: at('cell', { id: r.id }), rnA: at('row', { id: r.id }), cells }); // 클릭 정보는 줄에 한 번만
  }
  if (cut && U.sort === 'desc') moreRow();
  for (let i = 0; i < 4; i++) rows.push({ n: n++, attr: at('newRow'), cells: C.map(() => '') });
  U.rowNo = ROWNO; U.nav = { ids: shown.map(r => r.id), ks: C.map(c => c.k) }; // 방향키 이동용
  // 선택한 계좌의 잔액은 상태 표시줄에 짧게
  let accLbl = '전체';
  if (acc) { const b = balAt(acc.id, TODAY()); accLbl = `${esc(acc.name)} · ${acc.type === 'card' && b < 0 ? `결제 예정 ${fmt(-b)}` : `잔액 ${fmt(b)}`}${canAdj(acc) ? ` <button class="adjl"${at('adjust', { id: acc.id })}>맞추기</button>` : ''}`; }
  const nbox = isWide() ? `<div class="nbox" title="선택한 셀">${U.sel && rowById(U.sel.id) ? refOf(U.sel.id, U.sel.k) : ''}</div>` : '';
  const qbar = `<div class="qbar">${nbox}<span class="f">fx</span><input id="qeDate" class="qd" data-i="qe" inputmode="numeric" autocomplete="off" value="${dLabel(defDate())}" placeholder="${dLabel(defDate())}" aria-label="날짜 (예: 10/14, 비우면 오늘)"><input id="qeIn" data-i="qe" enterkeyhint="done" autocomplete="off" placeholder="예: 커피 4500, 체크카드 점심 9000" aria-label="빠른 입력"></div><div class="qprev" id="qePrev"></div>`;
  // stats
  let o = 0, i2 = 0, cnt = 0; for (const r of list) { if (!acc) { if (r.type === 'out') o += r.amt; if (r.type === 'in') i2 += r.amt; } else { const d = delta(r, acc.id); if (d < 0) o -= d; else i2 += d; } cnt++; }
  const items = U.sel && rowById(U.sel.id) && U.sel.k === 'amt' ? [`선택: ${fmt(rowById(U.sel.id).amt)}`] : [`출금 ${fmtU(o)}`, `입금 ${fmtU(i2)}`, `${cnt}건`];
  // quick bar
  QS = quickList();
  const bottom = QS.length ? `<div class="quickbar">${QS.map((q, i) => `<button class="q"${at('quick', { i })}>${esc(q.memo || q.cat)}<small>${fmt(q.amt)}${acc ? '' : ' · ' + esc(accName(q.acct))}</small></button>`).join('')}</div>` : '';
  const periodLbl = { month: mLabel(U.month), prev: mLabel(addM(U.month, -1)), '3m': '최근 3개월', all: '전체 기간' }[U.flt.p];
  return {
    sub: '입력', tb: tb(acctPill(U.acct, 'filter'), sep,
      `<button class="t${fltActive() ? ' on' : ''}"${at('flt')} aria-label="필터">▽<span class="wl">필터</span></button>`,
      `<button class="t${U.sort === 'desc' ? ' on' : ''}"${at('sort')} aria-label="정렬">⇅<span class="wl">정렬</span></button>`,
      `<button class="t${U.q ? ' on' : ''}"${at('search')} aria-label="검색">${ico('search', 19)}<span class="wl">검색</span></button>`,
      acc && acc.type !== 'prepaid' ? `<button class="t txt${U.showBal ? ' on' : ''}"${at('bal')}>잔액</button>` : '',
      U.flt.p === 'month' ? `<div class="pill mini"><button class="ar"${at('mon', { k: -1 })} aria-label="이전 달">◀</button><span>${mShort(U.month)}</span><button class="ar"${at('mon', { k: 1 })} aria-label="다음 달">▶</button></div>` : `<span class="t txt" style="color:var(--muted)">${periodLbl}</span>`),
    qbar: S.accounts.length ? qbar : '', body: S.accounts.length ? tipBar() + recapCard() + table(C, rows, { nofill: 1 }) : noAccounts(), bottom,
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

/* ---------- 줄을 왼쪽으로 밀어서 지우기 (입력 표) ---------- */
const SW = { tr: null, x: 0, y: 0, dx: 0, on: false, open: null, eat: false };
const SWW = 76; // 뒤에서 나오는 삭제 버튼 폭
function swCells(tr) { return [...tr.cells].slice(1); } // 행 번호 칸은 그대로
function swMove(tr, x, anim) {
  for (const td of swCells(tr)) { td.style.transition = anim ? 'transform .18s ease-out' : 'none'; td.style.transform = x ? `translateX(${x}px)` : ''; }
}
function swClose() {
  const o = SW.open; if (!o) return; SW.open = null;
  swMove(o.tr, 0, true); setTimeout(() => o.btn.remove(), 180);
}
function swOpen(tr) {
  const g = $('#grid'), r = tr.getBoundingClientRect(), gr = g.getBoundingClientRect();
  const btn = document.createElement('button');
  btn.className = 'swdel'; btn.textContent = '삭제'; btn.dataset.a = 'delTx'; btn.dataset.id = tr.dataset.id;
  btn.style.cssText = `top:${r.top - gr.top + g.scrollTop}px;height:${r.height}px;left:${g.scrollLeft + Math.min(gr.width, r.right - gr.left) - SWW}px;width:${SWW}px`;
  g.appendChild(btn); SW.open = { tr, btn };
  swMove(tr, -SWW, true);
}
function swStart(e) {
  if (U.tab !== 'input' || e.button > 0) return;
  const tr = e.target.closest?.('#grid tr[data-a="cell"]');
  if (SW.open && !e.target.closest('.swdel')) { SW.eat = true; swClose(); return; } // 열린 줄이 있으면 먼저 닫기만
  if (!tr || rowById(tr.dataset.id)?.auto) return;
  Object.assign(SW, { tr, x: e.clientX, y: e.clientY, dx: 0, on: false });
}
function swDrag(e) {
  if (!SW.tr) return;
  const dx = e.clientX - SW.x, dy = e.clientY - SW.y;
  if (!SW.on) { if (Math.abs(dy) > 10) { SW.tr = null; return; } if (dx > -10) return; SW.on = true; }
  SW.dx = Math.max(-SWW - 20, Math.min(0, dx)); swMove(SW.tr, SW.dx, false);
}
function swEnd() {
  const tr = SW.tr; SW.tr = null; if (!tr || !SW.on) return;
  SW.eat = true; // 민 뒤에 따라오는 탭(셀 고치기)은 무시
  if (SW.dx < -SWW / 2) swOpen(tr); else swMove(tr, 0, true);
}
