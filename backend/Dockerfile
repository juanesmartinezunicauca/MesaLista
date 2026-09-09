FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
# C-04: npm ci garantiza builds reproducibles auditando el lockfile
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# C-05: Etapa runner con solo dependencias de producción
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/package*.json ./
# Reinstalar solo prod — excluye jest, ts-node, ts-loader, etc.
RUN npm ci --omit=dev
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

EXPOSE 3000

CMD ["node", "dist/main"]
