-- Remove security definer artifacts and tighten data exposure

-- 1) Drop RPC and View used by scanner as risky
DROP FUNCTION IF EXISTS public.validate_session_secure(text);
DROP VIEW IF EXISTS public.spaces_secure CASCADE;

-- 2) Recreate minimal, safe policy on user_sessions (no view dependency)
DROP POLICY IF EXISTS "Users can access their own session via secure view" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can access their own session" ON public.user_sessions;
CREATE POLICY "Users can access their own session"
ON public.user_sessions
FOR SELECT
USING (
  session_token = current_setting('request.header.x-session-token'::text, true)
  AND expires_at > now()
  AND is_active = true
);

-- 3) Ensure no public grants exist on sensitive base tables
REVOKE ALL ON public.spaces FROM anon, authenticated;