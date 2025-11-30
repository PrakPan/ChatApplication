const mongoose = require('mongoose');

// Function to generate unique 5-character alphanumeric agent ID
const generateAgentId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 5; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

const agentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  agentId: {
    type: String,
    unique: true,
    required: true,
    uppercase: true,
    minlength: 5,
    maxlength: 5,
    index: true
  },
  totalHosts: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  commissionRate: {
    type: Number,
    default: 10, // 10% commission from host earnings
    min: 0,
    max: 100
  },
  isActive: {
    type: Boolean,
    default: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Generate unique agentId before saving
agentSchema.pre('save', async function(next) {
  if (this.isNew && !this.agentId) {
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      this.agentId = generateAgentId();
      
      const existingAgent = await mongoose.model('Agent').findOne({ agentId: this.agentId });
      
      if (!existingAgent) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return next(new Error('Unable to generate unique agent ID'));
    }
  }
  next();
});

// Method to calculate total earnings from linked hosts
agentSchema.methods.calculateTotalEarnings = async function() {
  const Host = require('./Host');
  const hosts = await Host.find({ agentId: this.agentId });
  
  const totalEarnings = hosts.reduce((sum, host) => sum + (host.totalEarnings || 0), 0);
  const agentCommission = (totalEarnings * this.commissionRate) / 100;
  
  return {
    totalHostEarnings: totalEarnings,
    agentCommission,
    hostCount: hosts.length
  };
};

agentSchema.index({ agentId: 1 });
agentSchema.index({ userId: 1 });
agentSchema.index({ isActive: 1 });

module.exports = mongoose.model('Agent', agentSchema);