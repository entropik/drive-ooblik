-- Corriger les autres policies files qui référencent encore magic_token

-- Supprimer les anciennes policies files qui utilisent magic_token
DROP POLICY IF EXISTS "Users can create files in their space" ON public.files;
DROP POLICY IF EXISTS "Users can update files in their space" ON public.files;

-- Créer des policies files basées sur les sessions sécurisées
CREATE POLICY "Users can create files in their space via session" 
ON public.files 
FOR INSERT 
WITH CHECK (
    space_id IN (
        SELECT space_id FROM public.user_sessions 
        WHERE session_token = current_setting('request.header.x-session-token'::text, true)
        AND expires_at > now()
        AND is_active = true
    )
);

CREATE POLICY "Users can update files in their space via session" 
ON public.files 
FOR UPDATE 
USING (
    space_id IN (
        SELECT space_id FROM public.user_sessions 
        WHERE session_token = current_setting('request.header.x-session-token'::text, true)
        AND expires_at > now()
        AND is_active = true
    )
);