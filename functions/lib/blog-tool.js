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

    // この関数は不要になったのでコメントアウト
     /*
    // XML-RPCクライアントの設定（修正版）
    if (this.wordpressUrl) {
      const url = new URL(this.wordpressUrl);
      this.client = xmlrpc.createClient({
        host: url.hostname,
        port: url.port || 443,
        path: '/xmlrpc.php',
        secure: url.protocol === 'https:',
        headers: {
          'User-Agent': 'BlogTool/1.0',
          'Content-Type': 'text/xml'  // charset指定を削除
        },
        encoding: 'utf8'  // エンコーディングを明示
      });
    }
    */

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

  // この関数は不要になったのでコメントアウト
/*
  // XML-RPC呼び出し（UTF-8対応）
  async callXmlRpc(methodName, params) {
    return new Promise((resolve, reject) => {
      console.log(`📤 Calling XML-RPC method: ${methodName}`);
      
      // パラメータの確認（デバッグ用）
      if (methodName === 'wp.newPost' && params[3]) {
        console.log('Post title:', params[3].post_title);
        console.log('Content length:', params[3].post_content?.length);
      }
      
      this.client.methodCall(methodName, params, (error, value) => {
        if (error) {
          console.error(`❌ XML-RPC Error calling ${methodName}:`, error);
          console.error('Error details:', error.message);
          reject(error);
        } else {
          console.log(`✅ XML-RPC Success: ${methodName}`, value);
          resolve(value);
        }
      });
    });
  }
  */

  // lib/blog-tool.js のpostToWordPress関数を条件分岐版に修正
async postToWordPress(article) {
  try {
    // 商品レビュー記事かどうかを判定（カテゴリーやタグで判断）
    const isProductReview = article.category === 'レビュー' || 
                           article.tags?.includes('レビュー') ||
                           article.isProductReview === true;
    
    // 投稿ステータスを決定
    const postStatus = isProductReview ? 'draft' : 'publish';
    
    console.log(`📤 Posting to WordPress as ${postStatus.toUpperCase()} via XML-RPC...`);
    console.log('Article type:', isProductReview ? 'Product Review' : 'Regular Post');
    
    // XML-RPCクライアントの確認
    if (!this.client) {
      const url = new URL(this.wordpressUrl);
      this.client = xmlrpc.createClient({
        host: url.hostname,
        port: url.port || 443,
        path: '/xmlrpc.php',
        secure: url.protocol === 'https:'
      });
    }
    
    // タイトルと本文のサニタイズ（XML特殊文字対策）
    const sanitizeForXML = (str) => {
      return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // 制御文字を除去
    };
    
    // タイトルの処理（長さ制限も追加）
    const processedTitle = sanitizeForXML(article.title || 'タイトルなし').substring(0, 150);
    const processedContent = sanitizeForXML(article.content || '<p>コンテンツなし</p>');
    
    console.log(`Creating ${postStatus} post with title:`, processedTitle.substring(0, 50) + '...');
    
    // metaWeblog.newPost用のデータ構造（よりシンプル）
    const blogContent = {
      title: processedTitle,
      description: processedContent,
      mt_keywords: article.tags?.join(', ') || '',
      post_status: postStatus,
      categories: ['Uncategorized']
    };
    
    return new Promise((resolve) => {
      // metaWeblog.newPostを使用（wp.newPostよりも互換性が高い）
      this.client.methodCall(
        'metaWeblog.newPost',
        [
          '1', // blog_id（文字列として）
          this.wordpressUsername,
          this.wordpressPassword,
          blogContent,
          postStatus === 'publish' // publishフラグ
        ],
        (error, value) => {
          if (error) {
            console.error('XML-RPC Error:', error);
            
            // エラー時のフォールバック：wp.newPostを試す
            console.log('Trying wp.newPost as fallback...');
            
            const wpPostData = {
              post_type: 'post',
              post_status: postStatus,
              post_title: processedTitle,
              post_content: processedContent,
              post_category: [1],
              post_format: 'standard',
              comment_status: 'open',
              ping_status: 'open'
            };
            
            if (article.tags && article.tags.length > 0) {
              wpPostData.mt_keywords = article.tags.join(', ');
            }
            
            this.client.methodCall(
              'wp.newPost',
              [
                0,
                this.wordpressUsername,
                this.wordpressPassword,
                wpPostData
              ],
              (error2, value2) => {
                if (error2) {
                  console.error('wp.newPost also failed:', error2);
                  resolve({
                    success: false,
                    error: 'Both XML-RPC methods failed',
                    message: `${postStatus}投稿に失敗しました`
                  });
                } else {
                  console.log(`✅ ${postStatus === 'draft' ? 'Draft' : 'Post'} created via wp.newPost with ID:`, value2);
                  
                  const postUrl = isProductReview
                    ? `${this.wordpressUrl}/wp-admin/post.php?post=${value2}&action=edit`
                    : `${this.wordpressUrl}/?p=${value2}`;
                  
                  resolve({
                    success: true,
                    postId: value2,
                    url: postUrl,
                    status: postStatus,
                    message: isProductReview 
                      ? '下書きとして保存されました。管理画面で確認してください。'
                      : '記事が公開されました。'
                  });
                }
              }
            );
          } else {
            console.log(`✅ ${postStatus === 'draft' ? 'Draft' : 'Post'} created with ID:`, value);
            
            const postUrl = isProductReview
              ? `${this.wordpressUrl}/wp-admin/post.php?post=${value}&action=edit`
              : `${this.wordpressUrl}/?p=${value}`;
            
            resolve({
              success: true,
              postId: value,
              url: postUrl,
              status: postStatus,
              message: isProductReview 
                ? '下書きとして保存されました。管理画面で確認してください。'
                : '記事が公開されました。'
            });
          }
        }
      );
    });
    
  } catch (error) {
    console.error('❌ Exception in postToWordPress:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
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
      console.log(`🔍 Generating ${category} article...`);
      
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

  // lib/blog-tool.js のgenerateProductReview関数にフィルタリングを追加
async generateProductReview(productData, keyword, options = {}) {
  try {
    console.log('🎯 Generating product review article...');
    console.log('Product data received:', JSON.stringify(productData, null, 2));
    
    // アダルトコンテンツの検出（より包括的なキーワードリスト）
    const adultKeywords = [
      '18禁', 'R18', 'アダルト', '成人向け', 'AV',
      'セックス', 'SEX', 'エロ', '素人', 'ナンパ',
      'おっぱい', '巨乳', '痴女', '熟女', '人妻',
      '中出し', 'フェラ', '潮吹き', 'ハメ', 'オナニー',
      '借金返済', '肉体', '混浴', 'ぶっかけ', '不倫'
    ];
    
    // タイトルと説明文をチェック
    const originalTitle = productData.title || '';
    const originalDescription = productData.description || '';
    
    const containsAdultContent = adultKeywords.some(word => 
      originalTitle.toLowerCase().includes(word.toLowerCase()) ||
      originalDescription.toLowerCase().includes(word.toLowerCase()) ||
      (productData.genre && productData.genre.toLowerCase().includes(word.toLowerCase()))
    );
    
    if (containsAdultContent) {
      console.log('⚠️ Adult content detected - generating sanitized version');
    }
    
    // 商品データの処理
    let title = originalTitle;
    let description = originalDescription;
    let imageUrl = productData.imageUrl || productData.image || '';
    const price = productData.price || '';
    const affiliateUrl = productData.affiliateUrl || productData.url || '';
    const rating = productData.rating || '';
    const category = productData.category || 'レビュー';
    
    // アダルトコンテンツの場合の処理
    if (containsAdultContent) {
      // タイトルをサニタイズ（最初の20文字 + 省略記号）
      title = originalTitle.split(/[！。、]/)[0].substring(0, 20) + '...';
      description = '商品の詳細は公式ページでご確認ください';
      imageUrl = ''; // アダルト画像は表示しない
      
      // シンプルなHTMLを直接生成（OpenAI APIを使わない）
      const sanitizedContent = `
<div style="border: 2px solid #4CAF50; border-radius: 10px; padding: 20px; margin: 20px 0; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);">
  <h2 style="color: #333; margin-top: 0;">商品情報</h2>
  <div style="margin: 15px 0;">
    <p style="font-size: 18px; color: #666;">評価: ${rating ? `★ ${rating}` : '評価情報なし'}</p>
    <p style="font-size: 20px; font-weight: bold; color: #FF5722;">価格: ${price}</p>
  </div>
  ${affiliateUrl ? `
  <a href="${affiliateUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 25px; font-weight: bold; margin-top: 15px;">
    ▶ 詳細を見る
  </a>` : ''}
</div>

<h2>商品について</h2>
<p>こちらは${keyword}カテゴリーの商品です。</p>
<p>多くのお客様から高い評価をいただいている商品となっております。</p>

<h3>特徴</h3>
<ul>
  <li>高品質な商品内容</li>
  <li>お求めやすい価格設定</li>
  <li>安心の品質保証</li>
</ul>

<h3>ご購入にあたって</h3>
<p>商品の詳細情報については、上記のリンクから公式ページをご確認ください。</p>
<p>※ 本商品は成人向けコンテンツを含む可能性があります。18歳未満の方はご利用いただけません。</p>

<div style="text-align: center; margin: 30px 0; padding: 20px; background: #FFF3E0; border-radius: 10px;">
  <p style="font-size: 16px; color: #E65100; margin-bottom: 15px;">商品の詳細はこちら</p>
  ${affiliateUrl ? `
  <a href="${affiliateUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); color: white; text-decoration: none; border-radius: 25px; font-size: 16px; font-weight: bold;">
    公式ページへ ≫
  </a>` : ''}
</div>
`;
      
      // サニタイズされたタイトルで返す
      const sanitizedTitle = `商品レビュー【${keyword}】`;
      
      return {
        title: sanitizedTitle,
        content: sanitizedContent,
        category: 'レビュー',
        tags: [keyword, 'レビュー', '商品'],
        status: 'draft',
        isProductReview: true
      };
    }
    
    // 通常の商品の場合（アダルトコンテンツではない）
    console.log('Generating normal product review with OpenAI...');
    
    // プロンプトを改善（商品情報を必ず含める）
    const prompt = `
あなたはプロの商品レビュー記者です。以下の商品について、魅力的で詳細なレビュー記事を作成してください。

【商品情報】
- 商品名: ${title}
- 価格: ${price}
- 説明: ${description}
- 評価: ${rating}
- カテゴリー: ${category}
- キーワード: ${keyword}

【必須要件】
1. 記事の冒頭に必ず以下のHTML形式で商品情報ボックスを配置してください：

<div style="border: 2px solid #4CAF50; border-radius: 10px; padding: 20px; margin: 20px 0; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);">
  <h2 style="color: #333; margin-top: 0;">${title}</h2>
  ${imageUrl ? `<img src="${imageUrl}" alt="${title}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 15px 0;">` : ''}
  <div style="display: flex; align-items: center; margin: 15px 0;">
    <span style="font-size: 24px; font-weight: bold; color: #FF5722;">価格: ${price}</span>
    ${rating ? `<span style="margin-left: 20px; color: #FFC107;">★ ${rating}</span>` : ''}
  </div>
  ${description ? `<p style="color: #666; line-height: 1.6;">${description}</p>` : ''}
  ${affiliateUrl ? `
  <a href="${affiliateUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 25px; font-weight: bold; margin-top: 15px;">
    ▶ 詳細を見る・購入はこちら
  </a>` : ''}
</div>

2. 記事本文（1500文字以上）に以下を含めてください：
   - 商品の特徴を3つ以上詳しく説明
   - 実際の使用シーンや体験談
   - メリットとデメリット
   - こんな人におすすめ（3パターン以上）
   - まとめ

3. SEO最適化：
   - キーワード「${keyword}」を自然に含める
   - 見出しタグ（h2, h3）を適切に使用

【出力形式】
- HTML形式で出力
- 商品情報ボックスは必ず記事の最初に配置
`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'あなたは経験豊富な商品レビュー専門のライターです。読者の購買意欲を高める魅力的な記事を書きます。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });

    const content = completion.choices[0]?.message?.content || '';
    console.log('Generated content length:', content.length);
    
    // タイトルの最適化
    const optimizedTitle = `${title}の詳細レビュー【2025年最新】${keyword}`;
    
    return {
      title: optimizedTitle,
      content: content,
      category: 'レビュー',
      tags: this.generateTags(keyword, category, title),
      status: 'draft',
      isProductReview: true
    };
    
  } catch (error) {
    console.error('❌ Error in generateProductReview:', error);
    throw error;
  }
}

// タグ生成の改善（変更なし）
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

// BlogAutomationToolのエイリアス（互換性のため）
class BlogAutomationTool extends BlogTool {
  constructor() {
    super();
    console.log('BlogAutomationTool initialized (alias for BlogTool)');
  }
}

module.exports = BlogTool;
module.exports.BlogAutomationTool = BlogAutomationTool;
