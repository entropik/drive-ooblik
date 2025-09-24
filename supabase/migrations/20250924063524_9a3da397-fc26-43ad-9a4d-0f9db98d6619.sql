-- Ajouter l'email à la table admin_users pour le compte professionnel
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS email text;

-- Ajouter un index unique sur l'email
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_unique ON public.admin_users(email) WHERE email IS NOT NULL;

-- Ajouter la configuration SMTP par défaut pour Fastmail
INSERT INTO public.config (key, value) VALUES 
('smtp_config', '{
  "provider": "fastmail",
  "host": "smtp.fastmail.com",
  "port": 465,
  "secure": true,
  "auth": {
    "user": "",
    "pass": ""
  },
  "from": {
    "name": "Plateforme Upload",
    "address": ""
  }
}')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();