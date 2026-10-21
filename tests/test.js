// 점검용 — 배포하지 않음 (firebase.json ignore)
const P = new URLSearchParams(location.search), mode = P.get('m') || 'unit', shot = P.get('shot');
const f = document.getElementById('f'), out = document.getElementById('out');
const log = [], ok = (c, m) => log.push((c ? 'PASS ' : 'FAIL ') + m);
f.style.height = (P.get('h') || 844) + 'px'; f.style.width = (P.get('w') || 390) + 'px';
// 점검은 ?test 로 열어 실제 가계부(cellbook.v1)와 다른 저장 공간을 쓴다. 섞이지 않는지도 확인.
const REAL0 = localStorage.getItem('cellbook.v1'); // 쓰지 않고 비교만
localStorage.setItem('cellbook.test.theme', P.get('theme') || 'light'); // 점검 전용 키
if (mode !== 'shot') localStorage.removeItem('cellbook.test.tip1'); // 화면 찍기에서 남은 값 지움
if (mode === 'shot') { localStorage.setItem('cellbook.test.tip1', '1'); localStorage.setItem('cellbook.test.bk', JSON.stringify({ last: new Date().toISOString().slice(0, 10) })); }
f.src = '../index.html?test';
f.onload = () => { if (mode === 'shot') runShot(); else setTimeout(run, 50); };
function runShot() { const w = f.contentWindow, d = w.document, cb = w.__cb, A = cb.ACT; const st = d.createElement('style'); st.textContent = '*{animation:none!important;transition:none!important}#toast{display:none}'; d.head.appendChild(st); loadDemo(cb); shotsSync(w, d, cb, A); }
function demoState(cb) {
  const { blankState, TODAY, mRange, addM, addD, ym } = cb.util;

  const s = blankState(), today = TODAY(), start = mRange(addM(ym(today), -3))[0], t0 = 1;
  s.settings = { start, isaLimit: 20000000, u: t0 }; s.demo = true;
  const ac = (id, name, type, st, x = {}) => ({ id, name, type, start: st, u: t0, ...x });
  s.accounts = [ac('a1', '급여통장', 'bank', 2650000, { fav: true }), ac('a2', '생활비통장', 'bank', 500700), ac('a3', '체크카드', 'card', 0, { payDay: 14, fav: true }),
    ac('a4', '동백전', 'prepaid', 15000, { link: 'a2', th: 10000, camt: 50000, cbp: 10 }), ac('a5', '주택청약', 'saving', 4520000, { mat: '2029-03-31' }),
    ac('a6', 'ISA', 'invest', 8400000, { isa: true }), ac('a7', '미국주식', 'invest', 4600000), ac('a8', '한국주식', 'invest', 2700000), ac('a9', '엔화', 'foreign', 0, { cur: 'JPY', famt: 115801, rate: 9.1 })];
  const R = (id, name, type, amt, day, acct, x = {}) => ({ id, name, type, amt, day, acct, to: '', cat: '', start, end: '', u: t0, ...x });
  s.rec = [R('r1', '월급', 'in', 2850000, 25, 'a1', { cat: '월급' }), R('r2', 'ISA 적립', 'move', 500000, 26, 'a1', { to: 'a6' }), R('r3', '생활비 이체', 'move', 700000, 26, 'a1', { to: 'a2' }),
    R('r4', '청약 납입', 'move', 100000, 27, 'a1', { to: 'a5' }), R('r5', '관리비', 'out', 120000, 10, 'a1', { cat: '주거·공과금' }), R('r6', '음악 구독', 'out', 8900, 30, 'a3', { cat: '구독료' }),
    R('r7', '카드값 결제', 'move', 230000, 14, 'a2', { to: 'a3' })];
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const P = [['a3', '커피·디저트', [4500, 5400, 6200], '회사 앞 카페'], ['a3', '식비·생활', [9000, 11000, 13800], '점심'], ['a4', '식비·생활', [18200, 36000, 24500], '장보기'],
    ['a4', '커피·디저트', [4500, 3800], '동네 카페'], ['a2', '교통', [1500, 1550], '버스'], ['a3', '쇼핑', [29000, 45000], '온라인'], ['a2', '여가', [15000, 22000], '영화'], ['a3', '사람', [30000, 50000], '선물']];
  let d = start, i = 0;
  while (d <= today) {
    const n = rnd() < .35 ? 0 : rnd() < .7 ? 1 : 2;
    for (let k = 0; k < n; k++) { const p = P[Math.floor(rnd() * P.length)], amt = p[2][Math.floor(rnd() * p[2].length)]; s.tx.push({ id: 't' + (i++), date: d, acct: p[0], type: 'out', amt, cat: p[1], to: '', memo: p[3], u: t0 }); }
    d = addD(d, 1);
  }
  const gr = { a6: [1.018, .996, 1.024], a7: [1.031, .992, 1.02], a8: [.988, 1.015, 1.012] }, base = { a6: 8400000, a7: 4600000, a8: 2700000 };
  let j = 0;
  for (let m = ym(start); m < ym(today); m = addM(m, 1), j++) for (const id of Object.keys(gr)) { const c = id === 'a6' ? 500000 : 0; base[id] = Math.round((base[id] + c) * gr[id][j % 3]); s.val[`${id}|${m}`] = { v: base[id], u: t0 }; }
  return s;
}



const loadDemo = cb => cb.load(demoState(cb));
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function run() {
  const w = f.contentWindow, d = w.document, cb = w.__cb, A = cb.ACT;
  const err = () => d.documentElement.getAttribute('data-err');
  try {
    loadDemo(cb);
    if (mode === 'shot') { await shots(w, d, cb, A); return; }
    // calc
    ok(cb.calc('18600÷3') === 6200, 'calc 18600÷3');
    ok(cb.calc('1000+2×3') === 1006, 'calc precedence');
    ok(cb.calc('5−') === 5, 'calc trailing op');
    ok(cb.calc('1÷0') === null, 'calc div0');
    ok(cb.calc('abc') === null, 'calc invalid');
    // views render without error
    for (const t of ['dash', 'input', 'accts', 'invest', 'set']) { A.tab({ v: t }); ok(!err() && d.querySelector('#grid'), 'render ' + t); }
    for (const st of ['acct', 'cat', 'rec', 'base']) { A.setTab({ v: st }); ok(!err(), 'settings ' + st); }
    A.gear({}); ok(d.querySelector('#modal-root.on .tile') && d.querySelector('.mbase'), 'gear panel opens'); A.gearGo({ v: 'openBase' }); ok(!d.querySelector('#modal-root.on') && cb.U.tab === 'set' && !err(), 'gear -> 기본값 설정'); A.setDone({}); ok(cb.U.tab !== 'set', 'setDone returns');
    ok(![...d.querySelectorAll('.tabs .tab')].some(x => x.textContent === '설정') && !d.querySelector('.qbar .go'), 'no 설정 tab, no 추가 button');
    A.gear({}); ok(!d.querySelector('[data-v="demo"]') && !d.querySelector('[data-v="restoreHidden"]') && d.querySelector('.gear svg'), 'no demo/hidden tiles, svg gear'); A.gearClose({});
    A.openBase({}); ok([...d.querySelectorAll('.tb .t')].some(x => x.textContent === '기타'), 'base tab named 기타'); A.setDone({});
    A.tab({ v: 'accts' });
    for (const a of cb.S.accounts) { A.detail({ v: a.id }); ok(!err() && d.querySelector('.acard'), 'detail ' + a.type + ' ' + a.name); }
    A.back({});
    // ledger: prepaid auto rows & balances
    const L = cb.led(), chg = L.filter(r => r.auto === 'chg'), cbk = L.filter(r => r.auto === 'cb'), rec = L.filter(r => r.auto === 'rec');
    ok(chg.length > 0, `prepaid charges generated (${chg.length})`);
    ok(cbk.length > 0, `cashback generated (${cbk.length})`);
    ok(rec.length > 0, `recurring generated (${rec.length})`);
    // prepaid balance never ends below threshold after a spend+charge
    { const a = cb.S.accounts.find(x => x.type === 'prepaid'); let b = +a.start, bad = 0; for (const r of L) { if (r.date < cb.S.settings.start) continue; if (r.acct === a.id || r.to === a.id) { b += (r.type === 'out' ? -r.amt : r.type === 'in' ? r.amt : (r.to === a.id ? r.amt : -r.amt)); } if (r.auto === 'cb' && r.acct === a.id && b <= a.th) bad++; if (b < 0) bad++; } ok(bad === 0, 'prepaid never negative, above threshold after charge'); ok(Math.abs(b - cb.balAt(a.id, '9999-12-31')) < 1, 'prepaid running == balAt'); }
    // groups total equals sum of accounts
    { const g = cb.groups(cb.util.TODAY()); ok(Math.abs(g.total - (g.cash + g.invest + g.foreign)) < 1, 'group total'); }
    // new row flow
    A.tab({ v: 'input' });
    const n0 = cb.S.tx.length;
    A.newRow({}); ok(d.querySelector('#sheet-root.on .pad'), 'keypad opened');
    for (const k of ['1', '8', '6', '0', '0', '÷', '3']) A.kp({ k });
    ok(d.querySelector('#kpr').textContent === '6,200', 'keypad result ' + d.querySelector('#kpr').textContent);
    A.kpGo({ d: 'next' }); ok(d.querySelector('#sheet-root.on .chips'), 'category sheet after keypad');
    const t = cb.S.tx[cb.S.tx.length - 1]; ok(t.amt === 6200 && t.ex, 'amount saved with expression');
    A.setCat({ id: t.id, v: '커피·디저트' }); ok(cb.S.tx.find(x => x.id === t.id).cat === '커피·디저트', 'category saved');
    ok(cb.S.tx.length === n0 + 1, 'one row added');
    // 실제 화면 클릭: 줄에 붙은 클릭 정보 + 칸의 열 이름
    { A.close({}); const td = d.querySelector('#grid tr[data-a="cell"] td[data-k="cat"]'); td.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
      ok(d.querySelector('#sheet-root.on .chips') || d.querySelector('#sheet-root.on .alist') || d.querySelector('#sheet-root.on [data-a="autoAmt"]'), 'tap a cell opens its editor'); A.close({});
      ok(!d.querySelector('#grid td.rn[data-a]'), 'row number has no menu'); }
    // undo/redo
    A.undo({}); ok(!cb.S.tx.find(x => x.id === t.id)?.cat, 'undo category'); A.redo({}); ok(cb.S.tx.find(x => x.id === t.id).cat === '커피·디저트', 'redo category');
    // account filter + quick
    const card = cb.S.accounts.find(a => a.type === 'card');
    cb.U.acct = card.id; cb.render(); ok(!err() && !d.querySelector('.banner') && /결제 예정|잔액/.test(d.querySelector('.stat .l').textContent), 'no banner, balance in status bar');
    ok(!d.querySelector('.quickbar'), 'no recent-entry chips under the table');
    A.flt({}); A.fltSet({ k: 't', v: 'out' }); ok(!err(), 'filter sheet'); A.fltReset({}); A.close({});
    A.search({}); d.querySelector('#qIn').value = '카페'; A.qSet({}); ok(!err() && cb.U.q === '카페', 'search'); A.search({}); A.qSet({ clear: 1 });
    // move row + type change
    A.newRow({}); A.close({}); const t2 = cb.S.tx[cb.S.tx.length - 1];
    A.setType({ id: t2.id, v: 'move' }); ok(d.querySelector('#sheet-root.on .pad'), 'move -> keypad (amt 0)'); A.close({});
    // row sheet + delete
    A.delTx({ id: t2.id }); ok(!cb.S.tx.find(x => x.id === t2.id) && cb.S.del[t2.id], 'delete with tombstone');
    // auto row sheet + override
    const ar = cb.led().find(r => r.auto === 'chg'); A.cell({ id: ar.id, k: 'amt' }); ok(d.querySelector('#sheet-root.on [data-a="autoAmt"]'), 'auto row sheet'); A.autoAmt({}); A.kp({ k: 'C' }); for (const k of ['4', '0', '0', '0', '0']) A.kp({ k }); A.kpGo({ d: 'next' }); ok(cb.led().find(r => r.id === ar.id)?.amt === 40000, 'auto row amount override');
    // forms
    cb.U.tab = 'set'; cb.render();
    for (const a of cb.S.accounts) { A.acctEdit({ id: a.id }); ok(!err() && d.querySelector('#fName'), 'acctForm ' + a.type); }
    A.fType({ v: 'prepaid' }); ok(d.querySelector('#fPrev')?.textContent.includes('미리보기'), 'prepaid preview'); A.close({});
    A.acctNew({}); d.querySelector('#fName').value = '테스트통장'; d.querySelector('#fStart').value = '12,000'; A.acctSave({}); ok(cb.S.accounts.some(a => a.name === '테스트통장' && a.start === 12000), 'account create');
    A.recNew({}); ok(!err(), 'recForm'); A.recSave({}); ok(true, 'rec validation toast');
    A.close({}); A.catNew({ kind: 'exp' }); d.querySelector('#cNm').value = '반려동물'; A.cKind({ v: 'inc' }); ok(d.querySelector('#cNm').value === '반려동물', 'cat kind keeps name'); A.catSave({}); ok(cb.S.cats.some(c => c.n === '반려동물' && c.k === 'inc'), 'cat create');
    // invest val
    const isa = cb.S.accounts.find(a => a.isa); const m = new Date().toISOString().slice(0, 7);
    A.val({ id: isa.id, m }); for (const k of ['9', '9', '9', '9', '9', '9', '9', '9']) A.kp({ k }); A.kpGo({ d: 'next' }); ok(cb.invSeries(isa).find(x => x.m === m)?.ent === 99999999, 'invest value entry');
    // merge
    const s1 = JSON.parse(JSON.stringify(cb.S)), s2 = JSON.parse(JSON.stringify(cb.S));
    s1.tx.push({ id: 'x1', date: '2026-10-01', acct: card.id, type: 'out', amt: 1, cat: '기타', u: Date.now() + 5 });
    s2.tx.push({ id: 'x2', date: '2026-10-01', acct: card.id, type: 'out', amt: 2, cat: '기타', u: Date.now() + 5 });
    s2.tx = s2.tx.filter(x => x.id !== 't0'); s2.del.t0 = Date.now() + 9;
    const mg = cb.mergeState(s1, s2); ok(mg.tx.some(x => x.id === 'x1') && mg.tx.some(x => x.id === 'x2') && !mg.tx.some(x => x.id === 't0'), 'merge union + tombstone');
    // CSV import (user's sheet format)
    const setCsv = cb.parseCsv('설정\n,,\n월급일,1,\n"ISA 연 납입한도","20,000,000",\n시작일,2026-09-30,\n,,\n계좌,종류,시작 잔액,만기일 / 통화,,,카테고리,구분\nok 저축은행,입출금,"500,700",,,,식비·생활,지출\n동백전,입출금,"92,220",,,,반찬,지출\nISA,투자,"10,077,347",,,,기타수입,수입\n해외 자산,종류,보유 외화 금액,통화,현재 환율 (자동),원화 금액\n엔화,해외,"115,801.00",JPY,8.58,"993,471"\n이름,구분,금액,매월 날짜,빠지는 계좌,받는 계좌,카테고리,시작일,종료일 (선택)\napple 뮤직,출금,"8,900",30일,ok 저축은행,,구독료,2026-09-30,\n');
    const inCsv = cb.parseCsv('날짜,계좌,구분,금액,카테고리,받는 계좌,메모\n2026-09-30,동백전,출금,"5,400",커피·디저트,,\n2026-10-01,ok 저축은행,내 계좌로 이동,"1,000",,동백전,"메모, 쉼표"\n');
    const before = cb.S.accounts.length; const rep = cb.importCsv([inCsv, setCsv]);
    ok(rep.some(x => x.includes('거래 2건')) && rep.some(x => x.includes('계좌 4개')) && rep.some(x => x.includes('정기 결제 1건')), 'csv import ' + rep.join(' / '));
    ok(cb.S.tx.some(x => x.memo === '메모, 쉼표' && x.type === 'move'), 'csv quoted comma + move');
    ok(cb.S.cats.some(c => c.n === '반찬'), 'csv categories'); void before;
    cb.render(); ok(!err(), 'render after import');
    { const q = cb.parseQuick, nm = id => cb.S.accounts.find(a => a.id === id)?.name, td = new Date(), y = new Date(td.getFullYear(), td.getMonth(), td.getDate() - 1);
      const yd = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      cb.U.acct = null;
      let o = q('커피 4500'); ok(o.amt === 4500 && o.type === 'out' && o.cat === '커피·디저트' && o.memo === '커피', 'quick: 커피 4500');
      o = q('체크카드 점심 9000'); ok(nm(o.acct) === '체크카드' && o.cat === '식비·생활' && o.amt === 9000, 'quick: account + keyword');
      o = q('+2850000 월급 급여통장'); ok(o.type === 'in' && nm(o.acct) === '급여통장' && o.cat === '월급', 'quick: income ' + JSON.stringify(o));
      o = q('급여통장 → ISA 500000'); ok(o.type === 'move' && nm(o.acct) === '급여통장' && nm(o.to) === 'ISA' && o.amt === 500000, 'quick: move');
      o = q('어제 버스 1500'); ok(o.date === yd && o.cat === '교통', 'quick: yesterday ' + o.date);
      o = q('18600/3 저녁'); ok(o.amt === 6200 && o.ex, 'quick: expression');
      o = q('1.5만 장보기'); ok(o.amt === 15000 && o.cat === '식비·생활', 'quick: 1.5만');
      o = q('회사 앞 카페 5400'); ok(o.cat === '커피·디저트' && o.memo === '회사 앞 카페', 'quick: history/keyword memo');
      cb.U.tab = 'input'; cb.render(); const n0 = cb.S.tx.length; d.querySelector('#qeIn').value = '동백전 커피 3800'; A.qadd({});
      const last = cb.S.tx[cb.S.tx.length - 1]; ok(cb.S.tx.length === n0 + 1 && nm(last.acct) === '동백전' && last.amt === 3800 && last.cat === '커피·디저트', 'quick: add row');
      ok(cb.U.acct === last.acct, 'quick: all-accounts view switches to that account');
      o = q('동백 커피 3000'); ok(nm(o.acct) === '동백전' && o.given && o.memo === '커피', 'quick: partial account name');
      o = q('급여 → ISA 1000'); ok(o.type === 'move' && nm(o.acct) === '급여통장' && nm(o.to) === 'ISA', 'quick: partial move');
      cb.U.acct = null; cb.render(); const n1 = cb.S.tx.length; d.querySelector('#qeIn').value = '점심 9000'; A.qadd({});
      ok(d.querySelector('#sheet-root.on .alist') && cb.S.tx.length === n1, 'quick: no account -> picker');
      const card = cb.S.accounts.find(a => a.type === 'card'); A.pickA({ v: card.id });
      ok(cb.S.tx.length === n1 + 1 && cb.S.tx[cb.S.tx.length - 1].acct === card.id && cb.U.acct === card.id, 'quick: picked account + switched');
      ok(!d.querySelector('.fx'), 'no formula bar'); }
    // 날짜 칸
    { cb.U.acct = null; cb.U.month = new Date().toISOString().slice(0, 7); A.tab({ v: 'input' });
      const dd = d.querySelector('#qeDate'), td = new Date(), tl = `${td.getMonth() + 1}/${String(td.getDate()).padStart(2, '0')}`;
      ok(dd && dd.value === tl, 'date box defaults to today ' + dd?.value);
      ok(!d.querySelector('.quickbar .nr'), 'no new-row button');
      const card = cb.S.accounts.find(a => a.type === 'card'), ymd0 = `${td.getFullYear()}-${String(td.getMonth() + 1).padStart(2, '0')}`;
      dd.value = '3'; d.querySelector('#qeIn').value = '체크카드 커피 4100'; A.qadd({});
      let last = cb.S.tx[cb.S.tx.length - 1]; ok(last.amt === 4100 && last.date === ymd0 + '-03', 'date box day only -> ' + last.date);
      const dd2 = d.querySelector('#qeDate'); ok(dd2.value === tl, 'date box resets to today');
      dd2.value = ''; d.querySelector('#qeIn').value = '커피 4200'; A.qadd({}); last = cb.S.tx[cb.S.tx.length - 1]; ok(last.amt === 4200 && last.date === `${ymd0}-${String(td.getDate()).padStart(2, '0')}`, 'empty date box -> today');
      d.querySelector('#qeDate').value = '99/99'; d.querySelector('#qeIn').value = '커피 4300'; const n2 = cb.S.tx.length; A.qadd({}); ok(cb.S.tx.length === n2, 'bad date rejected');
      d.querySelector('#qeDate').value = '1'; d.querySelector('#qeIn').value = '어제 커피 4400'; A.qadd({}); last = cb.S.tx[cb.S.tx.length - 1]; const yy = new Date(td.getFullYear(), td.getMonth(), td.getDate() - 1);
      ok(last.amt === 4400 && last.date === `${yy.getFullYear()}-${String(yy.getMonth() + 1).padStart(2, '0')}-${String(yy.getDate()).padStart(2, '0')}`, 'text date word overrides date box');
      ok([...d.querySelectorAll('.tabs .tab')].some(x => x.textContent === '투자'), 'tab renamed 투자'); void tl; void card; }
    // 지난달 결산 카드
    { cb.U.recapSeen = null; cb.U.acct = null; cb.U.flt = { p: 'month', t: 'all', cats: [] }; cb.U.month = new Date().toISOString().slice(0, 7); A.tab({ v: 'input' });
      ok(d.querySelector('.recap'), 'recap card shown'); const pm = d.querySelector('[data-a="recapClose"]').dataset.m; A.recapClose({ m: pm }); ok(!d.querySelector('.recap'), 'recap card dismissed'); }
    // 오래된 거래 정리: 잔액·총자산 유지
    loadDemo(cb);
    { const T = (() => { const x = new Date(); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; })();
      const before = cb.S.accounts.map(a => [a.id, cb.valueAt(a, T)]), tot0 = cb.groups(T).total;
      const M = (() => { const x = new Date(); const y = new Date(x.getFullYear(), x.getMonth() - 2, 1); return `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}`; })();
      const exp0 = cb.mstats(M).exp, n0 = cb.S.tx.length, isa = cb.S.accounts.find(a => a.isa), prin0 = cb.invSeries(isa).slice(-1)[0].prin;
      cb.doClose(M);
      ok(before.every(([id, v]) => Math.abs(cb.valueAt(cb.S.accounts.find(a => a.id === id), T) - v) < 1), 'close: every account balance unchanged');
      ok(Math.abs(cb.groups(T).total - tot0) < 1, 'close: total unchanged');
      ok(cb.S.tx.length < n0 && cb.S.arch[M] && cb.mstats(M).exp === exp0 && cb.mstats(M).arch, 'close: archived summary kept ' + JSON.stringify({ less: cb.S.tx.length < n0, arch: !!cb.S.arch[M], exp0, exp1: cb.mstats(M).exp, flag: cb.mstats(M).arch, M, start: cb.S.settings.start }));
      ok(Math.abs(cb.invSeries(isa).slice(-1)[0].prin - prin0) < 1, 'close: invest principal kept');
      cb.U.month = M; A.tab({ v: 'dash' }); ok(!err() && d.querySelector('.hero'), 'close: archived month on dashboard');
      A.tab({ v: 'accts' }); ok(!err() && cb.U.month >= cb.S.settings.start.slice(0, 7), 'close: other tabs jump to open month'); }

    // 만원 단위: 1만 원 미만은 원 단위로
    cb.U.unit = 'man'; ok(cb.fmtU(4500) === '4,500' && cb.fmtU(25000) === '2.5만', 'fmtU small amounts ' + cb.fmtU(4500)); cb.U.unit = 'won';
    for (const tab of ['dash', 'input', 'accts', 'invest']) { A.tab({ v: tab }); ok(d.querySelector('.app .unit') && !d.querySelector('.tb [data-a="unit"]'), 'unit button in app bar on ' + tab); }
    A.unit({}); A.tab({ v: 'input' }); ok(cb.U.unit === 'man' && d.querySelector('.app .unit sup')?.textContent === '만', 'unit persists across tabs'); A.unit({});
    // 카테고리 예산
    loadDemo(cb);
    { const c = cb.S.cats.find(x => x.n === '식비·생활'); A.catEdit({ id: c.id }); d.querySelector('#cBud').value = '100,000'; A.catSave({});
      ok(cb.S.cats.find(x => x.n === '식비·생활').b === 100000, 'budget saved'); cb.U.month = cb.util.TODAY().slice(0, 7); A.tab({ v: 'dash' });
      ok([...d.querySelectorAll('.sec td')].some(x => x.textContent.startsWith('예산')) && !err(), 'budget section on dashboard'); }
    // 투자 평가 입력 전 표시
    ok(d.querySelector('#grid').textContent.includes('입력 전'), 'invest pending shown on dashboard');
    // 미분류 정리
    { const st = JSON.parse(JSON.stringify(cb.S)); st.tx.filter(x => x.type === 'out').slice(-3).forEach(x => { x.cat = ''; }); cb.load(st);
      const n = cb.uncatQueue().length; A.fixUncat({}); ok(n >= 3 && d.querySelector('#sheet-root.on .uq'), 'uncat sheet opens');
      const v = d.querySelector('[data-a="uncatSet"]').dataset.v; A.uncatSet({ i: 0, v }); ok(cb.uncatQueue().length === n - 1 && d.querySelector('#sheet-root.on .uq'), 'uncat assign + next'); A.close({}); }
    // 앱 잠금
    { A.pinMenu({}); for (const k of '1234') await A.pinKey({ k }); for (const k of '1234') await A.pinKey({ k });
      ok(cb.pinGet() && !d.querySelector('#lock.on'), 'pin set');
      cb.showLock('unlock'); for (const k of '0000') await A.pinKey({ k }); ok(d.querySelector('#lock.on'), 'wrong pin stays locked');
      for (const k of '1234') await A.pinKey({ k }); ok(!d.querySelector('#lock.on'), 'pin unlock');
      A.pinChange({}); for (const k of '1234') await A.pinKey({ k }); for (const k of '5678') await A.pinKey({ k }); for (const k of '5678') await A.pinKey({ k });
      cb.showLock('unlock'); for (const k of '1234') await A.pinKey({ k }); ok(d.querySelector('#lock.on'), 'old pin rejected after change');
      for (const k of '5678') await A.pinKey({ k }); ok(!d.querySelector('#lock.on'), 'new pin works');
      A.pinOff({}); for (const k of '5678') await A.pinKey({ k }); ok(!cb.pinGet(), 'pin off'); }
    // 화면 글자에 그림 이모지가 없는지
    { A.tab({ v: 'input' }); let txt = d.getElementById('app').innerText; A.gear({}); txt += d.getElementById('modal-root').innerText; A.gearClose({});
      const m = txt.match(/[\u{1F300}-\u{1FAFF}⚡⚠]/u); ok(!m, 'no emoji in app chrome ' + (m ? m[0] : '')); }
    // 처음 안내 · 도움말 · 첫 팁
    { A.reset({}); A.okSheet({}); A.startNew({}); ok(d.querySelector('#modal-root.on .guide') && d.querySelector('.guide .himg'), 'guide opens on start');
      for (let i = 0; i < cb.GUIDE.length; i++) A.guideNext({ i });
      ok(!d.querySelector('#modal-root.on') && d.querySelector('#sheet-root.on #fName'), 'guide ends at account form'); A.close({});
      A.help({}); ok(d.querySelectorAll('#modal-root.on details').length === cb.HELP.length && d.querySelector('.hex code'), 'help opens with all topics'); A.gearClose({});
      loadDemo(cb); A.tab({ v: 'input' }); ok(d.querySelector('.tipbar'), 'first-visit tip shown'); A.tipClose({}); ok(!d.querySelector('.tipbar'), 'tip dismissed');
      const txt = cb.GUIDE.map(g => g.t + g.p).join('') + cb.HELP.map(h => h.t + h.p.join('')).join('');
      ok(!/[\u{1F300}-\u{1FAFF}⚡⚠✨]/u.test(txt) && !/!/.test(txt), 'help copy plain (no emoji, no exclamation)'); }
    // 넓은 화면 (아이패드·컴퓨터)
    { loadDemo(cb); const wait = () => new Promise(r => setTimeout(r, 300)); f.style.width = '1200px'; await wait();
      const ev = k => d.body.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true }));
      A.tab({ v: 'dash' }); ok(d.querySelector('html.wide .stabs') && !d.querySelector('.side') && !d.querySelector('.tabs') && d.querySelectorAll('#grid table.sh').length === 1 && d.querySelector('#grid td.gap') && d.querySelector('#grid td.xsec'), 'wide: one-sheet dash with blocks');
      ok([...d.querySelectorAll('#grid thead th')].slice(1).map(x => x.textContent).join('') === 'ABCDEFG', 'dash columns A to G in one sheet');
      A.tab({ v: 'accts' }); ok(![...d.querySelectorAll('#grid thead th')].slice(1).some(x => !x.textContent), 'every column has a letter'); A.tab({ v: 'dash' });
      cb.U.acct = null; A.tab({ v: 'input' }); ok([...d.querySelectorAll('#grid tr.frz td')].some(x => x.textContent === '메모'), 'wide: memo column');
      cb.U.acct = null; A.tab({ v: 'input' }); cb.U.sel = null; ev('ArrowDown'); ok(cb.U.sel && cb.U.sel.k === 'amt', 'keys: arrow selects a cell');
      ev('ArrowRight'); ok(cb.U.sel.k === 'cat', 'keys: arrow moves right');
      A.newRow({}); ev('1'); ev('2'); ev('*'); ev('3'); ok(d.querySelector('#kpr')?.textContent === '36', 'keys: typing into amount pad'); A.close({});
      cb.U.sel = null; ev('1'); ok(cb.U.tab === 'dash', 'keys: number switches tab');
      A.tab({ v: 'accts' }); ok(d.querySelectorAll('#grid thead th').length > 4 && d.querySelector('#grid tbody tr:last-child td.rn'), 'wide: filler columns and rows');
      cb.U.zoom = 100; A.zoom({ k: 1 }); ok(cb.U.zoom === 110 && d.querySelector('.zm .zp').textContent === '110%' && d.querySelector('#zoomS').value === '110', 'zoom in');
      A.zoomDlg({}); d.querySelector('#zc').value = '135'; d.querySelector('input[name="zr"][value="c"]').checked = true; A.zoomOk({}); ok(cb.U.zoom === 135 && !d.querySelector('#sheet-root.on'), 'zoom dialog custom value');
      cb.U.zoom = 100; cb.render(); ok(d.querySelectorAll('.stabs .st').length === 4 && d.querySelector('.stabs .st.on'), 'sheet tabs at bottom'); A.tabStep({ k: 1 }); ok(cb.U.tab === 'invest', 'sheet tab step');
      A.tab({ v: 'input' }); ev('ArrowDown'); ok(/^[A-F]\d+$/.test(d.querySelector('.nbox')?.textContent || '') && d.querySelector('#grid th.on'), 'name box + column header highlight');
      f.style.width = '390px'; await wait(); ok(!d.querySelector('html.wide') && d.querySelector('.tabs') && !err(), 'narrow layout again'); }
    // 빠른 입력: 다른 계좌 화면에서 계좌 이름(일부)을 적으면 그 계좌로, 계좌 이름은 메모에 안 들어감
    { loadDemo(cb); const card = cb.S.accounts.find(x => x.type === 'card'); cb.U.acct = card.id; cb.U.flt = { p: 'month', t: 'all', cats: [] }; cb.U.month = new Date().toISOString().slice(0, 7); A.tab({ v: 'input' });
      const q = d.querySelector('#qeIn'); q.value = '통장 커피 4500'; A.qadd({}); const t1 = cb.S.tx[cb.S.tx.length - 1];
      ok(t1.acct !== card.id && /통장/.test(cb.S.accounts.find(x => x.id === t1.acct).name) && t1.memo === '커피' && cb.U.acct === t1.acct, 'quick entry: ambiguous partial account goes to that account, not memo');
      d.querySelector('#qeIn').value = '체크카드 점심 9000'; A.qadd({}); const t2 = cb.S.tx[cb.S.tx.length - 1]; ok(t2.acct === card.id && t2.memo === '점심' && cb.U.acct === card.id, 'quick entry: other account name switches account');
      const P = x => cb.parseQuick(x), nm = id => cb.S.accounts.find(a => a.id === id)?.name;
      { const o = P('체크카드에서 커피 4500'); ok(nm(o.acct) === '체크카드' && o.memo === '커피', 'particle after account name is dropped'); }
      { const o = P('급여통장에서 생활비통장으로 50000'); ok(o.type === 'move' && nm(o.acct) === '급여통장' && nm(o.to) === '생활비통장' && !o.memo, 'spoken transfer A에서 B로'); }
      { const o = P('급여통장 생활비통장 이체 50000'); ok(o.type === 'move' && nm(o.to) === '생활비통장', 'transfer with 이체 keyword'); }
      { cb.U.acct = cb.S.accounts.find(a => a.name === '급여통장').id; const o = P('생활비통장으로 5만 이체'); ok(o.type === 'move' && nm(o.acct) === '급여통장' && nm(o.to) === '생활비통장' && o.amt === 50000, 'transfer from the account being viewed'); cb.U.acct = card.id; }
      { const o = P('동백 4500 커피'); ok(nm(o.acct) === '동백전' && o.amt === 4500 && o.memo === '커피', 'user style: 계좌일부 금액 메모'); }
      { const o = P('동백 이동 생활비 300000'); ok(o.type === 'move' && nm(o.acct) === '동백전' && nm(o.to) === '생활비통장' && o.amt === 300000 && !o.memo, 'user style: A 이동 B 금액'); }
      { const o = P('동백 송금 생활비 1만'); ok(o.type === 'move' && nm(o.to) === '생활비통장' && o.amt === 10000, 'user style: 송금 keyword'); }
      { const keep = cb.U.acct; cb.U.acct = null; const o = P('생활비 이체 20000'); ok(o.type === 'move' && nm(o.to) === '생활비통장' && !o.given && !o.memo, 'all-accounts view: one account + 이체 asks for sender'); cb.U.acct = keep; }
      { const o = P('월급 2850000'); ok(o.type === 'in' && o.amt === 2850000, 'income word -> 입금 without +'); }
      { const o = P('국민 입금 50000'); ok(o.type === 'in' && !/입금/.test(o.memo), 'type word 입금 -> 입금, not memo'); }
      { const o = P('환불 12000 쇼핑'); ok(o.type === 'in', 'refund -> 입금'); }
      { const o = P('커피 4500'); ok(o.type === 'out', 'plain spending stays 출금'); }
      { const o = P('용돈 30000'); ok(o.type === 'out', 'ambiguous 용돈 no longer forces 입금'); }
      { const o = P('동벡 4500 커피'); ok(nm(o.acct) === '동백전' && o.memo === '커피' && o.fixed.length === 1, 'typo in account name fixed'); }
      { const o = P('체크카듸 점심 9000'); ok(nm(o.acct) === '체크카드' && o.memo === '점심', 'typo in longer account name fixed'); }
      { const o = P('커퓌 4500'); ok(o.memo === '커피' && o.cat === '커피·디저트', 'typo in common word fixed'); }
      { const o = P('월긊 2850000'); ok(o.type === 'in', 'typo in income word fixed'); }
      { const o = P('졈심 9000'); ok(o.memo === '졈심' && !o.fixed.length, 'memo words are not corrected'); }
      { const o = P('급여 3000000'); ok(nm(o.acct) === '급여통장' && o.type === 'in' && o.cat === '월급', 'income word that is also part of an account name: that account + 입금'); }
      { const o = P('급여통장 커피 4500'); ok(nm(o.acct) === '급여통장' && o.type === 'out', 'full account name with 급여 stays 출금'); }
      { const o = P('피자 20000'); ok(o.type === 'out' && o.memo === '피자' && !o.fixed.length, 'common word 피자 not turned into 이자'); }
      { const o = P('신발 30000'); ok(o.memo === '신발' && !o.fixed.length, 'unrelated word left alone'); }
      { const o = P('동네 카페 4000'); ok(o.memo === '동네 카페' && !o.fixed.length, 'real words not corrected'); }
      { const o = P('이자카야 30000'); ok(o.type === 'out', 'word containing 이자 stays 출금'); }
      { const o = P('수입맥주 12000'); ok(o.type === 'out', 'word containing 수입 stays 출금'); }

      { const o = P('학교로 택시 5000'); ok(o.type === 'out' && o.memo === '학교로 택시', 'non-account word with 로 stays memo'); }
      { const n0 = cb.S.tx.length, tr = d.querySelector(`#grid tr[data-id="${t2.id}"]`), r = tr.cells[2].getBoundingClientRect();
        const pe = (type, x) => tr.cells[2].dispatchEvent(new w.PointerEvent(type, { bubbles: true, clientX: x, clientY: r.top + 5, pointerId: 1, button: 0 }));
        pe('pointerdown', r.left + 60); pe('pointermove', r.left + 30); pe('pointermove', r.left - 40); pe('pointerup', r.left - 40);
        const btn = d.querySelector('#grid .swdel'); ok(btn && /translateX\(-/.test(tr.cells[2].style.transform) && !d.querySelector('.tb .t.del'), 'swipe left reveals delete button (no toolbar button)');
        btn.click(); ok(cb.S.tx.length === n0 - 1 && !cb.S.tx.some(x => x.id === t2.id), 'swipe delete removes that row'); } }
    // 줄이 많을 때 접어 두기
    { loadDemo(cb); const st = JSON.parse(JSON.stringify(cb.S)), ac = st.accounts[1].id;
      for (let i = 0; i < 350; i++) st.tx.push({ id: 'm' + i, date: st.settings.start, acct: ac, type: 'out', amt: 100 + i, cat: '식비·생활', memo: 'x', u: 1 });
      cb.load(st); cb.U.acct = null; cb.U.sort = 'asc'; cb.U.flt = { p: 'all', t: 'all', cats: [] }; A.tab({ v: 'input' });
      const more = d.querySelector('#grid tr[data-a="moreRows"]'); ok(more && /더 보기/.test(more.textContent) && d.querySelectorAll('#grid tr[data-a="cell"]').length === 300, 'long list collapsed to 300 rows');
      A.moreRows({}); ok(!d.querySelector('#grid tr[data-a="moreRows"]') && d.querySelectorAll('#grid tr[data-a="cell"]').length > 300, 'more rows expands');
      cb.U.flt = { p: 'month', t: 'all', cats: [] }; A.tab({ v: 'dash' }); }
    // 충전식: 충전금 + 캐시백 따로
    { loadDemo(cb); const pp = cb.S.accounts.find(x => x.type === 'prepaid'), T = cb.util.TODAY(), m = T.slice(0, 7);
      const cbSum = cb.led().filter(r => r.auto === 'cb' && r.acct === pp.id && r.date <= T).reduce((x, r) => x + r.amt, 0);
      const [c0, k0] = cb.poolsAt(pp.id, T); ok(k0 === cbSum + (+pp.cbStart || 0) && c0 + k0 === cb.balAt(pp.id, T), 'prepaid: total = 충전금 + 캐시백, cashback kept separately');
      cb.U.acct = pp.id; A.tab({ v: 'input' }); ok([...d.querySelectorAll('#grid td .cbx')].some(x => /\+/.test(x.textContent)) && /충전 .* \+ 캐시백/.test(d.querySelector('.stat .l').textContent), 'prepaid balance shown as 충전금 + 캐시백');
      { const o = cb.parseQuick('동백 커피 4500 캐시백으로'); ok(o.cbUse === 'max' && o.type === 'out' && o.memo === '커피', 'quick entry: 캐시백으로 = use cashback (not income)'); }
      d.querySelector('#qeIn').value = '동백 커피 4500 캐시백으로'; A.qadd({}); const [, k1] = cb.poolsAt(pp.id, T);
      const used = cb.led().find(r => r.id === cb.S.tx[cb.S.tx.length - 1].id)._cbUse; ok(used > 0 && k1 < k0 + 450, 'payment marked 캐시백으로 uses cashback');
      const p2 = cb.S.accounts.find(x => x.type === 'prepaid'); p2.cbMode = 'first'; cb.load(JSON.parse(JSON.stringify(cb.S)));
      const [, kf] = cb.poolsAt(pp.id, T); ok(kf < k0, '결제 때 먼저 mode spends cashback automatically');
      A.adjust({ id: pp.id }); A.kp({ k: 'C' }); for (const k of String(cb.poolsAt(pp.id, T)[0] + 100)) A.kp({ k }); A.kpGo({ d: 'next' });
      ok(d.querySelector('#sheet-root.on #kpr'), 'prepaid adjust asks cashback next'); A.kp({ k: 'C' }); A.kp({ k: '0' }); A.kpGo({ d: 'next' });
      const [ca, ka] = cb.poolsAt(pp.id, T); ok(ka === 0 && cb.S.tx.filter(x => x.type === 'adj').length === 2, 'prepaid adjust sets 충전금 and 캐시백 separately'); }
    // 캐시백 사용 창 · 기본값 스위치
    { loadDemo(cb); const pp = cb.S.accounts.find(x => x.type === 'prepaid'), T = cb.util.TODAY();
      const pay = cb.led().filter(r => r.acct === pp.id && r.type === 'out' && !r.auto).pop();
      cb.U.acct = pp.id; A.tab({ v: 'input' }); A.cell({ id: pay.id, k: 'bal' }); ok(d.querySelector('#sheet-root.on #cbUseIn'), 'tap 충전+캐시백 cell opens cashback sheet');
      d.querySelector('#cbUseIn').value = '1000'; A.cbUseSet({ v: 'in' }); ok(cb.led().find(r => r.id === pay.id)._cbUse === 1000, 'use part of cashback on one payment');
      A.cell({ id: pay.id, k: 'bal' }); A.cbUseSet({ v: '' }); ok(!cb.led().find(r => r.id === pay.id)._cbUse, 'cashback use removed');
      const k0 = cb.poolsAt(pp.id, T)[1]; A.setCbAuto({}); ok(cb.S.settings.cbAuto && cb.poolsAt(pp.id, T)[1] < k0, 'default switch: cashback used on every payment');
      A.cell({ id: pay.id, k: 'bal' }); ok(d.querySelector('#sheet-root.on [data-a="cbUseSet"][data-v="none"]'), 'auto mode: can skip one payment'); A.cbUseSet({ v: 'none' }); ok(!cb.led().find(r => r.id === pay.id)._cbUse, 'auto mode: one payment skipped');
      A.setCbAuto({}); ok(!cb.S.settings.cbAuto, 'switch off'); }
    // 필터 창 안의 정렬
    { loadDemo(cb); cb.U.acct = null; cb.U.sort = 'asc'; A.tab({ v: 'input' }); ok(!d.querySelector('.tb [data-a="sort"]'), 'no separate sort button');
      A.flt({}); ok(d.querySelector('#sheet-root.on [data-a="sortSet"][data-v="desc"]'), 'filter sheet has 최신 순');
      A.sortSet({ v: 'desc' }); const ds = [...d.querySelectorAll('#grid tr[data-a="cell"]')].map(tr => cb.led().find(r => r.id === tr.dataset.id)?.date).filter(Boolean);
      ok(cb.U.sort === 'desc' && ds[0] >= ds[ds.length - 1] && d.querySelector('.tb [data-a="flt"].on'), 'newest first, filter button marked');
      A.fltReset({}); ok(cb.U.sort === 'asc', 'reset restores date order'); A.close({}); }
    // 오른쪽 클릭 메뉴 · 입력 창에 가리지 않기 · 계좌 화면 밀어서 돌아가기
    { await new Promise(r => setTimeout(r, 450)); // 앞 시험의 밀기 직후 클릭 무시 시간이 지나도록
loadDemo(cb); cb.U.acct = null; cb.U.sort = 'asc'; cb.U.flt = { p: 'month', t: 'all', cats: [] }; A.tab({ v: 'input' });
      const tr = d.querySelector('#grid tr[data-a="cell"]:not(.auto)'), id = tr.dataset.id, n0 = cb.S.tx.length;
      tr.cells[2].dispatchEvent(new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 300 }));
      ok(d.querySelector('#ctx .dan'), 'right-click opens row menu'); d.querySelector('#ctx .dan').click(); ok(cb.S.tx.length === n0 - 1 && !d.querySelector('#ctx'), 'right-click delete ' + [cb.S.tx.length, n0, !!d.querySelector('#ctx'), String(cb.S.tx.some(x => x.id === id))].join(','));
      const pm = (el, type, x) => el.dispatchEvent(new w.PointerEvent(type, { bubbles: true, clientX: x, clientY: 300, pointerId: 2, button: 0, pointerType: 'mouse' }));
      const tr2 = d.querySelector('#grid tr[data-a="cell"]:not(.auto)'); pm(tr2.cells[2], 'pointerdown', 200); pm(tr2.cells[2], 'pointermove', 100); pm(tr2.cells[2], 'pointerup', 100);
      ok(!d.querySelector('#grid .swdel'), 'mouse drag does not swipe-delete'); w.document.body.click();
      const rows = [...d.querySelectorAll('#grid tr[data-a="cell"]:not(.auto)')], last = rows[rows.length - 1];
      A.cell({ id: last.dataset.id, k: 'amt' }); await new Promise(r => setTimeout(r, 60));
      const tr3 = d.querySelector(`#grid tr[data-id="${last.dataset.id}"]`), bsTop = w.innerHeight - d.querySelector('#sheet-root .bs').offsetHeight;
      ok(tr3.getBoundingClientRect().bottom <= bsTop + 2, 'edited row stays visible above the sheet'); A.close({});
      const acc = cb.S.accounts.find(x => x.type === 'prepaid'); A.tab({ v: 'accts' });
      ok(/충전 .*캐시백/.test(d.querySelector(`#grid tr[data-v="${acc.id}"]`)?.textContent || ''), 'account list shows 충전 · 캐시백');
      A.detail({ v: acc.id }); ok(!/계좌별/.test(d.querySelector('.stat .l')?.textContent || ''), 'no small back link');
      const g = d.querySelector('#grid'), pt = (type, x) => g.dispatchEvent(new w.PointerEvent(type, { bubbles: true, clientX: x, clientY: 400, pointerId: 3, button: 0, pointerType: 'touch' }));
      pt('pointerdown', 40); pt('pointermove', 80); pt('pointermove', 260); pt('pointerup', 260); await new Promise(r => setTimeout(r, 260));
      ok(!cb.U.detail && cb.U.tab === 'accts', 'swipe right goes back to account list');
      A.detail({ v: acc.id }); A.tab({ v: 'accts' }); ok(!cb.U.detail, 'tapping 계좌별 again goes back'); }
    // 구분 칸 대신 금액 색 · 숫자판에서 출금/입금 바꾸기
    { loadDemo(cb); cb.U.acct = null; cb.U.flt = { p: 'month', t: 'all', cats: [] }; A.tab({ v: 'input' });
      ok(![...d.querySelectorAll('#grid tr.frz td')].some(x => x.textContent === '구분'), 'no 구분 column');
      const o = cb.S.tx.filter(x => x.type === 'out' && x.date.slice(0, 7) === cb.U.month).pop();
      ok(d.querySelector(`#grid tr[data-id="${o.id}"] td[data-k="amt"]`).classList.contains('amo'), 'expense amount red');
      A.cell({ id: o.id, k: 'amt' }); ok(d.querySelector('#sheet-root.on .kpt [data-v="in"]'), 'keypad has 출금/입금/이동');
      A.kpType({ id: o.id, v: 'in' }); ok(cb.S.tx.find(x => x.id === o.id).type === 'in' && d.querySelector('#sheet-root.on #kpr'), 'switch to 입금 keeps keypad open'); A.close({});
      ok(d.querySelector(`#grid tr[data-id="${o.id}"] td[data-k="amt"]`).classList.contains('ami'), 'income amount blue'); }
    // 잔액 칸은 항상 (전체 계좌도: 그 줄 계좌의 거래 후 잔액)
    { loadDemo(cb); cb.U.acct = null; cb.U.flt = { p: 'month', t: 'all', cats: [] }; cb.U.sort = 'asc'; A.tab({ v: 'input' });
      ok([...d.querySelectorAll('#grid tr.frz td')].some(x => x.textContent === '잔액') && !d.querySelector('.tb [data-a="bal"]'), 'balance column always shown, no toggle');
      const bk = cb.S.accounts.find(x => x.name === '생활비통장'), rows = [...d.querySelectorAll('#grid tr[data-a="cell"]')].filter(tr => cb.led().find(r => r.id === tr.dataset.id)?.acct === bk.id);
      const lastTr = rows[rows.length - 1], lastR = cb.led().find(r => r.id === lastTr.dataset.id);
      ok(+lastTr.querySelector('td[data-k="bal"]').textContent.replace(/[^\d-]/g, '') === cb.balAt(bk.id, cb.util.TODAY()), 'all-accounts row shows its account balance after that row');
      cb.U.acct = bk.id; A.tab({ v: 'input' }); ok([...d.querySelectorAll('#grid tr.frz td')].some(x => x.textContent === '잔액'), 'bank account view shows 잔액'); }
    // 계좌 색 고르기
    { loadDemo(cb); const bk = cb.S.accounts.find(x => x.name === '생활비통장'); A.acctEdit({ id: bk.id });
      ok(d.querySelectorAll('#sheet-root.on .swatches button').length === 17, 'account form has 16 colors + 기본');
      A.fColor({ v: '#E07B39' }); A.acctSave({}); ok(cb.S.accounts.find(x => x.id === bk.id).color === '#E07B39', 'account color saved');
      cb.U.acct = null; A.tab({ v: 'input' }); const chip = [...d.querySelectorAll('#grid .chip-a')].find(x => x.textContent.includes('생활비'));
      ok(chip && /E07B39/i.test(chip.getAttribute('style')) && /linear-gradient/.test(chip.getAttribute('style')), 'chosen color shows as highlighter');
      A.acctEdit({ id: bk.id }); A.fColor({ v: '' }); A.acctSave({}); ok(!cb.S.accounts.find(x => x.id === bk.id).color, 'back to type color'); }
    // 짧은 이름
    { const sn = cb.shortName; ok(sn('생활비통장') === '생활비' && sn('체크카드') === '체크카' && sn('동백전') === '동백전' && sn('KB 국민카드') === 'KB' && sn('국민 카드') === '국민' && sn('Toss') === 'Toss', 'short names: space first, else 3 letters');
      loadDemo(cb); cb.U.acct = null; A.tab({ v: 'input' }); ok([...d.querySelectorAll('#grid .chip-a')].some(x => x.textContent === '생활비' && x.title === '생활비통장'), 'mobile chip shows short name, full name on hover'); }
    // 휴대폰 전체 계좌: 충전식 잔액 두 줄
    { loadDemo(cb); cb.U.acct = null; A.tab({ v: 'input' }); ok(d.querySelector('#grid td[data-k="bal"] .bal2 .cbx'), 'all-accounts shows 충전금 and 캐시백 for prepaid'); }
    // 계좌를 고르면 머리글 줄이 그 계좌 색
    { loadDemo(cb); const st = JSON.parse(JSON.stringify(cb.S)); const bk = st.accounts.find(x => x.name === '생활비통장'); bk.color = '#B04FA0'; cb.load(st);
      cb.U.acct = bk.id; A.tab({ v: 'input' }); ok(/B04FA0/i.test(d.querySelector('#grid tr.frz td.h').getAttribute('style') || ''), 'header row uses account color');
      cb.U.acct = null; cb.render(); ok(!(d.querySelector('#grid tr.frz td.h').getAttribute('style') || '').includes('background'), 'all accounts keeps navy header'); }
    // 잔액 맞추기
    { loadDemo(cb); const bk = cb.S.accounts.find(x => x.name === '생활비통장'), m = cb.util.TODAY().slice(0, 7);
      const b0 = cb.balAt(bk.id, cb.util.TODAY()), st0 = cb.mstats(m);
      A.adjust({ id: bk.id }); A.kp({ k: 'C' }); for (const k of String(b0 - 300)) A.kp({ k }); A.kpGo({ d: 'next' });
      const adj = cb.S.tx[cb.S.tx.length - 1], st1 = cb.mstats(m);
      ok(adj.type === 'adj' && adj.amt === -300 && cb.balAt(bk.id, cb.util.TODAY()) === b0 - 300, 'adjust: balance matches the real amount');
      ok(st1.exp === st0.exp && st1.inc === st0.inc && !cb.uncatQueue().includes(adj.id), 'adjust: not counted in stats or uncategorized');
      cb.U.acct = bk.id; A.tab({ v: 'input' }); ok([...d.querySelectorAll('#grid td')].some(x => x.textContent === '잔액 조정') && !d.querySelector('#grid tr[data-id="' + adj.id + '"] .warn'), 'adjust row shown, not flagged');
      A.cell({ id: adj.id, k: 'cat' }); ok(d.querySelector('#sheet-root.on [data-a="adjAmt"]'), 'adjust row opens its own sheet'); A.close({});
      A.tab({ v: 'accts' }); A.detail({ v: bk.id }); ok(d.querySelector('.acard .aadj'), 'account card has 잔액 맞추기'); }
    // 캐시백: 거래마다 비율 바꾸기 · 없애기
    { loadDemo(cb); const pp = cb.S.accounts.find(x => x.type === 'prepaid'); const row = cb.led().find(r => r.auto === 'cb' && r.acct === pp.id);
      const b0 = cb.balAt(pp.id, cb.util.TODAY()); A.cell({ id: row.id, k: 'amt' }); ok(d.querySelector('#sheet-root.on #cbIn') && !d.querySelector('#sheet-root.on .chip'), 'cashback sheet: one % box, no rate buttons');
      d.querySelector('#cbIn').value = '5'; A.cbSave({}); const r2 = cb.led().find(r => r.id === row.id); ok(r2.pct === 5 && r2.memo === '캐시백 5%', 'cashback rate changed for one transaction');
      A.cell({ id: row.id, k: 'amt' }); A.cbNone({}); ok(!cb.led().some(r => r.id === row.id) && cb.balAt(pp.id, cb.util.TODAY()) < b0, 'cashback removed for one transaction');
      A.undo({}); ok(cb.led().some(r => r.id === row.id), 'undo brings cashback back'); }
    // 다른 사람이 처음 쓰는 경우: 자기 계좌·카테고리 이름으로도 인식·오타 수정
    { const s = cb.util.blankState(); s.settings = { start: cb.util.TODAY().slice(0, 8) + '01', u: 1 };
      const ac = (id, name, type) => ({ id, name, type, start: 0, u: 1 });
      s.accounts = [ac('w1', '우리은행', 'bank'), ac('h1', '하나카드', 'card'), ac('k1', '카카오페이', 'prepaid'), ac('m1', '월급통장', 'bank'), ac('e1', 'Toss', 'bank')];
      s.cats.push({ id: 'c1', n: '반려동물', k: 'exp', u: 1 }, { id: 'c2', n: '부업', k: 'inc', u: 1 });
      cb.load(s); cb.U.acct = null; A.tab({ v: 'input' }); const Q = x => cb.parseQuick(x), N = id => cb.S.accounts.find(a => a.id === id)?.name;
      ok(N(Q('하나카두 커피 4500').acct) === '하나카드', 'new user: typo in own account name');
      ok(Q('반려동믈 30000').cat === '반려동물', 'new user: typo in own category');
      ok(Q('부업 50000').type === 'in', 'new user: own income category -> 입금');
      { const o = Q('우리 이체 하나 300000'); ok(o.type === 'move' && N(o.acct) === '우리은행' && N(o.to) === '하나카드', 'new user: transfer by partial names'); }
      ok(N(Q('toss 점심 9000').acct) === 'Toss', 'new user: latin account name');
      ok(!err(), 'new user: no errors'); }
    // 파일끼리 맨 위 수준 이름이 겹치면 뒤 파일 전체가 실행되지 않음
    { const files = ['core', 'ui', 'views', 'quick', 'pages', 'extras', 'edit', 'data', 'boot'], seen = {}, dup = [];
      for (const f of files) { const s = await (await fetch(`../js/${f}.js`, { cache: 'no-store' })).text();
        for (const m of s.matchAll(/^(?:const|let|var|function|async function|class) ([A-Za-z_$][\w$]*)/gm)) { if (seen[m[1]]) dup.push(`${m[1]} (${seen[m[1]]}, ${f})`); else seen[m[1]] = f; } }
      ok(!dup.length, 'no duplicate top-level names across files ' + dup.join(', ')); }
    ok(localStorage.getItem('cellbook.v1') === REAL0, 'test never touches real data');
  } catch (e) { log.push('EXCEPTION ' + e.message + '\n' + e.stack); }
  if (err()) log.push('PAGE ERROR ' + err());
  if (d.documentElement.getAttribute('data-rej')) log.push('REJECTION ' + d.documentElement.getAttribute('data-rej'));
  out.textContent = log.join('\n'); f.style.display = 'none'; document.title = 'done';
}
function shotsSync(w, d, cb, A) {
  const s = shot || 'dash';
  const card = cb.S.accounts.find(a => a.type === 'card'), pp = cb.S.accounts.find(a => a.type === 'prepaid'), bank = cb.S.accounts.find(a => a.name === '급여통장'), isa = cb.S.accounts.find(a => a.isa);
  if (s === 'dash') A.tab({ v: 'dash' });
  if (s === 'unitman') { A.unit({}); A.tab({ v: 'dash' }); }
  if (s === 'dash2') { A.tab({ v: 'dash' }); d.querySelector('#grid').scrollTop = 700; }
  if (s === 'input') { A.tab({ v: 'input' }); cb.U.acct = null; cb.render(); d.querySelector('#grid').scrollTop = 9999; }
  if (s === 'inputCard') { A.tab({ v: 'input' }); cb.U.acct = card.id; cb.render(); d.querySelector('#grid').scrollTop = 9999; }
  if (s === 'inputPP') { A.tab({ v: 'input' }); cb.U.acct = pp.id; cb.render(); d.querySelector('#grid').scrollTop = 9999; }
  if (s === 'keypad') { A.tab({ v: 'input' }); cb.U.acct = card.id; cb.render(); A.newRow({}); for (const k of ['1', '8', '6', '0', '0', '÷', '3']) A.kp({ k }); }
  if (s === 'cat') { A.tab({ v: 'input' }); cb.U.acct = card.id; cb.render(); A.newRow({}); for (const k of ['6', '2', '0', '0']) A.kp({ k }); A.kpGo({ d: 'next' }); }
  if (s === 'pick') { A.tab({ v: 'input' }); cb.U.acct = card.id; cb.render(); A.pickPill({ m: 'filter' }); }
  if (s === 'filter') { A.tab({ v: 'input' }); cb.U.acct = null; cb.render(); A.flt({}); }
  if (s === 'accts') A.tab({ v: 'accts' });
  if (s === 'colors') { const st = JSON.parse(JSON.stringify(cb.S)); const cs = ['#E07B39', '#2F80ED', '#B04FA0', '#00A3C4']; st.accounts.slice(0, 4).forEach((x, i) => { x.color = cs[i]; }); cb.load(st); A.tab({ v: 'input' }); cb.U.acct = null; cb.render(); }
  if (s === 'acolor') { A.tab({ v: 'set' }); A.setTab({ v: 'acct' }); A.acctEdit({ id: bank.id }); A.fColor({ v: '#2F80ED' }); const b = d.querySelector('#sheet-root .bs'); b.scrollTop = b.scrollHeight; }
  if (s === 'kpt') { A.tab({ v: 'input' }); cb.U.acct = null; cb.render(); const r = cb.S.tx.filter(x => x.type === 'out').pop(); A.cell({ id: r.id, k: 'amt' }); }
  if (s === 'ctx') { A.tab({ v: 'input' }); cb.U.acct = null; cb.render(); const tr = d.querySelectorAll('#grid tr[data-a="cell"]:not(.auto)')[3]; const r = tr.cells[3].getBoundingClientRect(); tr.cells[3].dispatchEvent(new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.top + 10 })); }
  if (s === 'reveal') { A.tab({ v: 'input' }); cb.U.acct = null; cb.render(); const rows = d.querySelectorAll('#grid tr[data-a="cell"]:not(.auto)'); A.cell({ id: rows[rows.length - 1].dataset.id, k: 'amt' }); }
  if (s === 'cbs') { A.tab({ v: 'input' }); cb.U.acct = pp.id; cb.render(); const pay = cb.led().filter(r => r.acct === pp.id && r.type === 'out' && !r.auto).pop(); A.cell({ id: pay.id, k: 'bal' }); }
  if (s === 'setbase') { A.tab({ v: 'set' }); A.setTab({ v: 'base' }); }
  if (s === 'adj') { A.tab({ v: 'accts' }); A.detail({ v: bank.id }); A.adjust({ id: bank.id }); }
  if (s === 'swipehalf') { A.tab({ v: 'input' }); cb.U.acct = null; cb.render(); const tr = d.querySelectorAll('#grid tr[data-a="cell"]:not(.auto)')[2], r = tr.cells[2].getBoundingClientRect();
    const pe = (type, x) => tr.cells[2].dispatchEvent(new w.PointerEvent(type, { bubbles: true, clientX: x, clientY: r.top + 5, pointerId: 1, button: 0 }));
    pe('pointerdown', r.left + 80); pe('pointermove', r.left + 60); pe('pointermove', r.left + 50); }
  if (s === 'swipe') { A.tab({ v: 'input' }); cb.U.acct = null; cb.render(); const tr = d.querySelectorAll('#grid tr[data-a="cell"]:not(.auto)')[2], r = tr.cells[2].getBoundingClientRect();
    const pe = (type, x) => tr.cells[2].dispatchEvent(new w.PointerEvent(type, { bubbles: true, clientX: x, clientY: r.top + 5, pointerId: 1, button: 0 }));
    pe('pointerdown', r.left + 80); pe('pointermove', r.left + 50); pe('pointermove', r.left - 30); pe('pointerup', r.left - 30); }
  if (s === 'cb') { A.tab({ v: 'input' }); cb.U.acct = pp.id; cb.render(); const r = cb.led().filter(x => x.auto === 'cb' && x.acct === pp.id).pop(); A.cell({ id: r.id, k: 'amt' }); }
  if (s === 'sel' || s === 'zoom') { A.tab({ v: 'input' }); cb.U.acct = null; const t = cb.S.tx.filter(x => x.type === 'out').slice(-2)[0]; cb.U.sel = { id: t.id, k: 'amt' }; cb.render(); if (s === 'zoom') A.zoomDlg({}); }
  if (s === 'recap') { cb.U.recapSeen = null; cb.U.acct = null; A.tab({ v: 'input' }); }
  if (s === 'qe') { A.tab({ v: 'input' }); cb.U.acct = null; cb.render(); d.querySelector('#grid').scrollTop = 9999; const q = d.querySelector('#qeIn'); q.value = '체크카드 점심 9000'; q.dispatchEvent(new w.Event('input', { bubbles: true })); }
  if (s === 'dCard') { A.tab({ v: 'accts' }); A.detail({ v: card.id }); }
  if (s === 'dBank') { A.tab({ v: 'accts' }); A.detail({ v: bank.id }); }
  if (s === 'dPP') { A.tab({ v: 'accts' }); A.detail({ v: pp.id }); }
  if (s === 'dInv') { A.tab({ v: 'accts' }); A.detail({ v: isa.id }); }
  if (s === 'invest') A.tab({ v: 'invest' });
  if (s === 'set') { A.tab({ v: 'set' }); A.setTab({ v: 'acct' }); }
  if (s === 'setPP') { A.tab({ v: 'set' }); A.setTab({ v: 'acct' }); A.acctEdit({ id: pp.id }); }
  if (s === 'data') { A.gear({}); }
  if (s === 'h_start') { A.openBase({}); A.setTab({ v: 'acct' }); A.acctNew({}); d.querySelector('#fName').value = '생활비통장'; d.querySelector('#fStart').value = '500,000'; }
  if (s === 'guide') { A.reset({}); A.okSheet({}); A.startNew({}); }
  if (s === 'guide3') { A.reset({}); A.okSheet({}); A.startNew({}); A.guideNext({ i: 0 }); A.guideNext({ i: 1 }); }
  if (s === 'helpv') { A.help({}); }
  if (s === 'helpq') { A.help({}); const ds = d.querySelectorAll('details'); ds[0].open = false; ds[1].open = true; }
  if (s === 'welcome2') { A.reset({}); A.okSheet({}); }
  if (s === 'h_rec') { A.openBase({}); A.setTab({ v: 'rec' }); }
  if (s === 'h_row') { A.tab({ v: 'input' }); cb.U.acct = null; cb.render(); d.querySelector('#grid').scrollTop = 9999; const t = cb.S.tx.filter(x => x.type === 'out').slice(-1)[0]; A.row({ id: t.id }); }
  if (s === 'lock') { if (P.get('bio')) w.localStorage.setItem('cellbook.test.bio', 'AAAA'); cb.showLock('unlock'); }
  if (s === 'uncat') { const st = JSON.parse(JSON.stringify(cb.S)); st.tx.filter(x => x.type === 'out').slice(-3).forEach(x => { x.cat = ''; }); cb.load(st); A.tab({ v: 'input' }); A.fixUncat({}); }
  if (s === 'base') { A.gear({}); A.gearGo({ v: 'openBase' }); }
  if (s === 'welcome') { A.reset({}); A.okSheet({}); }
  document.title = 'done';
}
