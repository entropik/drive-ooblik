const express = require('express');
const adminController = require('../controllers/adminController');
const { verifyAdminSession } = require('../middleware/auth');
const { adminRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Authentification (sans middleware auth)
router.post('/login', adminRateLimiter, adminController.login);

// Routes protégées (avec middleware auth)
router.post('/logout', verifyAdminSession, adminController.logout);
router.get('/verify', verifyAdminSession, adminController.verify);
router.post('/config', verifyAdminSession, adminController.config);
router.post('/update', verifyAdminSession, adminController.update);
router.post('/test-smtp', verifyAdminSession, adminController.testSmtp);
router.get('/dashboard', verifyAdminSession, adminController.getDashboard);

module.exports = router;