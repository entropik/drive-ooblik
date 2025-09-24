-- Security Migration: Invalidate all existing plaintext magic tokens
-- This is necessary because we're now hashing tokens before storage
-- Existing plaintext tokens will no longer work and users will need to re-authentication with new hashed system

-- Clear all existing magic tokens to force re-authentication with new hashed system
UPDATE public.spaces 
SET 
    magic_token = NULL,
    token_expires_at = NULL,
    is_authenticated = false
WHERE magic_token IS NOT NULL;

-- Add index on magic_token for better performance
CREATE INDEX IF NOT EXISTS idx_spaces_magic_token 
ON public.spaces(magic_token) 
WHERE magic_token IS NOT NULL;

-- Add index on token expiration for cleanup queries  
CREATE INDEX IF NOT EXISTS idx_spaces_token_expires 
ON public.spaces(token_expires_at) 
WHERE token_expires_at IS NOT NULL;

-- Log this security migration using valid event_type
INSERT INTO public.logs (event_type, details, ip_address, user_agent) 
VALUES (
    'auth', 
    '{"action": "token_hashing_migration", "description": "Migrated to hashed token storage for enhanced security", "affected_spaces": 4}',
    '127.0.0.1',
    'supabase_migration'
);