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

  // WordPressに投稿（改良版）
  async postToWordPress(article) {
  try {
    console.log('📤 Posting to WordPress via XML-RPC...');
    
    // シンプルに必要な情報だけ取得
    const title = article.title || 'タイトルなし';
    const content = article.content || '<p>コンテンツなし</p>';
    const category = article.category || 'uncategorized';
    const tags = article.tags || [];
    
    console.log('Posting:', { title, contentLength: content.length });
    
    // XML-RPC用のシンプルなデータ構造
    const postData = {
      post_type: 'post',
      post_status: 'publish',
      post_title: title,  // そのまま送信
      post_content: content,  // そのまま送信
      post_author: 1,
      comment_status: 'open',
      ping_status: 'open'
    };
    
    // カテゴリーとタグを追加（オプション）
    if (category || tags.length > 0) {
      postData.terms_names = {};
      if (category) {
        postData.terms_names.category = [category];
      }
      if (tags.length > 0) {
        postData.terms_names.post_tag = tags.slice(0, 5);  // 5個まで
      }
    }
    
    console.log('Calling XML-RPC...');
    
    const result = await this.callXmlRpc('wp.newPost', [
      this.blogId,
      this.wordpressUsername,
      this.wordpressPassword,
      postData
    ]);
    
    console.log('✅ WordPress post created with ID:', result);
    
    return {
      success: true,
      postId: result,
      url: `${this.wordpressUrl}/?p=${result}`,
      message: 'Post created successfully'
    };
    
  } catch (error) {
    console.error('❌ WordPress Error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Failed to create post'
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

  // 商品レビュー記事生成（改良版）
  async generateProductReviewArticle(reviewData, options = {}) {
    try {
      console.log('🔍 Generating product review article...');
      console.log('Review data:', reviewData);
      console.log('Options:', options);
      
      // reviewDataから情報を取得（productDataとの互換性も保持）
      const productTitle = reviewData.title || reviewData.productTitle || options.title || '商品名';
      const description = reviewData.description || reviewData.content || '';
      const price = reviewData.price || reviewData.productPrice || '';
      const category = reviewData.category || options.category || 'レビュー';
      const rating = reviewData.rating || 4.0;
      const keyword = options.keyword || reviewData.keyword || productTitle;
      
      const prompt = `
商品レビュー記事を作成してください。

商品情報:
- 商品名: ${productTitle}
- 説明: ${description}
- 価格: ${price}
- カテゴリ: ${category}
- 評価: ${rating}/5.0
- キーワード: ${keyword}

要件:
1. HTML形式で出力（h2, h3, p, ul, li, strong, emタグのみ使用）
2. 1500-2000文字程度
3. DOCTYPEやhtmlタグは含めない（記事本文のみ）
4. コードブロックの記号は使わない
5. SEOを意識してキーワード「${keyword}」を自然に含める

構成:
<h2>はじめに</h2>
- 商品の簡単な紹介と購入のきっかけ

<h2>商品の特徴と詳細</h2>
- 主な特徴を箇条書きで
- 詳細な説明

<h2>実際に使ってみた感想</h2>
- 良かった点（h3タグ）
- 改善してほしい点（h3タグ）

<h2>こんな人におすすめ</h2>
- ターゲットユーザーの説明

<h2>まとめ</h2>
- 総合評価と購入の推奨

記事本文のHTMLのみを出力してください。`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "あなたは商品レビューの専門家です。実際に使用した経験に基づいた、信頼性の高いレビューを書きます。SEOを意識し、読者に価値のある情報を提供します。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 3000
      });

      let content = this.cleanHtmlContent(completion.choices[0]?.message?.content || '');
      
      // キーワード密度の最適化
      content = this.optimizeKeywordDensity(content, keyword);
      
      // タイトルの生成
      const title = options.title || `${productTitle}の詳細レビュー【${new Date().getFullYear()}年最新】`;
      
      console.log('✅ Product review article generated');
      console.log('Title:', title);
      console.log('Content length:', content.length);
      
      return {
        title: title,
        content: content,
        category: category,
        tags: [keyword, '商品レビュー', '最新', category, `評価${rating}`].filter(Boolean),
        status: 'publish',
        productInfo: {
          name: productTitle,
          price: price,
          rating: rating
        }
      };
      
    } catch (error) {
      console.error('❌ Error generating product review:', error);
      // エラーでも基本的なコンテンツを返す
      return {
        title: `${reviewData.title || 'エラー'}のレビュー`,
        content: '<p>記事の生成中にエラーが発生しました。しばらくしてからもう一度お試しください。</p>',
        category: 'エラー',
        tags: [],
        status: 'draft'
      };
    }
  }

  // タイトル生成（独立メソッド）
  async generateTitle(topic, keywords = []) {
    try {
      const prompt = `
以下のトピックとキーワードを使用して、魅力的でSEOに強いブログ記事のタイトルを1つ生成してください。

トピック: ${topic}
キーワード: ${keywords.join(', ')}

要件:
- 30-60文字程度
- クリックしたくなる魅力的な表現
- キーワードを自然に含める
- 日本語で出力

タイトルのみを出力してください。`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 100
      });

      return completion.choices[0]?.message?.content?.trim() || `${topic}について`;
      
    } catch (error) {
      console.error('Error generating title:', error);
      return `${topic}について`;
    }
  }

  // メタディスクリプション生成
  async generateMetaDescription(content, keywords = []) {
    try {
      const contentPreview = content.replace(/<[^>]*>/g, '').substring(0, 300);
      
      const prompt = `
以下の記事内容から、SEOに最適化されたメタディスクリプションを生成してください。

記事内容の要約:
${contentPreview}

キーワード: ${keywords.join(', ')}

要件:
- 120-160文字
- キーワードを含める
- クリック率を高める魅力的な文章
- 日本語で出力

メタディスクリプションのみを出力してください。`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      return completion.choices[0]?.message?.content?.trim() || '';
      
    } catch (error) {
      console.error('Error generating meta description:', error);
      return '';
    }
  }
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
