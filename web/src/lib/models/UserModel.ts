import { pool } from '../database';

export interface User {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  created_at: Date;
}

export class UserModel {
  /**
   * Найти пользователя по username
   */
  static async findByUsername(username: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    return result.rows.length > 0 ? (result.rows[0] as User) : null;
  }

  /**
   * Найти пользователя по ID
   */
  static async findById(id: number): Promise<User | null> {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows.length > 0 ? (result.rows[0] as User) : null;
  }
}
