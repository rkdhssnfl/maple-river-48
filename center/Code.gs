/* 경산기초학력거점지원센터 · 사례회의 참석 조사용 Apps Script
 * 시트 구성: 탭 "명단"(A열 2행부터 코칭단 이름) / 탭 "응답"(자동 생성) */
var RESP = '응답', ROSTER = '명단';

function sheet_(name, header) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); if (header) sh.appendRow(header); }
  return sh;
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet(e) {
  var ev = (e.parameter && e.parameter.event) || '';
  var roster = [];
  var rs = sheet_(ROSTER, ['이름']);
  var rv = rs.getRange(2, 1, Math.max(rs.getLastRow() - 1, 1), 1).getValues();
  rv.forEach(function (r) { var n = String(r[0] || '').trim(); if (n) roster.push(n); });
  var out = [];
  var sh = sheet_(RESP, ['시각', '일정', '이름', '응답', '메모']);
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().forEach(function (r) {
      if (String(r[1]) === ev) out.push({ name: String(r[2]), status: String(r[3]), memo: String(r[4] || ''), at: String(r[0]) });
    });
  }
  return json_({ ok: true, roster: roster, responses: out });
}

function doPost(e) {
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var d = JSON.parse(e.postData.contents);
    var ev = String(d.event || '').slice(0, 60), name = String(d.name || '').trim().slice(0, 30);
    var st = d.status === '참석' ? '참석' : (d.status === '불참' ? '불참' : '');
    var memo = String(d.memo || '').slice(0, 60);
    if (!ev || !name || !st) return json_({ ok: false, error: '입력 확인' });
    var rs = sheet_(ROSTER, ['이름']);
    var names = rs.getLastRow() > 1 ? rs.getRange(2, 1, rs.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]).trim(); }).filter(String) : [];
    if (names.length && names.indexOf(name) < 0) return json_({ ok: false, error: '명단에 없는 이름' });
    var sh = sheet_(RESP, ['시각', '일정', '이름', '응답', '메모']);
    var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
    var row = 0;
    if (sh.getLastRow() > 1) {
      var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
      for (var i = 0; i < vals.length; i++) if (String(vals[i][1]) === ev && String(vals[i][2]) === name) { row = i + 2; break; }
    }
    if (row) sh.getRange(row, 1, 1, 5).setValues([[now, ev, name, st, memo]]); else sh.appendRow([now, ev, name, st, memo]);
    return json_({ ok: true });
  } finally { lock.releaseLock(); }
}
