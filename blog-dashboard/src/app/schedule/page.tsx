// app/schedule/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar, Clock, Play, Pause, Settings, CheckCircle, XCircle,
  Info, TrendingUp, RotateCw, ArrowLeft, Loader2, Zap
} from 'lucide-react';

interface Schedule {
  enabled: boolean;
  interval: string;
  maxDailyPosts: number;  // maxPostsPerDay → maxDailyPosts に変更
  categories: string[];
  todayPostCount: number;
  lastUpdated?: string;
  nextPost?: string;
  lastCategoryIndex?: number;
  categoryIndex?: number;  // 追加
}

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [config, setConfig] = useState({
  interval: 'hourly',
  maxDailyPosts: 24,  // maxPostsPerDay → maxDailyPosts に変更
  categories: ['entertainment', 'anime', 'game']
});

  const FIREBASE_URL = 'https://asia-northeast1-blog-automation-system.cloudfunctions.net';

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
  try {
    const response = await fetch(`${FIREBASE_URL}/getSchedule`);
    const data = await response.json();
    if (data.success && data.schedule) {
      setSchedule(data.schedule);
      setConfig({
        interval: data.schedule.interval || 'hourly',
        maxDailyPosts: parseInt(data.schedule.maxDailyPosts) || 24,  // 修正
        categories: data.schedule.categories || ['entertainment', 'anime', 'game']
      });
    }
  } catch (error) {
    console.error('Failed to fetch schedule:', error);
    showMessage('スケジュール情報の取得に失敗しました', 'error');
  }
};

  const handleSetSchedule = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${FIREBASE_URL}/setSchedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await response.json();
      if (data.success) {
        showMessage('スケジュール設定を更新しました', 'success');
        await fetchSchedule();
      } else {
        showMessage('スケジュール設定の更新に失敗しました', 'error');
      }
    } catch (error) {
      showMessage('エラー: スケジュール設定の更新に失敗しました', 'error');
    }
    setLoading(false);
  };

  const handleToggleSchedule = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${FIREBASE_URL}/toggleSchedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !schedule?.enabled })
      });
      const data = await response.json();
      if (data.success) {
        showMessage(data.enabled ? 'スケジュールを開始しました' : 'スケジュールを停止しました', 'success');
        await fetchSchedule();
      } else {
        showMessage('スケジュールの切り替えに失敗しました', 'error');
      }
    } catch (error) {
      showMessage('エラー: スケジュールの切り替えに失敗しました', 'error');
    }
    setLoading(false);
  };

  const handleManualTrigger = async () => {
    setLoading(true);
    showMessage('手動実行中...', 'info');

    try {
      // カテゴリーからランダムに選択、またはデフォルト
      const selectedCategory = config.categories.length > 0
        ? config.categories[Math.floor(Math.random() * config.categories.length)]
        : 'entertainment';

      // カテゴリーに応じたエンドポイントを決定
      const categoryEndpoints: Record<string, string> = {
        'entertainment': '/generateEntertainmentArticle',
        'anime': '/generateAnimeArticle',
        'game': '/generateGameArticle',
        'movie': '/generateMovieArticle',
        'music': '/generateMusicArticle',
        'tech': '/generateTechArticle',
        'beauty': '/generateBeautyArticle',
        'food': '/generateFoodArticle'
      };

      const endpoint = categoryEndpoints[selectedCategory] || '/generateRandomArticle';

      const response = await fetch(`${FIREBASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled: true,
          manual: true,
          category: selectedCategory
        })
      });

      const data = await response.json();
      if (data.success || data.title) {
        showMessage(`記事を投稿しました: ${data.title || 'タイトル取得中...'}`, 'success');
        await fetchSchedule();
      } else {
        showMessage(data.message || '投稿に失敗しました', 'error');
      }
    } catch (error) {
      console.error('Manual trigger error:', error);
      showMessage('エラー: 手動実行に失敗しました', 'error');
    }
    setLoading(false);
  };

  const handleCategoryToggle = (category: string) => {
    setConfig(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  const showMessage = (msg: string, type: 'success' | 'error' | 'info') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const allCategories = ['entertainment', 'anime', 'game', 'movie', 'music', 'tech', 'beauty', 'food'];
  const categoryLabels: Record<string, string> = {
    entertainment: 'エンタメ',
    anime: 'アニメ',
    game: 'ゲーム',
    movie: '映画',
    music: '音楽',
    tech: 'テクノロジー',
    beauty: '美容',
    food: 'グルメ'
  };

  const categoryIcons: Record<string, string> = {
    entertainment: '🎬',
    anime: '🎌',
    game: '🎮',
    movie: '🎥',
    music: '🎵',
    tech: '💻',
    beauty: '💄',
    food: '🍜'
  };

  const categoryColors: Record<string, string> = {
    entertainment: 'from-purple-500 to-pink-500',
    anime: 'from-pink-500 to-purple-500',
    game: 'from-green-500 to-blue-500',
    movie: 'from-red-500 to-orange-500',
    music: 'from-blue-500 to-purple-500',
    tech: 'from-cyan-500 to-blue-500',
    beauty: 'from-pink-500 to-rose-500',
    food: 'from-orange-500 to-yellow-500'
  };

  const intervalOptions: Record<string, { label: string; maxPosts: number }> = {
    'hourly': { label: '1時間ごと', maxPosts: 24 },
    'every_2_hours': { label: '2時間ごと', maxPosts: 12 },
    'every_3_hours': { label: '3時間ごと', maxPosts: 8 },
    'every_6_hours': { label: '6時間ごと', maxPosts: 4 },
    'daily': { label: '1日1回', maxPosts: 1 }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* ヘッダー */}
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link href="/" className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg">
                  <Calendar className="w-6 h-6" />
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  自動投稿スケジューラー
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {schedule?.enabled ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-green-400 font-medium">稼働中</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg">
                  <XCircle className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-400 font-medium">停止中</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 通知 */}
      {message && (
        <div className={`fixed top-20 right-4 z-50 p-4 rounded-lg shadow-lg backdrop-blur-sm flex items-center space-x-2 ${
          messageType === 'success' ? 'bg-green-500/20 border border-green-500' :
          messageType === 'error' ? 'bg-red-500/20 border border-red-500' :
          'bg-blue-500/20 border border-blue-500'
        }`}>
          {messageType === 'success' ? <CheckCircle className="w-5 h-5" /> :
           messageType === 'error' ? <XCircle className="w-5 h-5" /> :
           <Loader2 className="w-5 h-5 animate-spin" />}
          <span>{message}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* 左側：設定パネル */}
          <div className="space-y-6">
            {/* 投稿間隔設定 */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-semibold">投稿間隔</h3>
              </div>
              <select
                value={config.interval}
                onChange={(e) => setConfig(prev => ({ ...prev, interval: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                {Object.entries(intervalOptions).map(([value, { label, maxPosts }]) => (
                  <option key={value} value={value}>
                    {label} (最大{maxPosts}記事/日)
                  </option>
                ))}
              </select>
              <p className="text-gray-400 text-sm mt-2">
                選択した間隔で自動的に記事が投稿されます
              </p>
            </div>

            {/* 1日の最大投稿数 */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <h3 className="text-lg font-semibold">1日の投稿上限</h3>
              </div>
              <input
                type="number"
                value={config.maxDailyPosts}
                onChange={(e) => setConfig(prev => ({ ...prev, maxDailyPosts: parseInt(e.target.value) }))}
                min="1"
                max="48"
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              />
              <p className="text-gray-400 text-sm mt-2">
                安全装置：24時間以内の最大投稿数を制限します
              </p>
            </div>

            {/* カテゴリー選択 */}
<div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
  <div className="flex items-center gap-2 mb-4">
    <RotateCw className="w-5 h-5 text-purple-400" />
    <h3 className="text-lg font-semibold">自動投稿カテゴリー</h3>
  </div>
  <div className="grid grid-cols-2 gap-3">
    {allCategories.map(category => (
      <label
        key={category}
        className="cursor-pointer"
      >
        <input
          type="checkbox"
          checked={config.categories.includes(category)}
          onChange={() => handleCategoryToggle(category)}
          className="sr-only"
        />
        <div className={`p-3 rounded-lg border transition-all flex items-center gap-2 ${
          config.categories.includes(category)
            ? 'bg-blue-600 border-blue-500 text-white'
            : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500'
        }`}>
          <span className="text-xl">{categoryIcons[category]}</span>
          <span className="font-medium">{categoryLabels[category]}</span>
        </div>
      </label>
    ))}
  </div>
  <p className="text-gray-400 text-sm mt-4">
    選択したカテゴリーを順番に投稿します
  </p>
</div>
          </div>

          {/* 右側：プレビューと統計 */}
          <div className="space-y-6">
            {/* 投稿プレビュー */}
<div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 backdrop-blur-sm rounded-xl border border-blue-700/50 p-6">
  <div className="flex items-center gap-2 mb-4">
    <Info className="w-5 h-5 text-blue-400" />
    <h3 className="text-lg font-semibold">投稿設定</h3>
  </div>

  <div className="space-y-4">
    <div className="bg-gray-900/50 rounded-lg p-4">
      <div className="flex justify-between items-center">
        <span className="text-gray-400">投稿間隔</span>
        <span className="text-white font-medium">
          {intervalOptions[config.interval].label}
        </span>
      </div>
    </div>

    <div className="bg-gray-900/50 rounded-lg p-4">
      <div className="flex justify-between items-center">
        <span className="text-gray-400">1日の最大投稿数</span>
        <span className="text-white font-medium">
          {config.maxDailyPosts}記事
        </span>
      </div>
    </div>

    <div className="bg-gray-900/50 rounded-lg p-4">
      <div className="flex justify-between items-center">
        <span className="text-gray-400">選択カテゴリー数</span>
        <span className="text-white font-medium">
          {config.categories.length}個
        </span>
      </div>
      {config.categories.length > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          順番: {config.categories.map(c => categoryLabels[c]).join(' → ')}
        </div>
      )}
    </div>

    {config.categories.length === 0 && (
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <p className="text-yellow-400 text-sm">
          ⚠️ 最低1つのカテゴリーを選択してください
        </p>
      </div>
    )}
  </div>
</div>

            {/* 現在の設定状態 */}
            {schedule && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                <h3 className="text-lg font-semibold mb-4">システム状態</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-700">
                    <span className="text-gray-400 text-sm">最終更新</span>
                    <span className="text-white text-sm">
                      {schedule.lastUpdated ? new Date(schedule.lastUpdated).toLocaleString('ja-JP') : '未設定'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-700">
                    <span className="text-gray-400 text-sm">次回投稿予定</span>
                    <span className="text-white text-sm">
                      {schedule.nextPost ? new Date(schedule.nextPost).toLocaleString('ja-JP') : '未設定'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-400 text-sm">本日の投稿数</span>
                    <span className="text-white text-sm">
                      {schedule.todayPostCount || 0} / {schedule.maxDailyPosts || 24}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* アクションボタン */}
            <div className="space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={handleSetSchedule}
                  disabled={loading || config.categories.length === 0}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <Settings className="w-5 h-5" />
                  設定を保存
                </button>
                <button
                  onClick={handleToggleSchedule}
                  disabled={loading || !schedule}
                  className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 shadow-lg ${
                    schedule?.enabled
                      ? 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-700 hover:to-red-600'
                      : 'bg-gradient-to-r from-green-600 to-green-500 text-white hover:from-green-700 hover:to-green-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {schedule?.enabled ? (
                    <>
                      <Pause className="w-5 h-5" />
                      スケジュール停止
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      スケジュール開始
                    </>
                  )}
                </button>
              </div>

              {/* 手動実行ボタン */}
              <button
                onClick={handleManualTrigger}
                disabled={loading || config.categories.length === 0}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Zap className="w-5 h-5" />
                今すぐ投稿（手動実行）
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
