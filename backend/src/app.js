require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');

const logger = require('./config/logger');
const { testConnection } = require('./config/database');
const cronService = require('./services/cronService');
const { generalRateLimiter } = require('./middleware/rateLimiter');

// Import des routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration de base
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(compression());

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-token', 'x-admin-session']
};

app.use(cors(corsOptions));

// Middleware de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Rate limiting global
app.use(generalRateLimiter);

// Middleware de logging des requêtes
app.use((req, res, next) => {
  const startTime = Date.now();

  // Logger la requête
  logger.info(`${req.method} ${req.path}`, {
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
    userAgent: req.headers['user-agent'],
    sessionToken: req.headers['x-session-token'] ? '[REDACTED]' : null,
    adminSession: req.headers['x-admin-session'] ? '[REDACTED]' : null
  });

  // Logger la réponse
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    logger.info(`${req.method} ${req.path} - ${res.statusCode}`, {
      duration: `${duration}ms`,
      status: res.statusCode
    });
    return originalSend.call(this, data);
  };

  next();
});

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

// Route de santé
app.get('/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    const cronStatus = cronService.getJobsStatus();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: dbConnected ? 'connected' : 'disconnected',
      cronJobs: cronStatus,
      uptime: process.uptime()
    });
  } catch (error) {
    logger.error('Erreur lors du check de santé:', error);
    res.status(500).json({
      status: 'error',
      message: 'Service indisponible'
    });
  }
});

// Route racine
app.get('/', (req, res) => {
  res.json({
    message: 'Drive Ooblik API',
    version: '1.0.0',
    documentation: '/api/docs',
    health: '/health'
  });
});

// Middleware de gestion des erreurs 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint non trouvé',
    path: req.originalUrl,
    method: req.method
  });
});

// Middleware de gestion des erreurs globales
app.use((err, req, res, next) => {
  logger.error('Erreur non gérée:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  // Ne pas exposer les détails d'erreur en production
  const isDev = process.env.NODE_ENV === 'development';

  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Erreur interne du serveur',
    ...(isDev && { stack: err.stack })
  });
});

// Fonction de démarrage du serveur
async function startServer() {
  try {
    // Tester la connexion à la base de données
    logger.info('Test de connexion à la base de données...');
    const dbConnected = await testConnection();

    if (!dbConnected) {
      throw new Error('Impossible de se connecter à la base de données');
    }

    // Démarrer les tâches planifiées
    if (process.env.NODE_ENV === 'production') {
      logger.info('Démarrage des tâches planifiées...');
      cronService.start();
    } else {
      logger.info('Mode développement : tâches planifiées désactivées');
    }

    // Démarrer le serveur
    const server = app.listen(PORT, () => {
      logger.info(`Serveur Drive Ooblik démarré sur le port ${PORT}`);
      logger.info(`Environnement: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    });

    // Gestion gracieuse de l'arrêt
    process.on('SIGTERM', () => {
      logger.info('Signal SIGTERM reçu, arrêt du serveur...');
      cronService.stop();
      server.close(() => {
        logger.info('Serveur arrêté gracieusement');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('Signal SIGINT reçu, arrêt du serveur...');
      cronService.stop();
      server.close(() => {
        logger.info('Serveur arrêté gracieusement');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
}

// Démarrer le serveur
if (require.main === module) {
  startServer();
}

module.exports = app;