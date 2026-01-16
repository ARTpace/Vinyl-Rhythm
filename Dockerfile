# 构建阶段 1: 构建前端
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ENV GEMINI_API_KEY=${GEMINI_API_KEY}

RUN npm run build

# 构建阶段 2: 运行阶段（精简版 - 仅 Web 服务）
FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/index.html ./dist/

RUN npm install -g serve

EXPOSE 3000

CMD ["serve", "dist", "-l", "3000", "-s"]
