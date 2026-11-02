# 데일리 루틴 체크

매일 루틴을 폰에서 빠르게 체크하고 한 줄 메모를 남기는 개인용 웹앱입니다.
로그인, 메뉴, 온보딩 없이 열자마자 바로 체크할 수 있게 만들었습니다.

## 배포 주소

https://syc030403.github.io/daily-routine-check/

## 기능

- 오늘 날짜 표시
- 체크리스트 (항목은 사용자가 직접 추가/삭제)
- 한 줄 메모
- 체크/메모 자동 저장 (localStorage)
- 지난 기록 보기 (날짜, 완료 개수, 메모)

## 기술 스택

- 순수 HTML / CSS / JavaScript (프레임워크, 빌드 도구, npm 패키지 없음)
- 데이터 저장: 브라우저 localStorage (`routine-log` 키 하나)
- 배포: GitHub Pages

## 파일 구성

- `index.html` — 마크업/스타일/스크립트 전부 포함된 메인 파일
- `manifest.webmanifest` — 홈 화면 추가(PWA)용 메타데이터
- `icon.svg` — 홈 화면 아이콘

## 로컬에서 실행하기

```bash
cd daily-routine-check
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000` 접속

## 홈 화면에 추가하기

- **iPhone(Safari)**: 사이트 접속 → 공유 버튼 → "홈 화면에 추가"
- **Android(Chrome)**: 사이트 접속 → 메뉴(⋮) → "홈 화면에 추가"

## 데이터 관련 참고

체크 기록과 메모는 서버가 아니라 **각자의 브라우저(localStorage)에만** 저장됩니다.
다른 사람이 같은 사이트에 접속해도 서로의 기록은 보이지 않으며, 기기 간 동기화도 되지 않습니다.
