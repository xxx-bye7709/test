// blog-dashboard/src/app/api/products/search/route.ts
// DMM APIからのデータを正しく処理

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query') || '';
    const limit = searchParams.get('limit') || '10';

    console.log('Searching products with query:', query);

    // Firebase FunctionsのsearchProducts APIを呼び出し
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL}/searchProducts?keyword=${encodeURIComponent(query)}&hits=${limit}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    // DMM APIのレスポンスを正規化
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
                  product.iteminfo?.genre?.[0]?.name || 
                  '',
      rating: product.review?.average || '4.5',
      reviewCount: product.review?.count || 0,
      maker: product.iteminfo?.maker?.[0]?.name || '',
      genre: product.iteminfo?.genre?.map((g: any) => g.name).join(', ') || ''
    })) || [];

    console.log(`Found ${products.length} products`);
    console.log('Sample product:', products[0]);

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
