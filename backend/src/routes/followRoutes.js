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

router.post('/follow', authorize('host','user'), followHost);
router.delete('/unfollow/:hostId', authorize('host','user'), unfollowHost);
router.get('/followers/:userId?', authorize('host','user'), getFollowers);
router.get('/following/:userId?', authorize('host','user'), getFollowing);
router.get('/check/:hostId', authorize('host','user'), checkFollowing);
router.get('/stats/:userId?', authorize('host','user'), getFollowStats);

module.exports = router;