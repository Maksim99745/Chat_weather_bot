import { Context } from 'telegraf';
import { GeminiService } from '../services/geminiService';
import { UserModel } from '../models/UserModel';

export class AnalyzeHandler {
  /**
   * Обработчик команды /analyze
   */
  static async handleAnalyze(ctx: Context) {
    try {
      // Проверяем, есть ли Gemini API ключ
      if (!process.env.GEMINI_API_KEY) {
        await ctx.reply('❌ Gemini API не настроен. Проверьте GEMINI_API_KEY в конфигурации.');
        return;
      }

      const message = 'message' in ctx.update ? ctx.update.message : null;
      
      if (!message) {
        await ctx.reply('Использование:\n/analyze @username\nили ответьте на сообщение пользователя командой /analyze');
        return;
      }

      // Проверяем, есть ли reply (ответ на сообщение)
      if ('reply_to_message' in message && message.reply_to_message) {
        const repliedMessage = message.reply_to_message;
        if ('from' in repliedMessage && repliedMessage.from) {
          // Анализируем пользователя, на чьё сообщение ответили
          await this.analyzeUserByTelegramId(ctx, repliedMessage.from.id);
          return;
        }
      }

      // Проверяем аргументы команды
      if ('text' in message) {
        const args = message.text.split(' ').slice(1);
        if (args.length > 0) {
          const username = args[0].replace('@', '');
          await this.analyzeUserByUsername(ctx, username);
          return;
        }
      }

      // Если нет аргументов и нет reply
      await ctx.reply(
        'Использование:\n' +
        '/analyze @username - проанализировать пользователя по username\n' +
        'или ответьте на сообщение пользователя командой /analyze'
      );
    } catch (error) {
      console.error('Ошибка в handleAnalyze:', error);
      await ctx.reply('Произошла ошибка при анализе пользователя.');
    }
  }

  /**
   * Анализировать пользователя по username
   */
  static async analyzeUserByUsername(ctx: Context, username: string) {
    try {
      const loadingMessage = await ctx.reply('⏳ Анализирую пользователя...');

      // Ищем пользователя по username
      const user = await UserModel.findByUsername(username);

      if (!user) {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMessage.message_id);
        await ctx.reply(`❌ Пользователь @${username} не найден в базе данных.`);
        return;
      }

      // Анализируем пользователя
      const analysis = await GeminiService.analyzeUser(user.id);

      if (!analysis) {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMessage.message_id);
        await ctx.reply('❌ Не удалось проанализировать пользователя.');
        return;
      }

      // Форматируем и отправляем результат
      const formatted = GeminiService.formatAnalysis(user, analysis);

      await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMessage.message_id);
      await ctx.reply(formatted);
    } catch (error) {
      console.error('Ошибка в analyzeUserByUsername:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      await ctx.reply(`❌ Ошибка: ${errorMessage}`);
    }
  }

  /**
   * Анализировать пользователя по Telegram ID
   */
  static async analyzeUserByTelegramId(ctx: Context, telegramId: number) {
    try {
      const loadingMessage = await ctx.reply('⏳ Анализирую пользователя...');

      // Ищем пользователя по Telegram ID
      const user = await UserModel.findByTelegramId(telegramId);

      if (!user) {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMessage.message_id);
        await ctx.reply('❌ Пользователь не найден в базе данных.');
        return;
      }

      // Анализируем пользователя
      const analysis = await GeminiService.analyzeUser(user.id);

      if (!analysis) {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMessage.message_id);
        await ctx.reply('❌ Не удалось проанализировать пользователя.');
        return;
      }

      // Форматируем и отправляем результат
      const formatted = GeminiService.formatAnalysis(user, analysis);

      await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMessage.message_id);
      await ctx.reply(formatted);
    } catch (error) {
      console.error('Ошибка в analyzeUserByTelegramId:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      await ctx.reply(`❌ Ошибка: ${errorMessage}`);
    }
  }
}
