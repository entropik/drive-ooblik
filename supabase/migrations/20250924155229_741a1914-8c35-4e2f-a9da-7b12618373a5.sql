-- Réinitialiser le mot de passe admin à "admin123"
UPDATE admin_users 
SET password_hash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    updated_at = now()
WHERE username = 'admin';