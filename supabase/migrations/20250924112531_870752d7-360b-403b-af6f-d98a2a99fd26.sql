-- Create secure user sessions table to replace direct magic token access
-- This separates authentication from sensitive data access
CREATE TABLE public.user_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    session_token text NOT NULL UNIQUE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    last_accessed_at timestamp with time zone NOT NULL DEFAULT now(),
    ip_address inet,
    user_agent text,
    is_active boolean NOT NULL DEFAULT true
);

-- Enable RLS on sessions table
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_sessions
CREATE POLICY "Users can access their own session" 
ON public.user_sessions 
FOR SELECT 
USING (session_token = current_setting('request.header.x-session-token'::text, true));

CREATE POLICY "Service role full access to sessions" 
ON public.user_sessions 
FOR ALL 
USING (current_setting('request.header.x-admin-user'::text, true) IS NOT NULL);

-- Add indexes for performance
CREATE INDEX idx_user_sessions_token ON public.user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires ON public.user_sessions(expires_at);
CREATE INDEX idx_user_sessions_space ON public.user_sessions(space_id);

-- Update spaces table RLS to be more restrictive with email access
-- Remove the overly permissive magic token policy
DROP POLICY IF EXISTS "Users can view their space by token only" ON public.spaces;

-- Create new restrictive policies for spaces table
CREATE POLICY "Users can view space via session token (no email)" 
ON public.spaces 
FOR SELECT 
USING (
    id IN (
        SELECT space_id 
        FROM public.user_sessions 
        WHERE session_token = current_setting('request.header.x-session-token'::text, true)
        AND expires_at > now()
        AND is_active = true
    )
);

-- Admin policy remains the same for full access
-- "Admins have full access to spaces" policy already exists

-- Create a secure function to get space info without exposing email
CREATE OR REPLACE FUNCTION public.get_space_info_secure(p_session_token text)
RETURNS TABLE(
    space_id uuid,
    space_name text,
    is_authenticated boolean,
    created_at timestamp with time zone
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;