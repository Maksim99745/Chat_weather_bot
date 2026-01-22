#!/bin/bash
# Полная очистка и пересборка (используйте при проблемах)
# Использует новую версию docker compose (без дефиса)

set -e

# Определяем команду: используем новую версию docker compose если доступна
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
    SUDO_PREFIX="sudo"
else
    COMPOSE_CMD="docker-compose"
    SUDO_PREFIX="sudo"
fi

echo "🛑 Останавливаем всё..."
$SUDO_PREFIX $COMPOSE_CMD down -v --remove-orphans

echo "🗑️  Удаляем все образы проекта..."
sudo docker images | grep -E "(docker-compose-up|telegram-analytics)" | awk '{print $3}' | xargs -r sudo docker rmi -f 2>/dev/null || true

echo "🧹 Полная очистка Docker..."
sudo docker system prune -af --volumes

echo "🔨 Пересобираем с нуля..."
$SUDO_PREFIX $COMPOSE_CMD build --no-cache --pull

echo "🚀 Запускаем..."
$SUDO_PREFIX $COMPOSE_CMD up -d

echo ""
echo "✅ Готово!"
$SUDO_PREFIX $COMPOSE_CMD ps
