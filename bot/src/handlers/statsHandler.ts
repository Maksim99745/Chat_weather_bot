import { Context, Markup } from 'telegraf';
import { StatsService } from '../services/statsService';
import { TimeFilter } from '../models/MessageModel';
import { UserModel, User } from '../models/UserModel';

export class StatsHandler {
  static async handleStats(ctx: Context) {
    try {
      const message = 'message' in ctx.update ? ctx.update.message : null;
      if (message && 'text' in message) {
        const args = message.text.split(' ').slice(1);
        if (args.length > 0) {
          const username = args[0].replace('@', '');
          await this.handleUserStatsByUsername(ctx, username);
          return;
        }
      }
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('📅 За сегодня', 'stats_today'),
          Markup.button.callback('📆 За неделю', 'stats_week'),
        ],
        [
          Markup.button.callback('📊 За месяц', 'stats_month'),
          Markup.button.callback('🌐 За всё время', 'stats_all'),
        ],
        [
          Markup.button.callback('👤 Выбрать пользователя', 'stats_select_user'),
        ],
        [
          Markup.button.callback('🌤️ Погода в чате', 'weather_today'),
        ],
      ]);

      await ctx.reply(
        '📊 Выберите период для статистики или пользователя:',
        keyboard
      );
    } catch (error) {
      console.error('Ошибка в handleStats:', error);
      await ctx.reply('Произошла ошибка при загрузке статистики.');
    }
  }

  static async handleStatsButton(ctx: Context, timeFilter: TimeFilter) {
    try {
      const loadingMessage = await ctx.reply('⏳ Загружаю статистику...');
      const [topUsers, overallStats] = await Promise.all([
        StatsService.getTopUsers(10, timeFilter),
        StatsService.getOverallStats(timeFilter),
      ]);

      const formattedStats = StatsService.formatFullStats(
        topUsers,
        overallStats,
        timeFilter
      );
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('📅 За сегодня', 'stats_today'),
          Markup.button.callback('📆 За неделю', 'stats_week'),
        ],
        [
          Markup.button.callback('📊 За месяц', 'stats_month'),
          Markup.button.callback('🌐 За всё время', 'stats_all'),
        ],
        [
          Markup.button.callback('👤 Выбрать пользователя', 'stats_select_user'),
        ],
        [
          Markup.button.callback('🌤️ Погода в чате', 'weather_today'),
        ],
      ]);

      await ctx.telegram.deleteMessage(
        ctx.chat!.id,
        loadingMessage.message_id
      );

      await ctx.reply(formattedStats, keyboard);
    } catch (error) {
      console.error('Ошибка в handleStatsButton:', error);
      if (error instanceof Error) {
        console.error('Детали ошибки:', error.message, error.stack);
      }
      await ctx.reply('Произошла ошибка при загрузке статистики.');
    }
  }

  static async handleStatsCallback(ctx: Context) {
    const callbackData = 'callback_query' in ctx.update 
      ? ('data' in ctx.update.callback_query ? ctx.update.callback_query.data : null)
      : null;

    if (!callbackData) {
      return;
    }

    // Обработка callback для статистики пользователя с периодом
    if (callbackData.startsWith('user_stats_')) {
      const parts = callbackData.replace('user_stats_', '').split('_');
      const userId = parseInt(parts[0]);
      const period = parts[1] as TimeFilter;
      
      if (!isNaN(userId) && ['today', 'week', 'month', 'all'].includes(period)) {
        await ctx.answerCbQuery();
        await this.handleUserStats(ctx, userId, period);
        return;
      }
    }

    // Определяем фильтр по времени из callback_data
    let timeFilter: TimeFilter = 'all';

    if (callbackData === 'stats_today') {
      timeFilter = 'today';
    } else if (callbackData === 'stats_week') {
      timeFilter = 'week';
    } else if (callbackData === 'stats_month') {
      timeFilter = 'month';
    } else if (callbackData === 'stats_all') {
      timeFilter = 'all';
    } else if (!callbackData.startsWith('stats_user_') && callbackData !== 'stats_select_user') {
      return; // Неизвестный callback
    }

    // Отвечаем на callback (убираем "часики" у кнопки)
    if ('callback_query' in ctx.update) {
      await ctx.answerCbQuery();
    }

    // Обрабатываем запрос статистики
    if (callbackData.startsWith('stats_user_')) {
      // Обработка выбора пользователя
      const userId = parseInt(callbackData.replace('stats_user_', ''));
      if (!isNaN(userId)) {
        await this.handleUserStats(ctx, userId, 'all');
      }
      return;
    }

    if (callbackData === 'stats_select_user') {
      // Показываем список пользователей
      await this.handleSelectUser(ctx);
      return;
    }

    // Обработка периодов
    await this.handleStatsButton(ctx, timeFilter);
  }

  static async handleSelectUser(ctx: Context) {
    try {
      const loadingMessage = await ctx.reply('⏳ Загружаю список пользователей...');

      // Получаем всех пользователей
      const users = await UserModel.findAll();

      if (users.length === 0) {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMessage.message_id);
        await ctx.reply('❌ Пользователи не найдены.');
        return;
      }

      // Создаём кнопки для каждого пользователя (максимум 50)
      const userButtons = users.slice(0, 50).map((user) => {
        const label = user.username 
          ? `@${user.username}` 
          : user.first_name || `ID: ${user.telegram_id}`;
        return [Markup.button.callback(label, `stats_user_${user.id}`)];
      });

      // Добавляем кнопку "Назад"
      userButtons.push([
        Markup.button.callback('🔙 Назад к статистике', 'stats_all'),
      ]);

      const keyboard = Markup.inlineKeyboard(userButtons);

      await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMessage.message_id);
      await ctx.reply('👤 Выберите пользователя:', keyboard);
    } catch (error) {
      console.error('Ошибка в handleSelectUser:', error);
      await ctx.reply('Произошла ошибка при загрузке списка пользователей.');
    }
  }

  static async handleUserStats(
    ctx: Context,
    userId: number,
    timeFilter: TimeFilter = 'all'
  ) {
    try {
      const loadingMessage = await ctx.reply('⏳ Загружаю статистику пользователя...');

      // Получаем пользователя и статистику
      const [user, stats] = await Promise.all([
        UserModel.findById(userId),
        StatsService.getUserStats(userId, timeFilter),
      ]);

      if (!user) {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMessage.message_id);
        await ctx.reply('❌ Пользователь не найден.');
        return;
      }

      // Форматируем результат
      const formattedStats = StatsService.formatUserStats(user, stats, timeFilter);

      // Создаём кнопки для переключения периода
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('📅 За сегодня', `user_stats_${userId}_today`),
          Markup.button.callback('📆 За неделю', `user_stats_${userId}_week`),
        ],
        [
          Markup.button.callback('📊 За месяц', `user_stats_${userId}_month`),
          Markup.button.callback('🌐 За всё время', `user_stats_${userId}_all`),
        ],
        [
          Markup.button.callback('🔙 Назад к статистике', 'stats_all'),
        ],
      ]);

      await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMessage.message_id);
      await ctx.reply(formattedStats, keyboard);
    } catch (error) {
      console.error('Ошибка в handleUserStats:', error);
      if (error instanceof Error) {
        console.error('Детали ошибки:', error.message, error.stack);
      }
      await ctx.reply('Произошла ошибка при загрузке статистики пользователя.');
    }
  }

  static async handleUserStatsByUsername(ctx: Context, username: string) {
    try {
      const loadingMessage = await ctx.reply('⏳ Ищу пользователя...');

      // Ищем пользователя по username
      const user = await UserModel.findByUsername(username);

      if (!user) {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMessage.message_id);
        await ctx.reply(`❌ Пользователь @${username} не найден в базе данных.`);
        return;
      }

      await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMessage.message_id);
      await this.handleUserStats(ctx, user.id, 'all');
    } catch (error) {
      console.error('Ошибка в handleUserStatsByUsername:', error);
      await ctx.reply('Произошла ошибка при поиске пользователя.');
    }
  }
}
