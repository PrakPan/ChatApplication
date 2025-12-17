// models/FreeTarget.js
const mongoose = require('mongoose');

const dailyTargetSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'admin_override'],
    default: 'pending'
  },
  totalCallDuration: {
    type: Number,
    default: 0 // in seconds
  },
  disconnectCount: {
    type: Number,
    default: 0
  },
  isTimerActive: {
    type: Boolean,
    default: false
  },
  timerStartedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  adminOverride: {
    type: Boolean,
    default: false
  },
  adminNote: {
    type: String,
    default: null
  },
  overrideBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { _id: false });

const weeklyTargetSchema = new mongoose.Schema({
  weekNumber: {
    type: Number,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  days: [dailyTargetSchema],
  completedDays: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'failed'],
    default: 'active'
  }
}, { _id: false });

const freeTargetSchema = new mongoose.Schema({
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Host',
    required: true,
    unique: true
  },
  isEnabled: {
    type: Boolean,
    default: false // Admin can enable/disable
  },
  targetDurationPerDay: {
    type: Number,
    default: 28800 // 8 hours in seconds
  },
  maxDisconnectsAllowed: {
    type: Number,
    default: 3
  },
  disconnectTimeWindow: {
    type: Number,
    default: 600 // 10 minutes in seconds
  },
  currentWeek: weeklyTargetSchema,
  weekHistory: [weeklyTargetSchema],
  totalWeeksCompleted: {
    type: Number,
    default: 0
  },
  totalWeeksFailed: {
    type: Number,
    default: 0
  },
  lastDisconnects: [{
    timestamp: Date,
    callId: mongoose.Schema.Types.ObjectId
  }],
  stats: {
    totalCallsCompleted: { type: Number, default: 0 },
    totalCallDuration: { type: Number, default: 0 },
    averageDailyDuration: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Indexes
freeTargetSchema.index({ hostId: 1 });
freeTargetSchema.index({ 'currentWeek.startDate': 1, 'currentWeek.endDate': 1 });

// Helper method to get current day's target
freeTargetSchema.methods.getCurrentDayTarget = function() {
  if (!this.currentWeek) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return this.currentWeek.days.find(day => {
    const dayDate = new Date(day.date);
    dayDate.setHours(0, 0, 0, 0);
    return dayDate.getTime() === today.getTime();
  });
};

// Helper method to check if host can start timer
freeTargetSchema.methods.canStartTimer = function() {
  const todayTarget = this.getCurrentDayTarget();
  if (!todayTarget) return false;
  
  return todayTarget.status === 'pending' && !todayTarget.isTimerActive;
};

// Helper method to add call duration
freeTargetSchema.methods.addCallDuration = function(duration) {
  const todayTarget = this.getCurrentDayTarget();
  if (!todayTarget) return false;
  
  todayTarget.totalCallDuration += duration;
  
  // Check if target is reached
  if (todayTarget.totalCallDuration >= this.targetDurationPerDay) {
    todayTarget.status = 'completed';
    todayTarget.completedAt = new Date();
    todayTarget.isTimerActive = false;
    this.currentWeek.completedDays += 1;
  }
  
  return true;
};

// Helper method to record disconnect
freeTargetSchema.methods.recordDisconnect = function(callId) {
  const now = new Date();
  const todayTarget = this.getCurrentDayTarget();
  
  if (!todayTarget || todayTarget.status !== 'pending') return false;
  
  // Add to disconnect log
  this.lastDisconnects.push({ timestamp: now, callId });
  
  // Keep only disconnects within the time window
  const windowStart = new Date(now.getTime() - this.disconnectTimeWindow * 1000);
  this.lastDisconnects = this.lastDisconnects.filter(d => d.timestamp >= windowStart);
  
  // Increment today's disconnect count
  todayTarget.disconnectCount += 1;
  
  // Check if exceeded max disconnects
  if (this.lastDisconnects.length >= this.maxDisconnectsAllowed) {
    todayTarget.status = 'failed';
    todayTarget.isTimerActive = false;
    return true; // Day failed
  }
  
  return false; // Day not failed yet
};

// Static method to initialize week for host
freeTargetSchema.statics.initializeWeek = async function(hostId) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  const weekNumber = Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / 604800000);
  
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    days.push({
      date,
      status: 'pending',
      totalCallDuration: 0,
      disconnectCount: 0,
      isTimerActive: false
    });
  }
  
  return {
    weekNumber,
    year: now.getFullYear(),
    startDate: monday,
    endDate: sunday,
    days,
    completedDays: 0,
    status: 'active'
  };
};

module.exports = mongoose.model('FreeTarget', freeTargetSchema);