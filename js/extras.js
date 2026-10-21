'use strict';
// 부가 기능: 카테고리 추정, 백업 알림, 미분류 정리, 잠금, 도움말, 설정 창
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
const uncatQueue = () => S.tx.filter(t => t.type !== 'move' && t.type !== 'adj' && !t.cat && +t.amt && t.date >= S.settings.start).sort((a, b) => a.date < b.date ? 1 : -1).map(t => t.id);
function uncatSheet(i) {
  const t = txById(UQ[i]);
  if (!t) { closeSheet(); return toast(i ? '미분류 정리를 마쳤어요' : '미분류 거래가 없어요'); }
  const kind = t.type === 'in' ? 'inc' : 'exp', g = guessCat(t.memo, t.type);
  openSheet(`${bh('미분류 정리', `${i + 1} / ${UQ.length}`, `<button class="btn"${at('uncatSkip', { i })}>건너뛰기</button>`)}
    <div class="uq"><div><b>${fmt(t.amt)}</b>원 <span class="mut">${TXL[t.type]}</span></div><div class="mut">${dLabel(t.date)} · ${esc(accName(t.acct))}${t.memo ? ' · ' + esc(t.memo) : ''}</div></div>
    <div class="chips">${S.cats.filter(c => c.k === kind).map(c => `<button class="chip${c.n === g ? ' on' : ''}"${at('uncatSet', { i, v: c.n })}>${catLbl(c.n)}</button>`).join('')}</div>`);
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
  { img: 'help/start.webp', t: '계좌 추가', p: '통장, 카드, 적금, 투자 계좌를 추가하고 현재 잔액을 입력하세요. 카드는 아직 결제되지 않은 금액을 마이너스로 입력해요.' },
  { img: 'help/rec.webp', t: '정기 결제 등록', p: '월급, 구독료, 관리비처럼 매달 같은 날 발생하는 금액은 정기 결제에 등록해 두면 해당 날짜에 자동으로 기록돼요.' },
  { img: 'help/quick.webp', t: '빠른 입력', p: '입력 탭 맨 위 칸에 "커피 4500"처럼 입력하고 완료를 누르세요. 계좌 이름을 앞에 붙이면 해당 계좌로 기록돼요.' },
];
const HELP = [
  { t: '처음 설정', img: 'help/start.webp', p: ['계좌를 추가하고 시작일 기준 잔액을 입력하세요. 카드는 결제 전 금액을 마이너스로 입력해요. 예: -300000', '시작일과 계좌 정보는 설정 → 기본값 설정에서 수정할 수 있어요.'] },
  { t: '빠른 입력', img: 'help/quick.webp', p: ['입력 탭 맨 위 칸에 한 줄로 입력하고 완료(Enter)를 누르세요. 날짜 칸을 비우면 오늘 날짜로 기록돼요.'],
    ex: [['커피 4500', '출금, 카테고리 자동 분류'], ['체크카드 점심 9000', '지정한 계좌에서 출금'], ['월급 2850000', '입금 (월급·급여·환불·이자 등)'], ['급여통장 → ISA 500000', '계좌 간 이동'], ['어제 버스 1500', '어제 날짜로 기록'], ['1.5만 장보기', '15,000원']] },
  { t: '수정과 삭제', img: 'help/row.webp', p: ['셀을 누르면 해당 칸만 수정할 수 있어요.', '행을 왼쪽으로 밀면 삭제 버튼이 나와요. 컴퓨터에서는 행을 오른쪽 클릭하세요.', '잔액이 실제와 다르면 계좌 화면의 "잔액 맞추기"에 실제 금액을 입력하세요. 차액은 조정 행으로 기록되고 통계에서는 제외돼요.', '잘못 입력했으면 위쪽 ↶로 되돌리세요.'] },
  { t: '계좌 이동과 카드값', p: ['카드값 결제, 적금 납입, 투자 계좌 입금처럼 내 계좌끼리 옮긴 돈은 "이동"으로 기록하세요. 지출이 중복으로 잡히지 않아요.'] },
  { t: '자동으로 기록되는 행', img: 'help/auto.webp', p: ['정기 결제, 자동 충전, 캐시백, 이자, 적금 납입은 해당 날짜에 자동으로 기록되고 회색 행으로 표시돼요.', '실제 금액과 다르면 행을 눌러 수정하세요.', '정기 결제는 설정 → 기본값 설정 → 정기 결제에서 등록해요.'] },
  { t: '이자 · 적금 · 예금', p: ['계좌 설정에 이율과 지급일을 입력하면 일별 잔액 기준으로 이자를 계산해 지급일에 입금해요.', '적금과 예금은 가입일, 만기일, 이율을 입력하면 만기일에 이자가 일괄 지급돼요. 적금은 월 납입액, 납입일, 출금 계좌를 지정하면 매달 자동으로 납입돼요.', '계좌 화면에서 만기 예상 금액을 확인할 수 있어요.'] },
  { t: '충전식 계좌와 캐시백', p: ['충전금이 기준 금액 이하로 내려가면 연결 계좌에서 자동 충전되고, 결제 금액에 따라 캐시백이 적립돼요.', '잔액은 충전금과 캐시백으로 나눠 표시돼요. 결제할 때 캐시백부터 쓰려면 기본값 설정 → 기타에서 "캐시백 자동 사용"을 켜세요.', '적립해 둔 캐시백은 결제 행의 "충전+캐시백" 칸을 누르거나, 빠른 입력 끝에 "캐시백으로"를 붙이면 사용돼요.'] },
  { t: '결산과 예산', img: 'help/dash.webp', p: ['달이 바뀌면 입력 탭 맨 위에 지난달 결산이 표시돼요. ◀ ▶로 지난달 거래를 볼 수 있어요.', '카테고리에 월 예산을 입력하면 한눈에 보기에 남은 금액이 표시돼요.'] },
  { t: '투자', p: ['투자 탭에 매월 평가금액을 입력하면 수익과 수익률이 계산돼요. 투자 계좌로 보낸 돈은 "이동"으로 기록하면 원금에 반영돼요.'] },
  { t: '백업과 기기 변경', img: 'help/gear.webp', p: ['데이터는 이 기기에만 저장돼요. 설정 → 백업 내보내기로 백업 파일을 저장해 두세요.', '새 기기에서는 첫 화면의 "백업 파일 불러오기"로 옮길 수 있어요.', '아이폰은 홈 화면에 추가한 앱으로만 사용하세요. Safari와 저장 공간이 분리돼 있어요.'] },
  { t: '잠금', p: ['설정 → 앱 잠금에서 PIN 4자리와 Face ID를 설정할 수 있어요. PIN을 잊으면 데이터를 삭제해야 하니 백업해 두세요.'] },
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
const tipBar = () => tipSeen() ? '' : `<div class="tipbar"><span>셀을 누르면 해당 칸을 수정하고, 행을 왼쪽으로 밀면 삭제할 수 있어요.</span><button class="link"${at('help')}>도움말</button><button class="mx"${at('tipClose')} aria-label="닫기">✕</button></div>`;
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
        ${tile('file', '시트 가져오기', 'importCsv', '셀가계부 양식 CSV')}
        ${tile('archive', '월 마감', 'closeMenu', '오래된 거래 정리')}
      </div>
      <div class="mgrp">기타</div>
      <div class="tiles">
        ${tile('help', '도움말', 'help', '사용법')}
        ${tile('theme', '화면 테마', 'theme', { auto: '자동', light: '밝게', dark: '어둡게' }[themePref()])}
        ${tile('lock', '앱 잠금', 'pinMenu', pinGet() ? (bioGet() ? 'PIN + Face ID' : '켜짐') : '꺼짐')}
        ${S?.accounts.some(a => a.type === 'foreign') ? tile('fx', '환율 새로고침', 'fxRefresh') : ''}
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
