'use strict';
// 데이터: 새로 시작, 초기화, 백업, 가져오기
/* ---------- 데이터: 새로 시작 · 초기화 · 백업 · 가져오기 ---------- */
ACT.startNew = () => { S = blankState(); persist(); U.prevTab = 'input'; U.tab = 'set'; U.setTab = 'acct'; render(); openGuide(0); };
ACT.reset = () => confirmSheet('이 기기 데이터 초기화', '이 기기에 저장된 가계부를 모두 지울까요?<br>로그인 동기화 중이면 클라우드 데이터는 남아 있어요.', '초기화', () => {
  try { localStorage.removeItem(KEY); } catch (e) { }
  S = null; hist.length = 0; fut.length = 0; invalidate(); Sync.onReset && Sync.onReset(); render();
}, true);
ACT.exportJson = () => {
  const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `셀가계부_백업_${TODAY()}.json`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  bkSet({ last: TODAY(), snooze: '' }); toast('백업 파일을 저장했어요'); if (S) render();
};
async function readText(f) { // 엑셀에서 저장한 CSV는 EUC-KR인 경우가 있음
  const buf = await f.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^\uFEFF/, ''); } catch (e) { }
  try { return new TextDecoder('euc-kr').decode(buf); } catch (e) { return new TextDecoder().decode(buf); }
}
let FILEMODE = '';
ACT.importJson = () => { FILEMODE = 'json'; const f = $('#file'); f.accept = '.json,application/json'; f.multiple = false; f.value = ''; f.click(); };
ACT.importCsv = () => { FILEMODE = 'csv'; const f = $('#file'); f.accept = '.csv,text/csv'; f.multiple = true; f.value = ''; f.click(); };
async function onFiles(files) {
  if (!files.length) return;
  if (FILEMODE === 'json') {
    try {
      const d = JSON.parse(await files[0].text());
      if (!d || !Array.isArray(d.accounts) || !Array.isArray(d.tx)) throw 0;
      const go = () => { const old = S; if (old) hist.push(JSON.stringify(old)); S = stampAll(normalize(d)); if (old) for (const c of COLLS) for (const x of old[c]) if (!S[c].some(y => y.id === x.id)) S.del[x.id] = now(); delete S.demo; invalidate(); persist(); render(); toast(`불러왔어요 · 거래 ${S.tx.length}건`); };
      if (S && (S.tx.length || S.accounts.length)) confirmSheet('백업 불러오기', '지금 가계부를 이 백업 파일로 <b>바꿀까요?</b>', '바꾸기', go, true); else go();
    } catch (e) { toast('셀가계부 백업 파일이 아니에요'); }
    return;
  }
  const texts = []; for (const f of files) texts.push(await readText(f));
  if (!S) S = blankState();
  hist.push(JSON.stringify(S));
  const rep = importCsv(texts.map(parseCsv));
  S.demo = false; invalidate(); persist(); if (S.tx.length || S.accounts.length) { U.tab = 'dash'; } render();
  openSheet(`${bh('가져오기 결과')}<div class="hint top lg">${rep.join('<br>') || '가져올 내용을 찾지 못했어요. 구글 시트의 탭을 CSV로 받았는지 확인하세요.'}</div><button class="bigbtn"${at('close')}>확인</button>`);
}
function stampAll(s) { const t = now(); for (const c of COLLS) for (const x of s[c]) x.u = t; for (const c of MAPS) for (const k in s[c]) s[c][k].u = t; s.settings.u = t; s.fx.u = t; return s; }
function parseCsv(t) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(x => x.trim()));
}
function toDate(s) {
  s = String(s || '').trim(); let m;
  if ((m = s.match(/^(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/))) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return `${m[3]}-${pad2(m[1])}-${pad2(m[2])}`;
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})(?:\D|$)/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if (/^\d{5}$/.test(s)) { const d = new Date(Date.UTC(1899, 11, 30) + (+s) * 864e5); return d.toISOString().slice(0, 10); }
  return '';
}
const TYPE_KO = { '입출금': 'bank', '카드': 'card', '충전식': 'prepaid', '적금': 'saving', '투자': 'invest', '해외': 'foreign' };
function ensureAcct(name, type = 'bank') {
  name = String(name || '').trim(); if (!name) return '';
  let a = S.accounts.find(x => x.name === name);
  if (!a) { a = touch({ id: uid(), name, type, start: 0 }); S.accounts.push(a); }
  return a.id;
}
function ensureCat(n, kind) { if (n && !catOf(n)) S.cats.push(touch({ id: uid(), n, i: '·', k: kind })); }
function importCsv(sheets) {
  const rep = [];
  // 1) 설정·월말잔액 먼저 (계좌 종류·시작 잔액)
  for (const rows of sheets) {
    if (!rows.some(r => r.some(c => c === '시작 잔액') || r.some(c => c === '정기 결제·이체 (매달 자동 기록)'))) continue;
    let na = 0, nr = 0;
    for (const r of rows) {
      if (r[0] === '시작일' && toDate(r[1])) { S.settings = { ...S.settings, start: toDate(r[1]), u: now() }; rep.push(`시작일: ${S.settings.start}`); }
      if (r[0] === 'ISA 연 납입한도' && num(r[1])) S.settings.isaLimit = num(r[1]);
      if ((r[7] === '지출' || r[7] === '수입') && r[6] && r[6] !== '카테고리') ensureCat(r[6], r[7] === '수입' ? 'inc' : 'exp');
      const ty = TYPE_KO[r[1]];
      if (ty && r[0] && r[0] !== '계좌' && r[0] !== '해외 자산') {
        const id = ensureAcct(r[0], ty), a = A(id); a.type = ty;
        if (ty === 'foreign') { a.famt = num(r[2]); a.cur = (r[3] || '').toUpperCase(); if (num(r[4])) a.rate = num(r[4]); }
        else { a.start = num(r[2]); if (ty === 'saving' && toDate(r[3])) a.mat = toDate(r[3]); if (ty === 'invest' && /ISA/i.test(r[0])) a.isa = true; }
        touch(a); na++;
      }
    }
    const hi = rows.findIndex(r => r[0] === '이름' && r[1] === '구분' && r[2] === '금액');
    if (hi >= 0) for (const r of rows.slice(hi + 1)) {
      if (!r[0] || !num(r[2])) continue;
      const type = r[1] === '입금' ? 'in' : r[1] === '내 계좌로 이동' ? 'move' : 'out';
      const x = { id: uid(), name: r[0], type, amt: num(r[2]), day: num(r[3]), acct: ensureAcct(r[4]), to: type === 'move' ? ensureAcct(r[5]) : '', cat: type === 'move' ? '' : (r[6] || ''), start: toDate(r[7]) || S.settings.start, end: toDate(r[8]) || '' };
      if (x.cat) ensureCat(x.cat, type === 'in' ? 'inc' : 'exp');
      S.rec.push(touch(x)); nr++;
    }
    if (na || nr) rep.push(`설정: 계좌 ${na}개, 정기 결제 ${nr}건`);
  }
  // 2) 입력
  for (const rows of sheets) {
    const h = rows[0] || []; if (!(h.includes('날짜') && h.includes('계좌') && h.includes('금액') && h.includes('구분'))) continue;
    const ix = k => h.indexOf(k); let n = 0, skip = 0;
    for (const r of rows.slice(1)) {
      const d = toDate(r[ix('날짜')]), amt = Math.abs(num(r[ix('금액')]));
      if (!d || !amt || !r[ix('계좌')]) { if (r.some(Boolean)) skip++; continue; }
      const g = r[ix('구분')], type = g === '입금' ? 'in' : (g === '내 계좌로 이동' || g === '이동') ? 'move' : 'out';
      const cat = type === 'move' ? '' : (r[ix('카테고리')] || '');
      if (cat) ensureCat(cat, type === 'in' ? 'inc' : 'exp');
      S.tx.push(touch({ id: uid(), date: d, acct: ensureAcct(r[ix('계좌')]), type, amt, cat, to: type === 'move' ? ensureAcct(r[ix('받는 계좌')]) : '', memo: ix('메모') >= 0 ? (r[ix('메모')] || '') : '' }));
      n++;
    }
    rep.push(`입력: 거래 ${n}건${skip ? ` (빈 줄 등 ${skip}건 건너뜀)` : ''}`);
  }
  // 3) 투자 기록 (월말 평가금액)
  for (const rows of sheets) {
    const hi = rows.findIndex(r => r[0] === '가계월'); if (hi < 1) continue;
    const H = rows[hi], names = rows[hi - 1]; let n = 0;
    H.forEach((c, j) => {
      if (c !== '월말 평가금액') return;
      let k = j; while (k > 0 && !names[k]) k--; const nm = names[k]; if (!nm) return;
      const a = S.accounts.find(x => x.name === nm) || A(ensureAcct(nm, 'invest'));
      for (const r of rows.slice(hi + 1)) { const m = String(r[0] || '').match(/(\d{4})년\s*(\d{1,2})월/); if (!m) continue; const v = num(r[j]); if (v) { S.val[`${a.id}|${m[1]}-${pad2(m[2])}`] = { v, u: now() }; n++; } }
    });
    if (n) rep.push(`투자 기록: 월말 평가 ${n}건`);
  }
  return rep;
}

INP.qe = qeInput;
ACT.qadd = qeAdd;
