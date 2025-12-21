const cron = require('node-cron');
const DiamondTransaction = require('../models/DiamondTransaction');
const logger = require('./logger');

const FreeTarget = require('../models/FreeTarget');
const Host = require('../models/Host');

const calculateTodayOnlineTime = async (hostId) => {
  const host = await Host.findById(hostId).select('onlineTimeLogs');
  
  if (!host || !host.onlineTimeLogs || host.onlineTimeLogs.length === 0) {
    return 0;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

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

  return totalOnlineTime;
};


const checkAndCompleteTargets = async () => {
  try {
    logger.info('🔍 Running free target auto-completion check...');
    
    // Find all active free targets
    const freeTargets = await FreeTarget.find({
      isEnabled: true,
      'currentWeek.status': 'active'
    }).populate('hostId');

    let completedCount = 0;
    let checkedCount = 0;

    for (const freeTarget of freeTargets) {
      try {
        const todayTarget = freeTarget.getCurrentDayTarget();
        
        // Skip if no target for today or already completed/failed
        if (!todayTarget || todayTarget.status !== 'pending') {
          continue;
        }

        checkedCount++;

        // Calculate real-time online time
        const timeCompleted = await calculateTodayOnlineTime(freeTarget.hostId._id);
        todayTarget.totalCallDuration = timeCompleted;

        // Check if target is completed
        if (timeCompleted >= freeTarget.targetDurationPerDay) {
          todayTarget.status = 'completed';
          todayTarget.completedAt = new Date();
          freeTarget.currentWeek.completedDays += 1;

          // Award 1 lakh diamonds
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
          // Just update the time, don't save unnecessarily
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

module.exports = { startCronJobs, checkAndCompleteTargets,
  scheduleJob };