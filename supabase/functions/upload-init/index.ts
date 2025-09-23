import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-magic-token',
};

interface UploadInitRequest {
  filename: string;
  file_size: number;
  mime_type: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Fonction pour construire la clé S3 selon le schéma configuré
function buildS3Key(schema: string, options: any, space: any, filename: string): string {
  const now = new Date();
  const basename = filename.substring(0, filename.lastIndexOf('.')) || filename;
  const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.') + 1) : '';
  
  let key = schema
    .replace('{yyyy}', now.getFullYear().toString())
    .replace('{mm}', (now.getMonth() + 1).toString().padStart(2, '0'))
    .replace('{dd}', now.getDate().toString().padStart(2, '0'))
    .replace('{HH}', now.getHours().toString().padStart(2, '0'))
    .replace('{ii}', now.getMinutes().toString().padStart(2, '0'))
    .replace('{ss}', now.getSeconds().toString().padStart(2, '0'))
    .replace('{uuid}', crypto.randomUUID())
    .replace('{random8}', Math.random().toString(36).substring(2, 10))
    .replace('{email}', space.email)
    .replace('{user}', space.email.split('@')[0])
    .replace('{space}', space.space_name)
    .replace('{order_id}', '') // TODO: À implémenter avec WooCommerce
    .replace('{filename}', filename)
    .replace('{basename}', basename)
    .replace('{ext}', ext);

  // Normalisation selon les options
  if (options.lowercase) {
    key = key.toLowerCase();
  }
  
  if (options.replaceSpacesWithDash) {
    key = key.replace(/\s+/g, '-');
  }
  
  if (options.stripAccents) {
    key = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  
  // Nettoyage des caractères spéciaux
  key = key.replace(/[^a-zA-Z0-9.\-_/]/g, '');
  
  // Troncature si nécessaire
  if (options.maxLength && key.length > options.maxLength) {
    const extension = ext ? `.${ext}` : '';
    key = key.substring(0, options.maxLength - extension.length) + extension;
  }
  
  return key;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const magicToken = req.headers.get('x-magic-token');
    if (!magicToken) {
      return new Response(
        JSON.stringify({ error: 'Token d\'authentification requis' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Vérification du token
    const { data: space, error: spaceError } = await supabase
      .from('spaces')
      .select('*')
      .eq('magic_token', magicToken)
      .eq('is_authenticated', true)
      .gt('token_expires_at', new Date().toISOString())
      .single();

    if (spaceError || !space) {
      return new Response(
        JSON.stringify({ error: 'Token invalide ou expiré' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { filename, file_size, mime_type }: UploadInitRequest = await req.json();

    if (!filename || !file_size || !mime_type) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Récupération des configurations
    const { data: configs } = await supabase
      .from('config')
      .select('key, value')
      .in('key', ['upload_config', 'naming_schema']);

    const uploadConfig = configs?.find(c => c.key === 'upload_config')?.value as any;
    const namingConfig = configs?.find(c => c.key === 'naming_schema')?.value as any;

    if (!uploadConfig || !namingConfig) {
      return new Response(
        JSON.stringify({ error: 'Configuration manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validation des règles d'upload
    const maxSizeBytes = uploadConfig.maxSizeMB * 1024 * 1024;
    if (file_size > maxSizeBytes) {
      return new Response(
        JSON.stringify({ error: `Fichier trop volumineux (max: ${uploadConfig.maxSizeMB}MB)` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileExtension = filename.split('.').pop()?.toLowerCase();
    if (fileExtension && !uploadConfig.allowedExtensions.includes(fileExtension)) {
      return new Response(
        JSON.stringify({ error: `Extension non autorisée. Extensions acceptées: ${uploadConfig.allowedExtensions.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Génération de la clé S3
    const s3Key = buildS3Key(namingConfig.schema, namingConfig.options, space, filename);
    
    // Génération de l'ID d'upload multipart
    const uploadId = crypto.randomUUID();

    // Enregistrement du fichier en base
    const { data: fileRecord, error: fileError } = await supabase
      .from('files')
      .insert({
        space_id: space.id,
        original_name: filename,
        s3_key: s3Key,
        file_size,
        mime_type,
        upload_status: 'pending',
        upload_id: uploadId
      })
      .select('id')
      .single();

    if (fileError) {
      console.error('Erreur création fichier:', fileError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de l\'initialisation du fichier' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log de l'événement
    await supabase.from('logs').insert({
      event_type: 'upload_init',
      space_id: space.id,
      file_id: fileRecord.id,
      details: { filename, file_size, mime_type, s3_key: s3Key },
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown'
    });

    return new Response(
      JSON.stringify({
        success: true,
        upload_id: uploadId,
        file_id: fileRecord.id,
        s3_key: s3Key,
        message: 'Upload initialisé avec succès'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erreur dans upload-init:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur interne du serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});