# Multi-stage build pour optimiser la taille du container
FROM node:18-alpine AS dependencies

# Créer utilisateur non-root pour sécurité
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeuser -u 1001

# Installer les dépendances système nécessaires
RUN apk add --no-cache \
    dumb-init \
    libc6-compat

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de configuration de package
COPY package*.json ./

# Installer uniquement les dépendances de production
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Runtime
FROM node:18-alpine AS runtime

# Installer dumb-init pour la gestion des signaux
RUN apk add --no-cache dumb-init

# Créer utilisateur non-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeuser -u 1001

# Définir le répertoire de travail
WORKDIR /app

# Copier les dépendances depuis l'étape précédente
COPY --from=dependencies --chown=nodeuser:nodejs /app/node_modules ./node_modules

# Copier le code source
COPY --chown=nodeuser:nodejs . .

# Créer les répertoires nécessaires
RUN mkdir -p logs && chown -R nodeuser:nodejs logs

# Exposer le port de l'application
EXPOSE 3001

# Définir les variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=3001
ENV LOG_LEVEL=info

# Configurer le health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Passer à l'utilisateur non-root
USER nodeuser

# Point d'entrée avec dumb-init pour la gestion des signaux
ENTRYPOINT ["dumb-init", "--"]

# Commande par défaut
CMD ["npm", "start"]