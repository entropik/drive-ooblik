const crypto = require('crypto');
const { query, withTransaction } = require('../config/database');
const emailService = require('../services/emailService');
const logger = require('../config/logger');

class AuthController {
  // Générer et envoyer un lien magique
  async sendMagicLink(req, res) {
    try {
      const { email, space_name, hcaptcha_token } = req.body;

      // Validation des données
      if (!email || !space_name) {
        return res.status(400).json({ error: 'Email et nom d\'espace requis' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Format d\'email invalide' });
      }

      // Vérification hCaptcha (si configurée et en production)
      if (process.env.NODE_ENV === 'production' && process.env.HCAPTCHA_SECRET_KEY) {
        const isValidCaptcha = await this.verifyHCaptcha(hcaptcha_token);
        if (!isValidCaptcha) {
          return res.status(400).json({ error: 'Vérification anti-spam échouée' });
        }
      }

      // Générer le token magique
      const magicToken = crypto.randomUUID();
      const hashedToken = await this.hashToken(magicToken);
      const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 heures

      const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;

      let spaceId;
      let emailSent = false;

      await withTransaction(async (client) => {
        // Créer ou mettre à jour l'espace
        const { rows: existingSpaces } = await client.query(
          'SELECT id FROM spaces WHERE space_name = $1',
          [space_name]
        );

        if (existingSpaces.length > 0) {
          // Espace existant - mise à jour du token
          spaceId = existingSpaces[0].id;
          await client.query(`
            UPDATE spaces
            SET magic_token = $1, token_expires_at = $2, is_authenticated = false, updated_at = NOW()
            WHERE id = $3
          `, [hashedToken, expiresAt.toISOString(), spaceId]);

          // Mettre à jour l'email dans la table privée
          await client.query(`
            INSERT INTO spaces_private (space_id, email)
            VALUES ($1, $2)
            ON CONFLICT (space_id) DO UPDATE SET email = $2
          `, [spaceId, email.trim().toLowerCase()]);
        } else {
          // Création d'un nouvel espace
          const { rows: newSpaces } = await client.query(`
            INSERT INTO spaces (space_name, magic_token, token_expires_at, is_authenticated)
            VALUES ($1, $2, $3, false)
            RETURNING id
          `, [space_name, hashedToken, expiresAt.toISOString()]);

          spaceId = newSpaces[0].id;

          // Stocker l'email dans la table privée
          await client.query(`
            INSERT INTO spaces_private (space_id, email)
            VALUES ($1, $2)
          `, [spaceId, email.trim().toLowerCase()]);
        }

        // Log de l'événement
        await client.query(`
          INSERT INTO logs (event_type, space_id, ip_address, user_agent, details)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          'auth',
          spaceId,
          clientIP,
          req.headers['user-agent'] || 'unknown',
          { action: 'magic_link_requested', email, space_name }
        ]);
      });

      // Tentative d'envoi de l'email
      try {
        await emailService.sendMagicLinkEmail(email, magicToken, space_name);
        emailSent = true;
      } catch (emailError) {
        logger.error('Erreur lors de l\'envoi de l\'email:', emailError);
        // Ne pas faire échouer la requête, juste noter que l'email n'a pas été envoyé
      }

      // Réponse selon l'environnement
      const response = {
        success: true,
        message: emailSent
          ? 'Lien d\'accès envoyé par email'
          : 'Lien d\'accès généré (email non configuré)'
      };

      // En développement, inclure le token dans la réponse pour faciliter les tests
      if (process.env.NODE_ENV === 'development') {
        response.magic_token = magicToken;
        response.magic_link = `${process.env.API_BASE_URL}/api/auth/consume?token=${magicToken}`;
        logger.info('Lien magique généré (dev):', response.magic_link);
      }

      res.json(response);
    } catch (error) {
      logger.error('Erreur lors de la génération du lien magique:', error);
      res.status(500).json({ error: 'Erreur serveur lors de la génération du lien' });
    }
  }

  // Consommer un token magique et créer une session
  async consumeToken(req, res) {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).json({ error: 'Token manquant' });
      }

      const hashedToken = await this.hashToken(token);

      await withTransaction(async (client) => {
        // Vérifier le token magique
        const { rows: spaces } = await client.query(`
          SELECT s.id, s.space_name, sp.email
          FROM spaces s
          LEFT JOIN spaces_private sp ON sp.space_id = s.id
          WHERE s.magic_token = $1
            AND s.token_expires_at > NOW()
            AND s.is_authenticated = false
        `, [hashedToken]);

        if (spaces.length === 0) {
          throw new Error('Token invalide ou expiré');
        }

        const space = spaces[0];

        // Générer un token de session
        const sessionToken = crypto.randomUUID();
        const sessionExpiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 heures

        // Créer la session utilisateur
        await client.query(`
          INSERT INTO user_sessions (space_id, session_token, expires_at, is_active)
          VALUES ($1, $2, $3, true)
        `, [space.id, sessionToken, sessionExpiresAt.toISOString()]);

        // Invalider le token magique
        await client.query(`
          UPDATE spaces
          SET magic_token = NULL, token_expires_at = NULL, is_authenticated = true, updated_at = NOW()
          WHERE id = $1
        `, [space.id]);

        // Log de l'événement
        await client.query(`
          INSERT INTO logs (event_type, space_id, ip_address, user_agent, details)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          'auth',
          space.id,
          req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
          req.headers['user-agent'] || 'unknown',
          { action: 'magic_link_consumed', space_name: space.space_name }
        ]);

        // Redirection vers le frontend avec le token de session
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const redirectUrl = `${frontendUrl}/?session=${sessionToken}&space=${encodeURIComponent(space.space_name)}`;

        res.redirect(302, redirectUrl);
      });
    } catch (error) {
      logger.error('Erreur lors de la consommation du token:', error);

      // Redirection vers le frontend avec erreur
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const errorUrl = `${frontendUrl}/?error=${encodeURIComponent(error.message)}`;

      res.redirect(302, errorUrl);
    }
  }

  // Vérifier une session utilisateur
  async verifySession(req, res) {
    try {
      const sessionToken = req.headers['x-session-token'] || req.query.session;

      if (!sessionToken) {
        return res.status(400).json({ error: 'Token de session manquant' });
      }

      const result = await query(`
        SELECT us.*, s.space_name, sp.email
        FROM user_sessions us
        JOIN spaces s ON s.id = us.space_id
        LEFT JOIN spaces_private sp ON sp.space_id = s.id
        WHERE us.session_token = $1
          AND us.expires_at > NOW()
          AND us.is_active = true
      `, [sessionToken]);

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Session invalide ou expirée' });
      }

      const session = result.rows[0];

      res.json({
        success: true,
        session: {
          spaceId: session.space_id,
          spaceName: session.space_name,
          email: session.email,
          expiresAt: session.expires_at,
          isActive: session.is_active
        }
      });
    } catch (error) {
      logger.error('Erreur lors de la vérification de session:', error);
      res.status(500).json({ error: 'Erreur serveur lors de la vérification de session' });
    }
  }

  // Utilitaires
  async hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async verifyHCaptcha(token) {
    try {
      const hcaptchaSecret = process.env.HCAPTCHA_SECRET_KEY;

      if (!hcaptchaSecret || !token) {
        logger.warn('hCaptcha non configuré ou token manquant, vérification ignorée');
        return true;
      }

      const response = await fetch('https://hcaptcha.com/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${hcaptchaSecret}&response=${encodeURIComponent(token)}`
      });

      const result = await response.json();
      return !!result.success;
    } catch (error) {
      logger.error('Erreur lors de la vérification hCaptcha:', error);
      return false;
    }
  }
}

module.exports = new AuthController();