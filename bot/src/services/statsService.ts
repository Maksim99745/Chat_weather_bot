import { MessageModel, TimeFilter, TopUser } from '../models/MessageModel';
import { CacheService } from './cacheService';
import { UserModel, User } from '../models/UserModel';

export class StatsService {
  /**
   * Получить топ пользователей с кэшированием
   * @param limit - Количество пользователей
   * @param timeFilter - Фильтр по времени
   * @returns Топ пользователей
   */
  static async getTopUsers(
    limit: number = 10,
    timeFilter: TimeFilter = 'all'
  ): Promise<TopUser[]> {
    const cacheKey = `stats:top_users:${limit}:${timeFilter}`;

    const cached = await CacheService.get<TopUser[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const topUsers = await MessageModel.getTopUsers(limit, timeFilter);
    await CacheService.set(cacheKey, topUsers);
    return topUsers;
  }

  static async getOverallStats(timeFilter: TimeFilter = 'all'): Promise<{
    totalMessages: number;
    totalUsers: number;
  }> {
    const cacheKey = `stats:overall:${timeFilter}`;
    const cached = await CacheService.get<{ totalMessages: number; totalUsers: number }>(cacheKey);
    if (cached) {
      return cached;
    }

    const stats = await MessageModel.getOverallStats(timeFilter);
    await CacheService.set(cacheKey, stats);
    return stats;
  }

  /**
   * Форматировать топ пользователей для вывода
   * @param topUsers - Массив пользователей
   * @param timeFilter - Фильтр по времени
   * @returns Отформатированная строка
   */
  static formatTopUsers(topUsers: TopUser[], timeFilter: TimeFilter): string {
    if (topUsers.length === 0) {
      return '📊 Пока нет сообщений в этом периоде.';
    }

    const periodLabel = this.getPeriodLabel(timeFilter);
    let result = `📊 Статистика чата ${periodLabel}:\n\n`;

    topUsers.forEach((user) => {
      const username = user.username 
        ? `@${user.username}` 
        : user.first_name || `ID: ${user.user_id}`;
      
      result += `${user.rank}. ${username} - ${user.message_count} сообщений\n`;
    });

    return result;
  }

  static async getUserStats(
    userId: number,
    timeFilter: TimeFilter = 'all'
  ): Promise<{
    messageCount: number;
    firstMessage: Date | null;
    lastMessage: Date | null;
    avgLength: number;
  }> {
    const cacheKey = `stats:user:${userId}:${timeFilter}`;
    const cached = await CacheService.get<{
      messageCount: number;
      firstMessage: Date | null;
      lastMessage: Date | null;
      avgLength: number;
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    const stats = await MessageModel.getStatsByUser(userId, timeFilter);
    await CacheService.set(cacheKey, stats);
    return stats;
  }

  /**
   * Получить метку периода для отображения
   * @param timeFilter - Фильтр по времени
   * @returns Текстовая метка
   */
  private static getPeriodLabel(timeFilter: TimeFilter): string {
    switch (timeFilter) {
      case 'today':
        return 'за сегодня';
      case 'week':
        return 'за неделю';
      case 'month':
        return 'за месяц';
      case 'all':
      default:
        return 'за всё время';
    }
  }

  /**
   * Форматировать полную статистику (топ + общая)
   * @param topUsers - Топ пользователей
   * @param overallStats - Общая статистика
   * @param timeFilter - Фильтр по времени
   * @returns Отформатированная строка
   */
  static formatFullStats(
    topUsers: TopUser[],
    overallStats: { totalMessages: number; totalUsers: number },
    timeFilter: TimeFilter
  ): string {
    const periodLabel = this.getPeriodLabel(timeFilter);
    let result = `📊 Статистика чата ${periodLabel}:\n\n`;

    if (topUsers.length === 0) {
      result += 'Пока нет сообщений в этом периоде.\n';
      return result;
    }

    // Топ пользователей
    topUsers.forEach((user) => {
      const username = user.username 
        ? `@${user.username}` 
        : user.first_name || `ID: ${user.user_id}`;
      
      result += `${user.rank}. ${username} - ${user.message_count} сообщений\n`;
    });

    result += '\n';
    result += `Всего: ${overallStats.totalMessages.toLocaleString('ru-RU')} сообщений от ${overallStats.totalUsers} пользователей`;

    return result;
  }

  /**
   * Форматировать статистику пользователя
   * @param user - Пользователь
   * @param stats - Статистика пользователя
   * @param timeFilter - Фильтр по времени
   * @returns Отформатированная строка
   */
  static formatUserStats(
    user: User,
    stats: {
      messageCount: number;
      firstMessage: Date | null;
      lastMessage: Date | null;
      avgLength: number;
    },
    timeFilter: TimeFilter
  ): string {
    const periodLabel = this.getPeriodLabel(timeFilter);
    const username = user.username 
      ? `@${user.username}` 
      : user.first_name || `ID: ${user.telegram_id}`;

    let result = `👤 Статистика пользователя ${username} ${periodLabel}:\n\n`;
    
    result += `📝 Сообщений: ${stats.messageCount.toLocaleString('ru-RU')}\n`;
    result += `📏 Средняя длина: ${Math.round(stats.avgLength)} символов\n`;

    if (stats.firstMessage) {
      const firstDate = new Date(stats.firstMessage);
      result += `📅 Первое сообщение: ${firstDate.toLocaleDateString('ru-RU')}\n`;
    }

    if (stats.lastMessage) {
      const lastDate = new Date(stats.lastMessage);
      result += `📅 Последнее сообщение: ${lastDate.toLocaleDateString('ru-RU')}\n`;
    }

    return result;
  }
}
