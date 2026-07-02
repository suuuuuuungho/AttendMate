/**
 * AttendMate 백엔드 — Sheet1(명단) + log(출석 기록) 스프레드시트에 바인딩된 Apps Script.
 * 배포 방법은 apps-script/SETUP.md 참고.
 */

var SPREADSHEET_ID = '1H_UIh7XQiPRnyAskPpMlu34OSRHTbjvifMgMqNrMcjo';
var SHEET_MEMBERS = 'Sheet1';
var SHEET_LOG = 'log';
var MAX_SEARCH_RESULTS = 20;

function doGet(e) {
  var action = e.parameter.action;
  try {
    if (action === 'getMember') return respond(getMember(e.parameter.id));
    if (action === 'searchMembers') return respond(searchMembers(e.parameter.q));
    if (action === 'getAllMembers') return respond(getAllMembers());
    if (action === 'getSeats') return respond(getSeats(e.parameter.time));
    return respond({ error: '알 수 없는 action: ' + action });
  } catch (err) {
    return respond({ error: err.message });
  }
}

function doPost(e) {
  var action = e.parameter.action;
  try {
    var body = JSON.parse(e.postData.contents);
    if (action === 'checkin') return respond(checkin(body));
    return respond({ error: '알 수 없는 action: ' + action });
  } catch (err) {
    return respond({ error: err.message });
  }
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 헤더 이름으로 0-based 컬럼 인덱스를 찾는다. 열 순서가 바뀌어도 안전하게 동작. */
function getColIndex(sheet, headerName) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idx = headers.indexOf(headerName);
  if (idx === -1) throw new Error('컬럼을 찾을 수 없습니다: ' + headerName + ' (시트: ' + sheet.getName() + ')');
  return idx;
}

function getMembersSheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_MEMBERS);
}

function getLogSheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_LOG);
}

/** id(회원ID)로 학생 1명 조회. 전화번호는 절대 반환하지 않는다. */
function getMember(id) {
  if (!id) return { found: false };
  var sheet = getMembersSheet();
  var idCol = getColIndex(sheet, '회원ID');
  var nameCol = getColIndex(sheet, '이름');
  var classCol = getColIndex(sheet, '학년반');
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  for (var i = 0; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      return {
        found: true,
        회원ID: String(data[i][idCol]),
        이름: String(data[i][nameCol]),
        학년반: String(data[i][classCol])
      };
    }
  }
  return { found: false };
}

/** 이름/회원ID/학년반에 q가 포함된 학생을 최대 MAX_SEARCH_RESULTS건 검색. */
function searchMembers(q) {
  if (!q) return { results: [] };
  var query = String(q).toLowerCase();
  var sheet = getMembersSheet();
  var idCol = getColIndex(sheet, '회원ID');
  var nameCol = getColIndex(sheet, '이름');
  var classCol = getColIndex(sheet, '학년반');
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  var results = [];
  for (var i = 0; i < data.length && results.length < MAX_SEARCH_RESULTS; i++) {
    var id = String(data[i][idCol]);
    var name = String(data[i][nameCol]);
    var cls = String(data[i][classCol]);
    if (id.toLowerCase().indexOf(query) !== -1 ||
        name.toLowerCase().indexOf(query) !== -1 ||
        cls.toLowerCase().indexOf(query) !== -1) {
      results.push({ 회원ID: id, 이름: name, 학년반: cls });
    }
  }
  return { results: results };
}

/**
 * 전체 학생 명단을 한 번에 반환 (검색을 매 키입력마다 서버에 물어보지 않고
 * 프론트엔드에서 캐시해 클라이언트 측 필터링에 쓰기 위함). 전화번호는 제외.
 */
function getAllMembers() {
  var sheet = getMembersSheet();
  var idCol = getColIndex(sheet, '회원ID');
  var nameCol = getColIndex(sheet, '이름');
  var classCol = getColIndex(sheet, '학년반');
  if (sheet.getLastRow() < 2) return { members: [] };
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  var members = [];
  for (var i = 0; i < data.length; i++) {
    if (!data[i][idCol]) continue;
    members.push({
      회원ID: String(data[i][idCol]),
      이름: String(data[i][nameCol]),
      학년반: String(data[i][classCol])
    });
  }
  return { members: members };
}

/** 특정 타임의 좌석 점유 현황을 { 좌석: {회원ID, 이름, 학년반} } 형태로 반환. */
function getSeats(time) {
  if (!time) return { seats: {} };
  var sheet = getLogSheet();
  if (sheet.getLastRow() < 2) return { seats: {} };

  var idCol = getColIndex(sheet, '회원ID');
  var nameCol = getColIndex(sheet, '이름');
  var classCol = getColIndex(sheet, '학년반');
  var seatCol = getColIndex(sheet, '좌석');
  var timeCol = getColIndex(sheet, '타임');
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  var seats = {};
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][timeCol]) === String(time)) {
      seats[data[i][seatCol]] = {
        회원ID: String(data[i][idCol]),
        이름: String(data[i][nameCol]),
        학년반: String(data[i][classCol])
      };
    }
  }
  return { seats: seats };
}

/**
 * 체크인 처리: 좌석 중복 배정과 회원 중복 체크인을 막고 log 탭에 한 행 추가.
 * body: { 회원ID, 이름, 학년반, 좌석, 타임 }
 */
function checkin(body) {
  var memberId = body.회원ID;
  var name = body.이름;
  var cls = body.학년반;
  var seat = body.좌석;
  var time = body.타임;
  if (!memberId || !seat || !time) {
    return { success: false, error: '필수 값이 없습니다 (회원ID/좌석/타임)' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getLogSheet();
    var idCol = getColIndex(sheet, '회원ID');
    var seatCol = getColIndex(sheet, '좌석');
    var timeCol = getColIndex(sheet, '타임');

    if (sheet.getLastRow() >= 2) {
      var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      for (var i = 0; i < data.length; i++) {
        if (String(data[i][timeCol]) !== String(time)) continue;
        if (String(data[i][seatCol]) === String(seat)) {
          return { success: false, error: '이미 배정된 좌석입니다: ' + seat };
        }
        if (String(data[i][idCol]) === String(memberId)) {
          return { success: false, error: '이미 체크인되었습니다 (좌석 ' + data[i][seatCol] + ')' };
        }
      }
    }

    var timestampCol = getColIndex(sheet, 'Timestamp');
    var nameCol = getColIndex(sheet, '이름');
    var classCol = getColIndex(sheet, '학년반');
    var row = new Array(sheet.getLastColumn()).fill('');
    row[timestampCol] = new Date();
    row[idCol] = memberId;
    row[nameCol] = name;
    row[classCol] = cls;
    row[seatCol] = seat;
    row[timeCol] = time;
    sheet.appendRow(row);

    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Sheet1의 D열(QR)에 회원ID를 인코딩한 QR 이미지를 채워 넣는다.
 * Apps Script 에디터에서 이 함수를 선택해 한 번 수동 실행한다 (메뉴 실행이 아니라 Run 버튼).
 */
function fillQrColumn() {
  var sheet = getMembersSheet();
  var idCol = getColIndex(sheet, '회원ID') + 1; // 1-based
  var qrCol = getColIndex(sheet, 'QR') + 1;
  var lastRow = sheet.getLastRow();

  for (var row = 2; row <= lastRow; row++) {
    var id = sheet.getRange(row, idCol).getValue();
    if (!id) continue;
    var formula = '=IMAGE("https://quickchart.io/qr?text=' + encodeURIComponent(String(id)) + '&size=200")';
    sheet.getRange(row, qrCol).setFormula(formula);
  }
}
