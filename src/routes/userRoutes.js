const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');
const { uploadImage } = require('../config/cloudinary');

router.get('/me', authenticateToken, userController.getMe);
router.put('/profile/update', authenticateToken, userController.updateProfile);
router.post('/upload-avatar', authenticateToken, uploadImage.single('avatar'), userController.uploadAvatar);

module.exports = router;
