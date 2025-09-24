-- Production Security: Create secure view and eliminate email exposure risks
-- This creates a completely secure architecture that prevents any email leakage

-- Create secure view of spaces without sensitive data
CREATE VIEW public.spaces_secure AS
SELECT 
    id,
    space_name,
    is_authenticated,
    created_at,
    updated_at
FROM public.spaces;

-- Grant appropriate permissions on the view
GRANT SELECT ON public.spaces_secure TO authenticated, anon;

-- Remove the session-based SELECT policy on spaces (this was still exposing emails)
DROP POLICY IF EXISTS "Users can view space via session token (no email)" ON public.spaces;

-- Update user_sessions policies to use the secure view
DROP POLICY IF EXISTS "Users can access their own session" ON public.user_sessions;

CREATE POLICY "Users can access their own session via secure view" 
ON public.user_sessions 
FOR SELECT 
USING (
    session_token = current_setting('request.header.x-session-token'::text, true)
    AND space_id IN (SELECT id FROM public.spaces_secure)
);

-- Create secure function to validate sessions without exposing emails
CREATE OR REPLACE FUNCTION public.validate_session_secure(p_session_token text)
RETURNS TABLE(
    space_id uuid,
    space_name text,
    is_authenticated boolean,
    session_expires_at timestamp with time zone,
    session_active boolean
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    -- Return session info with space data from secure view only
    RETURN QUERY
    SELECT 
        us.space_id,
        ss.space_name,
        ss.is_authenticated,
        us.expires_at as session_expires_at,
        us.is_active as session_active
    FROM public.user_sessions us
    JOIN public.spaces_secure ss ON ss.id = us.space_id
    WHERE us.session_token = p_session_token
    AND us.expires_at > now()
    AND us.is_active = true;
    
    -- Update last accessed time
    UPDATE public.user_sessions
    SET last_accessed_at = now()
    WHERE session_token = p_session_token
    AND expires_at > now()
    AND is_active = true;
END;
$$;

-- Drop the old function that could potentially expose data
DROP FUNCTION IF EXISTS public.get_space_info_secure(text);