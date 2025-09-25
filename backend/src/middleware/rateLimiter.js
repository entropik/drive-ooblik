const rateLimit = require('express-rate-limit');
const { query } = require('../config/database');
const logger = require('../config/logger');

// Rate limiter pour l'authentification (5 tentatives par heure par IP)
const authRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000, // 1 heure
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 5,
  message: {
    error: 'Trop de tentatives d\'authentification. Réessayez dans une heure.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Utiliser l'IP réelle (en tenant compte des proxies)
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
           || req.headers['x-real-ip']
           || req.connection.remoteAddress
           || req.socket.remoteAddress
           || req.ip;
  },
  skip: (req) => {
    // Ne pas appliquer en développement
    return process.env.NODE_ENV === 'development';
  },
  onLimitReached: async (req, res) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    logger.warn(`Rate limit atteint pour l'IP: ${ip}`, {
      ip,
      userAgent: req.headers['user-agent'],
      endpoint: req.path
    });

    // Logger dans la base de données
    try {
      await query(`
        INSERT INTO logs (event_type, ip_address, user_agent, details, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [
        'rate_limit',
        ip,
        req.headers['user-agent'],
        { endpoint: req.path, reason: 'too_many_requests' }
      ]);
    } catch (error) {
      logger.error('Erreur lors de l\'enregistrement du rate limit:', error);
    }
  }
});

// Rate limiter pour les uploads (100 requêtes par minute par session)
const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    error: 'Trop de tentatives d\'upload. Réessayez dans une minute.'
  },
  keyGenerator: (req) => {
    // Utiliser le token de session comme clé
    return req.headers['x-session-token'] || req.ip;
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'development';
  }
});

// Rate limiter pour les admins (1000 requêtes par heure)
const adminRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 1000,
  message: {
    error: 'Trop de requêtes administratives. Réessayez plus tard.'
  },
  keyGenerator: (req) => {
    // Utiliser le token admin ou l'IP
    return req.headers['x-admin-session']
           || req.cookies?.admin_session
           || req.headers.authorization?.replace('Bearer ', '')
           || req.ip;
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'development';
  }
});

// Rate limiter général pour l'API (plus permissif)
const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requêtes par 15 minutes par IP
  message: {
    error: 'Trop de requêtes. Réessayez plus tard.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware personnalisé pour vérifier le rate limiting en base de données
async function checkDatabaseRateLimit(req, res, next) {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Compter les tentatives d'auth de la dernière heure
    const result = await query(`
      SELECT COUNT(*) as count
      FROM logs
      WHERE event_type = 'auth'
        AND ip_address = $1
        AND created_at > $2
    `, [ip, hourAgo.toISOString()]);

    const count = parseInt(result.rows[0].count);

    if (count >= 5) {
      // Ajouter les headers de rate limiting
      res.set({
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': Math.floor((Date.now() + 60 * 60 * 1000) / 1000),
        'Retry-After': '3600'
      });

      return res.status(429).json({
        error: 'Trop de tentatives. Réessayez dans une heure.',
        retryAfter: 3600
      });
    }

    // Ajouter les headers informatifs
    res.set({
      'X-RateLimit-Limit': '5',
      'X-RateLimit-Remaining': Math.max(0, 5 - count),
      'X-RateLimit-Reset': Math.floor((Date.now() + 60 * 60 * 1000) / 1000)
    });

    next();
  } catch (error) {
    logger.error('Erreur lors de la vérification du rate limit:', error);
    next(); // Continue même en cas d'erreur
  }
}

module.exports = {
  authRateLimiter,
  uploadRateLimiter,
  adminRateLimiter,
  generalRateLimiter,
  checkDatabaseRateLimit
};