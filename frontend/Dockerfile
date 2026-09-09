# Build Stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
# C-04: npm ci garantiza builds reproducibles auditando el lockfile
RUN npm ci

COPY . .
RUN npm run build -- --configuration production

# Production Stage con Nginx y hardening de seguridad (A-04)
FROM nginx:alpine

# I-03: Copiar nginx.conf personalizado con SPA routing y headers de seguridad
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /usr/src/app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
