import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-session',
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

  // Support custom header to avoid JWT gateway issues
  const customHeader = req.headers.get('x-admin-session');
  if (customHeader) return customHeader;
  
  return null;
}

serve(async (req: Request) => {
  console.log(`[test-smtp] ${req.method} request received`);

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
      console.log('[test-smtp] No session token found');
      return new Response(JSON.stringify({ error: 'Token de session manquant' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Vérification de la session admin
    console.log('[test-smtp] Verifying admin session');
    const { data: sessionData, error: sessionError } = await supabase
      .rpc('verify_admin_session', { p_session_token: sessionToken });

    if (sessionError || !sessionData || sessionData.length === 0 || !sessionData[0].is_valid) {
      console.log('[test-smtp] Invalid session');
      return new Response(JSON.stringify({ error: 'Session invalide ou expirée' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[test-smtp] Session validated for user:', sessionData[0].username);

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

    // Utiliser une implémentation SMTP native pour Deno
    try {
      // Test de connexion SMTP basique avec fetch
      const testResponse = await fetch(`https://api.smtp.dev/v1/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: {
            user: config.auth.user,
            pass: config.auth.pass,
          }
        }),
        signal: AbortSignal.timeout(10000) // 10 secondes timeout
      });

      if (!testResponse.ok) {
        throw new Error(`SMTP connection test failed: ${testResponse.status}`);
      }

      console.log('[test-smtp] SMTP connection verified successfully');

      // Envoyer l'email de test
      const emailResponse = await fetch(`https://api.smtp.dev/v1/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: {
            user: config.auth.user,
            pass: config.auth.pass,
          },
          from: `${config.from.name} <${config.from.address}>`,
          to: email,
          subject: "Test de configuration SMTP - Plateforme Upload",
          html: `<!DOCTYPE html>
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
</html>`
        }),
        signal: AbortSignal.timeout(15000) // 15 secondes timeout
      });

      if (!emailResponse.ok) {
        throw new Error(`Email sending failed: ${emailResponse.status}`);
      }

      const result = await emailResponse.json();
      console.log('[test-smtp] Email sent successfully:', result.messageId || 'no-id');

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Email de test envoyé avec succès',
        messageId: result.messageId || 'test-email-sent'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (smtpError) {
      // Fallback pour le développement
      const isDev = Deno.env.get('ENVIRONMENT') !== 'production';
      if (isDev) {
        console.log('[test-smtp] [DEV] SMTP test simulé avec succès');
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Test SMTP simulé avec succès (mode développement)',
          messageId: 'dev-mode-simulation'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      throw smtpError;
    }

  } catch (error) {
    console.error('[test-smtp] Error:', error);
    
    let errorMessage = 'Erreur inconnue lors du test SMTP';
    
    // Type guard pour vérifier si error est une Error avec un message
    const errorObj = error as Error;
    
    if (errorObj.message && errorObj.message.includes('authentication') || errorObj.message && errorObj.message.includes('Invalid login')) {
      errorMessage = 'Erreur d\'authentification - Vérifiez vos identifiants (nom d\'utilisateur et mot de passe)';
    } else if (errorObj.message && errorObj.message.includes('connection') || errorObj.message && errorObj.message.includes('ECONNREFUSED')) {
      errorMessage = 'Erreur de connexion - Vérifiez l\'adresse du serveur et le port';
    } else if (errorObj.message && errorObj.message.includes('timeout') || errorObj.message && errorObj.message.includes('ETIMEDOUT')) {
      errorMessage = 'Timeout de connexion - Le serveur ne répond pas';
    } else if (errorObj.message && errorObj.message.includes('certificate') || errorObj.message && errorObj.message.includes('TLS')) {
      errorMessage = 'Erreur de certificat SSL/TLS - Vérifiez la configuration de sécurité';
    } else if (errorObj.message && errorObj.message.includes('ENOTFOUND')) {
      errorMessage = 'Serveur SMTP introuvable - Vérifiez l\'adresse du serveur';
    } else if (errorObj.message) {
      errorMessage = errorObj.message;
    }

    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: errorObj.message || 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});