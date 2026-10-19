// ====================================================================
// 【專用設定檔】請直接在下方單引號內填入您的資料即可，不需看其他程式碼
// ====================================================================

function 一鍵完成設定() {
  PropertiesService.getScriptProperties().setProperties({

    // 1. 請將單引號內的文字換成您的 LINE Token
    'LINE_CHANNEL_ACCESS_TOKEN': '在這裡貼上您的_LINE_CHANNEL_ACCESS_TOKEN',

    // 2. 請將單引號內的文字換成您的 Cloudflare 穿透網址 (https://xxxx.trycloudflare.com)
    'OLLAMA_HOST': '在這裡貼上您的_Cloudflare穿透網址',

    // 3. 模型名稱已為您預先設定為您電腦上的 gemma4:e4b，此行不用動
    'OLLAMA_MODEL': 'gemma4:e4b',

    'OLLAMA_FALLBACK': ''
  });

  console.log('🎉 恭喜！設定已成功寫入，可以開始使用了！');
}
