const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');


const requireAdmin = async (req, res, next) => {

    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ success: false, error: "Access denied" });
    }
    next();
};

router.use(authenticateToken);
router.use(requireAdmin);


router.get('/stats', adminController.getStats);
router.get('/reports', adminController.getReports);
router.get('/all-users', adminController.getAllUsers);

router.post('/toggle-verify', userController.toggleVerify);
router.post('/toggle-premium', userController.togglePremium);
router.post('/send-love-note', userController.sendLoveNote);

module.exports = router;
