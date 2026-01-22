import { GoogleGenerativeAI } from '@google/generative-ai';
import Sentiment from 'sentiment';
import dotenv from 'dotenv';
import { MessageModel, Message, TimeFilter } from '../models/MessageModel';
import { UserModel, User } from '../models/UserModel';
import { CacheService } from './cacheService';
import { pool } from '../config/database';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY не установлен. Анализ тональности будет недоступен.');
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Модель Gemini - можно изменить на gemini-3-flash-preview, gemini-2.0-flash-exp или gemini-1.5-pro
const GEMINI_MODEL = "gemini-2.0-flash-exp";

// Инициализация библиотеки sentiment для fallback-анализа
// Библиотека сама анализирует английские слова из встроенного словаря
const sentiment = new Sentiment();

export interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

export interface ChatWeather {
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  totalMessages: number;
  weatherEmoji: string;
  weatherDescription: string;
  topPositiveUser: {
    user: User;
    count: number;
  } | null;
  topNegativeUser: {
    user: User;
    count: number;
  } | null;
}

export class SentimentService {
  /**
   * Анализировать тональность одного сообщения
   */
  static async analyzeSentiment(text: string): Promise<SentimentResult> {
    if (!genAI) {
      return this.fallbackSentimentAnalysis(text);
    }

    const prompt = `Определи тональность следующего сообщения из Telegram группового чата.

Правила:
- "positive" - позитивное, дружелюбное, радостное сообщение (например: "спасибо", "отлично", "класс", "супер", "молодец", "ура", "поздравляю", "браво", "умница", "здорово", "круто")
- "negative" - негативное, грубое, оскорбительное сообщение (например: "урод", "fuck", "ненавижу", "плохо", ругательства, оскорбления)
- "neutral" - нейтральное, информационное сообщение без эмоций

Важно: Сообщения с поздравлениями, похвалой, радостью всегда "positive". Сообщения с оскорблениями, ругательствами, негативом всегда "negative".

Сообщение: "${text}"

Ответ ТОЛЬКО одним словом: positive, negative или neutral`;

    try {
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const sentimentText = response.text().trim().toLowerCase();

      let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
      if (sentimentText.includes('positive')) {
        sentiment = 'positive';
      } else if (sentimentText.includes('negative')) {
        sentiment = 'negative';
      }

      return {
        sentiment,
        confidence: sentimentText.includes(sentiment) ? 0.8 : 0.5,
      };
    } catch (error: any) {
      console.error('Ошибка при анализе тональности:', error);
      
      // Обработка ошибки квоты - используем fallback анализ
      if (error?.message?.includes('429') || error?.message?.includes('quota') || error?.message?.includes('Quota exceeded')) {
        console.warn('⚠️ Превышен лимит Gemini API, используем fallback анализ тональности');
        return this.fallbackSentimentAnalysis(text);
      }
      
      // При других ошибках тоже используем fallback
      return this.fallbackSentimentAnalysis(text);
    }
  }

  /**
   * Fallback анализ тональности с использованием библиотеки sentiment
   * Библиотека сама анализирует слова из встроенного словаря (в основном английские)
   */
  private static fallbackSentimentAnalysis(text: string): SentimentResult {
    try {
      // Библиотека sentiment сама анализирует текст и возвращает score
      const result = sentiment.analyze(text);
      const score = result.score;
      
      // Определяем тональность на основе score от библиотеки
      // score > 0 = позитивное, score < 0 = негативное, score = 0 = нейтральное
      if (score < 0) {
        return { sentiment: 'negative', confidence: 0.8 };
      } else if (score > 0) {
        return { sentiment: 'positive', confidence: 0.8 };
      }
      
      return { sentiment: 'neutral', confidence: 0.6 };
    } catch (error) {
      console.error('Ошибка в fallback анализе:', error);
      return { sentiment: 'neutral', confidence: 0.5 };
    }
  }

  /**
   * Получить погоду в чате за период
   */
  static async getChatWeather(timeFilter: TimeFilter = 'today'): Promise<ChatWeather> {
    const cacheKey = `chat_weather:${timeFilter}`;
    const cached = await CacheService.get<ChatWeather>(cacheKey);
    if (cached) {
      return cached;
    }

    const messages = await this.getMessagesByFilter(timeFilter);

    if (messages.length === 0) {
      return {
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0,
        totalMessages: 0,
        weatherEmoji: '🌫️',
        weatherDescription: 'Нет сообщений в этом периоде',
        topPositiveUser: null,
        topNegativeUser: null,
      };
    }

    const sampleSize = Math.min(messages.length, 100);
    const sampledMessages = messages.slice(0, sampleSize);

    const sentimentCounts: Record<string, number> = {
      positive: 0,
      negative: 0,
      neutral: 0,
    };

    const userSentiments: Record<number, { positive: number; negative: number }> = {};

    let fallbackUsed = 0;
    for (const message of sampledMessages) {
      const sentiment = await this.analyzeSentiment(message.text);
      if (sentiment.confidence < 0.6) {
        fallbackUsed++;
      }
      sentimentCounts[sentiment.sentiment]++;

      if (!userSentiments[message.user_id]) {
        userSentiments[message.user_id] = { positive: 0, negative: 0 };
      }
      if (sentiment.sentiment === 'positive') {
        userSentiments[message.user_id].positive++;
      } else if (sentiment.sentiment === 'negative') {
        userSentiments[message.user_id].negative++;
      }
    }

    const scale = messages.length / sampleSize;
    const positiveCount = Math.round(sentimentCounts.positive * scale);
    const negativeCount = Math.round(sentimentCounts.negative * scale);
    const neutralCount = messages.length - positiveCount - negativeCount;

    const { weatherEmoji, weatherDescription } = this.getWeatherEmoji(
      positiveCount,
      negativeCount,
      messages.length
    );

    const topPositiveUser = await this.findTopSentimentUser(userSentiments, 'positive');
    const topNegativeUser = await this.findTopSentimentUser(userSentiments, 'negative');

    if (fallbackUsed > 0) {
      console.log(`⚠️ Использован fallback анализ для ${fallbackUsed} из ${sampledMessages.length} сообщений (возможно, превышена квота API)`);
    }

    const result: ChatWeather = {
      positiveCount,
      negativeCount,
      neutralCount,
      totalMessages: messages.length,
      weatherEmoji,
      weatherDescription,
      topPositiveUser,
      topNegativeUser,
    };

    await CacheService.set(cacheKey, result, 600);

    return result;
  }

  private static async getMessagesByFilter(timeFilter: TimeFilter): Promise<Message[]> {
    const now = new Date();
    let query: string;
    let params: any[];

    switch (timeFilter) {
      case 'today': {
        const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        query = `SELECT * FROM messages WHERE created_at >= $1 ORDER BY created_at DESC`;
        params = [startDate];
        break;
      }
      case 'week': {
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        query = `SELECT * FROM messages WHERE created_at >= $1 ORDER BY created_at DESC`;
        params = [startDate];
        break;
      }
      case 'month': {
        const startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        query = `SELECT * FROM messages WHERE created_at >= $1 ORDER BY created_at DESC`;
        params = [startDate];
        break;
      }
      case 'all':
      default:
        query = `SELECT * FROM messages ORDER BY created_at DESC LIMIT 1000`;
        params = [];
        break;
    }

    const result = await pool.query(query, params);
    return result.rows as Message[];
  }

  private static getWeatherEmoji(
    positive: number,
    negative: number,
    total: number
  ): { weatherEmoji: string; weatherDescription: string } {
    if (total === 0) {
      return { weatherEmoji: '🌫️', weatherDescription: 'Нет данных' };
    }

    const positiveRatio = positive / total;
    const negativeRatio = negative / total;

    if (positiveRatio > 0.6) {
      return { weatherEmoji: '☀️', weatherDescription: 'Солнечно и позитивно' };
    } else if (positiveRatio > 0.4) {
      return { weatherEmoji: '⛅', weatherDescription: 'В основном ясно' };
    } else if (positiveRatio > 0.2) {
      return { weatherEmoji: '🌤️', weatherDescription: 'Переменная облачность' };
    } else if (negativeRatio > 0.4) {
      return { weatherEmoji: '🌧️', weatherDescription: 'Дождливо и негативно' };
    } else if (negativeRatio > 0.2) {
      return { weatherEmoji: '⛈️', weatherDescription: 'Гроза' };
    } else {
      return { weatherEmoji: '☁️', weatherDescription: 'Нейтрально' };
    }
  }

  private static async findTopSentimentUser(
    userSentiments: Record<number, { positive: number; negative: number }>,
    type: 'positive' | 'negative'
  ): Promise<{ user: User; count: number } | null> {
    let topUserId: number | null = null;
    let topCount = 0;

    for (const [userId, counts] of Object.entries(userSentiments)) {
      const count = type === 'positive' ? counts.positive : counts.negative;
      if (count > topCount) {
        topCount = count;
        topUserId = parseInt(userId);
      }
    }

    if (!topUserId || topCount === 0) {
      return null;
    }

    const user = await UserModel.findById(topUserId);
    if (!user) {
      return null;
    }

    return { user, count: topCount };
  }

  /**
   * Форматировать погоду в чате для вывода
   */
  static formatChatWeather(weather: ChatWeather, timeFilter: TimeFilter): string {
    const periodLabel = this.getPeriodLabel(timeFilter);
    let result = `${weather.weatherEmoji} Погода в чате ${periodLabel}\n\n`;
    result += `${weather.weatherDescription}\n\n`;
    result += `📊 Статистика:\n`;
    result += `😊 Позитивных: ${weather.positiveCount}\n`;
    result += `😐 Нейтральных: ${weather.neutralCount}\n`;
    result += `😞 Негативных: ${weather.negativeCount}\n`;
    result += `📝 Всего сообщений: ${weather.totalMessages}\n\n`;

    if (weather.topPositiveUser) {
      const username = weather.topPositiveUser.user.username
        ? `@${weather.topPositiveUser.user.username}`
        : weather.topPositiveUser.user.first_name || `ID: ${weather.topPositiveUser.user.telegram_id}`;
      result += `☀️ Главный позитивщик: ${username} (количество позитивных сообщений - ${weather.topPositiveUser.count})\n`;
    }

    if (weather.topNegativeUser) {
      const username = weather.topNegativeUser.user.username
        ? `@${weather.topNegativeUser.user.username}`
        : weather.topNegativeUser.user.first_name || `ID: ${weather.topNegativeUser.user.telegram_id}`;
      result += `🌧️ Главный негативщик: ${username} (количество негативных сообщений - ${weather.topNegativeUser.count})\n`;
    }

    return result;
  }

  /**
   * Получить метку периода
   */
  private static getPeriodLabel(timeFilter: TimeFilter): string {
    switch (timeFilter) {
      case 'today':
        return 'сегодня';
      case 'week':
        return 'за неделю';
      case 'month':
        return 'за месяц';
      case 'all':
      default:
        return 'за всё время';
    }
  }
}
