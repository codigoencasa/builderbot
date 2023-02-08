FROM node:18-bullseye as bot
WORKDIR /app
COPY package*.sqlite ./
RUN npm i
COPY . .
ARG RAILWAY_STATIC_URL
ARG PUBLIC_URL
ARG PORT
CMD ["npm", "start"]
