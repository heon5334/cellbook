// 아이폰·아이패드 홈 화면 앱: 화면을 상태 표시줄 아래에서 시작.
// 겹치게 두면 iOS 26부터 그 부분과 바로 아래를 흐리게 덮는다.
(function () {
  var m = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (m) m.content = 'default';
})();
