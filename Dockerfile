# 构建阶段 1: 构建前端
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ENV GEMINI_API_KEY=${GEMINI_API_KEY}

RUN npm run build

# 构建阶段 2: 运行阶段
FROM node:20-alpine AS runner

ENV NODE_ENV=production

RUN apk add --no-cache \
    libstdc++ \
    libgcc \
    wine \
    xdg-utils \
    cups \
    libasound \
    at-spi2-core \
    atk \
    cairo \
    dbus \
    expat \
    fontconfig \
    freetype \
    gdk-pixbuf \
    glib \
    graphite2 \
    harfbuzz \
    icu-libs \
    libpango \
    libx11 \
    libxcomposite \
    libxcursor \
    libxdamage \
    libxext \
    libxfixes \
    libxi \
    libxrandr \
    libxrender \
    libxss \
    libxtst \
    pango \
    pixman \
    zlib \
    python3 \
    make \
    g++

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/electron ./electron
COPY --from=builder /app/public ./public

RUN mkdir -p resources && \
    cp -r electron/assets resources/

ENV ELECTRON_START_URL=file:///app/dist/index.html

EXPOSE 3000

CMD ["node", "electron/core/index.js"]
