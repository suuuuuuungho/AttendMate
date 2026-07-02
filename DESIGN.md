# AttendMate 디자인 규칙

AttendMate는 화면 하나(좌석 배치 현황 — `index.html`)로 동작하는 출석 체크 도구다. 마케팅 랜딩 페이지는 없다. Apple 웹 디자인 분석(`Apple-design-analysis`)에서 색상·타이포·spacing·radius 토큰과 버튼/네비 문법만 그대로 차용하고, "제품 사진 갤러리" 같은 페이지 구조는 쓰지 않는다.

**모바일 우선.** 웹보다 모바일에서 쓰는 빈도가 높다고 가정하고 설계한다 — 좌석판은 영화관 좌석 예매 화면처럼 전체가 한눈에 들어와야 하고, 타임 선택처럼 좁은 화면에서 줄바꿈될 수 있는 요소는 pill 탭 대신 드롭다운을 쓴다.

토큰 구현: [assets/css/tokens.css](assets/css/tokens.css) · 타이포 유틸: [assets/css/base.css](assets/css/base.css) · 컴포넌트: [assets/css/components.css](assets/css/components.css) · 좌석 배치: [assets/css/seatmap.css](assets/css/seatmap.css)

## 핵심 원칙

1. **단 하나의 액센트 컬러.** `--color-primary` (#0066cc) 외에 어떤 색도 "클릭 가능"을 의미하지 않는다. 좌석 점유 상태를 색으로 구분해야 하는 경우에도(아래 "예외" 참조) 버튼·링크의 인터랙션 컬러는 절대 흔들리지 않는다.
2. **그림자는 쓰지 않는다.** 카드, 버튼, 텍스트, 모달 어디에도 그림자를 넣지 않는다. 계층은 배경색 전환(검정 네비 → 프로스티드 서브내비 → 흰 캔버스)으로만 표현한다.
3. **SF Pro Display(제목) / SF Pro Text(본문) 이원 체계**와 디스플레이 크기의 네거티브 자간을 그대로 유지한다.

## 색상 적용 규칙

| 토큰 | 값 | AttendMate에서의 용도 |
|---|---|---|
| `--color-primary` | #0066cc | 모든 버튼·링크·포커스 |
| `--color-surface-black` | #000000 | 글로벌 상단 네비게이션 바 전용 |
| `--color-canvas-parchment` | #f5f5f7 (80% 투명 + blur) | 서브내비 프로스티드 배경 |
| `--color-canvas` | #ffffff | 기본 페이지 배경, 모달 |
| `--color-ink` / `--color-body-on-dark` | #1d1d1f / #ffffff | 라이트/다크 표면 텍스트 |

### 예외: 좌석 상태 색상
좌석 배치 현황(영화관식 좌석 선택 화면)의 **점유 상태 표시**는 Apple 원본에 없는 AttendMate 고유 요구사항이다. 이는 브랜드 액센트가 아니라 **데이터 시맨틱 컬러**로 별도 취급하며, 좌석 버튼 안에서만 쓰고 링크·CTA에는 쓰지 않는다 (클릭 가능 신호는 여전히 `--color-primary`뿐).

| 토큰 | 값 | 의미 |
|---|---|---|
| `--color-status-available` | #ffffff (테두리 `--color-hairline`) | 빈 좌석 — 클릭해서 배정 가능 |
| `--color-status-selected` | `--color-primary` (#0066cc) | 지금 고르는 중인 좌석 |
| `--color-status-taken` | #d2d2d7 | 이미 배정된 좌석 — 클릭 불가, 채도를 낮춰 Action Blue보다 우선순위 낮게 처리 |
| `--color-status-taken-text` | `--color-ink-muted-48` (#7a7a7a) | 점유 좌석 위 좌석번호/이니셜 텍스트 |

구현: [assets/css/seatmap.css](assets/css/seatmap.css), 구조는 [assets/js/seat-map.js](assets/js/seat-map.js).

## 타이포그래피 적용 규칙

- 서브내비 타이틀("좌석 배치 현황"): `.sub-nav-frosted__title` (15px/600) — 오른쪽에 타임 드롭다운이 같이 들어가는 좁은 바라 `.text-tagline`(21px) 대신 축소해서 쓴다
- 본문/모달 텍스트: `.text-body` — **반드시 17px**, 16px 사용 금지
- 모달 제목: `.text-body-strong` (17px/600)
- 캡션(마지막 갱신 시각, 검색 결과 부가정보): `.text-caption` (14px/400)
- 500 웨이트는 쓰지 않는다. 사다리는 300 / 400 / 600 / 700만 존재.

## 컴포넌트 매핑

| Apple 원본 | AttendMate 재해석 | 클래스 |
|---|---|---|
| `search-input` | 좌석 배정용 학생 검색창 | `.search-input` |
| `global-nav` + `sub-nav-frosted` | 상단 블랙 네비 + 프로스티드 서브내비 | `.global-nav` / `.sub-nav-frosted` |
| (신규, 원본에 없음) | 영화관식 좌석 배치 현황 — 8구역 640석 그리드 | `.seat-map`, `.seat` (+ 상태 클래스 `.seat--available/--selected/--taken`) |
| (신규, 원본에 없음) | 타임(1~7타임) 선택 드롭다운 — 서브내비 우측, 화면 폭과 무관하게 항상 한 줄 | `.time-select` |
| (신규, 원본에 없음) | 학생 검색/좌석 배정, 점유자 안내 모달 | `.modal-overlay`, `.modal-panel` |
| (신규, 원본에 없음) | 좌석판 상단 "강단" 표시 바 — 좌석 줄과 같은 스케일 그룹(`.seat-map__rows`) 안에 있어 좌석판 확대/축소에 함께 반응 | `.seat-map__stage` |

버튼 문법은 원본 그대로 두 가지만 쓴다:
- **Pill (`--radius-pill`)**: 액션 CTA — `.btn-primary`, `.btn-secondary-pill`
- **Compact rect (`--radius-sm`)**: 유틸리티 액션(새로고침) — `.btn-dark-utility`

## Do / Don't

**Do**
- 모든 CTA·링크는 `--color-primary` 하나로 통일한다.
- 버튼 눌림 상태는 `transform: scale(0.95)` 하나로 통일한다.
- 좌석 점유 상태 표시는 반드시 좌석 버튼 안에서만 쓴다.

**Don't**
- 카드·버튼·텍스트에 그림자를 넣지 않는다.
- 브랜드 액센트로 2번째 컬러를 쓰지 않는다. 좌석 상태 색은 위 "예외" 규정을 따른다.
- 본문을 16px나 500 웨이트로 쓰지 않는다.

## 반응형 규칙

640석 그리드는 **영화관 좌석 예매 화면처럼 전체가 한눈에 들어오는 걸 기본으로 하되, 좌석이 안 보일 정도로 작아지지는 않는다.** 구역 배치(줄바꿈 없음, A~H 전부 같은 층)는 고정하고, 좌석 크기는 화면 폭에 맞춰 `transform: scale()`로 축소하되 `MIN_SCALE`(0.6) 밑으로는 줄이지 않는다 — 그보다 더 넘치는 폭은 `.seat-map__scroll`의 가로 스크롤로 본다. "강단" 표시 바는 `.seat-map__rows` 안, 좌석 줄과 같은 스케일 그룹에 있어서 좌석판이 확대/축소될 때 항상 같은 비율로 함께 커지고 작아진다 — 밖에 따로 있으면 강단만 따로 논다. 두 줄(+강단)은 같은 배율로 함께 움직이기 때문에 A구역과 E구역처럼 같은 열의 구역이 항상 정렬 상태를 유지한다. 구현은 [assets/js/seat-map.js](assets/js/seat-map.js)의 `fitToWidth()`.

타임 선택은 pill 탭이 아니라 `.time-select` 드롭다운을 쓴다 — 좁은 화면에서 여러 개의 pill이 두 줄로 줄바꿈되는 걸 원천적으로 막기 위함.

## 미해결 / 추가 정의 필요

- 다크모드 대응 (원본 Apple 분석에도 다크모드 카드 스펙은 없음 — 필요 시 별도 설계).
- 폼 검증/에러 상태 스타일 (원본에 미문서화) — 현재는 `alert()`로만 오류를 표시한다.
