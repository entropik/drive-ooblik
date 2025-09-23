-- Création d'un utilisateur admin par défaut
INSERT INTO public.admin_users (username, password_hash, is_active) 
VALUES ('admin', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', true)
ON CONFLICT (username) DO NOTHING;