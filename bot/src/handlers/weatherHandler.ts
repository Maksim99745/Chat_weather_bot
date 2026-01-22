import { Context, Markup } from 'telegraf';
import { SentimentService } from '../services/sentimentService';
import { TimeFilter } from '../models/MessageModel';

const PERIOD_KEYBOARD = Markup.inlineKeyboard([
  [Markup.button.callback('📅 Сегодня', 'weather_today'), Markup.button.callback('📆 Неделя', 'weather_week')],
  [Markup.button.callback('📊 Месяц', 'weather_month'), Markup.button.callback('🌐 Всё время', 'weather_all')],
]);

const TIME_FILTER_MAP: Record<string, TimeFilter> = {
  'weather_today': 'today',
  'weather_week': 'week',
  'weather_month': 'month',
  'weather_all': 'all',
};

export class WeatherHandler {
  static async handleWeather(ctx: Context) {
    try {
      if (!process.env.GEMINI_API_KEY) {
        await ctx.reply('❌ Gemini API не настроен. Погода в чате недоступна.');
        return;
      }

      await ctx.reply('🌤️ Выберите период для просмотра погоды в чате:', PERIOD_KEYBOARD);
    } catch (error) {
      console.error('Ошибка в handleWeather:', error);
      await ctx.reply('Произошла ошибка при загрузке погоды в чате.');
    }
  }

  static async handleWeatherButton(ctx: Context, timeFilter: TimeFilter) {
    try {
      const loadingMessage = await ctx.reply('⏳ Анализирую настроение в чате...');
      const weather = await SentimentService.getChatWeather(timeFilter);
      const formatted = SentimentService.formatChatWeather(weather, timeFilter);

      await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMessage.message_id);
      await ctx.reply(formatted, PERIOD_KEYBOARD);
    } catch (error) {
      console.error('Ошибка в handleWeatherButton:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      await ctx.reply(`❌ Ошибка: ${errorMessage}`);
    }
  }

  static async handleWeatherCallback(ctx: Context) {
    const callbackData = 'callback_query' in ctx.update 
      ? ('data' in ctx.update.callback_query ? ctx.update.callback_query.data : null)
      : null;

    if (!callbackData || !(callbackData in TIME_FILTER_MAP)) {
      return;
    }

    if ('callback_query' in ctx.update) {
      await ctx.answerCbQuery();
    }

    await this.handleWeatherButton(ctx, TIME_FILTER_MAP[callbackData]);
  }
}
