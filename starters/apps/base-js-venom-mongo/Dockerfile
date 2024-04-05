FROM node:21-alpine3.18 as builder

RUN apk add --no-cache \
      git \
      python3 \
      make \
      g++ \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      libpq-dev \
      ttf-freefont \
      udev

RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

RUN addgroup -S pptruser && adduser -S -G pptruser pptruser

WORKDIR /app
RUN chown -R pptruser:pptruser /app

USER pptruser

COPY package.json *-lock.* ./

RUN pnpm install --production=false

COPY . .

FROM node:21-alpine3.18

RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      libpq-dev \
      ttf-freefont \
      udev

RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

RUN addgroup -S pptruser && adduser -S -G pptruser pptruser

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./

RUN chown -R pptruser:pptruser /app

USER pptruser

ARG PORT
ENV PORT $PORT
EXPOSE $PORT

RUN pnpm install --production

CMD ["npm", "start"]