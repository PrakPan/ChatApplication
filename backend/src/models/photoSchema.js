// photoSchema.js
const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: String,
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  approvedAt: Date,
  rejectedAt: Date,
  approvedBy: {
    type: String,
    // type: mongoose.Schema.Types.ObjectId,
    // ref: 'User'
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

// Add this to ensure _id is created for subdocuments
photoSchema.set('toJSON', { virtuals: true });
photoSchema.set('toObject', { virtuals: true });

module.exports = photoSchema;