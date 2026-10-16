// Firebase 웹 앱 설정 — Firebase 콘솔 > 프로젝트 설정 > 내 앱 > SDK 설정의 firebaseConfig 값을 붙여 넣으세요.
// 이 값은 비밀번호가 아니라 '어느 프로젝트인지'를 알려 주는 공개 식별자예요. 데이터 보호는 보안 규칙(firestore.rules)과
// 기기 안 암호화가 맡아요. null로 두면 로그인 없이 이 기기에만 저장하는 모드로 동작해요.
window.FIREBASE_CONFIG = null;
