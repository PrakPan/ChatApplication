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

router.get('/', authorize('host','user','coinSeller'), getProfile);
router.put('/avatar', authorize('host','user','coinSeller'), upload.single('avatar'), updateAvatar);
router.put('/phone', authorize('host','user','coinSeller'), updatePhone);
router.put('/email', authorize('host','user','coinSeller'), updateEmail);
router.put('/bio', authorize('host','user','coinSeller'), updateBio);
router.put('/name', authorize('host','user','coinSeller'), updateName);

module.exports = router;