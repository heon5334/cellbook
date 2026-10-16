# 셀가계부

스프레드시트처럼 정리하는 가계부 웹앱 (PWA).

- 가계부 데이터는 **사용자 기기의 브라우저 안에만** 저장되며 서버로 전송되지 않습니다.
- 휴대폰에서 열고 "홈 화면에 추가"하면 앱처럼 실행되고 오프라인에서도 동작합니다.
- 빌드 과정 없는 순수 HTML/CSS/JavaScript.

| 파일 | 역할 |
|---|---|
| `index.html`, `app.css`, `app.js` | 화면과 계산 |
| `sw.js`, `manifest.webmanifest` | 오프라인 실행·홈 화면 설치 |
| `sync.js`, `config.js`, `firestore.rules`, `firebase.json` | (선택) 구글 로그인 + 기기 암호화 동기화 — `config.js`가 `null`이면 꺼짐 |
