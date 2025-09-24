-- Fix ambiguous column by renaming parameter and qualifying references
DROP FUNCTION IF EXISTS public.verify_admin_session(text);

CREATE OR REPLACE FUNCTION public.verify_admin_session(p_session_token text)
RETURNS TABLE(admin_user_id uuid, username text, email text, is_valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Clean expired sessions first
  PERFORM public.cleanup_expired_admin_sessions();

  -- Return the session info
  RETURN QUERY
  SELECT
    au.id AS admin_user_id,
    au.username,
    au.email,
    (s.id IS NOT NULL AND s.expires_at > now()) AS is_valid
  FROM public.admin_sessions s
  JOIN public.admin_users au ON au.id = s.admin_user_id
  WHERE s.session_token = p_session_token
    AND s.expires_at > now()
    AND au.is_active = true;

  -- Update last access time if still valid
  UPDATE public.admin_sessions
  SET last_accessed_at = now()
  WHERE public.admin_sessions.session_token = p_session_token
    AND public.admin_sessions.expires_at > now();
END;
$function$;