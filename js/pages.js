'use strict';
// 탭 화면: 자산, 설정, 첫 화면 (계좌 하나의 화면은 acct.js)

/* ---------- 자산 ---------- */
function isaInfo() {
  const y = TODAY().slice(0, 4), lim = +S.settings.isaLimit || 20000000; let paid = 0;
  for (const a of S.accounts.filter(x => x.isa)) for (const r of led()) { if (r.date.slice(0, 4) !== y) continue; /* 가계부 시작일 전 납입도 한도에는 들어감 */ if ((r.type === 'move' && r.to === a.id) || (r.type === 'in' && r.acct === a.id)) paid += r.amt; }
  for (const [m, x] of Object.entries(S.arch || {})) if (x && !x.del && m.startsWith(y)) paid += x.isa || 0;
  return { lim, paid };
}
const invMissing = (a, m) => getVal(a.id, m) == null;
function acctLine(a) {
  const T = TODAY(), v = valueAt(a, T), cm = ym(T), pm = addM(cm, -1);
  let sub = TYPES[a.type].l, val = fmt(v), small = '', btn = '';
  if (a.type === 'bank') sub = +a.irate ? `입출금 · 이자 연 ${+a.irate}%` : '입출금';
  if (a.type === 'card') { const pd = payInfo(a); sub = pd ? pd.label : '카드'; val = fmt(Math.max(0, -v)); small = v > 0 ? `<small class="pos">잔액 ${fmt(v)}</small>` : '<small class="mut">결제 예정</small>'; if (v > 0) val = '0'; }
  const fxs = hasFx(a) ? Object.entries(fbookAt(a.id, T)).filter(([, b]) => b.u > 1e-9).map(([c, b]) => fmtF(b.u, c)) : [];
  if (a.type === 'prepaid') { const [c, cb] = poolsAt(a.id, T); sub = [`충전금 ${fmt(c)}`, +a.cbp || cb ? `캐시백 ${fmt(cb)}` : '', ...fxs].filter(Boolean).join(' · '); }
  if (a.type === 'bank' && fxs.length) sub += ' · ' + fxs.join(' · ');
  if (isTerm(a)) { const p = a.mat ? matPlan(a) : null; sub = [A(a.mfrom) && +a.mamt ? `매달 ${a.mday}일 ${man(+a.mamt)} 자동 납입` : TYPES[a.type].l, p ? (p.dday > 0 ? `만기 D-${p.dday}` : '만기 지남') : ''].filter(Boolean).join(' · '); }
  if (a.type === 'invest') {
    const ser = invSeries(a), last = ser[ser.length - 1], cur = invCur(a);
    if (cur) val = invShow(a, invAt(a, cm)); // 달러 계좌도 수익률은 같은 자리에
    const rt = last ? (last.dz0 ?? last.rate) : null; if (rt != null) small = `<small class="${rt >= 0 ? 'pos' : 'neg'}">${rt >= 0 ? '+' : ''}${(rt * 100).toFixed(2)}%</small>`;
    const need = pm >= ym(invStart()) && invMissing(a, pm) ? pm : invMissing(a, cm) ? cm : '';
    sub = need ? `${mShort(need)} 말 예탁자산 입력 전` : `${mShort(cm)} 예탁자산 입력함`;
    if (need) btn = `<button class="btn sm pri"${at('val', { id: a.id, m: need })}>입력</button>`;
  }
  if (a.type === 'foreign') { const b = fbookAt(a.id, T)[a.cur]; sub = `${fmtF(b ? b.u : +a.famt || 0, a.cur || '')} · 환율 ${fxRate(a) ? fmtR(fxRate(a)) : '없음'}`; }
  return `<div class="ac" role="button" tabindex="0"${at('detail', { v: a.id })}><span class="bx" style="${colorStyle(a)}">${esc([...a.name][0] || '?')}</span>
    <span class="mid"><span class="m1">${esc(a.name)}${a.fav ? ' <span class="star">★</span>' : ''}</span><span class="m2">${sub}</span></span>${btn}
    <span class="v ${v < 0 && a.type !== 'card' ? 'neg' : ''}">${val}${small}</span></div>`;
}
function vAssets() {
  const hdr = `<div class="t">자산</div><div class="sp"></div>${curBtn()}${ib('acctNew', 'plus', '계좌 추가')}`;
  if (!S.accounts.length) return { hdr, body: noAccounts() };
  const T = TODAY(), g = groups(T), pe = mRange(addM(ym(T), -1))[1], pg = pe >= S.settings.start || archOf(ym(pe)) ? groups(pe) : null;
  const parts = [['cash', g.cash], ['invest', g.invest], ['foreign', g.foreign]].filter(x => x[1] > 0), tp = parts.reduce((x, y) => x + y[1], 0) || 1;
  const d = pg ? g.total - pg.total : 0;
  let body = `<div class="card tot"><div class="l">총자산</div><div class="big">${won(g.total)}</div>
    ${pg ? `<div class="hs">지난달 말보다 <b class="${d >= 0 ? 'pos' : 'neg'}">${d >= 0 ? '+' : '-'}${fmt(Math.abs(d))}원</b></div>` : ''}
    ${parts.length ? `<div class="stk">${parts.map(([k, v]) => `<i style="width:${v / tp * 100}%;background:${GROUPS[k].c}"></i>`).join('')}</div>
    <div class="lgd">${parts.map(([k, v]) => `<span><i style="background:${GROUPS[k].c}"></i>${GROUPS[k].l} ${pct(v, tp)}%</span>`).join('')}</div>` : ''}</div>`;
  const GR = [[['bank'], '입출금'], [['card'], '카드'], [['prepaid'], '충전식'], [['saving', 'deposit'], '적금·예금'], [['invest'], '투자'], [['foreign'], '해외 자산']];
  const vis = accts();
  for (const [tys, l] of GR) {
    const xs = vis.filter(a => tys.includes(a.type)).sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0)); if (!xs.length) continue;
    const sum = xs.reduce((x, a) => x + valueAt(a, T), 0);
    let right = `<span class="r">${tys[0] === 'card' ? `결제 예정 ${fmt(Math.max(0, -sum))}` : fmt(sum)}</span>`;
    if (tys[0] === 'foreign') right = `<span class="r">${S.fx.at ? `환율 ${dLabel(S.fx.at)} 기준` : '환율 직접 입력'}</span>`;
    let extra = '';
    if (tys[0] === 'invest' && xs.some(a => a.isa)) { const { lim, paid } = isaInfo(); extra = `<div class="isa"><div class="nm">올해 ISA 납입<span>${man(paid)} / ${man(lim)}</span></div>${pbar(paid / lim * 100)}</div>`; }
    body += `<div class="card acs"><div class="ct">${l}${right}</div>${xs.map(acctLine).join('')}${extra}</div>`;
  }
  const fs = Object.entries(fxSummary(T)).filter(([, e]) => e.u > 1e-9 || Math.abs(e.rz) > .5);
  if (fs.length) body += `<div class="card"><div class="ct">외화<span class="r">${S.fx.at ? `환율 ${dLabel(S.fx.at)} 기준${S.fx.at === T ? '' : ' · 오늘 것은 아직 못 받음'}` : '환율 직접 입력'}<button class="btn sm"${at('fxRefresh')}>새로고침</button></span></div>
    ${fs.map(([cur, e]) => `<div class="fxr">${fxLine(cur, e, e.now)}</div>`).join('')}
    <div class="note in">계좌마다의 외화는 그 계좌 화면에서, 매입 환율은 환전 기록이나 계좌 설정의 시작 외화 잔액에서 정해져요.</div></div>`;
  const hid = S.accounts.filter(a => a.hidden);
  if (hid.length) body += U.showHidden ? `<div class="card acs"><div class="ct">숨긴 계좌<button class="r lnk"${at('showHidden')}>접기</button></div>${hid.map(acctLine).join('')}</div>` : `<button class="more"${at('showHidden')}>숨긴 계좌 ${hid.length}개 보기</button>`;
  body += `<button class="addrow"${at('acctNew')}>${ico('plus', 18)}계좌 추가</button>`;
  return { hdr, body };
}

/* ---------- 설정 ---------- */
const srow = (ic, l, a, d = {}, v = '', sub = '', cls = '') => `<button class="srow ${cls}"${at(a, d)}><span class="si">${ico(ic, 19)}</span><span class="sl">${l}${sub ? `<small>${sub}</small>` : ''}</span><span class="sv">${v}</span>${a === 'none' ? '' : ico('next', 16)}</button>`;
const stog = (ic, l, a, on, sub = '') => `<button class="srow"${at(a)}><span class="si">${ico(ic, 19)}</span><span class="sl">${l}${sub ? `<small>${sub}</small>` : ''}</span><span class="tg${on ? ' on' : ''}"><i></i></span></button>`;
const REM_L = d => +d ? `${d}일` : '끔';
const BKE_L = d => +d ? `${d}일마다` : '끔';
function vSet() {
  const back = `<button class="ib"${at('setBack')} aria-label="뒤로">${ico('back', 22)}</button>`;
  if (U.setTab === 'cat') {
    const st = mstats(ym(TODAY())), row = c => `<button class="srow"${at('catEdit', { id: c.id })}>${ciHTML(c.n, c.k)}<span class="sl">${esc(c.n)}${c.k === 'exp' ? `<small>이번 달 ${fmt(st.cats[c.n] || 0)}원</small>` : ''}</span><span class="sv">${+c.b ? `예산 ${man(c.b)}` : ''}</span>${ico('next', 16)}</button>`;
    return { hdr: `${back}<div class="t">카테고리</div>`, body: `<div class="sec">지출</div><div class="card tight">${S.cats.filter(c => c.k === 'exp').map(row).join('')}<button class="srow add"${at('catNew', { kind: 'exp' })}>${ico('plus', 18)}<span class="sl">지출 카테고리 추가</span></button></div>
      <div class="sec">수입</div><div class="card tight">${S.cats.filter(c => c.k === 'inc').map(row).join('')}<button class="srow add"${at('catNew', { kind: 'inc' })}>${ico('plus', 18)}<span class="sl">수입 카테고리 추가</span></button></div>
      <div class="note">카테고리를 눌러 이름과 월 예산을 바꿀 수 있어요. 더 자세히 나누고 싶으면 기록에 #태그를 붙이세요.</div>` };
  }
  if (U.setTab === 'rec') {
    const row = r => `<button class="srow"${at('recEdit', { id: r.id })}>${r.type === 'move' ? ciMove() : ciHTML(r.cat, r.type === 'in' ? 'inc' : 'exp')}<span class="sl">${esc(r.name)}<small>매달 ${r.day}일 · ${accS(r.acct)}${r.type === 'move' ? ' → ' + accS(r.to) : ''}${r.end && r.end < TODAY() ? ' · 끝남' : ''}${r.type !== 'move' && !r.cat ? ' · <span class="warnt">카테고리 없음</span>' : ''}</small></span><span class="sv ${r.type === 'in' ? 'pos' : ''}">${r.type === 'in' ? '+' : ''}${r.cur ? fmtF(r.famt, r.cur) : fmt(r.amt)}</span>${ico('next', 16)}</button>`;
    const sav = S.accounts.filter(a => a.type === 'saving' && A(a.mfrom) && +a.mamt);
    const fxb = fxCurs().length ? `<div class="sp"></div><button class="btn sm"${at('fxRefresh')}>${ico('fx', 15)}환율 ${S.fx.at ? dLabel(S.fx.at) : '없음'}</button>` : '';
    return { hdr: `${back}<div class="t">정기 결제 · 이체</div>${fxb}`, body: `<div class="card tight">${S.rec.map(row).join('')}<button class="srow add"${at('recNew')}>${ico('plus', 18)}<span class="sl">추가</span></button></div>
      ${sav.length ? `<div class="sec">적금 자동 납입</div><div class="card tight">${sav.map(a => `<button class="srow"${at('acctEdit', { id: a.id })}>${ciMove()}<span class="sl">${esc(a.name)}<small>매달 ${a.mday}일 · ${accS(a.mfrom)} → ${esc(a.name)}</small></span><span class="sv">${fmt(a.mamt)}</span>${ico('next', 16)}</button>`).join('')}</div>` : ''}
      <div class="note">월급, 구독료, 관리비, 적금 이체처럼 매달 같은 날 생기는 돈은 여기에 두면 그날 자동으로 기록돼요. 청약·적금 납입은 계좌 설정의 '매달 자동 납입'에서도 정할 수 있어요.</div>` };
  }
  const bk = bkGet(), every = bk.every ?? 30, pin = pinGet();
  const body = `<div class="sec">예산 · 기록</div><div class="card tight">
      ${srow('wallet', '한 달 예산', 'setBudget', {}, +S.settings.budget ? `${man(S.settings.budget)}원` : '정하지 않음', '홈에 오늘 쓸 수 있는 돈이 보여요')}
      ${srow('pie', '카테고리 · 카테고리 예산', 'openSet', { v: 'cat' }, `${S.cats.length}개`)}
      ${srow('sub', '정기 결제 · 이체', 'openSet', { v: 'rec' }, `${S.rec.length}건`)}
      ${srow('bell', '기록 알림', 'remindSet', {}, REM_L(S.settings.remind), '한동안 기록이 없으면 홈에서 알려 줘요')}
      ${S.accounts.some(a => a.type === 'prepaid') ? stog('coin', '캐시백 자동 사용', 'setCbAuto', !!S.settings.cbAuto, '충전식 결제 때 캐시백부터 쓰기') : ''}</div>
    <div class="sec">데이터</div><div class="card tight">
      ${Sync.status === 'off' ? '' : srow('cloud', '동기화', 'syncMenu', {}, esc(Sync.label ? Sync.label() : ''))}
      ${srow('down', '백업 파일 저장', 'exportMenu', {}, bk.last ? `${dLabel(bk.last)} 저장` : '저장한 적 없음', '암호를 걸어 저장할 수 있어요')}
      ${srow('up', '백업 파일 불러오기', 'importJson')}
      ${srow('clock', '백업 알림', 'bkEvery', {}, BKE_L(every))}
      ${srow('file', '구글 시트 CSV 가져오기', 'importCsv', {}, '', '셀가계부 시트 양식')}
      ${srow('archive', '오래된 거래 정리', 'closeMenu', {}, '', '달별 요약만 남기고 지우기')}</div>
    <div class="sec">앱</div><div class="card tight">
      ${srow('lock', '앱 잠금', 'pinMenu', {}, pin ? (bioGet() ? 'PIN + Face ID' : 'PIN') : '끔')}
      ${srow('theme', '화면 테마', 'theme', {}, { auto: '휴대폰 설정 따라감', light: '밝게', dark: '어둡게' }[themePref()])}
      ${srow('help', '도움말', 'help')}</div>
    <div class="sec">기준</div><div class="card tight">
      ${srow('cal', '시작일', 'setStart', {}, S.settings.start, '계좌 시작 잔액의 기준일')}
      ${S.accounts.some(a => a.type === 'invest') ? srow('chart', '투자 집계 시작일', 'setInvStart', {}, invStart(), '투자 계좌 시작 자산의 기준일 · 수익은 이날부터') : ''}
      ${S.accounts.some(a => a.isa) ? srow('chart', 'ISA 연 납입 한도', 'setIsa', {}, `${man(S.settings.isaLimit)}원`) : ''}</div>
    <div class="card tight">${srow('trash', '이 기기 데이터 초기화', 'reset', {}, '', '', 'dan')}</div>
    <div class="note">데이터는 이 기기에만 저장돼요. 가끔 백업 파일을 저장해 두세요.<br>버전 ${APP_VER}</div>`;
  return { hdr: `${back}<div class="t">설정</div>`, body };
}

/* ---------- 첫 화면 · 잠김 ---------- */
const LOGO = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="7" y="11" width="34" height="27" rx="6" stroke="#fff" stroke-width="3"/><path d="M7 19h34" stroke="#fff" stroke-width="3"/><path d="M15 28h8M15 32h5" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".85"/><circle cx="33" cy="29.5" r="3.2" fill="#fff"/></svg>`;
function vWelcome() {
  return `<div class="welcome"><div class="logo">${LOGO}</div><h1>셀가계부</h1>
    <p>한 줄로 적는 가계부</p>
    <div class="wbtn">
      ${Sync.status !== 'off' ? `<button class="bigbtn"${at('signIn')}>구글 로그인해서 이어 쓰기</button>` : ''}
      <button class="bigbtn${Sync.status !== 'off' ? ' ghost' : ''}"${at('startNew')}>새로 시작하기</button>
      <button class="bigbtn ghost"${at('importJson')}>백업 파일 불러오기</button>
      <button class="lnk"${at('help')}>사용법 보기</button>
    </div>
    <div class="note2">${Sync.status !== 'off' ? '데이터는 이 기기에 먼저 저장돼요.<br>로그인하면 기기에서 암호화한 뒤 동기화해요.' : '데이터는 이 기기에만 저장돼요.'}</div></div>`;
}
function vLocked() {
  return `<div class="welcome"><div class="logo">${LOGO}</div><h1>잠금 해제</h1><p>이 계정의 가계부는 암호로 보호돼 있어요.<br>가계부 암호를 입력하세요.</p>
    <div class="wbtn"><button class="bigbtn"${at('syncMenu')}>암호 입력</button></div></div>`;
}
