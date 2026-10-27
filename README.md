# iPAS AI 應用規劃師（初級）互動測驗與雲端雙表錯題追蹤系統

[GitHub stars](https://www.google.com/search?q=https://github.com/Merle1022/ipas-ai-quiz) [Netlify Status](https://www.google.com/search?q=https://ipas-ai-quiz.netlify.app)

> 專為 iPAS AI 應用規劃師考生打造的零成本、具備持久記憶與錯題特訓題庫的開源備考系統。

- 🌐 **正式線上體驗網址（Live Demo）**：[https://ipas-ai-quiz.netlify.app](https://www.google.com/search?q=https://ipas-ai-quiz.netlify.app)
- 📊 **配套 Google 試算表模板**：[點此檢視雙表分流模板](https://docs.google.com/spreadsheets/d/1_cUw_oc12kF22A220R6vpcT6XsUtbjJBVU3DwmYOZDs/edit)
- 👤 **專案作者**：Merle ([@Merle1022](https://github.com/Merle1022))

## 📌 緣起：為了解決備考前輩 Emily 提出的核心痛點

本專案的發想，源自考過 iPAS 證照的前輩 [Emily 在其備考分享文](https://emily50431.github.io/-emily-lu-website-g/blog/ipas-ai-planner-beginner/) 中特別點出的兩大血淚痛點：

> 1. **「Gemini 批改答案容易出錯」**：
>    *「我發現 Gemini 很常會在對答案的時候，不見得每次都可以正確（對於我這種新手，在練習時答案還給錯真的是要害死我…）」* —— AI 直接在對話框對答案時，常常會產生幻覺或將選項（A/B/C/D）錯位。
> 2. **「互動式測驗無法記憶錯題」**：
>    *「Gemini 會自作聰明提供【互動式測驗】的方式去做問答，雖然使用【互動式測驗】的介面會比較簡單，但它無法記憶你錯了哪些題目，如果事後想找出自己錯的題目是沒有辦法的！」* —— 為了抓出錯題，考生最後只能無奈退回用文字打「1A 2B 3C...」這種最原始費力的方式刷題。

## 💡 我們的三合一解決架構

為了解決這兩大痛點，本專案打造了「**前端純邏輯判題 ➔ 雲端自動雙表分流 ➔ 錯題獨立題庫特訓 ➔ Gemini AI 弱點重訓**」的閉環系統：

```
[考生直覺作答 (A/B/C/D)]
         │
 [前端 JavaScript 硬邏輯嚴格判題] ── 100% 杜絕大模型選項錯位與判斷幻覺
         │
 ┌───────┴────────────────────────────────────────┐
 ▼                                                ▼
【本地獨立暫存 LocalStorage】              【雲端 Google 試算表 Webhook】
 ├─ 模式1：全真順序測驗 (全題庫演練)         ├─ 工作表1：【測驗記錄】(全歷程存檔)
 ├─ 模式2：🎯 錯題專項獨立題庫特訓           └─ 工作表2：【錯題本】(答錯自動分流)
 │  (即時統計單題勝率、練習計數、狀態翻轉)                   │
 └─ 模式3：📊 弱點分析儀表板                                 ▼
    (待複習數、累積練習數、平均答對率)        【週末召喚 Gemini AI 進行深度複習】
                                              (分析考點盲區、針對錯題出變形題抽考)
```

## ✨ 核心產品功能

1. **三大測驗與分析模式**：
   - **📝 全真順序測驗**：全真模擬作答，點擊選項立即獲得官方解析，答錯自動加入錯題庫。
   - **🎯 錯題專項特訓**：**將錯題本自動獨立轉換為專屬題庫**！只針對歷史答錯題目連續出題，頂部即時顯示「此題特訓勝率（%）」與「已練 X 次 / 對 X / 錯 X」，答對即自動翻轉為「🟢 已掌握」。
   - **📊 錯題弱點儀表板**：直觀視覺化看板，統計「待複習錯題數」、「累積特訓次數」、「特訓答對次數」與「特訓平均答對率」。
2. **多租戶本地隱私隔離（Privacy by Design）**：
   - 每個人的後台試算表 Webhook 網址與錯題數據僅存於各人瀏覽器的 `localStorage` 中。
   - 分享給任何人，對方看到的是乾淨的空白介面，絕不會洩漏您的試算表網址，也不會將對方的作答寫入您的後台。
3. **雲端自動雙表分流（Google Sheets Webhook）**：
   - 每次作答時，後台全自動將數據歸檔至「測驗記錄」；若為錯題，則同步獨立寫入「錯題本」並標註「待複習」。

## 🛠️ 自行部署與建置指南（零成本 3 步驟）

### 步驟 1：建立 Google 試算表與 Webhook 接收端

1. 開啟 Google 雲端硬碟建立一份試算表，建立兩個分頁：
   - **`測驗記錄`**：`測驗日期`、`考科`、`題號`、`題目摘要`、`我的選擇`、`正確答案`、`判定結果`、`考點類別`。
   - **`錯題本`**：`題號`、`考科`、`考點類別`、`題目內容`、`正確答案`、`易錯觀念與解析`、`複習狀態`。
2. 點選「擴充功能」➔「Apps Script」，貼上以下程式碼：

```
function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var logSheet = ss.getSheetByName("測驗記錄") || ss.getSheets()[0];
    var wrongSheet = ss.getSheetByName("錯題本");
    
    var data = JSON.parse(e.postData.contents);
    var timestamp = new Date();
    
    // 1. 寫入【測驗記錄】工作表 (全歷程)
    logSheet.appendRow([
      timestamp,
      data.subject || "考科一",
      data.qId,
      data.question,
      data.myChoice,
      data.correctAnswer,
      data.isCorrect ? "正確" : "錯誤",
      data.category
    ]);
    
    // 2. 若答錯，自動分流寫入【錯題本】工作表
    if (!data.isCorrect && wrongSheet) {
      wrongSheet.appendRow([
        data.qId,
        data.subject || "考科一",
        data.category,
        data.question,
        data.correctAnswer,
        data.explanation,
        data.reviewStatus || "待複習"
      ]);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

1. 點選「部署」➔「新增部署」➔「網頁應用程式」，將「誰可以存取」設為 **「任何人（Anyone）」**，複製取得的 Webhook 網址。

### 步驟 2：部署前端網頁

- **GitHub Pages**：將本專案 Fork 後，進入 Settings ➔ Pages，將 Branch 設為 `main` 即可一鍵上線。
- **Netlify**：直接連結您的 GitHub 倉庫，即可享有全自動 CI/CD 持續部署。

## 🤝 開源社群協作（如何幫忙補充新考題？）

歡迎所有備考戰友共同擴充題庫（例如新增考科二題庫或最新官方樣題）：

1. **Fork 本專案**：點擊右上角的 **「🍴 Fork」** 複製至個人帳號。
2. **新增題目**：打開 `index.html`，在 `const questions = [ ... ]` 陣列內新增題目物件：

   ```
   {
     id: 11,
     category: "L121 No code / Low code 概念",
     question: "題目敘述...",
     options: ["選項 A", "選項 B", "選項 C", "選項 D"],
     answer: 0, // 正確答案索引 (0=A, 1=B, 2=C, 3=D)
     explanation: "官方考點詳解說明..."
   }
   ```
3. **發送 Pull Request**：Commit 後點選「Contribute」➔「Open pull request」送出，審核通過後將自動同步至正式線上系統！

## 📄 授權條款 (License)

本專案採用 [MIT License](https://www.google.com/search?q=LICENSE) 開源授權，歡迎自由修改、分享或作為個人備考使用。

Made with ❤️ by [Merle](https://github.com/Merle1022)
