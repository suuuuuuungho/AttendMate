# Apps Script 배포 가이드

`Code.gs`를 구글 스프레드시트에 바인딩된 Apps Script로 배포해서, `seats.html`/`scan.html`이 호출할 수 있는 웹 API로 만드는 절차다.

## 1. log 탭 헤더 확인

스프레드시트의 `log` 탭 1행(헤더)이 정확히 아래 6개 이름으로 되어 있는지 확인한다 (순서는 상관없음 — 이름으로 찾음):

```
Timestamp | 회원ID | 이름 | 학년반 | 좌석 | 타임
```

`Sheet1` 탭도 `회원ID / 이름 / 학년반 / QR / 전화번호` 헤더가 있어야 한다.

## 2. Apps Script 프로젝트 만들기

`Code.gs`는 `SpreadsheetApp.openById(SPREADSHEET_ID)`로 스프레드시트를 직접 여는 방식이라, 스프레드시트에 바인딩된 프로젝트(확장 프로그램 → Apps Script)든 script.google.com에서 만든 독립형 프로젝트든 상관없이 동작한다.

1. 스프레드시트 열기 → 상단 메뉴 **확장 프로그램 → Apps Script** (또는 script.google.com에서 새 프로젝트)
2. 기본 생성된 `Code.gs` 내용을 전부 지우고, 이 저장소의 [`apps-script/Code.gs`](Code.gs) 내용을 그대로 붙여넣기
3. 파일 상단의 `SPREADSHEET_ID`가 실제 사용 중인 스프레드시트 ID와 같은지 확인 (다른 시트를 쓴다면 시트 URL의 `/d/`와 `/edit` 사이 값으로 교체)
4. 저장 (Ctrl+S)

## 3. 웹 앱으로 배포

1. 우측 상단 **배포 → 새 배포**
2. 유형 선택(톱니바퀴) → **웹 앱**
3. 설정:
   - 실행 계정: **나**
   - 액세스 권한이 있는 사용자: **모든 사용자**
4. **배포** 클릭 → 구글 계정 권한 승인(스프레드시트 접근 허용)
5. 배포 완료 후 나오는 **웹 앱 URL**을 복사한다 (`https://script.google.com/macros/s/.../exec` 형태)

## 4. 프론트엔드에 URL 연결

복사한 URL을 [`assets/js/config.js`](../assets/js/config.js)의 `APPS_SCRIPT_URL` 값에 붙여넣는다.

```js
const APPS_SCRIPT_URL = "여기에 배포 URL 붙여넣기";
```

## 5. QR 코드 생성 (선택, 1회)

Sheet1의 D열(QR)이 비어있다면:

1. Apps Script 에디터에서 함수 선택 드롭다운을 `fillQrColumn`으로 변경
2. **실행(▶)** 클릭 → 권한 승인
3. 완료되면 D열에 각 학생 회원ID를 인코딩한 QR 이미지가 채워진다 (QR 안에는 URL이 아니라 **회원ID 원문**이 들어있음 — `scan.html`이 이 값을 그대로 읽어서 조회한다)

## 6. 코드 수정 후 재배포

`Code.gs`를 나중에 고치면, 저장만으로는 실제 웹 앱에 반영되지 않는다. **배포 → 배포 관리 → 연필 아이콘(수정) → 버전: 새 버전 → 배포**로 다시 배포해야 한다.

### 자동 배포 (clasp)

이 프로젝트는 [clasp](https://github.com/google/clasp)로 연결되어 있어서, `apps-script/Code.gs`를 고친 뒤 아래 명령으로 push + 재배포까지 한 번에 할 수 있다 (에디터에 수동으로 붙여넣을 필요 없음).

```bash
cp apps-script/Code.gs apps-script/.clasp-sync/Code.js
cd apps-script/.clasp-sync
clasp push
clasp deploy -i AKfycbyu0GAye89rdHLsCXnfAsz4LgMM9XzLj05smSzisDMg0q82bLn7xTZVGhHPMALADfxQ -d "변경 내용 설명"
```

- 배포 ID(`-i` 뒤 값)를 그대로 써야 기존 웹앱 URL(`assets/js/config.js`의 `APPS_SCRIPT_URL`)이 그대로 유지된다. 새 배포로 만들면 URL이 바뀌어서 프론트엔드도 같이 수정해야 한다.
- `apps-script/.clasp-sync/`는 clasp가 관리하는 로컬 미러 폴더로, git에는 커밋하지 않는다(`.gitignore` 처리됨). 소스 오브 트루스는 `apps-script/Code.gs`.
- 최초 1회 `clasp login` 로그인과 [Apps Script API 활성화](https://script.google.com/home/usersettings)가 되어 있어야 한다.

## 문제 해결

- **브라우저 콘솔에 CORS 오류**: 배포 시 액세스 권한이 "모든 사용자"인지 다시 확인. "Google 계정이 있는 사용자"로 되어 있으면 익명 fetch가 막힌다.
- **"컬럼을 찾을 수 없습니다" 오류**: 1단계의 헤더 이름 철자/공백을 다시 확인.
- **`Cannot read properties of null (reading 'getSheetByName')` 오류**: `SPREADSHEET_ID`가 비어있거나 잘못된 값. 2-3단계에서 ID를 다시 확인하고 재배포.
- **체크인이 안 됨**: Apps Script 에디터 → 좌측 **실행** 메뉴에서 실제 오류 로그 확인 가능.

## 알려진 제약

이 배포 방식("모든 사용자" 액세스)은 별도 인증이 없다. 웹 앱 URL은 정적 사이트의 JS 코드에 그대로 노출되므로, URL을 알아낸 사람은 이론적으로 API를 직접 호출할 수 있다. 내부 행사용 MVP로는 감수 가능한 수준으로 보고 진행했으며, 전화번호는 어떤 API 응답에도 포함하지 않도록 `Code.gs`에서 이미 제외했다.
