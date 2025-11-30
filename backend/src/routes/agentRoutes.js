const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const {
  followHost,
  unfollowHost,
  getFollowers,
  getFollowing,
  checkFollowing,
  getFollowStats
} = require('../controllers/followController');

router.post('/follow', authorize, followHost);
router.delete('/unfollow/:hostId', authorize, unfollowHost);
router.get('/followers/:userId?', authorize, getFollowers);
router.get('/following/:userId?', authorize, getFollowing);
router.get('/check/:hostId', authorize, checkFollowing);
router.get('/stats/:userId?', authorize, getFollowStats);

module.exports = router;