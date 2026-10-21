'use strict';
// 탭 화면: 투자, 기본값 설정, 첫 화면 (계좌별은 acct.js)
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
  let side = null;
  if (isWide()) { // 오른쪽: 계좌별 요약과 추이
    const sr = [], all = [...inv.map(a => [a, invAt(a, ym(TODAY()))]), ...fo.map(a => [a, fxVal(a)])], tv = all.reduce((x, y) => x + Math.max(0, y[1]), 0) || 1;
    sr.push({ cls: 'frz', cells: [{ v: '계좌', c: 'h' }, { v: '평가금액', c: 'h num' }, { v: '누적 수익', c: 'h num' }, { v: '수익률', c: 'h num' }, { v: '비중', c: 'h num' }] });
    let tp = 0, tpr = 0;
    for (const [a, v] of all) {
      const last = a.type === 'invest' ? invSeries(a).slice(-1)[0] : null, pl = last ? v - last.prin : null; if (last) { tp += pl; tpr += last.prin; }
      sr.push({ attr: a.type === 'invest' ? at('detail2', { v: a.id }) : at('acctEdit', { id: a.id }), cells: [`<span class="sw" style="${colorStyle(a)}"></span>${esc(a.name)}`, { v: fmtU(v), c: 'num b' }, { v: pl != null ? sgn(pl) : '', c: 'num ' + (pl > 0 ? 'pos' : pl < 0 ? 'neg' : 'mut') }, { v: last ? `${last.rate >= 0 ? '+' : ''}${(last.rate * 100).toFixed(1)}%` : '환율 기준', c: 'num ' + (last ? (last.rate >= 0 ? 'pos' : 'neg') : 'mut') }, { v: `${pct(Math.max(0, v), tv)}%`, c: 'num mut' }] });
    }
    sr.push({ cls: 'tot', cells: ['합계', { v: fmtU(all.reduce((x, y) => x + y[1], 0)), c: 'num' }, { v: sgn(tp), c: 'num ' + (tp >= 0 ? 'pos' : 'neg') }, { v: tpr ? `${tp >= 0 ? '+' : ''}${(tp / tpr * 100).toFixed(1)}%` : '', c: 'num' }, { v: '100%', c: 'num mut' }] });
    sr.push({ cells: [{ v: `<div class="stk" style="height:12px">${all.map(([a, v]) => `<i style="width:${Math.max(0, v) / tv * 100}%;background:${colorOf(a)}"></i>`).join('')}</div>`, cs: 5 }, null, null, null, null] });
    if (inv.length) {
      sr.push({ cls: 'sec', cells: [{ v: '평가금액 추이<small>최근 6개월</small>', cs: 5 }, null, null, null, null] });
      for (const a of inv) { const ser = invSeries(a).slice(-6); sr.push({ attr: at('detail2', { v: a.id }), cells: [{ v: esc(a.name), c: 'b', rsp: 3 }, { v: spark(ser.map(x => x.v), colorOf(a), ser.map(x => mShort(x.m))), cs: 4, rsp: 3, c: 'spk' }, null, null, null] }, { cells: [] }, { cells: [] }); }
    }
    side = { cols: [{ w: 30 }, { w: 22 }, { w: 18 }, { w: 15 }, { w: 15 }], rows: sr };
  }
  return { ...base, body: table(cols, rows, { side }), items: todo ? [`입력 안 한 달 ${todo}개`] : ['평가금액 모두 입력됨'] };
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
    return { ...base, body: table(cols, rows, { nofill: 1 }), l: `계좌 ${S.accounts.length}개` };
  }
  if (U.setTab === 'cat') {
    const cols = [{ w: 46, on: 1 }, { w: 22 }, { w: 32 }];
    const ms = mstats(ym(TODAY()));
    for (const [k, l] of [['exp', '지출 카테고리'], ['inc', '수입 카테고리']]) {
      rows.push({ n: n++, cls: 'sec', cells: [{ v: l, cs: 3 }, null, null] });
      for (const c of S.cats.filter(x => x.k === k)) rows.push({ n: n++, attr: at('catEdit', { id: c.id }), cells: [`${catLbl(c.n)}`, { v: k === 'exp' ? '지출' : '수입', c: 'mut' }, { v: k === 'exp' ? fmt(ms.cats[c.n] || 0) + (+c.b ? ` / ${fmt(c.b)}` : '') : '', c: 'num mut' }] });
      rows.push({ n: n++, attr: at('catNew', { kind: k }), cells: [{ v: '<span class="link">＋ 추가</span>', cs: 3 }, null, null] });
    }
    return { ...base, body: table(cols, rows, { nofill: 1 }), l: `카테고리 ${S.cats.length}개` };
  }
  if (U.setTab === 'rec') {
    const cols = [{ w: 30, on: 1 }, { w: 14 }, { w: 24 }, { w: 32 }];
    rows.push({ n: n++, cls: 'frz', cells: [{ v: '이름', c: 'h' }, { v: '날짜', c: 'h num' }, { v: '금액', c: 'h num' }, { v: '계좌', c: 'h' }] });
    for (const r of S.rec) rows.push({ n: n++, attr: at('recEdit', { id: r.id }), cells: [`${esc(r.name)}`, { v: `${r.day}일`, c: 'num' }, { v: fmt(r.amt), c: 'num' + (r.type === 'in' ? ' pos' : '') + (!r.start ? ' warn note' : '') }, { v: `${esc(accName(r.acct))}${r.type === 'move' ? ' → ' + esc(accName(r.to)) : ''}`, c: 'mut' }] });
    rows.push({ n: n++, attr: at('recNew'), cells: [{ v: '<span class="link">＋ 정기 결제·이체 추가</span>', cs: 4 }, null, null, null] });
    rows.push({ n: n++, cells: [{ v: '매달 정한 날에 저절로 적혀요.', c: 'mut wrap', cs: 4 }, null, null, null] });
    const bad = S.rec.filter(r => !r.start).length;
    return { ...base, body: table(cols, rows, { nofill: 1 }), l: `${S.rec.length}건`, err: bad ? `시작일 없는 항목 ${bad}개 (자동 기록 안 됨)` : '' };
  }
  // 기타 (시작일·ISA 한도)
  const cols = [{ w: 55, on: 1 }, { w: 45 }];
  const row = (l, v, a, d = {}, cl = '') => rows.push({ n: n++, attr: a ? at(a, d) : '', cells: [l, { v, c: 'num ' + cl }] });
  row('시작일 (잔액 기준일)', S.settings.start, 'setStart', {}, 'link');
  row('ISA 연 납입 한도', fmt(S.settings.isaLimit), 'setIsa', {}, 'link');
  row('캐시백 자동 사용', S.settings.cbAuto ? '켜짐' : '꺼짐', 'setCbAuto', {}, 'link');
  rows.push({ n: n++, cells: [{ v: '시작일은 계좌의 시작 잔액을 적은 날이에요. 캐시백 자동 사용을 켜면 충전식 계좌로 결제할 때 쌓인 캐시백부터 써요. 계좌 설정에서 계좌마다 따로 정할 수도 있어요.', c: 'mut wrap', cs: 2 }, null] });
  return { ...base, body: table(cols, rows, { nofill: 1 }), l: '기타 설정' };
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
