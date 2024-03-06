FROM node:21-alpine3.18 as builder

RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

WORKDIR /app

COPY package*.json pnpm-lock.yaml ./

RUN apk add --no-cache \
    git 

COPY . .
RUN pnpm i
RUN pnpm build

FROM builder as deploy

ARG RAILWAY_STATIC_URL
ARG PUBLIC_URL
ARG PORT
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --production
CMD ["npm", "start"]