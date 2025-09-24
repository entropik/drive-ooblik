-- Corriger la fonction verify_admin_session pour éliminer l'ambiguïté de colonne
DROP FUNCTION IF EXISTS public.verify_admin_session(text);

CREATE OR REPLACE FUNCTION public.verify_admin_session(session_token text)
 RETURNS TABLE(admin_user_id uuid, username text, email text, is_valid boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Nettoyer les sessions expirées d'abord
  PERFORM public.cleanup_expired_admin_sessions();
  
  -- Vérifier et retourner la session
  RETURN QUERY
  SELECT 
    au.id as admin_user_id,
    au.username,
    au.email,
    (s.id IS NOT NULL AND s.expires_at > now()) as is_valid
  FROM public.admin_sessions s
  JOIN public.admin_users au ON au.id = s.admin_user_id
  WHERE s.session_token = session_token
    AND s.expires_at > now()
    AND au.is_active = true;
    
  -- Mettre à jour last_accessed_at si la session est valide
  UPDATE public.admin_sessions 
  SET last_accessed_at = now()
  WHERE admin_sessions.session_token = session_token
    AND expires_at > now();
END;
$function$;