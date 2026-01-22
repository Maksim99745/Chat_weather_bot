import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageModel, Message, TimeFilter } from '../MessageModel';
import { pool } from '../../config/database';

// Мокаем pool
vi.mock('../../config/database', () => ({
  pool: {
    query: vi.fn(),
  },
}));

describe('MessageModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('должен создать новое сообщение', async () => {
      const mockMessage: Message = {
        id: 1,
        user_id: 1,
        text: 'Test message',
        created_at: new Date(),
      };

      (pool.query as any).mockResolvedValueOnce({
        rows: [mockMessage],
      });

      const result = await MessageModel.create(1, 'Test message');

      expect(result).toEqual(mockMessage);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO messages'),
        [1, 'Test message']
      );
    });
  });

  describe('getStatsByUser', () => {
    it('должен вернуть статистику пользователя', async () => {
      const mockStats = {
        message_count: '10',
        first_message: new Date('2024-01-01'),
        last_message: new Date('2024-01-10'),
        avg_length: '50.5',
      };

      (pool.query as any).mockResolvedValueOnce({
        rows: [mockStats],
      });

      const result = await MessageModel.getStatsByUser(1, 'all');

      expect(result.messageCount).toBe(10);
      expect(result.avgLength).toBe(50.5);
      expect(result.firstMessage).toBeInstanceOf(Date);
      expect(result.lastMessage).toBeInstanceOf(Date);
    });

    it('должен применять фильтр по времени', async () => {
      (pool.query as any).mockResolvedValueOnce({
        rows: [{
          message_count: '5',
          first_message: null,
          last_message: null,
          avg_length: '30',
        }],
      });

      const result = await MessageModel.getStatsByUser(1, 'today');

      expect(result.messageCount).toBe(5);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1'),
        expect.any(Array)
      );
    });
  });

  describe('getTopUsers', () => {
    it('должен вернуть топ пользователей', async () => {
      const mockTopUsers = [
        {
          user_id: 1,
          username: 'user1',
          first_name: 'User 1',
          message_count: '100',
        },
        {
          user_id: 2,
          username: 'user2',
          first_name: 'User 2',
          message_count: '50',
        },
      ];

      (pool.query as any).mockResolvedValueOnce({
        rows: mockTopUsers,
      });

      const result = await MessageModel.getTopUsers(10, 'all');

      expect(result).toHaveLength(2);
      expect(result[0].rank).toBe(1);
      expect(result[0].message_count).toBe(100);
      expect(result[1].rank).toBe(2);
      expect(result[1].message_count).toBe(50);
    });

    it('должен применять лимит', async () => {
      (pool.query as any).mockResolvedValueOnce({
        rows: [],
      });

      await MessageModel.getTopUsers(5, 'all');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([5])
      );
    });
  });

  describe('getUserMessages', () => {
    it('должен вернуть сообщения пользователя', async () => {
      const mockMessages: Message[] = [
        {
          id: 1,
          user_id: 1,
          text: 'Message 1',
          created_at: new Date(),
        },
        {
          id: 2,
          user_id: 1,
          text: 'Message 2',
          created_at: new Date(),
        },
      ];

      (pool.query as any).mockResolvedValueOnce({
        rows: mockMessages,
      });

      const result = await MessageModel.getUserMessages(1, 100);

      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('Message 1');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1'),
        [1, 100]
      );
    });
  });

  describe('getOverallStats', () => {
    it('должен вернуть общую статистику', async () => {
      (pool.query as any)
        .mockResolvedValueOnce({
          rows: [{ total: '1000' }],
        })
        .mockResolvedValueOnce({
          rows: [{ total: '50' }],
        });

      const result = await MessageModel.getOverallStats('all');

      expect(result.totalMessages).toBe(1000);
      expect(result.totalUsers).toBe(50);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });
  });
});
