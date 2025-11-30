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

router.post('/follow', followHost);
router.delete('/unfollow/:hostId', unfollowHost);
router.get('/followers/:userId?', getFollowers);
router.get('/following/:userId?', getFollowing);
router.get('/check/:hostId', checkFollowing);
router.get('/stats/:userId?', getFollowStats);

module.exports = router;