import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-token',
};

interface UploadInitRequest {
  filename: string;
  file_size: number;
  mime_type: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Direct session validation without risky RPC/view dependencies
async function verifySession(sessionToken: string) {
  const { data: sessionData, error } = await supabase
    .from('user_sessions')
    .select('space_id, expires_at, is_active')
    .eq('session_token', sessionToken)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !sessionData) {
    return null;
  }

  // Update last accessed and get minimal space info from admin query
  await supabase
    .from('user_sessions')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('session_token', sessionToken);

  // Admin-level query to get space name without email exposure
  const { data: spaceData } = await supabase
    .from('spaces')
    .select('space_name, is_authenticated')
    .eq('id', sessionData.space_id)
    .single();

  return {
    space_id: sessionData.space_id,
    space_name: spaceData?.space_name || 'unknown',
    is_authenticated: spaceData?.is_authenticated || false
  };
}

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
    .replace('{email}', space.email || '[PROTECTED]')
    .replace('{user}', (space.email || '[PROTECTED]').split('@')[0])
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
    // Use session token instead of magic token for better security
    const sessionToken = req.headers.get('x-session-token');
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: 'Session token requis' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify session and get space info securely (no email exposure possible)
    const sessionData = await verifySession(sessionToken);
    if (!sessionData) {
      return new Response(
        JSON.stringify({ error: 'Session invalide ou expirée' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get minimal space info for file operations (name only)
    const { data: spaceInfo, error: spaceError } = await supabase
      .from('spaces')
      .select('space_name')
      .eq('id', sessionData.space_id)
      .single();

    if (spaceError || !spaceInfo) {
      return new Response(
        JSON.stringify({ error: 'Espace non trouvé' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Génération de la clé S3 (using session data without email)
    const s3Key = buildS3Key(namingConfig.schema, namingConfig.options, { 
      space_name: spaceInfo.space_name,
      email: '[PROTECTED]' // Never expose email in S3 keys
    }, filename);
    
    // Génération de l'ID d'upload multipart
    const uploadId = crypto.randomUUID();

    // Enregistrement du fichier en base (using secure session data)
    const { data: fileRecord, error: fileError } = await supabase
      .from('files')
      .insert({
        space_id: sessionData.space_id,
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

    // Log de l'événement (using secure session data)
    await supabase.from('logs').insert({
      event_type: 'auth', // Using valid event_type
      space_id: sessionData.space_id,
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