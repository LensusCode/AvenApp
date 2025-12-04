const express = require('express');

module.exports = function(deps) {
    const router = express.Router();

    const authController = require('../controllers/authController')(deps);
    const uploadController = require('../controllers/uploadController')(deps);
    const adminController = require('../controllers/adminController')(deps);
    const authenticateToken = require('../middlewares/auth')(deps);

    // Public checks
    router.post('/check-username', authController.checkUsername);
    router.post('/register', authController.register);
    router.post('/login', authController.login);
    router.post('/logout', authController.logout);

    // Authenticated
    router.get('/me', authenticateToken, authController.me);
    router.put('/profile/update', authenticateToken, authController.updateProfile);

    // Uploads (use provided multer instances)
    router.post('/upload-avatar', authenticateToken, deps.uploadImage.single('avatar'), uploadController.uploadAvatar);
    router.post('/upload-chat-image', authenticateToken, deps.uploadImage.single('image'), uploadController.uploadChatImage);
    router.post('/upload-audio', authenticateToken, deps.uploadAudio.single('audio'), uploadController.uploadAudio);

    // Admin actions
    router.post('/admin/toggle-verify', authenticateToken, adminController.toggleVerify);
    router.post('/admin/toggle-premium', authenticateToken, adminController.togglePremium);

    // Messages / stickers / favorites (simple passthrough handlers)
    router.get('/messages/:myId/:otherId', authenticateToken, authController.getMessages);
    router.get('/stickers-proxy', authenticateToken, authController.stickersProxy);
    router.post('/favorites/add', authenticateToken, authController.addFavorite);
    router.post('/favorites/remove', authenticateToken, authController.removeFavorite);
    router.get('/favorites/:userId', authenticateToken, authController.getFavorites);
    router.get('/pinned-message/:otherId', authenticateToken, authController.getPinnedMessage);

    return router;
};
