// functions/lib/openchat-cta-generator.js
// 商品エリアとCTAエリアを完全分離する最終版

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
   * 記事末尾のシンプルなCTA
   */
  generateEndArticleCTA() {
    return `
<!-- ========== LINEオープンチャット専用エリア開始 ========== -->
<div id="line-openchat-cta" style="
  clear: both;
  display: block;
  width: 100%;
  margin: 60px 0 0 0;
  padding: 0;
  position: relative;
  z-index: 1000;">
  
  <!-- CTAコンテナ -->
  <div style="
    background: linear-gradient(135deg, #00B900 0%, #00D400 100%);
    border-radius: 20px;
    padding: 30px;
    margin: 0 auto;
    max-width: 600px;
    text-align: center;
    box-shadow: 0 10px 30px rgba(0, 185, 0, 0.2);
    position: relative;
    overflow: hidden;">
    
    <h3 style="
      color: white;
      font-size: 24px;
      margin: 0 0 15px 0;">
      🎁 限定情報を受け取る
    </h3>
    
    <p style="
      color: white;
      font-size: 16px;
      margin: 0 0 25px 0;">
      LINEオープンチャット「${this.config.chatName}」<br>
      お得な商品情報を配信中！
    </p>
    
    <!-- LINE参加ボタン -->
    <a style="
      display: inline-block;
      background: white;
      color: #00b900 !important;
      padding: 15px 40px;
      border-radius: 30px;
      text-decoration: none !important;
      font-weight: bold;
      font-size: 18px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
      transition: transform 0.3s;"
      href="${this.config.inviteUrl}"
      target="_blank"
      rel="noopener noreferrer"
      onmouseover="this.style.transform='translateY(-2px)'"
      onmouseout="this.style.transform='translateY(0)'">
      今すぐ参加する →
    </a>
    
    <p style="
      color: white;
      font-size: 14px;
      margin: 20px 0 10px 0;">
      またはQRコードで参加
    </p>
    
    <!-- QRコード表示ボタン -->
    <button style="
      background: rgba(255,255,255,0.2);
      color: white;
      border: 1px solid white;
      padding: 10px 25px;
      border-radius: 20px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.3s;"
      onclick="showQRCode()"
      onmouseover="this.style.background='rgba(255,255,255,0.3)'"
      onmouseout="this.style.background='rgba(255,255,255,0.2)'">
      QRコードを表示
    </button>
  </div>
</div>
<!-- ========== LINEオープンチャット専用エリア終了 ========== -->

<script>
function showQRCode() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:99999;';
  modal.innerHTML = \`
    <div style="background:white;padding:30px;border-radius:20px;text-align:center;">
      <img src="${this.config.qrCodeUrl}" style="width:200px;height:200px;">
      <p>LINEアプリで読み取り</p>
      <button onclick="this.parentElement.parentElement.remove()" style="margin-top:20px;padding:10px 30px;background:#00B900;color:white;border:none;border-radius:5px;cursor:pointer;">閉じる</button>
    </div>
  \`;
  modal.onclick = function(e) { if(e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}
</script>`;
  }

  /**
   * 記事にCTAを追加
   */
  addCTAToArticle(content) {
    try {
      // 商品エリアの終了マーカーを探す
      const endMarkers = [
        '<!-- ========== 商品エリア完全終了 ========== -->',
        '<!-- ############## 商品エリア完全終了 ############## -->',
        '<!-- 商品ギャラリー終了 -->'
      ];
      
      let hasProductArea = false;
      for (const marker of endMarkers) {
        if (content.includes(marker)) {
          hasProductArea = true;
          console.log('商品エリア終了マーカーを検出:', marker);
          break;
        }
      }
      
      // 商品エリアがある場合は、すでに適切な位置にCTAが追加されるはず
      if (hasProductArea) {
        // CTAがまだ追加されていない場合のみ追加
        if (!content.includes('line-openchat-cta')) {
          return content + this.generateEndArticleCTA();
        }
        return content;
      }
      
      // 商品エリアがない通常の記事の場合
      return content + this.generateEndArticleCTA();
      
    } catch (error) {
      console.error('Error adding CTA to article:', error);
      return content + this.generateEndArticleCTA();
    }
  }
}

// エクスポート用の関数
function addOpenChatCTAToArticle(content) {
  const generator = new OpenChatCTAGenerator();
  return generator.addCTAToArticle(content);
}

module.exports = { 
  OpenChatCTAGenerator,
  addOpenChatCTAToArticle 
};
