import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CacheService } from '../cacheService';
import { redis } from '../../config/redis';

// Мокаем redis
vi.mock('../../config/redis', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
  },
  CACHE_TTL_SECONDS: 1200,
}));

describe('CacheService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('должен вернуть значение из кэша', async () => {
      const mockValue = { data: 'test' };
      (redis.get as any).mockResolvedValueOnce(JSON.stringify(mockValue));

      const result = await CacheService.get('test_key');

      expect(result).toEqual(mockValue);
      expect(redis.get).toHaveBeenCalledWith('test_key');
    });

    it('должен вернуть null, если ключ не найден', async () => {
      (redis.get as any).mockResolvedValueOnce(null);

      const result = await CacheService.get('non_existent');

      expect(result).toBeNull();
    });

    it('должен вернуть null при ошибке', async () => {
      (redis.get as any).mockRejectedValueOnce(new Error('Redis error'));

      const result = await CacheService.get('error_key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('должен сохранить значение в кэш', async () => {
      const value = { data: 'test' };
      (redis.setex as any).mockResolvedValueOnce('OK');

      const result = await CacheService.set('test_key', value, 600);

      expect(result).toBe(true);
      expect(redis.setex).toHaveBeenCalledWith(
        'test_key',
        600,
        JSON.stringify(value)
      );
    });

    it('должен использовать TTL по умолчанию', async () => {
      const value = { data: 'test' };
      (redis.setex as any).mockResolvedValueOnce('OK');

      await CacheService.set('test_key', value);

      expect(redis.setex).toHaveBeenCalledWith(
        'test_key',
        1200, // CACHE_TTL_SECONDS
        JSON.stringify(value)
      );
    });

    it('должен вернуть false при ошибке', async () => {
      (redis.setex as any).mockRejectedValueOnce(new Error('Redis error'));

      const result = await CacheService.set('error_key', { data: 'test' });

      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('должен удалить значение из кэша', async () => {
      (redis.del as any).mockResolvedValueOnce(1);

      const result = await CacheService.delete('test_key');

      expect(result).toBe(true);
      expect(redis.del).toHaveBeenCalledWith('test_key');
    });

    it('должен вернуть false при ошибке', async () => {
      (redis.del as any).mockRejectedValueOnce(new Error('Redis error'));

      const result = await CacheService.delete('error_key');

      expect(result).toBe(false);
    });
  });

  describe('clearPattern', () => {
    it('должен удалить все ключи по паттерну', async () => {
      (redis.keys as any).mockResolvedValueOnce(['key1', 'key2', 'key3']);
      (redis.del as any).mockResolvedValueOnce(3);

      const result = await CacheService.clearPattern('stats:*');

      expect(result).toBe(3);
      expect(redis.keys).toHaveBeenCalledWith('stats:*');
      expect(redis.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
    });

    it('должен вернуть 0, если ключи не найдены', async () => {
      (redis.keys as any).mockResolvedValueOnce([]);

      const result = await CacheService.clearPattern('non_existent:*');

      expect(result).toBe(0);
    });

    it('должен вернуть 0 при ошибке', async () => {
      (redis.keys as any).mockRejectedValueOnce(new Error('Redis error'));

      const result = await CacheService.clearPattern('error:*');

      expect(result).toBe(0);
    });
  });
});
