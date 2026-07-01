# AttendMate

교회 중등부/신입부 출석 체크를 위한 좌석 배치 현황 화면. 영화관식 좌석 선택 UI(8구역, 640석)로 좌석을 골라 학생을 배정하면 즉시 출석 체크가 된다. 화면은 `index.html` 하나뿐이다.

디자인 규칙은 [DESIGN.md](DESIGN.md) 참고. 순수 HTML/CSS/JS(빌드 도구 없음)로 구성되어 GitHub Pages에 바로 배포할 수 있다.

## 구조

```
index.html                     좌석 배치 현황 화면 (유일한 페이지)
assets/css/tokens.css          디자인 토큰 (색상 · 타이포 · spacing · radius)
assets/css/base.css            리셋 + 타이포그래피 유틸 클래스
assets/css/components.css      버튼 · 네비 · 검색창 컴포넌트
assets/css/seatmap.css         좌석 그리드 · 타임 탭 · 모달 · 토스트
assets/js/config.js            Apps Script 웹앱 URL, 타임 목록
assets/js/api.js               Apps Script 호출 래퍼 (URL 없으면 mock.js로 자동 대체)
assets/js/mock.js              로컬 프리뷰용 목업 데이터
assets/js/seat-map.js          8구역 640석 그리드 렌더러
assets/js/time-tabs.js         타임 선택 pill 탭 렌더러
assets/js/seats.js             index.html 페이지 로직 (검색/배정/폴링)
apps-script/                   Google Apps Script 백엔드 + 배포 가이드
DESIGN.md                      디자인 규칙 문서
```

## 백엔드

구글 스프레드시트(학생 명단 + 출석 log 탭)를 Apps Script Web App으로 감싼 백엔드를 쓴다. 배포·재배포 방법은 [apps-script/SETUP.md](apps-script/SETUP.md) 참고.

## 로컬 미리보기

```bash
python -m http.server 8080
# http://localhost:8080 접속
```

`assets/js/config.js`의 `APPS_SCRIPT_URL`이 비어있으면 `mock.js`의 목업 데이터로 자동 동작한다.

## GitHub Pages 배포

1. 이 폴더를 GitHub 저장소로 push한다 (`main` 브랜치, 루트에 `index.html` 유지).
2. GitHub 저장소 → **Settings → Pages**로 이동.
3. **Build and deployment → Source**를 `Deploy from a branch`로 설정.
4. **Branch**를 `main` / `/(root)`로 선택 후 저장.
5. 잠시 후 `https://<사용자명>.github.io/<저장소명>/` 에서 접속 가능.

빌드 단계가 없는 정적 사이트이므로 GitHub Actions 워크플로 없이 위 설정만으로 배포된다.
