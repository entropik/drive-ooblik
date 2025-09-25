## API Reference

This document describes all public APIs, functions, and frontend components exported by the project. It includes request/response schemas, headers, and usage examples.

### Backend: Supabase Edge Functions (Public Endpoints)

Base URL pattern:

`https://<SUPABASE_PROJECT>.supabase.co/functions/v1/<function>`

Unless specified, responses are JSON with `Content-Type: application/json`.

Note: For production, prefer storing secrets in environment variables. Examples below use the project's anon API key as shown in the codebase for development.

#### 1) auth-magic-link (POST)
- Purpose: Generate and send a magic-link to access a transfer space.
- URL: `/auth-magic-link`
- Method: `POST`
- Headers:
  - `Content-Type: application/json`
  - `apikey: <SUPABASE_ANON_KEY>`
- Request body:
```json
{
  "email": "user@example.com",
  "space_name": "Catalogue 2024",
  "hcaptcha_token": "<token or dev-token>"
}
```
- Success response (development):
```json
{
  "success": true,
  "message": "Lien d'accès envoyé par email",
  "magic_token": "<uuid>",
  "magic_link": "https://.../functions/v1/auth-consume?token=<uuid>"
}
```
- Error codes: `400` invalid email/captcha, `429` rate limited, `500` server error
- Rate limiting: **5 tentatives par heure par IP**
  - Headers de réponse en cas de rate limiting:
    - `X-RateLimit-Limit: 5`
    - `X-RateLimit-Remaining: 0`
    - `X-RateLimit-Reset: <timestamp>`
    - `Retry-After: 3600` (secondes)
  - Stratégie de retry recommandée: Exponential backoff avec délai initial de 60s

Example:
```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -H 'apikey: <SUPABASE_ANON_KEY>' \
  -d '{"email":"user@example.com","space_name":"Catalogue 2024","hcaptcha_token":"dev-token"}' \
  'https://<SUPABASE_PROJECT>.supabase.co/functions/v1/auth-magic-link'
```

#### 2) auth-consume (GET)
- Purpose: Consume a magic token, create a secure session, and redirect to the app.
- URL: `/auth-consume?token=<uuid>`
- Method: `GET`
- Behavior:
  - Validates token (server stores hashed tokens)
  - Invalidates magic token, creates a time-limited session token (4h)
  - Redirects `302` to frontend with `?session=<sessionToken>&space=<space_name>`
- Errors: `400` invalid/expired token, `500` server error

Example:
```bash
curl -i 'https://<SUPABASE_PROJECT>.supabase.co/functions/v1/auth-consume?token=<uuid>'
```

#### 3) upload-init (POST)
- Purpose: Initialize an upload (record file, generate S3 key according to naming schema).
- URL: `/upload-init`
- Method: `POST`
- Headers:
  - `Content-Type: application/json`
  - `apikey: <SUPABASE_ANON_KEY>`
  - `x-session-token: <SESSION_TOKEN_FROM_auth-consume>`
- Request body:
```json
{
  "filename": "brochure.pdf",
  "file_size": 1048576,
  "mime_type": "application/pdf"
}
```
- Success response:
```json
{
  "success": true,
  "upload_id": "<uuid>",
  "file_id": "<db-id>",
  "s3_key": "2025/09/catalogue/brochure-<uuid>.pdf",
  "message": "Upload initialisé avec succès"
}
```
- Error codes: `401` invalid session, `400` invalid params/file type/size, `404` space not found, `500` server error

Example:
```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -H 'apikey: <SUPABASE_ANON_KEY>' \
  -H 'x-session-token: <SESSION_TOKEN>' \
  -d '{"filename":"brochure.pdf","file_size":1048576,"mime_type":"application/pdf"}' \
  'https://<SUPABASE_PROJECT>.supabase.co/functions/v1/upload-init'
```

#### 4) admin-auth (composite)
Single function exposing multiple routes:

- POST `/admin-auth`
  - Purpose: Admin login; returns a session token and sets `admin_session` cookie.
  - Body:
  ```json
  { "username": "admin", "password": "••••••" }
  ```
  - Response:
  ```json
  {
    "success": true,
    "token": "<session-token>",
    "expires_at": "<iso>",
    "user": { "id": "<id>", "username": "admin", "last_login_at": "<iso>" }
  }
  ```

- POST `/admin-auth/logout`
  - Purpose: Revoke admin session; clears `admin_session` cookie.
  - Auth: Bearer, `admin_session` cookie, or custom headers supported by other endpoints.

- GET `/admin-auth/verify`
  - Purpose: Verify admin session validity.
  - Auth: Bearer or `admin_session` cookie
  - Success response: `{ "success": true, "message": "Session valide", "user": { ... } }`

#### 5) admin-config (POST)
- Purpose: Save or fetch configuration values in `config` table.
- URL: `/admin-config`
- Method: `POST`
- Headers: `Content-Type: application/json`, plus one of:
  - Cookie: `admin_session=<token>`
  - `Authorization: Bearer <token>`
  - `x-admin-session: <token>`
- Body:
```json
{ "action": "save_config", "key": "s3_config", "value": { /* any JSON */ } }
```
or
```json
{ "action": "get_config", "key": "s3_config" }
```

#### 6) admin-update (POST)
- Purpose: Update admin account data.
- URL: `/admin-update`
- Method: `POST`
- Auth: Admin session as for `admin-config`
- Body (examples):
```json
{ "action": "update_password", "newPassword": "••••••" }
```
```json
{ "action": "update_email", "email": "admin@example.com" }
```

#### 7) test-smtp (POST)
- Purpose: Validate SMTP connection and send a test email.
- URL: `/test-smtp`
- Method: `POST`
- Auth: Admin session required
- Body:
```json
{ "email": "admin@example.com", "config": { "host": "smtp.example.com", "port": 587, "secure": false, "auth": { "user": "...", "pass": "..." }, "from": { "name": "Platform", "address": "noreply@example.com" } } }
```

#### 8) session-cleanup (POST)
- Purpose: Cleanup expired admin sessions (for cron).
- URL: `/session-cleanup`
- Method: `POST`

#### 9) cleanup-expired-tokens (POST)
- Purpose: Cleanup expired magic tokens.
- URL: `/cleanup-expired-tokens`
- Method: `POST`


### Frontend: Public Exports (Functions, Hooks, Components)

Import root alias: `@/` maps to `src/`.

#### Utility
- `cn(...inputs: ClassValue[]): string` from `src/lib/utils.ts` — merges Tailwind class names using `clsx` and `tailwind-merge`.

Example:
```tsx
import { cn } from "@/lib/utils";
<div className={cn("p-2", isActive && "bg-primary")} />
```

#### Hooks
- `useIsMobile(): boolean` from `src/hooks/use-mobile.tsx`
  - Returns `true` if viewport width is below 768px.

- `{ useToast, toast }` from `src/hooks/use-toast.ts`
  - Programmatic toasts with `sonner`-compatible API.

Example:
```tsx
import { useToast, toast } from "@/hooks/use-toast";

function Demo() {
  const { toasts } = useToast();
  return (
    <button onClick={() => toast({ title: "Saved", description: "All set." })}>
      Notify
    </button>
  );
}
```

#### Supabase Client
- `supabase` from `src/integrations/supabase/client.ts`

Example:
```ts
import { supabase } from "@/integrations/supabase/client";
const { data, error } = await supabase.from("files").select("*");
```

#### Feature Components

- `MagicLinkForm` from `src/components/Public/MagicLinkForm.tsx`
  - Props: `{ onSuccess: (data: { email: string; space_name: string; token?: string }) => void }`
  - Behavior: Validates inputs, hCaptcha (dev-bypassed), calls `auth-magic-link`, shows `sonner` toasts.

Example:
```tsx
import MagicLinkForm from "@/components/Public/MagicLinkForm";

export default function PublicPage() {
  return <MagicLinkForm onSuccess={(d) => console.log("success", d)} />;
}
```

- `FileUploadZone` from `src/components/Public/FileUploadZone.tsx`
  - Props: `{ sessionToken: string; onComplete: (files) => void }`
  - Behavior: Uses `upload-init` with `x-session-token`, displays progress and results.

Example:
```tsx
import FileUploadZone from "@/components/Public/FileUploadZone";

export default function UploadPage({ session }: { session: string }) {
  return <FileUploadZone sessionToken={session} onComplete={(f) => console.log(f)} />;
}
```

- `AdminLayout` from `src/components/Layout/AdminLayout.tsx`
  - Props: `{ children: ReactNode; activeTab: 'account' | 'smtp' | 'config' | 'files' | 'logs' | 'diagnostic'; onTabChange: (tab) => void; onLogout?: () => void }`

Example:
```tsx
import AdminLayout from "@/components/Layout/AdminLayout";

export function AdminScreen() {
  const [tab, setTab] = React.useState<'account'|'smtp'|'config'|'files'|'logs'|'diagnostic'>('account');
  return (
    <AdminLayout activeTab={tab} onTabChange={setTab} onLogout={() => {}}>
      {/* tab content */}
    </AdminLayout>
  );
}
```

#### UI Library (shadcn-ui wrappers)
All components under `src/components/ui/*` are exported and can be imported directly, for example:

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
```

Notable components with variants:
- `Button` — `variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'`, `size: 'default' | 'sm' | 'lg' | 'icon'`
- `Badge`, `Alert`, `Dialog`, `Drawer`, `Tabs`, `Table`, `Tooltip`, `DropdownMenu`, `Select`, `Popover`, `Accordion`, `Carousel`, etc.

Refer to the component files for prop interfaces where defined (e.g., `ButtonProps`, `TextareaProps`, `CalendarProps`, `ChartConfig`).

### Data Model Types
- Generated `Database` types in `src/integrations/supabase/types.ts` provide type-safe access to Supabase tables and enums.

### Security Notes
- Magic tokens are hashed at rest; only session tokens are used post-auth.
- Rate limiting and captcha verification are implemented in `auth-magic-link`.
- Admin endpoints require a valid admin session (cookie or Bearer/custom header).

## Performance & SLA

### Temps de réponse attendus

| Endpoint | P50 | P95 | P99 | Timeout |
|----------|-----|-----|-----|---------|
| `auth-magic-link` | 150ms | 400ms | 800ms | 30s |
| `auth-consume` | 100ms | 250ms | 500ms | 30s |
| `upload-init` | 200ms | 500ms | 1s | 30s |
| `admin-auth` | 100ms | 300ms | 600ms | 30s |
| `admin-config` | 80ms | 200ms | 400ms | 30s |
| `test-smtp` | 2s | 5s | 10s | 30s |

### Service Level Agreement (SLA)

#### Disponibilité
- **Cible**: 99.9% de disponibilité mensuelle
- **Fenêtre de maintenance**: Dimanche 2h-4h UTC
- **Monitoring**: Healthcheck toutes les 5 minutes

#### Limites de service
- **Taille maximale de fichier**: 5 GB
- **Uploads simultanés par session**: 10
- **Durée de session utilisateur**: 4 heures
- **Durée de session admin**: Configurable (défaut: 24h)
- **Expiration magic link**: 6 heures
- **Rate limiting**:
  - Auth: 5 tentatives/heure/IP
  - Upload: 100 requêtes/minute/session
  - Admin: 1000 requêtes/heure

#### Capacité
- **Utilisateurs simultanés**: 10,000
- **Uploads par jour**: 100,000
- **Stockage total**: Selon configuration S3
- **Bande passante**: Selon limites Supabase/S3

### Métriques de monitoring

#### Métriques clés (KPIs)
1. **Taux de succès authentification**: >95%
2. **Temps médian auth-magic-link**: <200ms
3. **Taux d'erreur global**: <1%
4. **Utilisation CPU Edge Functions**: <70%
5. **Latence P95 base de données**: <100ms

#### Alertes configurées
- Taux d'erreur >5% sur 5 minutes
- Temps de réponse P95 >2x la normale
- Échecs SMTP consécutifs >10
- Sessions actives >90% de la limite
- Espace disque <10% disponible

### Optimisations recommandées

#### Cache
- Headers Cache-Control sur assets statiques
- CDN pour fichiers uploadés fréquemment consultés
- Cache Redis pour sessions (optionnel)

#### Base de données
- Index sur colonnes de recherche fréquentes
- Partitionnement de la table `logs` par mois
- VACUUM automatique hebdomadaire
- Analyse des requêtes lentes via `pg_stat_statements`

#### Scalabilité
- Load balancer pour répartition du trafic
- Auto-scaling des Edge Functions selon charge
- Réplication read-only pour requêtes de lecture
- Queue asynchrone pour envois d'emails en masse

### Dégradation gracieuse

En cas de surcharge:
1. **Mode lecture seule**: Désactivation temporaire des uploads
2. **Queue d'attente**: File d'attente pour nouveaux utilisateurs
3. **Limitation progressive**: Réduction des limites par utilisateur
4. **Cache agressif**: Augmentation TTL du cache

### Backup & Recovery

- **RPO (Recovery Point Objective)**: 1 heure
- **RTO (Recovery Time Objective)**: 4 heures
- **Backups automatiques**: Toutes les 6 heures
- **Rétention**: 30 jours
- **Test de restauration**: Mensuel

