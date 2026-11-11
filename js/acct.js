'use strict';
// 계좌 하나의 화면: 잔액 카드, 종류별 정보, 외화, 이 달 거래
function shade(hex) { const n = parseInt(hex.slice(1), 16), f = .78; return `rgb(${Math.round((n >> 16) * f)},${Math.round((n >> 8 & 255) * f)},${Math.round((n & 255) * f)})`; }
const canAdj = a => a && a.type !== 'invest' && a.type !== 'foreign';
const kvRow = (k, v, cls = '') => `<div class="kvr"><span>${k}</span><b class="${cls}">${v}</b></div>`;
const pctS = (a, b) => b ? `${a >= 0 ? '+' : ''}${(a / b * 100).toFixed(1)}%` : '';
// 외화 카드: 통화마다 보유량 · 평균 매입 환율 · 지금 환율 · 환차손익
function fxCard(a, date) {
  const bk = fbookAt(a.id, date), rows = Object.entries(bk).filter(([, b]) => b.u > 1e-9 || Math.abs(b.rz) > .5);
  if (!rows.length) return '';
  const T = TODAY();
  return `<div class="card"><div class="ct">외화<span class="r">${S.fx.at ? `환율 ${dLabel(S.fx.at)} 기준` : '환율 직접 입력'}<button class="btn sm"${at('fxRefresh')}>새로고침</button></span></div>
    ${rows.map(([cur, b]) => {
      const now = a.type === 'foreign' && cur === a.cur ? fxRate(a) : curRate(cur), avg = b.u > 1e-9 ? b.c / b.u : 0, val = Math.round(b.u * now), gain = Math.round(val - b.c);
      return `<div class="fxr"><div class="fxh"><b>${fmtF(b.u, cur)}</b><span>${fmt(val)}원</span></div>
        <div class="fxk"><span>평균 매입 <b>${avg ? fmtR(avg) : '—'}</b></span><span>지금 <b>${now ? fmtR(now) : '—'}</b></span>
        ${b.u > 1e-9 && avg ? `<span>환차손익 <b class="${gain >= 0 ? 'pos' : 'neg'}">${sgn(gain)} (${pctS(gain, b.c)})</b></span>` : ''}
        ${Math.abs(b.rz) > .5 ? `<span>쓴 외화의 환차 <b class="${b.rz >= 0 ? 'pos' : 'neg'}">${sgn(b.rz)}</b></span>` : ''}</div></div>`;
    }).join('')}
    ${date < T ? '' : `<div class="row2 mt fxb"><button class="btn big pri"${at('fxPage', { id: a.id })}>${ico('list', 17)}외화 지갑</button><button class="btn big"${at('fxNew', { id: a.id })}>${ico('fx', 17)}환전 기록</button></div>`}</div>`;
}
function vDetail(a) {
  const T = TODAY(), m = U.month, E = endOf(m), [s] = mRange(m), cur = m === ym(T), c = colorOf(a);
  const hdr = `<button class="ib"${at('back')} aria-label="뒤로">${ico('back', 22)}</button><div class="t">${esc(a.name)}</div><div class="sp"></div>${ib('acctEdit', 'edit', '계좌 설정', { id: a.id })}`;
  const st = aStats(a.id, s, E), v = valueAt(a, cur ? T : E), fx = hasFx(a);
  let title = '잔액', big = fmt(v), subs = [], info = '';
  if (a.type === 'card') {
    const pd = payInfo(a); title = v < 0 ? '결제 예정' : '잔액'; big = fmt(Math.abs(v));
    subs = [pd ? pd.label : '', `${cur ? '이번 달' : mShort(m)} 사용 ${fmt(st.out)}`];
  } else if (a.type === 'prepaid') {
    const [pc, pcb] = poolsAt(a.id, E), hv = fx ? holdVal(a, cur ? T : E) : 0; title = fx ? '잔액 (충전금 + 캐시백 + 외화)' : '잔액 (충전금 + 캐시백)';
    subs = [`충전금 ${fmt(pc)}`, `캐시백 ${fmt(pcb)}`, hv ? `외화 ${fmt(hv)}` : ''];
    const exact = chgMode(a) === 'exact';
    info = `<div class="card"><div class="ct">충전 · 캐시백<span class="r">${cur ? '이번 달' : mShort(m)}</span></div>
      ${kvRow('쓴 돈', fmt(st.out))}${kvRow(`자동 충전 ${st.chgN}회`, fmt(st.chg))}${st.fxBuy ? kvRow('환전에 쓴 원화', fmt(st.fxBuy)) : ''}${+a.cbp ? kvRow(`캐시백 ${+a.cbp}%`, '+' + fmt(st.cb), 'pos') + kvRow('실제 부담', fmt(st.out - st.cb)) : ''}
      <div class="note in">${exact ? `결제할 돈이 모자라면 ${a.link ? accS(a.link) : '<span class="warnt">충전 계좌 없음</span>'}에서 모자란 만큼 가져와요.` : `충전금이 ${fmt(+a.th || 0)}원 이하가 되면 ${a.link ? accS(a.link) : '<span class="warnt">충전 계좌 없음</span>'}에서 ${fmt(+a.camt || 0)}원씩 충전돼요.`} ${fxAutoOf(a) ? '외화가 모자라면 원화에서 모자란 만큼 환전해요.' : ''} ${+a.cbp ? (cbModeOf(a) === 'first' ? '결제할 때 캐시백부터 써요.' : '캐시백은 따로 모아 둬요.') : ''}</div></div>` + fxCard(a, cur ? T : E);
  } else if (a.type === 'bank') {
    const fl = flow(a.id, s, E); subs = [`${cur ? '이번 달' : mShort(m)} ${sgn(fl)}`, `들어옴 ${fmt(st.inc + sumV(st.mIn))}`, `나감 ${fmt(st.out + sumV(st.mOut))}`];
    if (fx) { title = '잔액 (원화 + 외화)'; info = fxCard(a, cur ? T : E); }
  } else if (isTerm(a)) {
    const p = matPlan(a);
    subs = [a.mat ? `만기 ${a.mat}` : TYPES[a.type].l, p && p.N ? `납입 ${p.done}/${p.N}회` : ''];
    info = p ? `<div class="card"><div class="ct">만기 예상<span class="r">${p.dday > 0 ? `D-${p.dday}` : '만기 지남'}</span></div>
      ${a.type === 'saving' && +a.mamt ? kvRow('매달 납입', `${fmt(+a.mamt)} · ${a.mday}일`) + kvRow('출금 계좌', A(a.mfrom) ? accS(a.mfrom) : '<span class="warnt">정하지 않음</span>') : ''}
      ${kvRow('만기 원금', fmt(p.principal))}${kvRow(`이자 (연 ${+a.irate || 0}%)`, '+' + fmt(p.interest), 'pos')}${kvRow('만기 예상 금액', fmt(p.total))}
      ${kvRow('만기 후', A(a.mto) ? `${accS(a.mto)}(으)로 이동` : '그대로 둠')}</div>`
      : `<div class="card note in">계좌 설정에서 만기일과 이율을 입력하면 만기 예상 금액이 보여요. 청약처럼 만기가 없으면 '매달 자동 납입'만 정해도 돼요.</div>`;
  } else if (a.type === 'invest') {
    const ser = invSeries(a), x = ser.find(y => y.m === m) || ser[ser.length - 1] || { v: +a.start || 0, prin: +a.start || 0, inn0: 0, out0: 0 }, prof = x.v - x.prin, ist = invStart();
    title = '예탁자산'; big = fmt(x.v);
    subs = [x.cash != null ? `예수금 ${fmt(x.cash)}` : '', x.sec != null ? `평가금 ${fmt(x.sec)}` : '', `수익 ${sgn(prof)}${x.prin > 0 ? ` (${pctS(prof, x.prin)})` : ''}`];
    const rows = ser.slice(-12).reverse();
    info = `<div class="card"><div class="ct">수익 계산<span class="r">${dLabel(ist)}부터</span></div>
      ${kvRow(`시작 자산 <small class="mut">${ist} 기준</small>`, fmt(+a.start || 0))}${kvRow('넣은 돈', '+' + fmt(x.inn0))}${kvRow('뺀 돈', '-' + fmt(x.out0))}${kvRow('원금 (시작 + 넣은 돈 − 뺀 돈)', fmt(x.prin))}
      ${kvRow('예탁자산', fmt(x.v))}${kvRow('수익 (예탁자산 − 원금)', sgn(prof), prof > 0 ? 'pos' : prof < 0 ? 'neg' : '')}${kvRow('수익률 (수익 ÷ 원금)', x.prin > 0 ? pctS(prof, x.prin) : '—')}
      <div class="note in">넣고 뺀 돈은 수익이 아니라 원금의 증감으로 봐요. 달마다 증권사 앱의 예수금과 평가금을 넣으면 그 합이 예탁자산이에요.</div></div>
      <div class="card"><div class="ct">달별 예탁자산<span class="r">말일 기준</span></div>${spark(ser.slice(-6).map(y => y.v), c, ser.slice(-6).map(y => mShort(y.m)))}
      <div class="vrow hd"><span>월</span><span>예탁자산</span><span>그달 수익</span></div>
      ${rows.map(y => `<button class="vrow"${at('val', { id: a.id, m: y.m })}><span>${y.m.slice(0, 4) === T.slice(0, 4) ? mShort(y.m) : mLabel(y.m)}${y.c ? `<small>${sgn(y.c)}</small>` : ''}</span><span class="${y.ent != null ? '' : 'warnt'}">${y.ent != null ? fmt(y.v) : '입력 전'}${y.cash != null ? `<small>예수금 ${fmt(y.cash)}</small>` : ''}</span><span class="${y.pl > 0 ? 'pos' : y.pl < 0 ? 'neg' : 'mut'}">${y.pl != null ? sgn(y.pl) : ''}</span></button>`).join('')}</div>`;
    if (a.isa) { const { lim, paid } = isaInfo(); info += `<div class="card"><div class="ct">올해 ISA 납입<span class="r">한도 ${man(lim)}</span></div>${pbar(paid / lim * 100)}<div class="meta"><span>${fmt(paid)}원 넣음</span><span>${fmt(Math.max(0, lim - paid))}원 남음</span></div></div>`; }
  } else if (a.type === 'foreign') {
    const bk = fbookAt(a.id, cur ? T : E), b = bk[a.cur] || { u: 0, c: 0 };
    title = '원화 환산'; big = fmt(v);
    subs = [fmtF(b.u, a.cur), `환율 ${fxRate(a) ? fmtR(fxRate(a)) : '없음'}${a.rate ? ' (직접 입력)' : ''}`];
    info = fxCard(a, cur ? T : E) + (a.id && fx ? `<div class="card"><button class="btn big"${at('fMerge', { id: a.id })}>${ico('move', 18)}다른 계좌 안으로 옮기기</button><div class="note in">충전식·입출금 계좌의 외화 잔액으로 합칠 수 있어요. 옮길 때 매입 환율을 넣으면 환차손익의 기준이 돼요.</div></div>` : '');
  }
  const hero = `<div class="card ahero" style="background:linear-gradient(135deg,${c},${shade(c)})"><div class="l">${title}${cur ? '' : ` · ${mShort(m)} 말`}</div><div class="big">${big}<small>원</small></div>
    <div class="s">${subs.filter(Boolean).map(x => `<span>${x}</span>`).join('')}</div>
    ${canAdj(a) ? `<button class="aadj"${at('adjust', { id: a.id })}>잔액 맞추기</button>` : ''}</div>`;
  const rows = led().filter(r => r.date >= s && r.date <= E && r.date >= S.settings.start && (r.acct === a.id || r.to === a.id)).sort(byNewest);
  const list = (a.type !== 'foreign' || rows.length) ? `<div class="sec">${monthNav()}<span class="r mut">${rows.length}건</span></div>` + (rows.length ? dayGroups(rows, { acct: a.id }) : '<div class="card empty sm"><b>이 달 거래가 없어요</b></div>') : '';
  return { hdr, body: hero + info + list, qe: a.type !== 'invest' && a.type !== 'foreign', after: () => { QE.acct = a.id; } };
}

// 외화 지갑 화면: 통화별 잔액 맞추기 · 환전과 외화가 오간 기록 전체
function vFxPage(a) {
  const T = TODAY(), st = S.settings.start;
  const hdr = `<button class="ib"${at('back')} aria-label="뒤로">${ico('back', 22)}</button><div class="t">${esc(a.name)} 외화</div><div class="sp"></div>${ib('fxNew', 'fx', '환전 기록', { id: a.id })}`;
  const rows = led().filter(r => r.cur && r.date >= st && r.date <= T && (r.acct === a.id || r.to === a.id)).sort(byNewest);
  const bk = fbookAt(a.id, T), curs = [...new Set([...Object.keys(bk), ...rows.map(r => r.cur)])];
  let body = '';
  for (const cur of curs) {
    const b = bk[cur] || { u: 0, c: 0, rz: 0 }, now = a.type === 'foreign' && cur === a.cur ? fxRate(a) : curRate(cur), avg = b.u > 1e-9 ? b.c / b.u : 0, val = Math.round(b.u * now), gain = Math.round(val - b.c);
    let bought = 0, boughtK = 0, sold = 0, spent = 0, spentK = 0, inn = 0, outn = 0, n = 0;
    for (const r of rows) {
      if (r.cur !== cur) continue; n++;
      if (r.type === 'fx' && r.acct === a.id) { if (r.side === 'sell') sold += r.famt; else { bought += r.famt; boughtK += r.amt; } }
      else if (r.type === 'out' && r.acct === a.id) { spent += r.famt; spentK += r.amt; }
      else if (r.type === 'in' && r.acct === a.id) inn += r.famt;
      else if (r.type === 'move') { if (r.to === a.id) inn += r.famt; if (r.acct === a.id) outn += r.famt; }
    }
    body += `<div class="card"><div class="ct">${esc(cur)}<span class="r">${n}건</span></div>
      <div class="fxh"><b class="big2">${fmtF(b.u, cur)}</b><span>${fmt(val)}원</span></div>
      <div class="fxk"><span>평균 매입 <b>${avg ? fmtR(avg) : '—'}</b></span><span>지금 <b>${now ? fmtR(now) : '—'}</b></span>${b.u > 1e-9 && avg ? `<span>환차손익 <b class="${gain >= 0 ? 'pos' : 'neg'}">${sgn(gain)} (${pctS(gain, b.c)})</b></span>` : ''}${Math.abs(b.rz) > .5 ? `<span>쓴 외화의 환차 <b class="${b.rz >= 0 ? 'pos' : 'neg'}">${sgn(b.rz)}</b></span>` : ''}</div>
      <div class="kvs">${kvRow('환전해서 산 외화', `${fmtF(bought, cur)}${boughtK ? ` <small class="mut">${fmt(boughtK)}원</small>` : ''}`)}${sold ? kvRow('팔아서 원화로', fmtF(sold, cur)) : ''}${kvRow('쓴 외화', `${fmtF(spent, cur)}${spentK ? ` <small class="mut">≈ ${fmt(spentK)}원</small>` : ''}`)}${inn ? kvRow('다른 곳에서 들어옴', fmtF(inn, cur)) : ''}${outn ? kvRow('다른 곳으로 나감', fmtF(outn, cur)) : ''}</div>
      <div class="row2 mt fxb"><button class="btn big pri"${at('fxAdj', { id: a.id, cur })}>${ico('adj', 17)}잔액 맞추기</button><button class="btn big"${at('fxNew', { id: a.id })}>${ico('fx', 17)}환전 기록</button></div></div>`;
  }
  if (!curs.length) body += `<div class="card empty sm"><b>아직 외화가 없어요</b><p>환전 기록을 넣거나 계좌 설정에서 통화를 추가하세요.</p><button class="btn pri big"${at('fxNew', { id: a.id })}>환전 기록</button></div>`;
  if (a.type === 'prepaid') { const [pc, pcb] = poolsAt(a.id, T); body += `<div class="card"><div class="ct">원화<span class="r">충전금 ${fmt(pc)}${+a.cbp || pcb ? ` · 캐시백 ${fmt(pcb)}` : ''}</span></div><button class="btn big"${at('adjust', { id: a.id })}>${ico('adj', 18)}충전금${+a.cbp || pcb ? '·캐시백' : ''} 맞추기</button></div>`; }
  else if (canAdj(a)) body += `<div class="card"><div class="ct">원화<span class="r">${fmt(balAt(a.id, T))}</span></div><button class="btn big"${at('adjust', { id: a.id })}>${ico('adj', 18)}원화 잔액 맞추기</button></div>`;
  const lim = U.more ? 3000 : 200;
  body += `<div class="sec">환전 · 외화가 오간 기록<span class="r mut">${rows.length}건 · 전체 기간</span></div>`
    + (rows.length ? dayGroups(rows.slice(0, lim), { acct: a.id }) + (rows.length > lim ? `<button class="more card"${at('moreRows')}>${rows.length - lim}건 더 보기</button>` : '') : '<div class="card empty sm"><b>기록이 없어요</b></div>');
  return { hdr, body, qe: false };
}
ACT.fxPage = d => { U.fxv = d.id; U.more = false; render(); goTop(); };
ACT.fxAdj = d => {
  const a = A(d.id); if (!a) return; const cur = d.cur, b = fbookAt(a.id, TODAY())[cur], have = b ? b.u : 0, rate = a.type === 'foreign' && cur === a.cur ? fxRate(a) : curRate(cur);
  numSheet({ title: `실제 ${cur} 잔액`, sub: esc(a.name), init: String(Math.round(have * 100) / 100), hint: `앱에서는 ${fmtF(have, cur)}이에요. 실제 금액을 넣으면 차액만큼 '${cur} 잔액 조정' 기록이 생겨요. 지출·수입 통계에는 안 들어가요.`, okLabel: '맞추기', ok: v => {
    if (v == null) return; const diff = Math.round((v - have) * 100) / 100; if (Math.abs(diff) < 0.005) return toast('이미 맞아요');
    const t = touch({ id: uid(), date: TODAY(), acct: a.id, type: 'adj', cur, famt: diff, rate: rate || 0, amt: Math.round(diff * (rate || 0)), cat: '', to: '', memo: `${cur} 잔액 조정` });
    commit(() => S.tx.push(t)); toast(`${cur} ${diff > 0 ? '+' : ''}${fmtF(diff, cur).replace(/^[^\d-]+/, '')} 조정`, true);
  } });
};
