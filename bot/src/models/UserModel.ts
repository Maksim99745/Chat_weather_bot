import { pool } from '../config/database';

export interface User {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  created_at: Date;
}

export class UserModel {
  /**
   * Найти или создать пользователя
   * @param telegramId - Telegram ID пользователя
   * @param username - Username пользователя (может быть null)
   * @param firstName - Имя пользователя (может быть null)
   * @returns Пользователь из БД
   */
  static async findOrCreate(
    telegramId: number,
    username: string | null = null,
    firstName: string | null = null
  ): Promise<User> {
    // Сначала пытаемся найти существующего пользователя
    const findResult = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramId]
    );

    if (findResult.rows.length > 0) {
      // Пользователь найден, обновляем username и first_name если они изменились
      const user = findResult.rows[0] as User;
      if (user.username !== username || user.first_name !== firstName) {
        await pool.query(
          'UPDATE users SET username = $1, first_name = $2 WHERE telegram_id = $3',
          [username, firstName, telegramId]
        );
        return {
          ...user,
          username,
          first_name: firstName,
        };
      }
      return user;
    }

    // Пользователь не найден, создаём нового
    const insertResult = await pool.query(
      `INSERT INTO users (telegram_id, username, first_name) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [telegramId, username, firstName]
    );

    return insertResult.rows[0] as User;
  }

  /**
   * Найти пользователя по ID
   * @param id - ID пользователя в БД
   * @returns Пользователь или null
   */
  static async findById(id: number): Promise<User | null> {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows.length > 0 ? (result.rows[0] as User) : null;
  }

  /**
   * Найти пользователя по Telegram ID
   * @param telegramId - Telegram ID пользователя
   * @returns Пользователь или null
   */
  static async findByTelegramId(telegramId: number): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    return result.rows.length > 0 ? (result.rows[0] as User) : null;
  }

  /**
   * Найти пользователя по username
   * @param username - Username пользователя (без @)
   * @returns Пользователь или null
   */
  static async findByUsername(username: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    return result.rows.length > 0 ? (result.rows[0] as User) : null;
  }

  /**
   * Получить всех пользователей
   * @returns Массив пользователей
   */
  static async findAll(): Promise<User[]> {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    return result.rows as User[];
  }
}
