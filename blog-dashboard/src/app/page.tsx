'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SiteManagement from '@/components/SiteManagement';  // ← 追加


export default function Home() {
  const [stats, setStats] = useState({
    todayCount: 0,
    weekCount: 0,
    monthCount: 0,
    totalCount: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/metrics');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const generatePost = async (category) => {
    setLoading(true);
    try {
      const response = await fetch('/api/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category })
      });
      const data = await response.json();
      if (data.success) {
        alert('記事が生成されました！');
        fetchStats();
      } else {
        alert(`エラー: ${data.error}`);
      }
    } catch (error) {
      alert('記事生成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* ヘッダー */}
      <header className="bg-gray-800 p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Blog Automation Dashboard</h1>
          <nav className="flex gap-4">
            <Link href="/" className="hover:text-blue-400">ダッシュボード</Link>
            <Link href="/products" className="hover:text-blue-400">商品記事</Link>
            <Link href="/schedule" className="hover:text-blue-400">スケジュール</Link>
          </nav>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container mx-auto p-8">
        {/* 統計 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 p-6 rounded-lg">
            <div className="text-3xl font-bold">{stats.todayCount}</div>
            <div className="text-gray-400">本日の投稿</div>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <div className="text-3xl font-bold">{stats.weekCount}</div>
            <div className="text-gray-400">今週の投稿</div>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <div className="text-3xl font-bold">{stats.monthCount}</div>
            <div className="text-gray-400">今月の投稿</div>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <div className="text-3xl font-bold">{stats.totalCount}</div>
            <div className="text-gray-400">総投稿数</div>
          </div>
        </div>

        <SiteManagement />

        {/* クイックアクション */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/products" className="bg-blue-600 p-6 rounded-lg hover:bg-blue-700 text-center">
            <div className="text-xl mb-2">📦</div>
            <div>商品記事作成</div>
          </Link>
          <button 
            onClick={() => generatePost('entertainment')}
            disabled={loading}
            className="bg-purple-600 p-6 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <div className="text-xl mb-2">🎬</div>
            <div>エンタメ記事</div>
          </button>
          <Link href="/schedule" className="bg-green-600 p-6 rounded-lg hover:bg-green-700 text-center">
            <div className="text-xl mb-2">📅</div>
            <div>スケジュール</div>
          </Link>
          <button 
            onClick={() => generatePost('tech')}
            disabled={loading}
            className="bg-orange-600 p-6 rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            <div className="text-xl mb-2">💻</div>
            <div>テック記事</div>
          </button>
        </div>
      </main>
    </div>
  );
}
