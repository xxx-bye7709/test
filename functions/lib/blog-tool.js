// functions/lib/blog-tool.js
// WordPress自動投稿システム - SEO最適化完全版

const axios = require('axios');
const OpenAI = require('openai');

// 品質設定
const QUALITY_CONFIG = {
  minLength: 2500,
  maxRetries: 3,
  gptModel: 'gpt-4o-mini',
  temperature: 0.8,
  maxTokens: 4000,
  categoryTopics: {
    anime: ['フリーレン', '薬屋のひとりごと', '呪術廻戦3期', 'ダンジョン飯', '推しの子2期'],
    game: ['パルワールド', 'ドラゴンズドグマ2', 'ヘルダイバーズ2', 'FF7リバース', '原神4.5'],
    movie: ['デューン砂の惑星2', 'ゴジラ-1.0', 'オッペンハイマー', '君たちはどう生きるか'],
    music: ['YOASOBI', 'Ado', 'NewJeans', 'King Gnu', '米津玄師'],
    tech: ['Apple Vision Pro', 'Claude 3', 'Sora AI', 'Gemini', 'メタバース'],
    beauty: ['レチノール', 'CICA', '韓国コスメ', 'ヴィーガンコスメ', 'メンズメイク'],
    food: ['台湾カステラ', 'マリトッツォ', 'プロテイン食品', '昆虫食', '代替肉'],
    entertainment: ['紅白歌合戦', 'M-1グランプリ', '芸能スキャンダル', 'YouTube', 'TikTok'],
    selfhelp: ['リスキリング', 'FIRE', 'メンタルヘルス', 'ワークライフバランス', 'AI活用']
  }
};

class BlogAutomationTool {
  constructor() {
    // OpenAI設定
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }

    // WordPress設定
    this.wpUrl = process.env.WORDPRESS_URL || process.env.WP_URL || 'https://www.entamade.jp';
    this.wpUsername = process.env.WORDPRESS_USERNAME || process.env.WP_USERNAME || 'entamade';
    this.wpPassword = process.env.WORDPRESS_PASSWORD || process.env.WP_PASSWORD || '';
    
    const credentials = Buffer.from(`${this.wpUsername}:${this.wpPassword}`).toString('base64');
    this.authHeader = `Basic ${credentials}`;

    // オプショナルモジュール
    try {
      const DMMIntegration = require('./dmm-integration');
      this.dmmIntegration = new DMMIntegration();
      this.enableDMM = process.env.ENABLE_DMM === 'true' || false;
    } catch (error) {
      console.log('DMM統合は無効です');
      this.enableDMM = false;
    }

    try {
      const ImageGenerator = require('./image-generator');
      this.imageGenerator = new ImageGenerator();
    } catch (error) {
      console.log('画像生成モジュールが見つかりません');
    }

    try {
      const templates = require('./templates');
      this.templates = templates;
    } catch (error) {
      console.log('テンプレートモジュールが見つかりません');
    }
    
    this.lastAPICall = 0;
    this.minTimeBetweenCalls = 3000;
  }

  /**
   * 製品レビュー記事を生成（新規追加メソッド）
   */
  async generateProductReviewArticle(reviewData, options = {}) {
    try {
      console.log('🔍 Generating product review article');
      
      // レビューデータの検証
      if (!reviewData) {
        reviewData = {
          title: 'テスト商品',
          description: '商品の説明',
          price: '価格未定',
          category: 'general',
          maker: 'メーカー未設定'
        };
      }

      const title = options.title || `${reviewData.title}の詳細レビュー【${new Date().getFullYear()}年最新】`;
      
      const content = `
        <div class="product-review">
          <h2>はじめに</h2>
          <p>今回は、<strong>${reviewData.title}</strong>について詳しくレビューしていきます。
          ${reviewData.description || '優れた製品として注目を集めている商品です。'}</p>
          
          <h2>商品概要</h2>
          <p>${reviewData.title}は、${reviewData.category || 'カテゴリ'}における注目の商品です。</p>
          
          <table class="product-details">
            <tr>
              <th>商品名</th>
              <td>${reviewData.title}</td>
            </tr>
            <tr>
              <th>価格</th>
              <td>${reviewData.price || '価格未定'}</td>
            </tr>
            <tr>
              <th>カテゴリ</th>
              <td>${reviewData.category || 'general'}</td>
            </tr>
            <tr>
              <th>メーカー</th>
              <td>${reviewData.maker || 'メーカー未設定'}</td>
            </tr>
            ${reviewData.rating ? `
            <tr>
              <th>評価</th>
              <td>${this.generateStarRating(reviewData.rating)}</td>
            </tr>` : ''}
          </table>
          
          <h3>主な特徴</h3>
          <ul>
            ${(reviewData.features || ['高品質', '使いやすい', 'コスパが良い']).map(f => `<li>${f}</li>`).join('')}
          </ul>
          
          <h3>メリット</h3>
          <ul>
            ${(reviewData.pros || ['品質が高い', '価格が手頃', 'デザインが優れている']).map(p => `<li>✅ ${p}</li>`).join('')}
          </ul>
          
          <h3>デメリット</h3>
          <ul>
            ${(reviewData.cons || ['在庫が限られている', '配送に時間がかかる場合がある']).map(c => `<li>⚠️ ${c}</li>`).join('')}
          </ul>
          
          <h2>詳細レビュー</h2>
          <p>${reviewData.detailed_review || `${reviewData.title}を実際に使用してみた感想をお伝えします。
          まず、品質については期待以上のものでした。${reviewData.category || 'この分野'}の製品として、
          十分な機能性と耐久性を備えています。`}</p>
          
          <p>価格面では${reviewData.price || '適正価格'}となっており、
          同カテゴリの他製品と比較しても競争力があります。
          特に${reviewData.features ? reviewData.features[0] : '品質の高さ'}という点で優れています。</p>
          
          <h2>こんな人におすすめ</h2>
          <ul>
            <li>${reviewData.category || 'この分野'}に興味がある方</li>
            <li>品質重視で商品を選びたい方</li>
            <li>コストパフォーマンスを重視する方</li>
            ${reviewData.target_audience ? reviewData.target_audience.map(t => `<li>${t}</li>`).join('') : ''}
          </ul>
          
          <h2>総評</h2>
          <p>${reviewData.review_summary || `${reviewData.title}は、総合的に見て優れた製品です。
          ${reviewData.category || 'カテゴリ'}の中でも特に注目すべき商品と言えるでしょう。`}</p>
          
          ${reviewData.affiliate_url ? `
          <div class="purchase-button">
            <p><a href="${reviewData.affiliate_url}" class="btn-purchase" target="_blank" rel="nofollow noopener">
              ▶ 商品の詳細を見る
            </a></p>
          </div>` : ''}
          
          <h2>よくある質問</h2>
          <div class="faq-section">
            <h3>Q: ${reviewData.title}の価格は？</h3>
            <p>A: ${reviewData.price || '価格については販売ページでご確認ください。'}</p>
            
            <h3>Q: どんな特徴がありますか？</h3>
            <p>A: ${(reviewData.features || ['高品質', '使いやすい']).join('、')}などが主な特徴です。</p>
            
            <h3>Q: 保証期間はありますか？</h3>
            <p>A: ${reviewData.warranty || 'メーカー保証については販売元にお問い合わせください。'}</p>
          </div>
        </div>
        
        <style>
          .product-review { max-width: 800px; margin: 0 auto; padding: 20px; }
          .product-details { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .product-details th { background: #f0f0f0; padding: 10px; text-align: left; width: 30%; }
          .product-details td { padding: 10px; border-bottom: 1px solid #ddd; }
          .btn-purchase { 
            display: inline-block; 
            padding: 15px 30px; 
            background: #ff6b6b; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px; 
            font-weight: bold; 
          }
          .btn-purchase:hover { background: #ff5252; }
          .faq-section { margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px; }
          @media (max-width: 768px) { 
            .product-details th { width: 40%; }
          }
        </style>
      `;
      
      // SEO最適化
      const focusKeyword = options.keyword || reviewData.title || 'レビュー';
      const optimizedContent = this.enhancedSEOOptimization(content, focusKeyword, 'review', title);
      
      return {
        title,
        content: optimizedContent,
        focusKeyword,
        metaDescription: this.generateSEOMetaDescription(optimizedContent, focusKeyword, title),
        category: reviewData.category || 'review',
        tags: [focusKeyword, 'レビュー', reviewData.category, reviewData.maker].filter(Boolean),
        excerpt: `${reviewData.title}の詳細レビュー。${reviewData.description || '特徴、メリット・デメリットを徹底解説。'}`
      };
      
    } catch (error) {
      console.error('Error generating product review article:', error);
      
      // エラー時でも基本的な記事を生成
      return {
        title: reviewData?.title || options?.title || 'Product Review',
        content: `
          <h2>商品レビュー</h2>
          <p>${reviewData?.title || '商品'}のレビューです。</p>
          <h3>商品情報</h3>
          <ul>
            <li>商品名: ${reviewData?.title || '不明'}</li>
            <li>価格: ${reviewData?.price || '価格未定'}</li>
            <li>カテゴリ: ${reviewData?.category || '未分類'}</li>
          </ul>
          <h3>特徴</h3>
          <p>${reviewData?.description || '詳細情報は準備中です。'}</p>
        `,
        focusKeyword: options?.keyword || 'review',
        metaDescription: `${reviewData?.title || '商品'}のレビュー`,
        category: reviewData?.category || 'review',
        tags: ['レビュー'],
        excerpt: 'Product review'
      };
    }
  }

  /**
   * 星評価を生成
   */
  generateStarRating(rating) {
    if (!rating) return '評価なし';
    
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5 ? 1 : 0;
    const emptyStars = 5 - fullStars - halfStar;
    
    let stars = '';
    for (let i = 0; i < fullStars; i++) stars += '⭐';
    if (halfStar) stars += '✨';
    for (let i = 0; i < emptyStars; i++) stars += '☆';
    
    return `${stars} (${rating}/5.0)`;
  }

  /**
   * 強化版SEO最適化メソッド
   */
  enhancedSEOOptimization(content, keyword, category, title) {
    console.log(`🔍 Enhanced SEO Optimization for keyword: "${keyword}"`);
    
    // キーワード最適化
    content = this.ensureKeywordInFirstParagraph(content, keyword);
    content = this.optimizeKeywordDensity(content, keyword);
    content = this.optimizeHeadings(content, keyword);
    content = this.optimizeImageAlt(content, keyword, title);
    
    // リンク最適化
    content = this.ensureExternalLinks(content, category, keyword);
    content = this.addInternalLinks(content, category);
    
    // 可読性向上
    content = this.shortenSentences(content);
    
    this.reportSEOStatus(content, keyword);
    
    return content;
  }

  /**
   * 第一段落にキーワードを確実に含める
   */
  ensureKeywordInFirstParagraph(content, keyword) {
    const firstParagraphRegex = /<p>([^<]+)<\/p>/;
    const match = content.match(firstParagraphRegex);
    
    if (match && !match[1].toLowerCase().includes(keyword.toLowerCase())) {
      console.log('⚠️ キーワードが第一段落にありません。追加します...');
      const newFirstParagraph = `<p>今回は、${keyword}について詳しく解説します。${match[1]}</p>`;
      content = content.replace(match[0], newFirstParagraph);
      console.log('✅ キーワードを第一段落に追加しました');
    }
    
    return content;
  }

  /**
   * キーワード密度を最適化
   */
  optimizeKeywordDensity(content, keyword) {
    // constをletに変更（これが重要）
    let currentCount = (content.match(new RegExp(keyword, 'gi')) || []).length;
    console.log(`📊 現在のキーワード出現回数: ${currentCount}回`);
    
    if (currentCount < 5) {
      const needed = 5 - currentCount;
      console.log(`⚠️ キーワードが不足しています。${needed}回追加します...`);
      
      const sections = content.split(/<\/h[23]>/);
      
      for (let i = 0; i < sections.length && currentCount < 5; i++) {
        if (!sections[i].includes(keyword)) {
          const paragraphs = sections[i].split('</p>');
          if (paragraphs.length > 1) {
            const midIndex = Math.floor(paragraphs.length / 2);
            paragraphs[midIndex] = paragraphs[midIndex].replace(
              /<p>([^<]+)/,
              `<p>$1 ${keyword}の観点から見ると、`
            );
            sections[i] = paragraphs.join('</p>');
            currentCount++;  // ここでcurrentCountを増やしている
          }
        }
      }
      
      content = sections.join('</h3>').replace(/<\/h3><\/h3>/g, '</h3>');
      console.log('✅ キーワード密度を最適化しました');
    }
    
    return content;
  }

  // 既存のメソッドをそのまま維持
  async generateArticle(category = 'entertainment', options = {}) {
    try {
      console.log(`📝 ${category}カテゴリーの記事を生成中...`);
      
      const template = this.getTemplate(category);
      const article = await this.generateWithGPT(category, template);
      
      const focusKeyword = article.tags[0] || this.getCategoryName(category);
      
      console.log(`🔍 強化版SEO最適化を適用中... キーワード: ${focusKeyword}`);
      article.content = this.enhancedSEOOptimization(
        article.content, 
        focusKeyword, 
        category,
        article.title
      );
      
      article.metaDescription = this.generateSEOMetaDescription(
        article.content,
        focusKeyword,
        article.title
      );
      
      article.focusKeyword = focusKeyword;
      
      console.log(`✅ SEO最適化完了: キーワード「${focusKeyword}」`);
      
      return article;
      
    } catch (error) {
      console.error('記事生成エラー:', error);
      throw error;
    }
  }

  async postToWordPress(article) {
    try {
      console.log('📤 WordPressに投稿中...');
      console.log('WordPress URL:', this.wpUrl);
      
      if (!this.wpUrl || !this.wpUsername || !this.wpPassword) {
        console.warn('WordPress credentials not configured');
        return { success: false, message: 'WordPress not configured' };
      }
      
      // XML-RPCを使用
      const xmlRequest = this.createWordPressXML(article);
      
      const response = await axios.post(
        `${this.wpUrl}/xmlrpc.php`,
        xmlRequest,
        {
          headers: {
            'Content-Type': 'text/xml',
            'Authorization': this.authHeader
          }
        }
      );

      console.log('WordPress Response Status:', response.status);

      let postId = null;
      
      if (typeof response.data === 'string') {
        const stringMatch = response.data.match(/<string>(\d+)<\/string>/);
        if (stringMatch) {
          postId = stringMatch[1];
          console.log('✅ Post ID:', postId);
        }
        
        const faultMatch = response.data.match(/<fault>/);
        if (faultMatch) {
          const errorMatch = response.data.match(/<name>faultString<\/name>\s*<value><string>(.*?)<\/string>/);
          const errorMessage = errorMatch ? errorMatch[1] : 'Unknown WordPress error';
          throw new Error(errorMessage);
        }
      }

      if (postId && parseInt(postId) > 0) {
        console.log(`✅ 投稿成功！ Post ID: ${postId}`);
        return {
          success: true,
          postId,
          url: `${this.wpUrl}/?p=${postId}`
        };
      } else {
        throw new Error('有効な投稿IDを取得できませんでした');
      }
      
    } catch (error) {
      console.error('WordPress投稿エラー:', error.message);
      return { success: false, error: error.message };
    }
  }

  // XML作成関数も必要
  createWordPressXML(article) {
    const { title = 'No Title', content = '', tags = [], category = 'general' } = article;
    
    const tagsXML = tags.map(tag => 
      `<value><string>${this.escapeXML(tag)}</string></value>`
    ).join('');

    return `<?xml version="1.0"?>
<methodCall>
  <methodName>wp.newPost</methodName>
  <params>
    <param><value><int>1</int></value></param>
    <param><value><string>${this.wpUsername}</string></value></param>
    <param><value><string>${this.wpPassword}</string></value></param>
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
            <value><string>${this.escapeXML(title)}</string></value>
          </member>
          <member>
            <name>post_content</name>
            <value><string>${this.escapeXML(content)}</string></value>
          </member>
          <member>
            <name>terms_names</name>
            <value>
              <struct>
                <member>
                  <name>post_tag</name>
                  <value>
                    <array>
                      <data>${tagsXML}</data>
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
  }

  // ヘルパーメソッド群
  generateSEOMetaDescription(content, keyword, title) {
    const firstParagraph = content.match(/<p>([^<]+)<\/p>/);
    let metaDesc = firstParagraph ? firstParagraph[1].replace(/<[^>]*>/g, '') : title;
    
    if (!metaDesc.toLowerCase().includes(keyword.toLowerCase())) {
      metaDesc = `${keyword}について詳しく解説。${metaDesc}`;
    }
    
    if (metaDesc.length > 155) {
      metaDesc = metaDesc.substring(0, 152) + '...';
    }
    
    return metaDesc;
  }

  optimizeHeadings(content, keyword) {
    const h2Regex = /<h2>([^<]+)<\/h2>/g;
    let h2Optimized = false;
    
    content = content.replace(h2Regex, (match, heading) => {
      if (!h2Optimized && !heading.includes(keyword)) {
        h2Optimized = true;
        return `<h2>${keyword}の${heading}</h2>`;
      }
      return match;
    });
    
    return content;
  }

  optimizeImageAlt(content, keyword, title) {
    content = content.replace(
      /<img([^>]*?)alt="([^"]*)"([^>]*?)>/g,
      (match, before, alt, after) => {
        if (!alt.includes(keyword)) {
          return `<img${before}alt="${keyword}を使った${title}"${after}>`;
        }
        return match;
      }
    );
    
    content = content.replace(
      /<img(?![^>]*alt=)([^>]*?)>/g,
      `<img$1 alt="${keyword}に関する${title}">`
    );
    
    return content;
  }

  shortenSentences(content) {
    return content.replace(/<p>([^<]+)<\/p>/g, (match, paragraph) => {
      if (paragraph.length > 100) {
        const sentences = paragraph.split(/(?<=[。！？])/);
        const shortSentences = [];
        
        sentences.forEach(sentence => {
          if (sentence.length > 40) {
            const parts = sentence.split('、');
            if (parts.length > 2) {
              shortSentences.push(parts.slice(0, 2).join('、') + '。');
              shortSentences.push(parts.slice(2).join('、'));
            } else {
              shortSentences.push(sentence);
            }
          } else {
            shortSentences.push(sentence);
          }
        });
        
        return `<p>${shortSentences.join('')}</p>`;
      }
      return match;
    });
  }

  ensureExternalLinks(content, category, keyword) {
    const existingExternalLinks = (content.match(/<a\s+href="https?:\/\/(?!www\.entamade\.jp)/gi) || []).length;
    
    if (existingExternalLinks < 2) {
      console.log('⚠️ 外部リンクが不足しています。追加します...');
      const externalLinks = this.getExternalLinksForCategory(category);
      
      const h3Tags = content.match(/<\/h3>/g) || [];
      if (h3Tags.length >= 2) {
        const insertPoint = content.indexOf('</h3>', content.indexOf('</h3>') + 1);
        const linkSection = `</h3>
<p>より詳しい情報については、以下の信頼できるソースもご参照ください：</p>
<ul>
<li>${externalLinks[0]}</li>
<li>${externalLinks[1]}</li>
</ul>`;
        
        content = content.slice(0, insertPoint) + linkSection + content.slice(insertPoint + 5);
      }
      
      console.log('✅ 外部リンクを追加しました');
    }
    
    return content;
  }

  getExternalLinksForCategory(category) {
    const links = {
      tech: [
        '<a href="https://www.itmedia.co.jp/" target="_blank" rel="nofollow noopener">ITmedia</a>',
        '<a href="https://techcrunch.com/category/startups/" target="_blank" rel="nofollow noopener">TechCrunch</a>'
      ],
      review: [
        '<a href="https://kakaku.com/" target="_blank" rel="nofollow noopener">価格.com</a>',
        '<a href="https://www.amazon.co.jp/" target="_blank" rel="nofollow noopener">Amazon</a>'
      ]
    };
    
    return links[category] || links.review;
  }

  addInternalLinks(content, category) {
    const baseUrl = 'https://www.entamade.jp';
    const internalLink = `<a href="${baseUrl}/category/${category}/">${category}記事一覧</a>`;
    
    const firstH3Index = content.indexOf('</h3>');
    if (firstH3Index !== -1 && !content.includes('関連記事もご覧ください')) {
      const linkSection = `</h3><p>関連記事もご覧ください：${internalLink}</p>`;
      content = content.slice(0, firstH3Index) + linkSection + content.slice(firstH3Index + 5);
    }
    
    return content;
  }

  reportSEOStatus(content, keyword) {
    const keywordCount = (content.match(new RegExp(keyword, 'gi')) || []).length;
    const externalLinkCount = (content.match(/<a\s+href="https?:\/\/(?!www\.entamade\.jp)/gi) || []).length;
    const h2Count = (content.match(/<h2>/gi) || []).length;
    const h3Count = (content.match(/<h3>/gi) || []).length;
    
    console.log('📊 === SEO最適化レポート ===');
    console.log(`✅ キーワード「${keyword}」: ${keywordCount}回`);
    console.log(`✅ 外部リンク: ${externalLinkCount}個`);
    console.log(`✅ H2見出し: ${h2Count}個`);
    console.log(`✅ H3見出し: ${h3Count}個`);
  }

  // ユーティリティメソッド
  getCategoryName(category) {
    const names = {
      entertainment: 'エンターテインメント',
      anime: 'アニメ',
      game: 'ゲーム',
      movie: '映画',
      music: '音楽',
      tech: 'テクノロジー',
      beauty: '美容',
      food: 'グルメ',
      lifestyle: 'ライフスタイル',
      selfhelp: '自己啓発',
      review: 'レビュー'
    };
    return names[category] || 'エンターテインメント';
  }

  generateTags(category) {
    const tagSets = {
      entertainment: ['エンタメ', '芸能', 'ニュース', '話題', '2025'],
      review: ['レビュー', '評価', '商品', 'おすすめ', '2025']
    };
    return tagSets[category] || tagSets.entertainment;
  }

  getTemplate(category) {
    if (this.templates && this.templates[category]) {
      return this.templates[category];
    }
    return this.getDefaultTemplate(category);
  }

  getDefaultTemplate(category) {
    const templates = {
      entertainment: {
        topics: ['最新の芸能ニュース', '話題のドラマ・バラエティ', '注目のタレント・俳優']
      },
      review: {
        topics: ['注目商品レビュー', '新製品評価', 'コスパ最強商品']
      }
    };
    
    return templates[category] || templates.entertainment;
  }

  async generateWithGPT(category, template) {
    // GPT生成のスタブ（OpenAI APIキーがない場合のフォールバック）
    if (!this.openai) {
      return this.generateFallbackArticle(category);
    }
    
    // 既存のGPT生成ロジック
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `あなたは${this.getCategoryName(category)}専門のWebライターです。`
          },
          {
            role: 'user',
            content: `${category}に関する記事を生成してください。`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });
      
      const content = response.choices[0].message.content;
      return this.parseGPTResponse(content, category);
      
    } catch (error) {
      console.error('GPT生成エラー:', error);
      return this.generateFallbackArticle(category);
    }
  }

  generateFallbackArticle(category) {
    const title = `${this.getCategoryName(category)}の最新情報`;
    const content = `
      <h2>はじめに</h2>
      <p>${this.getCategoryName(category)}の最新情報をお届けします。</p>
      
      <h3>トピック1</h3>
      <p>詳細な内容がここに入ります。</p>
      
      <h3>トピック2</h3>
      <p>詳細な内容がここに入ります。</p>
      
      <h2>まとめ</h2>
      <p>今回は${this.getCategoryName(category)}について解説しました。</p>
    `;
    
    return {
      title,
      content,
      excerpt: `${this.getCategoryName(category)}の最新情報`,
      category,
      tags: this.generateTags(category),
      status: 'publish'
    };
  }

  parseGPTResponse(content, category) {
    // 簡略化したパース処理
    return {
      title: `${this.getCategoryName(category)}最新情報`,
      content: content,
      excerpt: content.substring(0, 150),
      category,
      tags: this.generateTags(category),
      status: 'publish'
    };
  }

  escapeXML(str) {
    if (!str) return '';
    return str.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

module.exports = BlogAutomationTool;
