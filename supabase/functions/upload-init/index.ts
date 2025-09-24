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

const buildS3Key = async (supabase: any, schema: string, options: any, space: any, filename: string): Promise<string> => {
  const now = new Date();
  const uuid = crypto.randomUUID();
  const random8 = Math.random().toString(36).substring(2, 10).toUpperCase();
  
  // Extract file parts
  const lastDotIndex = filename.lastIndexOf('.');
  const basename = lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
  const ext = lastDotIndex > 0 ? filename.substring(lastDotIndex + 1) : '';

  // Récupérer l'email depuis spaces_private
  let email = 'unknown';
  if (space.id) {
    const { data: privateData } = await supabase
      .from('spaces_private')
      .select('email')
      .eq('space_id', space.id)
      .single();
    
    if (privateData?.email) {
      email = privateData.email;
    }
  }

  let key = schema
    .replace(/{yyyy}/g, now.getFullYear().toString())
    .replace(/{mm}/g, (now.getMonth() + 1).toString().padStart(2, '0'))
    .replace(/{dd}/g, now.getDate().toString().padStart(2, '0'))
    .replace(/{HH}/g, now.getHours().toString().padStart(2, '0'))
    .replace(/{ii}/g, now.getMinutes().toString().padStart(2, '0'))
    .replace(/{ss}/g, now.getSeconds().toString().padStart(2, '0'))
    .replace(/{uuid}/g, uuid)
    .replace(/{random8}/g, random8)
    .replace(/{email}/g, email)
    .replace(/{user}/g, email.replace('@', '-').replace(/\./g, '-').toLowerCase())
    .replace(/{space}/g, (space.space_name || 'unknown').toLowerCase().replace(/\s+/g, '-'))
    .replace(/{order_id}/g, space.order_id || 'no-order')
    .replace(/{filename}/g, filename)
    .replace(/{basename}/g, basename)
    .replace(/{ext}/g, ext);

  // Apply options
  if (options.lowercase) {
    key = key.toLowerCase();
  }
  
  if (options.replaceSpacesWithDash) {
    key = key.replace(/\s+/g, '-');
  }
  
  if (options.stripAccents) {
    key = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  
  if (options.maxLength && key.length > options.maxLength) {
    const extension = ext ? `.${ext}` : '';
    key = key.substring(0, options.maxLength - extension.length) + extension;
  }

  return key;
};

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

    // Récupérer la configuration S3 et naming schema depuis la table config
    const { data: configData, error: configError } = await supabase
      .from('config')
      .select('key, value')
      .in('key', ['s3_config', 'naming_schema']);

    if (configError) {
      console.error('Config fetch error:', configError);
      return new Response(JSON.stringify({ error: 'Failed to fetch configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse config data
    const s3Config = configData?.find(c => c.key === 's3_config')?.value || {
      allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx', 'zip'],
      maxFileSize: 500 * 1024 * 1024 // 500MB
    };
    const namingSchema = configData?.find(c => c.key === 'naming_schema')?.value || { 
      schema: '{yyyy}/{mm}/{space}/{basename}-{uuid}.{ext}',
      prefix: '',
      lowercase: true,
      replaceSpacesWithDash: true,
      stripAccents: true,
      maxLength: 255
    };

    // Validation des paramètres avec config S3
    const maxFileSize = s3Config.maxFileSize || (500 * 1024 * 1024); // 500MB par défaut
    if (file_size > maxFileSize) {
      return new Response(JSON.stringify({ error: 'File too large' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const fileExtension = filename.split('.').pop()?.toLowerCase();
    const allowedExtensions = s3Config.allowedExtensions || ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx', 'zip'];
    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      return new Response(JSON.stringify({ error: 'File type not allowed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Générer la clé S3 avec le préfixe
    const baseKey = await buildS3Key(
      supabase,
      namingSchema.schema, 
      namingSchema, 
      { id: sessionData.space_id, space_name: spaceInfo.space_name }, 
      filename
    );
    
    const s3Key = namingSchema.prefix ? `${namingSchema.prefix}${baseKey}` : baseKey;
    
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
      event_type: 'upload_init',
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