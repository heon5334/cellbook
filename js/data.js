'use strict';
// 데이터: 새로 시작, 초기화, 백업, 가져오기
ACT.startNew = () => { S = blankState(); persist(); U.tab = 'assets'; U.detail = null; render(); acctForm(null); };
ACT.reset = () => confirmSheet('이 기기 데이터 초기화', '이 기기에 저장된 가계부를 모두 지울까요?<br>로그인 동기화 중이면 클라우드 데이터는 남아 있어요.', '초기화', () => {
  try { localStorage.removeItem(KEY); } catch (e) { }
  S = null; hist.length = 0; fut.length = 0; invalidate(); Sync.onReset && Sync.onReset(); render();
}, true);

/* ---------- 백업 파일 (암호 선택) ---------- */
// 암호: PBKDF2(SHA-256)로 키를 만들고 AES-GCM으로 잠금. 암호는 어디에도 저장하지 않음
const ENC_ITER = 210000;
const b64big = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
async function bkKey(pw, salt, iter = ENC_ITER) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encBackup(obj, pw, iter = ENC_ITER) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await bkKey(pw, salt, iter), new TextEncoder().encode(JSON.stringify(obj)));
  return { app: 'cellbook', enc: 'aes-gcm', v: 1, iter, salt: b64big(salt), iv: b64big(iv), data: b64big(ct) };
}
async function decBackup(d, pw) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(d.iv) }, await bkKey(pw, unb64(d.salt), +d.iter || ENC_ITER), unb64(d.data));
  return JSON.parse(new TextDecoder().decode(pt));
}
function download(obj, name) {
  const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const bkName = enc => `셀가계부_백업_${TODAY()}${enc ? '_암호' : ''}.json`;
const bkDone = () => { bkSet({ last: TODAY(), snooze: '' }); invalidate(); if (S) render(); };
ACT.exportMenu = () => openSheet(`${bh('백업 파일 저장', `계좌 ${S.accounts.length}개 · 거래 ${S.tx.length}건`)}
  <div class="opts"><button class="opt"${at('exportJson')}>${ico('down', 20)}<span class="ot">그냥 저장<small>열면 내용을 볼 수 있는 파일이에요</small></span></button>
  <button class="opt"${at('exportEnc')}>${ico('lock', 20)}<span class="ot">암호 걸고 저장<small>파일이 남의 손에 가도 암호 없이는 못 열어요</small></span></button></div>
  <div class="hint">저장한 파일은 아이클라우드 드라이브나 메일처럼 이 기기 밖에 두세요.</div>`);
ACT.exportJson = () => { closeSheet(); download(S, bkName(false)); bkDone(); toast('백업 파일을 저장했어요'); };
ACT.exportEnc = () => openSheet(`${bh('암호 걸고 저장')}<div class="hint top">이 암호는 어디에도 저장되지 않아요. 잊으면 이 파일은 열 수 없어요.</div>
  <div class="lbl">암호 (4자 이상)</div><div class="fld"><input type="password" id="pw1" autocomplete="new-password" autofocus></div>
  <div class="lbl">한 번 더</div><div class="fld"><input type="password" id="pw2" autocomplete="new-password"></div>
  <button class="bigbtn"${at('exportEncGo')}>저장</button>`);
ACT.exportEncGo = async () => {
  const p1 = fv('pw1'), p2 = fv('pw2');
  if (p1.length < 4) return toast('암호는 4자 이상으로 해 주세요');
  if (p1 !== p2) return toast('두 번 넣은 암호가 달라요');
  try { const o = await encBackup(S, p1); closeSheet(); download(o, bkName(true)); bkDone(); toast('암호를 걸어 저장했어요'); }
  catch (e) { toast('이 브라우저에서는 암호 저장을 할 수 없어요'); }
};

async function readText(f) { // 엑셀에서 저장한 CSV는 EUC-KR인 경우가 있음
  const buf = await f.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^\uFEFF/, ''); } catch (e) { }
  try { return new TextDecoder('euc-kr').decode(buf); } catch (e) { return new TextDecoder().decode(buf); }
}
let FILEMODE = '';
ACT.importJson = () => { closeSheet(); FILEMODE = 'json'; const f = $('#file'); f.accept = '.json,application/json'; f.multiple = false; f.value = ''; f.click(); };
ACT.importCsv = () => { FILEMODE = 'csv'; const f = $('#file'); f.accept = '.csv,text/csv'; f.multiple = true; f.value = ''; f.click(); };
// 백업 파일 검사: 형식이 맞는지, 몇 건인지, 읽을 수 없는 기록은 몇 건인지
function checkBackup(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.accounts) || !Array.isArray(d.tx)) return { ok: false, msg: '셀가계부 백업 파일이 아니에요' };
  if (+d.ver > VER) return { ok: false, msg: '더 새 버전 앱에서 만든 백업이에요. 앱을 새로고침한 뒤 다시 불러오세요' };
  let bad = 0;
  const tx = d.tx.filter(t => { const ok = t && typeof t === 'object' && t.id && isDate(t.date) && Number.isFinite(+t.amt) && (!t.type || TXL[t.type]); if (!ok) bad++; return ok; });
  const accounts = d.accounts.filter(a => { const ok = a && typeof a === 'object' && a.id && a.name != null; if (!ok) bad++; return ok; });
  const s = normalize({ ...d, accounts, tx });
  const ds = s.tx.map(t => t.date).sort();
  return { ok: true, s, bad, n: s.tx.length, na: s.accounts.length, from: ds[0] || '', to: ds[ds.length - 1] || '' };
}
function applyBackup(v) {
  const go = () => {
    const old = S; if (old) hist.push(JSON.stringify(old));
    S = stampAll(v.s); if (old) for (const c of COLLS) for (const x of old[c]) if (!S[c].some(y => y.id === x.id)) S.del[x.id] = now();
    delete S.demo; invalidate(); persist(); U.tab = 'home'; U.detail = null; render(); toast(`불러왔어요 · 거래 ${S.tx.length}건`, !!old);
  };
  const msg = `계좌 <b>${v.na}개</b> · 거래 <b>${v.n}건</b>${v.from ? `<br>${v.from} ~ ${v.to}` : ''}${v.bad ? `<br><span class="neg">읽을 수 없는 기록 ${v.bad}건은 빼고 불러와요</span>` : ''}`;
  if (S && (S.tx.length || S.accounts.length)) confirmSheet('백업 불러오기', `${msg}<br><br>지금 가계부를 이 파일로 <b>바꿀까요?</b>`, '바꾸기', go, true);
  else confirmSheet('백업 불러오기', msg, '불러오기', go);
}
function askPw(d) {
  SH.enc = d;
  openSheet(`${bh('암호가 걸린 백업', '저장할 때 정한 암호를 넣으세요')}<div class="fld"><input type="password" id="pwIn" autocomplete="current-password" enterkeyhint="done" autofocus></div>
    <button class="bigbtn"${at('importPw')}>열기</button>`);
}
ACT.importPw = async () => {
  const d = SH.enc, pw = fv('pwIn'); if (!d || !pw) return;
  let x; try { x = await decBackup(d, pw); } catch (e) { return toast('암호가 맞지 않아요'); }
  closeSheet(); const v = checkBackup(x); if (!v.ok) return toast(v.msg); applyBackup(v);
};
async function onFiles(files) {
  if (!files.length) return;
  if (FILEMODE === 'json') {
    let d; try { d = JSON.parse(await files[0].text()); } catch (e) { return toast('셀가계부 백업 파일이 아니에요'); }
    if (d && d.enc && d.data) return askPw(d);
    const v = checkBackup(d); if (!v.ok) return toast(v.msg);
    return applyBackup(v);
  }
  const texts = []; for (const f of files) texts.push(await readText(f));
  if (!S) S = blankState();
  hist.push(JSON.stringify(S));
  const rep = importCsv(texts.map(parseCsv));
  S.demo = false; invalidate(); persist(); if (S.tx.length || S.accounts.length) { U.tab = 'home'; } render();
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
const TYPE_KO = { '입출금': 'bank', '카드': 'card', '충전식': 'prepaid', '적금': 'saving', '예금': 'deposit', '투자': 'invest', '해외': 'foreign' };
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

/* ---------- 오래된 거래 정리 (월 마감) ---------- */
function closeMonths() {
  const out = [], cm = ym(TODAY());
  for (let m = ym(S.settings.start), g = 0; m < cm && g < 600; m = addM(m, 1), g++) {
    const e = mRange(m)[1]; out.push([m, S.tx.filter(t => t.date <= e && t.date >= S.settings.start).length]);
  }
  return out;
}
function doClose(M) {
  const C = mRange(M)[1], ns = addD(C, 1);
  if (C < S.settings.start) return toast('이미 정리된 달이에요');
  if (M >= ym(TODAY())) return toast('이번 달은 정리할 수 없어요');
  const st0 = S.settings.start;
  commit(() => {
    // 1) 달별 요약 저장 (지우기 전 데이터로 계산)
    for (let m = ym(st0), g = 0; m <= M && g < 600; m = addM(m, 1), g++) {
      const [s, e] = mRange(m), stt = mstats(m), gg = groups(endOf(m)), inv = {};
      let isa = 0;
      for (const a of S.accounts.filter(x => x.type === 'invest')) { const x = invSeries(a).find(y => y.m === m); if (x) inv[a.id] = { v: x.v, pl: x.pl, c: x.c }; }
      for (const a of S.accounts.filter(x => x.isa)) for (const r of led()) { if (r.date < s || r.date > e || r.date < st0) continue; if ((r.type === 'move' && r.to === a.id) || (r.type === 'in' && r.acct === a.id)) isa += r.amt; }
      S.arch[m] = { inc: stt.inc, exp: stt.exp, cats: stt.cats, g: { cash: gg.cash, invest: gg.invest, foreign: gg.foreign, total: gg.total }, inv, isa, n: S.tx.filter(t => t.date >= s && t.date <= e).length, u: now() };
    }
    // 2) 정리 시점 잔액·투자 원금을 새 시작값으로
    const nb = {};
    for (const a of S.accounts) {
      if (a.type === 'invest') { const x = invSeries(a).filter(y => y.m <= M).pop(); if (x) nb[a.id] = { start: x.v, prin: x.prin }; }
      else if (a.type === 'prepaid') { const [c, cb] = poolsAt(a.id, C); nb[a.id] = { start: c, cbStart: cb }; }
      else if (a.type !== 'foreign') nb[a.id] = { start: balAt(a.id, C) };
    }
    for (const a of S.accounts) if (nb[a.id]) { Object.assign(a, nb[a.id]); touch(a); }
    // 3) 그 달까지의 거래 삭제
    const gone = new Set(S.tx.filter(t => t.date <= C).map(t => t.id)), t = now();
    S.tx = S.tx.filter(x => !gone.has(x.id)); for (const id of gone) S.del[id] = t;
    S.settings = { ...S.settings, start: ns, u: now() };
  });
  hist.length = 0; fut.length = 0; render();
  toast(`${mLabel(M)}까지 정리했어요 · 요약만 남았어요`);
}

ACT.closeMenu = () => {
  const ms = closeMonths();
  if (!ms.length) return toast('정리할 지난달이 없어요');
  openSheet(`${bh('오래된 거래 정리', '월 마감')}
    <div class="hint top lg">고른 달까지의 <b>거래를 지우고 달별 요약만</b> 남겨요 (수입·지출, 카테고리별 합계, 투자 수익, 총자산).<br>
    계좌 잔액과 투자 원금은 그대로 이어져요. <b class="neg">지운 거래는 되돌릴 수 없어요.</b></div>
    <div class="acts" style="margin-top:10px">${ms.map(([m, n]) => `<button class="btn"${at('closePick', { m })}>${mLabel(m)}까지 · 거래 ${n}건</button>`).join('')}</div>`);
};
ACT.closePick = d => {
  const n = closeMonths().find(x => x[0] === d.m)?.[1] || 0;
  SH.closeM = d.m;
  openSheet(`${bh(`${mLabel(d.m)}까지 정리`, '되돌릴 수 없어요')}
    <div class="hint top lg">거래 <b>${n}건</b>을 지우고 요약만 남겨요.<br>지우기 전에 백업 파일을 내보내 두는 걸 권해요.</div>
    <button class="bigbtn ghost"${at('exportJson')}>백업 파일 먼저 내보내기</button>
    <button class="bigbtn dan"${at('closeGo')}>정리하기</button><button class="bigbtn ghost"${at('close')}>취소</button>`);
};
ACT.closeGo = () => { const m = SH.closeM; closeSheet(); doClose(m); };
