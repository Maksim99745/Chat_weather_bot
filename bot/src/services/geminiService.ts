import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { MessageModel, Message } from '../models/MessageModel';
import { UserModel, User } from '../models/UserModel';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY не установлен. Анализ пользователей будет недоступен.');
}

// Инициализация Gemini API
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Модель Gemini - можно изменить на gemini-3-flash-preview, gemini-2.0-flash-exp или gemini-1.5-pro
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

export interface UserAnalysis {
  style: string;
  topics: string;
  activity: string;
  tone: string;
  features: string;
  messageCount: number;
}

export class GeminiService {
  /**
   * Анализировать пользователя на основе его сообщений
   * @param userId - ID пользователя в БД
   * @param limit - Количество сообщений для анализа (по умолчанию 100)
   * @returns Анализ пользователя
   */
  static async analyzeUser(userId: number, limit: number = 100): Promise<UserAnalysis | null> {
    if (!genAI) {
      throw new Error('Gemini API не настроен. Проверьте GEMINI_API_KEY в .env');
    }

    try {
      const messages = await MessageModel.getUserMessages(userId, limit);
      
      if (messages.length === 0) {
        throw new Error('У пользователя нет сообщений для анализа');
      }

      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error('Пользователь не найден');
      }

      const messagesText = messages
        .reverse()
        .map((msg, index) => `${index + 1}. ${msg.text}`)
        .join('\n');

      const prompt = this.createAnalysisPrompt(messagesText, user);
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const analysisText = response.text();
      const analysis = this.parseAnalysis(analysisText, messages.length);

      return analysis;
    } catch (error: any) {
      console.error('Ошибка при анализе пользователя:', error);
      
      // Обработка ошибки квоты
      if (error?.message?.includes('429') || error?.message?.includes('quota') || error?.message?.includes('Quota exceeded')) {
        const retryMatch = error?.message?.match(/Please retry in ([\d.]+)s/);
        const retrySeconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 60;
        throw new Error(`⚠️ Превышен лимит запросов к Gemini API (бесплатный тариф: 20 запросов/день). Попробуйте через ${retrySeconds} секунд или обновите тарифный план.`);
      }
      
      // Обработка других ошибок API
      if (error?.message?.includes('GoogleGenerativeAI Error')) {
        throw new Error('❌ Ошибка Gemini API. Проверьте GEMINI_API_KEY и доступность модели.');
      }
      
      throw error;
    }
  }

  /**
   * Создать промпт для анализа пользователя
   * @param messagesText - Текст сообщений
   * @param user - Пользователь
   * @returns Промпт
   */
  private static createAnalysisPrompt(messagesText: string, user: User): string {
    const username = user.username ? `@${user.username}` : user.first_name || `ID: ${user.telegram_id}`;

    return `Проанализируй стиль общения этого пользователя в Telegram групповом чате.

Пользователь: ${username}
Сообщения пользователя:
${messagesText}

Проанализируй и верни структурированный ответ в следующем формате:

Стиль: [формальный/неформальный, дружелюбный/нейтральный/строгий и т.д.]
Темы: [основные темы, которые поднимает пользователь, через запятую]
Активность: [когда обычно пишет пользователь, пики активности по времени суток]
Тональность: [позитивная/нейтральная/негативная, с кратким пояснением]
Особенности: [частые слова, выражения, эмодзи, стиль общения и т.д.]

Будь конкретным и информативным. Если информации недостаточно, укажи это.`;
  }

  /**
   * Парсить ответ от Gemini в структурированный объект
   * @param analysisText - Текст ответа от Gemini
   * @param messageCount - Количество проанализированных сообщений
   * @returns Структурированный анализ
   */
  private static parseAnalysis(analysisText: string, messageCount: number): UserAnalysis {
    // Пытаемся извлечь информацию из структурированного ответа
    const styleMatch = analysisText.match(/Стиль:\s*(.+?)(?:\n|Темы:|$)/i);
    const topicsMatch = analysisText.match(/Темы:\s*(.+?)(?:\n|Активность:|$)/i);
    const activityMatch = analysisText.match(/Активность:\s*(.+?)(?:\n|Тональность:|$)/i);
    const toneMatch = analysisText.match(/Тональность:\s*(.+?)(?:\n|Особенности:|$)/i);
    const featuresMatch = analysisText.match(/Особенности:\s*([\s\S]+?)(?:\n|$)/i);

    return {
      style: styleMatch ? styleMatch[1].trim() : 'Не удалось определить',
      topics: topicsMatch ? topicsMatch[1].trim() : 'Не удалось определить',
      activity: activityMatch ? activityMatch[1].trim() : 'Не удалось определить',
      tone: toneMatch ? toneMatch[1].trim() : 'Не удалось определить',
      features: featuresMatch ? featuresMatch[1].trim() : 'Не удалось определить',
      messageCount,
    };
  }

  /**
   * Форматировать анализ для вывода в Telegram
   * @param user - Пользователь
   * @param analysis - Анализ пользователя
   * @returns Отформатированная строка
   */
  static formatAnalysis(user: User, analysis: UserAnalysis): string {
    const username = user.username ? `@${user.username}` : user.first_name || `ID: ${user.telegram_id}`;

    let result = `🧠 Анализ пользователя ${username}\n\n`;
    result += `📝 Стиль: ${analysis.style}\n`;
    result += `💬 Темы: ${analysis.topics}\n`;
    result += `⏰ Активность: ${analysis.activity}\n`;
    result += `😊 Тональность: ${analysis.tone}\n`;
    result += `✨ Особенности: ${analysis.features}\n\n`;
    result += `На основе ${analysis.messageCount} сообщений.`;

    return result;
  }
}
