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

  // WordPressへの投稿（手動XML-RPC）
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
      const processedContent = sanitizeForXML(article.content || '<p>内容</p>');
      
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

  // 商品レビュー記事生成
  async generateProductReview(productData, keyword, options = {}) {
    try {
      console.log('🎯 Generating HIGH CVR product review article...');
      
      // より賢いアダルトコンテンツ検出
      const strongAdultKeywords = ['糞', '尿', '肉便器', '陵辱', '強姦', '犯す', 'ババア'];
      const mediumAdultKeywords = ['ちんこ', 'まんこ', 'ズポズポ', 'ヌルヌル', 'ビチャビチャ'];
      
      const originalTitle = productData.title || '';
      const originalDescription = productData.description || '';
      const genre = productData.genre || '';
      
      let isStrongAdult = strongAdultKeywords.some(word => 
        originalTitle.includes(word) || originalDescription.includes(word) || genre.includes(word)
      );
      
      let mediumCount = mediumAdultKeywords.filter(word => 
        originalTitle.includes(word) || originalDescription.includes(word) || genre.includes(word)
      ).length;
      
      const containsAdultContent = isStrongAdult || mediumCount >= 3;
      
      console.log('Adult content check:', containsAdultContent ? '⚠️ Detected' : '✅ Normal');
      
      // 商品データの準備
      const title = originalTitle.substring(0, 100);
      const price = productData.price || '';
      const affiliateUrl = productData.affiliateUrl || productData.url || '';
      const rating = parseFloat(productData.rating || '4.5');
      const reviewCount = productData.reviewCount || Math.floor(Math.random() * 500) + 100;
      const maker = productData.maker || '';
      const imageUrl = productData.imageUrl || productData.image || '';
      
      // 価格フォーマット
      const priceNum = price.replace(/[^0-9]/g, '');
      const priceFormatted = priceNum ? `¥${parseInt(priceNum).toLocaleString()}` : price;
      
      // 評価の星
      const ratingStars = '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
      
      // セーフテンプレート（過激なコンテンツ用）
      if (containsAdultContent) {
        console.log('Using safe template for adult content');
        
        const safeContent = `
<div style="max-width: 900px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%); color: white; padding: 30px; border-radius: 15px; text-align: center; margin-bottom: 30px;">
    <h2 style="font-size: 24px;">【限定商品】${keyword}カテゴリーの注目商品</h2>
    <p style="font-size: 18px; margin-top: 15px;">${ratingStars} ${rating}/5.0（${reviewCount}件）</p>
  </div>
  
  <div style="background: white; border: 2px solid #ff6b6b; padding: 30px; border-radius: 15px; margin-bottom: 30px;">
    <h3>${title.substring(0, 50)}...</h3>
    <p style="font-size: 24px; color: #ff6b6b; font-weight: bold; margin: 20px 0;">${priceFormatted}</p>
    <a href="${affiliateUrl}" target="_blank" rel="noopener noreferrer sponsored" style="display: inline-block; padding: 15px 40px; background: #ff6b6b; color: white; text-decoration: none; border-radius: 50px; font-weight: bold;">
      公式サイトで詳細を見る →
    </a>
  </div>
  
  <div style="background: #fff3e0; padding: 20px; border-radius: 10px; border-left: 4px solid #ff9800;">
    <p><strong>⚠️ ご注意</strong></p>
    <p>本商品は年齢制限がある場合があります。公式サイトで詳細をご確認ください。</p>
  </div>
</div>`;
        
        return {
          title: `【限定】${keyword}カテゴリー注目商品`,
          content: safeContent,
          category: 'レビュー',
          tags: [keyword, 'レビュー', '限定'],
          status: 'draft',
          isProductReview: true
        };
      }
      
      // 通常商品：OpenAI APIで記事生成
      console.log('Generating with OpenAI API...');
      
      try {
        // シンプルで確実なプロンプト
        const simplePrompt = `
以下の商品について、購買意欲を高める詳細なレビュー記事をHTML形式で作成してください。

商品名：${title}
価格：${priceFormatted}
評価：${rating}/5.0（${reviewCount}件）
メーカー：${maker}
キーワード：${keyword}

必ず以下の要素を含めてください：
1. 商品の特徴を3つ以上
2. メリットとデメリット
3. こんな人におすすめ（3パターン）
4. 購入者の声（3つ以上）
5. よくある質問（3つ以上）

2000文字以上の詳細な記事を作成してください。
HTMLタグは h2, h3, p, ul, li, div, table, tr, td, strong, span, a のみ使用。
アフィリエイトリンク（${affiliateUrl}）を複数箇所に配置してください。`;

        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'あなたは商品レビューの専門家です。購買意欲を高める魅力的な記事を書いてください。'
            },
            {
              role: 'user',
              content: simplePrompt
            }
          ],
          temperature: 0.7,
          max_tokens: 3000
        });
        
        let generatedContent = completion.choices[0]?.message?.content || '';
        
        console.log('OpenAI response length:', generatedContent.length);
        
        // コンテンツが短すぎる場合はフォールバック
        if (generatedContent.length < 500) {
          console.log('Content too short, using fallback template');
          generatedContent = this.generateFallbackContent(productData, keyword, priceFormatted, rating, reviewCount, affiliateUrl);
        }
        
        // 最適化されたタイトル
        const optimizedTitle = `【${reviewCount}人が購入】${title.substring(0, 40)}...の詳細レビュー｜${keyword}`;
        
        return {
          title: optimizedTitle,
          content: generatedContent,
          category: 'レビュー',
          tags: [keyword, 'レビュー', '口コミ', '評判', '最安値', '2025年'],
          status: 'draft',
          isProductReview: true
        };
        
      } catch (openaiError) {
        console.error('OpenAI API error:', openaiError);
        // OpenAIエラー時はフォールバックテンプレート使用
        const fallbackContent = this.generateFallbackContent(productData, keyword, priceFormatted, rating, reviewCount, affiliateUrl);
        
        return {
          title: `【話題】${title.substring(0, 40)}...のレビュー｜${keyword}`,
          content: fallbackContent,
          category: 'レビュー',
          tags: [keyword, 'レビュー', '商品'],
          status: 'draft',
          isProductReview: true
        };
      }
      
    } catch (error) {
      console.error('❌ Error in generateProductReview:', error);
      throw error;
    }
  }

  // フォールバックコンテンツ生成（OpenAI失敗時用）
  generateFallbackContent(productData, keyword, priceFormatted, rating, reviewCount, affiliateUrl) {
    const title = productData.title || '';
    const description = productData.description || '';
    const maker = productData.maker || '';
    const genre = productData.genre || '';
    const imageUrl = productData.imageUrl || '';
    const ratingStars = '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
    
    return `
<div style="max-width: 900px; margin: 0 auto; padding: 20px; font-family: 'Noto Sans JP', sans-serif;">
  
  <!-- ヒーローセクション -->
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 20px; margin-bottom: 30px; text-align: center;">
    <h1 style="font-size: 28px; margin-bottom: 20px;">${title}</h1>
    <div style="font-size: 24px; margin: 20px 0;">
      <span style="color: #ffd700;">${ratingStars}</span>
      <span>${rating}/5.0（${reviewCount}件のレビュー）</span>
    </div>
    <p style="font-size: 32px; font-weight: bold; margin: 20px 0;">${priceFormatted}</p>
    <a href="${affiliateUrl}" target="_blank" rel="noopener noreferrer sponsored" style="display: inline-block; margin-top: 20px; padding: 18px 50px; background: white; color: #764ba2; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 20px;">
      今すぐ購入する →
    </a>
  </div>
  
  <!-- 商品詳細 -->
  <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 3px 15px rgba(0,0,0,0.1); margin-bottom: 30px;">
    <h2 style="color: #333; border-bottom: 3px solid #667eea; padding-bottom: 10px; margin-bottom: 20px;">商品詳細情報</h2>
    
    <div style="display: flex; gap: 30px;">
      ${imageUrl ? `
      <div style="flex: 0 0 300px;">
        <img src="${imageUrl}" alt="${title}" style="width: 100%; border-radius: 10px;">
      </div>` : ''}
      
      <div style="flex: 1;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 15px; background: #f8f9fa; width: 120px; font-weight: bold;">商品名</td>
            <td style="padding: 15px;">${title}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 15px; background: #f8f9fa; font-weight: bold;">価格</td>
            <td style="padding: 15px; font-size: 20px; color: #e91e63; font-weight: bold;">${priceFormatted}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 15px; background: #f8f9fa; font-weight: bold;">評価</td>
            <td style="padding: 15px;">
              <span style="color: #ffd700; font-size: 18px;">${ratingStars}</span>
              ${rating}/5.0（${reviewCount}件）
            </td>
          </tr>
          ${maker ? `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 15px; background: #f8f9fa; font-weight: bold;">メーカー</td>
            <td style="padding: 15px;">${maker}</td>
          </tr>` : ''}
          ${genre ? `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 15px; background: #f8f9fa; font-weight: bold;">ジャンル</td>
            <td style="padding: 15px;">${genre}</td>
          </tr>` : ''}
        </table>
      </div>
    </div>
  </div>
  
  <!-- おすすめポイント -->
  <div style="background: #f8f9fa; padding: 30px; border-radius: 15px; margin-bottom: 30px;">
    <h2 style="color: #333; margin-bottom: 20px;">✨ この商品のおすすめポイント</h2>
    <ul style="line-height: 2; font-size: 16px;">
      <li>多くのユーザーから高評価を獲得（${rating}/5.0）</li>
      <li>${reviewCount}名以上の購入実績</li>
      <li>${keyword}カテゴリーで人気の商品</li>
      <li>信頼できるメーカー製品</li>
      <li>お求めやすい価格設定</li>
    </ul>
  </div>
  
  <!-- 購入者の声 -->
  <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 3px 15px rgba(0,0,0,0.1); margin-bottom: 30px;">
    <h2 style="color: #333; border-bottom: 3px solid #667eea; padding-bottom: 10px; margin-bottom: 20px;">購入者の声</h2>
    
    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 15px;">
      <div style="color: #ffd700; margin-bottom: 10px;">★★★★★</div>
      <p style="line-height: 1.8;">期待以上の品質でした。${keyword}関連の商品の中では最高レベルだと思います。</p>
      <p style="text-align: right; color: #666; font-size: 14px;">- 30代男性</p>
    </div>
    
    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 15px;">
      <div style="color: #ffd700; margin-bottom: 10px;">★★★★☆</div>
      <p style="line-height: 1.8;">コストパフォーマンスが良く、満足しています。リピート購入も検討中です。</p>
      <p style="text-align: right; color: #666; font-size: 14px;">- 20代女性</p>
    </div>
    
    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
      <div style="color: #ffd700; margin-bottom: 10px;">★★★★★</div>
      <p style="line-height: 1.8;">友人にもおすすめしたい商品です。この価格でこの品質は素晴らしい。</p>
      <p style="text-align: right; color: #666; font-size: 14px;">- 40代男性</p>
    </div>
  </div>
  
  <!-- FAQ -->
  <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 3px 15px rgba(0,0,0,0.1); margin-bottom: 30px;">
    <h2 style="color: #333; border-bottom: 3px solid #667eea; padding-bottom: 10px; margin-bottom: 20px;">よくある質問</h2>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #667eea;">Q. 送料はかかりますか？</h3>
      <p style="line-height: 1.8;">A. 送料については公式サイトでご確認ください。キャンペーン期間中は送料無料の場合があります。</p>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #667eea;">Q. 返品・交換は可能ですか？</h3>
      <p style="line-height: 1.8;">A. 商品の性質により異なります。詳細は公式サイトの返品ポリシーをご確認ください。</p>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #667eea;">Q. 支払い方法は何がありますか？</h3>
      <p style="line-height: 1.8;">A. クレジットカード、デビットカード、その他の支払い方法に対応しています。</p>
    </div>
  </div>
  
  <!-- 最終CTA -->
  <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 40px; border-radius: 20px; text-align: center;">
    <h2 style="color: white; font-size: 28px; margin-bottom: 15px;">今すぐ購入がおすすめ！</h2>
    <p style="color: white; font-size: 18px; margin-bottom: 25px;">在庫には限りがあります。お早めにご検討ください。</p>
    <a href="${affiliateUrl}" target="_blank" rel="noopener noreferrer sponsored" style="display: inline-block; padding: 20px 60px; background: white; color: #fa709a; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 22px;">
      公式サイトで購入する →
    </a>
  </div>
  
</div>`;
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
}  // BlogToolクラスの閉じ括弧

module.exports = BlogTool;
