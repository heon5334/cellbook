// 예상치 못한 오류를 화면 위에 표시 (개발·점검용)
window.addEventListener('error', e => {
  const el = document.getElementById('err'); if (!el) return;
  el.style.display = 'block';
  el.textContent = '오류: ' + e.message + (e.lineno ? ` (${(e.filename || '').split('/').pop()}:${e.lineno})` : '');
  document.documentElement.setAttribute('data-err', el.textContent);
});
window.addEventListener('unhandledrejection', e => {
  const m = String(e.reason && (e.reason.message || e.reason));
  document.documentElement.setAttribute('data-rej', m);
});
