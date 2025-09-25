# Guide d'installation Drive Ooblik sur VPS

Ce guide vous explique comment installer Drive Ooblik sur un serveur VPS avec PostgreSQL et Nginx.

## Prérequis

### Serveur
- Ubuntu 22.04 LTS ou plus récent
- 2 GB RAM minimum (4 GB recommandés)
- 20 GB espace disque minimum
- Accès root ou sudo
- Connexion Internet

### Domaine (optionnel mais recommandé)
- Nom de domaine pointant vers votre serveur
- Accès DNS pour configurer les enregistrements

## Installation automatique

### Option 1: Script d'installation automatique

```bash
# Télécharger et exécuter le script d'installation
curl -fsSL https://raw.githubusercontent.com/your-username/drive-ooblik/deploy/vps/deploy/setup-vps.sh | bash
```

Le script va automatiquement :
- Installer Node.js, PostgreSQL, Nginx
- Configurer la base de données
- Cloner le projet
- Installer les dépendances
- Configurer PM2 et Nginx

### Option 2: Installation manuelle

Si vous préférez contrôler chaque étape :

## Installation manuelle étape par étape

### 1. Préparer le système

```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer les outils de base
sudo apt install -y curl wget git build-essential ufw
```

### 2. Installer Node.js 18

```bash
# Installer nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Installer Node.js 18
nvm install 18
nvm use 18
nvm alias default 18

# Installer PM2
npm install -g pm2
```

### 3. Installer PostgreSQL

```bash
# Installer PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Démarrer PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Créer un utilisateur et une base de données
sudo -u postgres psql -c "CREATE USER ooblik WITH PASSWORD 'votre_mot_de_passe_securise';"
sudo -u postgres psql -c "CREATE DATABASE drive_ooblik OWNER ooblik;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE drive_ooblik TO ooblik;"
```

### 4. Installer Nginx

```bash
# Installer Nginx
sudo apt install -y nginx

# Démarrer et activer Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Configurer le firewall
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw --force enable
```

### 5. Cloner et configurer le projet

```bash
# Cloner le projet
cd ~
git clone https://github.com/your-username/drive-ooblik.git
cd drive-ooblik
git checkout deploy/vps

# Créer les fichiers de configuration
cp backend/.env.example backend/.env
cp .env.example .env

# Modifier les configurations (voir section Configuration)
nano backend/.env
nano .env
```

### 6. Installer les dépendances

```bash
# Backend
cd backend
npm install --production

# Frontend
cd ..
npm install
```

### 7. Configurer la base de données

```bash
# Exécuter les migrations
cd backend
npm run migrate
```

### 8. Construire le frontend

```bash
cd ..
npm run build
```

### 9. Configurer PM2

```bash
# Copier la configuration PM2
cp deploy/ecosystem.config.js .

# Démarrer l'application
pm2 start ecosystem.config.js

# Sauvegarder la configuration PM2
pm2 save

# Configurer le démarrage automatique
pm2 startup
# Suivre les instructions affichées
```

### 10. Configurer Nginx

```bash
# Copier la configuration Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/drive-ooblik

# Modifier la configuration avec votre domaine
sudo nano /etc/nginx/sites-available/drive-ooblik

# Activer le site
sudo ln -sf /etc/nginx/sites-available/drive-ooblik /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Tester et redémarrer Nginx
sudo nginx -t
sudo systemctl restart nginx
```

## Configuration

### Configuration Backend (backend/.env)

```env
# Server
NODE_ENV=production
PORT=3001
API_BASE_URL=https://votre-domaine.com

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=drive_ooblik
DB_USER=ooblik
DB_PASSWORD=votre_mot_de_passe_securise

# JWT (générer avec: openssl rand -hex 32)
JWT_SECRET=votre_secret_jwt_tres_long_et_securise
JWT_EXPIRES_IN=4h
JWT_ADMIN_EXPIRES_IN=24h

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX_REQUESTS=5

# SMTP (exemple Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-application

# S3 (optionnel)
S3_ACCESS_KEY_ID=votre_access_key
S3_SECRET_ACCESS_KEY=votre_secret_key
S3_REGION=eu-west-1
S3_BUCKET=votre-bucket

# hCaptcha
HCAPTCHA_SECRET_KEY=votre_cle_secrete_hcaptcha

# Frontend
FRONTEND_URL=https://votre-domaine.com
```

### Configuration Frontend (.env)

```env
VITE_API_BASE_URL=https://votre-domaine.com/api
VITE_HCAPTCHA_SITE_KEY=votre_cle_publique_hcaptcha
VITE_DEV_MODE=false
```

## SSL/HTTPS avec Let's Encrypt

### Installer Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Obtenir un certificat SSL

```bash
# Remplacer votre-domaine.com par votre vrai domaine
sudo certbot --nginx -d votre-domaine.com

# Vérifier le renouvellement automatique
sudo certbot renew --dry-run
```

## Configuration SMTP

### Gmail

1. Activez l'authentification à 2 facteurs sur votre compte Google
2. Générez un mot de passe d'application :
   - Google Account → Sécurité → Mots de passe d'application
3. Utilisez ce mot de passe dans `SMTP_PASS`

### Autres fournisseurs

| Fournisseur | SMTP_HOST | SMTP_PORT | SMTP_SECURE |
|-------------|-----------|-----------|-------------|
| Gmail | smtp.gmail.com | 587 | false |
| Outlook | smtp-mail.outlook.com | 587 | false |
| Yahoo | smtp.mail.yahoo.com | 587 | false |
| SendGrid | smtp.sendgrid.net | 587 | false |

## Configuration S3 (optionnel)

Si vous voulez utiliser Amazon S3 pour le stockage :

1. Créez un bucket S3
2. Créez un utilisateur IAM avec les permissions S3
3. Configurez les variables S3 dans le backend

## Maintenance

### Commandes utiles

```bash
# Voir les logs de l'application
pm2 logs drive-ooblik-api

# Redémarrer l'application
pm2 restart drive-ooblik-api

# Voir le statut
pm2 status

# Voir les logs Nginx
sudo tail -f /var/log/nginx/error.log

# Voir les logs système
sudo journalctl -u nginx -f
```

### Mise à jour de l'application

```bash
cd ~/drive-ooblik

# Sauvegarder la base de données
pg_dump -U ooblik -h localhost drive_ooblik > backup_$(date +%Y%m%d_%H%M%S).sql

# Mettre à jour le code
git pull origin deploy/vps

# Mettre à jour les dépendances
cd backend && npm install --production
cd .. && npm install

# Exécuter les nouvelles migrations
cd backend && npm run migrate

# Reconstruire le frontend
cd .. && npm run build

# Redémarrer l'application
pm2 restart drive-ooblik-api
```

### Sauvegarde automatique

Créer un script de sauvegarde :

```bash
# Créer le script
cat > ~/backup-drive-ooblik.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/$USER/backups"
mkdir -p $BACKUP_DIR

# Sauvegarde de la base de données
pg_dump -U ooblik -h localhost drive_ooblik > $BACKUP_DIR/db_backup_$DATE.sql

# Sauvegarde des fichiers de configuration
tar -czf $BACKUP_DIR/config_backup_$DATE.tar.gz ~/drive-ooblik/.env ~/drive-ooblik/backend/.env

# Nettoyer les anciennes sauvegardes (> 30 jours)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Sauvegarde terminée: $DATE"
EOF

chmod +x ~/backup-drive-ooblik.sh

# Programmer avec cron (tous les jours à 3h)
(crontab -l 2>/dev/null; echo "0 3 * * * /home/$USER/backup-drive-ooblik.sh") | crontab -
```

## Sécurité

### Recommandations de sécurité

1. **Firewall** : N'ouvrir que les ports nécessaires
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

2. **Mots de passe forts** : Utiliser des mots de passe complexes

3. **Mises à jour** : Maintenir le système à jour
```bash
sudo apt update && sudo apt upgrade -y
```

4. **Monitoring** : Surveiller les logs et performances

5. **Fail2ban** : Protection contre les attaques par force brute
```bash
sudo apt install fail2ban
```

## Dépannage

### L'application ne démarre pas

```bash
# Vérifier les logs PM2
pm2 logs drive-ooblik-api

# Vérifier la configuration
cd ~/drive-ooblik/backend
npm run migrate
```

### Problèmes de base de données

```bash
# Vérifier que PostgreSQL fonctionne
sudo systemctl status postgresql

# Tester la connexion
psql -U ooblik -h localhost -d drive_ooblik
```

### Problèmes Nginx

```bash
# Vérifier la configuration
sudo nginx -t

# Voir les logs d'erreur
sudo tail -f /var/log/nginx/error.log
```

### L'email ne fonctionne pas

1. Vérifiez la configuration SMTP dans `backend/.env`
2. Testez depuis l'interface admin
3. Vérifiez les logs de l'application

## Support

Pour obtenir de l'aide :

1. Consultez les logs de l'application
2. Vérifiez la documentation
3. Ouvrez une issue sur GitHub

## Migration depuis Supabase

Si vous migrez depuis une installation Supabase existante :

1. Exportez vos données depuis Supabase
2. Installez cette version
3. Importez vos données dans PostgreSQL
4. Mettez à jour vos configurations

Le schéma de base de données est compatible, seules les Edge Functions sont remplacées par l'API Node.js.