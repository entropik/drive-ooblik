-- Corriger les dépendances d'abord, puis migrer les emails

-- 1) Supprimer les policies qui dépendent de la colonne email
DROP POLICY IF EXISTS "Users can view files in their space" ON public.files;

-- 2) Créer une table séparée pour les données sensibles (emails)
CREATE TABLE public.spaces_private (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id uuid NOT NULL UNIQUE REFERENCES public.spaces(id) ON DELETE CASCADE,
    email text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3) Activer RLS sur la table privée
ALTER TABLE public.spaces_private ENABLE ROW LEVEL SECURITY;

-- 4) Policy ADMIN ONLY sur les données sensibles
CREATE POLICY "Admin only access to private space data" 
ON public.spaces_private 
FOR ALL 
USING (current_setting('request.header.x-admin-user'::text, true) IS NOT NULL);

-- 5) Migrer les emails existants vers la table privée
INSERT INTO public.spaces_private (space_id, email)
SELECT id, email FROM public.spaces WHERE email IS NOT NULL;

-- 6) Supprimer la colonne email de la table spaces
ALTER TABLE public.spaces DROP COLUMN email;

-- 7) Nettoyer les anciennes policies sur spaces
DROP POLICY IF EXISTS "Users can update their own space" ON public.spaces;

-- 8) Créer des RLS policies sécurisées sur spaces (sans emails)
CREATE POLICY "Users can update their own space via session" 
ON public.spaces 
FOR UPDATE 
USING (
    id IN (
        SELECT space_id FROM public.user_sessions 
        WHERE session_token = current_setting('request.header.x-session-token'::text, true)
        AND expires_at > now()
        AND is_active = true
    )
);

-- 9) Policy files corrigée (sans référence email)
CREATE POLICY "Users can view files in their space via session" 
ON public.files 
FOR SELECT 
USING (
    space_id IN (
        SELECT space_id FROM public.user_sessions 
        WHERE session_token = current_setting('request.header.x-session-token'::text, true)
        AND expires_at > now()
        AND is_active = true
    )
);

-- 10) Index pour performance
CREATE INDEX idx_spaces_private_space_id ON public.spaces_private(space_id);