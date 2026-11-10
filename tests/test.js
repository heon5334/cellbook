// 점검용 — 배포 화면에서는 쓰지 않음. tests/test.html?m=unit (결과는 화면 아래와 제목에)
const P = new URLSearchParams(location.search), mode = P.get('m') || 'unit', shot = P.get('shot');
const f = document.getElementById('f'), out = document.getElementById('out');
const log = [], ok = (c, m) => { log.push((c ? 'PASS ' : 'FAIL ') + m); out.textContent = log.join('\n'); };
f.style.height = (P.get('h') || 844) + 'px'; f.style.width = (P.get('w') || 390) + 'px';
const REAL0 = localStorage.getItem('cellbook.v1'); // 실제 가계부 공간은 읽기만, 비교용
localStorage.setItem('cellbook.test.theme', P.get('theme') || 'light');
localStorage.setItem('cellbook.test.bk', JSON.stringify({ last: new Date().toISOString().slice(0, 10) }));
localStorage.removeItem('cellbook.test.rem');
f.src = '../index.html?test';
f.onload = () => { setTimeout(mode === 'shot' ? runShot : run, 60); if (mode !== 'shot') setTimeout(() => { if (!/DONE/.test(document.title)) { log.push('FAIL timeout (stopped after the line above)'); finish(); } }, 20000); };

function demoState(cb) {
  const { blankState, TODAY, mRange, addM, addD, ym } = cb.util;
  const s = blankState(), today = TODAY(), start = mRange(addM(ym(today), -3))[0], t0 = 1;
  s.settings = { ...s.settings, start, isaLimit: 20000000, budget: 1500000, remind: 3, u: t0 }; s.demo = true;
  const ac = (id, name, type, st, x = {}) => ({ id, name, type, start: st, u: t0, ...x });
  s.accounts = [ac('a1', '급여통장', 'bank', 2650000, { fav: true }), ac('a2', '생활비통장', 'bank', 500700), ac('a3', '체크카드', 'card', 0, { payDay: 14, fav: true }),
    ac('a4', '동백전', 'prepaid', 15000, { link: 'a2', th: 10000, camt: 50000, cbp: 10 }), ac('a5', '주택청약', 'saving', 4520000, { mfrom: 'a1', mamt: 100000, mday: 27 }),
    ac('a6', 'ISA', 'invest', 8400000, { isa: true }), ac('a7', '미국주식', 'invest', 4600000), ac('a9', '엔화', 'foreign', 0, { cur: 'JPY', famt: 115801, rate: 9.1 })];
  const R = (id, name, type, amt, day, acct, x = {}) => ({ id, name, type, amt, day, acct, to: '', cat: '', start, end: '', u: t0, ...x });
  s.rec = [R('r1', '월급', 'in', 2850000, 25, 'a1', { cat: '월급' }), R('r2', 'ISA 적립', 'move', 500000, 26, 'a1', { to: 'a6' }), R('r3', '생활비 이체', 'move', 700000, 26, 'a1', { to: 'a2' }),
    R('r5', '관리비', 'out', 120000, 10, 'a1', { cat: '주거·공과금' }), R('r6', '음악 구독', 'out', 8900, 30, 'a3', { cat: '구독료' }), R('r7', '카드값 결제', 'move', 230000, 14, 'a2', { to: 'a3' })];
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const PT = [['a3', '커피·디저트', [4500, 5400], '회사 앞 카페'], ['a3', '식비·생활', [9000, 11000], '점심'], ['a4', '식비·생활', [18200, 36000], '장보기'],
    ['a4', '커피·디저트', [4500, 3800], '동네 카페'], ['a2', '교통', [1500], '버스'], ['a3', '쇼핑', [29000, 45000], '온라인'], ['a2', '여가', [15000, 22000], '영화'], ['a3', '사람', [30000, 50000], '선물']];
  let d = start, i = 0;
  while (d < today) {
    const n = rnd() < .35 ? 0 : rnd() < .7 ? 1 : 2;
    for (let k = 0; k < n; k++) { const p = PT[Math.floor(rnd() * PT.length)], amt = p[2][Math.floor(rnd() * p[2].length)]; s.tx.push({ id: 't' + (i++), date: d, acct: p[0], type: 'out', amt, cat: p[1], to: '', memo: p[3], u: t0, ...(p[3] === '영화' ? { tags: ['데이트'] } : {}) }); }
    d = addD(d, 1);
  }
  s.tx.push({ id: 'tx1', date: today, acct: 'a3', type: 'out', amt: 40000, cat: '식비·생활', memo: '친구들 저녁', u: t0, tags: ['모임'] });
  s.tx.push({ id: 'tx2', date: today, acct: 'a2', type: 'in', amt: 30000, cat: '기타수입', memo: 'n빵 정산', u: t0 });
  s.tx.push({ id: 'tx3', date: addD(today, -1), acct: 'a2', type: 'out', amt: 100000, cat: '기타', memo: '저축', u: t0 });
  s.tx.push({ id: 'tx4', date: addD(today, -1), acct: 'a1', type: 'in', amt: 100000, cat: '기타수입', memo: '', u: t0 });
  s.tx.push({ id: 'tx5', date: addD(today, -2), acct: 'a3', type: 'out', amt: 6100, cat: '쇼핑', memo: '스타벅스', u: t0 });
  const gr = { a6: [1.018, .996, 1.024], a7: [1.031, .992, 1.02] }, base = { a6: 8400000, a7: 4600000 };
  let j = 0;
  for (let m = ym(start); m < addM(ym(today), -1); m = addM(m, 1), j++) for (const id of Object.keys(gr)) { base[id] = Math.round((base[id] + (id === 'a6' ? 500000 : 0)) * gr[id][j % 3]); s.val[`${id}|${m}`] = { v: base[id], u: t0 }; }
  return s;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
function finish() { const fails = log.filter(x => x.startsWith('FAIL')); out.textContent = log.join('\n'); document.title = `DONE ${log.length - fails.length}/${log.length}`; document.body.setAttribute('data-result', fails.length ? 'fail' : 'ok'); fetch('/result', { method: 'POST', body: document.title + '\n' + log.join('\n') }).catch(() => { }); }

async function run() {
  const w = f.contentWindow, d = w.document, cb = w.__cb, A = cb.ACT, $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
  const err = () => d.documentElement.getAttribute('data-err');
  const nm = id => cb.S.accounts.find(a => a.id === id)?.name;
  try {
    const { TODAY, addD, ym, mRange, blankState, addM } = cb.util, T = TODAY();
    // 계산
    ok(cb.calc('18600÷3') === 6200 && cb.calc('1000+2×3') === 1006 && cb.calc('1÷0') === null && cb.calc('abc') === null, 'calc');
    ok(cb.amtOf('1.5만') === 15000 && cb.amtOf('3천') === 3000 && cb.amtOf('12,000원') === 12000 && cb.amtOf('9000÷3') === 3000 && cb.amtOf('abc') === null, 'amtOf: 만/천/수식');

    // 예전 백업(ver 2) 옮기기
    { const old = { ver: 2, settings: { start: '2026-01-01', isaLimit: 20000000, u: 5 }, accounts: [{ id: 'x1', name: '통장', type: 'bank', start: '1000', irate: '', iday: '', u: 3 }, { id: 'x2', name: '페이', type: 'prepaid', start: 0, th: '', camt: '50000', cbp: '', u: 3 }],
        cats: [{ id: 'c0', n: '식비·생활', i: '🍚', k: 'exp', u: 0 }], tx: [{ id: 'o1', date: '2026-01-02', acct: 'x1', type: 'out', amt: '5000', cat: '식비·생활', to: '', memo: '점심', u: 4 }, { id: 'o2', date: 'bad', acct: 'x1', type: 'out', amt: 1 }],
        rec: [{ id: 'q1', name: '월세', type: 'out', amt: '500000', day: '5', acct: 'x1', cat: '', start: '2026-01-01', u: 2 }], val: {}, ov: {}, arch: {}, fx: { u: 0 }, del: { gone: Date.now() - 500 * 864e5, keep: Date.now() - 864e5 } };
      const n = cb.normalize(old), a1 = n.accounts[0], a2 = n.accounts[1];
      ok(n.ver === 3 && n.settings.budget === 0 && n.settings.remind === 3, 'migrate: ver 3 + new settings defaults');
      ok(a1.start === 1000 && a1.irate === null && a1.iday === null && a2.th === null && a2.camt === 50000 && a2.cbp === null, 'migrate: empty number fields -> null, numbers kept');
      ok(n.tx.length === 2 && n.tx[0].amt === 5000 && !('tags' in n.tx[0]) && !('link' in n.tx[0]), 'migrate: nothing dropped on load, amt number, no empty tags/link');
      ok(cb.checkBackup(old).n === 1 && cb.checkBackup(old).bad === 1, 'import check skips the bad-date row');
      ok(n.rec[0].amt === 500000 && n.rec[0].day === 5, 'migrate: recurring numbers');
      ok(!('gone' in n.del) && 'keep' in n.del, 'migrate: deletion marks older than 400 days pruned');
      ok(n.cats[0].i === '', 'migrate: old default emoji icon cleared');
      ok(n.tx[0].u === 4 && a1.u === 3, 'migrate: timestamps untouched (sync-safe)');
      const m = cb.mergeState(old, n); ok(m.ver === 3 && m.tx.some(t => t.id === 'o1' && t.amt === 5000), 'merge with old-format device ok');
    }

    cb.load(demoState(cb)); await sleep(30);
    // 화면이 오류 없이 그려지는지
    for (const t of ['home', 'list', 'stats', 'assets']) { A.tab({ v: t }); ok(!err() && $('#body') && $$('.tabs .tab.on').length === 1, 'render tab ' + t); }
    for (const p of ['month', 'prev', '3m', 'custom']) { A.tab({ v: 'stats' }); A.statP({ v: p }); ok(!err() && /지출/.test($('.ssum')?.textContent || ''), 'stats period ' + p); }
    A.statMon({ m: addM(ym(T), -1) }); ok(!err() && $('.bc.on'), 'stats: tap month bar');
    for (const a of cb.S.accounts) { A.detail({ v: a.id }); ok(!err() && $('.ahero'), 'detail ' + a.type + ' ' + a.name); }
    A.back({}); ok(!cb.U.detail, 'detail back');
    A.gear({}); ok(!err() && /백업 파일 저장/.test($('#body').textContent), 'settings page');
    for (const v of ['cat', 'rec']) { A.openSet({ v }); ok(!err() && $$('.srow').length > 2, 'settings sub ' + v); }
    A.setBack({}); A.setBack({}); ok(cb.U.tab !== 'set', 'settings back');
    ok(!/[\u{1F300}-\u{1FAFF}⚡⚠✨]/u.test(d.body.textContent), 'no emoji in UI');

    // 홈: 예산 · 확인할 것
    A.tab({ v: 'home' });
    { const b = cb.budgetInfo(), st = cb.rstats(mRange(ym(T))[0], T).exp, td = cb.rstats(T, T).exp, left = +mRange(ym(T))[1].slice(8) - +T.slice(8) + 1;
      ok(b.spent === st && b.today === td && b.daily === Math.floor((1500000 - (st - td)) / left) && b.can === b.daily - td, 'budget: today allowance math');
      ok(/오늘 쓸 수 있는 돈|예산을 넘었어요/.test($('.hero').textContent), 'home hero shows daily allowance'); }
    const ib = cb.inbox();
    ok(ib.some(x => x.b.some(y => y[1] === 'linkOpen' && y[2].id === 'tx2')), 'inbox: settlement suggestion for n빵 정산');
    ok(ib.some(x => x.b.some(y => y[1] === 'xferFix' && y[2].id === 'tx3' && y[2].p === 'tx4')), 'inbox: same-amount out/in pair -> transfer');
    ok(ib.some(x => x.b.some(y => y[1] === 'catFix' && y[2].id === 'tx5' && y[2].v === '커피·디저트')), 'inbox: memo/category mismatch');
    ok(ib.some(x => x.b.some(y => y[1] === 'val')), 'inbox: missing investment valuation');
    ok($('.todo') && $$('.todo .it').length >= 3, 'home shows 확인할 것');

    // 정산 연결 → 실지출
    { const s0 = cb.rstats(T, T), r0 = cb.mstats(ym(T));
      A.linkOpen({ id: 'tx2' }); ok($('#sheet-root .opt[data-v="tx1"]'), 'link sheet lists the dinner');
      A.linkPick({ v: 'tx1' }); const s1 = cb.rstats(T, T), r1 = cb.mstats(ym(T));
      ok(cb.S.tx.find(t => t.id === 'tx2').link === 'tx1', 'link saved');
      ok(s1.exp === s0.exp - 30000 && r1.inc === r0.inc - 30000 && s1.refund === 30000, 'stats: linked refund lowers spending, not income');
      ok(s1.cats['식비·생활'] === s0.cats['식비·생활'] - 30000, 'stats: category uses net spending');
      A.tab({ v: 'list' }); ok(/실지출 10,000/.test($('#body').textContent) && /정산 연결/.test($('#body').textContent), 'list shows 실지출 and linked mark');
      ok(!cb.inbox().some(x => x.b.some(y => y[1] === 'linkOpen' && y[2].id === 'tx2')), 'inbox: linked item gone');
      ok(s1.tags['모임'] === 10000 && s1.catTags['식비·생활']['모임'] === 10000, 'tags use net spending'); }

    // 이체 오입력 고치기 + 되돌리기
    { const n0 = cb.S.tx.length; A.xferFix({ id: 'tx3', p: 'tx4' }); const t = cb.S.tx.find(x => x.id === 'tx3');
      ok(t.type === 'move' && t.to === 'a1' && !t.cat && !cb.S.tx.some(x => x.id === 'tx4') && cb.S.tx.length === n0 - 1, 'xferFix: becomes move, pair removed');
      ok(/되돌리기/.test($('#toast').textContent), 'toast offers undo'); A.undo({}); ok(cb.S.tx.find(x => x.id === 'tx3').type === 'out' && cb.S.tx.some(x => x.id === 'tx4'), 'undo restores');
      A.dismiss({ id: 'tx3', k: 'xfer', p: 'tx4' }); ok(!cb.inbox().some(x => x.b.some(y => y[1] === 'xferFix' && y[2].id === 'tx3')), 'dismiss hides suggestion'); }
    A.catFix({ id: 'tx5', v: '커피·디저트' }); ok(cb.S.tx.find(x => x.id === 'tx5').cat === '커피·디저트', 'catFix');

    // 빠른 입력
    A.tab({ v: 'list' });
    const type = v => { const q = $('#qeIn'); q.value = v; q.dispatchEvent(new w.Event('input', { bubbles: true })); };
    ok($('#qeIn') && $('#qGo'), 'quick bar present');
    type(''); ok($('#qSug.on') && /자주 쓰는/.test($('#qSug').textContent), 'quick: frequent suggestions when empty');
    type('회사'); ok(/회사 앞 카페/.test($('#qSug').textContent), 'quick: memo autocomplete');
    type('커피 4500 #출근'); ok($('#qPrev.on') && /이렇게 기록돼요/.test($('#qPrev').textContent) && /#출근/.test($('#qPrev').textContent) && /커피·디저트/.test($('#qPrev').textContent), 'quick: live preview with tag + category');
    ok($('#qGo').classList.contains('send'), 'quick: send button active');
    { const n0 = cb.S.tx.length; cb.qeAdd(); const t = cb.S.tx[cb.S.tx.length - 1];
      ok(cb.S.tx.length === n0 + 1 && t.amt === 4500 && t.cat === '커피·디저트' && t.tags?.[0] === '출근' && t.memo === '커피', 'quick: adds tx with tag');
      ok($('#qeIn').value === '' && /기록했어요/.test($('#toast').textContent), 'quick: cleared + toast'); }
    type('점심 9000'); A.qType({}); ok(cb.qeParse().type === 'in', 'quick: tap type pill toggles 수입');
    type('점심 9000'); cb.QE.ov = { acct: 'a2' }; ok(cb.qeParse().acct === 'a2', 'quick: account override from preview');
    cb.QE.ov = {}; type('');
    { const n0 = cb.S.tx.length; type('생활비 이체 20000'); cb.qeAdd(); ok($('#sheet-root.on') && /어느 계좌에서/.test($('#sheet-root').textContent), 'quick: transfer without sender asks');
      A.pickA({ v: 'a1' }); const t = cb.S.tx[cb.S.tx.length - 1]; ok(cb.S.tx.length === n0 + 1 && t.type === 'move' && t.acct === 'a1' && t.to === 'a2', 'quick: transfer saved'); }

    // 빠른 입력 해석 (예전 점검 그대로)
    { const Pq = x => cb.parseQuick(x);
      { const o = Pq('체크카드에서 커피 4500'); ok(nm(o.acct) === '체크카드' && o.memo === '커피', 'parse: particle after account'); }
      { const o = Pq('급여통장에서 생활비통장으로 50000'); ok(o.type === 'move' && nm(o.acct) === '급여통장' && nm(o.to) === '생활비통장' && !o.memo, 'parse: A에서 B로'); }
      { const o = Pq('급여통장 생활비통장 이체 50000'); ok(o.type === 'move' && nm(o.to) === '생활비통장', 'parse: 이체 keyword'); }
      { cb.QE.acct = 'a1'; const o = Pq('생활비통장으로 5만 이체'); ok(o.type === 'move' && nm(o.acct) === '급여통장' && nm(o.to) === '생활비통장' && o.amt === 50000, 'parse: transfer from viewed account'); cb.QE.acct = null; }
      { const o = Pq('동백 4500 커피'); ok(nm(o.acct) === '동백전' && o.amt === 4500 && o.memo === '커피', 'parse: partial account'); }
      { const o = Pq('동백 이동 생활비 300000'); ok(o.type === 'move' && nm(o.acct) === '동백전' && nm(o.to) === '생활비통장' && !o.memo, 'parse: A 이동 B'); }
      { const o = Pq('생활비 이체 20000'); ok(o.type === 'move' && nm(o.to) === '생활비통장' && !o.given, 'parse: receiver only'); }
      { const o = Pq('월급 2850000'); ok(o.type === 'in' && o.amt === 2850000, 'parse: income word'); }
      { const o = Pq('환불 12000 쇼핑'); ok(o.type === 'in', 'parse: refund -> in'); }
      { const o = Pq('용돈 30000'); ok(o.type === 'out', 'parse: 용돈 stays out'); }
      { const o = Pq('동벡 4500 커피'); ok(nm(o.acct) === '동백전' && o.fixed.length === 1, 'parse: typo in account'); }
      { const o = Pq('커퓌 4500'); ok(o.memo === '커피' && o.cat === '커피·디저트', 'parse: typo in common word'); }
      { const o = Pq('졈심 9000'); ok(o.memo === '졈심' && !o.fixed.length, 'parse: memo words not corrected'); }
      { const o = Pq('급여 3000000'); ok(nm(o.acct) === '급여통장' && o.type === 'in' && o.cat === '월급', 'parse: 급여 -> account + in'); }
      { const o = Pq('피자 20000'); ok(o.type === 'out' && !o.fixed.length, 'parse: 피자 not 이자'); }
      { const o = Pq('이자카야 30000'); ok(o.type === 'out', 'parse: 이자카야 stays out'); }
      { const o = Pq('동백 커피 4500 캐시백으로'); ok(o.cbUse === 'max' && o.type === 'out' && o.memo === '커피', 'parse: 캐시백으로'); }
      { const o = Pq('어제 버스 1500'); ok(o.date === addD(T, -1) && o.cat === '교통', 'parse: 어제'); } }

    // 직접 입력 창
    { A.txNew({}); ok($('#sheet-root .txf') && $('#tfAmt'), 'tx form opens');
      const set = (sel, v) => { const el = $(sel); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
      set('#tfAmt', '1.2만'); ok(/12,000/.test($('#tfAmtH').textContent), 'tx form: amount hint for 1.2만');
      A.tfCat({ v: '교통' }); set('#sheet-root input[data-f="memo"]', '택시'); set('#sheet-root input[data-f="tags"]', '#출장 회사');
      const n0 = cb.S.tx.length; A.tfSave({}); const t = cb.S.tx[cb.S.tx.length - 1];
      ok(cb.S.tx.length === n0 + 1 && t.amt === 12000 && t.cat === '교통' && t.memo === '택시' && t.tags.join() === '출장,회사', 'tx form: save new');
      A.tx({ id: t.id }); ok($('#sheet-root .txf') && /기록 수정/.test($('#sheet-root').textContent), 'tx form: edit opens');
      set('#sheet-root input[data-f="tags"]', ''); A.tfSave({}); ok(!('tags' in cb.S.tx.find(x => x.id === t.id)), 'tx form: clearing tags removes field');
      A.tx({ id: 'tx5' }); set('#sheet-root input[data-f="date"]', addD(T, -2)); A.tfDup({}); const dup = cb.S.tx[cb.S.tx.length - 1];
      ok(dup.date === T && dup.memo === '스타벅스' && dup.id !== 'tx5', 'tx form: duplicate to today');
      A.tx({ id: dup.id }); A.tfType({ v: 'move' }); ok(!$('#sheet-root .cgrid') && /받는 곳/.test($('#sheet-root').textContent), 'tx form: move shows to-account');
      A.close({});
      const n1 = cb.S.tx.length; A.delTx({ id: dup.id }); ok(cb.S.tx.length === n1 - 1, 'delete'); A.undo({}); ok(cb.S.tx.length === n1, 'undo delete'); }

    // 정기 결제: 카테고리 꼭
    { A.recNew({}); const set = (f, v) => { const el = $(`#sheet-root [data-i="r"][data-f="${f}"]`); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
      set('name', '보험'); set('amt', '50000'); set('day', '15'); const n0 = cb.S.rec.length; A.recSave({});
      ok(cb.S.rec.length === n0 && /카테고리를 고르세요/.test($('#toast').textContent), 'recurring: category required');
      A.rCat({ v: '기타' }); A.recSave({}); ok(cb.S.rec.length === n0 + 1, 'recurring: saved with category'); }

    // 자동 납입 (청약: 만기 없음)
    ok(cb.led().some(r => r.auto === 'dep' && r.to === 'a5' && r.acct === 'a1'), 'saving without maturity: monthly auto deposit rows');

    // 백업 검사 · 암호
    { ok(!cb.checkBackup({ foo: 1 }).ok && !cb.checkBackup(null).ok, 'backup check: not a backup');
      ok(!cb.checkBackup({ ver: 9, accounts: [], tx: [] }).ok, 'backup check: newer version refused');
      const v = cb.checkBackup({ ver: 2, accounts: [{ id: 'a', name: 'x', type: 'bank' }], tx: [{ id: 't', date: '2026-01-01', amt: 1, acct: 'a' }, { id: 'u', date: 'x', amt: 1 }, { date: '2026-01-01' }] });
      ok(v.ok && v.n === 1 && v.bad === 2 && v.na === 1 && v.from === '2026-01-01', 'backup check: counts + bad rows');
      ok(!!w.crypto?.subtle, 'crypto.subtle available');
      const enc = await cb.encBackup(cb.S, 'pass1234', 2000); ok(enc.enc && enc.data && !JSON.stringify(enc).includes('급여통장'), 'encrypted backup hides content');
      const dec = await cb.decBackup(enc, 'pass1234'); ok(dec.tx.length === cb.S.tx.length && dec.accounts[0].name === cb.S.accounts[0].name, 'encrypted backup roundtrip');
      let bad = false; try { await cb.decBackup(enc, 'wrong'); } catch (e) { bad = true; } ok(bad, 'wrong password rejected'); }

    // 기록 알림
    { const s = blankState(); s.accounts = [{ id: 'k', name: '통장', type: 'bank', start: 0, u: 1 }]; s.settings.start = addD(T, -30); s.settings.remind = 3;
      s.tx = [{ id: 'z', date: addD(T, -5), acct: 'k', type: 'out', amt: 1000, cat: '기타', memo: '', u: 1 }];
      cb.load(s); ok(cb.inbox().some(x => /5일째 기록이 없어요/.test(x.t)), 'remind: N days without input');
      A.remindLater({}); ok(!cb.inbox().some(x => /기록이 없어요/.test(x.t)), 'remind: snooze for today'); }

    // 처음 사용자
    { cb.load(blankState()); A.tab({ v: 'home' }); ok(/먼저 계좌를 추가하세요/.test($('#body').textContent) && !err(), 'empty state'); }

    // 어두운 화면
    localStorage.setItem('cellbook.test.theme', 'dark'); cb.applyTheme(); cb.load(demoState(cb));
    for (const t of ['home', 'list', 'stats', 'assets']) { A.tab({ v: t }); ok(!err(), 'dark render ' + t); }
    ok(d.documentElement.dataset.theme === 'dark', 'dark theme applied');
    ok(!cb.HELP.some(h => [...h.p, ...(h.ex || []).flat()].some(x => /!|[\u{1F300}-\u{1FAFF}]/u.test(x))), 'help copy plain');
    ok(localStorage.getItem('cellbook.v1') === REAL0, 'real data storage untouched');
    ok(!err(), 'no runtime error: ' + (err() || ''));
  } catch (e) { ok(false, 'exception: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  finish();
}

async function runShot() {
  const w = f.contentWindow, d = w.document, cb = w.__cb, A = cb.ACT;
  const st = d.createElement('style'); st.textContent = '*{animation:none!important;transition:none!important}' + (P.get('toast') ? '' : '#toast{display:none}'); d.head.appendChild(st);
  document.body.style.overflow = 'hidden'; out.style.display = 'none';
  cb.load(demoState(cb));
  const type = v => { const q = d.querySelector('#qeIn'); q.value = v; q.dispatchEvent(new w.Event('input', { bubbles: true })); };
  const s = shot || 'home';
  if (s === 'home') A.tab({ v: 'home' });
  if (s === 'list') { A.tab({ v: 'list' }); A.linkOpen({ id: 'tx2' }); A.linkPick({ v: 'tx1' }); }
  if (s === 'quick') { A.tab({ v: 'list' }); type('스타벅스 4500 #출근'); }
  if (s === 'sugg') { A.tab({ v: 'home' }); type(''); }
  if (s === 'stats') { A.linkOpen({ id: 'tx2' }); A.linkPick({ v: 'tx1' }); A.tab({ v: 'stats' }); A.catOpen({ k: '여가' }); }
  if (s === 'stats2') { A.tab({ v: 'stats' }); d.querySelector('#body').scrollTop = 900; }
  if (s === 'assets') A.tab({ v: 'assets' });
  if (s === 'detail') A.detail({ v: P.get('a') || 'a4' });
  if (s === 'set') A.gear({});
  if (s === 'form') { A.tab({ v: 'list' }); A.txNew({}); }
  if (s === 'edit') { A.tab({ v: 'list' }); A.tx({ id: 'tx1' }); }
  if (s === 'link') { A.tab({ v: 'home' }); A.linkOpen({ id: 'tx2' }); }
  if (s === 'welcome') { cb.load(cb.util.blankState()); w.localStorage.removeItem('cellbook.test'); location.reload; }
  if (P.get('scroll')) d.querySelector('#body').scrollTop = +P.get('scroll');
  document.title = 'SHOT READY';
}
