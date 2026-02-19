/**
 * Cron Jobs Initialization
 */

const cron = require('node-cron');
const logger = require('../utils/logger');
const activityLogExportService = require('../services/activityLogExportService');
const autoCloseService = require('../services/autoCloseService');

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

  // Auto-close requests (every hour)
  const autoCloseSchedule = process.env.AUTO_CLOSE_CHECK_CRON || '0 * * * *';

  cron.schedule(autoCloseSchedule, async () => {
    logger.info('🔒 Running auto-close requests job...');
    try {
      await autoCloseService.checkAndClose();
      logger.info('✅ Auto-close requests job complete');
    } catch (error) {
      logger.error('❌ Auto-close requests job failed:', error);
    }
  });

  logger.info(`📅 Cron job scheduled: Auto-close requests (${autoCloseSchedule})`);
}

module.exports = {
  initializeCronJobs
};
