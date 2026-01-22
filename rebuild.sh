#!/bin/bash
# Скрипт для чистой пересборки проекта без ошибок
# Использует новую версию docker compose (без дефиса)

set -e  # Остановка при ошибке

# Определяем команду: используем новую версию docker compose если доступна
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
    SUDO_PREFIX="sudo"
else
    COMPOSE_CMD="docker-compose"
    SUDO_PREFIX="sudo"
fi

echo "🛑 Останавливаем и удаляем контейнеры..."
$SUDO_PREFIX $COMPOSE_CMD down --remove-orphans

echo "🗑️  Удаляем старые образы проекта (локальные)..."
$SUDO_PREFIX $COMPOSE_CMD down --rmi local 2>/dev/null || true

echo "🗑️  Удаляем все образы проекта по имени..."
sudo docker images | grep -E "(docker-compose-up|telegram-analytics)" | awk '{print $3}' | xargs -r sudo docker rmi -f 2>/dev/null || true

echo "🧹 Очищаем неиспользуемые образы и контейнеры..."
sudo docker system prune -f

echo "🔨 Пересобираем образы с нуля..."
echo "⏳ Это может занять время при первом запуске (загрузка базовых образов)..."
$SUDO_PREFIX $COMPOSE_CMD build --no-cache --pull || {
    echo "⚠️  Ошибка при загрузке образов. Пробуем без --pull..."
    $SUDO_PREFIX $COMPOSE_CMD build --no-cache
}

echo "🚀 Запускаем контейнеры в фоновом режиме..."
$SUDO_PREFIX $COMPOSE_CMD up -d

echo ""
echo "⏳ Ждём запуска сервисов (10 секунд)..."
sleep 10

echo ""
echo "✅ Готово! Проверяем статус:"
$SUDO_PREFIX $COMPOSE_CMD ps

echo ""
echo "📋 Логи бота (последние 20 строк):"
$SUDO_PREFIX $COMPOSE_CMD logs bot --tail 20

echo ""
echo "📋 Логи веб (последние 10 строк):"
$SUDO_PREFIX $COMPOSE_CMD logs web --tail 10
