FROM node:lts-bullseye as bot
WORKDIR /app
COPY package*.json ./
RUN npm i
COPY . .
ARG PORT
CMD ["npm", "start"]
