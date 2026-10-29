# iPAS AI 錯題特訓｜ipas-ai-quiz

[線上練習（Netlify）](https://ipas-ai-quiz.netlify.app/) · [製作與複習流程](https://merle188.com/blog/ipas-ai-quiz-wrong-answer-practice/)

線上測驗統一使用上方 Netlify 網址。GitHub 倉庫保存公開的網站程式、題庫、說明與版本紀錄；不保存訪客的瀏覽器作答紀錄、你自己的 Google 試算表資料、Apps Script 專案或 Netlify 後台設定。若要完整備份個人學習資料，請另行備份試算表與相關設定。

給 iPAS AI 應用規劃師初級備考者的**非官方練習工具**。目前網站題庫 60 題（考科一 35 題、考科二 25 題）。提供四種入口：綜合練習（目前收錄的全部題庫）、每日隨機 10 題、年度／梯次官方公告試題連結，以及每科 75 分鐘的計時模擬。官方試題由 iPAS 學習資源頁直接提供 PDF；本站不重新發布官方試卷。計時模擬題量仍為現有的 35／25 題，尚未達正式試卷完整題量，故只模擬作答流程與單科時長，不宣稱完全復刻正式考試。各模式都可提早交卷；練習題交卷後顯示解析。

綜合練習會從網站內建題庫與「目前瀏覽器匯入的個人題庫」抽題。網站不會連線讀取 Google Drive、NotebookLM 或私人試算表；你可以先用 [`question-bank-generation-prompt.md`](question-bank-generation-prompt.md) 請 Gemini 從已連結的 Drive 整理原創題目 JSON，再由頁面匯入。匯入內容只存在該瀏覽器的 `localStorage`，不會傳到網站或 GitHub；換裝置或清除網站資料前，請保留原始 JSON 備份。格式範例見 [`question-bank-template.json`](question-bank-template.json)。私人題庫只會在「綜合練習」納入；若要參加單科練習，`category` 請以 `考科一｜` 或 `考科二｜` 開頭。不要把含個資、私人筆記或未授權的講義／考題提交到公開 repo。官方年度試題在網站內直接連到 [iPAS 公告試題 PDF](https://ipd.nat.gov.tw/ipas/certification/AIAP/learning-resources)。

依 [iPAS 115 年度簡章](https://www.ipas.org.tw/api/proxy/uploads/certification/AIAP/115%E5%B9%B4%E5%BA%A6AI%E6%87%89%E7%94%A8%E8%A6%8F%E5%8A%83%E5%B8%AB%E8%83%BD%E5%8A%9B%E9%91%91%E5%AE%9A%E7%B0%A1%E7%AB%A0%28%E5%88%9D%E3%80%81%E4%B8%AD%E7%B4%9A%29_20251225235744.pdf)，正式初級考試分兩科、各 75 分鐘，採電腦單選；結束前可改答案或留白。本站非計時練習可分次作答；模擬模式則提供單科 75 分鐘倒數，均允許跳題、改答案或提早交卷，練習題在交卷後顯示解析。本站模擬題量、考試流程細節和成績仍不等於完整正式考試。

今日已答題數和本輪已練題數會顯示在測驗頁。未交卷的考卷、已選答案與錯題清單存於**目前瀏覽器**的 `localStorage`，重開同一瀏覽器可續答。清除網站資料、更換瀏覽器或裝置，紀錄不會自動同步。

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

網頁在**交卷時**才嘗試把已作答題目送到試算表；未交卷的選擇只留在瀏覽器。傳送使用 `no-cors`，因此無法從網頁確認寫入成功。設定後請交卷一次，再到自己的試算表檢查是否新增紀錄。知道網頁應用程式網址的人可能送出請求，請勿把部署網址放進公開 repo。

## 修改題庫

前 10 題在 `index.html` 的 `questions` 陣列，其餘 50 題在 `questions-extra.js`。新增題目請使用不重複的數字 `id`，填入考科、題目、四個選項、零起算的正確答案索引與解析。請提交自己有權公開的原創題，並附可查核的考點來源；不要直接複製教師講義、付費題庫或別人的備考文章。

本專案採 MIT 授權，詳見 [LICENSE](LICENSE)。這只涵蓋本 repo 中有權授權的原創程式與題目，不會授權第三方資料。
