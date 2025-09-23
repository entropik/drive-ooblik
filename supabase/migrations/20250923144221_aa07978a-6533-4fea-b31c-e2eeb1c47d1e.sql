-- Phase 1 : Corrections Critiques de Sécurité

-- 1. Création de la table admin_sessions pour sécuriser l'authentification
CREATE TABLE public.admin_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT
);

-- Index pour les performances
CREATE INDEX idx_admin_sessions_token ON public.admin_sessions(session_token);
CREATE INDEX idx_admin_sessions_expires ON public.admin_sessions(expires_at);

-- RLS sur admin_sessions
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block all public access to admin_sessions" 
ON public.admin_sessions 
FOR ALL 
TO public 
USING (false) 
WITH CHECK (false);

CREATE POLICY "Service role only access to admin_sessions" 
ON public.admin_sessions 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Révocation des privilèges publics
REVOKE ALL ON public.admin_sessions FROM public;
REVOKE ALL ON public.admin_sessions FROM anon;
REVOKE ALL ON public.admin_sessions FROM authenticated;
GRANT ALL ON public.admin_sessions TO service_role;

-- 2. Correction critique des politiques RLS sur spaces (suppression accès par email)
DROP POLICY IF EXISTS "Users can view their own space" ON public.spaces;

-- Nouvelle politique sécurisée : uniquement par magic token ou admin
CREATE POLICY "Users can view their space by token only" 
ON public.spaces 
FOR SELECT 
USING (
  magic_token = current_setting('request.header.x-magic-token'::text, true)
);

-- Politique admin sécurisée utilisant les sessions
CREATE POLICY "Admins can view all spaces" 
ON public.spaces 
FOR SELECT 
TO service_role
USING (true);

-- 3. Correction critique des politiques RLS sur config
DROP POLICY IF EXISTS "Admins have full access to config" ON public.config;

-- Nouvelle politique sécurisée pour config : service_role uniquement
CREATE POLICY "Service role only access to config" 
ON public.config 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Block all public access to config" 
ON public.config 
FOR ALL 
TO public 
USING (false) 
WITH CHECK (false);

-- 4. Fonction de nettoyage des sessions expirées
CREATE OR REPLACE FUNCTION public.cleanup_expired_admin_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.admin_sessions 
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fonction sécurisée pour vérifier les sessions admin
CREATE OR REPLACE FUNCTION public.verify_admin_session(session_token TEXT)
RETURNS TABLE(
  admin_user_id UUID,
  username TEXT,
  is_valid BOOLEAN
) AS $$
BEGIN
  -- Nettoyer les sessions expirées d'abord
  PERFORM public.cleanup_expired_admin_sessions();
  
  -- Vérifier et retourner la session
  RETURN QUERY
  SELECT 
    au.id as admin_user_id,
    au.username,
    (s.id IS NOT NULL AND s.expires_at > now()) as is_valid
  FROM public.admin_sessions s
  JOIN public.admin_users au ON au.id = s.admin_user_id
  WHERE s.session_token = verify_admin_session.session_token
    AND s.expires_at > now()
    AND au.is_active = true;
    
  -- Mettre à jour last_accessed_at si la session est valide
  UPDATE public.admin_sessions 
  SET last_accessed_at = now()
  WHERE session_token = verify_admin_session.session_token
    AND expires_at > now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Fonction pour révoquer une session
CREATE OR REPLACE FUNCTION public.revoke_admin_session(session_token TEXT)
RETURNS void AS $$
BEGIN
  DELETE FROM public.admin_sessions 
  WHERE session_token = revoke_admin_session.session_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;