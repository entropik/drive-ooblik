# Dockerfile multi-stage pour Drive Ooblik
# Build frontend et backend dans une seule image optimisée

# Stage 1: Build du frontend React/Vite
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Copier les fichiers de dépendances frontend
COPY package*.json ./
COPY vite.config.ts ./
COPY tsconfig*.json ./

# Installer les dépendances frontend
RUN npm ci --only=production && \
    npm install -D vite @vitejs/plugin-react typescript

# Copier le code source frontend
COPY index.html ./
COPY public ./public
COPY src ./src

# Variables de build (seront remplacées par Portainer)
ARG VITE_API_BASE_URL=/api
ARG VITE_HCAPTCHA_SITE_KEY=10000000-ffff-ffff-ffff-000000000001

# Build du frontend
RUN npm run build

# Stage 2: Préparation du backend
FROM node:18-alpine AS backend-builder

WORKDIR /app

# Copier les fichiers backend
COPY backend/package*.json ./backend/
WORKDIR /app/backend

# Installer les dépendances de production uniquement
RUN npm ci --only=production

# Copier le code source backend
COPY backend/src ./src
COPY backend/migrations ./migrations

# Stage 3: Image finale de production
FROM node:18-alpine

# Installer nginx et supervisor pour gérer les deux services
RUN apk add --no-cache nginx supervisor curl && \
    mkdir -p /var/log/supervisor /var/cache/nginx /var/tmp/nginx && \
    chown -R node:node /var/cache/nginx /var/tmp/nginx /var/lib/nginx /var/log/nginx

WORKDIR /app

# Copier le backend depuis le builder
COPY --from=backend-builder /app/backend ./backend

# Copier le frontend buildé
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copier les configurations
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Créer le répertoire de logs
RUN mkdir -p /app/logs && \
    chown -R node:node /app

# Variables d'environnement par défaut
ENV NODE_ENV=production \
    PORT=3001 \
    LOG_LEVEL=info

# Exposer les ports
EXPOSE 80 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Script de démarrage
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Utiliser un utilisateur non-root
USER node

# Démarrer avec supervisor
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]