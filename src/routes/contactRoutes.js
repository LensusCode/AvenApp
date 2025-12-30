const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { authenticateToken } = require('../middleware/auth');

router.get('/search', authenticateToken, contactController.searchUsers);
router.post('/add', authenticateToken, contactController.addContact);
router.delete('/:contactId', authenticateToken, contactController.removeContact);
router.get('/', authenticateToken, contactController.getMyContacts);

module.exports = router;
