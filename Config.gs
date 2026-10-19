/**
 * Config.gs - 專案環境變數與設定管理
 * 
 * 所有金鑰與連線網址均存放在 Apps Script 的「指令碼屬性 (Script Properties)」中，
 * 避免將敏感 Token 寫死於原始碼中。
 */

const CONFIG = {
  /**
   * 取得 LINE Messaging API Channel Access Token
   */
  getLineAccessToken: function() {
    return PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN') || '';
  },

  /**
   * 取得本地 Ollama 透過穿透工具（如 Cloudflare Tunnel / ngrok）公開的 HTTPS 網址
   * 例如：https://xxxx.trycloudflare.com
   */
  getOllamaHost: function() {
    let host = PropertiesService.getScriptProperties().getProperty('OLLAMA_HOST') || '';
    return host.replace(/\/+$/, ''); // 去除結尾斜線
  },

  /**
   * 取得主模型名稱（預設：gemma4:e4b）
   */
  getOllamaModel: function() {
    return PropertiesService.getScriptProperties().getProperty('OLLAMA_MODEL') || 'gemma4:e4b';
  },

  /**
   * 取得備援模型清單（陣列，逗號分隔）
   */
  getFallbackModels: function() {
    const fallbackStr = PropertiesService.getScriptProperties().getProperty('OLLAMA_FALLBACK') || '';
    return fallbackStr
      .split(',')
      .map(m => m.trim())
      .filter(m => m.length > 0);
  }
};

/**
 * 快速初始化設定工具（可在 Apps Script 編輯器內直接執行一次）
 * 修改下方的值後，選取此函式點擊「執行」，即可自動寫入 Script Properties。
 */
function initScriptProperties() {
  const properties = {
    'LINE_CHANNEL_ACCESS_TOKEN': '請在此填入您的_LINE_CHANNEL_ACCESS_TOKEN',
    'OLLAMA_HOST': 'https://請在此填入您的Cloudflare_Tunnel公開網址',
    'OLLAMA_MODEL': 'gemma4:e4b',
    'OLLAMA_FALLBACK': ''
  };
  
  PropertiesService.getScriptProperties().setProperties(properties);
  console.log('✅ 指令碼屬性已成功設定！', PropertiesService.getScriptProperties().getProperties());
}
