const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Sheet {
  constructor(name) { this.name = name; this.rows = [[]]; }
  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getRange(row, column, height = 1, width = 1) {
    return {
      getValues: () => Array.from({ length: height }, (_, r) =>
        Array.from({ length: width }, (_, c) => this.rows[row + r - 1]?.[column + c - 1] ?? '')),
      setValues: values => values.forEach((cells, r) => {
        const index = row + r - 1;
        while (this.rows.length <= index) this.rows.push([]);
        cells.forEach((value, c) => { this.rows[index][column + c - 1] = value; });
      }),
      setValue: value => {
        while (this.rows.length < row) this.rows.push([]);
        this.rows[row - 1][column - 1] = value;
      }
    };
  }
  appendRow(row) { this.rows.push(row); }
}

const sheets = Object.fromEntries(['考試成績', '測驗記錄', '錯題本'].map(name => [name, new Sheet(name)]));
const ss = { getSheetByName: name => sheets[name] };
const context = {
  ContentService: {
    MimeType: { JSON: 'JSON' },
    createTextOutput: value => ({ value, setMimeType() { return this; } })
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../apps-script/Code.gs', `file://${__filename}`), 'utf8'), context);

const base = {
  sessionId: 'exam-one', completedAt: '2026-11-07T01:00:00.000Z', examLabel: '115-3｜考科一',
  subjectLabel: '考科一', questionCount: 2, answeredCount: 2, correctCount: 1,
  questionResults: [
    { qId: 1, question: 'wrong', category: '考科一', myChoice: 'B', correctAnswer: 'A',
      isCorrect: false, answered: true, isDoubtful: false },
    { qId: 2, question: 'guessed right', category: '考科一', myChoice: 'C', correctAnswer: 'C',
      isCorrect: true, answered: true, isDoubtful: true }
  ]
};
context.saveExamResult_(ss, base);
assert.equal(sheets['測驗記錄'].rows.length, 3);
assert.deepEqual(sheets['測驗記錄'].rows.slice(1).map(row => row[13]), ['否', '是']);
assert.deepEqual(sheets['錯題本'].rows.slice(1).map(row => row[15]), ['錯題', '疑問題']);
assert.deepEqual(sheets['錯題本'].rows.slice(1).map(row => row[16]), ['B', 'C']);

context.saveExamResult_(ss, base);
assert.equal(sheets['測驗記錄'].rows.length, 3);
assert.equal(sheets['錯題本'].rows.length, 3);
assert.equal(sheets['考試成績'].rows.length, 2);

// A previous partial write must be repaired, even if its score row exists.
sheets['測驗記錄'].rows.splice(1, 1);
context.saveExamResult_(ss, base);
assert.equal(sheets['測驗記錄'].rows.length, 3);
assert.equal(sheets['考試成績'].rows.length, 2);

// Historical sync adds a correctly answered doubtful question and updates a known wrong row.
sheets['錯題本'].rows.splice(2, 1);
context.syncHistory_(ss, { results: [], sessions: [{
  sessionId: 'exam-one', completedAt: base.completedAt, examLabel: base.examLabel,
  doubtKnown: true,
  wrongQuestions: [{ id: 1, category: '考科一', question: 'wrong', answer: 0, lastSelected: 1 }],
  doubtQuestions: [{ id: 2, category: '考科一', question: 'guessed right', answer: 2, lastSelected: 2 }]
}] });
assert.equal(sheets['錯題本'].rows.length, 3);
assert.deepEqual(sheets['錯題本'].rows.slice(1).map(row => row[15]), ['錯題', '疑問題']);
assert.equal(sheets['測驗記錄'].rows.find(row => row[2] === 2)[13], '是');

// Correct doubtful questions are historical review, not wrong questions to mark mastered.
context.updateRetakenWrongRows_(sheets['錯題本'], 'exam-one',
  [{ qId: 1, answered: true, isCorrect: true }, { qId: 2, answered: true, isCorrect: true }], new Date());
assert.equal(sheets['錯題本'].rows.find(row => String(row[0]) === '1')[6], '已掌握');
assert.equal(sheets['錯題本'].rows.find(row => String(row[0]) === '2')[6], '待複習');

context.saveExamResult_(ss, {
  ...base, sessionId: 'legacy-exam', questionResults: [{
    qId: 3, question: 'old wrong', category: '考科一', myChoice: 'B', correctAnswer: 'A',
    isCorrect: false, answered: true
  }]
});
assert.equal(sheets['測驗記錄'].rows.find(row => row[2] === 3)[13], '');
assert.equal(sheets['錯題本'].rows.find(row => row[0] === 3)[14], '');
console.log('sheet sync scenarios passed');
