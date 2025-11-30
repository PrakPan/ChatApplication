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

router.get('/', authorize, getProfile);
router.put('/avatar', authorize, upload.single('avatar'), updateAvatar);
router.put('/phone', authorize, updatePhone);
router.put('/email', authorize, updateEmail);
router.put('/bio', authorize, updateBio);
router.put('/name', authorize, updateName);

module.exports = router;