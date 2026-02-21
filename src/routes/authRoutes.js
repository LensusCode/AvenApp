const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authLimiter, usernameLimiter } = require('../middleware/rateLimiter');

const { authenticateToken } = require('../middleware/auth');

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.get('/me', authenticateToken, authController.getMe);
router.post('/logout', authController.logout);
router.post('/check-username', usernameLimiter, authController.checkUsername);

module.exports = router;
