import { pool } from '../database';

export interface Message {
  id: number;
  user_id: number;
  text: string;
  created_at: Date;
}

export class MessageModel {
  /**
   * Получить последние сообщения пользователя
   */
  static async getUserMessages(
    userId: number,
    limit: number = 100
  ): Promise<Message[]> {
    const result = await pool.query(
      `SELECT * FROM messages 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows as Message[];
  }
}
