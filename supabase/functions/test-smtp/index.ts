import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const { email, config } = await req.json();

    // Vérification du token de session admin
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

    if (!email || !config) {
      return new Response(JSON.stringify({ error: 'Email et configuration requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Test SMTP avec config:', {
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.auth.user
    });

    // Créer le client SMTP
    const client = new SMTPClient({
      connection: {
        hostname: config.host,
        port: config.port,
        tls: config.secure,
        auth: {
          username: config.auth.user,
          password: config.auth.pass,
        },
      },
    });

    // Se connecter et envoyer l'email de test
    await client.connect();

    await client.send({
      from: config.from.address,
      to: email,
      subject: "Test de configuration SMTP - Plateforme Upload",
      content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Test SMTP</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">✅ Test SMTP Réussi</h1>
  </div>
  
  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
    <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
      Félicitations ! Votre configuration SMTP fonctionne parfaitement.
    </p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
      <h3 style="margin-top: 0; color: #28a745;">Configuration testée :</h3>
      <ul style="color: #666; line-height: 1.6;">
        <li><strong>Serveur :</strong> ${config.host}</li>
        <li><strong>Port :</strong> ${config.port}</li>
        <li><strong>Sécurité :</strong> ${config.secure ? 'SSL/TLS activé' : 'STARTTLS'}</li>
        <li><strong>Utilisateur :</strong> ${config.auth.user}</li>
        <li><strong>Expéditeur :</strong> ${config.from.name} &lt;${config.from.address}&gt;</li>
      </ul>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 20px; text-align: center;">
      Votre plateforme peut maintenant envoyer des emails automatiquement aux utilisateurs.
    </p>
  </div>
</body>
</html>`,
      html: true,
    });

    await client.close();

    console.log('Email de test envoyé avec succès à:', email);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Email de test envoyé avec succès' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erreur test SMTP:', error);
    
    let errorMessage = 'Erreur inconnue lors du test SMTP';
    
    if (error.message.includes('authentication')) {
      errorMessage = 'Erreur d\'authentification - Vérifiez vos identifiants';
    } else if (error.message.includes('connection')) {
      errorMessage = 'Erreur de connexion - Vérifiez l\'adresse du serveur et le port';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Timeout de connexion - Le serveur ne répond pas';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});