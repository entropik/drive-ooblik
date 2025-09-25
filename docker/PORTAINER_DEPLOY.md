# Guide de déploiement Drive Ooblik sur Portainer

## 📋 Prérequis

- Portainer installé sur votre VPS
- Accès administrateur à Portainer
- Port 80 disponible (ou modifier `APP_PORT` dans les variables)
- 2GB RAM minimum recommandé

## 🚀 Déploiement rapide

### Étape 1 : Créer une nouvelle Stack

1. Connectez-vous à Portainer
2. Allez dans **Stacks** → **Add stack**
3. Donnez un nom : `drive-ooblik`

### Étape 2 : Configuration Repository

4. Sélectionnez **Repository** comme méthode de build
5. Remplissez les champs :

```
Repository URL: https://github.com/entropik/drive-ooblik
Repository reference: refs/heads/main
Compose path: docker-compose.yml
```

6. Si votre repo est privé, ajoutez l'authentification GitHub

### Étape 3 : Variables d'environnement

7. Dans **Environment variables**, ajoutez :

```env
# OBLIGATOIRE - Changez ces valeurs !
DB_PASSWORD=un-mot-de-passe-tres-securise
JWT_SECRET=generez-avec-openssl-rand-hex-32

# Configuration de base
DB_NAME=drive_ooblik
DB_USER=ooblik
APP_PORT=80
API_PORT=3001

# URLs (ajustez selon votre domaine)
FRONTEND_URL=http://votre-domaine.com
API_BASE_URL=http://votre-domaine.com:3001

# Email (optionnel mais recommandé)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-application

# hCaptcha (optionnel, pour production)
HCAPTCHA_SECRET_KEY=votre-cle-secrete
VITE_HCAPTCHA_SITE_KEY=votre-cle-publique

# S3 (optionnel, pour stockage externe)
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_REGION=eu-west-1
S3_BUCKET=
```

### Étape 4 : Options avancées

8. **Enable relative path volumes** : ✅ Activé
9. **Deploy the stack** : Cliquez pour déployer

## 📊 Vérification du déploiement

### Services créés

Après déploiement, vous devriez voir 2 containers :

1. **drive-ooblik-db** (PostgreSQL)
   - Status : ✅ Running
   - Health : Healthy

2. **drive-ooblik-app** (Application)
   - Status : ✅ Running
   - Health : Healthy
   - Ports : 80, 3001

### Premier accès

1. Accédez à `http://votre-ip-vps` ou `http://votre-domaine.com`
2. Interface admin : `/admin`
   - Login : `admin`
   - Mot de passe : `admin123`
   - ⚠️ **Changez-le immédiatement !**

## 🔧 Configuration post-déploiement

### 1. Changer le mot de passe admin

1. Connectez-vous à `/admin`
2. Allez dans **Mon compte**
3. Changez le mot de passe

### 2. Configurer l'envoi d'emails

1. Dans l'admin, allez dans **Configuration SMTP**
2. Entrez vos paramètres SMTP
3. Testez l'envoi

### 3. Configurer S3 (optionnel)

1. Dans l'admin, allez dans **Configuration**
2. Ajoutez vos credentials S3
3. Testez l'upload

## 🔄 Mise à jour

### Via Portainer

1. Allez dans votre stack `drive-ooblik`
2. Cliquez sur **Pull and redeploy**
3. Portainer récupérera la dernière version depuis GitHub

### Mise à jour manuelle

```bash
# Dans Portainer
Stack → drive-ooblik → Editor
# Modifiez si besoin
# Update the stack
```

## 🐛 Dépannage

### Les containers ne démarrent pas

**Vérifiez les logs :**
1. Portainer → Containers → drive-ooblik-app → Logs

**Causes fréquentes :**
- PostgreSQL pas encore prêt → Attendez 30 secondes
- Mauvais mot de passe DB → Vérifiez `DB_PASSWORD`
- Port déjà utilisé → Changez `APP_PORT`

### Erreur de connexion à la base de données

```bash
# Vérifier PostgreSQL
docker exec -it drive-ooblik-db psql -U ooblik -d drive_ooblik
```

### L'application ne répond pas

**Vérifiez le health check :**
```bash
curl http://localhost:3001/health
```

### Réinitialiser la base de données

⚠️ **Attention : Supprime toutes les données !**

1. Portainer → Stacks → drive-ooblik → Stop
2. Volumes → drive-ooblik-postgres → Remove
3. Stacks → drive-ooblik → Start

## 📈 Monitoring

### Dans Portainer

- **Container stats** : CPU, RAM, Network I/O
- **Logs** : Temps réel pour debug
- **Health checks** : Status automatique

### Endpoints de monitoring

- Health check : `http://votre-domaine:3001/health`
- Metrics : Accessible dans l'admin

## 🔒 Sécurité

### Recommandations importantes

1. **Changez immédiatement** :
   - Mot de passe admin par défaut
   - `JWT_SECRET` dans les variables
   - `DB_PASSWORD` dans les variables

2. **Configurez un reverse proxy** (Nginx/Traefik) pour :
   - SSL/TLS avec Let's Encrypt
   - Headers de sécurité
   - Rate limiting supplémentaire

3. **Sauvegardez régulièrement** :
   ```bash
   # Backup de la base de données
   docker exec drive-ooblik-db pg_dump -U ooblik drive_ooblik > backup.sql
   ```

## 📝 Variables d'environnement complètes

| Variable | Obligatoire | Description | Valeur par défaut |
|----------|-------------|-------------|-------------------|
| `DB_PASSWORD` | ✅ | Mot de passe PostgreSQL | - |
| `JWT_SECRET` | ✅ | Secret pour tokens JWT | - |
| `DB_NAME` | ❌ | Nom de la base | drive_ooblik |
| `DB_USER` | ❌ | Utilisateur PostgreSQL | ooblik |
| `APP_PORT` | ❌ | Port de l'application | 80 |
| `API_PORT` | ❌ | Port de l'API | 3001 |
| `FRONTEND_URL` | ❌ | URL du frontend | http://localhost |
| `API_BASE_URL` | ❌ | URL de l'API | http://localhost:3001 |
| `SMTP_HOST` | ❌ | Serveur SMTP | - |
| `SMTP_PORT` | ❌ | Port SMTP | 587 |
| `SMTP_USER` | ❌ | Utilisateur SMTP | - |
| `SMTP_PASS` | ❌ | Mot de passe SMTP | - |
| `S3_ACCESS_KEY_ID` | ❌ | Clé d'accès S3 | - |
| `S3_SECRET_ACCESS_KEY` | ❌ | Clé secrète S3 | - |
| `S3_REGION` | ❌ | Région S3 | eu-west-1 |
| `S3_BUCKET` | ❌ | Nom du bucket S3 | - |

## 🆘 Support

- Documentation : `/docs` dans le repo
- Issues : GitHub Issues
- Logs : Portainer → Containers → Logs

## 🎉 Félicitations !

Votre instance Drive Ooblik est maintenant opérationnelle sur Portainer ! 🚀