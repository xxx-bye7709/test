// blog-dashboard/src/app/api/products/generate/route.ts
// 完全修正版 - アフィリエイトリンク、画像、フォーマット問題解決

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { products, keyword, autoPost = false } = body;

    console.log('Generating article for products:', products);

    // 商品データの正規化と検証
    const normalizedProducts = products.map((product: any) => {
      // アフィリエイトリンクの正しい取得
      const affiliateUrl = product.affiliateURL || 
                          product.affiliateUrl || 
                          product.URL || 
                          product.url || 
                          '';

      // 画像URLの正しい取得
      const imageUrl = product.imageURL?.large || 
                      product.imageURL?.small || 
                      product.image || 
                      product.imageUrl || 
                      '';

      return {
        title: product.title || '',
        price: product.price || product.prices?.price || '',
        affiliateUrl: affiliateUrl,
        imageUrl: imageUrl,
        description: product.iteminfo?.series?.[0]?.name || 
                    product.iteminfo?.genre?.[0]?.name || 
                    product.description || '',
        rating: product.review?.average || '4.5',
        maker: product.iteminfo?.maker?.[0]?.name || ''
      };
    });

    // OpenAI APIで記事生成
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `
以下の商品について、アフィリエイト記事を作成してください。

商品情報：
${normalizedProducts.map((p: any, i: number) => `
商品${i + 1}:
- 商品名: ${p.title}
- 価格: ${p.price}
- 説明: ${p.description}
- 評価: ${p.rating}
`).join('\n')}

要件：
1. HTMLタグを使用（h2, p, ul, liなど）
2. 商品ごとにアフィリエイトリンクボタンを配置
3. 3000文字以上
4. SEOを意識した構成
5. 購買意欲を高める内容

重要：
- コードブロック記号（\`\`\`）は使用しない
- HTMLタグは直接記述する
- 不要な改行は避ける`
        }],
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    const aiData = await openAIResponse.json();
    let content = aiData.choices[0].message.content;

    // コンテンツのクリーンアップ
    content = content
      .replace(/```html/g, '')
      .replace(/```/g, '')
      .replace(/^\s+/gm, '') // 各行の先頭の空白を削除
      .replace(/\n{3,}/g, '\n\n') // 3つ以上の改行を2つに
      .trim();

    // 各商品のアフィリエイトリンクと画像を挿入
    normalizedProducts.forEach((product: any, index: number) => {
      // アフィリエイトリンクボタンの生成
      if (product.affiliateUrl) {
        const linkButton = `
<div style="text-align: center; margin: 30px 0;">
  <a href="${product.affiliateUrl}" target="_blank" rel="noopener noreferrer sponsored" 
     style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%); 
            color: white; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 18px; 
            box-shadow: 0 4px 15px rgba(255,107,107,0.4);">
    ${product.title}を購入する ≫
  </a>
</div>`;
        
        // 商品名の後にボタンを挿入
        const productPattern = new RegExp(`(${product.title.substring(0, 20)}[^<]*)`, 'i');
        content = content.replace(productPattern, `$1${linkButton}`);
      }

      // 画像の挿入
      if (product.imageUrl) {
        const imageTag = `
<div style="text-align: center; margin: 20px 0;">
  <img src="${product.imageUrl}" alt="${product.title}" 
       style="max-width: 100%; height: auto; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
</div>`;
        
        // 最初の商品紹介部分に画像を挿入
        if (index === 0) {
          const h2Pattern = /<h2[^>]*>([^<]*)<\/h2>/;
          content = content.replace(h2Pattern, `$&${imageTag}`);
        }
      }
    });

    // タイトルの生成
    const title = `【${keyword}】おすすめ${normalizedProducts.length}選！${new Date().getFullYear()}年最新版`;

    // WordPress投稿データの準備
    const postData = {
      title: title,
      content: content,
      status: autoPost ? 'publish' : 'draft',
      categories: [1], // カテゴリID（必要に応じて変更）
      tags: [keyword, 'レビュー', '比較', 'おすすめ', `${new Date().getFullYear()}年`],
      featured_media: null, // アイキャッチ画像（別途処理が必要）
      meta: {
        description: `${keyword}の人気商品${normalizedProducts.length}選を徹底比較。価格、評価、特徴を詳しく解説します。`,
        keywords: `${keyword},レビュー,比較,おすすめ,${normalizedProducts.map((p: any) => p.title.substring(0, 20)).join(',')}`
      }
    };

    // WordPress投稿処理
    if (autoPost) {
      const wpResponse = await fetch(
        `${process.env.NEXT_PUBLIC_WORDPRESS_URL}/wp-json/wp/v2/posts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(
              `${process.env.NEXT_PUBLIC_WORDPRESS_USERNAME}:${process.env.WORDPRESS_PASSWORD}`
            ).toString('base64')}`
          },
          body: JSON.stringify(postData)
        }
      );

      if (!wpResponse.ok) {
        // REST APIが失敗した場合、XML-RPCにフォールバック
        console.log('REST API failed, falling back to XML-RPC');
        // XML-RPC処理（Firebase Functions経由）
        const fbResponse = await fetch(
          `${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL}/postToWordPress`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(postData)
          }
        );
        const fbResult = await fbResponse.json();
        
        return NextResponse.json({
          success: true,
          content: content,
          title: title,
          postId: fbResult.postId,
          postUrl: fbResult.url,
          method: 'xml-rpc'
        });
      }

      const wpResult = await wpResponse.json();
      
      return NextResponse.json({
        success: true,
        content: content,
        title: title,
        postId: wpResult.id,
        postUrl: wpResult.link,
        method: 'rest-api'
      });
    }

    // 下書きまたはプレビューのみ
    return NextResponse.json({
      success: true,
      content: content,
      title: title,
      products: normalizedProducts,
      preview: true
    });

  } catch (error) {
    console.error('Article generation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      },
      { status: 500 }
    );
  }
}
