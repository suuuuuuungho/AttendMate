# AttendMate 디자인 규칙

Apple 웹 디자인 분석(`Apple-design-analysis`)을 출석 관리 서비스 AttendMate에 맞게 재해석한 디자인 시스템 규칙이다. 토큰과 컴포넌트 문법은 원본을 그대로 차용하고, "제품 사진"이 중심이던 자리를 AttendMate의 "기능 화면 / 데이터 스크린샷"이 대신한다.

토큰 구현: [assets/css/tokens.css](assets/css/tokens.css) · 타이포 유틸: [assets/css/base.css](assets/css/base.css) · 컴포넌트: [assets/css/components.css](assets/css/components.css)

## 핵심 원칙 (그대로 계승)

1. **화면(스크린샷)이 주인공, UI는 배경으로 물러난다.** Apple이 제품 사진을 앞세우듯, AttendMate는 출석 대시보드·QR 체크인 화면·리포트 화면의 실제 스크린샷을 앞세운다. 장식적 일러스트나 스톡 이미지 대신 실제 제품 화면을 쓴다.
2. **단 하나의 액센트 컬러.** `--color-primary` (#0066cc) 외에 어떤 색도 "클릭 가능"을 의미하지 않는다. 출석/결석/지각 등 상태를 색으로 구분해야 하는 경우에도(아래 "예외" 참조) 버튼·링크의 인터랙션 컬러는 절대 흔들리지 않는다.
3. **라이트 ↔ 다크 타일 교차로 섹션을 나눈다.** 테두리, 그림자, 구분선 대신 배경색 전환 자체가 섹션의 경계다.
4. **그림자는 단 하나.** `--shadow-artifact` 는 표면 위에 놓인 스크린샷/목업 이미지에만 사용한다. 카드, 버튼, 텍스트에는 절대 그림자를 넣지 않는다.
5. **SF Pro Display(제목) / SF Pro Text(본문) 이원 체계**와 디스플레이 크기의 네거티브 자간을 그대로 유지한다.

## 색상 적용 규칙

| 토큰 | 값 | AttendMate에서의 용도 |
|---|---|---|
| `--color-primary` | #0066cc | 모든 버튼·링크·포커스. "체크인", "리포트 보기" 등 1차 CTA |
| `--color-primary-on-dark` | #2997ff | 다크 타일 위 인라인 링크 (라이트용 블루는 다크 배경에서 사용 금지) |
| `--color-canvas` | #ffffff | 기본 캔버스, 유틸리티 카드(출석 통계 카드 등) |
| `--color-canvas-parchment` | #f5f5f7 | 교차 섹션, 푸터, 기본 페이지 배경 |
| `--color-surface-tile-1/2/3` | #272729 / #2a2a2c / #252527 | 다크 히어로 섹션(예: "실시간 출석 현황" 소개 섹션) |
| `--color-surface-black` | #000000 | 글로벌 상단 네비게이션 바 전용 |
| `--color-ink` / `--color-body-on-dark` | #1d1d1f / #ffffff | 라이트/다크 표면 텍스트 |

### 예외: 출석 상태 색상
출석(정상)/지각/결석 같은 **상태 표시(status) 색상**은 Apple 원본에 없는 AttendMate 고유 요구사항이다. 이는 브랜드 액센트가 아니라 **데이터 시맨틱 컬러**로 별도 취급한다.
- 상태 색은 배지·도트·표 셀 안에서만 쓰고, 버튼이나 링크에는 쓰지 않는다 (클릭 가능 신호는 여전히 `--color-primary`뿐).
- 상태 색은 채도를 낮춰 Action Blue보다 시각적 우선순위가 낮게 만든다.
- 신규 토큰 제안: `--color-status-present`(출석), `--color-status-late`(지각), `--color-status-absent`(결석) — 실제 값은 브랜드 컬러 확정 후 별도로 정의하고 이 문서에 추가한다.

## 타이포그래피 적용 규칙

원본의 웨이트 사다리(300 / 400 / 600 / 700, 500 없음)와 디스플레이 자간 규칙을 그대로 따른다.

- 페이지 히어로 제목: `.text-hero-display` (56px/600) — 예: "출석, 이제 QR 한 번으로"
- 섹션(타일) 제목: `.text-display-lg` (40px/600) — 각 기능 타일의 헤드라인
- 타일 서브카피: `.text-lead` (28px/400)
- 서브내비 카테고리명: `.text-tagline` (21px/600) — 예: "대시보드", "리포트", "설정"
- 본문: `.text-body` — **반드시 17px**, 16px 사용 금지
- 푸터 링크 목록: `.text-dense-link` (17px, line-height 2.41의 여유로운 행간)
- 표/리포트의 숫자(출석률, 통계)는 본문과 같은 사이즈 체계를 쓰되 강조가 필요하면 `.text-body-strong`(600)을 쓴다. 500 웨이트는 만들지 않는다.

## 컴포넌트 매핑

| Apple 원본 | AttendMate 재해석 | 클래스 |
|---|---|---|
| `product-tile-light/dark/parchment` | 기능 소개 섹션 (히어로, QR 체크인, 리포트, 알림) | `.tile.tile-light` / `.tile-dark` / `.tile-parchment` |
| 제품 렌더 + 시스템 그림자 | 대시보드/앱 스크린샷 + `--shadow-artifact` | `.tile__artifact` |
| `store-utility-card` | 요금제 카드, 기능 비교 카드, 통계 요약 카드 | `.utility-card` |
| `configurator-option-chip` | 플랜 옵션 선택(월간/연간), 필터 칩 | `.option-chip` |
| `search-input` | 학생/수업 검색창 | `.search-input` |
| `floating-sticky-bar` | 가입 유도 하단 고정 바 ("지금 무료로 시작하기") | `.floating-sticky-bar` |
| `global-nav` + `sub-nav-frosted` | 상단 블랙 네비 + 페이지별 프로스티드 서브내비 | `.global-nav` / `.sub-nav-frosted` |
| `footer` | 하단 링크/법적 고지 | `.footer` |

버튼 문법은 원본 그대로 두 가지만 쓴다:
- **Pill (`--radius-pill`)**: 액션 CTA — `.btn-primary`, `.btn-secondary-pill`, `.btn-store-hero`
- **Compact rect (`--radius-sm`)**: 유틸리티 액션(로그인, 설정) — `.btn-dark-utility`

## Do / Don't (AttendMate 적용)

**Do**
- 모든 CTA·링크는 `--color-primary` 하나로 통일한다.
- 기능 섹션은 라이트/다크 타일을 교차 배치해 리듬을 만든다 (히어로 라이트 → 기능 다크 → 유틸리티 라이트 → 기능 다크 → 푸터 파치먼트).
- 스크린샷/목업 이미지에만 `--shadow-artifact`를 적용한다.
- 버튼 눌림 상태는 `transform: scale(0.95)` 하나로 통일한다.

**Don't**
- 카드·버튼·텍스트에 그림자를 넣지 않는다.
- 브랜드 액센트로 2번째 컬러를 쓰지 않는다. 출석 상태 색은 위 "예외" 규정을 따른다.
- 타일 섹션에 border-radius를 주지 않는다 (엣지-투-엣지 사각형 유지).
- 본문을 16px나 500 웨이트로 쓰지 않는다.

## 반응형 규칙 (그대로 계승)

기준 breakpoint: 1440 / 1068 / 833 / 734 / 640 / 480px.
- 글로벌 네비: 833px 이하에서 햄버거로 축소.
- 서브내비: 833px 이하에서 인라인 링크 숨기고 카테고리명 + 1차 CTA만 유지.
- 타일: 833px 이하 1열, 상하 패딩 80px → 48px.
- 유틸리티 카드 그리드(요금제/기능 비교): 4열(1440) → 3열(1068) → 2열(833) → 1열(640).

## 미해결 / 추가 정의 필요

- 출석 상태 시맨틱 컬러(`--color-status-present/late/absent`)의 실제 hex 값 — 브랜드 회의 후 확정.
- 다크모드 대응 (원본 Apple 분석에도 다크모드 카드 스펙은 없음 — AttendMate에서 필요 시 별도 설계).
- 폼 검증/에러 상태 스타일 (원본에 미문서화) — 출석 정정 요청 폼 등에 필요 시 추가 정의.
