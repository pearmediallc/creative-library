/**
 * Cron Jobs Initialization
 */

const cron = require('node-cron');
const logger = require('../utils/logger');
const activityLogExportService = require('../services/activityLogExportService');

function initializeCronJobs() {
  // Ad name change detection (every 6 hours)
  const adNameCheckSchedule = process.env.AD_NAME_CHECK_CRON || '0 */6 * * *';

  cron.schedule(adNameCheckSchedule, async () => {
    logger.info('🔍 Running ad name change detection job...');
    try {
      // TODO: Implement ad name change detection
      logger.info('✅ Ad name change detection complete');
    } catch (error) {
      logger.error('❌ Ad name change detection failed:', error);
    }
  });

  logger.info(`📅 Cron job scheduled: Ad name check (${adNameCheckSchedule})`);

  // Activity log export (daily at 2 AM)
  activityLogExportService.scheduleDailyExports();
}

module.exports = {
  initializeCronJobs
};
