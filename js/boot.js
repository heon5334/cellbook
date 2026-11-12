'use strict';
// 시작: 이벤트 연결, 첫 화면
document.addEventListener('pointerdown', e => {
  const b = e.target.closest && e.target.closest('#lock [data-a="pinKey"]'); if (!b) return;
  e.preventDefault(); b.classList.add('pr'); setTimeout(() => b.classList.remove('pr'), 120); pinKey(b.dataset.k);
});
// 휴대폰 뒤로 가기: 열린 창 → 계좌 화면 → 설정 순서로 닫음
window.addEventListener('popstate', () => {
  if (NAV.skip) { NAV.skip = false; return; }
  NAV.pushed = false;
  if (sheetOpen()) { closeSheet(); if (U.detail || U.tab === 'set') navPush(); return; }
  if (U.fxv) { U.fxv = null; render(); navPush(); return; }
  if (U.detail) { U.detail = null; U.month = ym(TODAY()); render(); return; }
  if (U.tab === 'set') { U.setTab = ''; U.tab = U.prevTab && U.prevTab !== 'set' ? U.prevTab : 'home'; render(); }
});
document.addEventListener('click', e => {
  if (SWP.eat && Date.now() - SWP.eat < 400 && e.target.closest('.todo .it')) { SWP.eat = 0; e.preventDefault(); return; } // 민 직후의 클릭은 무시
  const t = e.target.closest('[data-a]'); if (!t) return;
  if (t.dataset.a === 'pinKey' && window.PointerEvent) return; // 이미 pointerdown에서 처리
  const f = ACT[t.dataset.a]; if (!f) return;
  e.preventDefault(); f(t.dataset, t, e);
});
// 확인할 것: 옆으로 밀어서 넘기기
const SWP = { el: null, x: 0, y: 0, dx: 0, on: false };
document.addEventListener('pointerdown', e => { const el = e.target.closest && e.target.closest('.todo .it[data-k]'); if (!el || e.pointerType === 'mouse' && e.button) return; SWP.el = el; SWP.x = e.clientX; SWP.y = e.clientY; SWP.dx = 0; SWP.on = false; });
document.addEventListener('pointermove', e => {
  if (!SWP.el) return; const dx = e.clientX - SWP.x, dy = e.clientY - SWP.y;
  if (!SWP.on) { if (Math.abs(dx) < 10 || Math.abs(dy) > Math.abs(dx)) { if (Math.abs(dy) > 10) SWP.el = null; return; } SWP.on = true; }
  SWP.dx = dx; SWP.el.style.transform = `translateX(${dx}px)`; SWP.el.style.opacity = String(Math.max(.2, 1 - Math.abs(dx) / 220)); e.preventDefault();
});
const swpEnd = e => {
  const el = SWP.el; if (!el) return; SWP.el = null;
  if (SWP.on && Math.abs(SWP.dx) > 90) { el.style.transition = 'transform .15s,opacity .15s'; el.style.transform = `translateX(${SWP.dx > 0 ? 400 : -400}px)`; el.style.opacity = '0'; const k = el.dataset.k; SWP.eat = Date.now(); setTimeout(() => ACT.todoDis({ k }), 150); }
  else if (SWP.on) { el.style.transition = 'transform .15s,opacity .15s'; el.style.transform = ''; el.style.opacity = ''; SWP.eat = Date.now(); }
};
document.addEventListener('pointerup', swpEnd); document.addEventListener('pointercancel', swpEnd);
document.addEventListener('input', e => { const t = e.target.closest('[data-i]'); if (t && INP[t.dataset.i]) INP[t.dataset.i](t); });
document.addEventListener('focusin', e => { if (e.target.id === 'qeIn') setTimeout(kbFit, 60); });
let SCR = 0; document.addEventListener('scroll', e => { if (e.target.id !== 'body' || SCR) return; SCR = requestAnimationFrame(() => { SCR = 0; dateFromScroll(); }); }, true);
document.addEventListener('focusout', e => { if (e.target.id === 'qeIn') setTimeout(kbFit, 120); });
document.addEventListener('keydown', e => {
  if ($('#lock')?.classList.contains('on')) { if (/^\d$/.test(e.key)) pinKey(e.key); else if (e.key === 'Backspace') pinKey('⌫'); return; }
  const sheet = sheetOpen(), modal = $('#modal-root')?.classList.contains('on');
  if (e.key === 'Escape') {
    if (sheet) return closeSheet();
    if (modal) return closeGear();
    if (U.detail) return ACT.back();
    if (U.tab === 'set') return ACT.setBack();
    return;
  }
  if (e.key === 'Enter') {
    const id = e.target.id;
    if (id === 'qeIn') { e.preventDefault(); return qeAdd(); }
    if (id === 'qIn') { e.preventDefault(); return ACT.qSet({}); }
    if (id === 'pwIn') { e.preventDefault(); return ACT.importPw(); }
    if (id === 'cbIn') { e.preventDefault(); return ACT.cbSave(); }
    if (id === 'cbUseIn') { e.preventDefault(); return ACT.cbUseSet({ v: 'in' }); }
    if (e.target.matches('#sheet-root .txf input:not([type="date"])')) { e.preventDefault(); return ACT.tfSave(); }
  }
  const typing = e.target.matches('input,select,textarea'), mod = e.ctrlKey || e.metaKey;
  if (mod && e.key === 'z' && !typing) { e.preventDefault(); return undo(); }
  if (mod && !typing && (e.key === 'y' || e.key === 'Z')) { e.preventDefault(); return redo(); }
  if (typing || mod || e.altKey || !S) return;
  if (sheet && $('#kpr')) { // 숫자판: 키보드로 바로
    const k = /^\d$/.test(e.key) ? e.key : { '+': '+', '-': '−', '*': '×', x: '×', '/': '÷', Backspace: '⌫', Delete: 'C' }[e.key];
    if (k) { e.preventDefault(); ACT.kp({ k }); } else if (e.key === 'Enter') { e.preventDefault(); ACT.kpGo({ d: 'next' }); }
    return;
  }
  if (sheet || modal) return;
  if (/^[1-4]$/.test(e.key)) return ACT.tab({ v: TABS[+e.key - 1][0] });
  if (e.key === '/' || e.key === 'n') { const q = $('#qeIn'); if (q) { e.preventDefault(); q.focus(); } }
});
window.addEventListener('resize', fitHeight);
window.addEventListener('orientationchange', () => setTimeout(fitHeight, 300));
window.addEventListener('pageshow', fitHeight);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { LK.hiddenAt = Date.now(); return; }
  fitHeight();
  const la = lockAfter();
  if (pinGet() && !LK.mode && la !== 'launch' && Date.now() - LK.hiddenAt >= (+la) * 60000) showLock('unlock');
  if (S && U.lastDay !== TODAY()) { U.lastDay = TODAY(); QE.date = null; invalidate(); render(); } // 날이 바뀌면 입력 날짜도 오늘로
  fxAutoRefresh(); // 자정이 지났으면 오늘 기준으로 다시 계산
});
document.addEventListener('DOMContentLoaded', () => {
  fitHeight();
  if (pinGet()) showLock('unlock');
  $('#file').addEventListener('change', e => onFiles([...e.target.files]));
  S = load(); U.lastDay = TODAY();
  if (S) persist(false); // 예전 형식이면 새 형식으로 저장, 기록 보존 요청도 바로
  if (S && U.month > ym(TODAY())) U.month = ym(TODAY());
  render();
  fxAutoRefresh();
  window.addEventListener('online', fxAutoRefresh); // 인터넷이 다시 연결되면
  if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey) {
    import('../sync.js').then(m => m.init({
      get: () => S, set: s => { S = s; invalidate(); persist(false); render(); }, merge: mergeState, normalize, blank: blankState,
      render, toast, openSheet, closeSheet, confirmSheet, Sync, esc, at, bh, ACT,
      clear: () => { try { localStorage.removeItem(KEY); } catch (e) { } S = null; hist.length = 0; fut.length = 0; invalidate(); render(); },
    })).catch(err => { console.error(err); Sync.status = 'err'; Sync.label = () => '동기화 모듈을 불러오지 못했어요'; render(); });
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !TESTMODE) {
    const had = !!navigator.serviceWorker.controller; let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => { });
  }
});
// 자동 점검(tests/test.html)용 연결 고리
window.__cb = { get S() { return S; }, U, QE, ACT, INP, parseQuick, qeParse, qeAdd, valueAt, render, led, groups, mstats, rstats, budgetInfo, inbox, invSeries, calc, amtOf, mergeState, normalize, importCsv, parseCsv, balAt,
  checkBackup, encBackup, decBackup, refundMap, netOut, invalidate, balAfter, linkAt, isaInfo, catIcon, invCur, invAt, invAtK, dietz, flowList, fbookAt, fxSummary, curRate, rateAt, invStart, flows, fmtF, fxCurs, holdVal, grpRows, txForm, recForm, acctForm, dateFromScroll, doClose,
  util: { blankState, TODAY, mRange, addM, addD, ym }, HELP, applyTheme, guessCat, uncatQueue, poolsAt, matPlan, showLock, pinGet,
  load: x => { S = normalize(x); hist.length = 0; fut.length = 0; invalidate(); persist(); render(); } };
