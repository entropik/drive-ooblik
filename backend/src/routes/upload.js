const express = require('express');
const uploadController = require('../controllers/uploadController');
const { verifyUserSession } = require('../middleware/auth');
const { uploadRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Toutes les routes upload nécessitent une session utilisateur valide
router.use(verifyUserSession);

// POST /api/upload/init - Initialiser un upload
router.post('/init', uploadRateLimiter, uploadController.initUpload);

// POST /api/upload/complete - Finaliser un upload
router.post('/complete', uploadController.completeUpload);

// GET /api/upload/files - Récupérer la liste des fichiers
router.get('/files', uploadController.getFiles);

// DELETE /api/upload/files/:fileId - Supprimer un fichier
router.delete('/files/:fileId', uploadController.deleteFile);

module.exports = router;