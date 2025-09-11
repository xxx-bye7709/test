// functions/lib/openchat-cta-generator.js を修正

const functions = require('firebase-functions');

class OpenChatCTAGenerator {
  constructor() {
    // Firebase ConfigとローカルEnvの両方に対応
    const config = functions.config();
    this.config = {
      chatName: (config.openchat && config.openchat.name) || 
                process.env.OPENCHAT_NAME || 
                'Relax Contents Club',
      inviteUrl: (config.openchat && config.openchat.invite_url) || 
                 process.env.OPENCHAT_INVITE_URL || 
                 'https://line.me/ti/g2/XwZWf26FbBhFsx9za5PmFGloKFnzY8sSA5d0Dg?utm_source=invitation&utm_medium=link_copy&utm_campaign=default',
      qrCodeUrl: (config.openchat && config.openchat.qr_url) || 
                 process.env.OPENCHAT_QR_URL || 
                 'https://qr-official.line.me/gs/M_681wsvob_GW.png'
    };
  }

  /**
   * シンプルな記事末尾CTA
   */
  // generateEndArticleCTA() を以下に置き換え
generateEndArticleCTA() {
  return `
<!-- CTAエリア開始前の完全分離 -->
<div style="clear: both; display: block; width: 100%; height: 1px; margin: 60px 0;"></div>

<!-- オープンチャット誘導専用エリア -->
<div class="line-openchat-cta-only" style="
  clear: both;
  display: block;
  width: 100%;
  margin: 0;
  padding: 0;
  position: relative;
  isolation: isolate;">
  
  <div style="
    background: linear-gradient(135deg, #00B900 0%, #00D400 100%);
    border-radius: 20px;
    padding: 30px;
    margin: 0 auto;
    max-width: 600px;
    text-align: center;
    box-shadow: 0 10px 30px rgba(0, 185, 0, 0.2);">
    
    <h3 style="color: white; font-size: 24px; margin: 0 0 15px 0;">
      🎁 限定情報を受け取る
    </h3>
    
    <p style="color: white; font-size: 16px; margin: 0 0 25px 0;">
      LINEオープンチャット「${this.config.chatName}」<br>
      お得な商品情報を配信中！
    </p>
    
    <!-- LINE専用ボタン（商品ボタンではない） -->
    <a href="${this.config.inviteUrl}" 
       target="_blank"
       rel="noopener noreferrer"
       data-cta-type="line-openchat"
       style="
         display: inline-block;
         background: white;
         color: #00B900 !important;
         padding: 15px 40px;
         border-radius: 30px;
         text-decoration: none !important;
         font-weight: bold;
         font-size: 18px;">
      今すぐ参加する →
    </a>
    
    <p style="color: white; font-size: 14px; margin: 20px 0 10px 0;">
      またはQRコードで参加
    </p>
    
    <button onclick="showQRCode()" 
            data-cta-type="qr-button"
            style="
              background: rgba(255,255,255,0.2);
              color: white;
              border: 1px solid white;
              padding: 10px 25px;
              border-radius: 20px;
              font-size: 14px;
              cursor: pointer;">
      QRコードを表示
    </button>
  </div>
</div>

<script>
function showQRCode() {
  // QRコード表示処理
}
</script>`;
}

integrateWithProductArticle(articleContent, options = {}) {
  let enhancedContent = articleContent;
  
  // 商品ボタンを含む全ての商品要素を検出して終了をマーク
  if (enhancedContent.includes('詳細を見る') || 
      enhancedContent.includes('購入する')) {
    
    // 最後の商品関連要素を見つける
    const lastProductPattern = /(詳細を見る[^<]*<\/a>[^<]*<\/div>)/gi;
    let lastMatch;
    let lastIndex = -1;
    
    while ((lastMatch = lastProductPattern.exec(enhancedContent)) !== null) {
      lastIndex = lastProductPattern.lastIndex;
    }
    
    if (lastIndex > -1) {
      // 商品エリアの後に明確な区切りを挿入
      enhancedContent = enhancedContent.slice(0, lastIndex) + 
        '\n<!-- 商品エリア終了 -->\n' +
        '<div style="height: 60px; clear: both;"></div>\n' +
        enhancedContent.slice(lastIndex);
    }
  }
  
  // CTAを追加
  enhancedContent += this.generateEndArticleCTA();
  
  return enhancedContent;
}
}  

// 関数を追加（クラスの外）
function addOpenChatCTAToArticle(content, options = {}) {
  const generator = new OpenChatCTAGenerator();
  return generator.integrateWithProductArticle(content, options);
}

// エクスポートを修正
module.exports = { 
  OpenChatCTAGenerator,
  addOpenChatCTAToArticle  // この関数を追加
};

