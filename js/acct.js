'use strict';
// 계좌 하나의 화면: 잔액 카드, 종류별 정보, 이 달 거래
function shade(hex) { const n = parseInt(hex.slice(1), 16), f = .78; return `rgb(${Math.round((n >> 16) * f)},${Math.round((n >> 8 & 255) * f)},${Math.round((n & 255) * f)})`; }
const canAdj = a => a && a.type !== 'invest' && a.type !== 'foreign';
const kvRow = (k, v, cls = '') => `<div class="kvr"><span>${k}</span><b class="${cls}">${v}</b></div>`;
function vDetail(a) {
  const T = TODAY(), m = U.month, E = endOf(m), [s] = mRange(m), cur = m === ym(T), c = colorOf(a);
  const hdr = `<button class="ib"${at('back')} aria-label="뒤로">${ico('back', 22)}</button><div class="t">${esc(a.name)}</div><div class="sp"></div>${ib('acctEdit', 'edit', '계좌 설정', { id: a.id })}`;
  const st = aStats(a.id, s, E), v = valueAt(a, cur ? T : E);
  let title = '잔액', big = fmt(v), subs = [], info = '';
  if (a.type === 'card') {
    const pd = payInfo(a); title = v < 0 ? '결제 예정' : '잔액'; big = fmt(Math.abs(v));
    subs = [pd ? pd.label : '', `${cur ? '이번 달' : mShort(m)} 사용 ${fmt(st.out)}`];
  } else if (a.type === 'prepaid') {
    const [pc, pcb] = poolsAt(a.id, E); title = '잔액 (충전금 + 캐시백)';
    subs = [`충전금 ${fmt(pc)}`, `캐시백 ${fmt(pcb)}`];
    info = `<div class="card"><div class="ct">충전 · 캐시백<span class="r">${cur ? '이번 달' : mShort(m)}</span></div>
      ${kvRow('쓴 돈', fmt(st.out))}${kvRow(`자동 충전 ${st.chgN}회`, fmt(st.chg))}${kvRow(`캐시백 ${+a.cbp || 0}%`, '+' + fmt(st.cb), 'pos')}${kvRow('실제 부담', fmt(st.out - st.cb))}
      <div class="note in">충전금이 ${fmt(+a.th || 0)}원 이하가 되면 ${a.link ? accS(a.link) : '<span class="warnt">충전 계좌 없음</span>'}에서 ${fmt(+a.camt || 0)}원씩 충전돼요. ${cbModeOf(a) === 'first' ? '결제할 때 캐시백부터 써요.' : '캐시백은 따로 모아 둬요.'}</div></div>`;
  } else if (a.type === 'bank') {
    const fl = flow(a.id, s, E); subs = [`${cur ? '이번 달' : mShort(m)} ${sgn(fl)}`, `들어옴 ${fmt(st.inc + sumV(st.mIn))}`, `나감 ${fmt(st.out + sumV(st.mOut))}`];
  } else if (isTerm(a)) {
    const p = matPlan(a);
    subs = [a.mat ? `만기 ${a.mat}` : TYPES[a.type].l, p && p.N ? `납입 ${p.done}/${p.N}회` : ''];
    info = p ? `<div class="card"><div class="ct">만기 예상<span class="r">${p.dday > 0 ? `D-${p.dday}` : '만기 지남'}</span></div>
      ${a.type === 'saving' && +a.mamt ? kvRow('매달 납입', `${fmt(+a.mamt)} · ${a.mday}일`) + kvRow('출금 계좌', A(a.mfrom) ? accS(a.mfrom) : '<span class="warnt">정하지 않음</span>') : ''}
      ${kvRow('만기 원금', fmt(p.principal))}${kvRow(`이자 (연 ${+a.irate || 0}%)`, '+' + fmt(p.interest), 'pos')}${kvRow('만기 예상 금액', fmt(p.total))}
      ${kvRow('만기 후', A(a.mto) ? `${accS(a.mto)}(으)로 이동` : '그대로 둠')}</div>`
      : `<div class="card note in">계좌 설정에서 만기일과 이율을 입력하면 만기 예상 금액이 보여요. 청약처럼 만기가 없으면 '매달 자동 납입'만 정해도 돼요.</div>`;
  } else if (a.type === 'invest') {
    const ser = invSeries(a), x = ser.find(y => y.m === m) || ser[ser.length - 1] || { v: +a.start || 0, prin: +a.start || 0 }, prof = x.v - x.prin;
    title = '평가금액'; big = fmt(x.v);
    subs = [`넣은 돈 ${fmt(x.prin)}`, `수익 ${sgn(prof)} (${x.prin ? (prof / x.prin * 100).toFixed(1) : '0.0'}%)`];
    const rows = ser.slice(-12).reverse();
    info = `<div class="card"><div class="ct">달별 평가금액<span class="r">달마다 말일 기준</span></div>${spark(ser.slice(-6).map(y => y.v), c, ser.slice(-6).map(y => mShort(y.m)))}
      ${rows.map(y => `<button class="vrow"${at('val', { id: a.id, m: y.m })}><span>${y.m.slice(0, 4) === T.slice(0, 4) ? mShort(y.m) : mLabel(y.m)}</span><span class="${y.ent != null ? '' : 'warnt'}">${y.ent != null ? fmt(y.v) : '입력 전'}</span><span class="${y.pl > 0 ? 'pos' : y.pl < 0 ? 'neg' : 'mut'}">${y.pl != null ? sgn(y.pl) : ''}</span></button>`).join('')}</div>`;
    if (a.isa) { const { lim, paid } = isaInfo(); info += `<div class="card"><div class="ct">올해 ISA 납입<span class="r">한도 ${man(lim)}</span></div>${pbar(paid / lim * 100)}<div class="meta"><span>${fmt(paid)}원 넣음</span><span>${fmt(Math.max(0, lim - paid))}원 남음</span></div></div>`; }
  } else if (a.type === 'foreign') {
    title = '원화 환산'; big = fmt(fxVal(a));
    subs = [`${(+a.famt || 0).toLocaleString('ko-KR')} ${esc(a.cur || '')}`, `환율 ${fxRate(a) ? (+fxRate(a).toFixed(4)).toLocaleString('ko-KR') : '없음'}`];
    info = `<div class="card">${kvRow('환율 기준', a.rate ? '직접 입력' : S.fx.at ? `${S.fx.at} 기준` : '아직 없음')}<button class="btn big"${at('fxRefresh')}>${ico('fx', 18)}환율 새로고침</button></div>`;
  }
  const hero = `<div class="card ahero" style="background:linear-gradient(135deg,${c},${shade(c)})"><div class="l">${title}${cur ? '' : ` · ${mShort(m)} 말`}</div><div class="big">${big}<small>원</small></div>
    <div class="s">${subs.filter(Boolean).map(x => `<span>${x}</span>`).join('')}</div>
    ${canAdj(a) ? `<button class="aadj"${at('adjust', { id: a.id })}>잔액 맞추기</button>` : ''}</div>`;
  let list = '';
  if (a.type !== 'foreign') {
    const rows = led().filter(r => r.date >= s && r.date <= E && r.date >= S.settings.start && (r.acct === a.id || r.to === a.id)).sort(byNewest);
    list = `<div class="sec">${monthNav()}<span class="r mut">${rows.length}건</span></div>` + (rows.length ? dayGroups(rows, { acct: a.id }) : '<div class="card empty sm"><b>이 달 거래가 없어요</b></div>');
  }
  return { hdr, body: hero + info + list, qe: a.type !== 'invest' && a.type !== 'foreign', after: () => { QE.acct = a.id; } };
}
