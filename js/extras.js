'use strict';
// 부가 기능: 카테고리 추정, 백업 알림, 미분류 정리, 은행 내역, 잠금, 도움말, 설정 창
/* ---------- 카테고리 추정 (같은 메모의 예전 기록 → 키워드) ---------- */
function guessCat(memo, type) {
  if (!memo || type === 'move') return '';
  for (let i = S.tx.length - 1; i >= 0; i--) { const x = S.tx[i]; if (x.memo === memo && x.cat && x.type === type) return x.cat; }
  const kind = type === 'in' ? 'inc' : 'exp';
  for (const [re, c] of KW) if (re.test(memo) && catOf(c)?.k === kind) return c;
  return '';
}

/* ---------- 백업 알림 ---------- */
const BK = KEY + '.bk';
const bkGet = () => { try { return JSON.parse(localStorage.getItem(BK) || '{}'); } catch (e) { return {}; } };
const bkSet = o => { try { localStorage.setItem(BK, JSON.stringify({ ...bkGet(), ...o })); } catch (e) { } };
function backupNudge() {
  if (!S || S.tx.length < 10) return '';
  const b = bkGet(), t = TODAY();
  if (b.snooze && b.snooze > t) return '';
  const since = b.last || S.tx.reduce((m, x) => x.date < m ? x.date : m, t);
  const days = Math.round((new Date(t) - new Date(since)) / 864e5);
  if (days < (b.last ? 30 : 14)) return '';
  return `<div class="nudge"><span>${b.last ? `마지막 백업 ${days}일 전` : '아직 백업한 적이 없어요'}</span><button class="btn pri"${at('exportJson')}>백업</button><button class="btn"${at('bkLater')}>나중에</button></div>`;
}

/* ---------- 미분류 정리 ---------- */
let UQ = [];
const uncatQueue = () => S.tx.filter(t => t.type !== 'move' && !t.cat && +t.amt && t.date >= S.settings.start).sort((a, b) => a.date < b.date ? 1 : -1).map(t => t.id);
function uncatSheet(i) {
  const t = txById(UQ[i]);
  if (!t) { closeSheet(); return toast(i ? '미분류 정리를 마쳤어요' : '미분류 거래가 없어요'); }
  const kind = t.type === 'in' ? 'inc' : 'exp', g = guessCat(t.memo, t.type);
  openSheet(`${bh('미분류 정리', `${i + 1} / ${UQ.length}`, `<button class="btn"${at('uncatSkip', { i })}>건너뛰기</button>`)}
    <div class="uq"><div><b>${fmt(t.amt)}</b>원 <span class="mut">${TXL[t.type]}</span></div><div class="mut">${dLabel(t.date)} · ${esc(accName(t.acct))}${t.memo ? ' · ' + esc(t.memo) : ''}</div></div>
    <div class="chips">${S.cats.filter(c => c.k === kind).map(c => `<button class="chip${c.n === g ? ' on' : ''}"${at('uncatSet', { i, v: c.n })}>${catLbl(c.n)}</button>`).join('')}</div>`);
}

/* ---------- 은행·카드 내역 CSV ---------- */
async function readText(f) { // 은행 파일은 EUC-KR인 경우가 많음
  const buf = await f.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^\uFEFF/, ''); } catch (e) { }
  try { return new TextDecoder('euc-kr').decode(buf); } catch (e) { return new TextDecoder().decode(buf); }
}
function bankParse(rows) {
  const has = (c, re) => re.test(String(c || '').replace(/\s/g, ''));
  const RE = { date: /거래일|일자|날짜|일시|이용일|승인일|사용일/, out: /출금|지출|이용금액|결제금액|사용금액|승인금액|찾으신/, inn: /입금|맡기신/, amt: /^금액|거래금액/,
    memo: /내용|적요|거래처|가맹점|이용처|사용처|기재|메모|받는분|보낸분|상호/ };
  const hi = rows.findIndex(r => r.some(c => has(c, RE.date)) && r.some(c => has(c, RE.out) || has(c, RE.inn) || has(c, RE.amt)));
  if (hi < 0) return { items: [] };
  const h = rows[hi], col = re => h.findIndex(c => has(c, re));
  const ci = { date: col(RE.date), out: col(RE.out), inn: col(RE.inn), amt: col(RE.amt), memo: col(RE.memo) };
  const body = rows.slice(hi + 1), signed = ci.amt >= 0 && body.some(r => num(r[ci.amt]) < 0);
  const items = [];
  for (const r of body) {
    const date = toDate(r[ci.date]); if (!date) continue;
    const o = ci.out >= 0 ? Math.abs(num(r[ci.out])) : 0, i = ci.inn >= 0 ? Math.abs(num(r[ci.inn])) : 0;
    let type, amt;
    if (o) { type = 'out'; amt = o; } else if (i) { type = 'in'; amt = i; }
    else if (ci.amt >= 0 && num(r[ci.amt])) { const v = num(r[ci.amt]); type = v < 0 || !signed ? 'out' : 'in'; amt = Math.abs(v); }
    else continue;
    items.push({ date, type, amt: Math.round(amt), memo: ci.memo >= 0 ? String(r[ci.memo] || '').trim().slice(0, 60) : '' });
  }
  return { items };
}
function bankImport(items, acct) {
  // 이미 입력한 거래(같은 날짜·구분·금액)는 건너뜀 — 손으로 적은 메모가 달라도 중복으로 봄
  const k = t => [t.date, t.type, t.amt].join('|'), have = {};
  for (const t of S.tx) if (t.acct === acct) have[k(t)] = (have[k(t)] || 0) + 1;
  const list = []; let dup = 0, unc = 0, early = 0;
  for (const it of items) {
    if (have[k(it)]) { have[k(it)]--; dup++; continue; }
    const cat = guessCat(it.memo, it.type); if (!cat) unc++; if (it.date < S.settings.start) early++;
    list.push(touch({ id: uid(), date: it.date, acct, type: it.type, amt: it.amt, cat, to: '', memo: it.memo }));
  }
  if (list.length) commit(() => S.tx.push(...list));
  return { add: list.length, dup, unc, early };
}

/* ---------- 앱 잠금 (PIN + Face ID) ---------- */
const PINK = KEY + '.pin', BIOK = KEY + '.bio';
const pinGet = () => { try { return JSON.parse(localStorage.getItem(PINK) || 'null'); } catch (e) { return null; } };
const bioGet = () => { try { return localStorage.getItem(BIOK) || ''; } catch (e) { return ''; } };
async function pinHash(pin, salt) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
// Face ID: 아이폰 패스키(WebAuthn)로 기기에서 본인 확인만 받는다. 서버 없음.
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = x => Uint8Array.from(atob(x), c => c.charCodeAt(0));
async function bioAvailable() { try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (e) { return false; } }
async function bioEnroll() {
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: '셀가계부' },
    user: { id: crypto.getRandomValues(new Uint8Array(16)), name: '셀가계부', displayName: '셀가계부 잠금' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
    timeout: 60000, attestation: 'none' } });
  localStorage.setItem(BIOK, b64(cred.rawId));
}
async function bioCheck() {
  const id = bioGet(); if (!id) return false;
  const a = await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)),
    allowCredentials: [{ type: 'public-key', id: unb64(id), transports: ['internal'] }], userVerification: 'required', timeout: 60000 } });
  return !!(new Uint8Array(a.response.authenticatorData)[32] & 0x04); // UV 플래그: Face ID(또는 기기 암호)로 확인됨
}
const LAK = KEY + '.lockAfter', LA_LBL = { 0: '바로', 1: '1분 뒤', 5: '5분 뒤', 30: '30분 뒤', launch: '앱을 켤 때만' };
const lockAfter = () => { try { return localStorage.getItem(LAK) || '1'; } catch (e) { return '1'; } };
const LK = { buf: '', mode: '', first: '', fails: 0, until: 0, hiddenAt: 0, busy: false, change: false };
function showLock(mode) {
  LK.mode = mode; LK.buf = ''; const r = $('#lock'); if (!r) return; r.classList.add('on'); drawLock();
  if (mode === 'unlock' && bioGet()) setTimeout(() => bioUnlock(false), 250);
}
function hideLock() { const r = $('#lock'); if (r) { r.classList.remove('on'); r.innerHTML = ''; } LK.buf = ''; LK.mode = ''; }
function drawLock(msg = '') {
  const title = { unlock: 'PIN 입력', set: '새 PIN 4자리', set2: '한 번 더 입력', off: '현재 PIN 입력' }[LK.mode];
  $('#lock').innerHTML = `<div class="lk"><div class="ltop"><div class="logo">${LOGO}</div><div class="lt">${title}</div>
    <div class="ld">${[0, 1, 2, 3].map(() => '<i></i>').join('')}</div><div class="lm"></div></div>
    <div class="lp">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(k => k ? `<button${at('pinKey', { k })}>${k}</button>` : '<span></span>').join('')}</div>
    <div class="lbot">${LK.mode === 'unlock' && bioGet() ? `<button class="lbio"${at('bioUnlock')}>${ico('face', 18)}Face ID</button>` : ''}
    ${LK.mode === 'unlock' ? `<button class="lf"${at('pinForgot')}>PIN을 잊었어요</button>` : `<button class="lf"${at('pinCancel')}>취소</button>`}</div></div>`;
  lockDots(msg);
}
// 숫자를 누를 때는 동그라미와 안내만 바꾼다 (화면 전체를 다시 그리지 않아 빠름)
function lockDots(msg = '') {
  const r = $('#lock'); if (!r) return;
  r.querySelectorAll('.ld i').forEach((el, i) => el.classList.toggle('on', i < LK.buf.length));
  const m = r.querySelector('.lm'); if (m) m.textContent = msg;
}
async function bioUnlock(manual) {
  try { if (await bioCheck()) { LK.fails = 0; hideLock(); } }
  catch (e) { if (manual) lockDots('Face ID를 쓸 수 없어요. PIN을 입력하세요'); }
}
async function pinKey(k) {
  if (LK.busy) return;
  if (Date.now() < LK.until) return lockDots(`${Math.ceil((LK.until - Date.now()) / 1000)}초 뒤에 다시 시도하세요`);
  if (k === '⌫') { LK.buf = LK.buf.slice(0, -1); return lockDots(); }
  if (LK.buf.length >= 4) return;
  LK.buf += k; lockDots();
  if (LK.buf.length < 4) return;
  const pin = LK.buf; LK.busy = true;
  try {
    if (LK.mode === 'set') { LK.first = pin; LK.mode = 'set2'; LK.buf = ''; return drawLock(); }
    if (LK.mode === 'set2') {
      if (pin !== LK.first) { LK.mode = 'set'; LK.buf = ''; return drawLock('두 번 입력한 PIN이 달라요'); }
      const salt = [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(PINK, JSON.stringify({ salt, h: await pinHash(pin, salt) }));
      hideLock(); toast('앱 잠금을 켰어요');
      if (!bioGet() && await bioAvailable()) openSheet(`${bh('Face ID도 쓸까요?')}<div class="hint top">잠금 화면에서 Face ID로 바로 열 수 있어요. 안 되면 PIN으로 열면 돼요.</div>
        <div class="row2" style="margin-top:12px"><button class="btn" style="height:46px"${at('close')}>나중에</button><button class="btn pri" style="height:46px"${at('bioToggle')}>Face ID 켜기</button></div>`);
      return;
    }
    const p = pinGet();
    if (!p || await pinHash(pin, p.salt) !== p.h) {
      LK.fails++; LK.buf = '';
      if (LK.fails >= 5) { LK.fails = 0; LK.until = Date.now() + 30000; return lockDots('5번 틀려서 30초 동안 잠겨요'); }
      return lockDots('PIN이 맞지 않아요');
    }
    LK.fails = 0;
    if (LK.mode === 'off' && LK.change) { LK.change = false; LK.mode = 'set'; LK.buf = ''; return drawLock(); }
    if (LK.mode === 'off') { localStorage.removeItem(PINK); localStorage.removeItem(BIOK); hideLock(); return toast('앱 잠금을 껐어요'); }
    hideLock();
  } finally { LK.busy = false; }
}
/* ---------- 처음 안내 · 도움말 ---------- */
const GUIDE = [
  { img: 'help/start.webp', t: '계좌부터 넣어요', p: '통장, 카드, 투자 계좌를 하나씩 추가해요. 시작 잔액은 오늘 기준으로 적고, 카드는 아직 안 낸 카드값을 마이너스로 적어요.' },
  { img: 'help/rec.webp', t: '매달 나가는 돈은 한 번만', p: '월급, 구독료, 적금처럼 매달 같은 날 생기는 돈은 정기 결제에 등록해 두면 그날 자동으로 기록돼요.' },
  { img: 'help/quick.webp', t: '쓸 때마다 한 줄', p: '입력 탭 맨 위 칸에 "커피 4500"처럼 적고 완료를 누르면 끝이에요. 계좌 이름을 앞에 붙이면 그 계좌로 들어가요.' },
];
const HELP = [
  { t: '처음 설정', img: 'help/start.webp', p: ['계좌의 시작 잔액은 시작일 기준이에요. 시작일 이전 거래는 계산에서 빠져요.', '시작일은 설정 → 기본값 설정 → 기타에서 바꿀 수 있어요.', '카드는 남은 카드값을 마이너스로 적어요. 예: -300000'] },
  { t: '빠른 입력', img: 'help/quick.webp', p: ['입력 탭 맨 위 칸에 한 줄로 적어요. 날짜 칸을 비우면 오늘로 들어가요.'],
    ex: [['커피 4500', '출금, 커피·디저트'], ['체크카드 점심 9000', '체크카드에서 출금'], ['월급 2850000', '입금·월급·급여·보너스·환불·이자가 있으면 입금'], ['동벡 4500 커퓌', '계좌·카테고리 이름의 오타는 고쳐서 넣음'], ['급여통장 → ISA 500000', '내 계좌끼리 이동'], ['급여통장에서 ISA로 500000', '말로 적어도 이동'], ['체크카드로 이체 300000', '보고 있는 계좌에서 보내기'], ['국민카드에서 커피 4500', '계좌 이름 뒤 조사는 빼고 읽음'], ['어제 버스 1500', '어제 날짜로'], ['18600/3 저녁', '나눈 금액 6,200'], ['1.5만 장보기', '15,000']] },
  { t: '컴퓨터·아이패드', p: ['화면이 넓으면 표가 넓게 펼쳐지고, 탭은 아래 시트 탭으로 옮겨요.'],
    ex: [['1 ~ 4, Ctrl+PgUp/PgDn', '탭 이동'], ['/', '빠른 입력 칸으로'], ['방향키, Tab, Home/End, PgUp/PgDn', '셀 이동'], ['Enter, F2', '선택한 셀 고치기'], ['금액 셀에서 숫자', '새 금액 바로 입력'], ['Esc', '선택 풀기'], ['Delete', '선택한 행 삭제'], ['Ctrl+Z / Ctrl+Y', '되돌리기 / 다시 실행'], ['아래 100% 누르기', '확대/축소 비율 고르기']] },
  { t: '고치기와 지우기', img: 'help/row.webp', p: ['셀을 누르면 그 칸만 고칠 수 있어요.', '줄을 왼쪽으로 밀면 뒤에서 삭제 버튼이 나와요. 왼쪽 행 번호를 눌러도 복제, 삭제, 색 표시를 할 수 있어요.', '잘못 눌렀으면 위쪽 ↶로 되돌려요.'] },
  { t: '자동으로 생기는 행', img: 'help/auto.webp', p: ['구분이 "자동"인 회색 행은 정기 결제, 충전식 카드 충전, 캐시백이에요.', '실제 금액이 다르면 눌러서 금액을 고쳐요.', '캐시백 행을 누르면 그 거래만 비율(5·8·10%, 직접 입력)을 바꾸거나 캐시백을 뺄 수 있어요.'] },
  { t: '카드값과 계좌 이동', p: ['카드값 결제, 적금 납입, 투자 계좌 입금은 구분을 "이동"으로 적어요. 지출로 두 번 잡히지 않아요.', '빠른 입력: 생활비통장 → 체크카드 300000'] },
  { t: '결산과 지난달 보기', img: 'help/dash.webp', p: ['달이 바뀌면 입력 탭은 빈 칸으로 시작하고, 맨 위에 지난달 결산이 나와요.', '◀ ▶로 지난달 거래와 요약을 볼 수 있어요.', '카테고리에 월 예산을 넣으면 한눈에 보기에 남은 금액이 나와요.'] },
  { t: '투자', p: ['투자 탭에서 달마다 증권 앱의 평가금액만 넣으면 수익과 수익률이 계산돼요.', '투자 계좌로 보낸 돈은 "이동"으로 적으면 넣은 돈에 자동으로 더해져요.'] },
  { t: '백업과 휴대폰 변경', img: 'help/gear.webp', p: ['데이터는 이 휴대폰 안에만 있어요. 설정 → 백업 내보내기로 파일을 받아 두세요.', '새 휴대폰에서는 처음 화면의 "백업 파일 불러오기"를 누르면 그대로 옮겨져요.', '아이폰은 홈 화면에 추가한 아이콘으로만 쓰세요. 사파리와 저장 공간이 따로예요.'] },
  { t: '잠금', p: ['설정 → 앱 잠금에서 PIN 4자리를 정하고 Face ID를 켤 수 있어요.', 'PIN을 잊으면 이 기기의 가계부를 지워야 풀려요. 백업을 꼭 해 두세요.'] },
];
const helpImg = src => src ? `<img class="himg" src="${src}" alt="" loading="lazy">` : '';
function openGuide(i) {
  const r = $('#modal-root'), g = GUIDE[i];
  r.innerHTML = `<div class="mdim"></div><div class="mbox guide" role="dialog" aria-modal="true" aria-label="처음 안내">
    <div class="mbody"><div class="gstep">${i + 1} / ${GUIDE.length}</div>${helpImg(g.img)}<h3>${g.t}</h3><p>${g.p}</p></div>
    <div class="gbtn"><button class="btn"${at('guideSkip')}>건너뛰기</button><button class="btn pri"${at('guideNext', { i })}>${i < GUIDE.length - 1 ? '다음' : '계좌 추가하기'}</button></div></div>`;
  r.classList.add('on');
}
function openHelp() {
  const r = $('#modal-root');
  r.innerHTML = `<div class="mdim"${at('gearClose')}></div><div class="mbox" role="dialog" aria-modal="true" aria-label="도움말">
    <div class="mh"><b>도움말</b><button class="mx"${at('gearClose')} aria-label="닫기">✕</button></div>
    <div class="mbody hp">${HELP.map((h, i) => `<details${i ? '' : ' open'}><summary>${h.t}</summary>${helpImg(h.img)}${h.p.map(x => `<p>${esc(x)}</p>`).join('')}
      ${h.ex ? `<table class="hex">${h.ex.map(([a, b]) => `<tr><td><code>${esc(a)}</code></td><td>${esc(b)}</td></tr>`).join('')}</table>` : ''}</details>`).join('')}</div></div>`;
  r.classList.add('on');
}
const TIPK = KEY + '.tip1';
const tipSeen = () => { try { return !!localStorage.getItem(TIPK); } catch (e) { return true; } };
const tipBar = () => tipSeen() ? '' : `<div class="tipbar"><span>셀을 누르면 그 칸을 고치고, 행 번호를 누르면 복제나 삭제를 할 수 있어요.</span><button class="link"${at('help')}>도움말</button><button class="mx"${at('tipClose')} aria-label="닫기">✕</button></div>`;
/* ---------- 설정 창 (⚙) ---------- */
function openGear() {
  const r = $('#modal-root'); if (!r || !S) return;
  const syncLbl = Sync.label ? Sync.label() : '';
  const tile = (ic, l, a, sub = '', cls = '') => `<button class="tile ${cls}"${at('gearGo', { v: a })}><span class="ti">${ico(ic)}</span><span class="tl">${l}</span>${sub ? `<span class="ts">${esc(sub)}</span>` : ''}</button>`;
  r.innerHTML = `<div class="mdim"${at('gearClose')}></div><div class="mbox" role="dialog" aria-modal="true" aria-label="설정">
    <div class="mh"><b>설정</b><button class="mx"${at('gearClose')} aria-label="닫기">✕</button></div>
    <div class="mbody">
      <div class="mgrp">${Sync.status === 'off' ? '데이터' : '데이터 · 동기화'}</div>
      <div class="tiles">
        ${Sync.status === 'off' ? '' : tile('cloud', '동기화', 'syncMenu', syncLbl)}
        ${tile('down', '백업 내보내기', 'exportJson', bkGet().last ? `${dLabel(bkGet().last)} 마지막` : '')}
        ${tile('up', '백업 불러오기', 'importJson')}
        ${tile('bank', '내역 가져오기', 'importBank', '은행·카드 CSV')}
        ${tile('file', '시트 가져오기', 'importCsv', '구글 시트 CSV')}
        ${tile('archive', '월 마감', 'closeMenu', '오래된 거래 정리')}
      </div>
      <div class="mgrp">기타</div>
      <div class="tiles">
        ${tile('help', '도움말', 'help', '사용법')}
        ${tile('theme', '화면 테마', 'theme', { auto: '자동', light: '밝게', dark: '어둡게' }[themePref()])}
        ${tile('lock', '앱 잠금', 'pinMenu', pinGet() ? (bioGet() ? 'PIN + Face ID' : '켜짐') : '꺼짐')}
        ${S?.accounts.some(a => a.type === 'foreign') ? tile('fx', '환율 새로고침', 'fxRefresh') : ''}
        ${tile('refresh', '앱 업데이트', 'appUpdate', `버전 ${APP_VER}`)}
        ${isIOSApp() ? tile('ruler', '화면 높이 보정', 'hfix', hfixOn() ? '켜짐' : '꺼짐') : ''}
        ${tile('trash', '초기화', 'reset', '이 기기', 'dan')}
      </div>
      <div class="mnote">데이터는 이 기기에만 저장돼요. 백업을 가끔 내보내 두세요.<br><span style="color:var(--muted)">버전 ${APP_VER}</span></div>
    </div>
    <button class="mbase"${at('gearGo', { v: 'openBase' })}>기본값 설정<small>계좌 · 카테고리 · 정기 결제 · 시작일</small></button>
  </div>`;
  r.classList.add('on');
}
function closeGear() { const r = $('#modal-root'); if (r) { r.classList.remove('on'); r.innerHTML = ''; } }
