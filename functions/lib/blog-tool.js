const functions = require('firebase-functions');
const xmlrpc = require('xmlrpc');
const { OpenAI } = require('openai');

class BlogTool {
  constructor() {
    const config = functions.config();
    
    // デバッグ：設定値を確認
    console.log('🔍 Firebase config wordpress:', JSON.stringify(config.wordpress || {}, null, 2));
    
    // Firebase configから直接取得（process.envは使わない）
    this.wordpressUrl = config.wordpress?.url || 'https://www.entamade.jp';
    this.wordpressUser = config.wordpress?.username;  // ← process.envを削除
    this.wordpressPassword = config.wordpress?.password;  // ← process.envを削除
    this.openaiApiKey = config.openai?.api_key || process.env.OPENAI_API_KEY;
    
    // デバッグ：設定された値を確認
    console.log('📌 Set values:');
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
      console.log('📤 Starting WordPress XML-RPC post...');
      
      const {
        title = '',
        content = '',
        category = 'uncategorized',
        tags = [],
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
          <member>
            <name>terms_names</name>
            <value>
              <struct>
                <member>
                  <name>category</name>
                  <value>
                    <array>
                      <data>
                        <value><string>${category}</string></value>
                      </data>
                    </array>
                  </value>
                </member>
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
          model: 'gpt-4o-mini',
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
          temperature: 0.7,
          max_tokens: 4000
        });
        
        console.log('OpenAI response length:', completion.choices[0].message.content.length);
        
        // completionからcontentを取得してクリーンアップ
        let content = completion.choices[0].message.content || '';
        
        // クリーンアップ処理
        content = content
          // HTMLコードブロックマーカーを削除
          .replace(/```html\s*\n?/gi, '')
          .replace(/```\s*\n?/gi, '')
          // 不要な説明文を削除
          .replace(/\*\*この.*?ください。?\*\*/gi, '')
          .replace(/このHTML.*?ください。?/gi, '')
          .replace(/このコード.*?ください。?/gi, '')
          .replace(/ぜひご活用ください。?/gi, '')
          .replace(/上記.*?ください。?/gi, '')
          .replace(/以上.*?ください。?/gi, '')
          .replace(/以下.*?活用.*?。?/gi, '')
          // 連続する改行を2つまでに制限
          .replace(/\n{3,}/g, '\n\n')
          // 空白のみの行を削除
          .replace(/^\s*$/gm, '')
          // 最初と最後の空白を削除
          .trim();
        
        // タイトル生成
        const reviewCount = products[0].reviewCount || products[0].review?.count || '364';
        const title = products.length > 1 ? 
          `【${products.length}選】${keyword}のおすすめ商品を徹底比較！${new Date().getFullYear()}年最新版` :
          `【${reviewCount}人が購入】${products[0].title?.substring(0, 30)}...の詳細レビュー｜${keyword}`;
        
        console.log('Article generated successfully');
        
        return {
          title: title,
          content: content,
          category: 'レビュー',
          tags: [keyword, 'レビュー', '比較', 'おすすめ', `${new Date().getFullYear()}年`],
          status: 'draft',
          isProductReview: true
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
      
      return {
        title: `【${keyword}】人気商品まとめ`,
        content: safeContent,
        category: 'レビュー',
        tags: [keyword, 'まとめ'],
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
}  // BlogToolクラスの閉じ括弧

module.exports = BlogTool;
