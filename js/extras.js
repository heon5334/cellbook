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

// 키워드로만 추정 (예전 기록은 보지 않음) — 메모와 카테고리가 어긋났는지 볼 때
function kwCat(memo, type) {
  const kind = type === 'in' ? 'inc' : 'exp';
  for (const [re, c] of KW) if (re.test(memo || '') && catOf(c)?.k === kind) return c;
  return '';
}

/* ---------- 백업 알림 ---------- */
const BK = KEY + '.bk';
const bkGet = () => { try { return JSON.parse(localStorage.getItem(BK) || '{}'); } catch (e) { return {}; } };
const bkSet = o => { try { localStorage.setItem(BK, JSON.stringify({ ...bkGet(), ...o })); } catch (e) { } };
function backupDue() {
  if (!S || S.tx.length < 10) return '';
  const b = bkGet(), t = TODAY(), every = b.every ?? 30;
  if (!+every || (b.snooze && b.snooze > t)) return '';
  const since = b.last || S.tx.reduce((m, x) => x.date < m ? x.date : m, t);
  const days = dayGap(since, t);
  if (days < (b.last ? +every : Math.min(14, +every))) return '';
  return b.last ? `마지막 백업이 ${days}일 전이에요` : '아직 백업 파일을 저장한 적이 없어요';
}
const REMK = KEY + '.rem';
const remindSnooze = () => { try { return localStorage.getItem(REMK) || ''; } catch (e) { return ''; } };

/* ---------- 확인할 것 (홈) ---------- */
const okHas = (t, k) => (t.ok || []).includes(k);
const XFER_RE = /이체|송금|저축|적금|청약|카드값|카드 대금|카드대금|충전|내 ?계좌|옮김|투자|증권|ISA|연금/i;
const SETTLE_RE = /n빵|엔빵|1\/n|정산|더치|환불|반반|나눠|돌려받|갚/i;
function inbox() {
  if (!S) return [];
  return MEMO.inbox ??= (() => {
    const T = TODAY(), st = S.settings.start, from = addD(T, -45), items = [];
    const recent = S.tx.filter(t => t.date >= from && t.date >= st && t.date <= T && +t.amt);
    // 정산·환불: 나눠 낸 지출과 연결
    for (const t of recent) if (t.type === 'in' && !t.link && !okHas(t, 'link') && SETTLE_RE.test(t.memo || ''))
      items.push({ ic: 'link', tone: 'blue', t: `‘${esc(t.memo)}’ +${fmt(t.amt)}원`, s: '나눠 낸 지출과 연결하면 통계에 실제로 쓴 돈만 잡혀요', b: [['연결', 'linkOpen', { id: t.id }, 1], ['아니요', 'dismiss', { id: t.id, k: 'link' }]] });
    // 계좌 이동을 지출·수입으로 적은 것
    const used = new Set(); let nx = 0;
    for (const o of [...recent].reverse()) {
      if (nx >= 3) break;
      if (o.type !== 'out' || okHas(o, 'xfer') || used.has(o.id)) continue;
      const p = recent.find(i => i.type === 'in' && !used.has(i.id) && !okHas(i, 'xfer') && !i.link && i.acct !== o.acct && +i.amt === +o.amt && Math.abs(dayGap(o.date, i.date)) <= 1);
      if (p) {
        used.add(o.id); used.add(p.id); nx++;
        items.push({ ic: 'move', t: `${accS(o.acct)} 출금과 ${accS(p.acct)} 입금이 ${fmt(o.amt)}원으로 같아요`, s: '내 계좌끼리 옮긴 돈이면 이동으로 바꿔야 지출·수입에 안 잡혀요', b: [['이동으로', 'xferFix', { id: o.id, p: p.id }, 1], ['아니요', 'dismiss', { id: o.id, k: 'xfer', p: p.id }]] });
        continue;
      }
      const memo = o.memo || '', hit = memo && accts().find(a => a.id !== o.acct && a.type !== 'card' && memo.replace(/\s/g, '').includes(a.name.replace(/\s/g, '')));
      if (XFER_RE.test(memo) || hit) { nx++; items.push({ ic: 'move', t: `‘${esc(memo)}’ ${fmt(o.amt)}원이 지출로 적혔어요`, s: hit ? `${esc(hit.name)}(으)로 옮긴 돈인가요?` : '내 계좌로 옮긴 돈이면 이동으로 바꾸세요', b: [['이동으로', 'xferFix', { id: o.id, to: hit?.id || '' }, 1], ['지출 맞아요', 'dismiss', { id: o.id, k: 'xfer' }]] }); }
    }
    // 메모와 카테고리가 어긋남 (같은 메모를 같은 카테고리로 두 번 넘게 썼으면 그 사람 방식으로 보고 넘어감)
    let nc = 0; const mc = new Map(); for (const x of S.tx) if (x.memo && x.cat) { const k = x.memo + '|' + x.cat; mc.set(k, (mc.get(k) || 0) + 1); }
    for (const t of [...recent].reverse()) {
      if (nc >= 3) break;
      if (!t.cat || !t.memo || okHas(t, 'cat') || (t.type !== 'out' && t.type !== 'in')) continue;
      const g = kwCat(t.memo, t.type); if (!g || g === t.cat) continue;
      if ((mc.get(t.memo + '|' + t.cat) || 0) >= 2) continue;
      nc++; items.push({ ic: 'alert', t: `‘${esc(t.memo)}’ 카테고리가 ${esc(t.cat)}이에요`, s: `${esc(g)}이(가) 맞나요?`, b: [[esc(g), 'catFix', { id: t.id, v: g }, 1], ['그대로', 'dismiss', { id: t.id, k: 'cat' }]] });
    }
    const uq = uncatQueue(); if (uq.length) items.push({ ic: 'dots', t: `카테고리 없는 기록 ${uq.length}건`, s: '골라 주면 통계가 정확해져요', b: [['정리', 'fixUncat', {}, 1]] });
    const pm = addM(ym(T), -1);
    if (pm >= ym(invStart())) for (const a of accts().filter(x => x.type === 'invest')) if (getVal(a.id, pm) == null && !archOf(pm))
      items.push({ ic: 'chart', t: `${esc(a.name)} ${mShort(pm)} 말 예탁자산`, s: '증권사 앱의 예수금과 평가금을 넣으면 수익이 계산돼요', b: [['입력', 'val', { id: a.id, m: pm }, 1]] });
    if (fxCurs().some(c => !S.accounts.some(a => a.type === 'foreign' && a.cur === c && +a.rate)) && (!S.fx.at || dayGap(S.fx.at, T) > 7))
      items.push({ ic: 'fx', t: S.fx.at ? `환율이 ${dayGap(S.fx.at, T)}일 전 기준이에요` : '해외 자산 환율이 아직 없어요', s: '새로고침하면 오늘 환율로 바꿔요', b: [['새로고침', 'fxRefresh', {}, 1]] });
    const bm = backupDue(); if (bm) items.push({ ic: 'down', t: bm, s: '기기를 바꾸거나 잃어버려도 되살릴 수 있어요', b: [['저장', 'exportMenu', {}, 1], ['나중에', 'bkLater']] });
    const rd = +S.settings.remind;
    if (rd && S.tx.length) {
      const last = S.tx.reduce((m, x) => x.date <= T && x.date > m ? x.date : m, ''), n = last ? dayGap(last, T) : 0;
      if (n >= rd && remindSnooze() !== T) items.push({ ic: 'bell', t: `${n}일째 기록이 없어요`, s: '빠뜨린 지출이 없는지 확인해 보세요', b: [['적기', 'focusQ', {}, 1], ['오늘은 그만', 'remindLater']] });
    }
    // 누르면: 거래 알림은 그 거래의 수정 화면, 나머지는 첫 번째 동작. 밀면: 그 알림의 '아니요/나중에', 없으면 오늘 하루 숨김
    const hide = todoHidden();
    for (const it of items) {
      const [go, dis] = it.b, a = go[1], d = go[2] || {};
      it.key = a + ':' + (d.id || d.m || '') + (d.p ? ':' + d.p : '');
      it.go = ['linkOpen', 'xferFix', 'catFix'].includes(a) ? ['tx', { id: d.id }] : [a, d];
      it.dis = dis ? [dis[1], dis[2] || {}] : ['todoHide', { k: it.key }];
    }
    return items.filter(it => !hide[it.key]);
  })();
}
const THK2 = KEY + '.todoHide';
function todoHidden() { try { const o = JSON.parse(localStorage.getItem(THK2) || '{}'); const T = TODAY(); for (const k in o) if (o[k] !== T) delete o[k]; return o; } catch (e) { return {}; } }
function todoHide(k) { const o = todoHidden(); o[k] = TODAY(); try { localStorage.setItem(THK2, JSON.stringify(o)); } catch (e) { } }

/* ---------- 미분류 정리 ---------- */
let UQ = [];
const uncatQueue = () => S.tx.filter(t => t.type !== 'move' && t.type !== 'adj' && t.type !== 'fx' && !t.cat && +t.amt && t.date >= S.settings.start).sort((a, b) => a.date < b.date ? 1 : -1).map(t => t.id);
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
const HELP = [
  { t: '처음 설정', p: ['자산 탭에서 계좌를 추가하고 시작일 기준 잔액을 입력하세요. 카드는 결제 전 금액을 마이너스로 입력해요.', '설정에서 한 달 예산을 정하면 홈에 오늘 쓸 수 있는 돈이 보여요.'] },
  { t: '한 줄 입력', p: ['아래 입력창에 적고 보내기를 누르세요. 위에 "이렇게 기록돼요"가 먼저 보이고, 카테고리·계좌·날짜를 눌러 바꿀 수 있어요.', '입력창이 비어 있을 때 + 를 누르면 칸을 하나씩 채우는 입력 창이 열려요.', '날짜 칩으로 고른 날짜는 보낸 뒤에도 유지되고, 내역을 스크롤하면 맨 위에 보이는 날짜가 입력 날짜가 돼요. 날이 바뀌면 오늘로 돌아와요.'] },
  { t: '정산 · 환불', p: ['친구에게 나눠 낸 돈을 돌려받았으면 그 입금 기록을 열어 "지출과 연결"을 누르세요. 통계에는 실제로 쓴 돈만 잡히고, 받은 돈은 수입에서 빠져요.'] },
  { t: '수정 · 삭제', p: ['기록을 누르면 모든 칸을 고칠 수 있어요. 삭제하거나 바꾼 뒤 아래 알림의 "되돌리기"로 되돌릴 수 있어요.', '잔액이 실제와 다르면 계좌 화면의 "잔액 맞추기"에 실제 금액을 넣으세요. 차액은 조정 기록으로 남고 통계에는 안 들어가요.'] },
  { t: '계좌 이동 · 카드값', p: ['카드값 결제, 적금 납입, 투자 계좌 입금처럼 내 계좌끼리 옮긴 돈은 "이동"으로 기록하세요. 지출이 두 번 잡히지 않아요.'] },
  { t: '자동으로 기록되는 것', p: ['정기 결제, 자동 충전, 캐시백, 이자, 적금 자동 납입은 그날 자동으로 기록되고 작은 표시가 붙어요. 금액이 다르면 눌러서 고치세요.', '정기 결제는 설정 → 정기 결제 · 이체에서 등록해요.'] },
  { t: '이자 · 적금 · 청약', p: ['계좌 설정에 이율과 지급일을 넣으면 하루하루 잔액으로 이자를 계산해 지급일에 넣어 줘요.', '적금은 가입일·만기일·이율, 매달 납입액·납입일·출금 계좌를 정하면 매달 자동으로 납입돼요. 청약처럼 만기가 없으면 만기일은 비워 두세요.'] },
  { t: '충전식 페이와 캐시백', p: ['충전금이 기준 아래로 내려가면 연결 계좌에서 자동 충전되고, 쓴 만큼 캐시백이 쌓여요.', '쌓인 캐시백을 쓰려면 입력 끝에 "캐시백으로"를 붙이거나 그 기록을 열어 캐시백 사용을 고르세요.'] },
  { t: '통계 · 예산 · 태그', p: ['통계에서 이번 달, 지난달, 3개월, 직접 고른 기간을 볼 수 있어요. 카테고리를 누르면 태그별로 나눠 보여요.', '카테고리마다 월 예산을 정하면 홈에서 얼마나 썼는지 보여요.'] },
  { t: '투자', p: ['투자 계좌는 달마다 말일의 예수금(현금)과 평가금(유가증권)을 넣으면 그 합을 예탁자산으로 보고 수익과 수익률을 계산해요. 넣을 때가 되면 홈의 "확인할 것"에 떠요.', '넣고 뺀 돈은 수익이 아니라 원금의 증감으로 봐요. 수익 = 예탁자산 − (시작 자산 + 넣은 돈 − 뺀 돈). 수익률은 증권사 기간별 수익률처럼 넣은 돈을 날짜로 가중해 계산해요(10/20에 넣은 돈은 31일 중 12일만큼). 투자 계좌로 보낸 돈은 꼭 "이동"으로 기록하세요.', '설정 → 투자 집계 시작일은 가계부 시작일과 따로 정할 수 있어요. 투자 계좌의 시작 자산은 이날 기준이에요.', '해외 주식 계좌는 계좌 설정에서 통화를 달러로 정하면 예수금·평가금을 달러로 넣고, 넣은 돈은 그날 환율로 달러로 바꿔 수익을 달러 기준으로 계산해요. 자산 탭과 계좌 화면 위의 ₩/$ 버튼으로 원화·외화 표시를 바꿔요.'] },
  { t: '외화 · 하나머니 같은 지갑', p: ['충전식이나 입출금 계좌 설정에서 통화를 추가하면 그 계좌 안에 외화 잔액이 생겨요. 환전은 입력창에 "하나머니 환전 100달러"처럼 적으면 돼요(원화 금액을 같이 적으면 그 금액, 아니면 지금 환율). 위 미리보기에서 외화·원화·환율·방향을 눌러 고친 뒤 보내요.', '외화로 쓴 돈은 "claude 20달러"처럼 적어요. 외화가 모자라면 원화에서 모자란 만큼 자동 환전하고, 원화도 모자라면 충전 계좌에서 가져와요. 세 기록은 함께 묶여 보여요.', '정기 결제에서 통화를 고르면 외화 자동결제가 돼요. 결제일에 그날 환율로 원화로 바꿔 통계에 잡혀요.', '계좌 화면의 외화 카드에서 "외화 지갑"을 열면 통화별로 실제 잔액을 맞추고, 환전과 외화가 오간 기록을 전체 기간으로 볼 수 있어요.', '환율은 앱을 열 때 하루 한 번 자동으로 받아오고(인터넷이 없으면 다음에), 자산 탭에서 직접 새로고침할 수도 있어요. 환전마다 환율이 남고, 통화별 평균 매입 환율과 지금 환율의 차이가 환차손익이에요.'] },
  { t: '백업 · 기기 변경', p: ['데이터는 이 기기에만 저장돼요. 설정 → 백업 파일 저장으로 가끔 저장해 두세요. 암호를 걸면 그 암호 없이는 열 수 없어요.', '새 기기에서는 첫 화면의 "백업 파일 불러오기"로 옮길 수 있어요.', '아이폰은 홈 화면에 추가한 앱으로만 쓰세요. Safari와 저장 공간이 따로예요.'] },
  { t: '잠금', p: ['설정 → 앱 잠금에서 PIN 4자리와 Face ID를 켤 수 있어요. PIN을 잊으면 데이터를 지워야 하니 백업해 두세요.'] },
];
function openHelp() {
  const r = $('#modal-root');
  r.innerHTML = `<div class="mdim"${at('gearClose')}></div><div class="mbox" role="dialog" aria-modal="true" aria-label="도움말">
    <div class="mh"><b>도움말</b><button class="mx"${at('gearClose')} aria-label="닫기">${ico('close', 20)}</button></div>
    <div class="mbody hp">${HELP.map((h, i) => `<details${i ? '' : ' open'}><summary>${h.t}</summary>${h.p.map(x => `<p>${esc(x)}</p>`).join('')}
      ${h.ex ? `<table class="hex">${h.ex.map(([a, b]) => `<tr><td><code>${esc(a)}</code></td><td>${esc(b)}</td></tr>`).join('')}</table>` : ''}</details>`).join('')}</div></div>`;
  r.classList.add('on');
}
function closeGear() { const r = $('#modal-root'); if (r) { r.classList.remove('on'); r.innerHTML = ''; } }
