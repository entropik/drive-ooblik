import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminLoginRequest {
  username: string;
  password: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const hashedPassword = await hashPassword(password);
  return hashedPassword === hash;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  // Route: POST /admin-auth (login)
  if (req.method === 'POST' && path.endsWith('/admin-auth')) {
    try {
      const { username, password }: AdminLoginRequest = await req.json();

      if (!username || !password) {
        return new Response(
          JSON.stringify({ error: 'Nom d\'utilisateur et mot de passe requis' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Vérification des credentials admin
      const { data: admin, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('username', username)
        .eq('is_active', true)
        .single();

      if (error || !admin) {
        return new Response(
          JSON.stringify({ error: 'Identifiants invalides' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const isValidPassword = await verifyPassword(password, admin.password_hash);
      if (!isValidPassword) {
        return new Response(
          JSON.stringify({ error: 'Identifiants invalides' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Génération du token de session admin
      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8h

      // Mise à jour du dernier login
      await supabase
        .from('admin_users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', admin.id);

      // Log de l'événement
      await supabase.from('logs').insert({
        event_type: 'auth',
        details: { action: 'admin_login', username },
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown'
      });

      return new Response(
        JSON.stringify({
          success: true,
          token: sessionToken,
          expires_at: expiresAt.toISOString(),
          user: {
            id: admin.id,
            username: admin.username,
            last_login_at: admin.last_login_at
          }
        }),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Set-Cookie': `admin_session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`
          } 
        }
      );

    } catch (error) {
      console.error('Erreur dans admin login:', error);
      return new Response(
        JSON.stringify({ error: 'Erreur interne du serveur' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Route: POST /admin-auth/logout
  if (req.method === 'POST' && path.includes('/logout')) {
    return new Response(
      JSON.stringify({ success: true, message: 'Déconnexion réussie' }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Set-Cookie': 'admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'
        } 
      }
    );
  }

  // Route: GET /admin-auth/verify
  if (req.method === 'GET' && path.includes('/verify')) {
    const cookie = req.headers.get('cookie');
    const sessionToken = cookie?.split('admin_session=')[1]?.split(';')[0];

    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: 'Session non trouvée' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // En production, vous devriez stocker les sessions en base ou Redis
    // Pour cette démo, on accepte tout token UUID valide
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionToken)) {
      return new Response(
        JSON.stringify({ error: 'Session invalide' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Session valide' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response('Not Found', { status: 404, headers: corsHeaders });
});