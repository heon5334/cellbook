// 셀가계부 동기화 — 구글 로그인 + 기기 안 암호화(AES-GCM) + Firestore
// 서버(Firestore)에는 암호화된 데이터만 저장된다. 가계부 암호는 서버로 보내지 않는다.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';

const ITER = 600000;
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = buf => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const rand = n => crypto.getRandomValues(new Uint8Array(n));

async function deriveKey(pass, saltB64) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: unb64(saltB64), iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function gz(bytes) {
  if (!window.CompressionStream) return { z: 0, b: bytes };
  const s = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  return { z: 1, b: new Uint8Array(await new Response(s).arrayBuffer()) };
}
async function ungz(bytes, z) {
  if (!z) return bytes;
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function encrypt(key, obj, aad) {
  const { z, b } = await gz(enc.encode(JSON.stringify(obj)));
  const iv = rand(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, b);
  return { iv: b64(iv), ct: b64(ct), z };
}
async function decrypt(key, box, aad) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv), additionalData: enc.encode(aad) }, key, unb64(box.ct));
  return JSON.parse(dec.decode(await ungz(new Uint8Array(pt), box.z)));
}
// 키 정렬한 문자열 — 내용 비교용
const canon = o => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((r, x) => (r[x] = v[x], r), {}) : v);

// 이 기기에 '꺼낼 수 없는' 키 보관 (IndexedDB)
function idb() { return new Promise((res, rej) => { const r = indexedDB.open('cellbook-keys', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function kget(id) { try { const db = await idb(); return await new Promise(res => { const q = db.transaction('k').objectStore('k').get(id); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch (e) { return null; } }
async function kput(id, v) { try { const db = await idb(); await new Promise(res => { const t = db.transaction('k', 'readwrite'); t.objectStore('k').put(v, id); t.oncomplete = res; t.onerror = res; }); } catch (e) { } }
async function kdel(id) { try { const db = await idb(); await new Promise(res => { const t = db.transaction('k', 'readwrite'); t.objectStore('k').delete(id); t.oncomplete = res; t.onerror = res; }); } catch (e) { } }

export function init(api) {
  const { Sync, esc, at, bh, ACT } = api;
  const cfg = { ...window.FIREBASE_CONFIG };
  if (/\.(web\.app|firebaseapp\.com)$/.test(location.hostname)) cfg.authDomain = location.hostname; // 같은 도메인 로그인(사파리 대응)
  const app = initializeApp(cfg), auth = getAuth(app), db = getFirestore(app);
  let user = null, key = null, salt = null, ref = null, unsub = null, lastRev = null, timer = null, busy = false, again = false, lastAt = null;
  const dev = localStorage.getItem('cellbook.dev') || (() => { const d = crypto.randomUUID(); localStorage.setItem('cellbook.dev', d); return d; })();

  const setStatus = s => { if (Sync.status !== s) { Sync.status = s; api.render(); } };
  Sync.status = 'out';
  Sync.label = () => ({ out: '로그인 안 됨 · 탭해서 로그인', lock: '잠김 · 가계부 암호 입력 필요', sync: `동기화 중 · ${user?.email || ''}`, ok: `동기화됨 · ${user?.email || ''}`, err: '오류 · 탭해서 확인' })[Sync.status] || '';
  Sync.menu = () => menu();
  Sync.signIn = () => signInFlow();
  Sync.dirty = () => { if (!key || !user) return; clearTimeout(timer); timer = setTimeout(push, 1200); };
  Sync.onReset = () => doSignOut(false);
  api.render();

  getRedirectResult(auth).catch(e => api.toast('로그인 실패: ' + (e.code || e.message)));
  onAuthStateChanged(auth, async u => {
    if (unsub) { unsub(); unsub = null; }
    user = u; key = null; salt = null; lastRev = null;
    if (!u) { setStatus('out'); return; }
    ref = doc(db, 'users', u.uid, 'vault', 'main');
    await afterLogin();
  });
  window.addEventListener('online', () => { if (key) push(); });

  async function signInFlow() {
    const p = new GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    try {
      if (standalone) await signInWithRedirect(auth, p); else await signInWithPopup(auth, p);
    } catch (e) {
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code)) await signInWithRedirect(auth, p);
      else if (e.code !== 'auth/popup-closed-by-user') api.toast('로그인 실패: ' + (e.code || e.message));
    }
  }

  async function afterLogin() {
    setStatus('sync');
    let snap;
    try { snap = await getDoc(ref); } catch (e) { console.error(e); setStatus('err'); api.toast('클라우드에 연결하지 못했어요'); return; }
    if (!snap.exists()) return createSheet();
    const d = snap.data(); salt = d.salt;
    const cached = await kget(user.uid);
    if (cached && cached.salt === d.salt) {
      try { await decrypt(cached.key, d.chk, user.uid); key = cached.key; return start(d); } catch (e) { await kdel(user.uid); }
    }
    setStatus('lock'); unlockSheet(d);
  }

  const passFields = (confirm) => `<div class="lbl" style="padding-top:0">가계부 암호 (8자 이상)</div><div class="fld"><input type="password" id="p1" autocomplete="${confirm ? 'new-password' : 'current-password'}" autofocus></div>
    ${confirm ? '<div class="lbl">한 번 더 입력</div><div class="fld"><input type="password" id="p2" autocomplete="new-password"></div>' : ''}
    <button class="tog on" data-a="sTogRem" id="rem">이 기기에서 기억하기 (다음부터 안 물어봄)<i></i></button>`;
  ACT.sTogRem = () => $('#rem').classList.toggle('on');
  const $ = s => document.querySelector(s);

  function createSheet() {
    setStatus('lock');
    const local = api.get(), demo = local?.demo;
    api.openSheet(`${bh('가계부 암호 만들기', esc(user.email || ''))}
      <div class="hint" style="padding-top:0;color:#444;font-size:13px">이 암호로 <b>기기 안에서 암호화한 뒤</b> 서버에 올려요. 서버와 운영자는 내용을 볼 수 없어요.<br>
      <b style="color:#C52828">암호를 잊으면 아무도 복구할 수 없어요.</b> 꼭 따로 적어 두고, 가끔 백업 파일도 내보내세요.</div>
      ${passFields(true)}
      ${demo ? '<div class="hint">지금 보고 있는 예시 데이터는 올리지 않고 빈 가계부로 시작해요.</div>' : local && (local.tx.length || local.accounts.length) ? `<div class="hint">이 기기의 가계부(거래 ${local.tx.length}건)를 첫 데이터로 올려요.</div>` : ''}
      <button class="bigbtn" data-a="sCreate">암호 만들고 동기화 시작</button><button class="bigbtn ghost" data-a="sOut">로그아웃</button>`, { locked: true });
  }
  ACT.sCreate = async () => {
    const p1 = $('#p1').value, p2 = $('#p2').value, rem = $('#rem').classList.contains('on');
    if (p1.length < 8) return api.toast('8자 이상으로 정하세요');
    if (p1 !== p2) return api.toast('두 암호가 달라요');
    api.toast('암호화 키를 만드는 중…');
    try {
      salt = b64(rand(16)); key = await deriveKey(p1, salt);
      let st = api.get(); if (!st || st.demo) st = api.normalize(api.blank());
      const box = await encrypt(key, st, user.uid), chk = await encrypt(key, { ok: 1 }, user.uid), rev = crypto.randomUUID();
      await setDoc(ref, { v: 1, salt, chk, iv: box.iv, ct: box.ct, z: box.z, rev, dev, updatedAt: serverTimestamp() });
      if (rem) await kput(user.uid, { key, salt });
      lastRev = rev; localStorage.setItem('cellbook.lastUid', user.uid);
      api.closeSheet(); api.set(st); subscribe(); lastAt = new Date(); setStatus('ok'); api.toast('동기화를 시작했어요');
    } catch (e) { console.error(e); setStatus('err'); api.toast('만들지 못했어요: ' + (e.code || e.message)); }
  };

  function unlockSheet(d) {
    SD = d;
    api.openSheet(`${bh('가계부 암호 입력', esc(user.email || ''))}
      <div class="hint" style="padding-top:0">이 계정의 가계부는 암호로 잠겨 있어요.</div>${passFields(false)}
      <button class="bigbtn" data-a="sUnlock">잠금 해제</button><button class="bigbtn ghost" data-a="sForgot">암호를 잊었어요</button><button class="bigbtn ghost" data-a="sOut">로그아웃</button>`, { locked: true });
  }
  let SD = null;
  ACT.sUnlock = async () => {
    const p = $('#p1').value, rem = $('#rem').classList.contains('on');
    if (!p) return;
    api.toast('확인 중…');
    try {
      const k = await deriveKey(p, SD.salt);
      await decrypt(k, SD.chk, user.uid);
      key = k; salt = SD.salt; if (rem) await kput(user.uid, { key, salt });
      api.closeSheet(); start(SD);
    } catch (e) { api.toast('암호가 맞지 않아요'); }
  };
  ACT.sForgot = () => api.confirmSheet('암호를 잊었어요', '가계부 암호는 서버에도 없어서 <b>복구할 수 없어요.</b><br>백업 파일이 있다면 클라우드 가계부를 지우고 새 암호로 다시 시작한 뒤 백업을 불러오세요.<br><br>클라우드 가계부를 <b>삭제</b>할까요? (이 기기 데이터는 남아요)', '클라우드 삭제', async () => {
    try { await deleteDoc(ref); api.toast('삭제했어요. 새 암호를 만드세요'); afterLogin(); } catch (e) { api.toast('삭제 실패: ' + (e.code || e.message)); }
  }, true);
  ACT.sOut = () => { api.closeSheet(); doSignOut(false); };

  async function start(d, mode) {
    setStatus('sync');
    let remote;
    try { remote = api.normalize(await decrypt(key, d, user.uid)); } catch (e) { console.error(e); setStatus('err'); return api.toast('클라우드 데이터를 풀지 못했어요'); }
    const local = api.get();
    const localHas = local && !local.demo && (local.tx.length || local.accounts.length);
    if (localHas && localStorage.getItem('cellbook.lastUid') !== user.uid && !mode) {
      SD = d;
      return api.openSheet(`${bh('이 기기에 가계부가 있어요', esc(user.email || ''))}
        <div class="hint" style="padding-top:0;font-size:13.5px;color:#444">이 기기: 거래 ${local.tx.length}건 · 클라우드: 거래 ${remote.tx.length}건<br>어떻게 할까요?</div>
        <button class="bigbtn" data-a="sMode" data-v="merge">합치기 (둘 다 유지)</button><button class="bigbtn ghost" data-a="sMode" data-v="remote">클라우드 것만 쓰기 (이 기기 것 버림)</button>`, { locked: true });
    }
    const merged = (!local || local.demo || mode === 'remote') ? remote : api.merge(local, remote);
    localStorage.setItem('cellbook.lastUid', user.uid);
    lastRev = d.rev; api.set(merged); subscribe(); lastAt = new Date(); setStatus('ok');
    if (canon(merged) !== canon(remote)) push();
  }
  ACT.sMode = d => { api.closeSheet(); start(SD, d.v); };

  function subscribe() {
    if (unsub) unsub();
    unsub = onSnapshot(ref, async snap => {
      if (!snap.exists()) { api.toast('클라우드 가계부가 삭제됐어요'); return doSignOut(false); }
      if (snap.metadata.hasPendingWrites) return;
      const d = snap.data(); if (d.rev === lastRev) return;
      if (d.salt !== salt) { key = null; await kdel(user.uid); setStatus('lock'); return unlockSheet(d); }
      try {
        const remote = api.normalize(await decrypt(key, d, user.uid)); lastRev = d.rev;
        const local = api.get(), merged = api.merge(local, remote);
        if (canon(merged) !== canon(api.normalize(local))) api.set(merged);
        lastAt = new Date();
        if (canon(merged) !== canon(remote)) push(); else setStatus('ok');
      } catch (e) { console.error(e); setStatus('err'); }
    }, err => { console.error(err); setStatus('err'); });
  }

  async function push() {
    if (!key || !user) return;
    if (busy) { again = true; return; }
    busy = true; setStatus('sync');
    try {
      const st = api.get(); if (!st) return;
      const box = await encrypt(key, st, user.uid), rev = crypto.randomUUID();
      if (box.ct.length > 900000) api.toast('데이터가 커서 동기화 한도(1MB)에 가까워요');
      lastRev = rev;
      await setDoc(ref, { v: 1, iv: box.iv, ct: box.ct, z: box.z, rev, dev, updatedAt: serverTimestamp() }, { merge: true });
      lastAt = new Date(); setStatus('ok');
    } catch (e) { console.error(e); setStatus('err'); }
    finally { busy = false; if (again) { again = false; push(); } }
  }

  async function doSignOut(clearLocal) {
    if (unsub) { unsub(); unsub = null; }
    clearTimeout(timer);
    if (user) await kdel(user.uid);
    key = null; salt = null;
    try { await signOut(auth); } catch (e) { }
    localStorage.removeItem('cellbook.lastUid');
    if (clearLocal) api.clear();
    setStatus('out');
  }

  function menu() {
    if (!user) return api.openSheet(`${bh('로그인 · 동기화')}<div class="hint" style="padding-top:0;font-size:13.5px;color:#444;line-height:1.7">
      구글 계정으로 로그인하면 휴대폰·태블릿·PC에서 같은 가계부를 쓸 수 있어요.<br>
      · 데이터는 <b>이 기기에서 가계부 암호로 암호화</b>한 뒤 올라가요<br>· 오프라인에서 입력해도 연결되면 자동으로 합쳐져요</div>
      <button class="bigbtn" data-a="signIn">구글로 로그인</button>`);
    if (Sync.status === 'lock') return SD ? unlockSheet(SD) : afterLogin();
    api.openSheet(`${bh('동기화', esc(user.email || ''))}
      <div class="hint" style="padding-top:0;font-size:13.5px;color:#444">상태: <b>${esc(Sync.label())}</b>${lastAt ? `<br>마지막 동기화: ${lastAt.toLocaleString('ko-KR')}` : ''}</div>
      <div class="acts" style="margin-top:10px">
        <button class="btn pri" data-a="sNow">지금 동기화</button>
        <button class="btn" data-a="sPass">가계부 암호 바꾸기</button>
        <button class="btn" data-a="sForget">이 기기에서 암호 잊기</button>
        <button class="btn" data-a="sOut">로그아웃 (이 기기 데이터 유지)</button>
        <button class="btn dan" data-a="sOutClear">로그아웃하고 이 기기 데이터 지우기</button>
        <button class="btn dan" data-a="sDelCloud">클라우드 가계부 삭제</button>
      </div>`);
  }
  ACT.sNow = () => { api.closeSheet(); push(); };
  ACT.sForget = async () => { api.closeSheet(); if (user) await kdel(user.uid); api.toast('다음 실행 때 암호를 다시 물어봐요'); };
  ACT.sOutClear = () => api.confirmSheet('로그아웃', '이 기기의 가계부 데이터도 지울까요? 클라우드에는 남아 있어요.', '로그아웃하고 지우기', () => doSignOut(true), true);
  ACT.sDelCloud = () => api.confirmSheet('클라우드 가계부 삭제', '서버에 있는 암호화된 가계부를 <b>영구 삭제</b>할까요?<br>다른 기기에서도 더 이상 동기화되지 않아요. 이 기기 데이터는 남아요.', '영구 삭제', async () => {
    try { if (unsub) { unsub(); unsub = null; } await deleteDoc(ref); api.toast('클라우드 가계부를 삭제했어요'); doSignOut(false); } catch (e) { api.toast('삭제 실패: ' + (e.code || e.message)); }
  }, true);
  ACT.sPass = () => {
    api.openSheet(`${bh('가계부 암호 바꾸기')}<div class="hint" style="padding-top:0">새 암호로 다시 암호화해요. 다른 기기에서는 새 암호를 한 번 입력해야 해요.</div>
      ${passFields(true)}<button class="bigbtn" data-a="sPassOk">바꾸기</button>`);
  };
  ACT.sPassOk = async () => {
    const p1 = $('#p1').value, p2 = $('#p2').value, rem = $('#rem').classList.contains('on');
    if (p1.length < 8) return api.toast('8자 이상으로 정하세요');
    if (p1 !== p2) return api.toast('두 암호가 달라요');
    api.toast('다시 암호화하는 중…');
    try {
      const ns = b64(rand(16)), nk = await deriveKey(p1, ns), st = api.get();
      const box = await encrypt(nk, st, user.uid), chk = await encrypt(nk, { ok: 1 }, user.uid), rev = crypto.randomUUID();
      lastRev = rev;
      await setDoc(ref, { v: 1, salt: ns, chk, iv: box.iv, ct: box.ct, z: box.z, rev, dev, updatedAt: serverTimestamp() });
      key = nk; salt = ns; await kdel(user.uid); if (rem) await kput(user.uid, { key, salt });
      api.closeSheet(); api.toast('암호를 바꿨어요');
    } catch (e) { api.toast('바꾸지 못했어요: ' + (e.code || e.message)); }
  };
}
