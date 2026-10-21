'use strict';
// 시작: 이벤트 연결, 첫 화면
/* ---------- boot ---------- */
document.addEventListener('pointerdown', e => {
  const b = e.target.closest && e.target.closest('#lock [data-a="pinKey"]'); if (!b) return;
  e.preventDefault(); b.classList.add('pr'); setTimeout(() => b.classList.remove('pr'), 120); pinKey(b.dataset.k);
});
document.addEventListener('pointerdown', swStart);
document.addEventListener('pointermove', swDrag);
document.addEventListener('pointerup', swEnd);
document.addEventListener('pointercancel', swEnd);
document.addEventListener('pointerdown', bkStart);
document.addEventListener('pointermove', bkDrag);
document.addEventListener('pointerup', bkEnd);
document.addEventListener('pointercancel', bkEnd);
window.addEventListener('popstate', () => { if (BKG) { BKG = false; if (U.detail) detailPush(); return; } if (U.detail) { U.detail = null; render(); } }); // 브라우저 뒤로 가기 (앱이 부른 것이면 그 사이 연 계좌 화면은 유지)
document.addEventListener('contextmenu', ctxOpen);
document.addEventListener('scroll', ctxClose, true);
document.addEventListener('click', e => {
  const inCtx = !!e.target.closest?.('#ctx'); if (!inCtx) ctxClose();
  if (SW.eat) { const fresh = Date.now() - SW.eat < 400; SW.eat = 0; if (fresh && !e.target.closest('.swdel')) { e.preventDefault(); e.stopPropagation(); return; } } // 밀고 난 직후의 클릭만 무시
  const t = e.target.closest('[data-a]'); if (inCtx) ctxClose(); if (!t) return;
  if (t.dataset.a === 'pinKey' && window.PointerEvent) return; // 이미 pointerdown에서 처리
  if (t.dataset.a === 'cell' && !t.dataset.k) { const td = e.target.closest('td[data-k]'); if (td) { e.preventDefault(); ACT.cell({ id: t.dataset.id, k: td.dataset.k }); } return; }
  const f = ACT[t.dataset.a]; if (!f) return;
  e.preventDefault(); f(t.dataset, t, e);
});
document.addEventListener('change', e => { if (e.target.id === 'zoomS') setZoom(+e.target.value); });
document.addEventListener('focusin', e => { if (e.target.id === 'zc') { const r = $('input[name="zr"][value="c"]'); if (r) r.checked = true; } });
document.addEventListener('focusin', e => { if (e.target.matches && e.target.matches('#qeDate')) setTimeout(() => e.target.select(), 0); });
document.addEventListener('input', e => { const t = e.target.closest('[data-i]'); if (t && INP[t.dataset.i]) INP[t.dataset.i](t); });
document.addEventListener('keydown', e => {
  if ($('#lock')?.classList.contains('on')) { if (/^\d$/.test(e.key)) pinKey(e.key); else if (e.key === 'Backspace') pinKey('⌫'); return; }
  if (e.key === 'Escape' && $('#ctx')) return ctxClose();
  if (e.key === 'Escape' && $('#sheet-root').classList.contains('on')) closeSheet();
  else if (e.key === 'Escape' && U.tab === 'accts' && U.detail && !$('#modal-root')?.classList.contains('on')) ACT.back();
  else if (e.key === 'Escape' && $('#modal-root')?.classList.contains('on')) closeGear();
  if (e.key === 'Enter' && e.target.matches('#mIn')) ACT.setMemo({ id: $('[data-a="setMemo"]').dataset.id });
  if (e.key === 'Enter' && e.target.matches('#qIn')) ACT.qSet({});
  if (e.key === 'Enter' && e.target.matches('#qeIn')) { e.preventDefault(); ACT.qadd(); }
  if (e.key === 'Enter' && e.target.matches('#qeDate')) { e.preventDefault(); $('#qeIn')?.focus(); }
  const typing = e.target.matches('input,select,textarea'), mod = e.ctrlKey || e.metaKey;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.target.matches('input')) { e.preventDefault(); undo(); }
  if (mod && !typing && (e.key === 'y' || e.key === 'Z')) { e.preventDefault(); redo(); }
  if (mod && !typing && S && (e.key === 'PageUp' || e.key === 'PageDown')) { e.preventDefault(); return ACT.tabStep({ k: e.key === 'PageUp' ? -1 : 1 }); }
  if (e.key === 'Enter' && e.target.id === 'zc') { e.preventDefault(); return ACT.zoomOk(); }
  if (e.key === 'Enter' && e.target.id === 'cbIn') { e.preventDefault(); return ACT.cbSave(); }
  if (e.key === 'Enter' && e.target.id === 'cbUseIn') { e.preventDefault(); return ACT.cbUseSet({ v: 'in' }); }
  if (typing || mod || e.altKey || !S) return;
  const sheet = $('#sheet-root').classList.contains('on'), modal = $('#modal-root')?.classList.contains('on');
  if (sheet && $('#kpr')) { // 금액 창: 키보드로 바로
    const k = /^\d$/.test(e.key) ? e.key : { '+': '+', '-': '−', '*': '×', x: '×', '/': '÷', Backspace: '⌫', Delete: 'C' }[e.key];
    if (k) { e.preventDefault(); ACT.kp({ k }); } else if (e.key === 'Enter') { e.preventDefault(); ACT.kpGo({ d: 'next' }); }
    return;
  }
  if (sheet || modal) return;
  const inSel = U.tab === 'input' && U.sel && rowById(U.sel.id);
  if (inSel && /^\d$/.test(e.key)) { // 금액 셀에서 숫자를 치면 바로 새 금액 입력
    if (U.sel.k === 'amt' && !inSel.auto) { e.preventDefault(); kpTx(U.sel.id); KP.ex = e.key; kpShow(); }
    return;
  }
  if (/^[1-4]$/.test(e.key)) return ACT.tab({ v: TABS[+e.key - 1][0] });
  if (U.tab !== 'input' || !U.nav) return;
  if (e.key === 'Escape' && U.sel) { U.sel = null; render(); return; }
  if (e.key === 'Tab' && !U.sel) return;
  if (e.key === 'Delete' && U.sel && txById(U.sel.id)) { e.preventDefault(); return ACT.delTx({ id: U.sel.id }); }
  if (e.key === '/') { e.preventDefault(); $('#qeIn')?.focus(); return; }
  const { ids, ks } = U.nav, mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], Tab: [0, e.shiftKey ? -1 : 1], PageUp: [-10, 0], PageDown: [10, 0], Home: [0, -99], End: [0, 99] }[e.key];
  if (mv && ids.length) {
    e.preventDefault();
    let i = U.sel ? ids.indexOf(U.sel.id) : -1, j = U.sel ? ks.indexOf(U.sel.k) : -1;
    if (i < 0) { i = 0; j = Math.max(0, ks.indexOf('amt')); } else { i = Math.min(ids.length - 1, Math.max(0, i + mv[0])); j = Math.min(ks.length - 1, Math.max(0, (j < 0 ? 0 : j) + mv[1])); }
    U.sel = { id: ids[i], k: ks[j] }; selPaint(); scrollSel();
  } else if ((e.key === 'Enter' || e.key === 'F2') && U.sel && ids.includes(U.sel.id)) { e.preventDefault(); ACT.cell(U.sel); }
});
window.addEventListener('resize', fitHeight);
window.addEventListener('orientationchange', () => setTimeout(fitHeight, 300));
window.addEventListener('pageshow', fitHeight);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { LK.hiddenAt = Date.now(); return; }
  fitHeight();
  const la = lockAfter();
  if (pinGet() && !LK.mode && la !== 'launch' && Date.now() - LK.hiddenAt >= (+la) * 60000) showLock('unlock');
});
document.addEventListener('DOMContentLoaded', () => {
  fitHeight();
  if (pinGet()) showLock('unlock');
  $('#file').addEventListener('change', e => onFiles([...e.target.files]));
  S = load();
  if (S) persist(false); // 기존 기록이면 보존 요청을 바로
  if (S && U.month > ym(TODAY())) U.month = ym(TODAY());
  render();
  if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey) {
    import('../sync.js').then(m => m.init({
      get: () => S, set: s => { S = s; invalidate(); persist(false); render(); }, merge: mergeState, normalize, blank: blankState,
      render, toast, openSheet, closeSheet, confirmSheet, Sync, esc, at, bh, ACT,
      clear: () => { try { localStorage.removeItem(KEY); } catch (e) { } S = null; hist.length = 0; fut.length = 0; invalidate(); render(); },
    })).catch(err => { console.error(err); Sync.status = 'err'; Sync.label = () => '동기화 모듈을 불러오지 못했어요'; render(); });
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !TESTMODE) {
    const had = !!navigator.serviceWorker.controller; let reloaded = false;
    // 새 버전이 설치돼 이 화면을 맡게 되면 한 번 새로고침해서 바로 적용
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => { });
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
});
// 자동 점검(test.html)용 연결 고리
window.__cb = { get S() { return S; }, U, ACT, parseQuick, doClose, valueAt, recapCard, render, led, groups, mstats, invSeries, calc, mergeState, importCsv, parseCsv, balAt,
  util: { blankState, TODAY, mRange, addM, addD, ym }, GUIDE, HELP, applyTheme, fmtU, guessCat, uncatQueue, poolsAt, shortName, matPlan, showLock, pinGet, load: x => { S = normalize(x); hist.length = 0; fut.length = 0; invalidate(); persist(); render(); } };
