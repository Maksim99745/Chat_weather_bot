import { redis, CACHE_TTL_SECONDS } from '../config/redis';

export class CacheService {
  /**
   * Получить значение из кэша
   * @param key - Ключ кэша
   * @returns Значение или null
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`Ошибка при получении из кэша (ключ: ${key}):`, error);
      return null;
    }
  }

  /**
   * Сохранить значение в кэш
   * @param key - Ключ кэша
   * @param value - Значение для сохранения
   * @param ttl - Время жизни в секундах (по умолчанию из конфига)
   * @returns true если успешно
   */
  static async set(
    key: string,
    value: any,
    ttl: number = CACHE_TTL_SECONDS
  ): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      await redis.setex(key, ttl, serialized);
      return true;
    } catch (error) {
      console.error(`Ошибка при сохранении в кэш (ключ: ${key}):`, error);
      return false;
    }
  }

  /**
   * Удалить значение из кэша
   * @param key - Ключ кэша
   * @returns true если успешно
   */
  static async delete(key: string): Promise<boolean> {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error(`Ошибка при удалении из кэша (ключ: ${key}):`, error);
      return false;
    }
  }

  /**
   * Очистить все ключи по паттерну
   * @param pattern - Паттерн для поиска ключей (например, "stats:*")
   * @returns Количество удалённых ключей
   */
  static async clearPattern(pattern: string): Promise<number> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }
      await redis.del(...keys);
      return keys.length;
    } catch (error) {
      console.error(`Ошибка при очистке кэша по паттерну (${pattern}):`, error);
      return 0;
    }
  }
}
