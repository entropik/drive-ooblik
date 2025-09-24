-- Fix critical security issue: Remove insecure RLS policy that allows anyone to view all spaces
-- The current "Admins can view all spaces" policy with "true" expression is dangerous
-- as it doesn't verify admin authentication, potentially exposing all email addresses

-- Drop the insecure policy that allows anyone to view all spaces
DROP POLICY IF EXISTS "Admins can view all spaces" ON public.spaces;

-- The existing "Admins have full access to spaces" policy already provides proper admin access
-- by checking the x-admin-user header, so no additional policy is needed

-- Verify the remaining policies are secure:
-- 1. "Public can create spaces" - INSERT only, allows space creation (necessary for the app)
-- 2. "Users can view their space by token only" - SELECT with proper token validation
-- 3. "Users can update their own space" - UPDATE with proper token validation  
-- 4. "Admins have full access to spaces" - ALL operations with admin header validation

-- This fix ensures that:
-- - Regular users can only see their own space (via magic token)
-- - Admins can see all spaces (via proper header authentication)
-- - No unauthorized access to email addresses is possible