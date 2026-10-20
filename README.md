# 셀가계부

표로 정리하는 가계부. 데이터는 쓰는 기기의 브라우저에만 저장됩니다.

https://heon5334.github.io/cellbook/ — 휴대폰에서 열고 홈 화면에 추가해서 씁니다. 컴퓨터·아이패드에서는 엑셀처럼 넓은 화면으로 바뀝니다.

- `index.html` `app.js` `app.css` — 앱
- `head.js` — 아이패드 상태 표시줄 설정
- `sw.js` `manifest.webmanifest` — 오프라인 실행
- `help/` — 도움말 사진
- `sync.js` `config.js` `firestore.rules` `firebase.json` — 로그인 동기화(꺼져 있음)
- `tests/test.html?m=unit` — 점검 (로컬 서버에서 실행, 실제 데이터와 저장 공간이 분리됨)
