const functions = require('firebase-functions');
const xmlrpc = require('xmlrpc');
const { OpenAI } = require('openai');

class BlogTool {
  constructor() {
    // 環境変数から設定を取得
    this.wordpressUrl = process.env.WORDPRESS_URL || functions.config().wordpress?.url || 'https://www.entamade.jp';
    this.wordpressUsername = process.env.WORDPRESS_USERNAME || functions.config().wordpress?.username;
    this.wordpressPassword = process.env.WORDPRESS_PASSWORD || functions.config().wordpress?.password;
    this.openaiApiKey = process.env.OPENAI_API_KEY || functions.config().openai?.api_key;

    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('✅ BlogTool initialized successfully');
    console.log('WordPress URL:', this.wordpressUrl);

    this.openai = new OpenAI({
      apiKey: this.openaiApiKey
    });

    this.blogId = 1;

    // テンプレート定義
    this.templates = {
      entertainment: {
        topic: '最新のエンタメニュース、芸能人の話題、テレビ番組情報',
        tags: ['エンタメ', '芸能', '話題', 'トレンド', 'ニュース']
      },
      anime: {
        topic: '注目のアニメ作品、声優情報、アニメイベント、新作情報',
        tags: ['アニメ', 'オタク', '声優', '新作', '2025年']
      },
      game: {
        topic: '人気ゲームの攻略情報、新作ゲーム情報、eスポーツの最新動向',
        tags: ['ゲーム', 'eスポーツ', '攻略', 'レビュー', 'PS5']
      },
      movie: {
        topic: '話題の映画レビュー、公開予定作品、映画館情報、興行収入',
        tags: ['映画', '洋画', '邦画', 'Netflix', 'レビュー']
      },
      music: {
        topic: '最新音楽ニュース、新曲リリース情報、ライブ・コンサート情報',
        tags: ['音楽', 'J-POP', '新曲', 'ライブ', 'ランキング']
      },
      tech: {
        topic: 'IT業界ニュース、最新ガジェット、AI技術、プログラミング',
        tags: ['テクノロジー', 'IT', 'ガジェット', 'AI', 'プログラミング']
      },
      beauty: {
        topic: '美容トレンド、スキンケア方法、メイクテクニック、コスメレビュー',
        tags: ['美容', 'コスメ', 'スキンケア', 'メイク', 'トレンド']
      },
      food: {
        topic: 'グルメ情報、人気レストラン、レシピ紹介、食のトレンド',
        tags: ['グルメ', '料理', 'レシピ', '食べ物', 'レストラン']
      }
    };
  }

  // XMLエスケープ（UTF-8対応）
  escapeXML(str) {
    if (!str) return '';
    // UTF-8文字列として扱う
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // HTMLコンテンツのクリーニング
  cleanHtmlContent(content) {
    if (!content) return '';
    
    // マークダウンのコードブロック記号を除去
    let cleaned = content
      .replace(/^```html?\s*\n?/gm, '')
      .replace(/\n?```\s*$/gm, '');
    
    // DOCTYPE、html、head、bodyタグを除去（記事本文のみ抽出）
    cleaned = cleaned
      .replace(/<!DOCTYPE[^>]*>/gi, '')
      .replace(/<html[^>]*>/gi, '')
      .replace(/<\/html>/gi, '')
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
      .replace(/<body[^>]*>/gi, '')
      .replace(/<\/body>/gi, '')
      .replace(/<meta[^>]*>/gi, '')
      .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '');
    
    // 危険なタグを除去
    cleaned = cleaned
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/<object[^>]*>.*?<\/object>/gi, '')
      .replace(/<embed[^>]*>/gi, '');
    
    // 余分な空白行を削除
    cleaned = cleaned.trim();
    
    return cleaned;
  }

  // コンテンツのサニタイズ（安全化）
  sanitizeContent(content) {
    if (!content) return '';
    
    let safe = this.cleanHtmlContent(content);
    
    // 文字数制限（長すぎる場合は制限）
    if (safe.length > 15000) {
      safe = safe.substring(0, 15000) + '...';
      console.log('Content truncated to 15000 characters');
    }
    
    return safe;
  }

  // SEOタイトル最適化
  optimizeTitle(title, category) {
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    
    // タイトルが既に年月を含んでいない場合のみ追加
    if (!title.includes(String(year))) {
      title = `【${year}年${month}月】${title}`;
    }
    
    // カテゴリー別のプレフィックス
    const prefixes = {
      entertainment: '【最新】',
      anime: '【アニメ】',
      game: '【ゲーム】',
      movie: '【映画】',
      music: '【音楽】',
      tech: '【IT】',
      beauty: '【美容】',
      food: '【グルメ】'
    };
    
    // プレフィックスがない場合は追加
    const prefix = prefixes[category];
    if (prefix && !title.includes(prefix)) {
      title = prefix + title;
    }
    
    return title;
  }

  // SEOタグ最適化
  optimizeTags(tags, category) {
    const baseTags = tags || [];
    const templateTags = this.templates[category]?.tags || [];
    const year = new Date().getFullYear();
    
    // 共通タグ
    const commonTags = [
      '最新情報',
      `${year}年`,
      'まとめ',
      'ランキング',
      '注目',
      'トレンド',
      '話題'
    ];
    
    // タグを統合して重複を除去
    const allTags = [...new Set([
      ...baseTags,
      ...templateTags,
      ...commonTags
    ])];
    
    // 最大15個のタグを返す
    return allTags.slice(0, 15);
  }

  // キーワード密度最適化
  optimizeKeywordDensity(content, keyword, targetDensity = 0.02) {
    if (!keyword || !content) return content;
    
    const words = content.split(/\s+/);
    const totalWords = words.length;
    const keywordRegex = new RegExp(keyword, 'gi');
    let keywordCount = (content.match(keywordRegex) || []).length;
    
    const targetCount = Math.ceil(totalWords * targetDensity);
    
    if (keywordCount < targetCount) {
      const sentences = content.split(/[。！？]/);
      const insertInterval = Math.floor(sentences.length / (targetCount - keywordCount));
      
      let modifiedSentences = [...sentences];
      for (let i = insertInterval; i < sentences.length && keywordCount < targetCount; i += insertInterval) {
        if (!sentences[i].includes(keyword)) {
          modifiedSentences[i] = `${sentences[i]}（${keyword}）`;
          keywordCount++;
        }
      }
      content = modifiedSentences.join('。');
    }
    
    return content;
  }

  // 修正版
  async postToWordPress(article) {
  const https = require('https');
  
  try {
    // 商品レビュー記事かどうかを判定
    const isProductReview = article.category === 'レビュー' || 
                           article.tags?.includes('レビュー') ||
                           article.isProductReview === true;
    
    // 商品記事は下書き、通常記事は公開
    const postStatus = isProductReview ? 'draft' : 'publish';
    
    console.log(`📤 Manual XML-RPC posting as ${postStatus}...`);
    console.log('Article type:', isProductReview ? 'Product Review' : 'Regular Post');
    
    const sanitizeForXML = (str) => {
      if (!str) return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };
    
    const processedTitle = sanitizeForXML(article.title || 'レビュー').substring(0, 100);
    const processedContent = sanitizeForXML(article.content || '<p>内容</p>').substring(0, 5000);
    
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>metaWeblog.newPost</methodName>
  <params>
    <param><value><string>1</string></value></param>
    <param><value><string>${this.wordpressUsername}</string></value></param>
    <param><value><string>${this.wordpressPassword}</string></value></param>
    <param>
      <value>
        <struct>
          <member>
            <name>title</name>
            <value><string>${processedTitle}</string></value>
          </member>
          <member>
            <name>description</name>
            <value><string>${processedContent}</string></value>
          </member>
          <member>
            <name>post_status</name>
            <value><string>${postStatus}</string></value>
          </member>
        </struct>
      </value>
    </param>
    <param><value><boolean>${postStatus === 'publish' ? 1 : 0}</boolean></value></param>
  </params>
</methodCall>`;

    return new Promise((resolve) => {
      const url = new URL(this.wordpressUrl);
      const options = {
        hostname: url.hostname,
        port: 443,
        path: '/xmlrpc.php',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=UTF-8',
          'Content-Length': Buffer.byteLength(xmlPayload),
          'User-Agent': 'WordPress/6.0'
        }
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.log('Response:', data.substring(0, 500));
          
          if (data.includes('<html') || data.includes('<!DOCTYPE')) {
            resolve({
              success: false,
              error: 'Blocked by security',
              message: 'セキュリティブロック'
            });
          } else if (data.includes('<string>') || data.includes('<int>')) {
            const idMatch = data.match(/<(?:string|int)>(\d+)<\/(?:string|int)>/);
            if (idMatch) {
              const postUrl = isProductReview
                ? `${this.wordpressUrl}/wp-admin/post.php?post=${idMatch[1]}&action=edit`
                : `${this.wordpressUrl}/?p=${idMatch[1]}`;
              
              resolve({
                success: true,
                postId: idMatch[1],
                url: postUrl,
                status: postStatus,
                message: isProductReview 
                  ? '下書きとして保存されました' 
                  : '記事が公開されました'
              });
            } else {
              resolve({ success: false, error: 'ID not found' });
            }
          } else {
            resolve({ success: false, error: 'Unknown error' });
          }
        });
      });
      
      req.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });
      
      req.write(xmlPayload);
      req.end();
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
}

  // GPTを使った記事生成（汎用）
  async generateWithGPT(category, template) {
    try {
      const categoryData = this.templates[category] || this.templates.entertainment;
      
      const prompt = `
${categoryData.topic}について、最新の情報をまとめた魅力的なブログ記事を作成してください。

要件:
1. 1500-2000文字程度
2. HTML形式（h2, h3, p, ul, li, strong, emタグのみ使用）
3. DOCTYPEやhtmlタグは含めない（記事本文のみ）
4. コードブロックの記号（\`\`\`）は使わない
5. SEOを意識した構成
6. 読者の興味を引く内容
7. 具体的な情報を含める

構成:
- 導入部分（なぜ今この話題が重要か）
- メイントピック3つ（それぞれh2タグ）
- 各トピックに具体例や詳細情報
- まとめ（今後の展望）

記事本文のHTMLのみを出力してください。`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "あなたは人気ブログの専門記者です。SEOに強く、読者を引き付ける記事を書きます。最新のトレンドに詳しく、具体的な情報を提供します。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 3000
      });

      const content = this.cleanHtmlContent(completion.choices[0]?.message?.content || '');
      
      console.log('✅ Content generated via GPT');
      return content;
      
    } catch (error) {
      console.error('❌ Error generating with GPT:', error);
      throw error;
    }
  }

  // 記事生成（カテゴリー別）
  async generateArticle(category = 'entertainment', options = {}) {
    try {
      console.log(`📝 Generating ${category} article...`);
      
      // GPTで本文生成
      const content = await this.generateWithGPT(category, options.template);
      
      // タイトル生成
      const categoryData = this.templates[category] || this.templates.entertainment;
      const titlePrompt = `
「${categoryData.topic}」について、SEOに強い魅力的な記事タイトルを1つ生成してください。
要件：
- 30-50文字程度
- キャッチーで興味を引く
- 具体的な内容を示唆する
タイトルのみを出力してください。`;
      
      const titleCompletion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: titlePrompt
          }
        ],
        temperature: 0.8,
        max_tokens: 100
      });

      const title = titleCompletion.choices[0]?.message?.content?.trim() || `${category}の最新情報`;
      
      console.log('✅ Article generated successfully');
      console.log('Title:', title);
      console.log('Content length:', content.length);
      
      return {
        title: title,
        content: content,
        category: category,
        tags: this.optimizeTags([], category),
        status: options.status || 'publish'
      };
      
    } catch (error) {
      console.error('❌ Error generating article:', error);
      throw error;
    }
  }

 // blog-tool.jsのgenerateProductReview関数を以下に置き換え

async generateProductReview(productData, keyword, options = {}) {
  try {
    console.log('🎯 Generating product review article...');
    console.log('Product data received:', JSON.stringify(productData, null, 2));
    
    // アダルトコンテンツの検出
    const adultKeywords = [
      '18禁', 'R18', 'アダルト', '成人向け', 'AV',
      'セックス', 'SEX', 'エロ', '素人', 'ナンパ',
      'おっぱい', '巨乳', '痴女', '熟女', '人妻',
      '中出し', 'フェラ', '潮吹き', 'ハメ', 'オナニー'
    ];
    
    const originalTitle = productData.title || '';
    const originalDescription = productData.description || '';
    
    const containsAdultContent = adultKeywords.some(word => 
      originalTitle.toLowerCase().includes(word.toLowerCase()) ||
      originalDescription.toLowerCase().includes(word.toLowerCase()) ||
      (productData.genre && productData.genre.toLowerCase().includes(word.toLowerCase()))
    );
    
    if (containsAdultContent) {
      console.log('⚠️ Adult content detected - generating enhanced sanitized version');
    }
    
    // 商品データの処理
    let title = originalTitle;
    let description = originalDescription;
    let imageUrl = productData.imageUrl || productData.image || '';
    const price = productData.price || '';
    const affiliateUrl = productData.affiliateUrl || productData.url || '';
    const rating = productData.rating || '';
    const category = productData.category || 'レビュー';
    const maker = productData.maker || '';
    const genre = productData.genre || '';
    const releaseDate = productData.releaseDate || '';
    
    // アダルトコンテンツの場合の処理（改善版）
    if (containsAdultContent) {
      // タイトルをマイルドに処理（完全には隠さない）
      const titleParts = originalTitle.split(/[！。、]/);
      title = titleParts[0].substring(0, 30) + '...他';
      description = '詳細は公式ページでご確認ください';
      
      // 代替画像URLを設定（プレースホルダー画像）
      const placeholderImage = 'https://placehold.jp/30/3d4070/ffffff/600x400.png?text=商品画像';
      
      // 価格を整形
      const priceFormatted = price ? `¥${price.replace('~', '〜')}` : '価格は公式サイトでご確認ください';
      
      // 評価の星表示を作成
      const ratingStars = rating ? '★'.repeat(Math.floor(parseFloat(rating))) + '☆'.repeat(5 - Math.floor(parseFloat(rating))) : '☆☆☆☆☆';
      const ratingText = rating ? `${rating} / 5.0` : '評価情報なし';
      
      // リッチなHTMLコンテンツを生成
      const sanitizedContent = `
<!-- 商品情報カード -->
<div style="max-width: 800px; margin: 0 auto; padding: 20px;">
  <div style="border: 2px solid #e91e63; border-radius: 15px; padding: 30px; margin: 20px 0; background: linear-gradient(135deg, #fff 0%, #fce4ec 100%); box-shadow: 0 5px 20px rgba(0,0,0,0.1);">
    <h2 style="color: #333; margin-top: 0; font-size: 28px; border-bottom: 3px solid #e91e63; padding-bottom: 15px;">
      <span style="background: #e91e63; color: white; padding: 5px 15px; border-radius: 5px; font-size: 14px; margin-right: 10px;">限定商品</span>
      商品情報
    </h2>
    
    <!-- 商品基本情報 -->
    <div style="display: flex; gap: 30px; margin-top: 25px;">
      <!-- 左側：画像 -->
      <div style="flex: 0 0 250px;">
        <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; text-align: center;">
          <p style="color: #666; font-size: 14px; margin: 0;">
            <span style="font-size: 48px;">🔒</span><br>
            商品画像は公式サイトでご確認ください
          </p>
        </div>
      </div>
      
      <!-- 右側：詳細情報 -->
      <div style="flex: 1;">
        <h3 style="color: #333; margin-top: 0; font-size: 20px;">${title}</h3>
        
        <!-- 評価 -->
        <div style="margin: 15px 0;">
          <span style="color: #ffc107; font-size: 24px; letter-spacing: 2px;">${ratingStars}</span>
          <span style="color: #666; margin-left: 10px; font-size: 18px;">${ratingText}</span>
          ${rating ? `<span style="color: #999; margin-left: 10px;">（${productData.reviewCount || 0}件のレビュー）</span>` : ''}
        </div>
        
        <!-- 価格 -->
        <div style="margin: 20px 0;">
          <span style="background: #ff5722; color: white; padding: 8px 20px; border-radius: 25px; font-size: 24px; font-weight: bold;">
            ${priceFormatted}
          </span>
        </div>
        
        <!-- 商品詳細テーブル -->
        <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; color: #666; width: 100px;">カテゴリー</td>
            <td style="padding: 10px; color: #333;">${category}</td>
          </tr>
          ${maker ? `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; color: #666;">メーカー</td>
            <td style="padding: 10px; color: #333;">${maker}</td>
          </tr>` : ''}
          ${releaseDate ? `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; color: #666;">発売日</td>
            <td style="padding: 10px; color: #333;">${new Date(releaseDate).toLocaleDateString('ja-JP')}</td>
          </tr>` : ''}
        </table>
        
        <!-- 購入ボタン（アフィリエイトリンク） -->
        ${affiliateUrl ? `
        <div style="margin: 25px 0;">
          <a href="${affiliateUrl}" target="_blank" rel="noopener noreferrer sponsored" style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 30px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); transition: transform 0.3s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            🛒 詳細を見る・購入はこちら
          </a>
        </div>` : ''}
      </div>
    </div>
  </div>
  
  <!-- 商品説明セクション -->
  <div style="margin: 40px 0; padding: 30px; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <h2 style="color: #333; border-left: 5px solid #e91e63; padding-left: 15px;">この商品について</h2>
    <p style="line-height: 1.8; color: #555; margin: 20px 0;">
      こちらは<strong>${keyword}</strong>カテゴリーの人気商品です。多くのお客様から高い評価をいただいております。
    </p>
    <p style="line-height: 1.8; color: #555; margin: 20px 0;">
      商品の詳細な内容については、公式ページでご確認いただけます。レビューや詳しい商品説明もご覧いただけますので、ぜひチェックしてみてください。
    </p>
  </div>
  
  <!-- 特徴リスト -->
  <div style="margin: 40px 0; padding: 30px; background: #f8f9fa; border-radius: 10px;">
    <h2 style="color: #333; margin-bottom: 20px;">
      <span style="color: #e91e63;">✨</span> この商品の特徴
    </h2>
    <ul style="list-style: none; padding: 0;">
      <li style="padding: 10px 0; border-bottom: 1px solid #dee2e6;">
        <span style="color: #28a745; font-size: 20px; margin-right: 10px;">✓</span>
        高品質な商品内容をお約束
      </li>
      <li style="padding: 10px 0; border-bottom: 1px solid #dee2e6;">
        <span style="color: #28a745; font-size: 20px; margin-right: 10px;">✓</span>
        お求めやすい価格設定
      </li>
      <li style="padding: 10px 0; border-bottom: 1px solid #dee2e6;">
        <span style="color: #28a745; font-size: 20px; margin-right: 10px;">✓</span>
        安心・安全なお取引
      </li>
      <li style="padding: 10px 0; border-bottom: 1px solid #dee2e6;">
        <span style="color: #28a745; font-size: 20px; margin-right: 10px;">✓</span>
        ${rating ? `お客様評価 ${rating} の高評価商品` : 'お客様満足度の高い商品'}
      </li>
    </ul>
  </div>
  
  <!-- 購入ガイド -->
  <div style="margin: 40px 0; padding: 30px; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <h2 style="color: #333; border-left: 5px solid #ffc107; padding-left: 15px;">ご購入にあたって</h2>
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <p style="margin: 10px 0; color: #856404;">
        <strong>⚠️ ご注意事項</strong>
      </p>
      <ul style="margin: 10px 0; padding-left: 25px; color: #856404;">
        <li>本商品は成人向けコンテンツを含む可能性があります</li>
        <li>18歳未満の方はご利用いただけません</li>
        <li>ご購入前に必ず商品詳細をご確認ください</li>
      </ul>
    </div>
  </div>
  
  <!-- CTA（Call To Action） -->
  <div style="text-align: center; margin: 50px 0; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 15px;">
    <h3 style="color: white; font-size: 24px; margin-bottom: 20px;">🎁 今すぐチェック！</h3>
    <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin-bottom: 25px;">
      詳しい商品情報・レビュー・購入はこちらから
    </p>
    ${affiliateUrl ? `
    <a href="${affiliateUrl}" target="_blank" rel="noopener noreferrer sponsored" style="display: inline-block; padding: 18px 50px; background: white; color: #764ba2; text-decoration: none; border-radius: 30px; font-size: 20px; font-weight: bold; box-shadow: 0 4px 20px rgba(0,0,0,0.2); transition: transform 0.3s ease;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
      公式ページへ進む ≫
    </a>` : ''}
  </div>
  
  <!-- フッター情報 -->
  <div style="margin-top: 50px; padding: 20px; border-top: 2px solid #eee; text-align: center; color: #999; font-size: 14px;">
    <p>※ 価格・在庫状況は変動する場合があります。最新情報は公式サイトでご確認ください。</p>
    <p>※ 当サイトはアフィリエイトプログラムによる収益を得ています。</p>
  </div>
</div>
`;
      
      // サニタイズされたタイトル
      const sanitizedTitle = `【${keyword}】おすすめ商品レビュー`;
      
      return {
        title: sanitizedTitle,
        content: sanitizedContent,
        category: 'レビュー',
        tags: [keyword, 'レビュー', '商品紹介', 'おすすめ', '2025年'],
        status: 'draft',
        isProductReview: true
      };
    }
    
    // 通常の商品の場合（アダルトコンテンツではない）
    // 既存のOpenAI APIを使った処理...
    console.log('Generating normal product review with OpenAI...');
    // （既存のコードをそのまま使用）
    
  } catch (error) {
    console.error('❌ Error in generateProductReview:', error);
    throw error;
  }
}

  // タグ生成の改善
  generateTags(keyword, category, productTitle) {
    const tags = [keyword, category];
    
    // アダルトキーワードは除外
    const excludeWords = ['セックス', 'エロ', '素人', 'AV', '18禁'];
    
    // 商品名から重要な単語を抽出
    const words = productTitle.split(/[\s　,、。！？]/);
    words.forEach(word => {
      if (word.length > 2 && !tags.includes(word) && !excludeWords.includes(word)) {
        tags.push(word);
      }
    });
    
    // 一般的なタグも追加
    tags.push('レビュー', '2025年', 'おすすめ');
    
    return tags.slice(0, 10); // 最大10個まで
  }
}  // ← BlogToolクラスの閉じ括弧（重要）

module.exports = BlogTool;
