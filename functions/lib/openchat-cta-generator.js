// functions/lib/openchat-cta-generator.js を修正

class OpenChatCTAGenerator {
  constructor() {
    // シンプルな設定
    this.config = {
      chatName: process.env.OPENCHAT_NAME || 'Relax Contents Club',
      inviteUrl: process.env.OPENCHAT_INVITE_URL || 'https://line.me/ti/g2/XwZWf26FbBhFsx9za5PmFGloKFnzY8sSA5d0Dg?utm_source=invitation&utm_medium=link_copy&utm_campaign=default',
      qrCodeUrl: process.env.OPENCHAT_QR_URL || 'https://qr-official.line.me/gs/M_681wsvob_GW.png' // QRコード画像URL
    };
  }

  /**
   * シンプルな記事末尾CTA
   */
  generateEndArticleCTA() {
    return `
<!-- オープンチャット誘導 -->
<div style="
  background: linear-gradient(135deg, #00B900 0%, #00D400 100%);
  border-radius: 20px;
  padding: 30px;
  margin: 50px auto;
  max-width: 600px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 185, 0, 0.2);">
  
  <h3 style="
    color: white;
    font-size: 24px;
    margin-bottom: 15px;">
    🎁 限定情報を受け取る
  </h3>
  
  <p style="
    color: white;
    font-size: 16px;
    margin-bottom: 25px;
    opacity: 0.95;">
    LINEオープンチャット「${this.config.chatName}」<br>
    お得な商品情報を配信中！
  </p>
  
  <a href="${this.config.inviteUrl}" 
     target="_blank"
     rel="noopener noreferrer"
     style="
       display: inline-block;
       background: white;
       color: #00B900;
       padding: 15px 40px;
       border-radius: 30px;
       text-decoration: none;
       font-weight: bold;
       font-size: 18px;
       box-shadow: 0 5px 15px rgba(0,0,0,0.2);
       transition: transform 0.3s;">
    今すぐ参加する →
  </a>
  
  <p style="
    color: rgba(255,255,255,0.8);
    font-size: 14px;
    margin-top: 20px;
    margin-bottom: 10px;">
    または QRコードで参加
  </p>
  
  <button onclick="showQRCode()" style="
    background: rgba(255,255,255,0.2);
    color: white;
    border: 1px solid white;
    padding: 10px 25px;
    border-radius: 20px;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.3s;">
    QRコードを表示
  </button>
</div>

<!-- QRコードモーダル -->
<script>
function showQRCode() {
  const modal = document.createElement('div');
  modal.style.cssText = \`
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    cursor: pointer;
  \`;
  
  modal.innerHTML = \`
    <div style="
      background: white;
      border-radius: 20px;
      padding: 30px;
      text-align: center;
      position: relative;">
      
      <h3 style="margin-bottom: 20px; color: #333;">
        QRコードで参加
      </h3>
      
      <img src="${this.config.qrCodeUrl}" 
           alt="LINE オープンチャット QRコード" 
           style="width: 200px; height: 200px;">
      
      <p style="
        margin-top: 20px;
        color: #666;
        font-size: 14px;">
        LINEアプリでQRコードを読み取り
      </p>
      
      <button onclick="this.parentElement.parentElement.remove()" style="
        position: absolute;
        top: 10px;
        right: 10px;
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #999;">
        ×
      </button>
    </div>
  \`;
  
  modal.onclick = function(e) {
    if (e.target === modal) {
      modal.remove();
    }
  };
  
  document.body.appendChild(modal);
}
</script>`;
  }

  /**
   * 超シンプルな中間CTA
   */
  generateMidArticleCTA() {
    return `
<!-- 中間CTA -->
<div style="
  background: #E8F5E9;
  border-left: 4px solid #4CAF50;
  padding: 20px;
  margin: 30px 0;">
  <p style="
    margin: 0;
    color: #2E7D32;
    font-size: 16px;">
    💬 <strong>限定情報配信中！</strong>
    <a href="${this.config.inviteUrl}" 
       target="_blank"
       style="color: #1B5E20; text-decoration: underline;">
      LINEオープンチャットに参加する →
    </a>
  </p>
</div>`;
  }

  /**
   * 記事への統合（シンプル版）
   */
  integrateWithProductArticle(articleContent, options = {}) {
    const { addMidCTA = false, addEndCTA = true } = options;
    
    let enhancedContent = articleContent;
    
    // 中間CTAは必要な場合のみ
    if (addMidCTA) {
      const paragraphs = articleContent.split('</p>');
      const midPoint = Math.floor(paragraphs.length / 2);
      paragraphs.splice(midPoint, 0, this.generateMidArticleCTA());
      enhancedContent = paragraphs.join('</p>');
    }
    
    // 末尾にメインCTA
    if (addEndCTA) {
      enhancedContent += this.generateEndArticleCTA();
    }
    
    return enhancedContent;
  }
}

module.exports = { OpenChatCTAGenerator };
