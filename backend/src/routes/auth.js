const express = require('express');
const authController = require('../controllers/authController');
const { checkDatabaseRateLimit } = require('../middleware/rateLimiter');
const { optionalUserSession } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/magic-link - Générer et envoyer un lien magique
router.post('/magic-link', checkDatabaseRateLimit, authController.sendMagicLink);

// GET /api/auth/consume - Consommer un token magique
router.get('/consume', authController.consumeToken);

// GET /api/auth/verify - Vérifier une session utilisateur
router.get('/verify', optionalUserSession, authController.verifySession);

module.exports = router;