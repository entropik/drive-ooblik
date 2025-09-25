#!/bin/bash

# Script d'installation automatique pour Drive Ooblik sur VPS Ubuntu 22.04
# Usage: curl -fsSL https://votre-repo.com/deploy/setup-vps.sh | bash

set -e

# Couleurs pour l'output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction de logging
log() {
    echo -e "${GREEN}[SETUP]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Vérifier si l'utilisateur est root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "Ce script ne doit pas être exécuté en tant que root"
        exit 1
    fi
}

# Mettre à jour le système
update_system() {
    log "Mise à jour du système..."
    sudo apt update && sudo apt upgrade -y
    sudo apt install -y curl wget git build-essential
}

# Installer Node.js
install_nodejs() {
    log "Installation de Node.js 18..."

    # Installer nvm
    if ! command -v nvm &> /dev/null; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
    fi

    # Installer et utiliser Node.js 18
    nvm install 18
    nvm use 18
    nvm alias default 18

    # Installer PM2 globalement
    npm install -g pm2

    info "Node.js version: $(node --version)"
    info "npm version: $(npm --version)"
    info "PM2 version: $(pm2 --version)"
}

# Installer PostgreSQL
install_postgresql() {
    log "Installation de PostgreSQL 15..."

    # Installer PostgreSQL
    sudo apt install -y postgresql postgresql-contrib

    # Démarrer et activer PostgreSQL
    sudo systemctl start postgresql
    sudo systemctl enable postgresql

    info "PostgreSQL installé et démarré"
}

# Configurer PostgreSQL
configure_postgresql() {
    log "Configuration de PostgreSQL..."

    # Demander les informations de base de données
    read -p "Nom de la base de données [drive_ooblik]: " DB_NAME
    DB_NAME=${DB_NAME:-drive_ooblik}

    read -p "Nom d'utilisateur PostgreSQL [ooblik]: " DB_USER
    DB_USER=${DB_USER:-ooblik}

    read -s -p "Mot de passe PostgreSQL: " DB_PASSWORD
    echo

    # Créer l'utilisateur et la base de données
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

    info "Base de données '$DB_NAME' créée pour l'utilisateur '$DB_USER'"

    # Sauvegarder les informations pour plus tard
    echo "DB_NAME=$DB_NAME" > ~/.drive_ooblik_db
    echo "DB_USER=$DB_USER" >> ~/.drive_ooblik_db
    echo "DB_PASSWORD=$DB_PASSWORD" >> ~/.drive_ooblik_db
}

# Installer Nginx
install_nginx() {
    log "Installation de Nginx..."

    sudo apt install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx

    # Configurer le firewall
    sudo ufw allow 'Nginx Full'
    sudo ufw allow OpenSSH
    sudo ufw --force enable

    info "Nginx installé et configuré"
}

# Installer Certbot pour SSL
install_certbot() {
    log "Installation de Certbot pour SSL..."

    sudo apt install -y certbot python3-certbot-nginx

    info "Certbot installé"
}

# Cloner le projet
clone_project() {
    log "Configuration du projet..."

    # Demander l'URL du dépôt
    read -p "URL du dépôt Git: " REPO_URL

    if [ -z "$REPO_URL" ]; then
        error "URL du dépôt requise"
        exit 1
    fi

    # Cloner dans le répertoire home
    PROJECT_DIR="$HOME/drive-ooblik"

    if [ -d "$PROJECT_DIR" ]; then
        warn "Le répertoire $PROJECT_DIR existe déjà"
        read -p "Voulez-vous le supprimer et recloner? (y/N): " CONFIRM
        if [[ $CONFIRM =~ ^[Yy]$ ]]; then
            rm -rf "$PROJECT_DIR"
        else
            error "Installation annulée"
            exit 1
        fi
    fi

    git clone "$REPO_URL" "$PROJECT_DIR"
    cd "$PROJECT_DIR"

    # Basculer sur la branche deploy/vps
    git checkout deploy/vps || {
        warn "Branche deploy/vps non trouvée, utilisation de la branche actuelle"
    }

    info "Projet cloné dans $PROJECT_DIR"
}

# Configurer l'environnement
setup_environment() {
    log "Configuration de l'environnement..."

    cd "$HOME/drive-ooblik"

    # Charger les infos de base de données
    source ~/.drive_ooblik_db

    # Créer le fichier .env pour le backend
    cat > backend/.env << EOF
# Server Configuration
NODE_ENV=production
PORT=3001
API_BASE_URL=http://localhost:3001

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# JWT Configuration
JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=4h
JWT_ADMIN_EXPIRES_IN=24h

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX_REQUESTS=5

# Frontend URL
FRONTEND_URL=http://localhost

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Session Configuration
SESSION_DURATION_HOURS=4
MAGIC_LINK_EXPIRY_HOURS=6
EOF

    # Créer le fichier .env pour le frontend
    cat > .env << EOF
# Frontend Environment Variables
VITE_API_BASE_URL=http://localhost:3001/api
VITE_HCAPTCHA_SITE_KEY=10000000-ffff-ffff-ffff-000000000001
VITE_DEV_MODE=false
EOF

    info "Fichiers de configuration créés"

    warn "IMPORTANT: Modifiez les fichiers .env avec vos vraies valeurs:"
    warn "- Configuration SMTP"
    warn "- Configuration S3"
    warn "- Clés hCaptcha"
    warn "- Domaine de production"
}

# Installer les dépendances
install_dependencies() {
    log "Installation des dépendances..."

    cd "$HOME/drive-ooblik"

    # Backend
    cd backend
    npm install --production
    cd ..

    # Frontend
    npm install

    info "Dépendances installées"
}

# Exécuter les migrations
run_migrations() {
    log "Exécution des migrations de base de données..."

    cd "$HOME/drive-ooblik/backend"
    npm run migrate

    info "Migrations exécutées"
}

# Construire le frontend
build_frontend() {
    log "Construction du frontend..."

    cd "$HOME/drive-ooblik"
    npm run build

    info "Frontend construit"
}

# Configurer PM2
setup_pm2() {
    log "Configuration de PM2..."

    cd "$HOME/drive-ooblik"

    # Créer le fichier de configuration PM2
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'drive-ooblik-api',
    script: 'backend/src/app.js',
    cwd: '/home/$(whoami)/drive-ooblik',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/home/$(whoami)/drive-ooblik/logs/api-error.log',
    out_file: '/home/$(whoami)/drive-ooblik/logs/api-out.log',
    log_file: '/home/$(whoami)/drive-ooblik/logs/api.log',
    time: true,
    max_memory_restart: '500M',
    node_args: '--max-old-space-size=512'
  }]
};
EOF

    # Remplacer $(whoami) par le nom d'utilisateur réel
    sed -i "s/\$(whoami)/$USER/g" ecosystem.config.js

    # Créer le répertoire des logs
    mkdir -p logs

    # Démarrer l'application
    pm2 start ecosystem.config.js
    pm2 save
    pm2 startup

    info "PM2 configuré et application démarrée"
}

# Configurer Nginx
setup_nginx() {
    log "Configuration de Nginx..."

    read -p "Nom de domaine (ex: drive.example.com): " DOMAIN

    if [ -z "$DOMAIN" ]; then
        warn "Aucun domaine fourni, configuration avec localhost"
        DOMAIN="localhost"
    fi

    # Créer la configuration Nginx
    sudo tee /etc/nginx/sites-available/drive-ooblik << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Frontend (fichiers statiques)
    location / {
        root /home/$USER/drive-ooblik/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;

        # Cache des assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API Backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;

    # Taille max des uploads
    client_max_body_size 5G;
}
EOF

    # Activer le site
    sudo ln -sf /etc/nginx/sites-available/drive-ooblik /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default

    # Tester et recharger Nginx
    sudo nginx -t && sudo systemctl reload nginx

    info "Nginx configuré pour $DOMAIN"

    # Configurer SSL si c'est un vrai domaine
    if [[ "$DOMAIN" != "localhost" && "$DOMAIN" != *"."*"."* ]]; then
        warn "Domaine détecté. Pour configurer SSL, exécutez:"
        warn "sudo certbot --nginx -d $DOMAIN"
    fi
}

# Fonction principale
main() {
    info "=== Installation de Drive Ooblik sur VPS ==="
    info "Ce script va installer et configurer Drive Ooblik sur Ubuntu 22.04"

    read -p "Continuer? (y/N): " CONFIRM
    if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
        info "Installation annulée"
        exit 0
    fi

    check_root
    update_system
    install_nodejs
    install_postgresql
    configure_postgresql
    install_nginx
    install_certbot
    clone_project
    setup_environment
    install_dependencies
    run_migrations
    build_frontend
    setup_pm2
    setup_nginx

    log "=== Installation terminée! ==="
    info "Votre application Drive Ooblik est maintenant installée et fonctionne!"
    info ""
    info "Prochaines étapes:"
    info "1. Modifiez les fichiers .env avec vos vraies configurations"
    info "2. Redémarrez l'application: pm2 restart drive-ooblik-api"
    info "3. Configurez SSL si nécessaire: sudo certbot --nginx -d votre-domaine.com"
    info "4. Configurez votre DNS pour pointer vers ce serveur"
    info ""
    info "Commandes utiles:"
    info "- Voir les logs: pm2 logs drive-ooblik-api"
    info "- Redémarrer: pm2 restart drive-ooblik-api"
    info "- Status: pm2 status"
    info "- Logs Nginx: sudo tail -f /var/log/nginx/error.log"

    warn "N'oubliez pas de configurer votre firewall et de sécuriser votre serveur!"
}

# Exécuter le script principal
main "$@"