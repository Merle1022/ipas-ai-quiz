// Bind this script to your own spreadsheet before deploying as a web app.
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const log = ss.getSheetByName('測驗記錄');
    const wrong = ss.getSheetByName('錯題本');
    const d = JSON.parse(e.postData.contents);
    if (d.type === 'exam_result') {
      const results = ss.getSheetByName('考試成績');
      if (!results) throw new Error('缺少考試成績工作表');
      results.appendRow([new Date(d.completedAt), d.sessionId, d.modeLabel, d.subjectLabel,
        d.questionCount, d.answeredCount, d.correctCount, d.score, d.passLine,
        d.pointsToPass, d.elapsedSeconds, d.limitSeconds, d.durationText,
        d.timeExpired ? '時間到' : '提前交卷',
        d.unansweredCount, d.doubtCount]);
      return ContentService.createTextOutput('ok');
    }
    if (!log || !wrong) throw new Error('缺少測驗記錄或錯題本工作表');
    log.appendRow([new Date(), d.subject, d.qId, d.question, d.myChoice,
      d.correctAnswer, d.isCorrect ? '正確' : '錯誤', d.category]);
    if (!d.isCorrect) wrong.appendRow([d.qId, d.subject, d.category,
      d.question, d.correctAnswer, d.explanation, '待複習']);
    return ContentService.createTextOutput('ok');
  } catch (error) {
    return ContentService.createTextOutput(String(error));
  }
}
