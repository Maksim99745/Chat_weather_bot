import type { NextApiRequest, NextApiResponse } from 'next';
import { UserModel } from '../../lib/models/UserModel';
import { GeminiService } from '../../lib/services/geminiService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Проверяем наличие Gemini API ключа
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: 'Gemini API не настроен. Проверьте GEMINI_API_KEY в конфигурации.' 
      });
    }

    // Убираем @ из username если есть
    const cleanUsername = username.replace('@', '');

    // Ищем пользователя по username
    const user = await UserModel.findByUsername(cleanUsername);

    if (!user) {
      return res.status(404).json({ 
        error: `Пользователь @${cleanUsername} не найден в базе данных.` 
      });
    }

    // Анализируем пользователя
    const analysis = await GeminiService.analyzeUser(user.id);

    if (!analysis) {
      return res.status(500).json({ 
        error: 'Не удалось проанализировать пользователя.' 
      });
    }

    // Форматируем результат
    const formatted = GeminiService.formatAnalysis(user, analysis);

    return res.status(200).json({
      analysis: formatted,
      raw: analysis,
      user: {
        username: user.username,
        firstName: user.first_name,
      },
    });
  } catch (error) {
    console.error('Ошибка в API /api/analyze:', error);
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
    
    // Определяем статус код в зависимости от типа ошибки
    let statusCode = 500;
    if (errorMessage.includes('квот') || errorMessage.includes('лимит')) {
      statusCode = 429; // Too Many Requests
    } else if (errorMessage.includes('не найден')) {
      statusCode = 404;
    }
    
    return res.status(statusCode).json({ 
      error: errorMessage 
    });
  }
}
