const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticateToken } = require('../middleware/auth');
const { uploadImage, uploadAudio } = require('../config/cloudinary');

router.get('/messages/:myId/:otherId', authenticateToken, messageController.getMessages);
router.post('/upload-chat-image', authenticateToken, uploadImage.single('image'), messageController.uploadChatImage);
router.post('/upload-audio', authenticateToken, uploadAudio.single('audio'), messageController.uploadAudio);
router.post('/admin/send-love-note', authenticateToken, messageController.sendLoveNote);
router.get('/my-love-notes', authenticateToken, messageController.getMyLoveNotes);
router.get('/stickers-proxy', authenticateToken, messageController.getStickers);
router.post('/favorites/add', authenticateToken, messageController.addFavoriteSticker);
router.post('/favorites/remove', authenticateToken, messageController.removeFavoriteSticker);
router.get('/favorites/:userId', authenticateToken, messageController.getFavoriteStickers);
router.get('/pinned-message/:otherId', authenticateToken, messageController.getPinnedMessage);

module.exports = router;
