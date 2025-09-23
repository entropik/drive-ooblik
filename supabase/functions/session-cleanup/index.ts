import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req: Request) => {
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
    console.log('Démarrage du nettoyage des sessions expirées...');

    // Appel de la fonction de nettoyage
    const { error } = await supabase.rpc('cleanup_expired_admin_sessions');

    if (error) {
      console.error('Erreur lors du nettoyage des sessions:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erreur lors du nettoyage des sessions' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Compter le nombre de sessions actives restantes
    const { data: activeSessions, error: countError } = await supabase
      .from('admin_sessions')
      .select('id', { count: 'exact' })
      .gt('expires_at', new Date().toISOString());

    if (countError) {
      console.error('Erreur lors du comptage des sessions:', countError);
    }

    console.log(`Nettoyage terminé. Sessions actives restantes: ${activeSessions?.length || 0}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Nettoyage des sessions terminé',
        active_sessions: activeSessions?.length || 0
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erreur dans session-cleanup:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Erreur interne du serveur' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});