const express = require('express');
const router = express.Router();
const storyController = require('../controllers/storyController');
const { authenticateToken } = require('../middleware/auth');
const { uploadImage } = require('../config/cloudinary');

router.post('/create', authenticateToken, uploadImage.single('image'), storyController.createStory);
router.get('/list', authenticateToken, storyController.getStories);
router.post('/:id/view', authenticateToken, storyController.markViewed);

router.delete('/:id', authenticateToken, storyController.deleteStory);
router.put('/:id/hide', authenticateToken, storyController.hideStory);
router.put('/:id/edit', authenticateToken, storyController.editStory);
router.get('/:id/viewers', authenticateToken, storyController.getStoryViewers);

module.exports = router;
