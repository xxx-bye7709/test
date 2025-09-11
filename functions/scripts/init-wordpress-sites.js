// functions/scripts/init-wordpress-sites.js
// 4サイト対応のWordPress初期化スクリプト

const admin = require('firebase-admin');

// Firebase Admin SDK の初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function initializeWordPressSites() {
  console.log('🚀 WordPress サイト（4サイト）の初期化を開始します...');
  
  try {
    // 1. 現在稼働中のサイト（entamade.jp）
    const entamadeSite = {
      name: "エンタメイド",
      url: "https://www.entamade.jp",
      xmlrpcUrl: "https://www.entamade.jp/xmlrpc.php",
      username: "entamade",
      password: "IChL 1yMu 4OUF YpL6 Wz8d oxln",
      categories: [
        "entertainment",
        "anime", 
        "game",
        "movie",
        "music",
        "tech",
        "beauty",
        "FANZA",
        "R18",
        "エンターテインメント",
        "エンタメ",
        "food"
      ],
      dmmApiKey: "65HMBVSGX4VpAKwfHxtg", // 後で設定
      dmmAffiliateId: "entermaid-990", // 既存の値があれば設定
      enabled: true,
      isDefault: true,
      priority: 1, // 投稿優先度
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUsed: admin.firestore.FieldValue.serverTimestamp(),
      postCount: 0,
      lastPostAt: null
    };
    
    await db.collection('wordpress_sites').doc('entamade_jp').set(entamadeSite);
    console.log('✅ サイト1: entamade.jp を登録しました');
    
    // 2. 追加サイト用のプレースホルダー（3サイト）
    const placeholderSites = [
      {
        id: 'site_2',
        name: "Gameinfo Ruka",
        priority: 2
      },
      {
        id: 'site_3',
        name: "AnimeBook", 
        priority: 3
      },
      {
        id: 'site_4',
        name: "本LOVE",
        priority: 4
      }
    ];
    
    for (const site of placeholderSites) {
      await db.collection('wordpress_sites').doc(site.id).set({
        name: site.name,
        url: "",
        xmlrpcUrl: "",
        username: "",
        password: "",
        categories: [],
        dmmApiKey: "",
        dmmAffiliateId: "",
        enabled: false, // 初期は無効
        isDefault: false,
        priority: site.priority,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUsed: null,
        postCount: 0,
        lastPostAt: null
      });
      console.log(`✅ ${site.name} のプレースホルダーを作成しました`);
    }
    
    // 3. グローバル設定の初期化
    await db.collection('system_config').doc('wordpress_settings').set({
      totalSites: 4,
      activeSites: 1,
      multiSiteEnabled: false, // Phase 4で true に変更
      defaultPostMode: 'single', // single | multiple | all
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ システム設定を初期化しました');
    
    // 4. 登録結果の確認
    console.log('\n📊 登録済みサイト一覧:');
    const snapshot = await db.collection('wordpress_sites').orderBy('priority').get();
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  ${data.priority}. ${doc.id}: ${data.name} (有効: ${data.enabled})`);
    });
    
    console.log('\n✨ WordPress 4サイト体制の初期化が完了しました！');
    console.log('📝 追加サイトの情報は後から更新してください。');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// 実行
console.log('⚠️  このスクリプトは Firestore に WordPress サイト情報を初期化します。');
console.log('既存のデータがある場合は上書きされます。');
console.log('続行するには Enter キーを押してください...');

process.stdin.once('data', () => {
  initializeWordPressSites();
});
