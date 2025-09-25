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

## Dépannage

### Problèmes d'installation

#### Erreur: "Cannot find module '@supabase/supabase-js'"
**Solution**: Assurez-vous d'avoir exécuté `npm install` dans le répertoire du projet.

#### Erreur: "VITE_SUPABASE_URL is not defined"
**Solution**: Créez un fichier `.env` à la racine avec vos variables d'environnement:
```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon
```

### Problèmes de connexion Supabase

#### Erreur 401: "Invalid API key"
**Causes possibles**:
- Clé API incorrecte dans `.env`
- Utilisation de la mauvaise clé (anon vs service_role)

**Solution**: Vérifiez vos clés dans Supabase Dashboard > Settings > API.

#### Erreur: "relation 'spaces' does not exist"
**Solution**: Les migrations n'ont pas été appliquées. Exécutez:
```bash
supabase db push
```

### Problèmes d'authentification

#### Le lien magique n'arrive pas
**Vérifications**:
1. Configuration SMTP dans l'admin (`/admin` > Configuration)
2. Logs d'erreur dans Supabase Dashboard > Logs > Edge Functions
3. En développement, le lien s'affiche dans la console

#### Erreur: "Trop de tentatives. Réessayez dans une heure."
**Cause**: Rate limiting (5 tentatives/heure/IP)
**Solution**: Attendez 1 heure ou changez d'IP (redémarrer box internet).

#### Session expirée après 4 heures
**Comportement normal**: Les sessions durent 4 heures pour la sécurité.
**Solution**: L'utilisateur doit demander un nouveau lien magique.

### Problèmes SMTP

#### Test SMTP échoue
**Vérifications**:
1. **Gmail**: Activer "Accès moins sécurisé" ou utiliser un mot de passe d'application
2. **Port 587**: TLS/STARTTLS (secure: false)
3. **Port 465**: SSL (secure: true)
4. **Firewall**: Vérifier que les ports ne sont pas bloqués

#### Exemple configuration Gmail:
```json
{
  "host": "smtp.gmail.com",
  "port": 587,
  "secure": false,
  "auth": {
    "user": "votre@gmail.com",
    "pass": "mot-de-passe-application"
  }
}
```

### Problèmes d'upload S3

#### Erreur: "S3 configuration missing"
**Solution**: Configurer S3 dans l'interface admin:
```json
{
  "accessKeyId": "VOTRE_ACCESS_KEY",
  "secretAccessKey": "VOTRE_SECRET_KEY",
  "region": "eu-west-1",
  "bucket": "votre-bucket"
}
```

#### Erreur CORS sur upload
**Solution**: Configurer CORS sur votre bucket S3:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
  </CORSRule>
</CORSConfiguration>
```

#### Upload échoue pour fichiers > 5GB
**Limite**: La taille maximale est de 5GB par fichier.
**Solution**: Utiliser un outil de compression ou découper le fichier.

### Problèmes de performance

#### Interface lente
**Vérifications**:
1. Distance au serveur Supabase (choisir région proche)
2. Taille des requêtes (pagination recommandée)
3. Index manquants en base de données

#### Timeout sur les fonctions Edge
**Limite**: 30 secondes maximum pour les Edge Functions.
**Solution**: Optimiser les requêtes ou utiliser des jobs asynchrones.

### Problèmes de développement

#### Hot reload ne fonctionne pas
**Solution**: Redémarrer Vite:
```bash
# Arrêter avec Ctrl+C puis
npm run dev
```

#### TypeScript errors après mise à jour
**Solution**: Regénérer les types Supabase:
```bash
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

### Logs et debugging

#### Où trouver les logs?
- **Frontend**: Console du navigateur (F12)
- **Edge Functions**: Supabase Dashboard > Logs > Edge Functions
- **Base de données**: Table `logs` ou Supabase Dashboard > Logs > Postgres

#### Activer le mode debug
Ajoutez dans votre `.env`:
```env
VITE_DEBUG=true
```

### Support

Si votre problème persiste:
1. Vérifiez les [issues GitHub](https://github.com/votre-repo/issues)
2. Consultez la [documentation Supabase](https://supabase.com/docs)
3. Contactez le support technique
