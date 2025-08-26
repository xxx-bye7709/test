// src/app/api/products/search/route.ts

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query') || '';
    const limit = searchParams.get('limit') || '10';

    console.log('Searching products with query:', query);

    // GETリクエストでクエリパラメータとして送信
    const params = new URLSearchParams({
      keyword: query,
      limit: limit,
      page: '1'
    });
    
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL}/searchProductsForDashboard?${params}`,
      {
        method: 'GET',  // GETメソッドに変更
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Search API error:', errorText);
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
      description: product.iteminfo?.series?.[0]?.name || 
                  product.iteminfo?.genre?.[0]?.name || '',
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
