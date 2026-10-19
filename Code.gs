/**
 * Code.gs - Google Apps Script 主要進入點與 LINE Webhook 處理
 */

/**
 * HTTP GET 端點：用於瀏覽器測試 Web App 是否成功運行
 */
function doGet(e) {
  return ContentService.createTextOutput("LINE Bot Webhook 服務運作中！")
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * HTTP POST 端點：接收來自 LINE Messaging API 的 Webhook 訊息
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      console.warn("收到無內容的請求");
      return ContentService.createTextOutput("No post data")
        .setMimeType(ContentService.MimeType.TEXT);
    }

    const json = JSON.parse(e.postData.contents);
    const events = json.events || [];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (event.type === 'message' && event.message && event.message.type === 'text') {
        handleTextMessage(event);
      }
    }

    return ContentService.createTextOutput("OK")
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    console.error("doPost 發生錯誤: " + err.message);
    return ContentService.createTextOutput("Error: " + err.message)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * 處理收到的文字訊息事件
 * @param {object} event 
 */
function handleTextMessage(event) {
  const replyToken = event.replyToken;
  const userText = event.message.text;

  // 1. 前處理使用者文字與指令
  const { prompt, directReply } = prepareMessage(userText);

  // 2. 決定回覆內容
  let replyText = "";
  if (directReply !== null) {
    replyText = directReply;
  } else {
    replyText = getAiResponse(prompt);
  }

  // 3. 呼叫 LINE Reply API 送出訊息
  replyLineMessage(replyToken, replyText);
}

/**
 * 透過 LINE Messaging API 回覆訊息
 * @param {string} replyToken 
 * @param {string} text 
 */
function replyLineMessage(replyToken, text) {
  const token = CONFIG.getLineAccessToken();
  if (!token) {
    console.error("尚未設定 LINE_CHANNEL_ACCESS_TOKEN，無法發送回覆。");
    return;
  }

  const url = "https://api.line.me/v2/bot/message/reply";
  // LINE 單則文字訊息上限為 5000 字
  const safeText = (text || "").substring(0, 5000);

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
    const responseCode = response.getResponseCode();
    if (responseCode !== 200) {
      console.error(`LINE 回覆失敗 (${responseCode}): ${response.getContentText()}`);
    } else {
      console.log("LINE 訊息回覆成功！");
    }
  } catch (err) {
    console.error(`呼叫 LINE Reply API 發生例外: ${err.message}`);
  }
}

/**
 * 本地端測試函式（可在 Apps Script 編輯器內直接選取並執行）
 * 方便測試是否能順利連通本機 Ollama，無需真正在 LINE 發話。
 */
function testOllamaConnection() {
  console.log("正在測試與本地 Ollama 的連線...");
  const testPrompt = "請簡短說一句你好。";
  const reply = getAiResponse(testPrompt);
  console.log("AI 回覆結果：\n" + reply);
}
