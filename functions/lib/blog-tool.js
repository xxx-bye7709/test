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

 // blog-tool.jsのgenerateProductReview関数を以下に完全置き換え
async generateProductReview(productData, keyword, options = {}) {
  try {
    console.log('🎯 Generating HIGH CVR product review article...');
    console.log('Product data received:', JSON.stringify(productData, null, 2));
    
    // より賢いアダルトコンテンツ検出（緩和版）
    // 複数の強いキーワードが含まれる場合のみアダルト判定
    const strongAdultKeywords = ['糞', '尿', '肉便器', '陵辱', '強姦', '犯す', 'ババア'];
    const mediumAdultKeywords = ['ちんこ', 'まんこ', 'ズポズポ', 'ヌルヌル', 'ビチャビチャ'];
    
    const originalTitle = productData.title || '';
    const originalDescription = productData.description || '';
    const genre = productData.genre || '';
    
    // 強いキーワードが1つでもあればアダルト
    let isStrongAdult = strongAdultKeywords.some(word => 
      originalTitle.includes(word) || 
      originalDescription.includes(word) ||
      genre.includes(word)
    );
    
    // 中程度のキーワードが3つ以上あればアダルト
    let mediumCount = mediumAdultKeywords.filter(word => 
      originalTitle.includes(word) || 
      originalDescription.includes(word) ||
      genre.includes(word)
    ).length;
    
    const containsAdultContent = isStrongAdult || mediumCount >= 3;
    
    if (containsAdultContent) {
      console.log('⚠️ Strong adult content detected - using safe template');
    } else {
      console.log('✅ Normal content - generating high quality article with OpenAI');
    }
    
    // 商品データの準備
    const title = originalTitle;
    const description = originalDescription;
    const imageUrl = productData.imageUrl || productData.image || '';
    const thumbnailUrl = productData.thumbnailUrl || imageUrl;
    const price = productData.price || '';
    const affiliateUrl = productData.affiliateUrl || productData.url || '';
    const rating = parseFloat(productData.rating || '4.5');
    const reviewCount = productData.reviewCount || Math.floor(Math.random() * 500) + 100;
    const maker = productData.maker || '';
    const releaseDate = productData.releaseDate || '';
    const duration = productData.duration || '';
    
    // 価格のフォーマット
    const priceNum = price.replace(/[^0-9]/g, '');
    const priceFormatted = priceNum ? `¥${parseInt(priceNum).toLocaleString()}` : price;
    const discountPercent = productData.listPrice ? 
      Math.round((1 - parseInt(priceNum) / parseInt(productData.listPrice.replace(/[^0-9]/g, ''))) * 100) : 0;
    
    // 評価の星生成
    const fullStars = '★'.repeat(Math.floor(rating));
    const halfStar = (rating % 1 >= 0.5) ? '☆' : '';
    const emptyStars = '☆'.repeat(5 - Math.floor(rating) - (halfStar ? 1 : 0));
    const ratingStars = fullStars + halfStar + emptyStars;
    
    // アダルトコンテンツの場合はセーフテンプレート使用
    if (containsAdultContent) {
      const safeTitle = title.substring(0, 40) + '...';
      
      return {
        title: `【限定】${keyword}カテゴリー注目商品`,
        content: `
<div style="max-width: 900px; margin: 0 auto; padding: 20px; font-family: 'Noto Sans JP', sans-serif;">
  
  <!-- 限定バナー -->
  <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%); color: white; padding: 30px; border-radius: 15px; margin-bottom: 25px; text-align: center; box-shadow: 0 5px 20px rgba(255,107,107,0.3);">
    <p style="font-size: 14px; margin: 0;">＼ 期間限定キャンペーン ／</p>
    <h1 style="font-size: 28px; margin: 15px 0;">【本日限り】特別価格でご提供中</h1>
    <p style="font-size: 20px; margin: 10px 0;">${ratingStars} ${rating}/5.0（${reviewCount}件のレビュー）</p>
  </div>

  <!-- 商品カード -->
  <div style="background: white; border: 2px solid #ff6b6b; border-radius: 15px; padding: 30px; margin-bottom: 30px; box-shadow: 0 3px 15px rgba(0,0,0,0.1);">
    <div style="display: flex; gap: 30px; align-items: start;">
      <div style="flex: 0 0 280px;">
        <div style="background: #f8f8f8; padding: 40px 20px; border-radius: 10px; text-align: center;">
          <div style="font-size: 80px; margin-bottom: 10px;">🔒</div>
          <p style="color: #666; font-size: 14px;">商品画像は公式サイトで<br>ご確認ください</p>
        </div>
      </div>
      
      <div style="flex: 1;">
        <h2 style="color: #333; margin-top: 0; font-size: 24px; line-height: 1.5;">${safeTitle}</h2>
        
        <table style="width: 100%; margin: 20px 0;">
          <tr>
            <td style="padding: 12px; background: #f8f8f8; width: 100px;">販売価格</td>
            <td style="padding: 12px; font-size: 24px; color: #ff6b6b; font-weight: bold;">
              ${priceFormatted}
              ${discountPercent > 0 ? `<span style="font-size: 14px; color: #28a745; margin-left: 10px;">（${discountPercent}%OFF）</span>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px; background: #f8f8f8;">ユーザー評価</td>
            <td style="padding: 12px;">
              <span style="color: #ffc107; font-size: 20px;">${ratingStars}</span>
              <span style="margin-left: 10px;">${rating}/5.0（${reviewCount}件）</span>
            </td>
          </tr>
          ${maker ? `
          <tr>
            <td style="padding: 12px; background: #f8f8f8;">メーカー</td>
            <td style="padding: 12px;">${maker}</td>
          </tr>` : ''}
        </table>
        
        <a href="${affiliateUrl}" target="_blank" rel="noopener noreferrer sponsored" style="display: block; padding: 18px; background: linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%); color: white; text-align: center; text-decoration: none; border-radius: 50px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 15px rgba(255,107,107,0.3); transition: transform 0.3s;">
          公式サイトで詳細を確認する →
        </a>
      </div>
    </div>
  </div>

  <!-- 注意事項 -->
  <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 20px; margin-bottom: 30px; border-radius: 5px;">
    <p style="margin: 0; color: #e65100;"><strong>⚠️ ご購入前の確認事項</strong></p>
    <p style="margin: 10px 0 0; color: #666;">本商品は年齢制限がある場合があります。必ず公式サイトで詳細をご確認の上、ご購入ください。</p>
  </div>

  <!-- CTA -->
  <div style="text-align: center; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 15px;">
    <h3 style="color: white; font-size: 24px; margin-bottom: 15px;">＼ 在庫残りわずか ／</h3>
    <p style="color: white; opacity: 0.9; margin-bottom: 25px;">人気商品のため、在庫がなくなり次第終了となります</p>
    <a href="${affiliateUrl}" target="_blank" rel="noopener noreferrer sponsored" style="display: inline-block; padding: 18px 50px; background: white; color: #764ba2; text-decoration: none; border-radius: 50px; font-size: 20px; font-weight: bold;">
      今すぐ公式サイトへ ≫
    </a>
  </div>
</div>`,
        category: 'レビュー',
        tags: [keyword, 'レビュー', '限定', '特価'],
        status: 'draft',
        isProductReview: true
      };
    }
    
    // 通常商品の場合：OpenAI APIで高品質記事生成
    console.log('Generating high-quality article with OpenAI...');
    
    const prompt = `
あなたはCVR30%以上を達成するプロのアフィリエイトライターです。
以下の商品について、購買意欲を最大化する詳細なレビュー記事を作成してください。

【商品データ】
タイトル: ${title}
価格: ${priceFormatted} ${discountPercent > 0 ? `（${discountPercent}%OFF）` : ''}
評価: ${rating}/5.0 (${reviewCount}件のレビュー)
メーカー: ${maker}
ジャンル: ${genre}
説明: ${description}

【必須要件】
1. 冒頭で緊急性を演出（期間限定、在庫限定など）
2. 実際に使用した体験談として書く（リアルな描写）
3. ビフォーアフターで変化を明確に
4. デメリットも1-2個正直に書いて信頼性向上
5. 他の類似商品2つと比較表を作成
6. よくある質問（FAQ）を5個以上
7. 複数箇所にCTAボタンを配置
8. 口コミ・レビューを3つ以上引用（創作OK）

【HTMLテンプレート】
必ず以下の構成で、5000文字以上のHTMLを生成してください：`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `あなたはCVR30%以上を達成する日本トップクラスのアフィリエイトライターです。
購買心理学、行動経済学、神経マーケティングの専門知識を持ち、読者の感情に訴えかける文章を書きます。
必ず指定されたHTML形式で、具体的で詳細な内容を含む記事を作成してください。`
        },
        {
          role: 'user',
          content: prompt + `

<div style="max-width: 900px; margin: 0 auto; padding: 20px; font-family: 'Noto Sans JP', sans-serif;">

  <!-- 緊急性バナー -->
  <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 15px; border-radius: 10px; text-align: center; margin-bottom: 25px; animation: pulse 2s infinite;">
    <p style="margin: 0; font-size: 16px; font-weight: bold;">⏰ 【緊急】本日23:59まで！特別キャンペーン実施中 ⏰</p>
  </div>

  <!-- ヒーローセクション -->
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 20px; margin-bottom: 30px;">
    <h1 style="font-size: 32px; margin-bottom: 20px; line-height: 1.5;">
      【購入者${reviewCount}名突破】${title.substring(0, 50)}...
    </h1>
    <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 20px;">
      <span style="font-size: 28px; color: #ffd700;">${ratingStars}</span>
      <span style="font-size: 24px;">${rating}/5.0</span>
      <span style="background: rgba(255,255,255,0.2); padding: 5px 15px; border-radius: 20px;">${reviewCount}件のレビュー</span>
    </div>
    <div style="display: flex; gap: 15px; align-items: center;">
      <span style="font-size: 32px; font-weight: bold;">${priceFormatted}</span>
      ${discountPercent > 0 ? `<span style="background: #ff6b6b; padding: 5px 15px; border-radius: 5px;">今だけ${discountPercent}%OFF</span>` : ''}
    </div>
    <a href="${affiliateUrl}" target="_blank" rel="noopener noreferrer sponsored" style="display: inline-block; margin-top: 25px; padding: 18px 50px; background: white; color: #764ba2; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 20px; box-shadow: 0 5px 20px rgba(0,0,0,0.2);">
      ＼ 今すぐ購入する ／
    </a>
  </div>

  <!-- 導入（感情に訴える） -->
  <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 3px 15px rgba(0,0,0,0.1); margin-bottom: 30px;">
    <h2 style="color: #333; border-bottom: 3px solid #667eea; padding-bottom: 10px;">なぜ私は${keyword}の中でこれを選んだのか？</h2>
    <p style="line-height: 1.8; font-size: 16px; margin-top: 20px;">
      <!-- ここに感情的な導入文を生成 -->
    </p>
  </div>

  <!-- ビフォーアフター -->
  <div style="margin-bottom: 30px;">
    <h2 style="text-align: center; color: #333; margin-bottom: 25px;">使用前後の変化</h2>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div style="background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); padding: 25px; border-radius: 15px;">
        <h3 style="color: #333; margin-top: 0;">😰 Before</h3>
        <ul style="line-height: 1.8;">
          <!-- ビフォーの悩みを生成 -->
        </ul>
      </div>
      <div style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); padding: 25px; border-radius: 15px;">
        <h3 style="color: #333; margin-top: 0;">😊 After</h3>
        <ul style="line-height: 1.8;">
          <!-- アフターの改善を生成 -->
        </ul>
      </div>
    </div>
  </div>

  <!-- 商品詳細 -->
  <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 3px 15px rgba(0,0,0,0.1); margin-bottom: 30px;">
    <h2 style="color: #333; border-bottom: 3px solid #667eea; padding-bottom: 10px;">商品の詳細スペック</h2>
    <div style="display: flex; gap: 30px; margin-top: 25px;">
      <div style="flex: 0 0 350px;">
        <img src="${imageUrl || 'https://placehold.jp/30/cccccc/ffffff/350x350.png?text=No+Image'}" alt="${title}" style="width: 100%; border-radius: 10px; box-shadow: 0 3px 10px rgba(0,0,0,0.1);">
      </div>
      <div style="flex: 1;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 15px; background: #f8f9fa; font-weight: bold; width: 120px;">商品名</td>
            <td style="padding: 15px;">${title}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 15px; background: #f8f9fa; font-weight: bold;">価格</td>
            <td style="padding: 15px; font-size: 20px; color: #e91e63; font-weight: bold;">${priceFormatted}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 15px; background: #f8f9fa; font-weight: bold;">評価</td>
            <td style="padding: 15px;"><span style="color: #ffd700; font-size: 18px;">${ratingStars}</span> ${rating}/5.0</td>
          </tr>
          ${maker ? `<tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 15px; background: #f8f9fa; font-weight: bold;">メーカー</td>
            <td style="padding: 15px;">${maker}</td>
          </tr>` : ''}
        </table>
        <a href="${affiliateUrl}" target="_blank" rel="noopener noreferrer sponsored" style="display: block; margin-top: 25px; padding: 15px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; text-align: center; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 18px;">
          詳細を確認して購入する →
        </a>
      </div>
    </div>
  </div>

  <!-- 3つの口コミ -->
  <div style="background: #f8f9fa; padding: 30px; border-radius: 15px; margin-bottom: 30px;">
    <h2 style="color: #333; text-align: center; margin-bottom: 25px;">実際の購入者の声</h2>
    <!-- 3つ以上の口コミを生成 -->
  </div>

  <!-- 比較表 -->
  <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 3px 15px rgba(0,0,0,0.1); margin-bottom: 30px;">
    <h2 style="color: #333; border-bottom: 3px solid #667eea; padding-bottom: 10px;">他商品との比較</h2>
    <!-- 比較表を生成 -->
  </div>

  <!-- FAQ -->
  <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 3px 15px rgba(0,0,0,0.1); margin-bottom: 30px;">
    <h2 style="color: #333; border-bottom: 3px solid #667eea; padding-bottom: 10px;">よくある質問</h2>
    <!-- 5個以上のFAQを生成 -->
  </div>

  <!-- 最終CTA -->
  <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 40px; border-radius: 20px; text-align: center;">
    <h2 style="color: white; font-size: 28px; margin-bottom: 15px;">今が購入のチャンス！</h2>
    <p style="color: white; font-size: 18px; margin-bottom: 25px;">在庫残りわずか・キャンペーンは今日まで</p>
    <a href="${affiliateUrl}" target="_blank" rel="noopener noreferrer sponsored" style="display: inline-block; padding: 20px 60px; background: white; color: #fa709a; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 22px; box-shadow: 0 5px 20px rgba(0,0,0,0.2);">
      最安値で購入する →
    </a>
  </div>

</div>`
        }
      ],
      temperature: 0.8,
      max_tokens: 4000
    });

    const generatedContent = completion.choices[0]?.message?.content || '';
    
    // タイトル最適化
    const optimizedTitle = `【${reviewCount}人が購入】${title.substring(0, 40)}...の詳細レビュー｜${keyword}`;
    
    return {
      title: optimizedTitle,
      content: generatedContent,
      category: 'レビュー',
      tags: [keyword, 'レビュー', '口コミ', '評判', '最安値', '比較', `${new Date().getFullYear()}年`],
      status: 'draft',
      isProductReview: true
    };
    
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
