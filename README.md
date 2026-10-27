# iPAS AI 錯題特訓｜ipas-ai-quiz

[線上練習](https://merle1022.github.io/ipas-ai-quiz/) · [製作與複習流程](https://merle188.com/blog/ipas-ai-quiz-wrong-answer-practice/)

給 iPAS AI 應用規劃師初級備考者的**非官方練習工具**。目前題庫 60 題，涵蓋兩個考科。每份考卷從兩科各抽 15 題，共 30 題；題目與選項在開始時重新排序。完成作答後可產生下一份考卷，先前出現過的題目仍會隨機再出現。題數與配比是本站練習設定，不代表正式考試。

選題後由網頁程式比對固定答案並顯示解析。答錯的題目會存到**目前瀏覽器**的 `localStorage`，可在「錯題本」查看。清除網站資料、更換瀏覽器或裝置，紀錄不會自動同步。完成一份考卷後會顯示答對題數；目前不會保存未完成考卷的進度。

## 題目來源與核對

題庫中的新增練習題依 [iPAS AI 應用規劃師官方學習資源與公告試題](https://www.ipas.org.tw/)所涵蓋的考點重新撰寫，也參照個人備考時整理的講義主題。本站沒有轉載完整教師講義或公告試卷；題目、答案和解析不是 iPAS 官方提供或認證。若發現錯誤，歡迎開 issue 指出題號、疑點與可核對來源。別人的備考心得只供辨識常見困難，不直接當成題目或答案。

## 選用：把作答紀錄存到自己的 Google 試算表

不填任何網址也能直接練習。若要在自己的試算表保存每次作答，請建立含「測驗記錄」和「錯題本」兩個工作表的試算表，從「擴充功能 → Apps Script」加入下面程式，部署為網頁應用程式，再把你自己的部署網址貼到測驗頁。部署權限與資料分享範圍請自行核對；勿把含個資的試算表公開。

```javascript
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const log = ss.getSheetByName('測驗記錄');
    const wrong = ss.getSheetByName('錯題本');
    if (!log || !wrong) throw new Error('缺少測驗記錄或錯題本工作表');
    const d = JSON.parse(e.postData.contents);
    log.appendRow([new Date(), d.subject, d.qId, d.question, d.myChoice,
      d.correctAnswer, d.isCorrect ? '正確' : '錯誤', d.category]);
    if (!d.isCorrect) wrong.appendRow([d.qId, d.subject, d.category,
      d.question, d.correctAnswer, d.explanation, '待複習']);
    return ContentService.createTextOutput('ok');
  } catch (error) {
    return ContentService.createTextOutput(String(error));
  }
}
```

網頁使用 `no-cors` 傳送請求，因此「已送出」**不能證明寫入成功**。設定後請實際答一題，到自己的試算表檢查是否新增紀錄。知道網頁應用程式網址的人可能送出請求，請勿把部署網址放進公開 repo。

## 修改題庫

前 10 題在 `index.html` 的 `questions` 陣列，其餘 50 題在 `questions-extra.js`。新增題目請使用不重複的數字 `id`，填入考科、題目、四個選項、零起算的正確答案索引與解析。請提交自己有權公開的原創題，並附可查核的考點來源；不要直接複製教師講義、付費題庫或別人的備考文章。

本專案採 MIT 授權，詳見 [LICENSE](LICENSE)。這只涵蓋本 repo 中有權授權的原創程式與題目，不會授權第三方資料。
