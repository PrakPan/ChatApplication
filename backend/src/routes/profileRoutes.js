const express = require('express');
const router = express.Router();
const { authorize, authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload'); // Your multer middleware
const {
  getProfile,
  updateAvatar,
  updatePhone,
  updateEmail,
  updateBio,
  updateName
} = require('../controllers/profileController');

router.get('/', authenticate, getProfile);
router.put('/avatar', authenticate, upload.single('avatar'), updateAvatar);
router.put('/phone', authenticate, updatePhone);
router.put('/email', authenticate, updateEmail);
router.put('/bio', authenticate, updateBio);
router.put('/name', authenticate, updateName);

module.exports = router;