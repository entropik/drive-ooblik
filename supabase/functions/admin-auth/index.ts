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

      // Génération du token de session admin sécurisé
      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8h

      // Création de la session en base de données
      const { error: sessionError } = await supabase
        .from('admin_sessions')
        .insert({
          admin_user_id: admin.id,
          session_token: sessionToken,
          expires_at: expiresAt.toISOString(),
          ip_address: req.headers.get('x-forwarded-for') || 'unknown',
          user_agent: req.headers.get('user-agent') || 'unknown'
        });

      if (sessionError) {
        console.error('Erreur création session:', sessionError);
        return new Response(
          JSON.stringify({ error: 'Erreur interne du serveur' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mise à jour du dernier login
      await supabase
        .from('admin_users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', admin.id);

      // Log de l'événement (sans exposer le token)
      await supabase.from('logs').insert({
        event_type: 'auth',
        details: { action: 'admin_login', username, admin_user_id: admin.id },
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
    const cookie = req.headers.get('cookie');
    const sessionToken = cookie?.split('admin_session=')[1]?.split(';')[0];

    // Révoquer la session en base si elle existe
    if (sessionToken) {
      try {
        const { error } = await supabase.rpc('revoke_admin_session', {
          session_token: sessionToken
        });
        if (error) {
          console.error('Erreur révocation session:', error);
        }
      } catch (error) {
        console.error('Erreur révocation session:', error);
      }
    }

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

    try {
      // Vérification sécurisée de la session en base
      const { data: sessionData, error } = await supabase.rpc('verify_admin_session', {
        session_token: sessionToken
      });

      if (error) {
        console.error('Erreur vérification session:', error);
        return new Response(
          JSON.stringify({ error: 'Erreur interne du serveur' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const session = sessionData?.[0];
      if (!session || !session.is_valid) {
        return new Response(
          JSON.stringify({ error: 'Session invalide ou expirée' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Session valide',
          user: {
            id: session.admin_user_id,
            username: session.username
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      console.error('Erreur vérification session:', error);
      return new Response(
        JSON.stringify({ error: 'Erreur interne du serveur' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response('Not Found', { status: 404, headers: corsHeaders });
});