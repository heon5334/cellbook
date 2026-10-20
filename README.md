# 셀가계부

표로 정리하는 가계부. 데이터는 쓰는 기기의 브라우저에만 저장됩니다.

https://heon5334.github.io/cellbook/ — 휴대폰에서 열고 홈 화면에 추가해서 씁니다. 컴퓨터·아이패드에서는 엑셀처럼 넓은 화면으로 바뀝니다.

- `index.html` `app.css` — 앱 화면
- `js/` — 앱 코드 (순서대로 읽힘)
  - `core.js` 데이터·계산 · `ui.js` 화면 공통 · `views.js` 한눈에 보기·입력 · `quick.js` 빠른 입력
  - `pages.js` 계좌별·투자·설정 화면 · `extras.js` 잠금·도움말 등 · `edit.js` 편집 창·버튼 동작 · `data.js` 백업·가져오기 · `boot.js` 시작
- `head.js` — 아이패드 상태 표시줄 설정
- `sw.js` `manifest.webmanifest` — 오프라인 실행
- `help/` — 도움말 사진
- `sync.js` `config.js` `firestore.rules` `firebase.json` — 로그인 동기화(꺼져 있음)
- `tests/test.html?m=unit` — 점검 (로컬 서버에서 실행, 실제 데이터와 저장 공간이 분리됨)
