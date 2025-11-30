const mongoose = require('mongoose');

const followSchema = new mongoose.Schema({
  followerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  followingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  followingType: {
    type: String,
    enum: ['user', 'host'],
    required: true
  }
}, {
  timestamps: true
});

// Indexes
followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
followSchema.index({ followerId: 1 });
followSchema.index({ followingId: 1 });
followSchema.index({ followingType: 1 });

// Static method to get follower count
followSchema.statics.getFollowerCount = async function(userId) {
  return await this.countDocuments({ followingId: userId });
};

// Static method to get following count
followSchema.statics.getFollowingCount = async function(userId) {
  return await this.countDocuments({ followerId: userId });
};

// Static method to check if user is following
followSchema.statics.isFollowing = async function(followerId, followingId) {
  const follow = await this.findOne({ followerId, followingId });
  return !!follow;
};

module.exports = mongoose.model('Follow', followSchema);