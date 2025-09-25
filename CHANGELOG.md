## Changelog

Ce projet suit un format inspiré de « Keep a Changelog ».

### [Non publié]
- Améliorations de la documentation (API, README, CHANGELOG)

### 1.0.0 — 2025-09-25
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
