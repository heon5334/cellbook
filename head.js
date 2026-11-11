// 아이패드 홈 화면 앱만 상태 표시줄 아래에서 시작. 아이폰은 전체 화면(그래야 화면 높이를 정확히 잡음)으로 두고 제목을 안전 영역보다 아래에서 시작한다.
(function () {
  if (isPad()) { var m = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]'); if (m) m.content = 'default'; }
  function isPad() { return /iPad/.test(navigator.platform || '') || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || '')); }
})();
