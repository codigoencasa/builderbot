FROM node:21-alpine3.18 as builder

RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

WORKDIR /app

COPY package*.json pnpm-lock.yaml ./

RUN apk add --no-cache \
    git 

# RUN pnpm install  pm2 -g

COPY . .
RUN pnpm i

FROM builder as deploy

ARG RAILWAY_STATIC_URL
ARG PUBLIC_URL
ARG PORT
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --production
# CMD ["pm2-runtime", "start", "./dist/app.js", "--cron", "0 */12 * * *"]
CMD ["npm", "start"]