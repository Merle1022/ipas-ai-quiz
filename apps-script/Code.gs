// Bind this script to the quiz tracking spreadsheet before deploying as a web app.
// One completed exam is sent as one request so partial/concurrent per-question
// writes cannot leave the spreadsheet with an incomplete exam session.
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.type === 'exam_result') {
      lock.waitLock(20000);
      return saveExamResult_(ss, data);
    }
    if (data.type === 'sync_history') {
      lock.waitLock(20000);
      return syncHistory_(ss, data);
    }

    // Compatibility path for older quiz pages still sending one answer at a time.
    return saveLegacyAnswer_(ss, data);
  } catch (error) {
    return json_({ status: 'error', message: String(error) });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function saveExamResult_(ss, data) {
  var resultSheet = requiredSheet_(ss, '考試成績');
  var logSheet = requiredSheet_(ss, '測驗記錄');
  var wrongSheet = requiredSheet_(ss, '錯題本');
  var resultHeaders = [
    '完成時間', '測驗 ID', '模式', '考科', '總題數', '已作答', '答對', '分數',
    '合格線', '距合格差分', '實際秒數', '限時秒數', '時間（實際/限時）', '交卷方式',
    '未作答', '疑問題數', '考試名稱', '歷屆梯次', '錯題來源考試 ID'
  ];
  var logHeaders = [
    '測驗日期', '考科', '題號', '題目摘要', '我的選擇', '正確答案', '判定結果',
    '考點類別', '考試 ID', '考試名稱', '歷屆梯次', '考試完成時間', '錯題來源考試 ID', '疑問標記'
  ];
  var wrongHeaders = [
    '題號', '考科', '考點類別', '題目內容', '正確答案', '易錯觀念與解析', '複習狀態',
    '考試 ID', '考試名稱', '考試完成時間', '歷屆梯次', '最後重考時間',
    '最近作答狀態', '重考次數', '疑問標記', '複習類型', '我的選擇'
  ];
  ensureHeaders_(resultSheet, resultHeaders);
  ensureHeaders_(logSheet, logHeaders);
  ensureHeaders_(wrongSheet, wrongHeaders);

  var sessionId = String(data.sessionId || '');
  if (!sessionId) throw new Error('缺少測驗 ID，已停止寫入以免產生無法分組的紀錄');
  var resultExists = hasSession_(resultSheet, sessionId);

  var completedAt = data.completedAt ? new Date(data.completedAt) : new Date();
  var questions = Array.isArray(data.questionResults) ? data.questionResults : [];
  var sourceSessionId = String(data.sourceExamSessionId || '');
  var officialSession = data.officialSession || '';
  var knownLogs = existingKeys_(logSheet, 9, 3);
  var knownReview = existingKeys_(wrongSheet, 8, 1);

  if (questions.length) {
    var logRows = questions.filter(function (q) {
      return !knownLogs[sessionId + '|' + String(q.qId)];
    }).map(function (q) {
      return [completedAt, q.subject || data.subjectLabel || '', q.qId, q.question || '',
        q.myChoice || '未作答', q.correctAnswer || '', q.answered === false ? '未作答' : (q.isCorrect ? '正確' : '錯誤'),
        q.category || '', sessionId, data.examLabel || '', officialSession, completedAt, sourceSessionId,
        q.isDoubtful === true ? '是' : q.isDoubtful === false ? '否' : ''];
    });
    appendRows_(logSheet, logRows);

    if (sourceSessionId && !resultExists) {
      updateRetakenWrongRows_(wrongSheet, sourceSessionId, questions, completedAt);
    } else if (!sourceSessionId) {
      var reviewQuestions = questions.filter(function (q) {
        return (!q.isCorrect || q.isDoubtful === true) && !knownReview[sessionId + '|' + String(q.qId)];
      });
      var wrongRows = reviewQuestions.map(function (q) {
        return [q.qId, q.subject || data.subjectLabel || '', q.category || '', q.question || '',
          q.correctAnswer || '', q.explanation || '', '待複習', sessionId, data.examLabel || '',
          completedAt, officialSession, '', '', 0,
          q.isDoubtful === true ? '是' : q.isDoubtful === false ? '否' : '',
          !q.isCorrect ? (q.isDoubtful === true ? '錯題＋疑問' : '錯題') : '疑問題',
          q.myChoice || '未作答'];
      });
      appendRows_(wrongSheet, wrongRows);
    }
  }

  if (!resultExists) appendRows_(resultSheet, [[
    completedAt, sessionId, data.modeLabel || data.mode || '', data.subjectLabel || '',
    data.questionCount || 0, data.answeredCount || 0, data.correctCount || 0, data.score || 0,
    data.passLine || 70, data.pointsToPass || 0, data.elapsedSeconds || 0, data.limitSeconds || 0,
    data.durationText || '', data.timeExpired ? '時間到' : '提前交卷', data.unansweredCount || 0,
    data.doubtCount || 0, data.examLabel || '', officialSession, sourceSessionId
  ]]);

  return json_({ status: resultExists ? 'reconciled' : 'success', sessionId: sessionId,
    questionCount: questions.length });
}

function saveLegacyAnswer_(ss, data) {
  var logSheet = ss.getSheetByName('測驗記錄');
  var wrongSheet = ss.getSheetByName('錯題本');
  if (!logSheet || !wrongSheet) throw new Error('缺少測驗記錄或錯題本工作表');
  logSheet.appendRow([new Date(), data.subject || '考科一', data.qId, data.question,
    data.myChoice, data.correctAnswer, data.isCorrect ? '正確' : '錯誤', data.category]);
  if (!data.isCorrect) wrongSheet.appendRow([data.qId, data.subject || '考科一', data.category,
    data.question, data.correctAnswer, data.explanation, '待複習']);
  return json_({ status: 'success' });
}

function syncHistory_(ss, data) {
  var resultSheet = requiredSheet_(ss, '考試成績');
  var logSheet = requiredSheet_(ss, '測驗記錄');
  var wrongSheet = requiredSheet_(ss, '錯題本');
  var resultHeaders = [
    '完成時間', '測驗 ID', '模式', '考科', '總題數', '已作答', '答對', '分數',
    '合格線', '距合格差分', '實際秒數', '限時秒數', '時間（實際/限時）', '交卷方式',
    '未作答', '疑問題數', '考試名稱', '歷屆梯次', '錯題來源考試 ID'
  ];
  var logHeaders = [
    '測驗日期', '考科', '題號', '題目摘要', '我的選擇', '正確答案', '判定結果',
    '考點類別', '考試 ID', '考試名稱', '歷屆梯次', '考試完成時間', '錯題來源考試 ID', '疑問標記'
  ];
  var wrongHeaders = [
    '題號', '考科', '考點類別', '題目內容', '正確答案', '易錯觀念與解析', '複習狀態',
    '考試 ID', '考試名稱', '考試完成時間', '歷屆梯次', '最後重考時間',
    '最近作答狀態', '重考次數', '疑問標記', '複習類型', '我的選擇'
  ];
  ensureHeaders_(resultSheet, resultHeaders);
  ensureHeaders_(logSheet, logHeaders);
  ensureHeaders_(wrongSheet, wrongHeaders);

  var results = Array.isArray(data.results) ? data.results : [];
  var sessions = Array.isArray(data.sessions) ? data.sessions : [];
  var knownSessions = existingIds_(resultSheet, 2);
  var knownLogs = existingKeys_(logSheet, 9, 3);
  var knownWrong = existingKeys_(wrongSheet, 8, 1);
  var existingLogRows = existingRowNumbers_(logSheet, 9, 3);
  var existingReviewRows = existingRowNumbers_(wrongSheet, 8, 1);
  var legacyWrongRows = {};
  var wrongLastRow = wrongSheet.getLastRow();
  var existingWrongRows = wrongLastRow > 1
    ? wrongSheet.getRange(2, 1, wrongLastRow - 1, 14).getValues() : [];
  existingWrongRows.forEach(function (row, index) {
    if (!row[7] && row[0] && row[2]) {
      var legacyKey = String(row[0]) + '|' + String(row[2]);
      if (!legacyWrongRows[legacyKey]) legacyWrongRows[legacyKey] = [];
      legacyWrongRows[legacyKey].push(index + 2);
    }
  });
  var sessionCandidates = {};
  sessions.forEach(function (session) {
    (Array.isArray(session && session.wrongQuestions) ? session.wrongQuestions : []).forEach(function (q) {
      var candidateKey = String(q.id) + '|' + String(q.category || '');
      if (!sessionCandidates[candidateKey]) sessionCandidates[candidateKey] = {};
      sessionCandidates[candidateKey][String(session.sessionId)] = true;
    });
  });
  var resultRows = [];
  var logRows = [];
  var wrongRows = [];
  var legacyLinks = [];
  var logFlagUpdates = [];
  var reviewUpdates = [];

  results.forEach(function (r) {
    if (!r || !r.sessionId || knownSessions[String(r.sessionId)]) return;
    var completedAt = r.completedAt ? new Date(r.completedAt) : new Date();
    resultRows.push([
      completedAt, r.sessionId, r.modeLabel || r.mode || '', r.subjectLabel || '', r.questionCount || 0,
      r.answeredCount || 0, r.correctCount || 0, r.score || 0, r.passLine || 70, r.pointsToPass || 0,
      r.elapsedSeconds || 0, r.limitSeconds || 0, r.durationText || '', r.timeExpired ? '時間到' : '提前交卷',
      r.unansweredCount || 0, r.doubtCount || 0, r.examLabel || '', r.officialSession || '', r.sourceExamSessionId || ''
    ]);
    knownSessions[String(r.sessionId)] = true;
  });

  sessions.forEach(function (session) {
    if (!session || !session.sessionId) return;
    var completedAt = session.completedAt ? new Date(session.completedAt) : new Date();
    var missed = Array.isArray(session.wrongQuestions) ? session.wrongQuestions : [];
    var doubtful = Array.isArray(session.doubtQuestions) ? session.doubtQuestions : [];
    var doubtIds = {};
    doubtful.forEach(function (q) { doubtIds[String(q.id)] = true; });
    var missedIds = {};
    missed.forEach(function (q) { missedIds[String(q.id)] = true; });
    var reviewQuestions = missed.concat(doubtful.filter(function (q) { return !missedIds[String(q.id)]; }));
    reviewQuestions.forEach(function (q) {
      var qid = String(q.id);
      var key = String(session.sessionId) + '|' + qid;
      var selected = Number.isInteger(q.lastSelected) ? 'ABCD'[q.lastSelected] : '未作答';
      var correct = Number.isInteger(q.answer) ? 'ABCD'[q.answer] : '';
      var outcome = selected === '未作答' ? '未作答' : selected === correct ? '正確' : '錯誤';
      var isWrong = !!missedIds[qid];
      var isDoubtful = !!doubtIds[qid];
      var doubtFlag = session.doubtKnown ? (isDoubtful ? '是' : '否') : '';
      var reviewType = isWrong ? (isDoubtful ? '錯題＋疑問' : '錯題') : '疑問題';
      var subject = q.category && q.category.indexOf('考科二') === 0 ? '考科二' : '考科一';
      var legacyKey = qid + '|' + String(q.category || '');
      var candidates = Object.keys(sessionCandidates[legacyKey] || {});
      var matchingLegacy = legacyWrongRows[legacyKey] || [];
      if (knownWrong[key]) {
        if (session.doubtKnown) reviewUpdates.push({ row: existingReviewRows[key], flag: doubtFlag,
          type: reviewType, selected: selected });
      } else if (isWrong && candidates.length === 1 && candidates[0] === String(session.sessionId) && matchingLegacy.length) {
        var legacyRow = matchingLegacy.shift();
        legacyLinks.push({ row: legacyRow, sessionId: session.sessionId,
          examLabel: session.examLabel || '', completedAt: completedAt,
          officialSession: session.officialSession || '', outcome: outcome,
          flag: doubtFlag, type: reviewType, selected: selected });
      } else {
        wrongRows.push([qid, subject, q.category || '', q.question || '', correct,
          q.explanation || '', '待複習', session.sessionId, session.examLabel || '', completedAt,
          session.officialSession || '', '', outcome, 0, doubtFlag, reviewType, selected]);
      }
      knownWrong[key] = true;
      if (!knownLogs[key]) {
        logRows.push([completedAt, subject, qid, q.question || '', selected, correct, outcome,
          q.category || '', session.sessionId, session.examLabel || '', session.officialSession || '',
          completedAt, '', doubtFlag]);
        knownLogs[key] = true;
      } else if (session.doubtKnown) {
        logFlagUpdates.push({ row: existingLogRows[key], flag: doubtFlag });
      }
    });
  });

  appendRows_(logSheet, logRows);
  appendRows_(wrongSheet, wrongRows);
  legacyLinks.forEach(function (item) {
    wrongSheet.getRange(item.row, 8, 1, 4).setValues([[item.sessionId, item.examLabel,
      item.completedAt, item.officialSession]]);
    wrongSheet.getRange(item.row, 13, 1, 2).setValues([[item.outcome, 0]]);
    wrongSheet.getRange(item.row, 15, 1, 3).setValues([[item.flag, item.type, item.selected]]);
  });
  logFlagUpdates.forEach(function (item) { logSheet.getRange(item.row, 14).setValue(item.flag); });
  reviewUpdates.forEach(function (item) {
    wrongSheet.getRange(item.row, 15, 1, 3).setValues([[item.flag, item.type, item.selected]]);
  });
  appendRows_(resultSheet, resultRows);
  return json_({ status: 'success', importedExamResults: resultRows.length,
    importedQuestionLogs: logRows.length, importedWrongQuestions: wrongRows.length });
}

function updateRetakenWrongRows_(sheet, sourceSessionId, questions, completedAt) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var values = sheet.getRange(2, 1, lastRow - 1, 17).getValues();
  var byQuestion = {};
  questions.forEach(function (q) { byQuestion[String(q.qId)] = q; });
  var updates = [];
  values.forEach(function (row, index) {
    if (String(row[7]) !== sourceSessionId) return;
    if (String(row[15]) === '疑問題') return;
    var q = byQuestion[String(row[0])];
    if (!q) return;
    var outcome = q.answered === false ? '未作答' : (q.isCorrect ? '正確' : '錯誤');
    updates.push({ row: index + 2, outcome: outcome, mastered: !!q.isCorrect,
      attempts: Number(row[13] || 0) + 1 });
  });
  updates.forEach(function (item) {
    sheet.getRange(item.row, 7, 1, 1).setValue(item.mastered ? '已掌握' : '待複習');
    sheet.getRange(item.row, 12, 1, 3).setValues([[completedAt, item.outcome, item.attempts]]);
  });
}

function ensureHeaders_(sheet, headers) {
  var current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var updates = [];
  for (var i = 0; i < headers.length; i++) {
    if (!current[i]) updates.push({ column: i + 1, value: headers[i] });
    else if (String(current[i]) !== headers[i]) throw new Error('工作表「' + sheet.getName() + '」第 ' + (i + 1) + ' 欄標題與預期不同，已停止寫入');
  }
  updates.forEach(function (item) { sheet.getRange(1, item.column).setValue(item.value); });
}

function hasSession_(sheet, sessionId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  return sheet.getRange(2, 2, lastRow - 1, 1).getValues().some(function (row) {
    return String(row[0]) === sessionId;
  });
}

function existingIds_(sheet, column) {
  var ids = {};
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, column, lastRow - 1, 1).getValues().forEach(function (row) {
    if (row[0]) ids[String(row[0])] = true;
  });
  return ids;
}

function existingKeys_(sheet, sessionColumn, questionColumn) {
  var keys = {};
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, Math.max(sessionColumn, questionColumn)).getValues().forEach(function (row) {
    if (row[sessionColumn - 1] && row[questionColumn - 1]) {
      keys[String(row[sessionColumn - 1]) + '|' + String(row[questionColumn - 1])] = true;
    }
  });
  return keys;
}

function existingRowNumbers_(sheet, sessionColumn, questionColumn) {
  var rows = {};
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, Math.max(sessionColumn, questionColumn)).getValues().forEach(function (row, index) {
    if (row[sessionColumn - 1] && row[questionColumn - 1]) {
      rows[String(row[sessionColumn - 1]) + '|' + String(row[questionColumn - 1])] = index + 2;
    }
  });
  return rows;
}

function appendRows_(sheet, rows) {
  if (!rows.length) return;
  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}

function requiredSheet_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('缺少「' + name + '」工作表');
  return sheet;
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
