'use strict';
// 빠른 입력: 한 줄 해석, 오타 인식, 계좌 이동
/* ---------- 빠른 입력 (수식 입력줄 자리) ---------- */
const QE = { focus: false, acct: null, date: null, ov: {} }; // acct: 입력 기준 계좌(계좌 화면에서), date: 날짜 칩, ov: 미리보기에서 직접 바꾼 값
const KW = [[/커피|카페|스벅|스타벅스|디저트|빵|케이크|음료/, '커피·디저트'], [/점심|저녁|아침|식당|밥|마트|장보기|편의점|배달|식비|반찬|간식/, '식비·생활'],
  [/버스|지하철|택시|기차|ktx|srt|주유|교통|주차/i, '교통'], [/관리비|전기|가스|수도|월세|통신|공과금|인터넷/, '주거·공과금'], [/쿠팡|옷|쇼핑|온라인|다이소/, '쇼핑'],
  [/넷플릭스|유튜브|구독|멜론|icloud|애플뮤직|티빙|웨이브/i, '구독료'], [/영화|공연|여행|게임|여가|노래방|헬스/, '여가'], [/선물|경조사|축의|조의|모임|회비/, '사람'],
  [/월급|급여|보너스|상여/, '월급'], [/캐시백|환급|환불|이자/, '기타수입']];
const QIN = tk => /^(입금|월급|급여|보너스|상여금|환불|환급|이자|캐시백)$/.test(tk); // 뜻이 분명한 말만
const QOUT = tk => /^(출금|지출|결제)$/.test(tk);
const QTYPE = /^(입금|출금|지출|수입)$/;
// ---- 오타 인식 ----
const jamo = str => { let o = ''; for (const ch of str.toLowerCase()) { const c = ch.charCodeAt(0) - 0xAC00; o += c >= 0 && c < 11172 ? String.fromCharCode(0x1100 + (c / 588 | 0), 0x1161 + (c % 588 / 28 | 0)) + (c % 28 ? String.fromCharCode(0x11A7 + c % 28) : '') : ch; } return o; };
function editDist(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let low = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); low = Math.min(low, cur[j]); }
    if (low > max) return max + 1; prev = cur;
  }
  return prev[b.length];
}
// 고치지 않을 낱말: 흔한 가계부 낱말, 추정 단어, 지금까지 메모에 쓴 낱말 (오타처럼 보여도 그대로 둠)
const COMMON = '달러 엔 유로 위안 파운드 환전 매도 매수 아침 점심 저녁 야식 간식 배달 마트 편의점 장보기 반찬 과일 고기 우유 생수 라면 김밥 국밥 치킨 피자 떡볶이 빵집 술 회식 택시 버스 지하철 기차 주유 주차 세차 약국 병원 미용실 세탁 수리 선물 축의금 조의금 경조사 월세 관리비 전기 가스 수도 통신비 보험 학원 책 옷 신발 가방 화장품 담배 휴지 세제 이사 대출 적금 카드값 용돈 중고 판매 꽃 안경 문구 여행 숙소 항공 영화 게임 헬스 노래방 쿠팡 다이소 어제 오늘 그제 이동 이체 송금 입금 출금 지출 결제'.split(' ');
function knownWords() {
  return MEMO.kw ??= mkWords();
}
function mkWords() {
  const w = new Set(COMMON);
  for (const [re] of KW) for (const x of re.source.split('|')) w.add(x);
  for (const t of S.tx) for (const x of String(t.memo || '').split(' ')) w.add(x);
  return w;
}
// 오타는 계좌 이름과 카테고리에서만 고침 (메모 낱말은 건드리지 않음)
function fixTypos(text) {
  const known = knownWords(), fixed = [], nm = x => x.toLowerCase().replace(/\s+/g, '');
  const catWords = [...new Set(S.cats.flatMap(c => [c.n, ...c.n.split(/[·\s]/)]).filter(x => x.length >= 2))];
  const names = accts().map(a => [a, nm(a.name)]);
  const out = text.trim().split(' ').map(tk => {
    const m = tk.match(/^(.*?)(에서|으로|로|에)?$/), b = m[1], tail = m[2] || '';
    if (!/^[가-힣]{2,}$/.test(b) || known.has(b) || catWords.includes(b) || names.some(([, n]) => n.includes(nm(b)))) return tk; // 한글 두 글자 이상, 처음 보는 말만
    const lim = b.length >= 3 ? 2 : 1, jb = jamo(b);
    const ok = w => jamo(w)[0] === jb[0] && !w.includes(b) && !b.includes(w); // 첫 자음이 같고, 한쪽이 다른 쪽을 품지 않을 때만
    // 계좌 이름(앞부분)과 비교
    let best = null, bd = lim + 1, tie = false;
    for (const [a, n] of names) {
      if (!ok(n)) continue;
      const d = Math.min(editDist(jb, jamo(n.slice(0, b.length)), lim), editDist(jb, jamo(n), lim));
      if (d < bd) { best = a; bd = d; tie = false; } else if (d === bd && best && best.id !== a.id) tie = true;
    }
    if (best && !tie) { fixed.push(`${b}→${best.name}`); return best.name.replace(/\s+/g, '') + tail; }
    // 카테고리 이름과 비교
    let bw = null; bd = lim + 1; tie = false;
    for (const w of catWords) { if (!ok(w)) continue; const d = editDist(jb, jamo(w), lim); if (d < bd) { bw = w; bd = d; tie = false; } else if (d === bd) tie = true; }
    if (bw && !tie) { fixed.push(`${b}→${bw}`); return bw + tail; }
    return tk;
  });
  return { text: out.join(' '), fixed };
}
const escRe = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function parseQuick(text) {
  let t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const fx = fixTypos(t); t = ' ' + fx.text + ' ';
  const o = { date: TODAY(), acct: '', type: 'out', amt: 0, ex: '', cat: '', to: '', memo: '', fixed: fx.fixed, cur: '', famt: 0 };
  t = t.replace(/(\d[\d,]*(?:\.\d+)?(?:만|천)?) (달러|불|엔|유로|위안|파운드)(?= )/g, '$1$2'); // '20 달러' → '20달러'
  const findAcct = str => { let best = null; const l = str.toLowerCase(); for (const a of accts()) { const nm = a.name.toLowerCase(); if (nm && l.includes(nm) && (!best || nm.length > best.name.length)) best = a; } return best; };
  const PT = '(?:에서|으로|로|에)?'; // 계좌 이름 뒤 조사 (국민카드에서, 토스로)
  const cut = (str, name) => str.replace(new RegExp(escRe(name) + PT, 'i'), ' ');
  // 이름 일부만 쓴 경우 (예: '동백' → 동백전)
  const norm = x => x.toLowerCase().replace(/\s+/g, '');
  const bare = tk => tk.replace(/(에서|으로|로|에)$/, '');
  const partial = (str, ex) => { for (const tk of str.trim().split(' ')) {
    const b0 = bare(tk);
    if (b0.length < 2 || /\d/.test(tk) || S.cats.some(c => c.n === tk) || ['오늘', '어제', '그제', '그저께'].includes(tk)) continue;
    const hit = accts().filter(x => x.id !== ex && norm(x.name).includes(norm(b0)));
    if (hit.length === 1) return [hit[0], tk];
    if (hit.length > 1) { // 이름이 그 글자로 시작하는 계좌, 그다음 거래가 많은 계좌
      const sc = a => (norm(a.name).startsWith(norm(b0)) ? 1e6 : 0) + S.tx.reduce((c, x) => c + (x.acct === a.id), 0);
      return [hit.sort((a, b) => sc(b) - sc(a))[0], tk];
    }
  } return null; };
  const tokAcct = tk => { const b0 = bare(tk); return accts().find(a => norm(b0) === norm(a.name)) || (partial(' ' + tk + ' ') || [])[0]; };
  // 계좌 이동을 말로 적은 경우 → 'A → B' 꼴로
  //  'A에서 B로 5만' · 'A B 이체 5만' · (계좌 화면에서) 'B로 5만 이체' · 'B로 이체 5만'
  if (!/→|->|＞|>/.test(t)) {
    const tks = t.trim().split(' '), kw = tks.findIndex(x => /^(이체|이동|송금)$/.test(x));
    const ai = tks.map((x, i) => (tokAcct(x) ? i : -1)).filter(i => i >= 0);
    const from = ai.find(i => /에서$/.test(tks[i])), to = ai.find(i => /(으로|로)$/.test(tks[i]) && i !== from);
    const rest = skip => tks.filter((x, i) => !skip.includes(i) && i !== kw).join(' ');
    if (ai.length >= 2 && (kw >= 0 || (from != null && to != null))) {
      const f = from ?? ai[0], g = to ?? ai.find(i => i !== f);
      t = ` ${bare(tks[f])} → ${bare(tks[g])} ${rest([f, g])} `;
    } else if (ai.length === 1 && QE.acct && (kw >= 0 || to != null) && tokAcct(tks[ai[0]]).id !== QE.acct) {
      t = ` ${A(QE.acct).name} → ${bare(tks[ai[0]])} ${rest([ai[0]])} `; // 보고 있는 계좌에서 보냄
    } else if (ai.length === 1 && !QE.acct && kw >= 0) {
      t = ` ${rest([ai[0]])} → ${bare(tks[ai[0]])} `; // 전체 계좌 화면: 받는 계좌만 적으면 보내는 계좌를 물어봄
    }
  }
  const mv = t.split(/→|->|＞|>/);
  if (mv.length === 2) {
    let b = findAcct(mv[1]), part = mv[1];
    if (b) part = cut(mv[1], b.name); else { const p = partial(mv[1]); if (p) { b = p[0]; part = (' ' + mv[1] + ' ').replace(' ' + p[1] + ' ', ' '); } }
    if (b) { o.type = 'move'; o.to = b.id; t = mv[0] + ' ' + part + ' '; }
  }
  const a = findAcct(t); if (a && a.id !== o.to) { o.acct = a.id; t = cut(t, a.name); }
  let inHint = '';
  if (!o.acct) { const p = partial(t, o.to); if (p) { o.acct = p[0].id; t = t.replace(' ' + p[1] + ' ', ' '); if (QIN(bare(p[1]))) inHint = bare(p[1]); } } // '급여'가 급여통장도 가리키고 입금 뜻도 있음
  o.given = !!o.acct;
  const dw = [['그저께', -2], ['그제', -2], ['어제', -1], ['오늘', 0]];
  for (const [w, k] of dw) if (t.includes(' ' + w + ' ')) { o.date = addD(TODAY(), k); o.dateGiven = true; t = t.replace(' ' + w + ' ', ' '); break; }
  const dm = t.match(/\s(\d{1,2})[/.](\d{1,2})\s/);
  if (dm) { const d = `${TODAY().slice(0, 4)}-${pad2(dm[1])}-${pad2(dm[2])}`; if (isDate(d) && !isNaN(new Date(d))) { o.date = d; o.dateGiven = true; t = t.replace(dm[0], ' '); } }
  // 외화 금액: 20달러 · $20 · 1만엔 · ¥500 · 12.5usd
  const CW = [[/^(달러|불|usd|\$)$/i, 'USD'], [/^(엔|yen|jpy|¥|￥)$/i, 'JPY'], [/^(유로|eur|€)$/i, 'EUR'], [/^(위안|cny|rmb)$/i, 'CNY'], [/^(파운드|gbp|£)$/i, 'GBP'], [/^(hkd)$/i, 'HKD'], [/^(twd)$/i, 'TWD'], [/^(바트|thb|฿)$/i, 'THB'], [/^(vnd|₫)$/i, 'VND'], [/^(aud)$/i, 'AUD'], [/^(cad)$/i, 'CAD']];
  const curOf = w => { for (const [re, c] of CW) if (re.test(w)) return c; return ''; };
  const rest = [];
  for (const tk of t.trim().split(' ').filter(Boolean)) {
    if (!o.cur) {
      const m = tk.match(/^([$¥￥€£฿₫])(\d[\d,]*(?:\.\d+)?)(만|천)?$/) || tk.match(/^(\d[\d,]*(?:\.\d+)?)(만|천)?([^\d,.\s]{1,5})$/);
      if (m) {
        const sym = /\d/.test(m[1]) ? m[3] : m[1], numS = /\d/.test(m[1]) ? m[1] : m[2], mul = (/\d/.test(m[1]) ? m[2] : m[3]) === '만' ? 10000 : (/\d/.test(m[1]) ? m[2] : m[3]) === '천' ? 1000 : 1, c = curOf(sym);
        if (c) { o.cur = c; o.famt = Math.round(Number(numS.replace(/,/g, '')) * mul * 100) / 100; continue; }
      }
    }
    if (/^환전/.test(tk) && o.type !== 'move') { o.type = 'fx'; o.side = 'buy'; continue; }
    if (o.type === 'fx' && /^(매도|팔기|팔아서|팔고)$/.test(tk)) { o.side = 'sell'; continue; }
    if (!o.amt) {
      const m = tk.match(/^([+＋])?(\d[\d,.]*(?:[+\-×÷*/x]\d[\d,.]*)*)(만|천)?원?$/);
      if (m) {
        const ex = m[2].replace(/x/g, '×'); let v = calc(ex);
        if (v != null && v !== 0) {
          if (m[3] === '만') v *= 10000; if (m[3] === '천') v *= 1000;
          o.amt = Math.round(Math.abs(v)); o.amtGiven = true;
          if (/[+\-×÷*/]/.test(ex)) o.ex = ex.replace(/\*/g, '×').replace(/\//g, '÷');
          if (m[1] && o.type !== 'move') o.type = 'in';
          continue;
        }
      }
    }
    rest.push(tk);
  }
  if (o.type === 'fx' && !o.cur) o.cur = fxCurs()[0] || 'USD';
  if (o.type !== 'move' && o.type !== 'fx') {
    // + 기호 대신 말로: 들어온 돈이면 입금, 나간 돈이라고 적었으면 출금
    // '캐시백으로' · '캐시백 사용': 이 결제에 캐시백을 씀 (입금 아님)
    { const i = rest.findIndex(x => x === '캐시백으로' || x === '캐시백사용'), j = rest.indexOf('캐시백');
      if (i >= 0) { o.cbUse = 'max'; rest.splice(i, 1); } else if (j >= 0 && /^(사용|써서|결제)$/.test(rest[j + 1] || '')) { o.cbUse = 'max'; rest.splice(j, 2); } }
    const outW = rest.some(QOUT) || !!o.cbUse, inW = !outW && (rest.some(QIN) || !!inHint);
    if (outW) o.type = 'out'; else if (inW) o.type = 'in';
    for (let i = rest.length - 1; i >= 0; i--) if (QTYPE.test(rest[i])) rest.splice(i, 1); // '입금' 같은 말은 메모에서 뺌
    const toIn = () => { if (!outW) o.type = 'in'; };
    const kind = () => o.type === 'in' ? 'inc' : 'exp';
    const ci = rest.findIndex(tk => tk.length >= 2 && S.cats.some(c => c.n === tk || c.n.startsWith(tk)));
    if (ci >= 0) { const c = S.cats.find(c => c.n === rest[ci]) || S.cats.find(c => c.n.startsWith(rest[ci])); o.cat = c.n; if (c.k === 'inc') toIn(); if (c.n === rest[ci]) rest.splice(ci, 1); }
    const memo = rest.join(' ');
    const inBefore = () => S.tx.some(x => x.memo === memo && x.type === 'in');
    if (!o.cat && memo) { const g = guessCat(memo, o.type) || (!outW && (inW || inBefore()) ? guessCat(memo, 'in') : ''); if (g) { o.cat = g; if (catOf(g)?.k === 'inc') toIn(); } }
    if (!o.cat && inHint && o.type === 'in') o.cat = guessCat(inHint, 'in');
    if (!o.cat && o.type === 'in' && catOf('기타수입')) o.cat = '기타수입';
    if (!o.acct && !QE.acct && memo) for (let i = S.tx.length - 1; i >= 0; i--) if (S.tx[i].memo === memo && A(S.tx[i].acct)) { o.acct = S.tx[i].acct; break; } // 같은 메모를 쓴 계좌를 기본으로
    if (o.cat && catOf(o.cat) && catOf(o.cat).k !== kind()) o.cat = '';
  }
  o.memo = rest.join(' ').slice(0, 60);
  if (o.cur) { // 원화 금액을 함께 적었으면 그게 환산액, 아니면 환율로 계산
    const f = o.famt || 0;
    if (o.type === 'fx') { o.rate = o.amt && f ? o.amt / f : rateAt(o.cur, o.date); if (!o.amt) o.amt = Math.round(f * o.rate); o.cat = ''; o.ex = ''; }
    else { o.rate = o.amt && f ? o.amt / f : curRate(o.cur); o.amt = Math.round(f * o.rate); o.ex = ''; }
    o.rate = Math.round(o.rate * 10000) / 10000;
  }
  if (!o.acct) o.acct = QE.acct || lastAcct() || '';
  if (o.type === 'fx' && A(o.acct)?.type === 'foreign') o.acct = accts().find(x => x.type !== 'invest' && x.type !== 'foreign')?.id || '';
  if (o.type === 'move' && o.acct === o.to) o.acct = accts().find(x => x.id !== o.to && x.type !== 'invest' && x.type !== 'foreign')?.id || '';
  return o;
}
/* ---------- 아래 입력창 (메신저처럼) ---------- */
const qDateLbl = d => !d || d === TODAY() ? '오늘' : d === addD(TODAY(), -1) ? '어제' : dLabel(d);
function qeBar() {
  return `<div class="qwrap" id="qwrap"><div class="sugg" id="qSug"></div><div class="pvw" id="qPrev"></div>
    <div class="qbar"><button class="dt${QE.date && QE.date !== TODAY() ? ' on' : ''}" id="qDt"${at('qDate')} aria-label="날짜">${qDateLbl(QE.date)}</button>
    <input id="qeIn" data-i="qe" enterkeyhint="send" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="빠른 입력">
    <button class="go" id="qGo"${at('qGo')} aria-label="직접 입력">${ico('plus', 21)}</button></div></div>`;
}
// 내역을 스크롤하면 맨 위에 보이는 날짜가 입력 날짜가 됨
function dateFromScroll() {
  if (!S || !(U.tab === 'list' || (U.tab === 'assets' && U.detail)) || !$('#qeIn') || U.q) return;
  const b = $('#body'); if (!b) return; const top = b.getBoundingClientRect().top + 12;
  const days = [...b.querySelectorAll('.day[data-d]')]; if (!days.length) return;
  let pick = days[0].dataset.d; for (const el of days) { if (el.getBoundingClientRect().top <= top) pick = el.dataset.d; else break; }
  const T = TODAY(); if (pick > T) pick = T;
  const nd = pick === T ? null : pick; if (nd === QE.date) return;
  QE.date = nd; const c = $('#qDt'); if (c) { c.textContent = qDateLbl(QE.date); c.classList.toggle('on', !!QE.date); } qeInput();
}
function qeRestore(v) { const el = $('#qeIn'); if (!el) return; el.value = v || ''; qeInput(); if (QE.focus) { QE.focus = false; el.focus({ preventScroll: true }); } }
const qeTags = text => { const tags = []; const t = String(text || '').replace(/#([^\s#]+)/g, (_, g) => { tags.push(g); return ' '; }); return { t, tags }; };
function qeParse() {
  const { t, tags } = qeTags($('#qeIn')?.value || '');
  const o = parseQuick(t); if (!o) return null;
  o.tags = cleanTags(tags);
  if (!o.dateGiven && QE.date) o.date = QE.date;
  const ov = QE.ov;
  if (ov.type && o.type !== 'move' && ov.type !== o.type) {
    o.type = ov.type;
    if (o.cat && catOf(o.cat)?.k !== (o.type === 'in' ? 'inc' : 'exp')) o.cat = '';
    if (!o.cat && o.type === 'in') o.cat = guessCat(o.memo, 'in') || (catOf('기타수입') ? '기타수입' : '');
  }
  if (ov.acct && A(ov.acct) && ov.acct !== o.to) { o.acct = ov.acct; o.given = true; }
  if (ov.to && A(ov.to) && o.type === 'move') o.to = ov.to;
  if (ov.cat != null && o.type !== 'move') o.cat = ov.cat;
  if (o.cur || ov.cur) { // 미리보기에서 고친 외화 금액·원화·환율·방향·통화
    if (ov.cur) o.cur = ov.cur;
    if (ov.famt != null) o.famt = ov.famt;
    if (ov.side) o.side = ov.side;
    const f = o.famt || 0;
    if (ov.kamt != null) { o.amt = ov.kamt; if (f) o.rate = ov.kamt / f; }
    else if (ov.rate != null) { o.rate = ov.rate; o.amt = Math.round(f * ov.rate); }
    else if (ov.cur || ov.famt != null) {
      if (o.amtGiven && !ov.cur) o.rate = f ? o.amt / f : o.rate; // 원화를 적어 뒀으면 그 금액 유지, 환율이 바뀜
      else { o.rate = o.type === 'fx' ? rateAt(o.cur, o.date) : curRate(o.cur); o.amt = Math.round(f * o.rate); }
    }
    o.rate = Math.round((o.rate || 0) * 10000) / 10000;
  }
  return o;
}
function quickPreview(o) {
  if (!o) return '';
  const tp = o.type === 'in' ? 'g' : o.type === 'move' || o.type === 'fx' ? 'm' : 'o';
  const p = [];
  const fxPills = () => [`<button class="pill ${o.famt ? '' : 'w'}"${at('qFamt')}>${o.famt ? fmtF(o.famt, o.cur) : `${o.cur} 금액?`}</button>`, `<button class="pill"${at('qKrw')}>${o.type === 'fx' ? (o.side === 'sell' ? '→ ' : '← ') : '≈ '}${o.amt ? fmt(o.amt) + '원' : '원화?'}</button>`, `<button class="pill"${at('qRate')}>환율 ${o.rate ? fmtR(o.rate) : '?'}</button>`, `<button class="pill"${at('qCur')}>${esc(o.cur)}</button>`];
  if (o.type === 'fx') { // 눌러서 고치기: 방향 · 외화 · 원화 · 환율 · 통화 · 계좌 · 날짜
    p.push(`<button class="pill m"${at('qSide')}>${o.side === 'sell' ? '환전 외화 → 원화' : '환전 원화 → 외화'}</button>`, ...fxPills(), `<button class="pill"${at('qPick', { f: 'acct' })}>${esc(o.acct ? accName(o.acct) : '계좌?')}</button>`, `<button class="pill"${at('qDate')}>${qDateLbl(o.date)}</button>`);
    if (o.memo) p.push(`<span class="pm">${esc(o.memo)}</span>`);
    return `<div class="k">이렇게 기록돼요 · 눌러서 고치기</div>${p.join('')}`;
  }
  if (o.cur) p.push(`<button class="pill ${tp}"${at('qType')}>${TXL[o.type]}</button>`, ...fxPills());
  else p.push(`<button class="pill ${tp}"${at('qType')}>${TXL[o.type]} ${o.amt ? fmt(o.amt) : '금액?'}</button>`);
  if (o.type === 'move') p.push(`<button class="pill"${at('qPick', { f: 'acct' })}>${esc(o.acct ? accName(o.acct) : '보내는 계좌?')}</button><span class="mut">→</span><button class="pill"${at('qPick', { f: 'to' })}>${esc(accName(o.to))}</button>`);
  else p.push(`<button class="pill ${o.cat ? 'c' : 'w'}"${at('qCat')}>${o.cat ? esc(o.cat) : '카테고리 선택'}</button>`, `<button class="pill"${at('qPick', { f: 'acct' })}>${esc(o.acct ? accName(o.acct) : '계좌?')}</button>`);
  p.push(`<button class="pill"${at('qDate')}>${qDateLbl(o.date)}</button>`);
  for (const g of o.tags || []) p.push(`<span class="pill t">#${esc(g)}</span>`);
  if (o.cbUse) p.push('<span class="pill">캐시백 사용</span>');
  if (o.memo) p.push(`<span class="pm">${esc(o.memo)}</span>`);
  const fx = o.fixed?.length ? `<div class="pfix">오타로 보고 고쳤어요 · ${esc(o.fixed.join(', '))}</div>` : '';
  return `<div class="k">이렇게 기록돼요</div>${p.join('')}${fx}`;
}
// 추천: 비어 있으면 자주 쓴 기록, 입력 중이면 예전 메모 이어 쓰기
function qeSugg(text) {
  const out = [], seen = new Set(), from = addD(TODAY(), -120);
  const words = text.replace(/#[^\s#]+/g, ' ').trim().split(' ').filter(w => w && !/^[+＋]?\d/.test(w));
  const amtTk = text.trim().split(' ').find(w => /^[+＋]?\d/.test(w)) || '';
  const chips = (lab, xs) => xs.length ? `<span class="lab">${lab}</span>${xs.map(o => `<button${at('qSug', { t: o.t, c: o.c })}>${o.l}</button>`).join('')}` : '';
  if (!text.trim()) return '';
  const q = words.join(' '); if (!q) return '';
  const ql = q.toLowerCase();
  for (let i = S.tx.length - 1; i >= 0 && out.length < 6; i--) {
    const x = S.tx[i], m = x.memo || ''; if (!m || seen.has(m) || m === q || !m.toLowerCase().includes(ql)) continue;
    seen.add(m); out.push({ l: `${esc(m)}${amtTk ? '' : ` <b>${fmt(x.amt)}</b>`}`, t: `${x.type === 'in' ? '+' : ''}${m} ${amtTk || x.amt}`, c: x.acct, pre: m.toLowerCase().startsWith(ql) });
  }
  out.sort((a, b) => b.pre - a.pre);
  return chips('예전 기록', out.slice(0, 4));
}
function qeInput() {
  const el = $('#qeIn'); if (!el) return;
  const v = el.value; if (!v.trim()) QE.ov = {};
  const o = v.trim() ? qeParse() : null, p = $('#qPrev'), sg = $('#qSug'), go = $('#qGo');
  if (p) { p.innerHTML = quickPreview(o); p.classList.toggle('on', !!o); }
  if (sg) { const h = qeSugg(v); sg.innerHTML = h; sg.classList.toggle('on', !!h); }
  if (go) { const on = !!v.trim(); go.classList.toggle('send', on); go.innerHTML = ico(on ? 'send' : 'plus', 21); go.setAttribute('aria-label', on ? '기록' : '직접 입력'); }
}
function qeAdd() {
  const el = $('#qeIn'); if (!el) return;
  if (!el.value.trim()) return txForm(null);
  const o = qeParse();
  if (!o) return;
  if (o.cur ? !(o.famt > 0) : !o.amt) return toast(o.type === 'fx' ? '외화 금액이 없어요 (예: 100달러)' : '금액이 없어요');
  if (o.cur && !(o.rate > 0)) return toast('환율이 없어요. 자산 탭에서 환율을 새로고침하세요');
  if (!accts().length) return toast('자산 탭에서 계좌를 먼저 추가하세요');
  const finish = acct => {
    const t = touch({ id: uid(), date: o.date, acct, type: o.type, amt: o.amt, ex: o.ex, cat: o.type === 'move' || o.type === 'fx' ? '' : o.cat, to: o.type === 'move' ? o.to : '', memo: o.memo,
      ...(o.tags?.length && o.type !== 'fx' ? { tags: o.tags } : {}), ...(o.cbUse && !o.cur ? { cbUse: o.cbUse } : {}),
      ...(o.cur ? { cur: o.cur, famt: o.famt, rate: o.rate, ...(o.type === 'fx' ? { side: o.side || 'buy' } : {}) } : {}) });
    el.value = ''; QE.ov = {}; QE.focus = true; U.flash = t.id; // 고른 날짜는 그대로 둠 (지난 날짜를 이어서 넣기 편하게)
    if (U.tab === 'list' && ym(o.date) !== U.month) U.month = ym(o.date);
    commit(() => S.tx.push(t));
    toast(`기록했어요 · ${o.date === TODAY() ? '' : qDateLbl(o.date) + ' · '}${o.memo || o.cat || TXL[o.type]} ${o.cur ? fmtF(o.famt, o.cur) : fmt(o.amt)}`, true);
  };
  if (o.type === 'move' && !o.given && !QE.acct) {
    el.blur();
    return pickAcct({ title: '어느 계좌에서 보냈나요?', sub: `${accName(o.to)}(으)로 ${fmt(o.amt)}원`, cur: '', exclude: o.to, onPick: v => v && finish(v) });
  }
  if (!o.acct) return toast('계좌를 찾지 못했어요');
  finish(o.acct);
}
ACT.qGo = () => qeAdd();
ACT.qSug = d => { const el = $('#qeIn'); if (!el) return; el.value = d.t; QE.ov = d.c && A(d.c) ? { acct: d.c } : {}; qeInput(); el.focus({ preventScroll: true }); };
// 미리보기에서 외화 값 고치기 (입력 글은 그대로 두고 덧씌움)
const qNum = (title, init, key, dec) => { const keep = $('#qeIn')?.value || ''; numSheet({ title, init: init == null ? '' : String(init), hint: '비우고 저장하면 입력한 글 그대로 계산해요', ok: v => { const ov = { ...QE.ov }; if (v == null) delete ov[key]; else ov[key] = dec ? Math.round(Math.abs(v) * 10000) / 10000 : Math.round(Math.abs(v)); if (key === 'kamt') delete ov.rate; if (key === 'rate') delete ov.kamt; QE.ov = ov; qeRestore(keep); } }); };
ACT.qFamt = () => { const o = qeParse(); if (!o?.cur) return; qNum(`${o.cur} 금액`, o.famt || '', 'famt', true); };
ACT.qKrw = () => { const o = qeParse(); if (!o?.cur) return; qNum('원화 금액', o.amt || '', 'kamt'); };
ACT.qRate = () => { const o = qeParse(); if (!o?.cur) return; qNum(`환율 (1${o.cur}당 원)`, o.rate || '', 'rate', true); };
ACT.qSide = () => { const o = qeParse(); if (!o || o.type !== 'fx') return; QE.ov = { ...QE.ov, side: o.side === 'sell' ? 'buy' : 'sell' }; qeInput(); };
ACT.qCur = () => { const o = qeParse(); if (!o?.cur) return; SH.qcur = $('#qeIn')?.value || ''; optSheet('통화', '', [...new Set([...fxCurs(), ...CURS])].map(c => [c, `${c}${CSYM[c] ? ' ' + CSYM[c] : ''}`]), o.cur, 'qCurPick'); };
ACT.qCurPick = d => { closeSheet(); const ov = { ...QE.ov, cur: d.v }; delete ov.rate; delete ov.kamt; QE.ov = ov; qeRestore(SH.qcur || ''); };
ACT.qType = () => { const o = qeParse(); if (!o || o.type === 'move' || o.type === 'fx') return; const ov = { ...QE.ov, type: o.type === 'in' ? 'out' : 'in' }; delete ov.cat; QE.ov = ov; qeInput(); };
ACT.qPick = d => {
  const o = qeParse(); if (!o) return; const keep = $('#qeIn').value;
  pickAcct({ title: d.f === 'to' ? '받는 계좌' : o.type === 'move' ? '보내는 계좌' : '계좌', cur: o[d.f], exclude: d.f === 'to' ? o.acct : o.type === 'move' ? o.to : '',
    onPick: v => { if (v) QE.ov = { ...QE.ov, [d.f]: v }; qeRestore(keep); } });
};
ACT.qCat = () => {
  const o = qeParse(); if (!o) return; const keep = $('#qeIn').value;
  catPick({ kind: o.type === 'in' ? 'inc' : 'exp', cur: o.cat, onPick: v => { QE.ov = { ...QE.ov, cat: v }; qeRestore(keep); } });
};
ACT.qDate = () => {
  const keep = $('#qeIn')?.value || '';
  dateSheet({ title: '날짜', cur: qeParse()?.date || QE.date || TODAY(), onPick: v => {
    QE.date = v === TODAY() ? null : v; const b = $('#qDt'); if (b) { b.textContent = qDateLbl(QE.date); b.classList.toggle('on', !!QE.date); } qeRestore(keep);
  } });
};
INP.qe = qeInput;
