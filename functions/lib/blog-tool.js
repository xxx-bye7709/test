// functions/lib/blog-tool.js - 完全版
const functions = require('firebase-functions');
const xmlrpc = require('xmlrpc');
const { OpenAI } = require('openai');
const { addOpenChatCTAToArticle } = require('./openchat-cta-generator');

class BlogTool {
  constructor(siteConfig = null) {
  const config = functions.config();
  
  if (siteConfig) {
    console.log('🎯 Using custom site config:', siteConfig.name);
    this.wordpressUrl = siteConfig.xmlrpcUrl || `${siteConfig.url}/xmlrpc.php`;
    this.wordpressUser = siteConfig.username;
    this.wordpressPassword = siteConfig.password;
    this.siteName = siteConfig.name;
    this.siteUrl = siteConfig.url;
    this.siteId = siteConfig.id || 'entamade_jp';  // ⚠️ ここが重要！idが渡されていない
    
    // DMM API設定（サイトごとに異なる場合）
    this.dmmApiKey = siteConfig.dmmApiKey || config.dmm?.api_key;
    this.dmmAffiliateId = siteConfig.dmmAffiliateId || config.dmm?.affiliate_id;
  } else {
    // デフォルト設定（既存のコード）
    console.log('🔍 Firebase config wordpress:', JSON.stringify(config.wordpress || {}, null, 2));
    
    this.wordpressUrl = config.wordpress?.url || 'https://www.entamade.jp';
    this.wordpressUser = config.wordpress?.username || 'entamade';
    this.wordpressPassword = config.wordpress?.password || 'IChL 1yMu 4OUF YpL6 Wz8d oxln';
    this.siteName = 'エンタメイド';
    this.siteUrl = 'https://www.entamade.jp';
    this.siteId = 'entamade_jp';
  }
  
  // OpenAI APIキーは共通
  this.openaiApiKey = config.openai?.api_key || process.env.OPENAI_API_KEY;
  
  // デバッグ：設定された値を確認
  console.log('📌 Set values:');
  console.log('- Site:', this.siteName || 'DEFAULT');
  console.log('- wordpressUrl:', this.wordpressUrl);
  console.log('- wordpressUser:', this.wordpressUser || 'UNDEFINED');
  console.log('- wordpressPassword:', this.wordpressPassword ? 'SET' : 'UNDEFINED');
  
  if (!this.openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }
  
  console.log('✅ BlogTool initialized successfully');
  console.log('WordPress URL:', this.wordpressUrl);
  
  this.openai = new OpenAI({
    apiKey: this.openaiApiKey
  });
  
  this.blogId = 1;
  
  // テンプレート定義（既存のまま）
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

  // ==========================================
// SEO最適化メソッド群
// ==========================================

// 1. SEOタイトル生成メソッド
async generateSEOTitle(category, keyword = null) {
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  
  console.log('🎯 Generating SEO optimized title for:', { category, keyword });
  
  // カテゴリー別のタイトルテンプレート
  const titleTemplates = {
    entertainment: [
      `【${year}年${month}月最新】注目の芸能ニュース${Math.floor(Math.random() * 5) + 5}選｜${keyword || 'トレンド'}まとめ`,
      `【速報】${keyword || '芸能界'}の最新情報${Math.floor(Math.random() * 3) + 3}つ｜${year}年${month}月版`,
      `${keyword || 'エンタメ'}業界の衝撃ニュースTOP${Math.floor(Math.random() * 3) + 5}【${year}年最新】`
    ],
    anime: [
      `【${year}年${month}月】今期アニメおすすめ${Math.floor(Math.random() * 5) + 10}選｜${keyword || '覇権'}作品徹底解説`,
      `【最新】${keyword || '人気アニメ'}ランキングTOP${Math.floor(Math.random() * 5) + 15}｜${year}年完全ガイド`,
      `${year}年注目の${keyword || 'アニメ'}作品${Math.floor(Math.random() * 5) + 5}選｜声優・放送情報まとめ`
    ],
    game: [
      `【${year}年${month}月】${keyword || '最新ゲーム'}攻略法${Math.floor(Math.random() * 3) + 5}選｜プロが教える必勝テク`,
      `【神ゲー】${year}年おすすめゲームTOP${Math.floor(Math.random() * 5) + 20}｜${keyword || 'ジャンル別'}完全ガイド`,
      `${keyword || 'ゲーム'}最強キャラランキング${Math.floor(Math.random() * 10) + 30}｜${year}年${month}月最新版`
    ],
    DMM: [
      `【${year}年${month}月】${keyword || 'DMM'}の注目作品${Math.floor(Math.random() * 5) + 10}選｜最新ランキング`,
      `${keyword || 'DMM'}おすすめ商品TOP${Math.floor(Math.random() * 10) + 20}【${year}年最新版】`,
      `【保存版】${keyword || 'DMM'}完全ガイド${year}｜人気作品まとめ`
    ]
  };

  // デフォルトテンプレート
  const defaultTemplates = [
    `【${year}年${month}月最新】${keyword || category}の注目情報${Math.floor(Math.random() * 5) + 5}選`,
    `${keyword || category}完全ガイド【${year}年版】おすすめTOP${Math.floor(Math.random() * 5) + 10}`,
    `【保存版】${year}年${keyword || category}まとめ｜最新トレンド解説`
  ];

  try {
    // カテゴリーに応じたテンプレートを選択
    const templates = titleTemplates[category] || defaultTemplates;
    const baseTemplate = templates[Math.floor(Math.random() * templates.length)];
    
    // GPT-5-miniでより洗練されたタイトルを生成
    const prompt = `
以下の条件でSEOに最適化された魅力的なブログタイトルを1つ生成してください：

【必須要件】
- 文字数: 32-40文字（全角換算）
- カテゴリー: ${category}
- キーワード: ${keyword || this.templates[category]?.topic || category}
- 年月: ${year}年${month}月を自然に含める

【タイトルに含めるべき要素】
1. 具体的な数字（5選、TOP10、${year}年など）
2. 感情に訴える言葉（衝撃、必見、神など）
3. ベネフィット（読者が得られる価値）
4. 【】や｜を使った視覚的な区切り

【参考テンプレート】
${baseTemplate}

タイトルのみを出力してください。`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: "あなたはSEOとコピーライティングの専門家です。日本のブログで高いクリック率を達成するタイトルを作成します。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_completion_tokens: 100
    });

    let title = completion.choices[0]?.message?.content?.trim() || baseTemplate;
    
    // 文字数調整
    title = this.adjustTitleLength(title);
    
    console.log('✅ SEO Title generated:', title);
    console.log('📏 Title length:', this.getFullWidthLength(title), 'characters');
    
    return title;
    
  } catch (error) {
    console.error('Error generating SEO title:', error);
    // フォールバック
    const templates = titleTemplates[category] || defaultTemplates;
    return templates[Math.floor(Math.random() * templates.length)];
  }
}

// 2. タイトル長調整メソッド
adjustTitleLength(title) {
  const targetMin = 32;
  const targetMax = 40;
  const currentLength = this.getFullWidthLength(title);
  
  if (currentLength > targetMax) {
    let truncated = '';
    let len = 0;
    for (let i = 0; i < title.length; i++) {
      const charLen = title.charCodeAt(i) > 255 ? 1 : 0.5;
      if (len + charLen > targetMax - 1.5) break;
      truncated += title[i];
      len += charLen;
    }
    return truncated + '…';
  }
  
  return title;
}

// 3. 全角換算の文字数カウント
getFullWidthLength(str) {
  let length = 0;
  for (let i = 0; i < str.length; i++) {
    length += str.charCodeAt(i) > 255 ? 1 : 0.5;
  }
  return Math.ceil(length);
}

// 4. SEO最適化されたタグ生成
generateSEOTags(keyword, category, title) {
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  
  // 基本タグ
  const tags = new Set([
    keyword,
    `${year}年`,
    `${year}年${month}月`,
    '最新情報',
    'まとめ'
  ]);
  
  // カテゴリー別の追加タグ
  const categoryTags = this.templates[category]?.tags || [];
  categoryTags.forEach(tag => tags.add(tag));
  
  // タイトルから重要な単語を抽出
  const titleWords = title
    .replace(/[【】\[\]（）\(\)｜\|]/g, ' ')
    .split(/[\s、。]/)
    .filter(word => word.length > 2)
    .filter(word => !['年', '月', '最新', 'まとめ', '選', 'TOP', 'ランキング'].includes(word));
  
  titleWords.forEach(word => tags.add(word));
  
  // 配列に変換して最大15個まで
  return Array.from(tags).filter(tag => tag).slice(0, 15);
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
      console.log('📤 Starting WordPress XML-RPC post...');
      
      const {
        title = '',
        content = '',
        category = 'uncategorized',
        tags = [],
        products = [],  // ⭐ productsを取得
        isProductReview = false,
        featuredImageUrl = null
      } = article;
      
      console.log('Article type:', isProductReview ? 'Product Review' : 'Regular Post');
      console.log('Content preview:', content.substring(0, 100));
      
      // XMLペイロード用のエスケープ（CDATAを使用）
      const escapeXML = (str) => {
        if (!str) return '';
        // XMLの特殊文字のみエスケープ（HTMLタグは保持）
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/'/g, '&apos;')
          .replace(/"/g, '&quot;');
      };
      
      const processedTitle = escapeXML(title).substring(0, 200);

      // ⭐ アイキャッチ画像のアップロード（250行目付近、xmlPayloadの前に追加）
      let featuredImageId = null;
      if (products[0]) {
        const imageUrl = products[0].imageUrl || products[0].imageURL?.large || products[0].imageURL?.small;
        if (imageUrl) {
          const uploadResult = await this.uploadImageToWordPress(imageUrl, `featured-${Date.now()}.jpg`);
          if (uploadResult) {
            featuredImageId = uploadResult.id;
          }
        }
      }

      // 261行目の } の後、262行目の // ⭐ カテゴリーの判定 の前に追加
      else if (article.featuredImageUrl) {
        console.log('📸 Uploading featured image for article...');
        const uploadResult = await this.uploadImageToWordPress(
          article.featuredImageUrl, 
          `article-featured-${Date.now()}.jpg`
        );
        if (uploadResult) {
          featuredImageId = uploadResult.id;
          console.log('✅ Featured image ID:', featuredImageId);
        }
      }

      // ⭐ カテゴリーの判定
      const categoryId = this.determineCategory(products, title);
      console.log(`📁 Category ID: ${categoryId}`);

      // ⭐ 既存のXML（253行目からのxmlPayload）を修正
      // post_thumbnailとtermsを追加

      // HTMLコンテンツはCDATAセクションで囲む
      const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>wp.newPost</methodName>
  <params>
    <param><value><int>1</int></value></param>
    <param><value><string>${this.wordpressUser}</string></value></param>
    <param><value><string>${this.wordpressPassword}</string></value></param>
    <param>
      <value>
        <struct>
          <member>
            <name>post_type</name>
            <value><string>post</string></value>
          </member>
          <member>
            <name>post_status</name>
            <value><string>publish</string></value>
          </member>
          <member>
            <name>post_title</name>
            <value><string>${processedTitle}</string></value>
          </member>
          <member>
            <name>post_content</name>
            <value><string><![CDATA[${content}]]></string></value>
          </member>
          <member>
            <name>post_author</name>
            <value><int>1</int></value>
          </member>
          ${featuredImageId ? `<member>
            <name>post_thumbnail</name>
            <value><int>${featuredImageId}</int></value>
          </member>` : ''}
          <member>
            <name>terms</name>
            <value>
              <struct>
                <member>
                  <name>category</name>
                  <value>
                    <array>
                      <data>
                        <value><int>${categoryId}</int></value>
                      </data>
                    </array>
                  </value>
                </member>
              </struct>
            </value>
          </member>
          <member>
            <name>terms_names</name>
            <value>
              <struct>
                <member>
                  <name>post_tag</name>
                  <value>
                    <array>
                      <data>
                        ${tags.map(tag => `<value><string>${escapeXML(tag)}</string></value>`).join('')}
                      </data>
                    </array>
                  </value>
                </member>
              </struct>
            </value>
          </member>
        </struct>
      </value>
    </param>
  </params>
</methodCall>`;
      
      console.log('XML payload size:', xmlPayload.length, 'bytes');
      console.log('Payload preview:', xmlPayload.substring(0, 500));
      
      const url = new URL(`${this.wordpressUrl}/xmlrpc.php`);
      
      return new Promise((resolve) => {
        const options = {
          hostname: url.hostname,
          port: 443,
          path: '/xmlrpc.php',
          method: 'POST',
          timeout: 30000,
          headers: {
            'Content-Type': 'text/xml; charset=UTF-8',
            'Content-Length': Buffer.byteLength(xmlPayload, 'utf8'),
            'User-Agent': 'WordPress XML-RPC Client'
          }
        };
        
        const req = https.request(options, (res) => {
          console.log('Response status:', res.statusCode);
          
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            console.log('Full XML response:', data);
            
            // faultチェック
            if (data.includes('<fault>')) {
              const faultMatch = data.match(/<faultCode>.*?<int>(\d+)<\/int>/);
              const faultCode = faultMatch ? faultMatch[1] : 'unknown';
              console.error('XML-RPC Fault:', faultCode);
              resolve({
                success: false,
                error: `Fault ${faultCode}`
              });
              return;
            }
            
            if (res.statusCode === 200) {
              // WordPress XML-RPCは通常<string>でIDを返す
              let postId = null;
              
              // パターン1: <string>ID</string>
              const stringMatch = data.match(/<methodResponse>[\s\S]*?<value>[\s\S]*?<string>(\d+)<\/string>/);
              if (stringMatch) postId = stringMatch[1];
              
              // パターン2: <int>ID</int>
              if (!postId) {
                const intMatch = data.match(/<methodResponse>[\s\S]*?<value>[\s\S]*?<int>(\d+)<\/int>/);
                if (intMatch) postId = intMatch[1];
              }
              
              // パターン3: シンプルなパターン
              if (!postId) {
                const simpleMatch = data.match(/<value><string>(\d+)<\/string><\/value>/);
                if (simpleMatch) postId = simpleMatch[1];
              }
              
              console.log('ID extraction results:', {
                found: !!postId,
                postId: postId
              });

              if (postId) {
            // Firestoreに投稿記録を保存（非同期だがawaitしない）
            const admin = require('firebase-admin');
            admin.firestore().collection('generatedArticles').add({
              title: title,
              postId: postId,
              postUrl: `${this.siteUrl || this.wordpressUrl}/?p=${postId}`,
              targetSite: this.siteId || 'entamade_jp',  // constructorで設定されたsiteId
              siteName: this.siteName || 'エンタメイド',  // constructorで設定されたsiteName
              siteUrl: this.siteUrl || this.wordpressUrl,
              category: category,
              tags: tags,
              isProductReview: isProductReview,
              featuredImageId: featuredImageId,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            }).then(() => {
              console.log(`📝 Article recorded in Firestore for site: ${this.siteName}`);
            }).catch(err => {
              console.error('Failed to save to Firestore:', err);
            });
          }
              
              resolve({
                success: true,
                postId: postId,
                url: postId ? `${this.wordpressUrl}/?p=${postId}` : this.wordpressUrl,
                message: postId ? 'Posted successfully' : 'Posted but ID not captured'
              });
            } else {
              resolve({
                success: false,
                error: `HTTP ${res.statusCode}`
              });
            }
          });
        });
        
        req.on('timeout', () => {
          console.error('Request timeout');
          req.destroy();
          resolve({ success: false, error: 'Timeout' });
        });
        
        req.on('error', (e) => {
          console.error('Request error:', e.message);
          resolve({ success: false, error: e.message });
        });
        
        req.write(xmlPayload);
        req.end();
      });
      
    } catch (error) {
      console.error('❌ Error:', error);
      return { success: false, error: error.message };
    }
  }

  // generateWithGPTメソッドを修正
async generateWithGPT(category, template) {
  try {
    const categoryData = this.templates[category] || this.templates.entertainment;
    
    // 現在の日付を取得
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    
    const prompt = `
現在は${year}年${month}月です。
${categoryData.topic}について、${year}年${month}月時点の最新情報や話題を含む魅力的なブログ記事を作成してください。

要件:
1. 1500-2000文字程度
2. HTML形式（h2, h3, p, ul, li, strong, emタグのみ使用）
3. DOCTYPEやhtmlタグは含めない（記事本文のみ）
4. コードブロックの記号（\`\`\`）は使わない
5. SEOを意識した構成
6. 読者の興味を引く内容
7. ${year}年の具体的な情報を含める
8. 「${year}年」という表記を適切に使用する

構成:
- 導入部分（なぜ今この話題が重要か）
- メイントピック3つ（それぞれh2タグ）
- 各トピックに具体例や詳細情報
- まとめ（今後の展望）

記事本文のHTMLのみを出力してください。`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-5-mini",
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
      max_completion_tokens: 3000
    });

    const content = this.cleanHtmlContent(completion.choices[0]?.message?.content || '');
    console.log('✅ Content generated via GPT');
    return content;
    
  } catch (error) {
    console.error('❌ Error generating with GPT:', error);
    throw error;
  }
}

// メタディスクリプション生成（新規追加）
generateMetaDescription(title, keyword) {
  const year = new Date().getFullYear();
  const templates = [
    `${title}を徹底解説。${keyword}の最新情報を${year}年版でお届け。今すぐチェックして最新トレンドを把握しましょう。`,
    `【${year}年最新】${keyword}について詳しく解説。${title}の全情報をまとめました。必見の内容です。`,
    `${keyword}の決定版ガイド。${title}を完全網羅。${year}年の最新情報満載でお届けします。`
  ];
  
  const description = templates[Math.floor(Math.random() * templates.length)];
  return description.substring(0, 155); // 155文字以内
}

  // 記事生成（カテゴリー別）
  async generateArticle(category = 'entertainment', options = {}) {
  try {
    console.log(`🚀 Generating ${category} article with SEO optimization...`);
    
    // キーワードの抽出または設定
    const keyword = options.keyword || 
                    this.templates[category]?.topic?.split('、')[0] || 
                    category;
    
    // ★ 新しいSEOタイトル生成を使用
    const title = await this.generateSEOTitle(category, keyword);
    
    // GPTでコンテンツ生成（既存のメソッドを使用）
    const content = await this.generateWithGPT(category, options.template);
    
    console.log('✅ Article generated successfully');
    console.log('📌 Title:', title);
    console.log('🔑 Focus Keyword:', keyword);
    console.log('📄 Content length:', content.length);
    
    // 画像生成（既存のコード）
    let finalContent = content;
    let featuredImageUrl = null;
    
    // 画像生成を有効化（デフォルトは有効）
    if (options.generateImage !== false) {
      try {
        const ImageGenerator = require('./image-generator');
        const imageGen = new ImageGenerator(this.openaiApiKey);
        
        // タイトルを基にした画像プロンプト
        const imagePrompt = `Professional blog header image for ${category} article: "${title}". Modern, vibrant, high quality, digital art style, no text.`;
        
        console.log('🎨 Generating featured image...');
        featuredImageUrl = await imageGen.generateImage(imagePrompt, '1792x1024', 'standard');
        
        if (featuredImageUrl) {
          console.log('✅ Featured image generated');
          const imageHtml = `<div style="text-align: center; margin: 20px 0;">
<img src="${featuredImageUrl}" alt="${title}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
</div>\n\n`;
          finalContent = imageHtml + content;
        }
      } catch (imageError) {
        console.error('⚠️ Image generation failed, continuing without image:', imageError.message);
      }
    }
    
    // ★ SEO最適化されたタグを生成
    const optimizedTags = this.generateSEOTags(keyword, category, title);
    
    return {
      title: title,
      content: finalContent,
      keyword: keyword,  // ★ キーワードを追加
      category: category,
      tags: optimizedTags,
      status: options.status || 'publish',
      featuredImageUrl: featuredImageUrl,
      seoData: {  // ★ SEOデータを追加
        focusKeyphrase: keyword,
        metaDescription: this.generateMetaDescription(title, keyword),
        titleLength: this.getFullWidthLength(title)
      }
    };
    
  } catch (error) {
    console.error('❌ Error generating article:', error);
    throw error;
  }
}
    
    // GPTで本文生成
    const content = await this.generateWithGPT(category, options.template);
    
    // タイトル生成
    const categoryData = this.templates[category] || this.templates.entertainment;
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    
    const titlePrompt = `
    現在は${year}年${month}月です。
    「${categoryData.topic}」について、${year}年のSEOに強い魅力的な記事タイトルを1つ生成してください。
    要件：
    - 30-50文字程度
    - 「${year}年${month}月」を含める
    - キャッチーで興味を引く
    - 具体的な内容を示唆する
    タイトルのみを出力してください。`;
    
    const titleCompletion = await this.openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "user",
          content: titlePrompt
        }
      ],
      max_completion_tokens: 100
    });
    const title = titleCompletion.choices[0]?.message?.content?.trim() || `${category}の最新情報`;
    
    console.log('✅ Article generated successfully');
    console.log('Title:', title);
    console.log('Content length:', content.length);
    
    // ===== 画像生成を追加（ここから） =====
    let finalContent = content;
    let featuredImageUrl = null;
    
    // 画像生成を有効にする（デフォルトは有効）
    if (true) {
      try {
        const ImageGenerator = require('./image-generator');
        const imageGen = new ImageGenerator(this.openaiApiKey);
        
        // カテゴリーに応じた画像プロンプト
        const imagePrompt = `Professional blog header image for ${category} article: "${title}". Modern, vibrant, high quality, digital art style, no text.`;
        
        console.log('🎨 Generating featured image...');
        featuredImageUrl = await imageGen.generateImage(imagePrompt, '1792x1024', 'standard');
        
        if (featuredImageUrl) {
          console.log('✅ Featured image generated');
          // 記事の先頭に画像を挿入
          const imageHtml = `<div style="text-align: center; margin: 20px 0;">
<img src="${featuredImageUrl}" alt="${title}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
</div>\n\n`;
          finalContent = imageHtml + content;
        }
      } catch (imageError) {
        console.error('⚠️ Image generation failed, continuing without image:', imageError.message);
        // 画像生成に失敗しても記事投稿は続行
      }
    }
    // ===== 画像生成を追加（ここまで） =====
    
    return {
      title: title,
      content: finalContent,  // contentをfinalContentに変更
      category: category,
      tags: this.optimizeTags([], category),
      status: options.status || 'publish',
      featuredImageUrl: featuredImageUrl  // 画像URLも返す
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
      console.log('Product data received:', JSON.stringify(productData, null, 2));
      
      // 複数商品の処理
      const products = Array.isArray(productData) ? productData : [productData];
      console.log(`Processing ${products.length} products`);
      
      // アダルト検出
      const strongAdultKeywords = ['糞', '尿', '肉便器', '陵辱', '強姦', '犯す', 'ロリ'];
      const mediumAdultKeywords = ['ちんこ', 'まんこ', 'ズコズコ', 'ヌルヌル', 'ビチャビチャ'];
      
      let isExtremeContent = false;
      for (const product of products) {
        const title = product.title || '';
        const description = product.description || '';
        
        const strongCount = strongAdultKeywords.filter(word => 
          title.includes(word) || description.includes(word)
        ).length;
        
        const mediumCount = mediumAdultKeywords.filter(word => 
          title.includes(word) || description.includes(word)
        ).length;
        
        if (strongCount >= 1 || mediumCount >= 3) {
          isExtremeContent = true;
          break;
        }
      }
      
      console.log(`Adult content check: ${isExtremeContent ? '⚠️ Extreme' : '✅ Normal'}`);
      
      // 通常コンテンツの場合（OpenAI API使用）
      if (!isExtremeContent) {
        console.log('Generating with OpenAI API...');
        
        // 複数商品の情報をプロンプトに含める
        const productsInfo = products.map((p, i) => `
商品${i + 1}:
- 商品名: ${p.title || 'おすすめ商品'}
- 価格: ${p.price || p.prices?.price || '価格不明'}
- 評価: ${p.rating || p.review?.average || '4.5'}
- 説明: ${p.description || ''}
`).join('\n');
        
        const prompt = `
あなたはCVR30%以上を達成するプロのアフィリエイトマーケターです。
以下の${products.length}個の商品を紹介する魅力的なレビュー記事を作成してください。

【商品情報】
${productsInfo}

【必須要件】
1. 購買心理学を活用（限定性、社会的証明）
2. 記事は2000文字以上
3. HTMLで装飾（h2, h3, p, ul, li, strong, emタグ使用）
4. 具体的な商品の魅力を伝える
5. SEOキーワード「${keyword}」を自然に使用

HTMLタグを使用して視覚的に魅力的な記事を生成してください。
コードブロックマーカー（\`\`\`）は使用しないでください。
最後に不要な説明文は付けないでください。
`;
        
        // OpenAI API呼び出し
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-5-mini',
          messages: [
            {
              role: 'system',
              content: 'あなたはプロのアフィリエイトマーケターです。魅力的な商品レビュー記事を作成します。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_completion_tokens: 4000
        });
        
        console.log('OpenAI response length:', completion.choices[0].message.content.length);

        // completionからcontentを取得してクリーンアップ
let content = completion.choices[0].message.content || '';

// クリーンアップ処理
content = content
  .replace(/```html\s*\n?/gi, '')
  .replace(/```\s*\n?/gi, '')
  .replace(/\*\*この.*?ください。?\*\*/gi, '')
  .replace(/このHTML.*?ください。?/gi, '')
  .replace(/このコード.*?ください。?/gi, '')
  .replace(/ぜひご活用ください。?/gi, '')
  .replace(/上記.*?ください。?/gi, '')
  .replace(/以上.*?ください。?/gi, '')
  .replace(/以下.*?活用.*?。?/gi, '')
  .replace(/\n{3,}/g, '\n\n')
  .replace(/^\s*$/gm, '')
  .trim();

// ★★★ contentが定義された後に商品セクションを追加 ★★★
const productsSectionHTML = `
<h2 style="margin-top: 40px; color: #333;">📦 紹介商品詳細</h2>
<div class="products-gallery">
${products.map((product, index) => {
  const imageUrl = product.imageUrl || product.imageURL || product.image || '';
  const affiliateUrl = product.affiliateUrl || product.affiliateURL || product.url || '#';
  const price = product.price || product.prices?.price || '価格不明';
  
  return `
<div style="margin: 30px 0; padding: 25px; border: 2px solid #4CAF50; border-radius: 12px; background: #f9f9f9;">
  <h3 style="color: #2c3e50; font-size: 1.3em; margin-bottom: 15px;">
    【商品${index + 1}】${product.title || '商品名'}
  </h3>
  
  ${imageUrl ? `
  <div style="text-align: center; margin: 20px 0;">
    <img src="${imageUrl}" 
         alt="${product.title || '商品画像'}" 
         style="max-width: 100%; max-height: 400px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
  </div>
  ` : ''}
  
  <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
    <p style="font-size: 1.4em; color: #e74c3c; font-weight: bold; margin: 10px 0;">
      💰 価格: ${price}
    </p>
  </div>
  
  <div style="text-align: center; margin-top: 25px;">
    <a href="${affiliateUrl}" 
       target="_blank" 
       rel="noopener noreferrer"
       style="display: inline-block; 
              padding: 15px 50px; 
              background: linear-gradient(45deg, #4CAF50, #45a049); 
              color: white; 
              text-decoration: none; 
              border-radius: 50px; 
              font-size: 1.1em; 
              font-weight: bold;">
      🛒 詳細を見る・購入する
    </a>
  </div>
</div>
`;
}).join('\n')}
</div>
<!-- 商品ギャラリー終了 -->
`;

// ★★★ 修正箇所：不要な</div>を削除し、明確な区切りを追加 ★★★
content = content + '\n\n' + productsSectionHTML + `
<!-- ========== 商品エリア完全終了 ========== -->
<div style="clear: both; display: block; height: 100px; width: 100%;"></div>
<!-- ========== 以下、オープンチャットCTAエリア ========== -->
`;

// タイトル生成（既存のコード）
const reviewCount = products[0].reviewCount || products[0].review?.count || '364';
        const title = products.length > 1 ? 
          `【${products.length}選】${keyword}のおすすめ商品を徹底比較！${new Date().getFullYear()}年最新版` :
          `【${reviewCount}人が購入】${products[0].title?.substring(0, 30)}...の詳細レビュー｜${keyword}`;
        
        console.log('Article generated successfully');
        console.log('💬 オープンチャットCTAを追加');
        console.log('CTA追加前のコンテンツ長:', content.length);
        const contentWithCTA = addOpenChatCTAToArticle(content);
        console.log('CTA追加後のコンテンツ長:', contentWithCTA.length);
        console.log('差分:', contentWithCTA.length - content.length);
        
        return {
          title: title,
          content: contentWithCTA, 
          category: 'レビュー',
          tags: [keyword, 'レビュー', '比較', 'おすすめ', `${new Date().getFullYear()}年`],
          status: 'draft',
          isProductReview: true,
          products: products  // ⭐ これを追加
        };
      }
      
      // 過激なコンテンツの場合（セーフテンプレート）
      console.log('Using safe template for extreme content');
      const safeContent = `
<div style="max-width: 900px; margin: 0 auto; padding: 20px;">
  <h2>【${keyword}】カテゴリーの人気商品</h2>
  
  <div style="background: #fff3cd; padding: 20px; border-radius: 10px; margin: 20px 0;">
    <p>⚠️ この商品は年齢確認が必要な商品です。詳細は公式サイトでご確認ください。</p>
  </div>
  
  ${products.map((product, index) => `
  <div style="border: 1px solid #ddd; padding: 20px; margin: 20px 0; border-radius: 10px;">
    <h3>商品${index + 1}</h3>
    <p>価格: ${product.price || '価格不明'}</p>
  </div>`).join('')}
</div>`;

      const safeContentWithCTA = addOpenChatCTAToArticle(safeContent);
      
      return {
        title: `【${keyword}】人気商品まとめ`,
        content: safeContentWithCTA,  // ← safeContent を safeContentWithCTA に変更
        category: 'レビュー',
        tags: [keyword, 'まとめ'],
        status: 'draft',
        isProductReview: true,
        products: products  // ⭐ これを追加
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

  async uploadImageToWordPress(imageUrl, filename = 'product-image.jpg') {
    if (!imageUrl || imageUrl === '') {
      console.log('No image URL provided');
      return null;
    }

    try {
      console.log(`📸 Uploading image: ${imageUrl}`);
      const fetch = require('node-fetch');
      
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        console.error('Failed to fetch image');
        return null;
      }

      const imageBuffer = await imageResponse.buffer();
      const base64Image = imageBuffer.toString('base64');

      const uploadXml = `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>wp.uploadFile</methodName>
  <params>
    <param><value><int>1</int></value></param>
    <param><value><string>${this.wordpressUser}</string></value></param>
    <param><value><string>${this.wordpressPassword}</string></value></param>
    <param>
      <value>
        <struct>
          <member>
            <name>name</name>
            <value><string>${filename}</string></value>
          </member>
          <member>
            <name>type</name>
            <value><string>image/jpeg</string></value>
          </member>
          <member>
            <name>bits</name>
            <value><base64>${base64Image}</base64></value>
          </member>
        </struct>
      </value>
    </param>
  </params>
</methodCall>`;

      const response = await fetch(`${this.wordpressUrl}/xmlrpc.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'Content-Length': Buffer.byteLength(uploadXml)
        },
        body: uploadXml
      });

      const responseText = await response.text();
      const idMatch = responseText.match(/<member><name>id<\/name><value><(?:int|string)>(\d+)<\/(?:int|string)>/);
      
      if (idMatch) {
        console.log(`✅ Image uploaded: ID=${idMatch[1]}`);
        return { id: parseInt(idMatch[1]) };
      }
      
      return null;
    } catch (error) {
      console.error('Image upload error:', error);
      return null;
    }
  }

  determineCategory(products, title = '') {
  const categoryMap = {
    'entamade_jp': {
      'anime': 2,
      'book': 8, 
      'comic': 9,
      'FANZA': 15,
      'products': 182,
      'R18': 11,
      'アニメ': 66,
      'エンタメ': 17,
      'グルメ': 153,
      'ゲーム': 80,
      'コミック': 10,
      'テクノロジー': 106,
      '映画': 51,
      '美容': 32,
      '自己啓発': 169,
      '音楽': 121
    },
    'GameinfoRuka_JP': {
      'DMM': 20,
      'anime': 35,
      'game': 36,
      'コミック': 22,
      'default': 20  // デフォルト追加
    },
    'honlove_JP': {
      'entertainment': 7,
      'anime': 8,
      'game': 9,
      'book': 2,
      'コミック': 10,
      'default': 7  // デフォルト追加
    },
    'AnimeBook_JP': {
      'entertainment': 6,
      'anime': 7,
      'game': 8,
      'book': 2,
      'movie': 9,
      'default': 6  // デフォルト追加
    }
  };
  
  // 現在のサイトのカテゴリーマップを取得
  const siteCategories = categoryMap[this.siteId] || categoryMap['entamade_jp'];
  console.log(`📁 Using category map for site: ${this.siteId || 'entamade_jp'}`);
  
  // タイトルとproductsからテキストを作成
  const text = (title + ' ' + products.map(p => p.title || '').join(' ')).toLowerCase();
  
  // カテゴリー判定（サイトごとのマップを使用）
  if (text.includes('アニメ') || text.includes('anime')) {
    return siteCategories['anime'] || siteCategories['アニメ'] || siteCategories['default'] || 1;
  }
  if (text.includes('ゲーム') || text.includes('game')) {
    return siteCategories['game'] || siteCategories['ゲーム'] || siteCategories['default'] || 1;
  }
  if (text.includes('映画') || text.includes('movie')) {
    return siteCategories['movie'] || siteCategories['映画'] || siteCategories['default'] || 1;
  }
  if (text.includes('本') || text.includes('book')) {
    return siteCategories['book'] || siteCategories['default'] || 1;
  }
  if (text.includes('コミック') || text.includes('comic')) {
    return siteCategories['comic'] || siteCategories['コミック'] || siteCategories['default'] || 1;
  }
  if (text.includes('アイドル') || text.includes('idol')) {
    return siteCategories['idol'] || siteCategories['アイドル'] || siteCategories['default'] || 1;
  }
  if (text.includes('グラビア') || text.includes('gravure')) {
    return siteCategories['gravure'] || siteCategories['グラビア'] || siteCategories['default'] || 1;
  }
  if (text.includes('アダルト') || text.includes('adult')) {
    return siteCategories['R18'] || siteCategories['R18'] || siteCategories['default'] || 1;
  }
  
  // デフォルトカテゴリーを返す
  return siteCategories['default'] || siteCategories['エンタメ'] || siteCategories['entertainment'] || 1;
}

}

module.exports = BlogTool;





