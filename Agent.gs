/**
 * Agent.gs - AI 訊息前處理、指令分析與 Ollama 模型呼叫
 */

const COMMAND_HELP = (
  "💡 快速指令\n" +
  "翻 <文字>：翻譯成繁體中文；也可用「翻英文 <文字>」指定目標語言\n" +
  "改 <文字>：修正文法並讓表達更自然\n" +
  "解 <主題>：用白話說明並舉一個例子\n" +
  "考 <主題>：出一題小測驗，先不要公布答案\n" +
  "/help：顯示這份指令清單\n\n" +
  "直接傳送其他訊息，仍可和我一般聊天。"
);

/**
 * 建立 System Prompt
 */
function buildSystemPrompt() {
  const todayStr = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy年MM月dd日");
  return (
    `你是一個友善、聰明且樂於助人的 LINE 繁體中文 AI 智慧助理。今天的日期是 ${todayStr}。\n\n` +
    `【核心守則】：\n` +
    `若使用者詢問你有哪些指令或功能，請明確列出：翻 <文字>（翻譯）、改 <文字>（潤飾）、` +
    `解 <主題>（白話解釋）、考 <主題>（小測驗）及 /help（顯示指令清單）；不可回答「沒有指令」。\n` +
    `1. 你無法連網，也查不到最新資料。凡是即時資訊（今天的股價、天氣、最新新聞、活動` +
    `報名期限、某人是否已離任等），一律明講「我無法連網查證，請以官方網站為準」，絕不可編造。\n` +
    `2. 嚴格防範幻覺：面對特定個人、生僻專有名詞或歷史細節，絕不可自行拼湊、嫁接同名人物` +
    `或虛構其職稱、系所、經歷與聯絡方式！寧可說不知道。\n` +
    `3. 誠實求真：沒把握就明講不確定，絕不用合理推測包裝成事實。凡數字、日期、人名、` +
    `頭銜、價格、統計、法規等可驗證事實，都要有把握才寫。\n` +
    `4. 答案結構：先直接回答問題本身，再補充必要細節。避免冗長，繁體中文為主。`
  );
}

/**
 * 解析使用者文字，判斷是否為預設指令或需要轉換的 Prompt
 * @param {string} userText 
 * @returns {{ prompt: string, directReply: string|null }}
 */
function prepareMessage(userText) {
  const text = (userText || '').trim();
  
  // 標準化文字（去除全形符號、標點及空白轉小寫）
  let normalized = text
    .replace(/／/g, '/')
    .replace(/？/g, '?')
    .replace(/！/g, '!')
    .replace(/^["'`“”‘’!?！？。，.,:：;；\s]+|["'`“”‘’!?！？。，.,:：;；\s]+$/g, '')
    .toLowerCase();

  const helpPhrases = [
    "/help", "help", "指令", "幫助", "功能", "可用指令", "有哪些指令",
    "我可以用哪些指令", "你有哪些功能", "你能做什麼", "功能列表",
    "commands", "command list", "what can you do", "what commands can i use"
  ];

  if (helpPhrases.includes(normalized) || normalized.startsWith("/help")) {
    return { prompt: "", directReply: COMMAND_HELP };
  }

  // 快捷指令：查詢模型資訊
  const modelPhrases = ["/model", "model", "模型", "目前模型", "目前使用的模型", "你是什麼模型"];
  if (modelPhrases.includes(normalized)) {
    const host = CONFIG.getOllamaHost() || '未設定';
    const mainModel = CONFIG.getOllamaModel();
    const fallbacks = CONFIG.getFallbackModels().join(', ') || '無';
    const modelInfo = (
      `🤖 【目前 AI 模型資訊】\n` +
      `• 執行方式：本地 LLM（Ollama 轉接）\n` +
      `• 主模型：${mainModel}\n` +
      `• 備援模型：${fallbacks}\n` +
      `• 穿透主機：${host}`
    );
    return { prompt: "", directReply: modelInfo };
  }

  // 解析開頭指令（翻 / 改 / 解 / 考 等）
  const parts = text.split(/\s+/, 2);
  let command = parts[0] ? parts[0].toLowerCase() : '';
  let argument = parts.length > 1 ? text.substring(parts[0].length).trim() : '';

  const commandMap = {
    "翻": "translate", "翻譯": "translate",
    "改": "polish", "潤飾": "polish", "修改": "polish",
    "解": "explain", "解釋": "explain",
    "考": "quiz", "出題": "quiz", "小測驗": "quiz"
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

  // 若下指令卻未提供內容，回覆用法說明
  if (!argument) {
    const usages = {
      "translate": "用法：翻 <文字>（例如：翻 Good morning）",
      "polish": "用法：改 <文字>（例如：改 我昨天有去看電影了）",
      "explain": "用法：解 <主題>（例如：解 什麼是黑洞）",
      "quiz": "用法：考 <主題>（例如：考 台灣地理）"
    };
    return { prompt: "", directReply: usages[action] };
  }

  const instructions = {
    "translate": "請翻譯以下文字。若文字以「英文」「日文」「韓文」等語言名稱開頭，翻譯成該語言；否則翻譯成自然的繁體中文。只給翻譯結果。\n\n",
    "polish": "請修正文法、錯字並讓以下文字更自然清楚，保留原意與語氣。只輸出修改後文字。\n\n",
    "explain": "請用繁體中文白話解釋以下主題，控制在容易閱讀的長度，並附上一個具體例子。\n\n",
    "quiz": "請針對以下主題出一道簡短小測驗。先只給題目，不要公布答案，等使用者回答後再判斷並解釋。\n\n"
  };

  return { prompt: instructions[action] + argument, directReply: null };
}

/**
 * 取得 AI 回應（支援主模型與備援模型切換）
 * @param {string} prompt 
 * @returns {string}
 */
function getAiResponse(prompt) {
  const host = CONFIG.getOllamaHost();
  if (!host) {
    return "⚠️ 尚未在 Script Properties 設定 OLLAMA_HOST 穿透網址，請先完成設定。";
  }

  const mainModel = CONFIG.getOllamaModel();
  const fallbackModels = CONFIG.getFallbackModels();
  
  // 建立去重複的模型嘗試清單
  const modelsToTry = Array.from(new Set([mainModel, ...fallbackModels]));
  const systemPrompt = buildSystemPrompt();

  for (let i = 0; i < modelsToTry.length; i++) {
    const modelName = modelsToTry[i];
    const answer = callOllama(host, modelName, systemPrompt, prompt);
    if (answer) {
      console.log(`[Ollama 呼叫成功] 模型: ${modelName}`);
      return answer;
    }
    console.warn(`Ollama 模型 ${modelName} 無法回應，嘗試下一個備援模型。`);
  }

  return "⚠️ AI 服務目前暫時無法回覆，請確認本地 Ollama 服務與穿透連線是否正常開啟。";
}

/**
 * 呼叫本地 Ollama /api/chat
 * @param {string} host 
 * @param {string} modelName 
 * @param {string} systemPrompt 
 * @param {string} userPrompt 
 * @returns {string|null}
 */
function callOllama(host, modelName, systemPrompt, userPrompt) {
  const url = `${host}/api/chat`;
  const payload = {
    model: modelName,
    stream: false,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
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
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    if (statusCode !== 200) {
      console.error(`Ollama 回應狀態碼錯誤 (${statusCode}): ${response.getContentText()}`);
      return null;
    }

    const data = JSON.parse(response.getContentText());
    if (data && data.message && data.message.content) {
      const text = data.message.content.trim();
      return text.length > 0 ? text : null;
    }
    return null;
  } catch (err) {
    console.error(`呼叫 Ollama 失敗 (${modelName}): ${err.message}`);
    return null;
  }
}
