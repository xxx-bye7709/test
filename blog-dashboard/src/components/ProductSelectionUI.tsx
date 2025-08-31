'use client';

import { useState } from 'react';

export default function ProductSelectionUI() {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 商品検索
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setMessage('検索キーワードを入力してください');
      return;
    }

    setLoading(true);
    setMessage('検索中...');
    setProducts([]);

    try {
      const response = await fetch(`/api/products/search?query=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (data.products && data.products.length > 0) {
        setProducts(data.products);
        setMessage(`${data.products.length}件の商品が見つかりました`);
      } else {
        setMessage('商品が見つかりませんでした');
      }
    } catch (error) {
      console.error('Search error:', error);
      setMessage('検索エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // 商品選択
  const toggleSelect = (product) => {
    const isSelected = selectedProducts.some(p => 
      (p.content_id && p.content_id === product.content_id) || 
      (p.title === product.title)
    );
    
    if (isSelected) {
      setSelectedProducts(selectedProducts.filter(p => 
        !((p.content_id && p.content_id === product.content_id) || 
          (p.title === product.title))
      ));
    } else {
      setSelectedProducts([...selectedProducts, product]);
    }
  };

  // レビュー記事生成
  const handleGenerate = async () => {
    if (selectedProducts.length === 0) {
      setMessage('商品を選択してください');
      return;
    }

    setLoading(true);
    setMessage('記事を生成中...');

    try {
      const response = await fetch('/api/products/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          products: selectedProducts,
          keyword: searchQuery,
          source: 'dmm',
          autoPost: true
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage('✅ 記事生成に成功しました！');
        setSelectedProducts([]);
      } else {
        setMessage(`エラー: ${data.error || '記事生成に失敗しました'}`);
      }
    } catch (error) {
      console.error('Generate error:', error);
      setMessage('記事生成中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full bg-white dark:bg-gray-900 p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">商品レビュー記事作成</h2>
      
      {/* 検索エリア */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="商品検索キーワード（例：アニメ、ゲーム）"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            disabled={loading}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            検索
          </button>
        </div>
      </div>

      {/* メッセージ表示 */}
      {message && (
        <div className={`mb-4 p-3 rounded ${
          message.includes('エラー') ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' : 
          message.includes('成功') ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' : 
          'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
        }`}>
          {message}
        </div>
      )}

      {/* 商品リスト */}
      {products.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">検索結果</h3>
          <div className="border border-gray-300 dark:border-gray-600 rounded p-2 max-h-96 overflow-y-auto bg-white dark:bg-gray-800">
            {products.map((product, index) => {
              const isSelected = selectedProducts.some(p => 
                (p.content_id && p.content_id === product.content_id) || 
                (p.title === product.title)
              );
              
              return (
                <div
                  key={index}
                  onClick={() => toggleSelect(product)}
                  className={`p-3 mb-2 border rounded cursor-pointer ${
                    isSelected 
                      ? 'bg-blue-50 border-blue-500 dark:bg-blue-900 dark:border-blue-400' 
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="mr-3 mt-1"
                    />
                    <div className="flex-1">
                      {/* ⭐ 画像表示を追加 */}
                      {product.imageURL?.small && (
                        <img 
                          src={product.imageURL.small} 
                          alt={product.title}
                          className="w-24 h-24 object-cover rounded-md mr-3 flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.src = 'https://via.placeholder.com/300x200?text=No+Image';
                          }}
                        />
                      )}
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{product.title || '商品名なし'}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {product.description || product.comment || '説明なし'}
                      </div>
                      <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                        {product.price || '価格未定'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* アクションエリア */}
      {selectedProducts.length > 0 && (
        <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800 rounded">
          <span className="text-gray-900 dark:text-gray-100">選択中: {selectedProducts.length}件</span>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
          >
            {loading ? '処理中...' : 'レビュー記事を生成'}
          </button>
        </div>
      )}
    </div>
  );
}
