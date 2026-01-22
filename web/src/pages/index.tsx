import { useState } from 'react';
import Head from 'next/head';

interface AnalysisResult {
  analysis: string;
  raw?: {
    style: string;
    topics: string;
    activity: string;
    tone: string;
    features: string;
    messageCount: number;
  };
  user?: {
    username: string | null;
    firstName: string | null;
  };
}

export default function Home() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!username.trim()) {
      setError('Введите username пользователя');
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка при анализе пользователя');
      }

      setResult(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Telegram Analytics - Анализ пользователя</title>
        <meta name="description" content="Анализ пользователя Telegram чата" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
          .spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
        `}</style>
      </Head>
      <main style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <h1 style={{ marginBottom: '30px', color: '#333' }}>
          📊 Telegram Analytics
        </h1>
        
        <div style={{
          width: '100%',
          maxWidth: '600px',
          padding: '30px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="username" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Username пользователя:
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@username"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAnalyze();
                }
              }}
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              backgroundColor: loading ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background-color 0.2s',
            }}
          >
            {loading && <span className="spinner" />}
            {loading ? 'Анализируем...' : 'Анализировать'}
          </button>

          {error && (
            <div style={{
              marginTop: '20px',
              padding: '15px',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '4px',
              color: '#c33',
            }}>
              <strong>❌ Ошибка:</strong> {error}
            </div>
          )}

          {result && (
            <div style={{
              marginTop: '20px',
              padding: '20px',
              backgroundColor: '#f9f9f9',
              border: '1px solid #ddd',
              borderRadius: '8px',
            }}>
              <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333' }}>
                🧠 Результат анализа
              </h3>
              
              {result.user && (
                <div style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #ddd' }}>
                  <strong>Пользователь:</strong>{' '}
                  {result.user.username ? `@${result.user.username}` : result.user.firstName || 'Неизвестно'}
                </div>
              )}

              <div style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: '1.6',
                color: '#333',
              }}>
                {result.analysis}
              </div>

              {result.raw && (
                <div style={{
                  marginTop: '20px',
                  padding: '15px',
                  backgroundColor: '#fff',
                  borderRadius: '4px',
                  border: '1px solid #eee',
                }}>
                  <h4 style={{ marginTop: 0, marginBottom: '10px', fontSize: '14px', color: '#666' }}>
                    Детальная информация:
                  </h4>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    <div><strong>Сообщений проанализировано:</strong> {result.raw.messageCount}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
