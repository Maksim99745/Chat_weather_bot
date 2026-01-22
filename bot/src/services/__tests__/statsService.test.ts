import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatsService } from '../statsService';
import { MessageModel, TopUser, TimeFilter } from '../../models/MessageModel';
import { CacheService } from '../cacheService';

// Мокаем зависимости
vi.mock('../../models/MessageModel');
vi.mock('../cacheService');

describe('StatsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTopUsers', () => {
    it('должен вернуть топ пользователей из кэша, если есть', async () => {
      const cachedUsers: TopUser[] = [
        {
          rank: 1,
          user_id: 1,
          username: 'user1',
          first_name: 'User 1',
          message_count: 100,
        },
      ];

      (CacheService.get as any).mockResolvedValueOnce(cachedUsers);

      const result = await StatsService.getTopUsers(10, 'all');

      expect(result).toEqual(cachedUsers);
      expect(CacheService.get).toHaveBeenCalledWith('stats:top_users:10:all');
      expect(MessageModel.getTopUsers).not.toHaveBeenCalled();
    });

    it('должен получить данные из БД и сохранить в кэш, если нет в кэше', async () => {
      const dbUsers: TopUser[] = [
        {
          rank: 1,
          user_id: 1,
          username: 'user1',
          first_name: 'User 1',
          message_count: 100,
        },
      ];

      (CacheService.get as any).mockResolvedValueOnce(null);
      (MessageModel.getTopUsers as any).mockResolvedValueOnce(dbUsers);
      (CacheService.set as any).mockResolvedValueOnce(true);

      const result = await StatsService.getTopUsers(10, 'today');

      expect(result).toEqual(dbUsers);
      expect(MessageModel.getTopUsers).toHaveBeenCalledWith(10, 'today');
      expect(CacheService.set).toHaveBeenCalledWith(
        'stats:top_users:10:today',
        dbUsers,
        1200
      );
    });
  });

  describe('getOverallStats', () => {
    it('должен вернуть общую статистику из кэша, если есть', async () => {
      const cachedStats = {
        totalMessages: 1000,
        totalUsers: 50,
      };

      (CacheService.get as any).mockResolvedValueOnce(cachedStats);

      const result = await StatsService.getOverallStats('all');

      expect(result).toEqual(cachedStats);
      expect(CacheService.get).toHaveBeenCalledWith('stats:overall:all');
      expect(MessageModel.getOverallStats).not.toHaveBeenCalled();
    });

    it('должен получить данные из БД и сохранить в кэш, если нет в кэше', async () => {
      const dbStats = {
        totalMessages: 1000,
        totalUsers: 50,
      };

      (CacheService.get as any).mockResolvedValueOnce(null);
      (MessageModel.getOverallStats as any).mockResolvedValueOnce(dbStats);
      (CacheService.set as any).mockResolvedValueOnce(true);

      const result = await StatsService.getOverallStats('week');

      expect(result).toEqual(dbStats);
      expect(MessageModel.getOverallStats).toHaveBeenCalledWith('week');
      expect(CacheService.set).toHaveBeenCalledWith(
        'stats:overall:week',
        dbStats,
        1200
      );
    });
  });

  describe('formatTopUsers', () => {
    it('должен отформатировать топ пользователей', () => {
      const topUsers: TopUser[] = [
        {
          rank: 1,
          user_id: 1,
          username: 'user1',
          first_name: null,
          message_count: 100,
        },
        {
          rank: 2,
          user_id: 2,
          username: null,
          first_name: 'User 2',
          message_count: 50,
        },
      ];

      const result = StatsService.formatTopUsers(topUsers, 'all');

      expect(result).toContain('@user1');
      expect(result).toContain('100 сообщений');
      expect(result).toContain('User 2');
      expect(result).toContain('50 сообщений');
    });

    it('должен вернуть сообщение, если нет пользователей', () => {
      const result = StatsService.formatTopUsers([], 'all');

      expect(result).toContain('нет сообщений');
    });
  });

  describe('formatFullStats', () => {
    it('должен отформатировать полную статистику', () => {
      const topUsers: TopUser[] = [
        {
          rank: 1,
          user_id: 1,
          username: 'user1',
          first_name: null,
          message_count: 100,
        },
      ];

      const overallStats = {
        totalMessages: 1000,
        totalUsers: 50,
      };

      const result = StatsService.formatFullStats(topUsers, overallStats, 'all');

      expect(result).toContain('@user1');
      expect(result).toContain('1,000');
      expect(result).toContain('50');
    });
  });
});
