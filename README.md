# 셀가계부

한 줄로 적는 가계부. 데이터는 쓰는 기기의 브라우저에만 저장됩니다.

https://heon5334.github.io/cellbook/ — 휴대폰에서 열고 홈 화면에 추가해서 씁니다.

- 화면: 홈(오늘 쓸 수 있는 돈, 확인할 것, 예산) · 내역 · 통계 · 자산, 오른쪽 위 설정
- 아래 입력창에 "커피 4500"처럼 적으면 미리 보여 주고 바로 기록. 비어 있을 때 + 는 칸별 입력 창
- 데이터 형식 ver 3 (ver 2 백업은 불러올 때 자동으로 옮김): 거래 `tags` · `link`(정산 연결) · `ok`(확인 끝낸 알림), 설정 `budget` · `remind`

- `index.html` `app.css` — 앱 화면
- `js/` — 앱 코드 (순서대로 읽힘)
  - `core.js` 데이터 형식·옮기기·계산 · `ui.js` 화면 틀·아이콘·창 · `views.js` 홈·내역·통계 · `quick.js` 빠른 입력
  - `pages.js` 자산·설정 · `acct.js` 계좌 화면 · `extras.js` 확인할 것·잠금·도움말 · `edit.js` 입력 창·버튼 동작 · `data.js` 백업(암호)·가져오기 · `boot.js` 시작
- `head.js` — 아이패드 상태 표시줄 설정
- `sw.js` `manifest.webmanifest` — 오프라인 실행
- `sync.js` `config.js` `firestore.rules` `firebase.json` — 로그인 동기화(꺼져 있음)
- `tests/test.html?m=unit` — 점검 (로컬 서버에서 실행, 실제 데이터와 저장 공간이 분리됨)
