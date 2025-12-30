const cron = require('node-cron');
const DiamondTransaction = require('../models/DiamondTransaction');
const logger = require('./logger');

const FreeTarget = require('../models/FreeTarget');
const Host = require('../models/Host');

const checkAndCompleteTargets = async () => {
  try {
    logger.info('🔍 Running free target auto-completion check...');
    
    const freeTargets = await FreeTarget.find({
      isEnabled: true,
      'currentWeek.status': 'active'
    }).populate('hostId');

    let completedCount = 0;
    let checkedCount = 0;

    for (const freeTarget of freeTargets) {
      try {
        const todayTarget = getCurrentDayTargetIST(freeTarget);
        
        if (!todayTarget || todayTarget.status !== 'pending') {
          continue;
        }

        checkedCount++;

        const timeCompleted = await calculateTodayOnlineTime(freeTarget.hostId._id);
        todayTarget.totalCallDuration = timeCompleted;

        if (timeCompleted >= freeTarget.targetDurationPerDay) {
          todayTarget.status = 'completed';
          todayTarget.completedAt = new Date();
          freeTarget.currentWeek.completedDays += 1;

          const host = await Host.findById(freeTarget.hostId._id);
          if (host) {
            const previousEarnings = host.totalEarnings || 0;
            host.totalEarnings = previousEarnings + 100000;
            await host.save();
            
            logger.info(`✅ Auto-completed target for host ${host._id}. Awarded 100,000 diamonds. Total: ${host.totalEarnings}`);
            completedCount++;
          }

          await freeTarget.save();
        } else {
          await freeTarget.save();
        }
      } catch (error) {
        logger.error(`Error processing free target for host ${freeTarget.hostId._id}:`, error);
      }
    }

    logger.info(`✅ Free target check completed. Checked: ${checkedCount}, Completed: ${completedCount}`);
  } catch (error) {
    logger.error('❌ Error in free target auto-completion job:', error);
  }
};


// Schedule job to run every 5 minutes
const scheduleJob = () => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    checkAndCompleteTargets();
  });

  // Also run at midnight to handle day rollovers
  cron.schedule('0 0 * * *', async () => {
    logger.info('🌙 Midnight rollover: Running free target checks...');
    await checkAndCompleteTargets();
    
    // Also clean up old logs (keep only last 30 days)
    await cleanupOldLogs();
  });

  logger.info('⏰ Free target auto-completion job scheduled (every 5 minutes)');
};

// Cleanup old online time logs to prevent database bloat
const cleanupOldLogs = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const hosts = await Host.find({
      'onlineTimeLogs.startTime': { $lt: thirtyDaysAgo }
    });

    let cleanedCount = 0;

    for (const host of hosts) {
      const originalLength = host.onlineTimeLogs.length;
      
      // Keep only logs from last 30 days
      host.onlineTimeLogs = host.onlineTimeLogs.filter(log => 
        new Date(log.startTime) >= thirtyDaysAgo
      );

      if (host.onlineTimeLogs.length < originalLength) {
        await host.save();
        cleanedCount++;
      }
    }

    logger.info(`🧹 Cleaned up old logs for ${cleanedCount} hosts`);
  } catch (error) {
    logger.error('Error cleaning up old logs:', error);
  }
};

scheduleJob();
checkAndCompleteTargets();



// Run every hour to mark expired transactions
const startCronJobs = () => {
  // Mark expired diamond transactions (runs every hour)
  cron.schedule('0 * * * *', async () => {
    try {
      const result = await DiamondTransaction.markExpiredTransactions();
      if (result.modifiedCount > 0) {
        logger.info(`Marked ${result.modifiedCount} diamond transactions as expired`);
      }
    } catch (error) {
      logger.error(`Error marking expired transactions: ${error.message}`);
    }
  });

  logger.info('Cron jobs started');
};



// cronJobs.js - Update the calculateTodayOnlineTime and checkAndCompleteTargets

const getTodayIST = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  istTime.setUTCHours(0, 0, 0, 0);
  return istTime;
};

const isSameDayIST = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist1 = new Date(d1.getTime() + istOffset);
  const ist2 = new Date(d2.getTime() + istOffset);
  
  return (
    ist1.getUTCFullYear() === ist2.getUTCFullYear() &&
    ist1.getUTCMonth() === ist2.getUTCMonth() &&
    ist1.getUTCDate() === ist2.getUTCDate()
  );
};

const getCurrentDayTargetIST = (freeTarget) => {
  if (!freeTarget?.currentWeek?.days) return null;
  
  const todayIST = getTodayIST();
  
  return freeTarget.currentWeek.days.find(day => {
    return isSameDayIST(day.date, todayIST);
  });
};

const calculateTodayOnlineTime = async (hostId) => {
  const host = await Host.findById(hostId).select('onlineTimeLogs');
  
  if (!host || !host.onlineTimeLogs || host.onlineTimeLogs.length === 0) {
    return 0;
  }

  const todayIST = getTodayIST();
  const todayStart = new Date(todayIST);
  const todayEnd = new Date(todayIST);
  todayEnd.setUTCHours(23, 59, 59, 999);

  let totalOnlineTime = 0;

  for (const log of host.onlineTimeLogs) {
    if (!log.startTime) continue;

    const sessionStart = new Date(log.startTime);
    
    if (sessionStart < todayStart) continue;
    
    if (!log.endTime) {
      const now = new Date();
      if (now > todayStart) {
        totalOnlineTime += Math.floor((now - sessionStart) / 1000);
      }
    } else {
      const sessionEnd = new Date(log.endTime);
      if (sessionEnd >= todayStart && sessionStart <= todayEnd) {
        const start = sessionStart > todayStart ? sessionStart : todayStart;
        const end = sessionEnd < todayEnd ? sessionEnd : todayEnd;
        totalOnlineTime += Math.floor((end - start) / 1000);
      }
    }
  }

  return Math.min(totalOnlineTime, 28800);
};



// Rest of the cron code remains the same...

module.exports = { startCronJobs, checkAndCompleteTargets,
  scheduleJob };