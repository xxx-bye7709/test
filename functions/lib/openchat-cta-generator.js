// functions/lib/openchat-cta-generator.js
// 商品記事にLINEオープンチャットへの誘導CTAを追加

class OpenChatCTAGenerator {
  constructor() {
    // オープンチャット情報
    this.config = {
      chatName: process.env.OPENCHAT_NAME || 'お得情報共有コミュニティ',
      searchKeyword: process.env.OPENCHAT_KEYWORD || 'エンタメお得情報',
      benefits: [
        '週2回の厳選商品情報',
        'メンバー限定のお得情報',
        '新作の先行案内',
        '完全無料・匿名参加OK'
      ]
    };
  }

  /**
   * 記事の中間に挿入するCTA（控えめ版）
   */
  generateMidArticleCTA() {
    return `
<!-- オープンチャット誘導（記事中間） -->
<div style="
  background: linear-gradient(135deg, #00B900 0%, #00D400 100%);
  border-radius: 15px;
  padding: 20px;
  margin: 30px 0;
  text-align: center;
  position: relative;">
  
  <p style="
    color: white;
    font-size: 16px;
    margin: 0;
    font-weight: bold;">
    💬 この記事の商品について語り合いませんか？
  </p>
  
  <p style="
    color: rgba(255,255,255,0.9);
    font-size: 14px;
    margin: 10px 0;">
    LINEオープンチャットで情報交換中
  </p>
  
  <a href="#openchat-info" 
     style="
       color: white;
       text-decoration: underline;
       font-size: 14px;">
    参加方法を見る ↓
  </a>
</div>`;
  }

  /**
   * 記事の最後に挿入するメインCTA
   */
  generateEndArticleCTA() {
    const benefits = this.config.benefits.map(b => `✅ ${b}`).join('<br>');
    
    return `
<!-- オープンチャット誘導（記事末尾） -->
<div id="openchat-info" style="
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  padding: 40px 30px;
  margin: 50px auto;
  max-width: 700px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.1);
  text-align: center;
  position: relative;
  overflow: hidden;">
  
  <!-- 背景装飾 -->
  <div style="
    position: absolute;
    top: -100px;
    right: -100px;
    width: 300px;
    height: 300px;
    background: rgba(255,255,255,0.1);
    border-radius: 50%;"></div>
  
  <!-- LINEアイコン -->
  <div style="
    display: inline-block;
    background: white;
    border-radius: 20px;
    padding: 15px 30px;
    margin-bottom: 20px;
    box-shadow: 0 10px 20px rgba(0,0,0,0.1);">
    <span style="color: #00B900; font-size: 24px; font-weight: bold;">
      LINE オープンチャット
    </span>
  </div>
  
  <!-- メインメッセージ -->
  <h3 style="
    color: white;
    font-size: 28px;
    font-weight: bold;
    margin-bottom: 20px;
    text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    🎉 ${this.config.chatName}
  </h3>
  
  <p style="
    color: rgba(255,255,255,0.95);
    font-size: 16px;
    margin-bottom: 30px;
    line-height: 1.8;">
    同じ趣味の仲間と<br>
    お得な情報を共有しよう！
  </p>
  
  <!-- 特典リスト -->
  <div style="
    background: rgba(255,255,255,0.15);
    backdrop-filter: blur(10px);
    border-radius: 15px;
    padding: 25px;
    margin-bottom: 30px;
    text-align: left;">
    <p style="
      color: white;
      font-size: 14px;
      line-height: 2;
      margin: 0;">
      ${benefits}
    </p>
  </div>
  
  <!-- 参加方法 -->
  <div style="
    background: white;
    border-radius: 15px;
    padding: 25px;
    margin-bottom: 20px;">
    
    <h4 style="
      color: #667eea;
      font-size: 18px;
      margin-bottom: 15px;
      font-weight: bold;">
      📱 参加方法（無料）
    </h4>
    
    <ol style="
      text-align: left;
      color: #333;
      font-size: 14px;
      line-height: 2;
      margin: 0;
      padding-left: 20px;">
      <li>LINEアプリを開く</li>
      <li>ホーム → オープンチャット</li>
      <li>🔍 検索で「<strong style="color: #667eea;">${this.config.searchKeyword}</strong>」</li>
      <li>参加ボタンをタップ</li>
    </ol>
    
    <div style="
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 10px 15px;
      margin-top: 15px;
      text-align: left;">
      <p style="
        color: #856404;
        font-size: 12px;
        margin: 0;">
        ⚠️ 18歳以上限定のコミュニティです
      </p>
    </div>
  </div>
  
  <!-- CTAボタン -->
  <button onclick="showOpenChatGuide()" style="
    background: white;
    color: #667eea;
    border: none;
    padding: 15px 40px;
    border-radius: 30px;
    font-size: 18px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 10px 20px rgba(0,0,0,0.2);
    transition: all 0.3s;">
    参加手順を表示 →
  </button>
  
  <p style="
    color: rgba(255,255,255,0.7);
    font-size: 12px;
    margin-top: 20px;">
    ※ LINEアカウントがあれば誰でも参加できます<br>
    ※ 本名は表示されません（ニックネーム参加）
  </p>
</div>

<!-- モーダル用JavaScript -->
<script>
function showOpenChatGuide() {
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
  \`;
  
  modal.innerHTML = \`
    <div style="
      background: white;
      border-radius: 20px;
      padding: 30px;
      max-width: 500px;
      margin: 20px;
      position: relative;">
      
      <button onclick="this.parentElement.parentElement.remove()" style="
        position: absolute;
        top: 15px;
        right: 15px;
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #999;">
        ×
      </button>
      
      <h3 style="
        color: #333;
        margin-bottom: 20px;">
        LINEオープンチャット参加手順
      </h3>
      
      <div style="
        background: #f8f9fa;
        border-radius: 10px;
        padding: 20px;
        margin-bottom: 20px;">
        
        <p style="
          font-weight: bold;
          color: #00B900;
          margin-bottom: 10px;">
          検索キーワード
        </p>
        
        <div style="
          background: white;
          border: 2px solid #00B900;
          border-radius: 10px;
          padding: 15px;
          text-align: center;
          font-size: 18px;
          font-weight: bold;
          color: #333;
          user-select: all;
          cursor: text;">
          ${this.config.searchKeyword}
        </div>
        
        <p style="
          font-size: 12px;
          color: #666;
          margin-top: 10px;
          text-align: center;">
          ↑ タップして選択・コピー
        </p>
      </div>
      
      <ol style="
        color: #333;
        line-height: 2;
        margin-bottom: 20px;">
        <li>上記キーワードをコピー</li>
        <li>LINEアプリを開く</li>
        <li>オープンチャットで検索</li>
        <li>参加ボタンをタップ</li>
      </ol>
      
      <button onclick="
        navigator.clipboard.writeText('${this.config.searchKeyword}');
        alert('キーワードをコピーしました！\\nLINEアプリを開いて検索してください。');
        this.parentElement.parentElement.remove();
      " style="
        background: #00B900;
        color: white;
        border: none;
        padding: 12px 30px;
        border-radius: 25px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        width: 100%;">
        キーワードをコピーする
      </button>
    </div>
  \`;
  
  document.body.appendChild(modal);
}

// ページ離脱時のポップアップ（オプション）
let exitIntentShown = false;
document.addEventListener('mouseleave', function(e) {
  if (e.clientY <= 0 && !exitIntentShown && !sessionStorage.getItem('openchatCTAShown')) {
    exitIntentShown = true;
    sessionStorage.setItem('openchatCTAShown', 'true');
    
    if (confirm('💬 お得情報を見逃さないために\\nLINEオープンチャットに参加しませんか？')) {
      document.getElementById('openchat-info').scrollIntoView({ behavior: 'smooth' });
    }
  }
});
</script>`;
  }

  /**
   * ノート投稿への誘導（記事内）
   */
  generateNoteReferenceCTA() {
    return `
<!-- ノート更新通知 -->
<div style="
  background: #E3F2FD;
  border-left: 4px solid #2196F3;
  padding: 15px 20px;
  margin: 30px 0;">
  
  <p style="
    color: #1565C0;
    font-size: 14px;
    margin: 0;">
    📌 <strong>不定期更新</strong><br>
    オープンチャットのノートで最新商品情報を配信中！<br>
    <a href="#openchat-info" style="color: #1976D2;">
      参加方法はこちら ↓
    </a>
  </p>
</div>`;
  }

  /**
   * 既存の商品記事に統合
   */
  integrateWithProductArticle(articleContent, options = {}) {
    const { 
      addMidCTA = true, 
      addEndCTA = true,
      addNoteCTA = true 
    } = options;
    
    let enhancedContent = articleContent;
    
    // 記事の段落を分析
    const paragraphs = articleContent.split('</p>');
    const midPoint = Math.floor(paragraphs.length / 2);
    
    // 中間CTAを挿入
    if (addMidCTA && paragraphs.length > 5) {
      paragraphs.splice(midPoint, 0, this.generateMidArticleCTA());
    }
    
    // ノート参照CTAを挿入
    if (addNoteCTA && paragraphs.length > 8) {
      const notePoint = Math.floor(paragraphs.length * 0.75);
      paragraphs.splice(notePoint, 0, this.generateNoteReferenceCTA());
    }
    
    enhancedContent = paragraphs.join('</p>');
    
    // 最後にメインCTAを追加
    if (addEndCTA) {
      enhancedContent += this.generateEndArticleCTA();
    }
    
    return enhancedContent;
  }
}

// 既存のblog-tool.jsに統合する関数
function addOpenChatCTAToArticle(articleContent) {
  const ctaGenerator = new OpenChatCTAGenerator();
  return ctaGenerator.integrateWithProductArticle(articleContent, {
    addMidCTA: true,    // 記事中間に小さなCTA
    addEndCTA: true,    // 記事末尾にメインCTA
    addNoteCTA: true    // ノート更新の案内
  });
}

module.exports = {
  OpenChatCTAGenerator,
  addOpenChatCTAToArticle
};
