FROM node:22

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev || true

COPY . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["node", "server.js"]
