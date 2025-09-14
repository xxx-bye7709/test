// functions/index.js - Firebase Functions v4形式（CORS対応版）
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

// Firebase Admin初期化（重要！グローバルスコープで初期化）
admin.initializeApp();

// Firebase configから環境変数に設定
if (functions.config().openai && functions.config().openai.api_key) {
  process.env.OPENAI_API_KEY = functions.config().openai.api_key;
  console.log('✅ OpenAI API key loaded from Firebase config');
} else {
  console.log('⚠️ OpenAI API key not found in Firebase config, using .env file');
}

// .envファイルは自動的に読み込まれる（Firebase Functions v4.8.0以降）

// 遅延読み込み用の変数
let BlogAutomationTool;
let ImageGenerator;
let PerformanceSystem;
let WordPressMediaManager;

// 初期化関数
function loadModules() {
  if (!BlogAutomationTool) {
    BlogAutomationTool = require('./lib/blog-tool');
  }
  if (!ImageGenerator) {
    ImageGenerator = require('./lib/image-generator');
  }
  if (!PerformanceSystem) {
    PerformanceSystem = require('./lib/performance-system');
  }
  if (!WordPressMediaManager) {
    WordPressMediaManager = require('./lib/wordpress-media-manager');
  }
}

// グローバルインスタンス
let performanceSystem;
let mediaManager;

// サービス初期化
function initializeServices() {
  loadModules();
  if (!performanceSystem) {
    performanceSystem = new PerformanceSystem();
  }
  if (!mediaManager) {
    mediaManager = new WordPressMediaManager();
  }
}

// === ヘルパー関数 ===
const generateArticleForCategory = async (category) => {
  loadModules();
  // targetSiteが指定されている場合、サイト情報を取得
  let siteConfig = null;
  if (targetSite) {
    const siteDoc = await admin.firestore()
      .collection('wordpress_sites')
      .doc(targetSite)
      .get();
    
    if (siteDoc.exists) {
      siteConfig = siteDoc.data();
      console.log(`Using site: ${siteConfig.name} for ${category} article`);
    }
  }
  
  const blogTool = new BlogAutomationTool(siteConfig); // サイト情報を渡す
  const article = await blogTool.generateArticle(category);
  const result = await blogTool.postToWordPress(article);
  
  // Firestoreに記録する際にtargetSiteを含める
  if (targetSite) {
    await admin.firestore().collection('generatedArticles').add({
      ...result,
      targetSite: targetSite,
      siteName: siteConfig?.name,
      siteUrl: siteConfig?.url,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  
  return result;
};

// === SEOテスト関数（新規追加） ===

// SEO分析テスト
exports.testSEOAnalysis = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        loadModules();
        const blogTool = new BlogAutomationTool();
        const category = req.query.category || 'entertainment';
        
        console.log('🔍 SEO Analysis Test Starting...');
        
        // テスト記事を生成（投稿はしない）
        const article = await blogTool.generateArticle(category);
        
        // SEO分析
        const focusKeyword = article.focusKeyword || article.tags[0];
        const keywordCount = (article.content.match(new RegExp(focusKeyword, 'gi')) || []).length;
        const externalLinkCount = (article.content.match(/<a\s+href="https?:\/\/(?!www\.entamade\.jp)/gi) || []).length;
        const internalLinkCount = (article.content.match(/<a\s+href="https?:\/\/www\.entamade\.jp/gi) || []).length;
        const h2Count = (article.content.match(/<h2>/gi) || []).length;
        const h3Count = (article.content.match(/<h3>/gi) || []).length;
        
        // 第一段落のチェック
        const firstParagraph = article.content.match(/<p>([^<]+)<\/p>/);
        const hasKeywordInFirst = firstParagraph && firstParagraph[1].toLowerCase().includes(focusKeyword.toLowerCase());
        
        // メタディスクリプションのチェック
        const hasKeywordInMeta = article.metaDescription && article.metaDescription.toLowerCase().includes(focusKeyword.toLowerCase());
        
        const seoReport = {
          success: true,
          title: article.title,
          focusKeyword: focusKeyword,
          seoScore: {
            keywordInFirstParagraph: hasKeywordInFirst,
            keywordDensity: keywordCount,
            keywordInMetaDescription: hasKeywordInMeta,
            externalLinks: externalLinkCount,
            internalLinks: internalLinkCount,
            h2Tags: h2Count,
            h3Tags: h3Count,
            contentLength: article.content.replace(/<[^>]*>/g, '').length
          },
          checks: {
            '✅ キーフレーズが第一段落に含まれている': hasKeywordInFirst,
            '✅ キーフレーズ密度が適切（5-8回）': keywordCount >= 5 && keywordCount <= 8,
            '✅ 外部リンクが2つ以上': externalLinkCount >= 2,
            '✅ 内部リンクがある': internalLinkCount > 0,
            '✅ H2タグが2つ以上': h2Count >= 2,
            '✅ H3タグがある': h3Count > 0,
            '✅ メタディスクリプションにキーフレーズ': hasKeywordInMeta,
            '✅ 文字数が1500文字以上': article.content.replace(/<[^>]*>/g, '').length >= 1500
          },
          metaDescription: article.metaDescription,
          excerpt: article.excerpt,
          category: category,
          tags: article.tags,
          timestamp: new Date().toISOString()
        };
        
        // スコア計算
        const passedChecks = Object.values(seoReport.checks).filter(v => v === true).length;
        const totalChecks = Object.keys(seoReport.checks).length;
        seoReport.overallScore = `${Math.round((passedChecks / totalChecks) * 100)}%`;
        
        console.log('📊 SEO Analysis Complete:', seoReport.overallScore);
        
        res.json(seoReport);
        
      } catch (error) {
        console.error('SEO Analysis Error:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });
  });

// SEO最適化記事投稿テスト
exports.testSEOOptimizedPost = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        loadModules();
        const blogTool = new BlogAutomationTool();
        const category = req.query.category || 'entertainment';
        const keyword = req.query.keyword || null;
        
        console.log('🔍 SEO Optimized Post Test Starting...');
        console.log(`Category: ${category}, Keyword: ${keyword || 'auto'}`);
        
        // SEO最適化記事を生成
        const article = await blogTool.generateArticle(category);
        
        // カスタムキーワードが指定されている場合は上書き
        if (keyword) {
          article.focusKeyword = keyword;
          article.content = blogTool.enhancedSEOOptimization(
            article.content,
            keyword,
            category,
            article.title
          );
          article.metaDescription = blogTool.generateSEOMetaDescription(
            article.content,
            keyword,
            article.title
          );
        }
        
        // WordPress投稿
        const result = await blogTool.postToWordPress(article);
        
        // SEO分析レポート
        const focusKeyword = article.focusKeyword;
        const keywordCount = (article.content.match(new RegExp(focusKeyword, 'gi')) || []).length;
        const externalLinkCount = (article.content.match(/<a\s+href="https?:\/\/(?!www\.entamade\.jp)/gi) || []).length;
        const internalLinkCount = (article.content.match(/<a\s+href="https?:\/\/www\.entamade\.jp/gi) || []).length;
        
        res.json({
          success: true,
          message: 'SEO optimized post created successfully',
          postId: result.postId,
          url: result.url,
          title: result.title,
          focusKeyword: focusKeyword,
          seoMetrics: {
            keywordDensity: keywordCount,
            externalLinks: externalLinkCount,
            internalLinks: internalLinkCount,
            metaDescription: article.metaDescription,
            contentLength: article.content.replace(/<[^>]*>/g, '').length
          },
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('SEO Optimized Post Error:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });
  });

// SEOヘルスチェック（全カテゴリー）
exports.seoHealthCheck = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        loadModules();
        const blogTool = new BlogAutomationTool();
        
        const categories = ['entertainment', 'anime', 'game', 'movie', 'music', 'tech', 'beauty', 'food'];
        const results = {};
        
        console.log('🏥 SEO Health Check Starting for all categories...');
        
        for (const category of categories) {
          console.log(`Checking ${category}...`);
          
          const article = await blogTool.generateArticle(category);
          const focusKeyword = article.focusKeyword || article.tags[0];
          
          const keywordCount = (article.content.match(new RegExp(focusKeyword, 'gi')) || []).length;
          const externalLinkCount = (article.content.match(/<a\s+href="https?:\/\/(?!www\.entamade\.jp)/gi) || []).length;
          const firstParagraph = article.content.match(/<p>([^<]+)<\/p>/);
          const hasKeywordInFirst = firstParagraph && firstParagraph[1].toLowerCase().includes(focusKeyword.toLowerCase());
          const hasKeywordInMeta = article.metaDescription && article.metaDescription.toLowerCase().includes(focusKeyword.toLowerCase());
          
          const checks = {
            keywordInFirstParagraph: hasKeywordInFirst,
            keywordDensity: keywordCount >= 5 && keywordCount <= 8,
            externalLinks: externalLinkCount >= 2,
            metaDescription: hasKeywordInMeta
          };
          
          const passedChecks = Object.values(checks).filter(v => v === true).length;
          const score = Math.round((passedChecks / 4) * 100);
          
          results[category] = {
            score: `${score}%`,
            focusKeyword: focusKeyword,
            checks: checks,
            metrics: {
              keywordCount,
              externalLinkCount,
              contentLength: article.content.replace(/<[^>]*>/g, '').length
            }
          };
        }
        
        // 全体スコア計算
        const scores = Object.values(results).map(r => parseInt(r.score));
        const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        
        res.json({
          success: true,
          overallScore: `${overallScore}%`,
          categoryResults: results,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('SEO Health Check Error:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });
  });

// === 既存の記事生成関数（8カテゴリー） - CORS対応 ===

// エンタメ記事生成
exports.generateEntertainmentArticle = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        const targetSite = req.body?.targetSite || null; // targetSiteを取得
        const result = await generateArticleForCategory('entertainment', targetSite);
        res.json({ 
          success: true, 
          targetSite: targetSite,
          ...result 
        });
      } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  });

// アニメ記事生成
exports.generateAnimeArticle = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        const targetSite = req.body?.targetSite || null; // targetSiteを取得
        const result = await generateArticleForCategory('entertainment', targetSite);
        res.json({ 
          success: true, 
          targetSite: targetSite,
          ...result 
        });
      } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  });

// ゲーム記事生成
exports.generateGameArticle = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        const targetSite = req.body?.targetSite || null; // targetSiteを取得
        const result = await generateArticleForCategory('entertainment', targetSite);
        res.json({ 
          success: true, 
          targetSite: targetSite,
          ...result 
        });
      } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  });

// 映画記事生成
exports.generateMovieArticle = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        const targetSite = req.body?.targetSite || null; // targetSiteを取得
        const result = await generateArticleForCategory('entertainment', targetSite);
        res.json({ 
          success: true, 
          targetSite: targetSite,
          ...result 
        });
      } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  });

// 音楽記事生成
exports.generateMusicArticle = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        const targetSite = req.body?.targetSite || null; // targetSiteを取得
        const result = await generateArticleForCategory('entertainment', targetSite);
        res.json({ 
          success: true, 
          targetSite: targetSite,
          ...result 
        });
      } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  });

// テック記事生成
exports.generateTechArticle = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        const targetSite = req.body?.targetSite || null; // targetSiteを取得
        const result = await generateArticleForCategory('entertainment', targetSite);
        res.json({ 
          success: true, 
          targetSite: targetSite,
          ...result 
        });
      } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  });
// 美容記事生成
exports.generateBeautyArticle = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        const targetSite = req.body?.targetSite || null; // targetSiteを取得
        const result = await generateArticleForCategory('entertainment', targetSite);
        res.json({ 
          success: true, 
          targetSite: targetSite,
          ...result 
        });
      } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  });

// グルメ記事生成
exports.generateFoodArticle = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        const targetSite = req.body?.targetSite || null; // targetSiteを取得
        const result = await generateArticleForCategory('entertainment', targetSite);
        res.json({ 
          success: true, 
          targetSite: targetSite,
          ...result 
        });
      } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  });

// ランダム記事生成
exports.generateRandomArticle = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        const targetSite = req.body?.targetSite || null; // targetSiteを取得
        const categories = ['entertainment', 'anime', 'game', 'movie', 'music', 'tech', 'beauty', 'food'];
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];
        const result = await generateArticleForCategory(randomCategory);
        res.json({ success: true, targetSite: targetSite, category: randomCategory, ...result });
      } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  });

// === 🆕 XML-RPC画像アップロードテスト機能 ===

// XML-RPC画像アップロードテスト
exports.testXMLRPCImageUpload = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        loadModules();
        const blogTool = new BlogAutomationTool();
        
        console.log('🖼️ XML-RPC画像アップロードテスト開始...');
        
        // テスト画像URLを使用（またはDALL-E生成）
        let testImageUrl = req.query.imageUrl || 'https://via.placeholder.com/1200x630/4FC3F7/FFFFFF?text=XML-RPC+Test';
        
        // DALL-E 3で新しい画像を生成する場合
        if (req.query.generate === 'true') {
          const imageGenerator = new ImageGenerator();
          const prompt = 'Beautiful modern blog header image with vibrant colors';
          const imageResult = await imageGenerator.generateImage(prompt, '1792x1024', 'standard');
          if (imageResult.success) {
            testImageUrl = imageResult.imageUrl;
            console.log('✅ DALL-E 3画像生成成功');
          }
        }
        
        // XML-RPCでアップロード
        const filename = `test-image-${Date.now()}.png`;
        const mediaInfo = await blogTool.uploadImageViaXMLRPC(testImageUrl, filename);
        
        res.json({
          success: true,
          message: 'XML-RPC画像アップロードテスト完了',
          testImageUrl: testImageUrl,
          uploadResult: mediaInfo,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('XML-RPC画像アップロードテストエラー:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message
        });
      }
    });
  });

// 既存記事の画像修復
exports.fixMissingImage = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        loadModules();
        const blogTool = new BlogAutomationTool();
        
        const postId = req.query.postId || req.body.postId;
        if (!postId) {
          return res.status(400).json({
            success: false,
            error: 'postIdが必要です'
          });
        }
        
        console.log(`🔧 Post ${postId} の画像修復開始...`);
        
        // 画像生成
        const imageGenerator = new ImageGenerator();
        const prompt = `Blog featured image for post ${postId}`;
        const imageResult = await imageGenerator.generateImage(prompt, '1792x1024', 'standard');
        
        if (!imageResult.success) {
          throw new Error('画像生成に失敗しました');
        }
        
        // 画像をアップロード
        const filename = `post-${postId}-featured-${Date.now()}.png`;
        const mediaInfo = await blogTool.uploadImageViaXMLRPC(imageResult.imageUrl, filename);
        
        // 記事にアイキャッチ画像を設定
        if (mediaInfo && mediaInfo.id) {
          await blogTool.setFeaturedImage(postId, mediaInfo.id);
        }
        
        res.json({
          success: true,
          message: `Post ${postId} の画像を修復しました`,
          postId: postId,
          imageUrl: imageResult.imageUrl,
          attachmentId: mediaInfo ? mediaInfo.id : null,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('画像修復エラー:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message
        });
      }
    });
  });

// 画像付き記事生成テスト（完全版）
exports.testCompleteArticleWithImage = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        loadModules();
        const blogTool = new BlogAutomationTool();
        const category = req.query.category || 'entertainment';
        
        console.log('🚀 画像付き完全記事生成テスト開始...');
        
        const startTime = Date.now();
        
        // 記事生成（画像生成も含む）
        const article = await blogTool.generateArticle(category);
        
        // WordPressに投稿（画像アップロードも含む）
        const result = await blogTool.postToWordPress(article);
        
        const duration = Date.now() - startTime;
        
        res.json({
          success: true,
          message: '画像付き記事を正常に投稿しました',
          postId: result.postId,
          url: result.url,
          title: result.title,
          attachmentId: result.attachmentId,
          imageUrl: result.imageUrl,
          category: category,
          focusKeyword: result.focusKeyword,
          metaDescription: result.metaDescription,
          duration: `${duration}ms`,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('画像付き記事生成テストエラー:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message
        });
      }
    });
  });

// === 以下、既存のコードを維持 ===

// シンプルHTML版 人間関係記事生成
exports.generateAdultArticle = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      const startTime = Date.now();
      
      try {
        console.log('💝 シンプルHTML版 人間関係記事生成開始...');
        
        const contentLevel = req.query.level || 'general';
        
        loadModules();
        const blogTool = new BlogAutomationTool();
        
        // シンプルHTML版記事生成
        const article = await generateSimpleHTMLRelationshipArticle(blogTool, contentLevel);
        
        // WordPress投稿（画像も含む）
        const result = await blogTool.postToWordPress({
          ...article,
          category: 'selfhelp',
          tags: [...article.tags, '自己啓発', '人間関係', '心理学'],
          meta: {
            contentLevel: contentLevel,
            targetAudience: 'general',
            htmlVersion: 'simple'
          }
        });
        
        const duration = Date.now() - startTime;
        console.log(`✅ シンプルHTML版記事投稿完了 (${duration}ms)`);
        
        res.json({
          success: true,
          message: 'シンプルHTML版人間関係記事が正常に投稿されました',
          postId: result.postId,
          url: result.url,
          title: result.title,
          attachmentId: result.attachmentId,
          category: 'selfhelp',
          htmlVersion: 'simple',
          contentLevel: contentLevel,
          duration: `${duration}ms`,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('シンプルHTML版記事生成エラー:', error);
        res.status(500).json({
          success: false,
          error: error.message,
          category: 'selfhelp',
          htmlVersion: 'simple'
        });
      }
    });
  });

// シンプルHTML版記事生成関数
async function generateSimpleHTMLRelationshipArticle(blogTool, contentLevel = 'general') {
  const healthyTopics = {
    strict: [
      'コミュニケーション能力の向上方法',
      '信頼関係を築くコツ',
      '効果的な会話術',
      'チームワークの重要性'
    ],
    general: [
      '人間関係を良好にする方法',
      'コミュニケーションスキルアップ',
      '信頼される人になるには',
      '職場での人間関係改善',
      '友情を深める秘訣'
    ],
    relaxed: [
      '人間関係の悩み解決法',
      'ソーシャルスキルの向上',
      '心理学から学ぶ人間関係',
      '良い人間関係の築き方',
      'コミュニティでの立ち回り方'
    ]
  };
  
  const topics = healthyTopics[contentLevel] || healthyTopics.general;
  const selectedTopic = topics[Math.floor(Math.random() * topics.length)];
  
  const prompt = `
あなたは人間関係改善の専門家です。
以下の要件に従って、実用的な記事を書いてください。

【トピック】: ${selectedTopic}
【対象読者】: 人間関係を改善したいすべての人
【重要な制約】: HTMLはシンプルなタグのみ使用（p, h2, h3, ul, li, strong, em）

【記事の方針】:
1. 科学的根拠に基づく内容
2. 実践しやすい具体的なアドバイス
3. 誰でも活用できる普遍的な内容
4. 前向きで建設的なメッセージ

【HTML制約】:
- スタイル属性は使用しない
- divタグは使用しない
- 複雑なHTMLは避ける
- 基本的なタグのみ（p, h2, h3, ul, li, strong, em）

【記事構造】:
- タイトル: わかりやすく、実用的
- 導入（なぜこのスキルが重要か）
- 本文（具体的な方法・コツ）
- 実践例
- まとめ（行動につながるメッセージ）

【文字数】: 1000-1400文字
【トーン】: 親しみやすく、励ましの気持ちを込めて

基本的なHTMLタグのみを使用して構造化してください。`;

  try {
    const response = await blogTool.openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: `あなたは人間関係とコミュニケーションの専門家です。シンプルなHTMLのみを使用して、実践的で価値のあるアドバイスを提供します。`
        },
        {
          role: 'user', 
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const content = response.choices[0].message.content;
    
    // シンプルHTML版コンテンツ構造化
    return parseSimpleHTMLContent(content, contentLevel, selectedTopic);
    
  } catch (error) {
    console.error('シンプルHTML版記事GPT生成エラー:', error);
    return generateFallbackSimpleArticle(selectedTopic, contentLevel);
  }
}

// シンプルHTML版コンテンツ構造化
function parseSimpleHTMLContent(content, contentLevel, topic) {
  // タイトル抽出・調整
  const titleMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/i) || 
                     content.match(/^#\s+(.+)$/m);
  
  let title = titleMatch 
    ? titleMatch[1].replace(/<[^>]*>/g, '').trim()
    : `${topic}のための実践ガイド`;

  // シンプルな案内を記事の最初に追加（スタイルなし）
  const simpleNotice = `
<p><strong>より良い人間関係のために</strong></p>
<p>科学的根拠に基づいた実践的なアドバイスをお届けします。皆様の人間関係がより豊かになることを願っています。</p>
`;

  // 本文を整形（複雑なHTMLを削除）
  let bodyContent = content;
  if (titleMatch) {
    bodyContent = content.replace(titleMatch[0], '').trim();
  }
  
  // スタイル属性とdivタグを削除
  bodyContent = bodyContent
    .replace(/style="[^"]*"/g, '')  // style属性を削除
    .replace(/<div[^>]*>/g, '')     // 開始divタグを削除
    .replace(/<\/div>/g, '')       // 終了divタグを削除
    .replace(/class="[^"]*"/g, '')  // class属性も削除
    .replace(/id="[^"]*"/g, '');    // id属性も削除
  
  // シンプルな案内を本文の最初に挿入
  bodyContent = simpleNotice + bodyContent;
  
  // シンプルな励ましメッセージを追加
  const simpleFooter = `
<h3>実践して成長しましょう</h3>
<ul>
  <li>小さな一歩から始めることが大切です</li>
  <li>継続することで必ず変化が現れます</li>
  <li>周りの人との関係がより良くなることを願っています</li>
  <li>困った時は信頼できる人に相談してみてください</li>
</ul>
<p><strong>継続することで必ず良い変化が現れます。今日から実践してみませんか？</strong></p>
`;

  bodyContent += simpleFooter;

  // 抜粋生成（シンプルな表現）
  const plainText = bodyContent.replace(/<[^>]*>/g, '');
  const excerpt = `人間関係改善のための実践的アドバイス。${plainText.substring(0, 100)}...`;

  return {
    title,
    content: bodyContent,
    excerpt,
    category: 'selfhelp',
    tags: ['人間関係', 'コミュニケーション', '自己啓発', topic, '心理学', '実践ガイド'],
    status: 'publish',
    format: 'standard',
    author: 1,
    meta: {
      targetAudience: 'general',
      contentType: 'relationship-advice',
      contentLevel: contentLevel,
      htmlVersion: 'simple'
    }
  };
}

// フォールバックシンプル記事
function generateFallbackSimpleArticle(topic, contentLevel) {
  return {
    title: `${topic}のための実践ガイド`,
    content: `
<p><strong>より良い人間関係のために</strong></p>
<p>科学的根拠に基づいた実践的なアドバイスをお届けします。</p>

<p>${topic}について、実践的な観点から情報をお届けします。</p>

<h2>なぜ重要なのか</h2>
<p>良好な人間関係は、私たちの人生に大きな価値をもたらします。</p>

<h2>実践的なアプローチ</h2>
<p>小さな一歩から始めて、継続的に改善していくことが大切です。</p>

<h3>具体的な方法</h3>
<ul>
  <li>相手の話をよく聞く</li>
  <li>感謝の気持ちを表現する</li>
  <li>誠実なコミュニケーションを心がける</li>
  <li>相手の立場に立って考える</li>
</ul>

<h2>まとめ</h2>
<p>皆様の人間関係がより豊かになることを心から願っています。</p>

<h3>実践して成長しましょう</h3>
<p><strong>継続することで必ず良い変化が現れます。今日から始めてみませんか？</strong></p>
`,
    excerpt: `${topic}について、実践的な観点から人間関係改善のアドバイスをお届けします。`,
    category: 'selfhelp',
    tags: ['人間関係', 'コミュニケーション', topic, '自己啓発'],
    status: 'publish'
  };
}

// === 以下、既存のテスト関数とその他の機能をすべて維持 ===

// テストブログ投稿（強化版）
exports.testBlogPost = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        initializeServices();
        loadModules();
        
        const startTime = Date.now();
        const category = req.query.category || 'entertainment';
        
        console.log(`🚀 Enhanced blog post test - Category: ${category}`);
        
        const blogTool = new BlogAutomationTool();
        
        // 記事生成と投稿（画像アップロード含む）
        const article = await blogTool.generateArticle(category);
        const postResult = await blogTool.postToWordPress(article);
        
        const duration = Date.now() - startTime;
        
        res.json({
          success: true,
          message: 'Enhanced blog post created successfully',
          postId: postResult.postId,
          title: article.title,
          category: article.category,
          imageUrl: postResult.imageUrl,
          attachmentId: postResult.attachmentId,
          url: postResult.url,
          focusKeyword: postResult.focusKeyword,
          metaDescription: postResult.metaDescription,
          duration: `${duration}ms`,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('Enhanced blog post test failed:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message
        });
      }
    });
  });

// バッチ投稿機能（SEO最適化版）
exports.batchGenerateSEOPosts = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 540, memory: '2GB' })
  .https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        loadModules();
        const blogTool = new BlogAutomationTool();
        
        const count = Math.min(parseInt(req.query.count) || 5, 10); // 最大10記事
        const categories = ['entertainment', 'anime', 'game', 'movie', 'music', 'tech', 'beauty', 'food'];
        
        console.log(`📦 Batch generating ${count} SEO-optimized posts...`);
        
        const results = [];
        
        for (let i = 0; i < count; i++) {
          const category = categories[i % categories.length];
          console.log(`Generating post ${i + 1}/${count} in ${category}...`);
          
          try {
            const article = await blogTool.generateArticle(category);
            const postResult = await blogTool.postToWordPress(article);
            
            results.push({
              success: true,
              postId: postResult.postId,
              url: postResult.url,
              title: postResult.title,
              category: category,
              focusKeyword: postResult.focusKeyword
            });
            
            // レート制限対策
            await new Promise(resolve => setTimeout(resolve, 3000));
            
          } catch (error) {
            results.push({
              success: false,
              category: category,
              error: error.message
            });
          }
        }
        
        const successCount = results.filter(r => r.success).length;
        
        res.json({
          success: true,
          message: `Batch generation complete: ${successCount}/${count} posts created`,
          results: results,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('Batch generation error:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message
        });
      }
    });
  });

// システムメトリクス取得API（ダッシュボード用）
exports.getSystemMetrics = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 60 })
  .https.onRequest(async (req, res) => {
    // CORS対応
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      // テスト用のダミーデータ
      const metrics = {
        todayCount: 3,
        monthCount: 45,
        totalCount: 279,
        successCount: 275,
        failedCount: 4,
        successRate: 98,
        systemStatus: 'online',
        lastPost: {
          title: '【2025/8/13】エンターテインメントの最新情報まとめ',
          postId: '279',
          createdAt: new Date().toISOString()
        },
        serverTime: new Date().toISOString(),
        targets: {
          daily: 20,
          monthly: 500
        }
      };
      
      res.status(200).json({
        success: true,
        data: metrics
      });
      
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

// functions/index.js に追加する関数（修正版）
// 既存のindex.jsの最後に以下を追加してください

// ScheduleManagerクラスをインポート（グローバルレベル）
// const ScheduleManager = require('./lib/schedule-manager');

// ========================
// スケジュール管理機能（修正版）
// ========================

/**
 * スケジュール設定を保存
 */
exports.setSchedule = functions
  .region('asia-northeast1')
  .https.onRequest(async (req, res) => {
    // CORS設定
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      // ScheduleManagerを直接require（loadModulesを使わない）
      const ScheduleManagerClass = require('./lib/schedule-manager');
      const scheduleManager = new ScheduleManagerClass(admin);
      
      const config = req.body;
      const result = await scheduleManager.setSchedule(config);
      
      res.json({
        success: true,
        schedule: result.schedule
      });
    } catch (error) {
      console.error('スケジュール設定エラー:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

/**
 * スケジュール設定を取得
 */
exports.getSchedule = functions
  .region('asia-northeast1')
  .https.onRequest(async (req, res) => {
    // CORS設定
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      // ScheduleManagerを直接require
      const ScheduleManagerClass = require('./lib/schedule-manager');
      const scheduleManager = new ScheduleManagerClass(admin);
      
      const schedule = await scheduleManager.getSchedule();
      
      res.json({
        success: true,
        schedule: schedule
      });
    } catch (error) {
      console.error('スケジュール取得エラー:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

/**
 * スケジュールの有効/無効を切り替え
 */
exports.toggleSchedule = functions
  .region('asia-northeast1')
  .https.onRequest(async (req, res) => {
    // CORS設定
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const ScheduleManagerClass = require('./lib/schedule-manager');
      const scheduleManager = new ScheduleManagerClass(admin);
      
      const { enabled } = req.body;
      const result = await scheduleManager.toggleSchedule(enabled);
      
      res.json({
        success: true,
        enabled: result.enabled
      });
    } catch (error) {
      console.error('スケジュール切り替えエラー:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

// スケジュール手動実行エンドポイント
exports.triggerScheduledPost = functions.runWith({ timeoutSeconds: 540, memory: "2GB" }).https.onRequest(async (req, res) => {
  // CORS設定
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    console.log('triggerScheduledPost: 手動実行開始');
    
    // ScheduleManagerの初期化（波括弧なし）
    const ScheduleManager = require('./lib/schedule-manager');
    const scheduleManager = new ScheduleManager();
    
    // スケジュール取得
    const schedule = await scheduleManager.getSchedule();
    console.log('現在のスケジュール:', JSON.stringify(schedule));
    
    if (!schedule || !schedule.enabled) {
      console.log('スケジュールが無効です');
      return res.status(200).json({
        success: false,
        message: 'スケジュールが無効になっています'
      });
    }
    
    // カテゴリー選択
    const category = await scheduleManager.getNextCategory();
    console.log('選択されたカテゴリー:', category);
    
    // BlogAutomationToolの初期化（波括弧なし）
    const BlogAutomationTool = require('./lib/blog-tool');
    const blogTool = new BlogAutomationTool();
    
    // 記事生成
    console.log(`${category}記事を生成中...`);
    const article = await blogTool.generateArticle(category);
    const result = await blogTool.postToWordPress(article);
    console.log('記事生成結果:', JSON.stringify(result));
    
    if (result.success) {
      // 投稿記録を更新
      await scheduleManager.recordPost();
      
      return res.status(200).json({
        success: true,
        message: '記事が正常に投稿されました',
        postId: result.postId,
        title: result.title,
        category: category,
        url: result.url
      });
    } else {
      throw new Error(result.error || '記事生成に失敗しました');
    }
    
  } catch (error) {
    console.error('triggerScheduledPost エラー詳細:', error);
    console.error('エラースタック:', error.stack);
    return res.status(500).json({
      success: false,
      error: error.message || 'スケジュール実行中にエラーが発生しました',
      details: error.toString()
    });
  }
});

/**
 * スケジュール実行（1時間ごと）
 */
exports.scheduledHourlyPost = functions
  .region('asia-northeast1')
  .pubsub.schedule('0 * * * *')
  .timeZone('Asia/Tokyo')
  .onRun(async (context) => {
    console.log('定期実行開始:', new Date().toISOString());
    
    try {
      const ScheduleManagerClass = require('./lib/schedule-manager');
      const scheduleManager = new ScheduleManagerClass(admin);
      
      // 実行可能かチェック
      const checkResult = await scheduleManager.canExecute();
      if (!checkResult.canExecute) {
        console.log('実行スキップ:', checkResult.reason);
        return null;
      }

      // スケジュール設定を取得
      const schedule = await scheduleManager.getSchedule();
      
      // インターバルチェック
      const now = new Date();
      const hour = now.getHours();
      
      let shouldExecute = false;
      switch (schedule.interval) {
        case 'hourly':
          shouldExecute = true;
          break;
        case 'every_2_hours':
          shouldExecute = hour % 2 === 0;
          break;
        case 'every_3_hours':
          shouldExecute = hour % 3 === 0;
          break;
        case 'every_6_hours':
          shouldExecute = hour % 6 === 0;
          break;
        case 'daily':
          shouldExecute = hour === 9;
          break;
      }

      if (!shouldExecute) {
        console.log('インターバル外のためスキップ');
        return null;
      }

      // 次のカテゴリーを取得
      const category = await scheduleManager.getNextCategory();
      console.log('投稿カテゴリー:', category);

      // 記事生成
      loadModules();
      const blogTool = new BlogAutomationTool();
      const article = await blogTool.generateArticle(category);
      const result = await blogTool.postToWordPress(article);
      
      if (result && result.success !== false) {
        await scheduleManager.incrementTodayPostCount();
        console.log('定期投稿成功:', {
          postId: result.postId,
          category: category,
          title: result.title
        });
      }

      return result;
    } catch (error) {
      console.error('定期実行エラー:', error);
      return null;
    }
  });

/**
 * 日次リセット（毎日0時）
 */
exports.scheduledDailyReset = functions
  .region('asia-northeast1')
  .pubsub.schedule('0 0 * * *')
  .timeZone('Asia/Tokyo')
  .onRun(async (context) => {
    console.log('日次リセット開始:', new Date().toISOString());
    
    try {
      const ScheduleManagerClass = require('./lib/schedule-manager');
      const scheduleManager = new ScheduleManagerClass(admin);
      
      await scheduleManager.resetDailyCount();
      console.log('日次リセット完了');
      return null;
    } catch (error) {
      console.error('日次リセットエラー:', error);
      return null;
    }
  });

/**
 * 手動実行用エンドポイント（テスト用）
 */
exports.triggerScheduledPost = functions
  .region('asia-northeast1')
  .https.onRequest(async (req, res) => {
    // CORS設定
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      // 関数内でScheduleManagerインスタンスを作成
    const ScheduleManager = require('./lib/schedule-manager');
      const scheduleManager = new ScheduleManager(admin);
      
      // 実行可能かチェック
      const checkResult = await scheduleManager.canExecute();
      if (!checkResult.canExecute) {
        res.json({
          success: false,
          message: checkResult.reason
        });
        return;
      }

      // 次のカテゴリーを取得
      const category = await scheduleManager.getNextCategory();
      
      // 記事生成（既存の生成関数を呼び出す）
      const functionName = category === 'random' 
        ? 'generateRandomArticle' 
        : `generate${category.charAt(0).toUpperCase() + category.slice(1)}Article`;
      
      // 既存の記事生成ロジックを使用
      const BlogAutomationTool = require('./lib/blog-tool');
      const blogTool = new BlogAutomationTool();
      
      const article = await blogTool.generateArticle(category);
      const result = await blogTool.postToWordPress(article);
      
      if (result.success) {
        await scheduleManager.incrementTodayPostCount();
        
        res.json({
          success: true,
          postId: result.postId,
          category: category,
          title: result.title,
          url: result.url
        });
      } else {
        res.json({
          success: false,
          error: result.error || '記事生成に失敗しました'
        });
      }
    } catch (error) {
      console.error('手動実行エラー:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });


// 簡易動作確認用
exports.quickTest = functions.runWith({ timeoutSeconds: 60 }).https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  try {
    console.log('QuickTest: 開始');
    
    // スケジュールマネージャーだけテスト
    const ScheduleManager = require('./lib/schedule-manager');
    const scheduleManager = new ScheduleManager(admin);
    
    const schedule = await scheduleManager.getSchedule();
    const canExecute = await scheduleManager.canExecute();
    
    console.log('QuickTest: 完了', { schedule, canExecute });
    
    res.json({
      success: true,
      schedule: schedule,
      canExecute: canExecute
    });
  } catch (error) {
    console.error('QuickTest エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// index.jsに追加する新しい関数

/**
 * DMM商品連携記事生成
 */
// index.js の generateArticleWithProducts を以下に完全に置き換える

exports.generateArticleWithProducts = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 540, memory: '2GB' })
  .https.onRequest(async (req, res) => {
    // CORS設定
    const cors = require('cors')({ origin: true });
    
    cors(req, res, async () => {
      try {
        console.log('=== Starting generateArticleWithProducts ===');
        
        // パラメータ取得
        const {
          keyword = 'DVD',
          category = 'entertainment',
          limit = 5,
          templateId = 'product_review',
          postToWordPress = false
        } = req.query;
        
        console.log('Parameters:', { keyword, category, limit, templateId, postToWordPress });
        
        // モジュール読み込み
        const BlogAutomationTool = require('./lib/blog-tool');
        const axios = require('axios');
        
        // 1. DMM API直接呼び出し
        console.log('Searching DMM products directly...');
        let products = [];
        
        try {
          const dmmParams = {
            api_id: process.env.DMM_API_ID,
            affiliate_id: process.env.DMM_AFFILIATE_ID,
            site: 'FANZA',
            service: 'digital',
            floor: 'videoa',
            keyword: keyword,
            hits: parseInt(limit) || 5,
            sort: 'rank',
            output: 'json'
          };
          
          console.log('DMM API params:', { 
            ...dmmParams, 
            api_id: dmmParams.api_id ? 'SET' : 'NOT SET' 
          });
          
          const dmmResponse = await axios.get('https://api.dmm.com/affiliate/v3/ItemList', {
            params: dmmParams,
            timeout: 10000
          });
          
          console.log('DMM Response status:', dmmResponse.status);
          
          if (dmmResponse.data?.result?.items) {
            const items = dmmResponse.data.result.items;
            console.log(`Found ${items.length} items from DMM`);
            
            // DMM商品データを整形
            products = items.slice(0, parseInt(limit)).map(item => ({
              title: item.title,
              price: item.prices?.price || item.price || '価格不明',
              imageUrl: item.imageURL?.large || item.imageURL?.small,
              affiliateUrl: item.affiliateURL || item.URL,
              description: item.iteminfo?.series?.[0]?.name || 
                          item.iteminfo?.label?.[0]?.name || '',
              maker: item.iteminfo?.maker?.[0]?.name || '',
              genre: item.iteminfo?.genre?.[0]?.name || '',
              actress: item.iteminfo?.actress?.[0]?.name || '',
              rating: item.review?.average || 0
            }));
            
            console.log(`Formatted ${products.length} products`);
          }
        } catch (dmmError) {
          console.error('DMM API error:', dmmError.message);
          if (dmmError.response) {
            console.error('DMM error response:', dmmError.response.data);
          }
        }
        
        // 2. 記事生成
        console.log('Generating article...');
        const blogTool = new BlogAutomationTool();
        
        let articlePrompt;
        if (products.length > 0) {
          articlePrompt = `
以下のDVD/動画商品を基に、魅力的なレビュー記事を作成してください。

【商品リスト】
${products.map((p, i) => `
${i + 1}. ${p.title}
価格: ${p.price}
${p.description ? `説明: ${p.description}` : ''}
${p.maker ? `メーカー: ${p.maker}` : ''}
${p.genre ? `ジャンル: ${p.genre}` : ''}
${p.actress ? `出演: ${p.actress}` : ''}
${p.rating > 0 ? `評価: ⭐${p.rating}/5` : ''}
`).join('\n')}

【記事の要件】
- 各商品の特徴や魅力を詳しく説明
- 購入を検討している読者に役立つ情報を提供
- SEOを意識したキーワード「${keyword}」の適切な使用
- カテゴリ: ${category}
`;
        } else {
          articlePrompt = `
${keyword}に関する魅力的な紹介記事を作成してください。
最新のトレンドや注目すべきポイントを含めて、読者の興味を引く内容にしてください。
カテゴリ: ${category}
`;
        }
        
        const articleData = await blogTool.generateArticle({
          templateId: templateId || 'default',
          customPrompt: articlePrompt,
          includeImages: true
        });
        
        // 3. 商品リンクを記事に追加
        let enhancedContent = articleData.content || '';
        
        if (products.length > 0) {
          const productSection = `
<h2>おすすめ商品</h2>
<div class="product-list" style="margin-top: 40px;">
${products.map((p, index) => `
<div class="product-item" style="margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;">
  <div style="display: flex; gap: 20px;">
    ${p.imageUrl ? `
    <div style="flex-shrink: 0;">
      <img src="${p.imageUrl}" alt="${p.title}" style="max-width: 200px; border-radius: 4px;">
    </div>
    ` : ''}
    <div style="flex-grow: 1;">
      <h3 style="margin-top: 0; color: #333;">${index + 1}. ${p.title}</h3>
      <p class="price" style="font-size: 1.3em; color: #ff6b6b; font-weight: bold; margin: 10px 0;">
        💰 ${p.price}
      </p>
      ${p.description ? `<p><strong>📝 説明:</strong> ${p.description}</p>` : ''}
      ${p.maker ? `<p><strong>🏢 メーカー:</strong> ${p.maker}</p>` : ''}
      ${p.genre ? `<p><strong>📂 ジャンル:</strong> ${p.genre}</p>` : ''}
      ${p.actress ? `<p><strong>👤 出演:</strong> ${p.actress}</p>` : ''}
      ${p.rating > 0 ? `<p><strong>⭐ 評価:</strong> ${p.rating}/5</p>` : ''}
      <p style="margin-top: 20px;">
        <a href="${p.affiliateUrl}" target="_blank" rel="noopener noreferrer" 
           style="display: inline-block; padding: 12px 30px; background-color: #4CAF50; 
                  color: white; text-decoration: none; border-radius: 5px; 
                  font-weight: bold; font-size: 1.1em;">
          🛒 詳細を見る
        </a>
      </p>
    </div>
  </div>
</div>
`).join('')}
</div>

<div style="margin-top: 30px; padding: 20px; background: #f0f8ff; border-left: 4px solid #4CAF50;">
  <p style="margin: 0;"><strong>💡 ご注意:</strong> 価格や在庫状況は変動する場合があります。最新情報は各商品ページでご確認ください。</p>
</div>
`;
          enhancedContent = enhancedContent + '\n\n' + productSection;
        }
        
        // 4. WordPressに投稿
        let postResult = null;
        if (postToWordPress === 'true' || postToWordPress === true) {
          console.log('Posting to WordPress...');
          
          try {
            // wordpress モジュールがインストールされているか確認
            let wordpress;
            try {
              wordpress = require('wordpress');
            } catch (moduleError) {
              console.error('WordPress module not found. Please install: npm install wordpress');
              postResult = {
                success: false,
                error: 'WordPress module not installed. Run: npm install wordpress'
              };
            }
            
            if (wordpress) {
              const client = wordpress.createClient({
                url: process.env.WP_URL,
                username: process.env.WP_USERNAME,
                password: process.env.WP_PASSWORD
              });
              
              const postData = {
                title: articleData.title,
                content: enhancedContent,
                status: 'publish',
                categories: [category],
                tags: [keyword]
              };
              
              postResult = await new Promise((resolve, reject) => {
                client.newPost(postData, (error, id) => {
                  if (error) {
                    console.error('WordPress posting error:', error);
                    reject(error);
                  } else {
                    console.log('Successfully posted to WordPress. Post ID:', id);
                    resolve({
                      success: true,
                      postId: id,
                      url: `${process.env.WP_URL}/?p=${id}`
                    });
                  }
                });
              });
            }
          } catch (wpError) {
            console.error('WordPress posting failed:', wpError);
            postResult = {
              success: false,
              error: wpError.message || wpError.toString()
            };
          }
        }
        
        // 5. レスポンス
        const response = {
          success: true,
          article: {
            title: articleData.title,
            content: enhancedContent,
            category: category,
            tags: [keyword]
          },
          products: products,
          productCount: products.length,
          wordpressPost: postResult,
          message: products.length > 0 
            ? `Successfully generated article with ${products.length} products` 
            : 'Article generated without products (no products found for keyword)'
        };
        
        console.log('=== Completed generateArticleWithProducts ===');
        console.log(`Result: ${response.message}`);
        
        res.status(200).json(response);
        
      } catch (error) {
        console.error('Error in generateArticleWithProducts:', error);
        res.status(500).json({
          success: false,
          error: error.message,
          stack: error.stack
        });
      }
    });
  });

/**
 * 商品検索API
 */
exports.searchProducts = functions
  .https.onRequest(async (req, res) => {
    cors(req, res, async () => {
      try {
        const { keyword, genre, limit = 10 } = req.query;
        
        const DMMApi = require('./lib/dmm-api');
        const BlogAutomationTool = require('./lib/blog-tool');
        const dmmApi = new DMMApi();
        
        let products;
        if (keyword) {
          products = await dmmApi.searchProducts({ keyword, hits: limit });
        } else if (genre) {
          products = await dmmApi.getProductsByGenre(genre, limit);
        } else {
          products = await dmmApi.getTrendingProducts('all', limit);
        }

        res.json({
          success: true,
          ...products
        });
      } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });
  });

/**
 * 商品レビュー記事生成
 */
exports.generateProductReview = functions
  .region('asia-northeast1')
  .runWith({
    timeoutSeconds: 540,
    memory: '2GB'
  })
  .https.onRequest(async (req, res) => {
    console.log('=== generateProductReview START ===');
    
    // CORS設定
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Content-Type', 'application/json; charset=utf-8');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const BlogTool = require('./lib/blog-tool');
      const blogTool = new BlogTool();
      
      const requestData = req.body || {};
      
      const {
        products = [],  // ⭐ 複数商品配列に変更
        keyword = 'レビュー',
        autoPost = true
      } = requestData;

      // 後方互換性のため、productsToProcess[0]?も確認
      const productsToProcess = products.length > 0 ? products : 
                         requestData.product ? [requestData.product] : [];

      console.log(`📦 Processing ${productsToProcess.length} products`);
      
      console.log('Product data received:', {
  hasTitle: !!productsToProcess[0]?.title,
  hasPrice: !!productsToProcess[0]?.price,
  hasImageUrl: !!productsToProcess[0]?.imageUrl,
  hasAffiliateUrl: !!productsToProcess[0]?.affiliateUrl
});
      
      // 記事生成
      const article = await blogTool.generateProductReview(
        productsToProcess,  // 配列を渡す
          keyword,
          { autoPost }
        );

      // 複数商品のHTMLセクションを生成して追加
      if (productsToProcess.length > 0) {
        const productHTML = generateProductSection(productsToProcess, 'review');
        article.content = article.content + '\n\n' + productHTML;
      }
      
      // ★強化されたクリーンアップ処理
      if (article.content) {
        // 不要なテキストパターンを削除
        const unwantedPatterns = [
          /\*\*この.*?ください。?\*\*/gi,
          /このHTML.*?ください。?/gi,
          /このコード.*?ください。?/gi,
          /ぜひご活用ください。?/gi,
          /上記.*?ください。?/gi,
          /```html\n?/gi,
          /```\n?/gi
        ];
        
        unwantedPatterns.forEach(pattern => {
          article.content = article.content.replace(pattern, '');
        });
        
        // 空白の正規化
        article.content = article.content
          .replace(/\n{3,}/g, '\n\n')  // 3つ以上の改行を2つに
          .replace(/^\n+/, '')          // 先頭の改行を削除
          .replace(/\n+$/, '')          // 末尾の改行を削除
          .replace(/^[ \t]+$/gm, '')    // 空白のみの行を削除
          .trim();
      }
      
      // ★画像URLが存在する場合のみ画像を挿入
      const imageUrl = productsToProcess[0]?.imageUrl || productsToProcess[0]?.imageURL || productsToProcess[0]?.image;  // ← 修正！
if (imageUrl) {
  console.log('Inserting image:', imageUrl);
  
  const imageHtml = `
<div class="product-main-image" style="text-align: center; margin: 30px 0;">
  <img src="${imageUrl}" alt="${productsToProcess[0]?.title || keyword}" 
       style="max-width: 600px; width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
</div>`;
        
        // 最初の</h2>タグの後に画像を挿入
        const h2End = article.content.indexOf('</h2>');
        if (h2End !== -1) {
          article.content = 
            article.content.slice(0, h2End + 5) + 
            imageHtml + 
            article.content.slice(h2End + 5);
        } else {
          // h2がない場合は最初に追加
          article.content = imageHtml + '\n\n' + article.content;
        }
      } else {
        console.log('⚠️ No image URL provided');
      }
      
      // ★アフィリエイトボタン（複数箇所に配置）
      const affiliateUrl = productsToProcess[0]?.affiliateUrl || productsToProcess[0]?.affiliateURL || productsToProcess[0]?.url;
      if (affiliateUrl) {
        // 記事中央のボタン
        const midButtonHtml = `
<div class="affiliate-button-wrapper" style="text-align: center; margin: 35px 0; padding: 20px; background: linear-gradient(135deg, #fff9e6 0%, #ffeb99 100%); border-radius: 12px;">
  <p style="margin-bottom: 15px; font-size: 16px; color: #666;">＼ 今すぐチェック ／</p>
  <a href="${affiliateUrl}" 
     class="affiliate-button" 
     target="_blank" 
     rel="noopener noreferrer"
     style="display: inline-block; 
            padding: 18px 50px; 
            background: linear-gradient(45deg, #ff6b6b, #ff5252); 
            color: white; 
            text-decoration: none; 
            border-radius: 50px; 
            font-size: 20px; 
            font-weight: bold; 
            box-shadow: 0 6px 20px rgba(255,107,107,0.4);
            transition: all 0.3s;">
    🎬 詳細を見る
  </a>
</div>`;

        // 記事最後のボタン
        const bottomButtonHtml = `
<div class="affiliate-button-wrapper" style="text-align: center; margin: 45px 0; padding: 30px; background: linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%); border-radius: 12px; border: 2px solid #1890ff;">
  <h3 style="color: #0050b3; margin-bottom: 10px;">気になった方はこちら</h3>
  <p style="margin-bottom: 20px; color: #666;">セール情報や在庫状況もチェックできます</p>
  <a href="${affiliateUrl}" 
     class="affiliate-button" 
     target="_blank" 
     rel="noopener noreferrer"
     style="display: inline-block; 
            padding: 20px 60px; 
            background: linear-gradient(45deg, #4CAF50, #45a049); 
            color: white; 
            text-decoration: none; 
            border-radius: 50px; 
            font-size: 22px; 
            font-weight: bold; 
            box-shadow: 0 8px 25px rgba(76,175,80,0.35);
            transition: all 0.3s;">
    🛒 商品ページへ
  </a>
  <p style="margin-top: 15px; font-size: 12px; color: #999;">※在庫切れの場合があります</p>
</div>`;
        
        // 記事の中間地点にボタンを挿入
        const midPoint = Math.floor(article.content.length / 2);
        const nearestParagraph = article.content.indexOf('</p>', midPoint);
        if (nearestParagraph !== -1) {
          article.content = 
            article.content.slice(0, nearestParagraph + 4) + 
            midButtonHtml + 
            article.content.slice(nearestParagraph + 4);
        }
        
        // 最後にボタンを追加
        article.content += bottomButtonHtml;
      }
      
      // ★アイキャッチ画像の設定（WordPressメタデータ用）
      if (imageUrl) {
        article.featuredImage = imageUrl;
      }
      
      // タグ・カテゴリの設定
      article.category = productsToProcess[0].category || 'products';
      article.tags = [keyword, productsToProcess[0].genre, productsToProcess[0].maker].filter(Boolean);
      
      console.log('Article processed:', {
        title: article.title,
        contentLength: article.content?.length,
        hasImage: !!imageUrl,
        hasButton: !!affiliateUrl,
        hasFeaturedImage: !!article.featuredImage
      });
      
      // WordPressに投稿
      let postResult = { success: false };
      
      if (autoPost) {
        console.log('Auto-posting to WordPress...');
        postResult = await blogTool.postToWordPress(article);
        console.log('Post result:', postResult);
      }
      
      // レスポンス作成
      const response = {
        success: true,
        title: article.title,
        keyword: keyword,
        productId: productsToProcess[0]?.content_id || productsToProcess[0]?.id || "unknown",
        postId: postResult.postId || null,
        postUrl: postResult.url || null,
        postSuccess: postResult.success || false,
        hasImage: !!imageUrl,
        message: postResult.success ? 'Posted successfully' : 'Article generated but posting failed',
        postError: postResult.error || null
      };
      
      console.log('=== generateProductReview END ===');
      res.json(response);
      
    } catch (error) {
      console.error('Error in generateProductReview:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Unknown error'
      });
    }
  });

// index.js の最後に追加するシンプルなテスト関数

exports.simpleDMMTest = functions
  .region('asia-northeast1')
  .https.onRequest(async (req, res) => {
    // CORS設定
    res.set('Access-Control-Allow-Origin', '*');
    
    try {
      const axios = require('axios');
      
      // DMM API設定を確認
      const config = {
        apiId: process.env.DMM_API_ID,
        affiliateId: process.env.DMM_AFFILIATE_ID,
        hasApiId: !!process.env.DMM_API_ID,
        hasAffiliateId: !!process.env.DMM_AFFILIATE_ID
      };
      
      console.log('DMM Config:', config);
      
      // 直接DMM APIを呼び出し
      const params = {
        api_id: process.env.DMM_API_ID,
        affiliate_id: process.env.DMM_AFFILIATE_ID,
        site: 'FANZA',
        service: 'digital',
        floor: 'videoa',
        keyword: '動画',
        hits: 5,
        sort: 'rank',
        output: 'json'
      };
      
      console.log('Request params:', params);
      
      const response = await axios.get('https://api.dmm.com/affiliate/v3/ItemList', {
        params: params,
        timeout: 10000
      });
      
      const result = {
        success: true,
        status: response.status,
        resultCount: response.data?.result?.result_count || 0,
        items: response.data?.result?.items?.length || 0,
        firstItem: response.data?.result?.items?.[0]?.title || null,
        message: response.data?.result?.message || null
      };
      
      console.log('DMM API Result:', result);
      res.status(200).json(result);
      
    } catch (error) {
      console.error('DMM API Error:', error.message);
      
      const errorInfo = {
        success: false,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
        config: {
          hasApiId: !!process.env.DMM_API_ID,
          hasAffiliateId: !!process.env.DMM_AFFILIATE_ID
        }
      };
      
      res.status(500).json(errorInfo);
    }
  });

// index.js に追加 - モック商品データで記事生成

exports.generateArticleWithMockProducts = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
    try {
      const BlogAutomationTool = require('./lib/blog-tool');
      
      const {
        keyword = 'エンタメ',
        category = 'entertainment',
        templateId = 'product_review',
        postToWordPress = false
      } = req.query;
      
      // モック商品データを生成
      const mockProducts = [
        {
          title: `${keyword}関連の人気商品1`,
          affiliateUrl: 'https://www.entamade.jp',
          price: '2,980円',
          description: '話題の商品です。多くのユーザーから高評価を得ています。',
          genre: category
        },
        {
          title: `${keyword}関連の人気商品2`,
          affiliateUrl: 'https://www.entamade.jp',
          price: '3,980円',
          description: '注目の新作。限定特典付きでお得です。',
          genre: category
        },
        {
          title: `${keyword}関連の人気商品3`,
          affiliateUrl: 'https://www.entamade.jp',
          price: '1,980円',
          description: 'コストパフォーマンスに優れた人気商品。',
          genre: category
        }
      ];
      
      // BlogAutomationToolで記事生成
      const blogTool = new BlogAutomationTool();
      
      const articlePrompt = `
${keyword}に関する魅力的な記事を作成してください。

【おすすめ商品】
${mockProducts.map((p, i) => `
${i + 1}. ${p.title}
価格: ${p.price}
${p.description}
`).join('\n')}

【記事の要件】
- SEOを意識したキーワードの使用
- 読者の興味を引く内容
- カテゴリ: ${category}
`;
      
      const articleData = await blogTool.generateArticle({
        templateId: templateId,
        customPrompt: articlePrompt,
        includeImages: true
      });
      
      // 商品セクションを追加
      const productSection = `
<h2>おすすめ情報</h2>
<div class="product-list">
${mockProducts.map(p => `
<div class="product-item" style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
  <h3>${p.title}</h3>
  <p class="price" style="color: #ff6b6b; font-weight: bold;">価格: ${p.price}</p>
  <p>${p.description}</p>
  <p><a href="${p.affiliateUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">詳細を見る</a></p>
</div>
`).join('')}
</div>
`;
      
      const enhancedContent = articleData.content + '\n\n' + productSection;
      
      // WordPressに投稿
      let postResult = null;
      if (postToWordPress === 'true' || postToWordPress === true) {
        try {
          const wordpress = require('wordpress');
          const client = wordpress.createClient({
            url: process.env.WP_URL,
            username: process.env.WP_USERNAME,
            password: process.env.WP_PASSWORD
          });
          
          const postData = {
            title: articleData.title,
            content: enhancedContent,
            status: 'publish',
            categories: [category],
            tags: [keyword]
          };
          
          postResult = await new Promise((resolve, reject) => {
            client.newPost(postData, (error, id) => {
              if (error) {
                reject(error);
              } else {
                resolve({
                  success: true,
                  postId: id,
                  url: `${process.env.WP_URL}/?p=${id}`
                });
              }
            });
          });
        } catch (wpError) {
          console.error('WordPress posting error:', wpError);
          postResult = {
            success: false,
            error: wpError.message
          };
        }
      }
      
      res.status(200).json({
        success: true,
        message: 'Article generated with mock products',
        article: {
          title: articleData.title,
          content: enhancedContent,
          category: category,
          tags: [keyword]
        },
        products: mockProducts,
        wordpressPost: postResult
      });
      
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

// index.js に追加する関数

// ===== 1. 商品検索API（ダッシュボード用） =====
exports.searchProductsForDashboard = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 60 })
  .https.onRequest(async (req, res) => {
    // CORS設定（ダッシュボードからのアクセスを許可）
    const cors = require('cors')({ 
      origin: [
        'http://localhost:3000',
        'http://localhost:3001', 
        'https://blog-dashboard.vercel.app',
        'https://blog-dashboard-*.vercel.app', // プレビューURL用
        'https://www.entamade.jp'
      ],
      credentials: true 
    });
    
    cors(req, res, async () => {
      try {
        const { keyword, limit = 20, page = 1 } = req.query;
        
        if (!keyword) {
          return res.status(400).json({
            success: false,
            error: 'Keyword is required'
          });
        }
        
        console.log(`Dashboard product search: ${keyword}, limit: ${limit}, page: ${page}`);
        
        // DMM API呼び出し
        const axios = require('axios');
        const dmmParams = {
          api_id: process.env.DMM_API_ID,
          affiliate_id: process.env.DMM_AFFILIATE_ID,
          site: 'FANZA',
          service: 'digital',
          floor: 'videoa',
          keyword: keyword,
          hits: parseInt(limit),
          offset: (parseInt(page) - 1) * parseInt(limit) + 1,
          sort: '-rank', // 人気順
          output: 'json'
        };
        
        const dmmResponse = await axios.get('https://api.dmm.com/affiliate/v3/ItemList', {
          params: dmmParams,
          timeout: 10000
        });
        
        let products = [];
        let totalCount = 0;
        
        if (dmmResponse.data?.result) {
          totalCount = dmmResponse.data.result.result_count || 0;
          
          if (dmmResponse.data.result.items) {
            products = dmmResponse.data.result.items.map((item, index) => ({
              id: item.content_id || `${keyword}_${page}_${index}`,
              contentId: item.content_id,
              productId: item.product_id,
              title: item.title || '商品名不明',
              price: item.prices?.price || item.price || '価格不明',
              listPrice: item.prices?.list_price || null,
              imageUrl: item.imageURL?.large || item.imageURL?.small || null,
              thumbnailUrl: item.imageURL?.small || item.imageURL?.list || null,
              affiliateUrl: item.affiliateURL || item.URL,
              description: item.iteminfo?.series?.[0]?.name || 
                          item.iteminfo?.label?.[0]?.name || 
                          item.comment || '',
              maker: item.iteminfo?.maker?.[0]?.name || '',
              genre: item.iteminfo?.genre?.map(g => g.name).join(', ') || '',
              actress: item.iteminfo?.actress?.map(a => a.name).join(', ') || '',
              director: item.iteminfo?.director?.[0]?.name || '',
              rating: item.review?.average || 0,
              reviewCount: item.review?.count || 0,
              releaseDate: item.date || '',
              duration: item.volume || '',
              sampleImages: item.sampleImageURL?.sample_s || [],
              sampleMovie: item.sampleMovieURL?.size_560_360 || null
            }));
          }
        }
        
        res.status(200).json({
          success: true,
          keyword: keyword,
          page: parseInt(page),
          limit: parseInt(limit),
          totalCount: totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          productCount: products.length,
          products: products
        });
        
      } catch (error) {
        console.error('Dashboard search error:', error);
        res.status(500).json({
          success: false,
          error: error.message,
          details: error.response?.data || null
        });
      }
    });
  });

// ===== 2. 選択商品で記事生成（ダッシュボード用） =====
exports.generateArticleFromDashboard = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 540, memory: '2GB' })
  .https.onRequest(async (req, res) => {
    const cors = require('cors')({ 
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://blog-dashboard.vercel.app',
        'https://www.entamade.jp'
      ],
      credentials: true 
    });
    
    cors(req, res, async () => {
      try {
        const {
          keyword,
          selectedProducts = [], // 選択された商品データの配列
          articleTitle = null, // カスタムタイトル（オプション）
          articleType = 'review', // review, comparison, ranking
          category = 'entertainment',
          autoPublish = false // 自動でWordPressに投稿するか
        } = req.body;
        
        if (!selectedProducts || selectedProducts.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'No products selected'
          });
        }
        
        console.log(`Generating article with ${selectedProducts.length} products from dashboard`);
        
        // BlogAutomationToolで記事生成
        const BlogAutomationTool = require('./lib/blog-tool');
        const blogTool = new BlogAutomationTool();
        
        // 記事タイプに応じたプロンプト作成
        let promptTemplate = '';
        let defaultTitle = '';
        
        switch (articleType) {
          case 'comparison':
            promptTemplate = `
以下の${selectedProducts.length}つの商品を詳細に比較する記事を作成してください。

【比較商品】
${selectedProducts.map((p, i) => `
${i + 1}. ${p.title}
価格: ${p.price}
${p.genre ? `ジャンル: ${p.genre}` : ''}
${p.rating > 0 ? `評価: ⭐${p.rating}/5 (${p.reviewCount}件)` : ''}
${p.description}
`).join('\n')}

【記事の要件】
- 各商品の特徴を明確に比較
- どんな人にどの商品がおすすめか具体的に説明
- 価格と価値のバランスを評価
- 総合的な結論を提示
`;
            defaultTitle = `【徹底比較】${keyword}おすすめ${selectedProducts.length}選！どれを選ぶべき？`;
            break;
            
          case 'ranking':
            promptTemplate = `
以下の商品でランキング記事を作成してください。選択順がランキング順位です。

【ランキング商品】
${selectedProducts.map((p, i) => `
第${i + 1}位: ${p.title}
価格: ${p.price}
${p.genre ? `ジャンル: ${p.genre}` : ''}
${p.rating > 0 ? `評価: ⭐${p.rating}/5 (${p.reviewCount}件)` : ''}
${p.description}
`).join('\n')}

【記事の要件】
- なぜこの順位なのか理由を説明
- 各商品の魅力を順位に応じて詳しく解説
- 1位の商品は特に詳細に
- ランキングの基準を明確に
`;
            defaultTitle = `【${new Date().getFullYear()}年最新】${keyword}ランキングTOP${selectedProducts.length}！`;
            break;
            
          case 'review':
          default:
            promptTemplate = `
以下の厳選された商品についてレビュー記事を作成してください。

【レビュー商品】
${selectedProducts.map((p, i) => `
商品${i + 1}: ${p.title}
価格: ${p.price}
${p.genre ? `ジャンル: ${p.genre}` : ''}
${p.rating > 0 ? `評価: ⭐${p.rating}/5 (${p.reviewCount}件)` : ''}
${p.maker ? `メーカー: ${p.maker}` : ''}
${p.description}
`).join('\n')}

【記事の要件】
- 各商品の魅力を詳しくレビュー
- 実際に使用した感想のような臨場感
- メリット・デメリットを公平に評価
- 購入を検討している人への具体的なアドバイス
`;
            defaultTitle = `【厳選レビュー】${keyword}のおすすめ${selectedProducts.length}選！プロが選ぶ本物`;
        }
        
        promptTemplate += `
- SEOキーワード「${keyword}」を自然に使用
- 読者が最後まで読みたくなる構成
- カテゴリ: ${category}
`;
        
        const articleData = await blogTool.generateArticle({
          templateId: articleType === 'ranking' ? 'recommendations' : 'product_review',
          customPrompt: promptTemplate,
          includeImages: true
        });
        
        // 商品セクションのHTML生成
        const productSectionHtml = generateProductSection(selectedProducts, articleType);
        
        // 最終的な記事コンテンツ
        const finalTitle = articleTitle || defaultTitle;
        const enhancedContent = articleData.content + '\n\n' + productSectionHtml;
        
        // WordPressへの自動投稿
        let postResult = null;
        if (autoPublish) {
          console.log('Auto-publishing to WordPress...');
          
          try {
            const wordpress = require('wordpress');
            const client = wordpress.createClient({
              url: process.env.WP_URL,
              username: process.env.WP_USERNAME,
              password: process.env.WP_PASSWORD
            });
            
            const postData = {
              title: finalTitle,
              content: enhancedContent,
              status: 'publish',
              categories: [category],
              tags: [keyword, articleType, `${selectedProducts.length}選`]
            };
            
            postResult = await new Promise((resolve, reject) => {
              client.newPost(postData, (error, id) => {
                if (error) {
                  console.error('WordPress error:', error);
                  reject(error);
                } else {
                  console.log(`Published to WordPress: ${id}`);
                  resolve({
                    success: true,
                    postId: id,
                    url: `${process.env.WP_URL}/?p=${id}`
                  });
                }
              });
            });
            
            // 投稿履歴を保存
            await admin.firestore()
              .collection('post_history')
              .add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'manual_product_article',
                keyword: keyword,
                category: category,
                articleType: articleType,
                productCount: selectedProducts.length,
                postId: postResult.postId,
                title: finalTitle,
                source: 'dashboard'
              });
            
          } catch (wpError) {
            console.error('WordPress posting failed:', wpError);
            postResult = {
              success: false,
              error: wpError.message
            };
          }
        }
        
        res.status(200).json({
          success: true,
          article: {
            title: finalTitle,
            content: enhancedContent,
            category: category,
            tags: [keyword, articleType, `${selectedProducts.length}選`],
            type: articleType
          },
          selectedProducts: selectedProducts,
          productCount: selectedProducts.length,
          wordpressPost: postResult,
          message: autoPublish 
            ? `記事を生成してWordPressに投稿しました（${selectedProducts.length}商品）`
            : `記事を生成しました（${selectedProducts.length}商品）`
        });
        
      } catch (error) {
        console.error('Article generation error:', error);
        res.status(500).json({
          success: false,
          error: error.message,
          stack: error.stack
        });
      }
    });
  });

// ===== 3. ヘルパー関数: 商品セクションHTML生成 =====
// index.js の generateProductSection 関数を修正（1834行目付近）
function generateProductSection(products, articleType) {
  const sectionTitle = articleType === 'ranking' 
    ? '🏆 ランキング詳細' 
    : articleType === 'comparison'
    ? '📊 商品比較表'
    : '⭐ おすすめ商品詳細';
  
  return `
<h2>${sectionTitle}</h2>
<div class="product-list" style="margin-top: 30px;">
${products.map((p, index) => {
  const rankBadge = articleType === 'ranking' 
    ? `<span style="position: absolute; top: -10px; left: -10px; background: linear-gradient(45deg, #FFD700, #FFA500); color: white; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">${index + 1}</span>`
    : '';
  
  const borderColor = articleType === 'ranking' && index === 0 
    ? '#FFD700' 
    : articleType === 'ranking' && index === 1
    ? '#C0C0C0'
    : articleType === 'ranking' && index === 2
    ? '#CD7F32'
    : '#4CAF50';
  
  // ★修正: affiliateUrlの存在チェックを追加
  const affiliateUrl = p.affiliateUrl || p.affiliateURL || p.url || '#';
  const imageUrl = p.imageUrl || p.imageURL || p.thumbnailUrl || '';
  
  return `
<div class="product-item" style="margin-bottom: 30px; padding: 25px; border: 3px solid ${borderColor}; border-radius: 12px; background: linear-gradient(135deg, #ffffff 0%, #f9f9f9 100%); position: relative; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
  ${rankBadge}
  <div style="display: flex; gap: 20px; ${articleType === 'ranking' && index < 3 ? 'margin-left: 20px;' : ''}">
    ${imageUrl ? `
    <div style="flex-shrink: 0;">
      <img src="${imageUrl}" alt="${p.title || ''}" style="max-width: 220px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
    </div>
    ` : ''}
    <div style="flex-grow: 1;">
      <h3 style="margin-top: 0; color: #333; font-size: 1.3em; line-height: 1.4;">
        ${articleType === 'ranking' ? `【第${index + 1}位】` : `【Pick ${index + 1}】`}
        ${p.title || '商品名不明'}
      </h3>
      
      <div style="display: flex; align-items: center; gap: 20px; margin: 15px 0;">
        <span style="font-size: 1.5em; color: #ff4444; font-weight: bold;">
          💰 ${p.price || '価格不明'}
        </span>
        ${p.listPrice && p.listPrice !== p.price ? `
        <span style="text-decoration: line-through; color: #999;">
          ${p.listPrice}
        </span>
        ` : ''}
      </div>
      
      ${p.rating && p.rating > 0 ? `
      <div style="margin: 10px 0;">
        <span style="color: #FFA500; font-size: 1.1em;">
          ${'⭐'.repeat(Math.round(p.rating))} ${p.rating}/5.0
        </span>
        <span style="color: #666; margin-left: 10px;">
          (${p.reviewCount || 0}件のレビュー)
        </span>
      </div>
      ` : ''}
      
      <div style="margin: 15px 0; padding: 15px; background: #f5f5f5; border-radius: 8px;">
        ${p.genre ? `<p style="margin: 5px 0;"><strong>📂 ジャンル:</strong> ${p.genre}</p>` : ''}
        ${p.maker ? `<p style="margin: 5px 0;"><strong>🏢 メーカー:</strong> ${p.maker}</p>` : ''}
        ${p.actress ? `<p style="margin: 5px 0;"><strong>👤 出演:</strong> ${p.actress}</p>` : ''}
        ${p.director ? `<p style="margin: 5px 0;"><strong>🎬 監督:</strong> ${p.director}</p>` : ''}
        ${p.duration ? `<p style="margin: 5px 0;"><strong>⏱ 収録時間:</strong> ${p.duration}</p>` : ''}
        ${p.releaseDate ? `<p style="margin: 5px 0;"><strong>📅 発売日:</strong> ${p.releaseDate}</p>` : ''}
      </div>
      
      ${p.description ? `
      <div style="margin: 15px 0; padding: 10px; background: #fff; border-left: 4px solid ${borderColor};">
        <p style="margin: 0; color: #555; line-height: 1.6;">${p.description}</p>
      </div>
      ` : ''}
      
      <div style="margin-top: 20px;">
        <a href="${affiliateUrl}" target="_blank" rel="noopener noreferrer" 
           style="display: inline-block; padding: 14px 40px; background: linear-gradient(45deg, ${borderColor}, ${borderColor}dd); 
                  color: white; text-decoration: none; border-radius: 30px; 
                  font-weight: bold; font-size: 1.1em; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                  transition: transform 0.3s, box-shadow 0.3s;">
          🛒 詳細を見る・購入する
        </a>
      </div>
    </div>
  </div>
</div>
`;
}).join('')}
</div>

<div style="margin-top: 40px; padding: 20px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; border: 2px solid #0ea5e9;">
  <h4 style="margin-top: 0; color: #0369a1;">💡 ご購入前のご案内</h4>
  <ul style="margin: 10px 0; padding-left: 20px; color: #334155;">
    <li>価格や在庫状況は変動する場合があります</li>
    <li>詳細情報は各商品ページでご確認ください</li>
    <li>レビュー評価は購入者の個人的な感想です</li>
    ${products.length > 1 ? '<li>複数購入の場合は送料がお得になる場合があります</li>' : ''}
  </ul>
</div>
`;
  
// index.jsの最後に以下の関数を追加してください

// ========================================
// Next.jsダッシュボード用の関数
// ========================================

/**
 * 商品検索API（Next.jsダッシュボード用）
 * /searchProducts エンドポイント
 */
exports.searchProducts = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 60 })
  .https.onRequest(async (req, res) => {
    // CORS設定
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      console.log('searchProducts called:', req.body);
      
      // POSTリクエストの場合
      if (req.method === 'POST') {
        const { query, limit = 20 } = req.body;
        
        if (!query) {
          return res.status(400).json({
            success: false,
            error: 'Query parameter is required'
          });
        }

        console.log(`Searching for: ${query}, limit: ${limit}`);

        // DMM APIが利用可能か確認
        const hasDMMCredentials = process.env.DMM_API_ID && process.env.DMM_AFFILIATE_ID;
        
        if (hasDMMCredentials) {
          try {
            // DMM API呼び出し
            const axios = require('axios');
            const dmmParams = {
              api_id: process.env.DMM_API_ID,
              affiliate_id: process.env.DMM_AFFILIATE_ID,
              site: 'FANZA',
              service: 'digital',
              floor: 'videoa',
              keyword: query,
              hits: parseInt(limit),
              sort: 'rank',
              output: 'json'
            };

            console.log('Calling DMM API...');
            const dmmResponse = await axios.get('https://api.dmm.com/affiliate/v3/ItemList', {
              params: dmmParams,
              timeout: 10000
            });

            let products = [];
            if (dmmResponse.data?.result?.items) {
              products = dmmResponse.data.result.items.map((item, index) => ({
                id: item.content_id || `product_${index}`,
                title: item.title || '商品名不明',
                price: item.prices?.price || item.price || '価格不明',
                thumbnailUrl: item.imageURL?.small || item.imageURL?.list || null,
                imageUrl: item.imageURL?.large || item.imageURL?.small || null,
                affiliateUrl: item.affiliateURL || item.URL || '#',
                description: item.iteminfo?.series?.[0]?.name || item.comment || '',
                maker: item.iteminfo?.maker?.[0]?.name || '',
                genre: item.iteminfo?.genre?.map(g => g.name).join(', ') || '',
                rating: item.review?.average || 0,
                reviewCount: item.review?.count || 0
              }));
            }

            console.log(`Found ${products.length} products`);

            return res.status(200).json({
              success: true,
              products: products,
              totalCount: products.length,
              source: 'DMM'
            });

          } catch (dmmError) {
            console.error('DMM API error:', dmmError.message);
            // DMM APIエラーの場合はモックデータを返す
          }
        }

        // DMM APIが使えない場合はモックデータを返す
        console.log('Returning mock data');
        const mockProducts = generateMockProducts(query, limit);
        
        return res.status(200).json({
          success: true,
          products: mockProducts,
          totalCount: mockProducts.length,
          source: 'mock'
        });
      }

      // GETリクエストの場合
      return res.status(405).json({
        success: false,
        error: 'Method not allowed. Use POST.'
      });

    } catch (error) {
      console.error('searchProducts error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  });

/**
 * 商品記事生成API（Next.jsダッシュボード用）
 * /generateProductArticle エンドポイント
 */
exports.generateProductArticle = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .https.onRequest(async (req, res) => {
    // CORS設定
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      console.log('generateProductArticle called:', req.body);
      
      if (req.method !== 'POST') {
        return res.status(405).json({
          success: false,
          error: 'Method not allowed. Use POST.'
        });
      }

      const {
        keyword,
        selectedProducts,
        articleType = 'review',
        autoPublish = false,
        category = 'entertainment'
      } = req.body;

      if (!selectedProducts || selectedProducts.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No products selected'
        });
      }

      console.log(`Generating article with ${selectedProducts.length} products`);

      // 記事タイトル生成
      let title = '';
      switch (articleType) {
        case 'ranking':
          title = `【${new Date().getFullYear()}年最新】${keyword || 'おすすめ商品'}ランキングTOP${selectedProducts.length}`;
          break;
        case 'comparison':
          title = `【徹底比較】${keyword || '商品'}${selectedProducts.length}選 - どれを選ぶべき？`;
          break;
        default:
          title = `【厳選】${keyword || 'おすすめ商品'}${selectedProducts.length}選 - 詳細レビュー`;
      }

      // 記事コンテンツ生成
      let content = generateArticleContent(selectedProducts, articleType, keyword);

      // WordPress投稿（必要に応じて）
      let wordpressPost = null;
      if (autoPublish) {
        console.log('Auto-publishing to WordPress...');
        // WordPress投稿のロジック（実装済みの場合）
        // wordpressPost = await publishToWordPress(title, content, category);
      }

      return res.status(200).json({
        success: true,
        title: title,
        content: content,
        productCount: selectedProducts.length,
        articleType: articleType,
        category: category,
        wordpressPost: wordpressPost,
        message: `記事を生成しました（${selectedProducts.length}商品）`
      });

    } catch (error) {
      console.error('generateProductArticle error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Article generation failed'
      });
    }
  });

/**
 * 通常記事生成API（Next.jsダッシュボード用）
 * /generatePost エンドポイント
 */
exports.generatePost = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .https.onRequest(async (req, res) => {
    // CORS設定
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
// POSTメソッドのみ許可
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    try {
      console.log('generatePost called:', req.body);
      
      if (req.method !== 'POST') {
        return res.status(405).json({
          success: false,
          error: 'Method not allowed. Use POST.'
        });
      }

      const { topic, keywords = [] } = req.body;

      if (!topic) {
        return res.status(400).json({
          success: false,
          error: 'Topic is required'
        });
      }

      // BlogAutomationToolを使用して記事生成
      const BlogAutomationTool = require('./lib/blog-tool');
      const blogTool = new BlogAutomationTool();
      
      const article = await blogTool.generateArticle('entertainment');

      return res.status(200).json({
        success: true,
        title: article.title || `${topic}について`,
        content: article.content || `<p>${topic}に関する記事内容です。</p>`,
        category: 'blog',
        tags: keywords,
        message: '記事を生成しました'
      });

    } catch (error) {
      console.error('generatePost error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Post generation failed'
      });
    }
  });

/**
 * スケジュール手動実行API（Next.jsダッシュボード用）
 * /runScheduledPost エンドポイント
 */
exports.runScheduledPost = functions
  .region('asia-northeast1')
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .https.onRequest(async (req, res) => {
    // CORS設定
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      console.log('runScheduledPost called');
      
      if (req.method !== 'POST') {
        return res.status(405).json({
          success: false,
          error: 'Method not allowed. Use POST.'
        });
      }

      // index.js に追加
exports.testSimplePost = functions
  .region('asia-northeast1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
    try {
      const BlogTool = require('./lib/blog-tool');
      const blogTool = new BlogTool();
      
      const simpleArticle = {
        title: "Test Post " + Date.now(),
        content: "<p>Simple test content</p>",
        category: "test",
        tags: ["test"],
        isProductReview: false
      };
      
      const result = await blogTool.postToWordPress(simpleArticle);
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

      //シンプルなテスト関数を追加
      exports.debugBlogTool = functions
  .region('asia-northeast1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
    try {
      console.log('Starting BlogTool debug...');
      const BlogTool = require('./lib/blog-tool');
      console.log('BlogTool loaded');
      
      const config = functions.config();
      console.log('Firebase config:', JSON.stringify(config.wordpress || {}, null, 2));
      
      const blogTool = new BlogTool();
      console.log('BlogTool instantiated');
      
      res.json({
        success: true,
        wordpressUrl: blogTool.wordpressUrl,
        hasUser: !!blogTool.wordpressUser,
        hasPassword: !!blogTool.wordpressPassword
      });
    } catch (error) {
      console.error('Debug error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

      // カテゴリーをランダムに選択
      const categories = ['entertainment', 'anime', 'game', 'movie', 'music', 'tech', 'beauty', 'food'];
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      
      console.log(`Running scheduled post for category: ${randomCategory}`);

      // BlogAutomationToolを使用して記事生成
      const BlogAutomationTool = require('./lib/blog-tool');
      const blogTool = new BlogAutomationTool();
      
      const article = await blogTool.generateArticle(randomCategory);
      const result = await blogTool.postToWordPress(article);

      return res.status(200).json({
        success: true,
        message: 'Scheduled post executed successfully',
        postId: result.postId,
        title: result.title,
        category: randomCategory,
        url: result.url
      });

    } catch (error) {
      console.error('runScheduledPost error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Scheduled post execution failed'
      });
    }
  });

// ========================================
// ヘルパー関数
// ========================================

/**
 * モック商品データ生成
 */
function generateMockProducts(query, limit) {
  const products = [];
  for (let i = 1; i <= limit; i++) {
    products.push({
      id: `mock_${i}`,
      title: `${query}関連商品${i}`,
      price: `¥${Math.floor(Math.random() * 5000 + 1000).toLocaleString()}`,
      thumbnailUrl: `https://via.placeholder.com/150x200?text=Product${i}`,
      imageUrl: `https://via.placeholder.com/300x400?text=Product${i}`,
      affiliateUrl: '#',
      description: `${query}に関連する人気商品です。`,
      maker: 'サンプルメーカー',
      genre: 'エンターテインメント',
      rating: Math.floor(Math.random() * 5) + 1,
      reviewCount: Math.floor(Math.random() * 100) + 10
    });
  }
  return products;
}

/**
 * 記事コンテンツ生成
 */
function generateArticleContent(products, articleType, keyword) {
  let content = `<h2>${keyword || '商品'}の紹介</h2>\n`;
  
  products.forEach((product, index) => {
    const rankLabel = articleType === 'ranking' ? `【第${index + 1}位】` : '';
    content += `
<div class="product-section">
  <h3>${rankLabel}${product.title}</h3>
  <p><strong>価格:</strong> ${product.price}</p>
  ${product.description ? `<p>${product.description}</p>` : ''}
  ${product.rating ? `<p>評価: ⭐${product.rating}/5</p>` : ''}
</div>
`;
  });
  
  content += `
<h2>まとめ</h2>
<p>今回は${products.length}つの商品をご紹介しました。それぞれに特徴があり、用途に応じて選ぶことが大切です。</p>
`;
  
  return content;
}

  // XML-RPC接続テスト関数を追加8/28
  exports.testXmlRpc = functions
  .region('asia-northeast1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
    const https = require('https');
    const xmlTest = `<?xml version="1.0"?>
<methodCall>
  <methodName>system.listMethods</methodName>
  <params></params>
</methodCall>`;
    
    const url = 'https://www.entamade.jp/xmlrpc.php';
    
    try {
      const result = await new Promise((resolve) => {
        const req = https.request(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml',
            'Content-Length': Buffer.byteLength(xmlTest)
          },
          timeout: 10000
        }, (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body: data.substring(0, 500)
            });
          });
        });
        
        req.on('timeout', () => {
          resolve({ error: 'Timeout', message: 'No response in 10 seconds' });
        });
        
        req.on('error', (e) => {
          resolve({ error: e.message });
        });
        
        req.write(xmlTest);
        req.end();
      });
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  }

  //checkConfig関数を追加
  exports.checkConfig = functions
  .region('asia-northeast1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    const config = functions.config();
    console.log('Full config:', JSON.stringify(config, null, 2));
    res.json({
      hasWordpress: !!config.wordpress,
      wordpressUser: config.wordpress?.username || 'NOT SET',  // user → username
      wordpressUrl: config.wordpress?.url || 'NOT SET',
      hasPassword: !!config.wordpress?.password,  // app_password → password
      hasOpenAI: !!config.openai?.api_key
    });
  });

/**
 * CTA付き記事のプレビュー
 * URL: /previewArticleWithCTA
 * Method: GET
 */
exports.previewArticleWithCTA = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  try {
    // 環境変数を読み込み
    
    const { OpenChatCTAGenerator } = require('./lib/openchat-cta-generator');
    const generator = new OpenChatCTAGenerator();
    
    const sampleContent = `
      <h2>サンプル商品記事</h2>
      <p>これは商品記事のサンプルです。実際の記事では、ここに商品の詳細が入ります。</p>
      <h3>商品1: おすすめアイテム</h3>
      <p>商品の説明文がここに入ります。価格や特徴などを詳しく説明します。</p>
      <h3>商品2: 人気商品</h3>
      <p>2つ目の商品の説明です。比較情報なども含まれます。</p>
      <h3>商品3: 新着商品</h3>
      <p>3つ目の商品説明。ユーザーレビューなども記載されます。</p>
      <h3>まとめ</h3>
      <p>今回は3つの商品を紹介しました。ぜひチェックしてみてください。</p>
    `;
    
    const contentWithCTA = generator.integrateWithProductArticle(sampleContent);
    
    // HTMLレスポンス
    res.send(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <title>オープンチャットCTA プレビュー</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            max-width: 900px; 
            margin: 0 auto; 
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            background: #f0f2f5;
            line-height: 1.6;
          }
          .preview-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 15px 15px 0 0;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .preview-header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
          }
          .preview-header p {
            margin: 0;
            opacity: 0.9;
            font-size: 16px;
          }
          .preview-info {
            background: #fff8dc;
            padding: 20px;
            border-left: 4px solid #ffc107;
            margin-bottom: 0;
          }
          .preview-content {
            background: white;
            padding: 40px;
            border-radius: 0 0 15px 15px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .preview-content h2 {
            color: #333;
            border-bottom: 2px solid #eee;
            padding-bottom: 10px;
          }
          .preview-content h3 {
            color: #555;
            margin-top: 30px;
          }
        </style>
      </head>
      <body>
        <div class="preview-header">
          <h1>🎯 オープンチャットCTA プレビュー</h1>
          <p>商品記事に自動追加されるCTAの表示確認ページ</p>
        </div>
        <div class="preview-info">
          <strong>📍 CTAの表示位置：</strong><br>
          1. 記事中間 - さりげない誘導<br>
          2. ノート案内 - 週2回更新の告知<br>
          3. 記事末尾 - メインの参加案内
        </div>
        <div class="preview-content">
          ${contentWithCTA}
        </div>
        <script>
          console.log('CTA Preview loaded successfully');
        </script>
      </body>
      </html>
    `);
    
  } catch (error) {
    console.error('プレビューエラー:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; padding: 20px;">
          <h1>❌ エラーが発生しました</h1>
          <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
${error.message}

${error.stack}
          </pre>
          <p>考えられる原因:</p>
          <ul>
            <li>openchat-cta-generator.js が見つからない</li>
            <li>環境変数が設定されていない</li>
            <li>構文エラー</li>
          </ul>
        </body>
      </html>
    `);
  }
});

/**
 * CTAクリックのトラッキング
 * URL: /trackOpenChatCTA
 * Method: POST
 * Body: { action: 'click', position: 'end' }
 */
exports.trackOpenChatCTA = functions.https.onRequest(async (req, res) => {
  // CORS対応
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  // OPTIONSリクエストへの対応
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    const { action, position } = req.body || {};
    
    // バリデーション
    if (!action) {
      return res.status(400).json({ 
        error: 'action is required',
        validActions: ['view', 'click', 'copy']
      });
    }
    
    // Firestoreに記録
    const docRef = await admin.firestore().collection('openchat_analytics').add({
      action: action,        // 'view', 'click', 'copy'
      position: position,    // 'mid', 'end', 'note'
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: req.headers['user-agent'],
      date: new Date().toISOString().split('T')[0] // 日付別集計用
    });
    
    console.log(`CTA tracked: ${action} at ${position} - ${docRef.id}`);
    
    res.json({ 
      success: true,
      id: docRef.id
    });
    
  } catch (error) {
    console.error('トラッキングエラー:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
});

// WordPress サイト管理用エンドポイント
exports.getWordPressSites = functions
  .region('asia-northeast1')  // ← この行を追加
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
  
  try {
    const snapshot = await admin.firestore()
      .collection('wordpress_sites')
      .orderBy('priority')
      .get();
    
    const sites = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json({ 
      success: true, 
      total: sites.length,
      active: sites.filter(s => s.enabled).length,
      sites 
    });
  } catch (error) {
    console.error('Error getting sites:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// アクティブサイトのみ取得
exports.getActiveSites = functions
   .region('asia-northeast1')  // ← この行を追加
  .https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  try {
    const snapshot = await admin.firestore()
      .collection('wordpress_sites')
      .where('enabled', '==', true)
      .orderBy('priority')
      .get();
    
    const sites = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json({ success: true, sites });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// サイト別の統計情報を取得
exports.getSiteStats = functions
  .region('asia-northeast1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
    try {
      const sitesSnapshot = await admin.firestore()
        .collection('wordpress_sites')
        .orderBy('priority')
        .get();
      
      const stats = await Promise.all(
        sitesSnapshot.docs.map(async (doc) => {
          const siteData = doc.data();
          
          // 各サイトの記事数をカウント
          const postsSnapshot = await admin.firestore()
            .collection('generatedArticles')
            .where('targetSite', '==', doc.id)
            .limit(1)
            .orderBy('createdAt', 'desc')
            .get();
          
          // 記事総数を取得
          const totalPostsSnapshot = await admin.firestore()
            .collection('generatedArticles')
            .where('targetSite', '==', doc.id)
            .get();
          
          return {
            siteId: doc.id,
            siteName: siteData.name,
            siteUrl: siteData.url,
            enabled: siteData.enabled,
            isDefault: siteData.isDefault,
            postCount: totalPostsSnapshot.size,
            lastPostDate: postsSnapshot.docs[0]?.data()?.createdAt?.toDate() || null,
            dmmConfigured: !!(siteData.dmmApiKey && siteData.dmmAffiliateId)
          };
        })
      );
      
      res.json({ 
        success: true, 
        totalSites: stats.length,
        activeSites: stats.filter(s => s.enabled).length,
        stats 
      });
    } catch (error) {
      console.error('Error getting site stats:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

