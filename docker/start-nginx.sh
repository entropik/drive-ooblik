#!/bin/sh

# Script de démarrage pour Nginx dans le container frontend
# Ce script s'assure que les permissions sont correctes et démarre Nginx

set -e

echo "Démarrage du container Nginx pour Drive Ooblik..."

# Créer les répertoires de log s'ils n'existent pas
mkdir -p /var/log/nginx
mkdir -p /var/cache/nginx
mkdir -p /var/run/nginx

# Vérifier que les fichiers de configuration existent
if [ ! -f /etc/nginx/nginx.conf ]; then
    echo "Erreur: Fichier de configuration Nginx manquant"
    exit 1
fi

# Tester la configuration Nginx
echo "Test de la configuration Nginx..."
nginx -t

if [ $? -ne 0 ]; then
    echo "Erreur dans la configuration Nginx"
    exit 1
fi

echo "Configuration Nginx valide"

# Vérifier que les fichiers statiques existent
if [ ! -d /usr/share/nginx/html ]; then
    echo "Erreur: Répertoire des fichiers statiques manquant"
    exit 1
fi

if [ ! -f /usr/share/nginx/html/index.html ]; then
    echo "Avertissement: index.html non trouvé dans /usr/share/nginx/html"
    ls -la /usr/share/nginx/html/
fi

# Ajuster les permissions des fichiers de log
chown -R nginx:nginx /var/log/nginx /var/cache/nginx /var/run/nginx 2>/dev/null || true
chmod -R 755 /usr/share/nginx/html 2>/dev/null || true

echo "Démarrage de Nginx..."

# Démarrer Nginx en mode foreground
exec nginx -g "daemon off;"