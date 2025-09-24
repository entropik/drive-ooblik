import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Fonction pour hasher un mot de passe
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Fonction pour vérifier un mot de passe
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const hashedPassword = await hashPassword(password);
  return hashedPassword === hash;
}

// Extraire le token de session depuis les headers
function extractToken(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) {
    const sessionCookie = cookieHeader
      .split(';')
      .find(c => c.trim().startsWith('admin_session='));
    if (sessionCookie) {
      return sessionCookie.split('=')[1];
    }
  }
  
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

serve(async (req: Request) => {
  // Gestion CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const { action, currentPassword, newPassword, email } = await req.json();

    // Vérification du token de session
    const sessionToken = extractToken(req);
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: 'Token de session manquant' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Vérification de la session admin
    const { data: sessionData, error: sessionError } = await supabase
      .rpc('verify_admin_session', { session_token: sessionToken });

    if (sessionError || !sessionData || sessionData.length === 0 || !sessionData[0].is_valid) {
      return new Response(JSON.stringify({ error: 'Session invalide ou expirée' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const adminUserId = sessionData[0].admin_user_id;

    if (action === 'update_password') {
      // Vérification mot de passe actuel
      const { data: userData, error: userError } = await supabase
        .from('admin_users')
        .select('password_hash')
        .eq('id', adminUserId)
        .single();

      if (userError || !userData) {
        return new Response(JSON.stringify({ error: 'Utilisateur introuvable' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Vérifier l'ancien mot de passe
      const isValidPassword = await verifyPassword(currentPassword, userData.password_hash);
      if (!isValidPassword) {
        return new Response(JSON.stringify({ error: 'Mot de passe actuel incorrect' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Hasher le nouveau mot de passe
      const newPasswordHash = await hashPassword(newPassword);

      // Mettre à jour le mot de passe
      const { error: updateError } = await supabase
        .from('admin_users')
        .update({ 
          password_hash: newPasswordHash,
          updated_at: new Date().toISOString()
        })
        .eq('id', adminUserId);

      if (updateError) {
        console.error('Erreur mise à jour mot de passe:', updateError);
        return new Response(JSON.stringify({ error: 'Erreur lors de la mise à jour' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, message: 'Mot de passe mis à jour' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'update_email') {
      // Mettre à jour l'email
      const { error: updateError } = await supabase
        .from('admin_users')
        .update({ 
          email: email,
          updated_at: new Date().toISOString()
        })
        .eq('id', adminUserId);

      if (updateError) {
        console.error('Erreur mise à jour email:', updateError);
        return new Response(JSON.stringify({ error: 'Erreur lors de la mise à jour' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, message: 'Email mis à jour' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else {
      return new Response(JSON.stringify({ error: 'Action non reconnue' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Erreur dans admin-update:', error);
    return new Response(JSON.stringify({ error: 'Erreur interne du serveur' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});