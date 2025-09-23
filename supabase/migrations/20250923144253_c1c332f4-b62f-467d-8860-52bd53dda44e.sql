-- Correction des warnings de sécurité : search_path pour les fonctions

-- Correction de la fonction cleanup_expired_admin_sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_admin_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.admin_sessions 
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Correction de la fonction verify_admin_session
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Correction de la fonction revoke_admin_session
CREATE OR REPLACE FUNCTION public.revoke_admin_session(session_token TEXT)
RETURNS void AS $$
BEGIN
  DELETE FROM public.admin_sessions 
  WHERE session_token = revoke_admin_session.session_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;