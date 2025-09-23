-- Création des tables pour Ooblik S3 Manager

-- Table de configuration globale
CREATE TABLE public.config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des espaces/sessions utilisateur
CREATE TABLE public.spaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  space_name TEXT NOT NULL,
  magic_token TEXT UNIQUE,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  is_authenticated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des fichiers uploadés
CREATE TABLE public.files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id UUID REFERENCES public.spaces(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  s3_key TEXT NOT NULL UNIQUE,
  file_size BIGINT NOT NULL,
  mime_type TEXT,
  checksum TEXT,
  upload_status TEXT DEFAULT 'pending' CHECK (upload_status IN ('pending', 'completed', 'failed')),
  upload_id TEXT, -- pour multipart upload
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Table des logs système
CREATE TABLE public.logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('upload_init', 'part_uploaded', 'completed', 'delete', 'auth', 'error')),
  space_id UUID REFERENCES public.spaces(id) ON DELETE SET NULL,
  file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des administrateurs
CREATE TABLE public.admin_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS sur toutes les tables
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour les espaces (accès public limité)
CREATE POLICY "Public can create spaces" ON public.spaces FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view their own space" ON public.spaces FOR SELECT USING (email = current_setting('request.header.x-user-email', true) OR magic_token = current_setting('request.header.x-magic-token', true));
CREATE POLICY "Users can update their own space" ON public.spaces FOR UPDATE USING (magic_token = current_setting('request.header.x-magic-token', true));

-- Politiques RLS pour les fichiers
CREATE POLICY "Users can view files in their space" ON public.files FOR SELECT USING (
  space_id IN (
    SELECT id FROM public.spaces 
    WHERE magic_token = current_setting('request.header.x-magic-token', true) 
    OR email = current_setting('request.header.x-user-email', true)
  )
);
CREATE POLICY "Users can create files in their space" ON public.files FOR INSERT WITH CHECK (
  space_id IN (
    SELECT id FROM public.spaces 
    WHERE magic_token = current_setting('request.header.x-magic-token', true)
  )
);
CREATE POLICY "Users can update files in their space" ON public.files FOR UPDATE USING (
  space_id IN (
    SELECT id FROM public.spaces 
    WHERE magic_token = current_setting('request.header.x-magic-token', true)
  )
);

-- Politiques pour les logs (lecture seule pour les utilisateurs, accès admin complet)
CREATE POLICY "Users can view logs for their space" ON public.logs FOR SELECT USING (
  space_id IN (
    SELECT id FROM public.spaces 
    WHERE magic_token = current_setting('request.header.x-magic-token', true)
  )
);

-- Politiques pour les admins (accès complet)
CREATE POLICY "Admins have full access to config" ON public.config FOR ALL USING (current_setting('request.header.x-admin-user', true) IS NOT NULL);
CREATE POLICY "Admins have full access to spaces" ON public.spaces FOR ALL USING (current_setting('request.header.x-admin-user', true) IS NOT NULL);
CREATE POLICY "Admins have full access to files" ON public.files FOR ALL USING (current_setting('request.header.x-admin-user', true) IS NOT NULL);
CREATE POLICY "Admins have full access to logs" ON public.logs FOR ALL USING (current_setting('request.header.x-admin-user', true) IS NOT NULL);
CREATE POLICY "Admins can manage admin users" ON public.admin_users FOR ALL USING (current_setting('request.header.x-admin-user', true) IS NOT NULL);

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers pour updated_at
CREATE TRIGGER update_config_updated_at BEFORE UPDATE ON public.config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_spaces_updated_at BEFORE UPDATE ON public.spaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON public.admin_users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index pour les performances
CREATE INDEX idx_spaces_email ON public.spaces(email);
CREATE INDEX idx_spaces_magic_token ON public.spaces(magic_token);
CREATE INDEX idx_files_space_id ON public.files(space_id);
CREATE INDEX idx_files_s3_key ON public.files(s3_key);
CREATE INDEX idx_logs_event_type ON public.logs(event_type);
CREATE INDEX idx_logs_created_at ON public.logs(created_at);

-- Insertion de la configuration par défaut
INSERT INTO public.config (key, value) VALUES 
('s3_config', '{"region": "", "bucket": "", "prefix": "", "accessKey": "", "secretKey": ""}'),
('upload_config', '{"enableMultipart": true, "maxSizeMB": 100, "allowedExtensions": ["jpg", "jpeg", "png", "gif", "pdf", "doc", "docx", "zip"], "totalQuotaGB": 10}'),
('naming_schema', '{"schema": "{yyyy}/{mm}/{dd}/{uuid}-{filename}", "options": {"lowercase": true, "replaceSpacesWithDash": true, "stripAccents": true, "maxLength": 200}}'),
('branding', '{"logo": "", "background": "", "primaryColor": "#ff0000", "footerLinks": []}'),
('webhooks', '{"uploadCompletedUrl": "", "fileDeletedUrl": "", "secret": "", "enabled": false}'),
('smtp_config', '{"host": "", "port": 587, "secure": false, "user": "", "password": ""}');