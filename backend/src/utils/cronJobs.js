const cron = require('node-cron');
const DiamondTransaction = require('../models/DiamondTransaction');
const logger = require('./logger');

const FreeTarget = require('../models/FreeTarget');
const Host = require('../models/Host');
const mongoose = require('mongoose');

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


// Reward configuration
const REWARD_CONFIG = {
  user: {
    1: { coins: 5000, diamonds: 100 },
    2: { coins: 3000, diamonds: 75 },
    3: { coins: 2000, diamonds: 50 },
    4: { coins: 1500, diamonds: 40 },
    5: { coins: 1000, diamonds: 30 },
    6: { coins: 800, diamonds: 25 },
    7: { coins: 600, diamonds: 20 },
    8: { coins: 500, diamonds: 15 },
    9: { coins: 400, diamonds: 12 },
    10: { coins: 300, diamonds: 10 }
  },
  host: {
    1: { coins: 5000, diamonds: 100 },
    2: { coins: 3000, diamonds: 75 },
    3: { coins: 2000, diamonds: 50 },
    4: { coins: 1500, diamonds: 40 },
    5: { coins: 1000, diamonds: 30 },
    6: { coins: 800, diamonds: 25 },
    7: { coins: 600, diamonds: 20 },
    8: { coins: 500, diamonds: 15 },
    9: { coins: 400, diamonds: 12 },
    10: { coins: 300, diamonds: 10 }
  }
};

// Helper function to get last week boundaries in IST
const getLastWeekBoundaries = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  
  const istDay = istNow.getUTCDay();
  const istDate = istNow.getUTCDate();
  const istMonth = istNow.getUTCMonth();
  const istYear = istNow.getUTCFullYear();
  
  // Calculate how many days to go back to reach last Monday
  const daysToGoBack = istDay === 0 ? 6 : istDay - 1;
  
  // Last Monday (7 days before this Monday) 00:00:00 IST
  const lastMondayIST = new Date(Date.UTC(istYear, istMonth, istDate - daysToGoBack - 7, 0, 0, 0, 0));
  
  // Last Sunday (1 day before this Monday) 23:59:59 IST
  const lastSundayIST = new Date(Date.UTC(istYear, istMonth, istDate - daysToGoBack - 1, 23, 59, 59, 999));
  
  // Return as IST times
  return { 
    weekStart: lastMondayIST,
    weekEnd: lastSundayIST
  };
};

// Main function to distribute rewards
const distributeWeeklyRewards = async () => {
  try {
    console.log('Starting weekly reward distribution...');
    
    const { weekStart, weekEnd } = getLastWeekBoundaries();
    console.log(`Processing week: ${weekStart} to ${weekEnd}`);

    // Process users
    await distributeRewardsForType('user', weekStart);
    
    // Process hosts
    await distributeRewardsForType('host', weekStart);

    // Delete data older than 2 weeks
    await cleanupOldLeaderboardData();

    console.log('Weekly reward distribution completed successfully');
  } catch (error) {
    console.error('Error in weekly reward distribution:', error);
    // You might want to send alert/notification here
  }
};

// Distribute rewards for specific user type
const distributeRewardsForType = async (userType, weekStart) => {
  const topUsers = await WeeklyLeaderboard.find({
    userType,
    weekStartDate: weekStart,
    rewardDistributed: { $ne: true }
  })
    .sort({ totalCallDuration: -1 })
    .limit(10)
    .populate('userId');

  console.log(`Found ${topUsers.length} ${userType}s to reward`);

  for (let i = 0; i < topUsers.length; i++) {
    const entry = topUsers[i];
    const rank = i + 1;
    const reward = REWARD_CONFIG[userType][rank];

    if (!reward || !entry.userId) continue;

    try {
      // Update user's wallet
      await User.findByIdAndUpdate(
        entry.userId._id,
        {
          $inc: {
            coins: reward.coins,
            diamonds: reward.diamonds
          }
        }
      );

      // Mark reward as distributed
      await WeeklyLeaderboard.findByIdAndUpdate(
        entry._id,
        {
          rewardDistributed: true,
          rank: rank,
          coinsAwarded: reward.coins,
          diamondsAwarded: reward.diamonds,
          rewardDistributedAt: new Date()
        }
      );

      // Create notification for user
      await Notification.create({
        userId: entry.userId._id,
        type: 'leaderboard_reward',
        title: '🏆 Weekly Leaderboard Reward',
        message: `Congratulations! You ranked #${rank} and earned ${reward.coins} coins and ${reward.diamonds} diamonds!`,
        data: {
          rank,
          coins: reward.coins,
          diamonds: reward.diamonds,
          userType,
          weekStart
        }
      });

      console.log(`Rewarded ${userType} ${entry.userId.name} (Rank ${rank}): ${reward.coins} coins, ${reward.diamonds} diamonds`);
    } catch (error) {
      console.error(`Error rewarding user ${entry.userId._id}:`, error);
    }
  }
};

// Cleanup old leaderboard data (keep only last 2 weeks)
const cleanupOldLeaderboardData = async () => {
  const IST_OFFSET = 5.5 * 60 * 60 * 1000;
  const nowUTC = new Date();
  const nowIST = new Date(nowUTC.getTime() + IST_OFFSET);
  
  // Calculate date 2 weeks ago
  const twoWeeksAgo = new Date(nowIST);
  twoWeeksAgo.setUTCDate(nowIST.getUTCDate() - 14);
  twoWeeksAgo.setUTCHours(0, 0, 0, 0);
  
  const cutoffDate = new Date(twoWeeksAgo.getTime() - IST_OFFSET);

  const result = await WeeklyLeaderboard.deleteMany({
    weekStartDate: { $lt: cutoffDate }
  });

  console.log(`Deleted ${result.deletedCount} old leaderboard entries`);
};

// Schedule cron job to run every Monday at 00:05 IST
// Cron expression: '5 18 * * 0' runs at 18:35 UTC Sunday = 00:05 IST Monday
const scheduleWeeklyRewards = () => {
  cron.schedule('5 18 * * 0', async () => {
    console.log('Cron job triggered: Distributing weekly rewards');
    await distributeWeeklyRewards();
  }, {
    timezone: "UTC"
  });

  console.log('Weekly reward distribution cron job scheduled (Every Monday 00:05 IST)');
};

// Manual trigger function for testing
const manualTriggerRewards = async () => {
  console.log('Manual trigger: Distributing rewards...');
  await distributeWeeklyRewards();
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
  scheduleJob,
 scheduleWeeklyRewards,
  manualTriggerRewards,
  distributeWeeklyRewards };