const admin = require('firebase-admin');

class ScheduleManager {
  constructor(adminInstance = null) {
    // adminインスタンスが渡されない場合は、既存のものを使用
    if (adminInstance) {
      this.db = adminInstance.firestore();
    } else if (admin.apps.length > 0) {
      this.db = admin.firestore();
    } else {
      admin.initializeApp();
      this.db = admin.firestore();
    }
    
    this.collectionName = 'schedules';
    this.defaultSchedule = {
      enabled: false,
      interval: 'hourly',
      categories: ['entertainment', 'anime', 'game', 'movie', 'music', 'tech', 'beauty', 'food'],
      categoryIndex: 0,
      maxDailyPosts: 10,
      todayPostCount: 0,
      lastPostDate: null
    };
  }

  async getSchedule() {
    try {
      const doc = await this.db.collection(this.collectionName).doc('main').get();
      
      if (!doc.exists) {
        // 初回はデフォルト設定を作成
        await this.setSchedule(this.defaultSchedule);
        return this.defaultSchedule;
      }
      
      const data = doc.data();
      
      // NaN防止のためのバリデーション
      return {
        enabled: data.enabled || false,
        interval: data.interval || 'hourly',
        categories: data.categories || this.defaultSchedule.categories,
        categoryIndex: Number.isNaN(data.categoryIndex) ? 0 : (data.categoryIndex || 0),
        maxDailyPosts: Number.isNaN(data.maxDailyPosts) ? 10 : (data.maxDailyPosts || 10),
        todayPostCount: Number.isNaN(data.todayPostCount) ? 0 : (data.todayPostCount || 0),
        lastPostDate: data.lastPostDate || null
      };
    } catch (error) {
      console.error('Error getting schedule:', error);
      return this.defaultSchedule;
    }
  }

  async setSchedule(config) {
    try {
      // NaNチェックと型変換
      const cleanConfig = {
        enabled: Boolean(config.enabled),
        interval: config.interval || 'hourly',
        categories: Array.isArray(config.categories) ? config.categories : this.defaultSchedule.categories,
        categoryIndex: parseInt(config.categoryIndex) || 0,
        maxDailyPosts: parseInt(config.maxDailyPosts) || 10,
        todayPostCount: parseInt(config.todayPostCount) || 0,
        lastPostDate: config.lastPostDate || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await this.db.collection(this.collectionName).doc('main').set(cleanConfig, { merge: true });
      
      return { success: true, schedule: cleanConfig };
    } catch (error) {
      console.error('Error setting schedule:', error);
      throw error;
    }
  }

  async toggleSchedule(enabled) {
    try {
      const schedule = await this.getSchedule();
      schedule.enabled = Boolean(enabled);
      return await this.setSchedule(schedule);
    } catch (error) {
      console.error('Error toggling schedule:', error);
      throw error;
    }
  }

  async getNextCategory() {
    try {
      const schedule = await this.getSchedule();
      const category = schedule.categories[schedule.categoryIndex];
      
      // 次のインデックスに更新
      const nextIndex = (schedule.categoryIndex + 1) % schedule.categories.length;
      await this.setSchedule({ ...schedule, categoryIndex: nextIndex });
      
      return category;
    } catch (error) {
      console.error('Error getting next category:', error);
      return 'entertainment';
    }
  }

  async canExecute() {
    try {
      const schedule = await this.getSchedule();
      
      if (!schedule.enabled) {
        return { canExecute: false, reason: 'Schedule is disabled' };
      }
      
      const today = new Date().toDateString();
      const lastPostDate = schedule.lastPostDate ? new Date(schedule.lastPostDate).toDateString() : null;
      
      // 日付が変わったらカウントリセット
      if (lastPostDate !== today) {
        await this.resetDailyCount();
        return { canExecute: true };
      }
      
      if (schedule.todayPostCount >= schedule.maxDailyPosts) {
        return { canExecute: false, reason: 'Daily limit reached' };
      }
      
      return { canExecute: true };
    } catch (error) {
      console.error('Error checking canExecute:', error);
      return { canExecute: false, reason: error.message };
    }
  }

  async incrementTodayPostCount() {
    try {
      const schedule = await this.getSchedule();
      schedule.todayPostCount = (schedule.todayPostCount || 0) + 1;
      schedule.lastPostDate = new Date().toISOString();
      await this.setSchedule(schedule);
    } catch (error) {
      console.error('Error incrementing post count:', error);
    }
  }

  async resetDailyCount() {
    try {
      const schedule = await this.getSchedule();
      schedule.todayPostCount = 0;
      schedule.lastPostDate = new Date().toISOString();
      await this.setSchedule(schedule);
    } catch (error) {
      console.error('Error resetting daily count:', error);
    }
  }

  async recordPost() {
    return this.incrementTodayPostCount();
  }
}

module.exports = ScheduleManager;
