// 아이패드 홈 화면 앱: 화면을 상태 표시줄 아래에서 시작 (겹치면 iPadOS가 그 부분을 흐리게 덮음). 아이폰은 그대로.
(function () {
  var ua = navigator.userAgent;
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
    var m = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (m) m.content = 'default';
  }
})();
