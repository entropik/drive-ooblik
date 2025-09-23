import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req: Request) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response('Token manquant', { status: 400 });
    }

    // Vérification du token
    const { data: space, error } = await supabase
      .from('spaces')
      .select('*')
      .eq('magic_token', token)
      .gt('token_expires_at', new Date().toISOString())
      .single();

    if (error || !space) {
      return new Response('Token invalide ou expiré', { status: 400 });
    }

    // Mise à jour de l'espace comme authentifié
    await supabase
      .from('spaces')
      .update({ is_authenticated: true })
      .eq('id', space.id);

    // Log de l'événement
    await supabase.from('logs').insert({
      event_type: 'auth',
      space_id: space.id,
      details: { action: 'magic_link_consumed', email: space.email },
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown'
    });

    // Redirection vers le frontend avec le token
    const redirectUrl = `${Deno.env.get('SUPABASE_URL').replace('supabase.co', 'lovable.app')}/?token=${token}&space=${encodeURIComponent(space.space_name)}`;
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl
      }
    });

  } catch (error) {
    console.error('Erreur dans auth-consume:', error);
    return new Response('Erreur interne du serveur', { status: 500 });
  }
});