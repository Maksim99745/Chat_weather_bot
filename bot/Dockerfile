FROM node:20-alpine

WORKDIR /app

# Копируем package.json
COPY package.json ./

# Устанавливаем все зависимости (включая dev для сборки)
RUN npm install

# Копируем исходный код
COPY . .

# Компилируем TypeScript
RUN npm run build

# Удаляем dev зависимости после сборки
RUN npm prune --production

# Запускаем приложение
CMD ["node", "dist/index.js"]
