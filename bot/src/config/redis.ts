import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '1200', 10); // По умолчанию 20 минут

// Создаём клиент Redis
export const redis = new Redis(REDIS_URL, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

// Обработка ошибок подключения
redis.on('connect', () => {
  console.log('✅ Подключение к Redis установлено');
});

redis.on('error', (err) => {
  console.error('❌ Ошибка подключения к Redis:', err);
});

// Экспортируем TTL для использования в других модулях
export const CACHE_TTL_SECONDS = CACHE_TTL;
