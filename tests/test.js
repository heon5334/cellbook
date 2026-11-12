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
f.onload = () => { setTimeout(mode === 'shot' ? runShot : mode === 'perf' ? runPerf : run, 60); if (mode !== 'shot') setTimeout(() => { if (!/DONE/.test(document.title)) { log.push('FAIL timeout (stopped after the line above)'); finish(); } }, 20000); };

function demoState(cb) {
  const { blankState, TODAY, mRange, addM, addD, ym } = cb.util;
  const s = blankState(), today = TODAY(), start = mRange(addM(ym(today), -3))[0], t0 = 1;
  s.settings = { ...s.settings, start, invStart: start, isaLimit: 20000000, budget: 1500000, remind: 3, u: t0 }; s.demo = true;
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
      ok(n.ver === 4 && n.settings.budget === 0 && n.settings.remind === 3 && n.settings.invStart === '2026-01-01' && n.fxh && typeof n.fxh === 'object', 'migrate: ver 4 + new settings defaults (invStart = first of start month)');
      ok(a1.start === 1000 && a1.irate === null && a1.iday === null && a2.th === null && a2.camt === 50000 && a2.cbp === null, 'migrate: empty number fields -> null, numbers kept');
      ok(n.tx.length === 2 && n.tx[0].amt === 5000 && !('tags' in n.tx[0]) && !('link' in n.tx[0]), 'migrate: nothing dropped on load, amt number, no empty tags/link');
      ok(cb.checkBackup(old).n === 1 && cb.checkBackup(old).bad === 1, 'import check skips the bad-date row');
      ok(n.rec[0].amt === 500000 && n.rec[0].day === 5, 'migrate: recurring numbers');
      ok(!('gone' in n.del) && 'keep' in n.del, 'migrate: deletion marks older than 400 days pruned');
      ok(n.cats[0].i === '', 'migrate: old default emoji icon cleared');
      ok(n.tx[0].u === 4 && a1.u === 3, 'migrate: timestamps untouched (sync-safe)');
      const m = cb.mergeState(old, n); ok(m.ver === 4 && m.tx.some(t => t.id === 'o1' && t.amt === 5000), 'merge with old-format device ok');
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
    ok($('.todo') && $$('.todo .it').length >= 3 && $$('.todo .itb').length >= 3, 'home shows 확인할 것 (tap rows)');
    { const it = cb.inbox()[0]; ok(it.key && it.go && it.dis, 'inbox items carry tap/swipe actions'); }
    ok(/입출금/.test($('#body').textContent) && $$('#body .ac').length >= 3, 'home shows account groups instead of recent list');

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
    type(''); ok(!$('#qSug.on'), 'quick: no chips when empty');
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
      A.tx({ id: t.id }); ok($('#sheet-root .txf') && /기록 수정/.test($('#sheet-root').textContent) && /거래 후/.test($('#sheet-root').textContent) && cb.balAfter(t.id, t.acct) === cb.balAt(t.acct, T), 'tx form: edit opens with balance after (last tx of today = balance today)');
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


    // ===== 외화 · 하나머니 · 자동 환전 =====
    {
      const s = demoState(cb), st = s.settings.start;
      s.accounts.push({ id: 'hb', name: '하나 나라사랑', type: 'bank', start: 1000000, u: 1 });
      s.accounts.push({ id: 'hm', name: '하나머니', type: 'prepaid', start: 5000, link: 'hb', chg: 'exact', cbp: 0, fxAuto: true, fstart: { JPY: { amt: 174652, rate: 9.1 } }, u: 1 });
      s.accounts.push({ id: 'yen', name: '엔화 지갑', type: 'foreign', cur: 'JPY', famt: 1000, frate: 9, u: 1 });
      s.fx = { USD: 1450, JPY: 9.4, at: T, u: 1 };
      s.rec.push({ id: 'rc', name: 'Claude', type: 'out', cur: 'USD', famt: 20, amt: 29000, day: +addD(T, -3).slice(8), acct: 'hm', to: '', cat: '구독료', start: addD(T, -40), end: '', u: 1 });
      cb.load(s); cb.invalidate();
      const led = cb.led(), hmRows = led.filter(r => r.acct === 'hm' || r.to === 'hm');
      // 정기 결제(외화) → 결제 · 자동 환전 · 자동 충전 세 줄이 같은 묶음
      const pay = led.find(r => r.auto === 'rec' && r.src === 'rc');
      ok(pay && pay.cur === 'USD' && pay.famt === 20 && pay.amt === 29000 && pay.rate === 1450, 'fx rec: payment row in USD with KRW equivalent');
      const fxa = led.find(r => r.id === 'fxa:' + pay?.id), chg = led.find(r => r.id === 'chgp:fxa:' + pay?.id);
      ok(fxa && fxa.type === 'fx' && fxa.famt === 20 && fxa.amt === 29000 && fxa.grp === pay.id, 'fx rec: auto exchange for the shortfall (whole 20 USD)');
      ok(chg && chg.type === 'move' && chg.acct === 'hb' && chg.to === 'hm' && chg.amt === 24000 && chg.grp === pay.id, 'fx rec: exact top-up of KRW shortfall (29,000 − 5,000) from the linked bank');
      ok(cb.grpRows(pay).length === 3 && cb.grpRows(fxa).length === 3, 'group view lists the three rows');
      const bk = cb.fbookAt('hm', T);
      ok(Math.abs(bk.JPY.u - 174652) < 1e-6 && Math.abs(bk.JPY.c / bk.JPY.u - 9.1) < 1e-6 && Math.abs(bk.USD.u) < 1e-6, 'book: JPY start kept with its cost rate, USD fully used');
      ok(Math.abs(bk.USD.rz) < 1 && cb.balAt('hm', T) === 0, 'book: no FX gain when bought and spent at the same rate; KRW balance back to 0');
      ok(cb.valueAt(cb.S.accounts.find(a => a.id === 'hm'), T) === Math.round(174652 * 9.4), 'value: prepaid = KRW + JPY × current rate');
      const g = cb.groups(T); ok(g.foreign === Math.round(174652 * 9.4) + Math.round(1000 * 9.4) + Math.round(115801 * 9.1), 'groups: foreign holdings inside accounts count as 해외 자산 (+ demo 엔화 account at its manual rate)');
      const sm = cb.fxSummary(T); ok(sm.JPY && Math.abs(sm.JPY.u - (175652 + 115801)) < 1e-6 && Math.abs(sm.JPY.c - (174652 * 9.1 + 1000 * 9 + 115801 * 9.4)) < 1 && sm.JPY.val === Math.round(sm.JPY.u * 9.4), 'fxSummary: units, weighted cost and value across accounts');
      // 통계: 외화 결제는 원화 환산액으로, 환전은 지출 아님
      const rs = cb.rstats(st, T); ok(rs.cats['구독료'] >= 29000 && !led.some(r => r.type === 'fx' && rs.top.some(x => x.id === r.id)), 'stats: USD payment counted in KRW, exchange not an expense');
      // 수동 환전 + 외화 지출 + 실현 환차손익
      cb.load(s); A.tab({ v: 'list' });
      const q = v => { const el = d.querySelector('#qeIn'); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); return cb.qeParse(); };
      { const o = q('하나머니 환전 100달러 140000'); ok(o.type === 'fx' && o.cur === 'USD' && o.famt === 100 && o.amt === 140000 && o.rate === 1400 && nm(o.acct) === '하나머니', 'quick: 환전 100달러 140000'); cb.qeAdd(); }
      { const o = q('하나머니 netflix 15달러'); ok(o.type === 'out' && o.cur === 'USD' && o.famt === 15 && o.amt === 15 * 1450 && o.memo === 'netflix', 'quick: 15달러 spending → KRW at current rate'); cb.qeAdd(); }
      { const o = q('$20 하나머니 apple'); ok(o.cur === 'USD' && o.famt === 20 && o.memo === 'apple', 'quick: $20 prefix form'); }
      { const o = q('1만엔 환전 94000 하나머니'); ok(o.type === 'fx' && o.cur === 'JPY' && o.famt === 10000 && o.rate === 9.4, 'quick: 1만엔 환전'); }
      cb.invalidate();
      const b2 = cb.fbookAt('hm', T), l2 = cb.led();
      ok(Math.abs(b2.USD.u - (100 - 15)) < 1e-6, 'manual exchange then USD spending uses the balance (earlier recurring 20 was auto-exchanged and spent)');
      ok(!l2.some(r => r.id.startsWith('fxa:') && r.date === T), 'no auto exchange when USD balance is enough');
      ok(Math.abs(b2.USD.rz - 15 * (1450 - 1400)) < 1, 'realized FX gain = spent × (rate at use − avg cost)');
      // 환율 이력: 그날 이전 마지막 환율
      cb.S.fxh[addD(T, -10)] = { USD: 1300, u: 1 }; cb.invalidate();
      ok(cb.rateAt('USD', addD(T, -5)) === 1300 && cb.rateAt('USD', addD(T, -11)) === 1450 && cb.curRate('USD') === 1450, 'rateAt: history on/before date, else current');
      // 기록 창에서 환전 저장
      A.txNew({}); A.tfType({ v: 'fx' }); const setf = (f, v) => { const el = d.querySelector(`#sheet-root [data-f="${f}"]`); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
      setf('cur', 'USD'); setf('famt', '50'); setf('rate', '1420'); ok(d.querySelector('#sheet-root [data-f="kamt"]').value === '71000', 'tx form: KRW auto-filled from USD × rate');
      const n0 = cb.S.tx.length; A.tfSave({}); const last = cb.S.tx[cb.S.tx.length - 1];
      ok(cb.S.tx.length === n0 + 1 && last.type === 'fx' && last.cur === 'USD' && last.famt === 50 && last.amt === 71000 && last.side === 'buy', 'tx form: exchange saved');
      // 외화 계좌를 다른 계좌 안으로 옮기기
      A.fMerge({ id: 'yen' }); A.pickA({ v: 'hm' }); d.querySelector('#mgRate').value = '9.2'; A.fMergeGo({});
      const hm = cb.S.accounts.find(a => a.id === 'hm');
      ok(!cb.S.accounts.some(a => a.id === 'yen') && Math.abs(hm.fstart.JPY.amt - 175652) < 1e-6 && Math.abs(hm.fstart.JPY.rate - (174652 * 9.1 + 1000 * 9.2) / 175652) < 1e-3, 'merge: foreign account folded into wallet with weighted cost rate, old account removed');
      // 정기 결제 수정 창: 통화 선택 · 환율 없으면 막음
      A.recEdit({ id: 'rc' }); ok(d.querySelector('#sheet-root select[data-f="cur"]')?.value === 'USD' && /20/.test(d.querySelector('#sheet-root [data-f="amt"]').value), 'rec form shows USD and the foreign amount'); A.close({});
      // 자동 환전 줄의 원화 금액 고치기 → 환율도 따라 바뀜
      cb.load(s); const pay2 = cb.led().find(r => r.auto === 'rec' && r.src === 'rc'); A.tx({ id: 'fxa:' + pay2.id }); ok(/자동 환전/.test(d.querySelector('#sheet-root').textContent) && d.querySelectorAll('#sheet-root .grpb .tx').length === 3, 'auto exchange sheet shows the group');
      A.autoAmt({}); cb.ACT.kp({ k: 'C' }); for (const k of '29500') cb.ACT.kp({ k }); A.kpGo({ d: 'next' });
      const fxa2 = cb.led().find(r => r.id === 'fxa:' + pay2.id); ok(fxa2.amt === 29500 && Math.abs(fxa2.rate - 1475) < 1e-9 && cb.led().find(r => r.id === 'chgp:fxa:' + pay2.id).amt === 24500, 'override KRW of auto exchange → rate and top-up follow');
      // 보기: 내역에 묶인 줄이 들여쓰기로
      A.tab({ v: 'list' }); ok(d.querySelectorAll('#body .tx.child').length >= 2, 'list: child rows under the payment');
      for (const t of ['home', 'list', 'stats', 'assets']) { A.tab({ v: t }); ok(!err(), 'fx render ' + t); }
      A.detail({ v: 'hm' }); ok(!err() && /외화/.test(d.querySelector('#body').textContent) && /평균 매입/.test(d.querySelector('#body').textContent), 'wallet detail shows currency card'); A.back({});
      A.acctEdit({ id: 'hm' }); ok(/모자란 만큼만/.test(d.querySelector('#sheet-root').textContent) && d.querySelector('#sheet-root [data-f="fs.JPY.amt"]'), 'account form: charge mode + currency rows'); A.close({});
    }
    // ===== 투자: 예수금 + 평가금, 투자 시작일, 원금 기준 수익 =====
    {
      const s = demoState(cb), ist = '2026-10-01';
      s.settings.start = '2026-10-16'; s.settings.invStart = ist; s.val = {}; s.tx = s.tx.filter(t => t.date >= '2026-10-16');
      s.accounts = s.accounts.filter(a => a.id !== 'a7'); const isa = s.accounts.find(a => a.id === 'a6'); isa.start = 8000000;
      s.tx.push({ id: 'd1', date: '2026-10-10', acct: 'a1', type: 'move', to: 'a6', amt: 500000, u: 1 }); // 가계부 시작 전, 투자 시작 후
      s.tx.push({ id: 'd2', date: '2026-10-20', acct: 'a6', type: 'move', to: 'a1', amt: 200000, u: 1 });
      s.val['a6|2026-10'] = { v: 8400000, c: 100000, u: 1 };
      cb.load(s);
      const ser = cb.invSeries(cb.S.accounts.find(a => a.id === 'a6')), o = ser.find(x => x.m === '2026-10');
      ok(ser[0].m === '2026-10' && cb.invStart() === ist, 'invest series starts at invStart');
      ok(o.inn === 1000000 && o.out === 200000 && o.prin === 8800000, 'flows from invStart (before ledger start) count toward principal (+ demo ISA 적립 500,000)');
      ok(o.v === 8400000 && o.cash === 100000 && o.sec === 8300000 && o.pl === -400000 && Math.abs(o.rate - (-400000 / 8800000)) < 1e-9, 'profit = 예탁자산 − (start + in − out); 예수금/평가금 split kept');
      A.detail({ v: 'a6' }); const body = d.querySelector('#body').textContent;
      ok(/예탁자산/.test(body) && /원금/.test(body) && /넣은 돈/.test(body) && /2026-10-01/.test(body), 'invest detail shows the formula parts');
      A.val({ id: 'a6', m: ym(T) }); d.querySelector('#vCash').value = '150,000'; d.querySelector('#vSec').value = '9,000,000'; d.querySelector('#vSec').dispatchEvent(new w.Event('input', { bubbles: true }));
      ok(/9,150,000/.test(d.querySelector('#vSum').textContent), 'val sheet sums cash + securities'); A.valOk({});
      ok(cb.S.val[`a6|${ym(T)}`].v === 9150000 && cb.S.val[`a6|${ym(T)}`].c === 150000, 'val saved as total + cash');
      { const z = { ...cb.util.blankState(), accounts: [{ id: 'z', name: 'Z', type: 'invest', start: 0, u: 1 }] }; cb.load(z); ok(cb.invSeries(cb.S.accounts[0]).every(x => x.rate === null), 'rate is null (not NaN/0) when principal is 0'); }
      A.openSet({ v: '' }); ok(!err(), 'settings render with invest rows'); A.setBack({});
    }

    // 날짜 유지 · 스크롤로 날짜 따라가기
    { cb.load(demoState(cb)); A.tab({ v: 'list' }); cb.QE.date = addD(T, -3);
      const q = d.querySelector('#qeIn'); q.value = '택시 7000'; q.dispatchEvent(new w.Event('input', { bubbles: true })); cb.qeAdd();
      ok(cb.S.tx[cb.S.tx.length - 1].date === addD(T, -3) && cb.QE.date === addD(T, -3), 'quick: chosen date sticks after sending');
      const body = d.querySelector('#body'), days = [...body.querySelectorAll('.day[data-d]')];
      if (days.length > 2) { body.scrollTop = days[2].offsetTop - body.offsetTop + 4; cb.dateFromScroll(); ok(cb.QE.date === days[2].dataset.d && d.querySelector('#qDt').textContent !== '오늘', 'list: scrolling sets the input date to the day at the top'); }
      body.scrollTop = 0; cb.dateFromScroll(); ok(cb.QE.date === (days[0]?.dataset.d === T ? null : days[0]?.dataset.d), 'list: back at top → first day'); cb.QE.date = null; }
    // 환전 미리보기에서 고치기
    { const s2 = demoState(cb); s2.accounts.push({ id: 'hb', name: '하나 나라사랑', type: 'bank', start: 1000000, u: 1 }, { id: 'hm', name: '하나머니', type: 'prepaid', start: 5000, link: 'hb', chg: 'exact', fstart: { JPY: { amt: 1000, rate: 9 } }, u: 1 });
      s2.fx = { USD: 1450, JPY: 9.4, at: T, u: 1 }; cb.load(s2); A.tab({ v: 'list' });
      const q = v => { const el = d.querySelector('#qeIn'); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); return cb.qeParse(); };
      q('하나머니 환전 100달러'); ok(d.querySelectorAll('#qPrev button[data-a="qFamt"],#qPrev button[data-a="qKrw"],#qPrev button[data-a="qRate"],#qPrev button[data-a="qSide"],#qPrev button[data-a="qCur"]').length === 5, 'fx preview: every piece is a button');
      cb.QE.ov = { kamt: 140000 }; let o = cb.qeParse(); ok(o.amt === 140000 && o.rate === 1400, 'fx preview: KRW override -> rate follows');
      cb.QE.ov = { rate: 1500 }; o = cb.qeParse(); ok(o.amt === 150000 && o.rate === 1500, 'fx preview: rate override -> KRW follows');
      cb.QE.ov = { famt: 50 }; o = cb.qeParse(); ok(o.famt === 50 && o.amt === 72500, 'fx preview: foreign amount override -> KRW at current rate');
      cb.QE.ov = { side: 'sell' }; o = cb.qeParse(); ok(o.side === 'sell', 'fx preview: direction toggle'); cb.qeAdd(); const last = cb.S.tx[cb.S.tx.length - 1]; ok(last.type === 'fx' && last.side === 'sell' && last.famt === 100, 'fx preview: saved with overrides');
      cb.QE.ov = {}; q('하나머니 netflix 15달러'); cb.QE.ov = { cur: 'JPY' }; o = cb.qeParse(); ok(o.cur === 'JPY' && o.amt === Math.round(15 * 9.4), 'preview: currency change recomputes KRW');
      cb.QE.ov = {}; q(''); }
    // 외화 지갑 화면 · 외화 잔액 맞추기
    { const s3 = demoState(cb); s3.accounts.push({ id: 'hb', name: '하나 나라사랑', type: 'bank', start: 1000000, u: 1 }, { id: 'hm', name: '하나머니', type: 'prepaid', start: 5000, link: 'hb', chg: 'exact', fstart: { JPY: { amt: 1000, rate: 9 } }, u: 1 });
      s3.fx = { USD: 1450, JPY: 9.4, at: T, u: 1 }; s3.tx.push({ id: 'fx1', date: addD(T, -2), acct: 'hm', type: 'fx', side: 'buy', cur: 'USD', famt: 100, rate: 1400, amt: 140000, memo: '', cat: '', to: '', u: 1 });
      cb.load(s3); A.detail({ v: 'hm' }); A.fxPage({ id: 'hm' });
      const txt = d.querySelector('#body').textContent;
      ok(!err() && cb.U.fxv === 'hm' && /환전해서 산 외화/.test(txt) && /\$100/.test(txt) && /¥1,000/.test(txt) && /전체 기간/.test(txt), 'fx page: per-currency summary + history');
      A.fxAdj({ id: 'hm', cur: 'USD' }); d.querySelector('#nIn').value = '90'; A.numOk({});
      const adj = cb.S.tx[cb.S.tx.length - 1]; ok(adj.type === 'adj' && adj.cur === 'USD' && adj.famt === -10 && adj.amt === -14500, 'fx adjust: signed foreign adjustment row');
      ok(Math.abs(cb.fbookAt('hm', T).USD.u - 90) < 1e-6 && cb.balAt('hm', T) === 5000 - 140000 + 135000, 'fx adjust: book follows, KRW untouched (exact charge covered the exchange)');
      ok(cb.rstats(addD(T, -3), T).exp === cb.rstats(addD(T, -3), T).exp && !cb.rstats(addD(T, -3), T).top.some(x => x.id === adj.id), 'fx adjust: not in spending stats');
      A.back({}); ok(!cb.U.fxv && cb.U.detail === 'hm', 'fx page back → account detail'); A.back({}); }
    // 처음 사용자
    { cb.load(blankState()); A.tab({ v: 'home' }); ok(/계좌가 없어요/.test($('#body').textContent) && !err(), 'empty state'); }

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
  if (s === 'fxwallet' || s === 'fxlist' || s === 'fxform' || s === 'fxquick' || s === 'fxpage') {
    const st = demoState(cb); st.accounts.push({ id: 'hb', name: '하나 나라사랑', type: 'bank', start: 1000000, u: 1 }, { id: 'hm', name: '하나머니', type: 'prepaid', start: 5000, link: 'hb', chg: 'exact', cbp: 0, fstart: { JPY: { amt: 174652, rate: 9.1 } }, u: 1 });
    st.fx = { USD: 1450, JPY: 9.4, at: cb.util.TODAY(), u: 1 }; st.rec.push({ id: 'rc', name: 'Claude', type: 'out', cur: 'USD', famt: 20, amt: 29000, day: +cb.util.TODAY().slice(8), acct: 'hm', to: '', cat: '구독료', start: cb.util.addD(cb.util.TODAY(), -40), end: '', u: 1 });
    st.tx.push({ id: 'fx1', date: cb.util.addD(cb.util.TODAY(), -2), acct: 'hm', type: 'fx', side: 'buy', cur: 'USD', famt: 100, rate: 1400, amt: 140000, memo: '', cat: '', to: '', u: 1 });
    cb.load(st); if (s === 'fxpage') { A.detail({ v: 'hm' }); A.fxPage({ id: 'hm' }); } if (s === 'fxquick') { A.tab({ v: 'list' }); type('하나머니 환전 100달러'); } if (s === 'fxwallet') A.detail({ v: 'hm' }); if (s === 'fxlist') { A.tab({ v: 'list' }); } if (s === 'fxform') { A.tab({ v: 'list' }); A.tx({ id: cb.led().find(r => r.auto === 'rec' && r.src === 'rc').id }); }
  }
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

// 속도: 3년치 큰 데이터로 화면 그리기·입력 반응 시간 (ms)
async function runPerf() {
  const w = f.contentWindow, d = w.document, cb = w.__cb, A = cb.ACT, { TODAY, addD, addM, ym, mRange } = cb.util;
  const s = demoState(cb), T = TODAY(); s.settings.start = mRange(addM(ym(T), -36))[0];
  const memos = ['점심', '커피', '편의점', '버스', '장보기', '택시', '저녁 모임', '온라인', '약국', '영화'], cats = ['식비·생활', '커피·디저트', '식비·생활', '교통', '식비·생활', '교통', '사람', '쇼핑', '기타', '여가'];
  let n = 0; for (let dd = s.settings.start; dd < T; dd = addD(dd, 1)) for (let k = 0; k < 6; k++) { const j = (n * 7 + k) % 10; s.tx.push({ id: 'p' + n++, date: dd, acct: ['a2', 'a3', 'a4'][k % 3], type: 'out', amt: 1000 + (n % 50) * 500, cat: cats[j], memo: memos[j], to: '', u: 1, ...(k === 5 ? { tags: ['태그' + (n % 4)] } : {}) }); }
  cb.load(s);
  const t = (l, fn, rep = 5) => { fn(); const a = performance.now(); for (let i = 0; i < rep; i++) fn(); log.push(`PERF ${l}: ${((performance.now() - a) / rep).toFixed(1)}`); };
  const fresh = fn => () => { cb.invalidate(); fn(); };
  log.push('INFO tx ' + cb.S.tx.length);
  const post = () => fetch('/result', { method: 'POST', body: 'PARTIAL\n' + log.join('\n') }).catch(() => { });
  const one = (l, fn) => { cb.invalidate(); const a = performance.now(); fn(); log.push(`STEP ${l}: ${(performance.now() - a).toFixed(1)}`); post(); };
  one('ledger', () => cb.led()); 
  one('rstats month', () => { cb.led(); const a = performance.now(); cb.rstats(mRange(ym(T))[0], T); });
  one('groups', () => cb.groups(T));
  one('inbox', () => cb.inbox());
  one('budget', () => cb.budgetInfo());
  one('render home', () => A.tab({ v: 'home' }));
  await sleep(50);
  for (const v of ['home', 'list', 'stats', 'assets']) t('tab ' + v + ' (after change)', fresh(() => A.tab({ v })));
  for (const v of ['home', 'list']) t('tab ' + v + ' (cached)', () => A.tab({ v }));
  A.tab({ v: 'list' }); const q = () => d.querySelector('#qeIn');
  t('keystroke parse+preview', () => { q().value = '스타벅스 45'; q().dispatchEvent(new w.Event('input', { bubbles: true })); }, 20);
  t('add one tx (commit+render)', () => { q().value = '커피 4500'; q().dispatchEvent(new w.Event('input', { bubbles: true })); cb.qeAdd(); }, 5);
  finish();
}
