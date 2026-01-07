// models/Call.js
const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Host',
    required: true
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number,
    default: 0,
    min: 0
  },
  coinsSpent: {
    type: Number,
    default: 0,
    min: 0
  },
  coinsDeductedSoFar: {
    type: Number,
    default: 0
  },
  lastBilledAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['initiated', 'ongoing', 'completed', 'cancelled', 'failed'],
    default: 'initiated'
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedback: {
    type: String,
    maxlength: 500
  },
  cancelledBy: {
    type: String,
    enum: ['user', 'host', 'system']
  },
  cancelReason: {
    type: String
  },
  // NEW: Kinesis Video Streams fields
  kinesisChannelName: {
    type: String,
    index: true
  },
  kinesisChannelArn: {
    type: String
  }
}, {
  timestamps: true
});

// Calculate duration before saving
callSchema.pre('save', function(next) {
  if (this.endTime && this.startTime) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000);
  }
  next();
});

module.exports = mongoose.model('Call', callSchema);