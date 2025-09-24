-- Fix search_path security issue in the function
CREATE OR REPLACE FUNCTION public.get_space_info_secure(p_session_token text)
RETURNS TABLE(
    space_id uuid,
    space_name text,
    is_authenticated boolean,
    created_at timestamp with time zone
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    -- Verify session is valid
    IF NOT EXISTS (
        SELECT 1 FROM public.user_sessions 
        WHERE session_token = p_session_token 
        AND expires_at > now() 
        AND is_active = true
    ) THEN
        RETURN;
    END IF;
    
    -- Return space info without sensitive data like email
    RETURN QUERY
    SELECT 
        s.id as space_id,
        s.space_name,
        s.is_authenticated,
        s.created_at
    FROM public.spaces s
    JOIN public.user_sessions us ON us.space_id = s.id
    WHERE us.session_token = p_session_token
    AND us.expires_at > now()
    AND us.is_active = true;
END;
$$;