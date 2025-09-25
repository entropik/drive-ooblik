const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../config/logger');

// Middleware pour vérifier les sessions utilisateur
async function verifyUserSession(req, res, next) {
  try {
    const sessionToken = req.headers['x-session-token'] || req.headers.authorization?.replace('Bearer ', '');

    if (!sessionToken) {
      return res.status(401).json({ error: 'Token de session manquant' });
    }

    // Vérifier la session en base de données
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

    // Ajouter les informations de session à la requête
    req.user = {
      sessionId: session.id,
      spaceId: session.space_id,
      spaceName: session.space_name,
      email: session.email,
      sessionToken
    };

    next();
  } catch (error) {
    logger.error('Erreur lors de la vérification de session:', error);
    return res.status(500).json({ error: 'Erreur serveur lors de la vérification de session' });
  }
}

// Middleware pour vérifier les sessions admin
async function verifyAdminSession(req, res, next) {
  try {
    // Récupérer le token depuis différentes sources
    let token = null;

    // 1. Header Authorization
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 2. Header custom x-admin-session
    if (!token) {
      token = req.headers['x-admin-session'];
    }

    // 3. Cookie admin_session
    if (!token && req.cookies) {
      token = req.cookies.admin_session;
    }

    if (!token) {
      return res.status(401).json({ error: 'Token d\'administration manquant' });
    }

    // Vérifier la session admin en base
    const result = await query(`
      SELECT as.*, au.username, au.email, au.is_active
      FROM admin_sessions as
      JOIN admin_users au ON au.id = as.admin_user_id
      WHERE as.session_token = $1
        AND as.expires_at > NOW()
        AND as.is_active = true
        AND au.is_active = true
    `, [token]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Session administrative invalide ou expirée' });
    }

    const adminSession = result.rows[0];

    // Ajouter les informations admin à la requête
    req.admin = {
      id: adminSession.admin_user_id,
      username: adminSession.username,
      email: adminSession.email,
      sessionId: adminSession.id,
      sessionToken: token
    };

    next();
  } catch (error) {
    logger.error('Erreur lors de la vérification de session admin:', error);
    return res.status(500).json({ error: 'Erreur serveur lors de la vérification de session' });
  }
}

// Middleware optionnel pour vérifier les sessions (ne bloque pas si pas de token)
async function optionalUserSession(req, res, next) {
  const sessionToken = req.headers['x-session-token'] || req.headers.authorization?.replace('Bearer ', '');

  if (!sessionToken) {
    return next();
  }

  try {
    const result = await query(`
      SELECT us.*, s.space_name, sp.email
      FROM user_sessions us
      JOIN spaces s ON s.id = us.space_id
      LEFT JOIN spaces_private sp ON sp.space_id = s.id
      WHERE us.session_token = $1
        AND us.expires_at > NOW()
        AND us.is_active = true
    `, [sessionToken]);

    if (result.rows.length > 0) {
      const session = result.rows[0];
      req.user = {
        sessionId: session.id,
        spaceId: session.space_id,
        spaceName: session.space_name,
        email: session.email,
        sessionToken
      };
    }
  } catch (error) {
    logger.error('Erreur lors de la vérification optionnelle de session:', error);
  }

  next();
}

module.exports = {
  verifyUserSession,
  verifyAdminSession,
  optionalUserSession
};