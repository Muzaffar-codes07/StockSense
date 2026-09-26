FROM node:20-alpine
# Prisma's engines need OpenSSL, which the alpine image does not ship.
RUN apk add --no-cache openssl
WORKDIR /app

# Install deps (leverage layer caching)
COPY package*.json ./
RUN npm install

# Prisma client needs the schema at generate time
COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 3000
# Apply migrations then boot
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
