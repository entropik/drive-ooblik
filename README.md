## Drive ooblik — Plateforme de transfert de fichiers

Application React (Vite + TypeScript + shadcn-ui + Tailwind) avec fonctions Edge Supabase pour l’authentification par lien magique, la gestion d’uploads et un back‑office administrateur.

### Fonctionnalités
- Authentification sans mot de passe via lien magique (hCaptcha + limitation de taux)
- Session sécurisée (token de session côté serveur, 4h)
- Initialisation d’upload avec schéma de nommage S3 configurable
- Back‑office admin: connexion, vérification de session, configuration (SMTP, S3, naming), test SMTP
- Composants UI réutilisables (shadcn-ui)

### Prérequis
- Node.js 18+ et npm
- Un projet Supabase (URL + clés) et tables/fonctions correspondantes

### Installation
```bash
npm install
npm run dev
```

Scripts disponibles:
- `npm run dev`: lancer le serveur Vite
- `npm run build`: build de production
- `npm run build:dev`: build en mode développement
- `npm run preview`: prévisualiser le build
- `npm run lint`: linting

### Configuration Supabase
Le client Supabase est exposé via `src/integrations/supabase/client.ts`. En développement, l’URL et la clé anon sont codées en dur. En production, configurez des variables d’environnement côté Edge Functions et utilisez des mécanismes sécurisés pour éviter d’exposer des secrets côté client.

Fonctions Edge exposées:
- `auth-magic-link` (POST) — génère et envoie un lien
- `auth-consume` (GET) — consomme le lien et crée une session, redirige vers le frontend
- `upload-init` (POST) — initialise un upload avec un `x-session-token`
- `admin-auth` (POST/GET) — login, logout, verify
- `admin-config` (POST) — get/save configuration
- `admin-update` (POST) — mise à jour email/mot de passe admin
- `test-smtp`, `session-cleanup`, `cleanup-expired-tokens`

Voir la documentation détaillée: `docs/API_REFERENCE.md`.

### Démarrage rapide (Frontend)
Exemple de formulaire d’accès public:
```tsx
import MagicLinkForm from "@/components/Public/MagicLinkForm";

export default function Acces() {
  return <MagicLinkForm onSuccess={(d) => console.log(d)} />;
}
```

Exemple d’upload après redirection (avec token de session):
```tsx
import FileUploadZone from "@/components/Public/FileUploadZone";

export default function Upload() {
  const params = new URLSearchParams(window.location.search);
  const session = params.get('session') || '';
  return <FileUploadZone sessionToken={session} onComplete={(files) => console.log(files)} />;
}
```

### Arborescence
```
src/
  components/
    Public/ (MagicLinkForm, FileUploadZone)
    Layout/ (AdminLayout)
    ui/ (... shadcn-ui)
  hooks/ (use-mobile, use-toast)
  integrations/supabase/ (client, types)
  lib/ (utils)
supabase/functions/ (... Edge Functions)
docs/API_REFERENCE.md
```

### Déploiement
- Frontend: build Vite (`npm run build`) puis hébergement statique
- Fonctions Edge: via Supabase (CLI/Studio). Assurez-vous que les variables d’environnement (SUPABASE_URL, SERVICE_ROLE_KEY, HCAPTCHA_SECRET, etc.) sont bien définies.

### Sécurité
- Les tokens « magic » sont hashés en base et invalidés après usage
- Seul le token de session est utilisé côté client après authentification
- Les endpoints admin nécessitent une session valide

### Journal des changements
Consultez `CHANGELOG.md`.
