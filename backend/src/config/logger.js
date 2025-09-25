const winston = require('winston');
const path = require('path');

// Formats personnalisés
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${stack || ''} ${metaStr}`;
  })
);

// Configuration du logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: [
    // Console pour le développement
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      )
    }),

    // Fichier pour tous les logs
    new winston.transports.File({
      filename: 'logs/app.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),

    // Fichier séparé pour les erreurs
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Créer le dossier logs s'il n'existe pas
const fs = require('fs');
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// En production, ne pas logger sur la console
if (process.env.NODE_ENV === 'production') {
  logger.remove(winston.transports.Console);
}

module.exports = logger;