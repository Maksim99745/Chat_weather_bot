import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Создаём пул подключений к PostgreSQL
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Максимальное количество подключений в пуле
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Проверка подключения при старте
pool.on('connect', () => {
  console.log('✅ Подключение к PostgreSQL установлено');
});

pool.on('error', (err) => {
  console.error('❌ Ошибка подключения к PostgreSQL:', err);
});

// Функция для проверки подключения
export async function testConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Тест подключения к БД успешен:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Ошибка теста подключения к БД:', error);
    return false;
  }
}
