-- Fix the security definer view issue by removing dependencies first

-- Drop the policy that depends on the view
DROP POLICY IF EXISTS "Users can access their own session via secure view" ON public.user_sessions;

-- Drop and recreate the view without SECURITY DEFINER
DROP VIEW IF EXISTS public.spaces_secure;

-- Create standard view without SECURITY DEFINER (this is the correct way)
CREATE VIEW public.spaces_secure AS
SELECT 
    id,
    space_name,
    is_authenticated,
    created_at,
    updated_at
FROM public.spaces;

-- Grant permissions on the view
GRANT SELECT ON public.spaces_secure TO authenticated, anon;

-- Recreate the policy using the corrected view
CREATE POLICY "Users can access their own session via secure view" 
ON public.user_sessions 
FOR SELECT 
USING (
    session_token = current_setting('request.header.x-session-token'::text, true)
    AND space_id IN (SELECT id FROM public.spaces_secure)
);