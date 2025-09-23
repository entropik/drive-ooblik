-- Ajouter les configurations par défaut pour l'upload et le nommage des fichiers

INSERT INTO public.config (key, value) VALUES 
('upload_config', '{
  "maxSizeMB": 500,
  "allowedExtensions": ["jpg", "jpeg", "png", "pdf", "doc", "docx", "zip", "rar", "mp3", "mp4", "avi", "mov", "ppt", "pptx", "xls", "xlsx", "txt", "csv"],
  "enableMultipart": true
}'),
('naming_schema', '{
  "schema": "{space}/{yyyy}-{mm}-{dd}/{filename}",
  "options": {
    "lowercase": true,
    "replaceSpacesWithDash": true,
    "stripAccents": true,
    "maxLength": 200
  }
}')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();