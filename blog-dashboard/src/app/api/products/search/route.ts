// src/app/api/products/search/route.ts を修正
// 大文字のKを試す

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query') || '';
    const limit = searchParams.get('limit') || '10';

    console.log('Searching products with query:', query);

    // simpleDMMTest関数を使用（デバッグ用）
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL}/simpleDMMTest`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          Keyword: query,  // 大文字のK
          limit: parseInt(limit)
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Search API error:', errorText);
      
      // simpleDMMTestも失敗したら、GETメソッドを試す
      const getResponse = await fetch(
        `${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL}/searchProducts?keyword=${encodeURIComponent(query)}&limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (getResponse.ok) {
        const data = await getResponse.json();
        const products = data.products || [];
        return NextResponse.json({
          success: true,
          products: products,
          total: products.length
        });
      }
      
      throw new Error(`Search failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    // レスポンスを正規化
    const products = data.products?.map((product: any) => ({
      id: product.content_id || product.cid || Math.random().toString(36),
      title: product.title || '',
      price: product.prices?.price || product.price || '価格不明',
      affiliateURL: product.affiliateURL || product.affiliateUrl || '',
      URL: product.URL || '',
      imageURL: {
        large: product.imageURL?.large || '',
        small: product.imageURL?.small || ''
      },
      description: product.iteminfo?.series?.[0]?.name || '',
      rating: product.review?.average || '4.5',
      maker: product.iteminfo?.maker?.[0]?.name || ''
    })) || [];

    return NextResponse.json({
      success: true,
      products: products,
      total: products.length,
      query: query
    });

  } catch (error) {
    console.error('Product search error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        products: []
      },
      { status: 500 }
    );
  }
}
