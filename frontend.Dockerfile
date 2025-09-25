# Multi-stage build pour le frontend React + Nginx
FROM node:18-alpine AS builder

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de configuration de package
COPY package*.json ./

# Installer les dépendances
RUN npm ci --silent

# Copier le code source
COPY . .

# Variables d'environnement pour le build
ARG VITE_API_BASE_URL=http://localhost:3001/api
ARG VITE_HCAPTCHA_SITE_KEY=10000000-ffff-ffff-ffff-000000000001
ARG VITE_DEV_MODE=false

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_HCAPTCHA_SITE_KEY=$VITE_HCAPTCHA_SITE_KEY
ENV VITE_DEV_MODE=$VITE_DEV_MODE

# Builder l'application pour la production
RUN npm run build

# Stage 2: Serveur Nginx pour servir le frontend
FROM nginx:alpine AS runtime

# Installer certbot pour SSL (optionnel)
RUN apk add --no-cache certbot certbot-nginx

# Copier la configuration Nginx personnalisée
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Créer les répertoires nécessaires
RUN mkdir -p /var/log/nginx /var/cache/nginx /var/run/nginx

# Copier les fichiers buildés depuis le stage builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copier un script de démarrage personnalisé
COPY docker/start-nginx.sh /start-nginx.sh
RUN chmod +x /start-nginx.sh

# Créer utilisateur non-root
RUN addgroup -g 101 -S nginx
RUN adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Ajuster les permissions
RUN chown -R nginx:nginx /var/log/nginx /var/cache/nginx /var/run/nginx /usr/share/nginx/html
RUN chmod -R 755 /usr/share/nginx/html

# Exposer les ports
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Passer à l'utilisateur non-root
USER nginx

# Démarrer Nginx
CMD ["/start-nginx.sh"]