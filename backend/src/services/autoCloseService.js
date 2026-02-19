/**
 * Auto-close service for launch requests and file requests
 * Automatically closes requests 24 hours after they are launched
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

class AutoCloseService {
  /**
   * Check and auto-close requests that have been launched for more than 24 hours
   */
  async checkAndClose() {
    const jobStartTime = new Date();
    logger.info('Auto-close job started');

    try {
      // Track job execution in scheduled_jobs table
      await query(
        `INSERT INTO scheduled_jobs (job_name, job_type, status, started_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (job_name) DO UPDATE
         SET status = $2, started_at = $3, last_error = NULL`,
        ['auto_close_requests', 'running', 'running', jobStartTime]
      );

      let totalClosed = 0;

      // Auto-close File Requests
      const fileRequestsClosed = await this.closeFileRequests();
      totalClosed += fileRequestsClosed;

      // Auto-close Launch Requests
      const launchRequestsClosed = await this.closeLaunchRequests();
      totalClosed += launchRequestsClosed;

      const jobEndTime = new Date();
      const duration = jobEndTime - jobStartTime;

      // Update job status to completed
      await query(
        `UPDATE scheduled_jobs
         SET status = $1,
             completed_at = $2,
             last_run_at = $2,
             next_run_at = $2 + INTERVAL '1 hour',
             metadata = jsonb_build_object(
               'file_requests_closed', $3,
               'launch_requests_closed', $4,
               'total_closed', $5,
               'duration_ms', $6
             )
         WHERE job_name = $7`,
        ['completed', jobEndTime, fileRequestsClosed, launchRequestsClosed, totalClosed, duration, 'auto_close_requests']
      );

      logger.info('Auto-close job completed', {
        fileRequestsClosed,
        launchRequestsClosed,
        totalClosed,
        duration: `${duration}ms`
      });

      return { fileRequestsClosed, launchRequestsClosed, totalClosed };

    } catch (error) {
      logger.error('Auto-close job failed', { error: error.message, stack: error.stack });

      // Update job status to failed
      await query(
        `UPDATE scheduled_jobs
         SET status = $1,
             completed_at = NOW(),
             last_error = $2
         WHERE job_name = $3`,
        ['failed', error.message, 'auto_close_requests']
      ).catch(err => logger.error('Failed to update job status', { error: err.message }));

      throw error;
    }
  }

  /**
   * Auto-close File Requests that have been launched for > 24 hours
   * @returns {number} Number of requests closed
   */
  async closeFileRequests() {
    try {
      const result = await query(
        `UPDATE file_requests
         SET status = 'closed',
             closed_at = NOW(),
             closed_by = NULL,
             is_active = FALSE,
             updated_at = NOW()
         WHERE status = 'launched'
           AND launched_at IS NOT NULL
           AND launched_at < NOW() - INTERVAL '24 hours'
           AND is_active = TRUE
         RETURNING id, title, launched_at`,
        []
      );

      const closedCount = result.rowCount || 0;

      if (closedCount > 0) {
        logger.info('Auto-closed file requests', {
          count: closedCount,
          requests: result.rows.map(r => ({ id: r.id, title: r.title, launched_at: r.launched_at }))
        });
      }

      return closedCount;

    } catch (error) {
      logger.error('Failed to auto-close file requests', { error: error.message });
      return 0;
    }
  }

  /**
   * Auto-close Launch Requests that have been launched for > 24 hours
   * @returns {number} Number of requests closed
   */
  async closeLaunchRequests() {
    try {
      const result = await query(
        `UPDATE launch_requests
         SET status = 'closed',
             closed_at = NOW(),
             updated_at = NOW()
         WHERE status = 'launched'
           AND launched_at IS NOT NULL
           AND launched_at < NOW() - INTERVAL '24 hours'
         RETURNING id, title, launched_at`,
        []
      );

      const closedCount = result.rowCount || 0;

      if (closedCount > 0) {
        logger.info('Auto-closed launch requests', {
          count: closedCount,
          requests: result.rows.map(r => ({ id: r.id, title: r.title, launched_at: r.launched_at }))
        });
      }

      return closedCount;

    } catch (error) {
      logger.error('Failed to auto-close launch requests', { error: error.message });
      return 0;
    }
  }
}

module.exports = new AutoCloseService();
