import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserModel, User } from '../UserModel';
import { pool } from '../../config/database';

// Мокаем pool
vi.mock('../../config/database', () => ({
  pool: {
    query: vi.fn(),
  },
}));

describe('UserModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findOrCreate', () => {
    it('должен вернуть существующего пользователя', async () => {
      const mockUser: User = {
        id: 1,
        telegram_id: 123456,
        username: 'testuser',
        first_name: 'Test',
        created_at: new Date(),
      };

      (pool.query as any).mockResolvedValueOnce({
        rows: [mockUser],
      });

      const result = await UserModel.findOrCreate(123456, 'testuser', 'Test');

      expect(result).toEqual(mockUser);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE telegram_id = $1',
        [123456]
      );
    });

    it('должен создать нового пользователя, если не найден', async () => {
      const newUser: User = {
        id: 2,
        telegram_id: 789012,
        username: 'newuser',
        first_name: 'New',
        created_at: new Date(),
      };

      // Первый запрос - не найден
      (pool.query as any).mockResolvedValueOnce({
        rows: [],
      });

      // Второй запрос - создание
      (pool.query as any).mockResolvedValueOnce({
        rows: [newUser],
      });

      const result = await UserModel.findOrCreate(789012, 'newuser', 'New');

      expect(result).toEqual(newUser);
      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO users'),
        [789012, 'newuser', 'New']
      );
    });

    it('должен обновить username и first_name, если они изменились', async () => {
      const existingUser: User = {
        id: 1,
        telegram_id: 123456,
        username: 'olduser',
        first_name: 'Old',
        created_at: new Date(),
      };

      const updatedUser: User = {
        ...existingUser,
        username: 'newuser',
        first_name: 'New',
      };

      // Найден пользователь
      (pool.query as any).mockResolvedValueOnce({
        rows: [existingUser],
      });

      // Обновление
      (pool.query as any).mockResolvedValueOnce({
        rows: [],
      });

      const result = await UserModel.findOrCreate(123456, 'newuser', 'New');

      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        'UPDATE users SET username = $1, first_name = $2 WHERE telegram_id = $3',
        ['newuser', 'New', 123456]
      );
    });
  });

  describe('findById', () => {
    it('должен вернуть пользователя по ID', async () => {
      const mockUser: User = {
        id: 1,
        telegram_id: 123456,
        username: 'testuser',
        first_name: 'Test',
        created_at: new Date(),
      };

      (pool.query as any).mockResolvedValueOnce({
        rows: [mockUser],
      });

      const result = await UserModel.findById(1);

      expect(result).toEqual(mockUser);
      expect(pool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
    });

    it('должен вернуть null, если пользователь не найден', async () => {
      (pool.query as any).mockResolvedValueOnce({
        rows: [],
      });

      const result = await UserModel.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByTelegramId', () => {
    it('должен вернуть пользователя по Telegram ID', async () => {
      const mockUser: User = {
        id: 1,
        telegram_id: 123456,
        username: 'testuser',
        first_name: 'Test',
        created_at: new Date(),
      };

      (pool.query as any).mockResolvedValueOnce({
        rows: [mockUser],
      });

      const result = await UserModel.findByTelegramId(123456);

      expect(result).toEqual(mockUser);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE telegram_id = $1',
        [123456]
      );
    });
  });

  describe('findByUsername', () => {
    it('должен вернуть пользователя по username', async () => {
      const mockUser: User = {
        id: 1,
        telegram_id: 123456,
        username: 'testuser',
        first_name: 'Test',
        created_at: new Date(),
      };

      (pool.query as any).mockResolvedValueOnce({
        rows: [mockUser],
      });

      const result = await UserModel.findByUsername('testuser');

      expect(result).toEqual(mockUser);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE username = $1',
        ['testuser']
      );
    });
  });
});
