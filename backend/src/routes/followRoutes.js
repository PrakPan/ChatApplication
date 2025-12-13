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

router.post('/follow', authorize('host','user','coinSeller'), followHost);
router.delete('/unfollow/:hostId', authorize('host','user','coinSeller'), unfollowHost);
router.get('/followers/:userId?', authorize('host','user','coinSeller'), getFollowers);
router.get('/following/:userId?', authorize('host','user','coinSeller'), getFollowing);
router.get('/check/:hostId', authorize('host','user','coinSeller'), checkFollowing);
router.get('/stats/:userId?', authorize('host','user','coinSeller'), getFollowStats);

module.exports = router;