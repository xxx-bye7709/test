// 完全修正版 - フォールバック付き
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { products, keyword, autoPost = false } = body;

    console.log('Generating article for products:', products);

    // 商品データの正規化
    const normalizedProducts = products.map((product: any) => ({
      title: product.title || '',
      price: product.price || '',
      affiliateUrl: product.affiliateURL || product.affiliateUrl || '',
      imageUrl: product.imageURL?.large || product.imageURL?.small || '',
      description: product.description || '',
      rating: product.rating || '4.5'
    }));

    // OpenAI API呼び出し（エラーハンドリング付き）
    let content = '';
    let useOpenAI = true;
    
    if (process.env.OPENAI_API_KEY) {
      try {
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
              content: `商品レビュー記事を作成。HTMLタグのみ使用。コードブロック記号は使用禁止。商品：${normalizedProducts.map(p => p.title).join(', ')}`
            }],
            temperature: 0.7,
            max_tokens: 3000
          })
        });

        if (openAIResponse.ok) {
          const aiData = await openAIResponse.json();
          if (aiData.choices && aiData.choices[0]) {
            content = aiData.choices[0].message.content;
            useOpenAI = true;
          }
        }
      } catch (e) {
        console.error('OpenAI API error:', e);
        useOpenAI = false;
      }
    } else {
      useOpenAI = false;
    }

    // フォールバックまたはOpenAI生成コンテンツ
    if (!useOpenAI || !content) {
      content = `
<h2>おすすめ商品${normalizedProducts.length}選</h2>
${normalizedProducts.map((p, i) => `
<div style="border: 1px solid #ddd; padding: 20px; margin: 20px 0; border-radius: 10px;">
  <h3>${i + 1}. ${p.title}</h3>
  ${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.title}" style="max-width: 300px;">` : ''}
  <p><strong>価格:</strong> ${p.price}</p>
  <div style="margin: 20px 0;">
    <a href="${p.affiliateUrl}" target="_blank" rel="noopener noreferrer sponsored" 
       style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%); 
              color: white; text-decoration: none; border-radius: 30px; font-weight: bold;">
      商品を購入する →
    </a>
  </div>
</div>
`).join('')}`;
    }

    // 不要な文字を削除
    content = content
      .replace(/```html?/gi, '')
      .replace(/```/g, '')
      .replace(/^\s+|\s+$/gm, '')
      .replace(/\n{3,}/g, '\n\n');

    const title = `【${keyword}】おすすめ${normalizedProducts.length}選`;

    // WordPress投稿
    if (autoPost) {
      // Firebase Functions経由で投稿
      const wpResponse = await fetch(
        `${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL}/generateProductReview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productData: normalizedProducts[0],
            keyword: keyword,
            autoPost: true
          })
        }
      );
      
      const wpResult = await wpResponse.json();
      return NextResponse.json({
        success: true,
        content: content,
        title: title,
        postId: wpResult.postId,
        postUrl: wpResult.postUrl
      });
    }

    return NextResponse.json({
      success: true,
      content: content,
      title: title,
      products: normalizedProducts
    });

  } catch (error) {
    console.error('Article generation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
