const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channelController');
const { authenticateToken } = require('../middleware/auth');
const { uploadImage } = require('../config/cloudinary');

router.post('/:id/add-members', authenticateToken, channelController.addMembers);
router.post('/:id/leave', authenticateToken, channelController.leaveChannel);
router.post('/create', authenticateToken, uploadImage.single('avatar'), channelController.createChannel);
router.get('/my-channels', authenticateToken, channelController.getMyChannels);
router.get('/channel-messages/:channelId', authenticateToken, channelController.getChannelMessages);
router.get('/info/:id', authenticateToken, channelController.getChannelInfo);
router.post('/update', authenticateToken, uploadImage.single('avatar'), channelController.updateChannel);
router.get('/:id/members', authenticateToken, channelController.getChannelMembers);
router.get('/:id/banned', authenticateToken, channelController.getBannedUsers);
router.post('/:id/update-type', authenticateToken, channelController.updateChannelType);
router.post('/:id/kick', authenticateToken, channelController.kickUser);
router.post('/:id/unban', authenticateToken, channelController.unbanUser);
router.post('/check-handle', authenticateToken, channelController.checkHandle);

module.exports = router;
