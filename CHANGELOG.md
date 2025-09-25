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
- Améliorations de la documentation (API, README, CHANGELOG)
- Ajout de la documentation du schéma de base de données
- Section dépannage dans le README
- Détails sur le rate limiting et SLA dans la documentation API

### [1.0.1] - À venir
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
