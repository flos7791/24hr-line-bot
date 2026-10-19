# LINE Bot (Google Apps Script + 本地 Ollama 模型) 部署指南

本專案已將原 Python 專案改寫為 **Google Apps Script (JavaScript)** 專案，讓 LINE Bot 的 Webhook 能 24 小時在 Google 雲端穩定接收訊息，並透過安全的穿透隧道串接您電腦上的本地 LLM（Ollama）。

---

## 專案檔案結構

* [`Code.gs`](./Code.gs)：LINE Webhook 主要入口（`doPost` / `doGet`）與 LINE Messaging API 回覆處理。
* [`Agent.gs`](./Agent.gs)：指令解析（`翻`、`改`、`解`、`考`、`/help`、`/model`）與 Ollama API 呼叫。
* [`Config.gs`](./Config.gs)：透過 Google Apps Script 的「指令碼屬性 (Script Properties)」讀取環境變數。

---

## 🚀 完整部屬步驟

### 第一步：啟動本機 Ollama 與公網穿透

因為 Google Apps Script 位於 Google 雲端，無法直接連到您電腦的 `127.0.0.1:11434`，需要建立一條安全的對外通道。

#### 推薦方式：使用 Cloudflare Tunnel（完全免費、無需註冊、自動 HTTPS）

1. **安裝 cloudflared**：
   在 Windows PowerShell 中執行：
   ```powershell
   winget install Cloudflare.cloudflared
   ```
   *(或至 [Cloudflare 官方 GitHub](https://github.com/cloudflare/cloudflared/releases) 下載 `cloudflared-windows-amd64.exe`)*

2. **啟動 Ollama**（確保已下載所需模型，例如 `ollama pull qwen2.5:14b`）：
   ```powershell
   ollama serve
   ```

3. **啟動穿透通道**：
   在終端機中執行：
   ```powershell
   cloudflared tunnel --url http://localhost:11434
   ```
4. 終端機中會出現類似以下網址：
   ```text
   https://xxxx-xxxx-xxxx.trycloudflare.com
   ```
   **請複製這個 HTTPS 網址**（這就是您的 `OLLAMA_HOST`）。

---

### 第二步：建立 Google Apps Script (GAS) 專案

1. 開啟瀏覽器，前往 [Google Apps Script 首頁](https://script.google.com/)。
2. 點擊左上角 **「新增專案」**，專案名稱可命名為 `LINE-Bot-Local-GAS`。
3. 在左側「檔案」列表中：
   - 將預設的 `程式碼.gs` 重新命名為 **`Code.gs`**，並將本專案 [`Code.gs`](./Code.gs) 內容貼上。
   - 點擊「+」新增指令碼，命名為 **`Agent.gs`**，將 [`Agent.gs`](./Agent.gs) 內容貼上。
   - 點擊「+」新增指令碼，命名為 **`Config.gs`**，將 [`Config.gs`](./Config.gs) 內容貼上。
4. 點擊上方的 **「儲存專案 (Ctrl + S)」**。

---

### 第三步：設定 Script Properties（環境變數）

#### 方式 A：透過編輯器內建函式設定（最快）
1. 在 Apps Script 編輯器開啟 `Config.gs`。
2. 找到最下方的 `initScriptProperties()` 函式，填入您的值：
   ```javascript
   const properties = {
     'LINE_CHANNEL_ACCESS_TOKEN': '你的 LINE Channel Access Token',
     'OLLAMA_HOST': 'https://xxxx.trycloudflare.com', // 第一步取得的 Cloudflare 穿透網址
     'OLLAMA_MODEL': 'qwen2.5:14b',
     'OLLAMA_FALLBACK': 'qwen2.5:7b'
   };
   ```
3. 上方函式選單選擇 **`initScriptProperties`**，點擊 **「執行」**（首次執行需允許授權）。

#### 方式 B：透過 GAS 專案設定手動新增
1. 點擊左側齒輪圖示 **「專案設定」**。
2. 滑動至最下方 **「指令碼屬性」**，點擊 **「編輯指令碼屬性」**。
3. 新增以下 4 個屬性：
   - `LINE_CHANNEL_ACCESS_TOKEN`：您的 LINE Channel Access Token
   - `OLLAMA_HOST`：您的 Cloudflare Tunnel 穿透網址
   - `OLLAMA_MODEL`：`qwen2.5:14b`（或您電腦已 pull 的模型）
   - `OLLAMA_FALLBACK`：`qwen2.5:7b`
4. 點擊「儲存指令碼屬性」。

---

### 第四步：測試連線（選用但強烈建議）

在部署前，您可以直接在 GAS 編輯器中驗證能否成功呼叫您電腦的本地模型：
1. 在編輯器上方函式選擇 **`testOllamaConnection`**。
2. 點擊 **「執行」**。
3. 查看下方「執行紀錄」，若顯示 `[Ollama 呼叫成功]` 且印出 AI 回覆，代表 GAS 與本機 Ollama 連通成功！

---

### 第五步：部署為 Web 應用程式 (Web App)

1. 在 Apps Script 右上角點擊 **「部署」** -> **「新增部署作業」**。
2. 點擊齒輪圖示，選擇類型為 **「網路應用程式」** (Web App)。
3. 設定如下：
   - **說明**：`v1.0.0`
   - **執行身分**：**我 (Me)**
   - **誰可以存取**：**所有人 (Anyone)** *(⚠️ 務必選「所有人」，否則 LINE 伺服器無法存取)*
4. 點擊 **「部署」**。
5. 複製生成的 **Web 應用程式網址 (Web App URL)**，格式如：
   `https://script.google.com/macros/s/AKfycbx.../exec`

---

### 第六步：在 LINE Developers Console 設定 Webhook

1. 前往 [LINE Developers Console](https://developers.line.biz/)，進入您的 Messaging API Channel。
2. 切換至 **Messaging API** 標籤頁：
   - **Webhook URL**：貼上第五步取得的 Apps Script Web App URL。
   - 點擊 **Update**，接著點擊 **Verify**（應顯示 `Success`）。
   - 將 **Use Webhook** 開關切換為 **開啟 (Enabled)**。
3. 前往 [LINE Official Account Manager](https://manager.line.biz/)：
   - 在「回應設定」中，將 **「自動回應訊息」** 設為 **關閉**，避免與 AI 回覆衝突。

---

## 💡 功能與指令測試

加入 LINE Bot 好友後，即可傳送以下文字進行測試：

* `/help`：顯示功能指令清單。
* `/model`：檢視目前連線的 Ollama 主機網址與運行的模型名稱。
* `翻 Good morning, nice to meet you.`：自動翻譯為繁體中文。
* `翻日文 今天天氣真好`：指定翻譯為日文。
* `改 我昨天有去看電影了`：文法修飾與潤飾。
* `解 量子力學`：白話名詞解釋。
* `考 台灣歷史`：出考題小測驗。
* **直接聊天**：一般交談互動。

---

## 📌 24 小時運作注意事項

1. **電腦睡眠設定**：
   * 本專案的 Webhook 服務由 Google 雲端 24 小時在線接收。
   * 但由於 AI 推論是使用您**本機電腦的 Ollama 模型**，若電腦進入睡眠、休眠或關機，本地模型將無法回應。
   * 請在 Windows **「電源與睡眠設定」** 中將「睡眠」設為 **「從不」**。
2. **Tunnel 斷線維護**：
   * 若重新執行 `cloudflared` 產生新的網址，只需至 GAS 的 **指令碼屬性** 更新 `OLLAMA_HOST` 即可，無需重新發布 Web App。
