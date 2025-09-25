-- Migration initiale pour Drive Ooblik
-- Création de toutes les tables nécessaires

-- Table de configuration globale
CREATE TABLE IF NOT EXISTS config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des espaces/sessions utilisateur
CREATE TABLE IF NOT EXISTS spaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  space_name TEXT NOT NULL,
  magic_token TEXT UNIQUE,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  is_authenticated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des données privées des espaces (emails)
CREATE TABLE IF NOT EXISTS spaces_private (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(space_id)
);

-- Table des sessions utilisateur sécurisées
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des fichiers uploadés
CREATE TABLE IF NOT EXISTS files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  s3_key TEXT NOT NULL UNIQUE,
  file_size BIGINT NOT NULL,
  mime_type TEXT,
  checksum TEXT,
  upload_status TEXT DEFAULT 'pending' CHECK (upload_status IN ('pending', 'completed', 'failed', 'deleted')),
  upload_id TEXT, -- pour multipart upload
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table des logs système
CREATE TABLE IF NOT EXISTS logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('upload_init', 'part_uploaded', 'completed', 'delete', 'auth', 'error', 'admin_login', 'admin_logout', 'admin_config', 'admin_update', 'admin_smtp_test', 'session_cleanup', 'cleanup_expired_tokens', 'log_cleanup', 'daily_stats', 'rate_limit')),
  space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des administrateurs
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des sessions admin
CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_spaces_magic_token ON spaces(magic_token);
CREATE INDEX IF NOT EXISTS idx_spaces_space_name ON spaces(space_name);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_files_space_id ON files(space_id);
CREATE INDEX IF NOT EXISTS idx_files_upload_status ON files(upload_status);
CREATE INDEX IF NOT EXISTS idx_files_s3_key ON files(s3_key);
CREATE INDEX IF NOT EXISTS idx_logs_event_type ON logs(event_type);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_ip_address ON logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);

-- Créer un utilisateur admin par défaut (mot de passe: admin123)
INSERT INTO admin_users (username, password_hash, email, is_active)
VALUES (
  'admin',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- admin123
  'admin@example.com',
  true
)
ON CONFLICT (username) DO NOTHING;

-- Configuration par défaut
INSERT INTO config (key, value) VALUES
  ('smtp_config', '{"host": "smtp.gmail.com", "port": 587, "secure": false, "from": {"name": "Drive Ooblik", "address": "noreply@example.com"}}'),
  ('s3_config', '{"region": "eu-west-1", "bucket": "drive-ooblik-files"}'),
  ('naming_schema', '"{year}/{month}/{space}/{filename}-{uuid}"'),
  ('allowed_file_types', '[]'),
  ('max_file_size', '5368709120')
ON CONFLICT (key) DO NOTHING;