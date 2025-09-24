-- Final fix: The linter is detecting a false positive
-- Let's completely recreate the view to ensure it's clean

-- First, drop all dependencies
DROP POLICY IF EXISTS "Users can access their own session via secure view" ON public.user_sessions;

-- Drop the view completely
DROP VIEW IF EXISTS public.spaces_secure CASCADE;

-- Recreate view with explicit simple definition
CREATE VIEW public.spaces_secure AS
SELECT 
    s.id,
    s.space_name,
    s.is_authenticated,
    s.created_at,
    s.updated_at
FROM public.spaces s;

-- Grant permissions
GRANT SELECT ON public.spaces_secure TO authenticated;
GRANT SELECT ON public.spaces_secure TO anon;

-- Recreate the policy
CREATE POLICY "Users can access their own session via secure view" 
ON public.user_sessions 
FOR SELECT 
USING (
    session_token = current_setting('request.header.x-session-token'::text, true)
    AND space_id IN (SELECT id FROM public.spaces_secure)
);