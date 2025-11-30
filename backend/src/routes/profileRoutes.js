const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const upload = require('../middleware/upload'); // Your multer middleware
const {
  getProfile,
  updateAvatar,
  updatePhone,
  updateEmail,
  updateBio,
  updateName
} = require('../controllers/profileController');

router.get('/', authorize('host','user'), getProfile);
router.put('/avatar', authorize('host','user'), upload.single('avatar'), updateAvatar);
router.put('/phone', authorize('host','user'), updatePhone);
router.put('/email', authorize('host','user'), updateEmail);
router.put('/bio', authorize('host','user'), updateBio);
router.put('/name', authorize('host','user'), updateName);

module.exports = router;