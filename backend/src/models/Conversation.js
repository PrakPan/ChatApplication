const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  },
  isPinned: {
    type: Map,
    of: Boolean,
    default: {}
  },
  isMuted: {
    type: Map,
    of: Boolean,
    default: {}
  },
  callHistory: [{
    callId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Call'
    },
    startedAt: Date,
    endedAt: Date,
    duration: Number
  }]
}, {
  timestamps: true
});

// Index for efficient conversation listing
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

// Method to increment unread count
conversationSchema.methods.incrementUnread = function(userId) {
  const count = this.unreadCount.get(userId.toString()) || 0;
  this.unreadCount.set(userId.toString(), count + 1);
  return this.save();
};

// Method to reset unread count
conversationSchema.methods.resetUnread = function(userId) {
  this.unreadCount.set(userId.toString(), 0);
  return this.save();
};

// Static method to find or create conversation
conversationSchema.statics.findOrCreate = async function(userId1, userId2) {
  const Message = mongoose.model('Message');
  const conversationId = Message.generateConversationId(userId1, userId2);
  
  let conversation = await this.findOne({ conversationId });
  
  if (!conversation) {
    conversation = await this.create({
      conversationId,
      participants: [userId1, userId2],
      unreadCount: {
        [userId1.toString()]: 0,
        [userId2.toString()]: 0
      }
    });
  }
  
  return conversation;
};

module.exports = mongoose.model('Conversation', conversationSchema);