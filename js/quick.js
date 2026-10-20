'use strict';
// 빠른 입력: 한 줄 해석, 오타 인식, 계좌 이동
/* ---------- 빠른 입력 (수식 입력줄 자리) ---------- */
const QE = { focus: false };
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
const COMMON = '아침 점심 저녁 야식 간식 배달 마트 편의점 장보기 반찬 과일 고기 우유 생수 라면 김밥 국밥 치킨 피자 떡볶이 빵집 술 회식 택시 버스 지하철 기차 주유 주차 세차 약국 병원 미용실 세탁 수리 선물 축의금 조의금 경조사 월세 관리비 전기 가스 수도 통신비 보험 학원 책 옷 신발 가방 화장품 담배 휴지 세제 이사 대출 적금 카드값 용돈 중고 판매 꽃 안경 문구 여행 숙소 항공 영화 게임 헬스 노래방 쿠팡 다이소 어제 오늘 그제 이동 이체 송금 입금 출금 지출 결제'.split(' ');
function knownWords() {
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
  const o = { date: defDate(), acct: '', type: 'out', amt: 0, ex: '', cat: '', to: '', memo: '', fixed: fx.fixed };
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
    } else if (ai.length === 1 && U.acct && (kw >= 0 || to != null) && tokAcct(tks[ai[0]]).id !== U.acct) {
      t = ` ${A(U.acct).name} → ${bare(tks[ai[0]])} ${rest([ai[0]])} `; // 보고 있는 계좌에서 보냄
    } else if (ai.length === 1 && !U.acct && kw >= 0) {
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
  const rest = [];
  for (const tk of t.trim().split(' ').filter(Boolean)) {
    if (!o.amt) {
      const m = tk.match(/^([+＋])?(\d[\d,.]*(?:[+\-×÷*/x]\d[\d,.]*)*)(만|천)?원?$/);
      if (m) {
        const ex = m[2].replace(/x/g, '×'); let v = calc(ex);
        if (v != null && v !== 0) {
          if (m[3] === '만') v *= 10000; if (m[3] === '천') v *= 1000;
          o.amt = Math.round(Math.abs(v));
          if (/[+\-×÷*/]/.test(ex)) o.ex = ex.replace(/\*/g, '×').replace(/\//g, '÷');
          if (m[1] && o.type !== 'move') o.type = 'in';
          continue;
        }
      }
    }
    rest.push(tk);
  }
  if (o.type !== 'move') {
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
    if (!o.acct && !U.acct && memo) for (let i = S.tx.length - 1; i >= 0; i--) if (S.tx[i].memo === memo && A(S.tx[i].acct)) { o.acct = S.tx[i].acct; break; } // 같은 메모를 쓴 계좌를 기본으로
    if (o.cat && catOf(o.cat) && catOf(o.cat).k !== kind()) o.cat = '';
  }
  o.memo = rest.join(' ').slice(0, 60);
  if (!o.acct) o.acct = U.acct || lastAcct() || '';
  if (o.type === 'move' && o.acct === o.to) o.acct = accts().find(x => x.id !== o.to && x.type !== 'invest' && x.type !== 'foreign')?.id || '';
  return o;
}
function quickPreview(o) {
  if (!o) return '';
  const parts = [!U.acct && !o.given ? '<span class="neg b">계좌 이름도 적어 주세요</span>' : `<b>${esc(o.acct ? accName(o.acct) : '계좌 없음')}</b>`, `${TXL[o.type]} <b>${o.amt ? fmt(o.amt) : '금액?'}</b>`];
  if (o.type === 'move') parts.push(`→ <b>${esc(accName(o.to))}</b>`);
  else parts.push(o.cat ? `${catLbl(o.cat)}` : '<span class="neg">카테고리 빈 칸</span>');
  parts.push(o.date === TODAY() ? '오늘' : dLabel(o.date));
  if (o.memo) parts.push(`"${esc(o.memo)}"`);
  if (o.cbUse) parts.push('캐시백 사용');
  const fx = o.fixed?.length ? ` <span class="qfix">· 오타 고침 ${esc(o.fixed.join(', '))}</span>` : '';
  return '↳ ' + parts.join(' · ') + fx + ' <span style="color:var(--muted)">· Enter로 추가</span>';
}
// 날짜 칸: 비우면 오늘(보는 달 기준), 10/14 · 14 · 1014 · 2026-10-14
function qDate(v) {
  v = String(v ?? '').trim(); if (!v) return defDate();
  const base = U.month; let m;
  if (isDate(v)) return v;
  if ((m = v.match(/^(\d{1,2})[/.\-\s](\d{1,2})$/)) || (m = v.match(/^(\d{2})(\d{2})$/))) {
    let y = +TODAY().slice(0, 4); if (`${y}-${pad2(m[1])}` > ym(TODAY())) y--;
    const d = `${y}-${pad2(m[1])}-${pad2(m[2])}`; return +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= lastDay(ym(d)) ? d : null;
  }
  if ((m = v.match(/^(\d{1,2})$/))) return +m[1] >= 1 && +m[1] <= lastDay(base) ? `${base}-${pad2(m[1])}` : null;
  return null;
}
function qeParse() {
  const o = parseQuick($('#qeIn')?.value || ''); if (!o) return null;
  if (!o.dateGiven) { const d = qDate($('#qeDate')?.value); if (d) o.date = d; else o.badDate = true; }
  return o;
}
function qeInput() { const p = $('#qePrev'); if (!p) return; const o = qeParse(); p.innerHTML = quickPreview(o) + (o?.badDate ? ' <span class="neg">· 날짜를 확인하세요 (예: 10/14)</span>' : ''); p.classList.toggle('on', !!o); }
function qeAdd() {
  const el = $('#qeIn'); if (!el) return;
  const o = qeParse();
  if (!o) { el.focus(); return toast('예: 체크카드 커피 4500 · 어제 버스 1500 · +2850000 월급'); }
  if (o.badDate) return toast('날짜를 확인하세요 (예: 10/14, 비우면 오늘)');
  if (!o.amt) return toast('금액을 넣어 주세요 (예: 4500, 1.5만)');
  if (!accts().length) return toast('설정 탭에서 계좌를 먼저 추가하세요');
  const finish = acct => {
    const t = touch({ id: uid(), date: o.date, acct, type: o.type, amt: o.amt, ex: o.ex, cat: o.cat, to: o.to, memo: o.memo, ...(o.cbUse ? { cbUse: o.cbUse } : {}) });
    const moved = acct !== U.acct;
    if (moved) U.acct = acct;   // 전체 계좌나 다른 계좌 화면에서 입력하면 그 계좌 화면으로
    if (U.flt.t !== 'all' || U.flt.cats.length || U.q) { U.flt = { ...U.flt, t: 'all', cats: [] }; U.q = ''; }
    if (ym(o.date) !== U.month && U.flt.p !== 'all') U.month = ym(o.date);
    U.sel = { id: t.id, k: 'amt' }; QE.focus = true;
    commit(() => S.tx.push(t)); scrollSel();
    toast(`추가했어요 · ${o.memo || o.cat || TXL[o.type]} ${fmt(o.amt)}${moved ? ` · ${accName(acct)} 화면으로 이동` : ''}${o.type !== 'move' && !o.cat ? ' (카테고리 빈 칸)' : ''}`);
  };
  if (!U.acct && !o.given) {
    el.blur();
    return pickAcct({ title: '어느 계좌인가요?', sub: o.type === 'move' ? '보내는 계좌' : '고르면 그 계좌 화면으로 넘어가요', cur: o.acct, exclude: o.to, onPick: v => v && finish(v) });
  }
  if (!o.acct) return toast('계좌를 찾지 못했어요');
  finish(o.acct);
}

function payInfo(a) {
  if (!(+a.payDay)) return null;
  const t = TODAY(); let m = ym(t); let d = `${m}-${pad2(Math.min(+a.payDay, lastDay(m)))}`;
  if (d < t) { m = addM(m, 1); d = `${m}-${pad2(Math.min(+a.payDay, lastDay(m)))}`; }
  const n = Math.round((new Date(d) - new Date(t)) / 864e5);
  return { date: d, n, label: `${dLabel(d)} 결제 · ${n ? 'D-' + n : 'D-day'}` };
}
