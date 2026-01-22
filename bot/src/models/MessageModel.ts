import { pool } from '../config/database';

export interface Message {
  id: number;
  user_id: number;
  text: string;
  created_at: Date;
}

export interface UserStats {
  user_id: number;
  username: string | null;
  first_name: string | null;
  message_count: number;
}

export interface TopUser extends UserStats {
  rank: number;
}

export type TimeFilter = 'today' | 'week' | 'month' | 'all';

export class MessageModel {
  /**
   * Создать новое сообщение
   * @param userId - ID пользователя в БД
   * @param text - Текст сообщения
   * @returns Созданное сообщение
   */
  static async create(userId: number, text: string): Promise<Message> {
    const result = await pool.query(
      `INSERT INTO messages (user_id, text) 
       VALUES ($1, $2) 
       RETURNING *`,
      [userId, text]
    );

    return result.rows[0] as Message;
  }

  /**
   * Получить статистику по пользователю за период
   * @param userId - ID пользователя в БД
   * @param timeFilter - Фильтр по времени
   * @returns Статистика пользователя
   */
  static async getStatsByUser(
    userId: number,
    timeFilter: TimeFilter = 'all'
  ): Promise<{
    messageCount: number;
    firstMessage: Date | null;
    lastMessage: Date | null;
    avgLength: number;
  }> {
    const { clause, params } = this.getTimeFilterClause(timeFilter, 2);
    const queryParams = [userId, ...params];
    
    const result = await pool.query(
      `SELECT 
        COUNT(*) as message_count,
        MIN(created_at) as first_message,
        MAX(created_at) as last_message,
        AVG(LENGTH(text)) as avg_length
       FROM messages 
       WHERE user_id = $1 ${clause}`,
      queryParams
    );

    const row = result.rows[0];
    return {
      messageCount: parseInt(row.message_count) || 0,
      firstMessage: row.first_message || null,
      lastMessage: row.last_message || null,
      avgLength: parseFloat(row.avg_length) || 0,
    };
  }

  /**
   * Получить топ пользователей по количеству сообщений
   * @param limit - Количество пользователей в топе
   * @param timeFilter - Фильтр по времени
   * @returns Массив пользователей с количеством сообщений
   */
  static async getTopUsers(
    limit: number = 10,
    timeFilter: TimeFilter = 'all'
  ): Promise<TopUser[]> {
    const { clause, params } = this.getTimeFilterClause(timeFilter, 1);
    
    let query: string;
    let queryParams: any[];

    if (clause) {
      // Есть фильтр по времени
      const timeCondition = clause.replace(/^AND\s+/, '').replace(/created_at/g, 'm.created_at');
      query = `SELECT 
        u.id as user_id,
        u.username,
        u.first_name,
        COUNT(m.id) as message_count
       FROM users u
       INNER JOIN messages m ON u.id = m.user_id
       WHERE ${timeCondition}
       GROUP BY u.id, u.username, u.first_name
       ORDER BY message_count DESC
       LIMIT $${params.length + 1}`;
      queryParams = [...params, limit];
    } else {
      // Нет фильтра по времени
      query = `SELECT 
        u.id as user_id,
        u.username,
        u.first_name,
        COUNT(m.id) as message_count
       FROM users u
       INNER JOIN messages m ON u.id = m.user_id
       GROUP BY u.id, u.username, u.first_name
       ORDER BY message_count DESC
       LIMIT $1`;
      queryParams = [limit];
    }

    const result = await pool.query(query, queryParams);

    return result.rows.map((row, index) => ({
      rank: index + 1,
      user_id: row.user_id,
      username: row.username,
      first_name: row.first_name,
      message_count: parseInt(row.message_count) || 0,
    })) as TopUser[];
  }

  /**
   * Получить последние сообщения пользователя
   * @param userId - ID пользователя в БД
   * @param limit - Количество сообщений
   * @returns Массив сообщений
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

  /**
   * Получить общую статистику чата
   * @param timeFilter - Фильтр по времени
   * @returns Общая статистика
   */
  static async getOverallStats(
    timeFilter: TimeFilter = 'all'
  ): Promise<{
    totalMessages: number;
    totalUsers: number;
  }> {
    const { clause, params } = this.getTimeFilterClause(timeFilter, 1);
    const whereCondition = clause 
      ? `WHERE ${clause.replace(/^AND\s+/, '')}`
      : '';

    const messagesResult = await pool.query(
      `SELECT COUNT(*) as total FROM messages ${whereCondition}`,
      params
    );

    const usersResult = await pool.query(
      `SELECT COUNT(DISTINCT user_id) as total FROM messages ${whereCondition}`,
      params
    );

    return {
      totalMessages: parseInt(messagesResult.rows[0].total) || 0,
      totalUsers: parseInt(usersResult.rows[0].total) || 0,
    };
  }

  /**
   * Получить SQL условие для фильтра по времени
   * @param timeFilter - Тип фильтра
   * @returns Объект с SQL условием и параметрами
   */
  private static getTimeFilterClause(timeFilter: TimeFilter, paramOffset: number = 1): {
    clause: string;
    params: any[];
  } {
    const now = new Date();
    let startDate: Date;

    switch (timeFilter) {
      case 'today':
        // Начало текущего дня в UTC
        startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        return {
          clause: `AND created_at >= $${paramOffset}::timestamp`,
          params: [startDate],
        };
      
      case 'week':
        startDate = new Date(now);
        startDate.setUTCDate(now.getUTCDate() - 7);
        startDate.setUTCHours(0, 0, 0, 0);
        return {
          clause: `AND created_at >= $${paramOffset}::timestamp`,
          params: [startDate],
        };
      
      case 'month':
        startDate = new Date(now);
        startDate.setUTCMonth(now.getUTCMonth() - 1);
        startDate.setUTCHours(0, 0, 0, 0);
        return {
          clause: `AND created_at >= $${paramOffset}::timestamp`,
          params: [startDate],
        };
      
      case 'all':
      default:
        return {
          clause: '',
          params: [],
        };
    }
  }
}
