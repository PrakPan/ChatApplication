const cron = require('node-cron');
const DiamondTransaction = require('../models/DiamondTransaction');
const logger = require('./logger');

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

module.exports = { startCronJobs };