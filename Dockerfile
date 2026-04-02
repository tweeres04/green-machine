FROM node:lts-alpine

EXPOSE 3000
WORKDIR /app

COPY ./package.json ./package-lock.json ./
RUN npm ci

COPY . .

ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN

RUN npm run build

CMD ["npm", "run", "start"]