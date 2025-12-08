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

// Actions (Proxying to user logic or defining new? 
// The original code used userController for these. Let's keep using userController methods 
// for the actual actions to avoid duplication, or import them here if we want strict separation.
// For simplicity, we can route them here but use the userController handlers if they are generic enough,
// BUT userController handlers expect 'req.body.targetUserId'.
router.post('/toggle-verify', userController.toggleVerify);
router.post('/toggle-premium', userController.togglePremium);
router.post('/send-love-note', userController.sendLoveNote); // Assuming this exists or will be moved

module.exports = router;
