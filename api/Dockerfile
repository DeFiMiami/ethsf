# syntax=docker/dockerfile:1

FROM node as prod
WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .
#COPY .env.prod .env
COPY build build

CMD [ "npm", "start" ]