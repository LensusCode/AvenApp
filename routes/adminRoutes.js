const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const userController = require('../controllers/userController'); // For reusing existing toggle logic if preferred
const { authenticateToken } = require('../middleware/auth');

// Middleware to ensure user is admin
const requireAdmin = async (req, res, next) => {
    // req.user is populated by authenticateToken
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ success: false, error: "Access denied" });
    }
    next();
};

router.use(authenticateToken);
router.use(requireAdmin);

// Dashboard Data
router.get('/stats', adminController.getStats);
router.get('/reports', adminController.getReports);
router.get('/all-users', adminController.getAllUsers);

router.post('/toggle-verify', userController.toggleVerify);
router.post('/toggle-premium', userController.togglePremium);
router.post('/send-love-note', userController.sendLoveNote); // Assuming this exists or will be moved

module.exports = router;
