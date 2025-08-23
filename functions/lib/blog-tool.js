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

  // postToWordPress関数を直接XML-RPC版に置き換え
async postToWordPress(article) {
  try {
    console.log('📤 Posting to WordPress via direct XML-RPC...');
    
    const fetch = require('node-fetch');
    
    // 記事データを取得
    const title = article.title || 'タイトルなし';
    const content = article.content || '<p>コンテンツなし</p>';
    const category = article.category || 'uncategorized';
    const tags = article.tags || [];
    const status = article.status || 'publish';
    
    console.log('Post details:', {
      title: title,
      contentLength: content?.length,
      category: category
    });
    
    // XMLをエスケープ
    const escapeXml = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };
    
    // タイトルとコンテンツを処理
    const processedTitle = this.optimizeTitle(title, category);
    const cleanContent = this.sanitizeContent(content);
    
    // XML-RPCリクエストを構築
    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>wp.newPost</methodName>
  <params>
    <param><value><int>1</int></value></param>
    <param><value><string>${escapeXml(this.wordpressUsername)}</string></value></param>
    <param><value><string>${escapeXml(this.wordpressPassword)}</string></value></param>
    <param>
      <value>
        <struct>
          <member>
            <name>post_type</name>
            <value><string>post</string></value>
          </member>
          <member>
            <name>post_status</name>
            <value><string>${status}</string></value>
          </member>
          <member>
            <name>post_title</name>
            <value><string>${escapeXml(processedTitle)}</string></value>
          </member>
          <member>
            <name>post_content</name>
            <value><string>${escapeXml(cleanContent)}</string></value>
          </member>
          <member>
            <name>post_author</name>
            <value><int>1</int></value>
          </member>
          <member>
            <name>comment_status</name>
            <value><string>open</string></value>
          </member>
        </struct>
      </value>
    </param>
  </params>
</methodCall>`;

    console.log('Sending request to:', this.wordpressUrl + '/xmlrpc.php');
    
    const response = await fetch(this.wordpressUrl + '/xmlrpc.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        'Accept': 'text/xml'
      },
      body: xmlRequest
    });
    
    const responseText = await response.text();
    console.log('WordPress response:', responseText.substring(0, 200));
    
    // postIdを抽出
    const postIdMatch = responseText.match(/<string>(\d+)<\/string>/);
    
    if (postIdMatch) {
      const postId = postIdMatch[1];
      console.log('✅ WordPress post created with ID:', postId);
      
      return {
        success: true,
        postId: postId,
        url: `${this.wordpressUrl}/?p=${postId}`,
        message: 'Post created successfully'
      };
    } else {
      // エラーをチェック
      const faultMatch = responseText.match(/<faultString>(.*?)<\/faultString>/s);
      if (faultMatch) {
        throw new Error('XML-RPC Fault: ' + faultMatch[1]);
      }
      throw new Error('Unexpected response from WordPress');
    }
    
  } catch (error) {
    console.error('❌ Error posting to WordPress:', error);
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

  // lib/blog-tool.js のgenerateProductReview関数を以下に完全置き換え
async generateProductReview(productData, keyword, options = {}) {
  try {
    console.log('🎯 Generating product review article...');
    console.log('Product data received:', JSON.stringify(productData, null, 2));
    
    // 商品データの展開（ダッシュボードからのデータ構造に対応）
    const title = productData.title || 'レビュー商品';
    const description = productData.description || '';
    const price = productData.price || '';
    const imageUrl = productData.imageUrl || productData.image || '';
    const affiliateUrl = productData.affiliateUrl || productData.url || '';
    const rating = productData.rating || '';
    const features = productData.features || '';
    const category = productData.category || 'レビュー';
    
    console.log('Extracted product info:', {
      title, price, imageUrl, affiliateUrl, rating
    });

    // プロンプトを改善（商品情報を必ず含める）
    const prompt = `
あなたはプロの商品レビュー記者です。以下の商品について、魅力的で詳細なレビュー記事を作成してください。

【商品情報】
- 商品名: ${title}
- 価格: ${price}
- 説明: ${description}
- 評価: ${rating}
- 特徴: ${features}
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
  <a href="${affiliateUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 25px; font-weight: bold; margin-top: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
    ▶ 詳細を見る・購入はこちら
  </a>` : ''}
</div>

2. 記事本文（1500文字以上）に以下を含めてください：
   - 商品の特徴を3つ以上詳しく説明
   - 実際の使用シーンや体験談（具体的に）
   - メリットとデメリット
   - こんな人におすすめ（3パターン以上）
   - 競合商品との比較
   - まとめと購入をおすすめする理由

3. 記事の最後にも購入リンクを配置：
${affiliateUrl ? `
<div style="text-align: center; margin: 30px 0; padding: 20px; background: #FFF3E0; border-radius: 10px;">
  <p style="font-size: 18px; color: #E65100; margin-bottom: 15px;">＼ 今すぐチェック ／</p>
  <a href="${affiliateUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); color: white; text-decoration: none; border-radius: 30px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 15px rgba(255,107,107,0.3);">
    ${title}の詳細はこちら ≫
  </a>
</div>` : ''}

4. SEO最適化：
   - キーワード「${keyword}」を自然に5回以上含める
   - 見出しタグ（h2, h3）を適切に使用
   - 段落を適切に分ける

【出力形式】
- HTML形式で出力
- 商品情報ボックスは必ず記事の最初に配置
- styleタグはインラインで記述
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
      category: category,
      tags: this.generateTags(keyword, category, title),
      status: 'publish'
    };
    
  } catch (error) {
    console.error('❌ Error in generateProductReview:', error);
    throw error;
  }
}

// タグ生成の改善
generateTags(keyword, category, productTitle) {
  const tags = [keyword, category];
  
  // 商品名から重要な単語を抽出
  const words = productTitle.split(/[\s　,、。！？]/);
  words.forEach(word => {
    if (word.length > 2 && !tags.includes(word)) {
      tags.push(word);
    }
  });
  
  // 一般的なタグも追加
  tags.push('レビュー', '2025年', 'おすすめ');
  
  return tags.slice(0, 10); // 最大10個まで
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
