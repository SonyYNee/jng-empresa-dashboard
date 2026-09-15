FROM node:22

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY apps/dashboard/src ./apps/dashboard/src
COPY apps/dashboard/public ./apps/dashboard/public

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["node", "apps/dashboard/src/server.js"]
