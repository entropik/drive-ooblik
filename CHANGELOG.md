## Changelog

Ce projet suit [Semantic Versioning](https://semver.org/lang/fr/) et est inspiré de [Keep a Changelog](https://keepachangelog.com/fr/).

### Stratégie de versioning

Nous utilisons le versioning sémantique (SemVer) : **MAJOR.MINOR.PATCH**

- **MAJOR** (X.0.0) : Changements incompatibles avec les versions précédentes
  - Modifications breaking de l'API
  - Changements majeurs de structure de base de données
  - Suppression de fonctionnalités

- **MINOR** (0.X.0) : Nouvelles fonctionnalités rétrocompatibles
  - Ajout de nouveaux endpoints API
  - Nouvelles fonctionnalités utilisateur
  - Améliorations significatives

- **PATCH** (0.0.X) : Corrections de bugs rétrocompatibles
  - Corrections de sécurité
  - Résolution de bugs
  - Améliorations mineures de performance

### [Non publié]
- Améliorations futures

### [1.1.0] - 2025-09-25
#### Ajouté - Containerisation Docker complète
- **Docker multi-services**: PostgreSQL + API Node.js + Frontend React/Nginx
- **Dockerfiles optimisés**:
  - `backend/Dockerfile`: Multi-stage build Node.js avec utilisateur non-root et dumb-init
  - `frontend.Dockerfile`: Build React + serveur Nginx avec SSL/certbot ready
- **Docker Compose**: Stack complète avec 3 services + proxy optionnel
  - Service `postgres`: PostgreSQL 15 avec init automatique et health checks
  - Service `api`: Backend Node.js isolé (port 3001) avec rate limiting
  - Service `web`: Frontend Nginx (port 80) avec reverse proxy vers API
  - Service `nginx`: Proxy optionnel pour SSL et load balancing
- **Configuration Nginx avancée**:
  - Reverse proxy intelligent avec rate limiting par zones (API/uploads)
  - Headers de sécurité (XSS, CORS, CSP)
  - Compression gzip et cache optimisé pour assets statiques
  - Support uploads jusqu'à 5GB avec timeouts étendus
- **Déploiement Portainer**:
  - Guide complet `docker/PORTAINER_DEPLOY.md` avec méthode Repository
  - Variables d'environnement documentées avec exemples SMTP/S3/hCaptcha
  - Scripts d'initialisation et health checks automatiques
  - Support SSL avec Let's Encrypt (prêt à l'emploi)
- **Sécurité Docker**:
  - Utilisateurs non-root dans tous les containers
  - Volumes persistants nommés pour PostgreSQL
  - Réseaux isolés bridge personnalisés
  - Secrets via variables d'environnement (pas de hardcoding)

#### Modifié
- Migration complète de Supabase vers PostgreSQL auto-hébergé
- Frontend adapté pour utiliser le nouveau service API au lieu du client Supabase
- Configuration de build optimisée pour production avec Vite

### [1.0.1] - 2025-09-25
#### Ajouté
- Documentation complète du schéma de base de données
- Section dépannage et résolution de problèmes courants
- Informations détaillées sur le rate limiting
- SLA et temps de réponse attendus

### [1.0.0] - 2025-09-25
#### Version initiale
##### Ajouté
- Authentification par lien magique (`auth-magic-link`, `auth-consume`) avec hCaptcha et rate limiting
- Création de sessions sécurisées (4h), invalidation des magic tokens
- Initialisation d’upload via `upload-init` (S3 key selon schéma configurable)
- Back‑office admin:
  - `admin-auth` (login/logout/verify)
  - `admin-config` (get/save)
  - `admin-update` (update_password/update_email)
  - `test-smtp` (vérification SMTP + envoi test)
- Tâches de maintenance: `session-cleanup`, `cleanup-expired-tokens`
- UI: composants shadcn-ui et écrans publics (MagicLinkForm, FileUploadZone)
