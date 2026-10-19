/**
 * ====================================================================
 * LINE Bot + 本地 Ollama (單一整合版 All-in-One)
 * 只要這一個檔案，不需要建立多個檔案，避免漏貼或檔名錯誤！
 * ====================================================================
 */

// ---------------------- 1. 基本設定 ----------------------
const DEFAULT_MODEL = "gemma4:e4b";

function getLineAccessToken() {
  return PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN') || '';
}

function getOllamaHost() {
  let host = PropertiesService.getScriptProperties().getProperty('OLLAMA_HOST') || '';
  return host.replace(/\/+$/, '');
}

function getOllamaModel() {
  return PropertiesService.getScriptProperties().getProperty('OLLAMA_MODEL') || DEFAULT_MODEL;
}

// ---------------------- 2. Webhook 入口 ----------------------
function doGet(e) {
  return ContentService.createTextOutput("✅ LINE Bot Webhook 正常運作中！")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput("No post data").setMimeType(ContentService.MimeType.TEXT);
    }

    const json = JSON.parse(e.postData.contents);
    const events = json.events || [];

    // LINE 後台按 Verify 時，events 會是空的，直接回傳 OK 即可通過驗證
    if (events.length === 0) {
      return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
    }

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (event.type === 'message' && event.message && event.message.type === 'text') {
        handleTextMessage(event);
      }
    }

    return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    console.error("doPost 錯誤: " + err.message);
    return ContentService.createTextOutput("Error: " + err.message).setMimeType(ContentService.MimeType.TEXT);
  }
}

// ---------------------- 3. 處理文字訊息 ----------------------
function handleTextMessage(event) {
  const replyToken = event.replyToken;
  const userText = event.message.text || "";

  console.log("收到使用者訊息: " + userText);

  // 判斷指令
  const { prompt, directReply } = prepareMessage(userText);

  let replyText = "";
  if (directReply !== null) {
    replyText = directReply;
  } else {
    replyText = getAiResponse(prompt);
  }

  replyLineMessage(replyToken, replyText);
}

// ---------------------- 4. 呼叫 LINE 回覆 API ----------------------
function replyLineMessage(replyToken, text) {
  const token = getLineAccessToken();
  if (!token) {
    console.error("❌ 尚未設定 LINE_CHANNEL_ACCESS_TOKEN，無法發送回覆。");
    return;
  }

  const url = "https://api.line.me/v2/bot/message/reply";
  const safeText = (text || "抱歉，目前無法產生回覆。").substring(0, 5000);

  const payload = {
    replyToken: replyToken,
    messages: [
      {
        type: "text",
        text: safeText
      }
    ]
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + token
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    if (code === 200) {
      console.log("✅ LINE 訊息發送成功！");
    } else {
      console.error(`❌ LINE 回覆失敗 (狀態碼 ${code}): ` + response.getContentText());
    }
  } catch (err) {
    console.error("❌ 呼叫 LINE API 失敗: " + err.message);
  }
}

// ---------------------- 5. 指令分析與提示詞 ----------------------
const COMMAND_HELP = (
  "💡 快速指令\n" +
  "翻 <文字>：翻譯成繁體中文；也可用「翻英文 <文字>」指定目標語言\n" +
  "改 <文字>：修正文法並讓表達更自然\n" +
  "解 <主題>：用白話說明並舉一個例子\n" +
  "考 <主題>：出一題小測驗，先不要公布答案\n" +
  "/help：顯示這份指令清單\n\n" +
  "直接傳送其他訊息，仍可和我一般聊天。"
);

function prepareMessage(userText) {
  const text = (userText || '').trim();
  let normalized = text
    .replace(/／/g, '/')
    .replace(/？/g, '?')
    .replace(/！/g, '!')
    .toLowerCase();

  const helpPhrases = ["/help", "help", "指令", "幫助", "功能", "有哪些指令"];
  if (helpPhrases.includes(normalized) || normalized.startsWith("/help")) {
    return { prompt: "", directReply: COMMAND_HELP };
  }

  const modelPhrases = ["/model", "model", "模型", "目前模型"];
  if (modelPhrases.includes(normalized)) {
    const host = getOllamaHost() || '未設定';
    const mainModel = getOllamaModel();
    const info = `🤖 【目前 AI 模型資訊】\n• 模式：本地 LLM (Ollama)\n• 模型：${mainModel}\n• 主機：${host}`;
    return { prompt: "", directReply: info };
  }

  const parts = text.split(/\s+/, 2);
  let command = parts[0] ? parts[0].toLowerCase() : '';
  let argument = parts.length > 1 ? text.substring(parts[0].length).trim() : '';

  const commandMap = {
    "翻": "translate", "翻譯": "translate",
    "改": "polish", "潤飾": "polish",
    "解": "explain", "解釋": "explain",
    "考": "quiz", "出題": "quiz"
  };

  const targetLanguages = { "翻英文": "英文", "翻日文": "日文", "翻韓文": "韓文" };
  let action = commandMap[command];

  if (targetLanguages[command]) {
    action = "translate";
    argument = `${targetLanguages[command]} ${argument}`.trim();
  }

  if (!action) {
    return { prompt: userText, directReply: null };
  }

  if (!argument) {
    return { prompt: "", directReply: "請在指令後面加上文字，例如：「翻 Good morning」或「解 黑洞」" };
  }

  const instructions = {
    "translate": "請翻譯以下文字。若文字以「英文」「日文」「韓文」等語言名稱開頭，翻譯成該語言；否則翻譯成自然的繁體中文。只給翻譯結果。\n\n",
    "polish": "請修正文法、錯字並讓以下文字更自然清楚，保留原意與語氣。只輸出修改後文字。\n\n",
    "explain": "請用繁體中文白話解釋以下主題，控制在容易閱讀的長度，並附上一個具體例子。\n\n",
    "quiz": "請針對以下主題出一道簡短小測驗。先只給題目，不要公布答案，等使用者回答後再判斷並解釋。\n\n"
  };

  return { prompt: instructions[action] + argument, directReply: null };
}

// ---------------------- 6. 呼叫本地 Ollama ----------------------
function getAiResponse(prompt) {
  const host = getOllamaHost();
  if (!host) {
    return "⚠️ 尚未設定 OLLAMA_HOST 穿透網址，請在 Apps Script 指令碼屬性中設定。";
  }

  const model = getOllamaModel();
  const todayStr = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy年MM月dd日");
  const systemPrompt = `你是一個友善聰明的繁體中文 AI 助理。今天的日期是 ${todayStr}。請使用繁體中文簡明扼要地回答問題。`;

  const url = `${host}/api/chat`;
  const payload = {
    model: model,
    stream: false,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ],
    options: {
      temperature: 0.2
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    console.log(`正在連線本地 Ollama (${url})...`);
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    if (code !== 200) {
      console.error(`Ollama 回應失敗 (${code}): ` + response.getContentText());
      return "⚠️ 本地 AI 模型目前無回應，請確認電腦 Ollama 與 Cloudflare 穿透是否正常。";
    }

    const data = JSON.parse(response.getContentText());
    if (data && data.message && data.message.content) {
      return data.message.content.trim();
    }
    return "⚠️ AI 回傳內容為空。";
  } catch (err) {
    console.error("連線 Ollama 失敗: " + err.message);
    return "⚠️ 無法連線至本地電腦的 Ollama 模型，請確認 Cloudflare Tunnel 視窗是否開啟。";
  }
}

// ---------------------- 7. 測試與設定輔助函式 ----------------------
/**
 * 可以在編輯器直接執行此函式，測試與 Ollama 的連線
 */
function testOllama() {
  console.log("開始測試 Ollama 連線...");
  const reply = getAiResponse("你好");
  console.log("回覆結果: " + reply);
}

/**
 * 可以在編輯器直接執行此函式，一鍵寫入屬性（若您不想在設定頁面手動填寫）
 */
function quickSetup() {
  PropertiesService.getScriptProperties().setProperties({
    'LINE_CHANNEL_ACCESS_TOKEN': '貼上您的_LINE_CHANNEL_ACCESS_TOKEN',
    'OLLAMA_HOST': '貼上您的_Cloudflare網址',
    'OLLAMA_MODEL': 'gemma4:e4b'
  });
  console.log("✅ 屬性已設定完成！");
}
