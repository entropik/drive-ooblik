import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Security: Hash tokens to match stored hashed versions
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response('Token manquant', { status: 400, headers: corsHeaders });
    }

    // Get client IP for binding verification
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // Hash the incoming token to compare with stored hash
    const hashedToken = await hashToken(token);
    
    // Vérification du token (compare hashed versions)
    const { data: space, error } = await supabase
      .from('spaces')
      .select('*')
      .eq('magic_token', hashedToken)
      .gt('token_expires_at', new Date().toISOString())
      .single();

    if (error || !space) {
      return new Response('Token invalide ou expiré', { status: 400, headers: corsHeaders });
    }

    // Security: Create secure session instead of exposing magic token
    // Generate a secure session token for post-authentication access
    const sessionToken = crypto.randomUUID();
    const sessionExpiry = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours session
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Invalidate the magic token and update the space as authenticated
    await supabase
      .from('spaces')
      .update({ 
        is_authenticated: true,
        magic_token: null, // Invalidate token for security
        token_expires_at: null // Clear expiration
      })
      .eq('id', space.id);

    // Create secure session
    const { error: sessionError } = await supabase
      .from('user_sessions')
      .insert({
        space_id: space.id,
        session_token: sessionToken,
        expires_at: sessionExpiry.toISOString(),
        ip_address: clientIP,
        user_agent: userAgent
      });

    // Log de l'événement (sans email dans le log pour sécurité)
    await supabase.from('logs').insert({
      event_type: 'auth',
      space_id: space.id,
      details: { action: 'magic_link_consumed', space_name: space.space_name, session_created: !sessionError },
      ip_address: clientIP,
      user_agent: userAgent
    });

    if (sessionError) {
      console.error('Session creation error:', sessionError);
      return new Response('Session creation failed', { status: 500, headers: corsHeaders });
    }

    // Redirection vers le frontend avec le session token sécurisé
    const origin = req.headers.get('origin') || 'https://id-preview--2a6e92db-f750-4f00-b532-ae0113580339.lovable.app';
    const redirectUrl = `${origin}/?session=${sessionToken}&space=${encodeURIComponent(space.space_name)}`;
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl,
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Erreur dans auth-consume:', error);
    return new Response('Erreur interne du serveur', { status: 500, headers: corsHeaders });
  }
});