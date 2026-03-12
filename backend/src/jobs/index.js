/**
 * Cron Jobs Initialization
 */

const cron = require('node-cron');
const logger = require('../utils/logger');
const activityLogExportService = require('../services/activityLogExportService');
const autoCloseService = require('../services/autoCloseService');
const { query } = require('../config/database');

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

  // Workload stats daily snapshot (every day at 1 AM)
  cron.schedule('0 1 * * *', async () => {
    logger.info('📊 Running daily workload stats snapshot...');
    try {
      await query(`
        INSERT INTO editor_workload_stats (editor_id, stat_date, active_requests, completed_requests, total_requests, load_percentage, avg_completion_time_hours)
        SELECT
          e.id as editor_id,
          CURRENT_DATE as stat_date,
          COUNT(CASE WHEN fre.status IN ('pending', 'assigned', 'in_progress') AND fr.is_active = TRUE THEN 1 END) as active_requests,
          COUNT(CASE WHEN fre.status = 'completed' THEN 1 END) as completed_requests,
          COUNT(fre.id) as total_requests,
          COALESCE(ec.current_load_percentage, 0) as load_percentage,
          COALESCE(ec.avg_completion_time_hours, 0) as avg_completion_time_hours
        FROM editors e
        LEFT JOIN file_request_editors fre ON fre.editor_id = e.id
        LEFT JOIN file_requests fr ON fr.id = fre.request_id
        LEFT JOIN editor_capacity ec ON ec.editor_id = e.id
        WHERE e.is_active = TRUE
        GROUP BY e.id, ec.current_load_percentage, ec.avg_completion_time_hours
        ON CONFLICT (editor_id, stat_date) DO UPDATE SET
          active_requests = EXCLUDED.active_requests,
          completed_requests = EXCLUDED.completed_requests,
          total_requests = EXCLUDED.total_requests,
          load_percentage = EXCLUDED.load_percentage,
          avg_completion_time_hours = EXCLUDED.avg_completion_time_hours
      `);
      logger.info('✅ Daily workload stats snapshot complete');
    } catch (error) {
      logger.error('❌ Daily workload stats snapshot failed:', error);
    }
  });

  logger.info('📅 Cron job scheduled: Workload stats snapshot (daily 1 AM)');
}

module.exports = {
  initializeCronJobs
};
