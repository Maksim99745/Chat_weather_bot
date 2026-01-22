import { Telegraf, Context, Markup } from 'telegraf';
import dotenv from 'dotenv';
import { testConnection } from './config/database';
import { redis } from './config/redis';
import { UserModel } from './models/UserModel';
import { MessageModel } from './models/MessageModel';
import { StatsHandler } from './handlers/statsHandler';
import { AnalyzeHandler } from './handlers/analyzeHandler';
import { WeatherHandler } from './handlers/weatherHandler';
import { CacheService } from './services/cacheService';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не установлен! Проверьте .env файл.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📊 Статистика', 'stats_all')],
    [Markup.button.callback('🌤️ Погода в чате', 'weather_today')],
  ]);
  
  ctx.reply(
    '🤖 Бот запущен и готов к работе!\n\nВыберите действие:',
    keyboard
  );
});

bot.command('stats', StatsHandler.handleStats);
bot.command('analyze', AnalyzeHandler.handleAnalyze);
bot.command('weather', WeatherHandler.handleWeather);
bot.command('погода', WeatherHandler.handleWeather);

bot.on('callback_query', async (ctx) => {
  const callbackData = 'callback_query' in ctx.update 
    ? ('data' in ctx.update.callback_query ? ctx.update.callback_query.data : null)
    : null;

  if (!callbackData) return;

  if (callbackData.startsWith('stats_') || callbackData.startsWith('user_stats_') || callbackData === 'stats_select_user') {
    await StatsHandler.handleStatsCallback(ctx);
  } else if (callbackData.startsWith('weather_')) {
    await WeatherHandler.handleWeatherCallback(ctx);
  } else if (callbackData === 'stats_all') {
    // Обработка кнопки "Статистика" из главного меню
    await ctx.answerCbQuery();
    await StatsHandler.handleStats(ctx);
  }
});

bot.on('message', async (ctx: Context) => {
  try {
    console.log('📨 Получено сообщение:', {
      chatType: ctx.chat?.type,
      hasMessage: !!ctx.message,
      messageType: ctx.message ? Object.keys(ctx.message)[0] : 'none'
    });

    if (!ctx.message) {
      console.log('⚠️ Сообщение отсутствует');
      return;
    }

    // Игнорируем команды
    if ('text' in ctx.message && ctx.message.text.startsWith('/')) {
      console.log('⏭️ Пропущена команда:', ctx.message.text);
      return;
    }

    // Сохраняем только текстовые сообщения
    if (!('text' in ctx.message)) {
      console.log('⏭️ Пропущено не текстовое сообщение');
      return;
    }

    const { from, text } = ctx.message;
    if (!from) {
      console.log('⚠️ Отсутствует информация об отправителе');
      return;
    }

    console.log(`💾 Сохранение сообщения от ${from.first_name || from.username || from.id}: ${text.substring(0, 30)}...`);

    const user = await UserModel.findOrCreate(
      from.id,
      from.username || null,
      from.first_name || null
    );

    await MessageModel.create(user.id, text);
    
    // Очищаем кэш статистики после сохранения нового сообщения
    await CacheService.clearPattern('stats:*');
    await CacheService.clearPattern('chat_weather:*');
    
    console.log(`✅ Сообщение сохранено: от ${from.first_name || from.username || from.id}, текст: ${text.substring(0, 50)}...`);
  } catch (error) {
    console.error('❌ Ошибка при сохранении сообщения:', error);
    if (error instanceof Error) {
      console.error('Детали ошибки:', error.message, error.stack);
    }
  }
});

bot.catch((err, ctx) => {
  console.error('Ошибка в боте:', err);
  if (ctx && 'reply' in ctx) {
    ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
});

async function testRedisConnection(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к Redis:', error);
    return false;
  }
}

async function start() {
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('❌ Не удалось подключиться к базе данных');
    process.exit(1);
  }

  const redisConnected = await testRedisConnection();
  if (!redisConnected) {
    console.warn('⚠️ Не удалось подключиться к Redis. Кэширование будет недоступно.');
  }

  bot.launch()
    .then(() => {
      console.log('✅ Bot started successfully!');
    })
    .catch((error) => {
      console.error('❌ Ошибка запуска бота:', error);
      process.exit(1);
    });
}

// Обработка сигналов для graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

start();
