-- CORRECTION SÉCURITÉ CRITIQUE : Verrouillage complet de la table admin_users

-- 1. Suppression de toutes les politiques RLS existantes
DROP POLICY IF EXISTS "Admins can manage admin users" ON public.admin_users;

-- 2. Création d'une politique restrictive qui bloque TOUT accès via l'API REST
CREATE POLICY "Block all public access to admin_users" 
ON public.admin_users 
FOR ALL 
TO public 
USING (false) 
WITH CHECK (false);

-- 3. Création d'une politique spéciale pour le rôle service (Edge Functions uniquement)
CREATE POLICY "Service role only access" 
ON public.admin_users 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- 4. S'assurer que RLS est activé
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 5. Révocation explicite de tous les privilèges publics sur cette table
REVOKE ALL ON public.admin_users FROM public;
REVOKE ALL ON public.admin_users FROM anon;
REVOKE ALL ON public.admin_users FROM authenticated;

-- 6. Octroi des privilèges uniquement au service_role (Edge Functions)
GRANT ALL ON public.admin_users TO service_role;