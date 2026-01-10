// ============================================
// ACTIVITY LOG EXPORT SERVICE
// ============================================
// Daily export of activity logs to AWS S3

const cron = require('node-cron');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const pool = require('../config/database');
const logger = require('../utils/logger');

// S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET;

/**
 * Export activity logs for a specific date to S3
 */
async function exportDailyLogs(targetDate) {
  const client = await pool.connect();
  let exportId = null;

  try {
    await client.query('BEGIN');

    // Create export record
    const exportResult = await client.query(
      `INSERT INTO activity_log_exports (export_date, s3_bucket, status)
       VALUES ($1, $2, 'pending')
       RETURNING id`,
      [targetDate, BUCKET_NAME]
    );
    exportId = exportResult.rows[0].id;

    // Update status to uploading
    await client.query(
      'UPDATE activity_log_exports SET status = $1 WHERE id = $2',
      ['uploading', exportId]
    );

    // Get unexported logs using the database function
    const logsResult = await client.query(
      'SELECT * FROM get_unexported_activity_logs($1)',
      [targetDate]
    );

    const logs = logsResult.rows;

    if (logs.length === 0) {
      logger.info(`No activity logs to export for ${targetDate}`);
      await client.query(
        `UPDATE activity_log_exports
         SET status = 'completed', record_count = 0, completed_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [exportId]
      );
      await client.query('COMMIT');
      return { success: true, recordCount: 0, exportId };
    }

    // Prepare JSON data
    const exportData = {
      export_date: targetDate,
      export_timestamp: new Date().toISOString(),
      record_count: logs.length,
      logs: logs
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const buffer = Buffer.from(jsonContent, 'utf-8');

    // Generate S3 key (path structure: activity-logs/YYYY/MM/YYYY-MM-DD.json)
    const date = new Date(targetDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const s3Key = `activity-logs/${year}/${month}/${year}-${month}-${day}.json`;

    // Upload to S3
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: buffer,
      ContentType: 'application/json',
      Metadata: {
        'export-id': exportId.toString(),
        'record-count': logs.length.toString(),
        'export-date': targetDate
      }
    });

    await s3Client.send(putCommand);

    logger.info(`Uploaded ${logs.length} activity logs to S3: ${s3Key}`);

    // Mark logs as exported
    const logIds = logs.map(log => log.id);
    await client.query(
      `UPDATE activity_logs
       SET exported_at = CURRENT_TIMESTAMP, export_id = $1
       WHERE id = ANY($2)`,
      [exportId, logIds]
    );

    // Update export record with success
    await client.query(
      `UPDATE activity_log_exports
       SET
         s3_key = $1,
         file_size = $2,
         record_count = $3,
         status = 'completed',
         completed_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [s3Key, buffer.length, logs.length, exportId]
    );

    await client.query('COMMIT');

    logger.info(`Successfully exported ${logs.length} logs for ${targetDate}`);
    return { success: true, s3Key, recordCount: logs.length, exportId };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Activity log export error:', error);

    // Update export record with error
    if (exportId) {
      await client.query(
        `UPDATE activity_log_exports
         SET status = 'failed', error_message = $1
         WHERE id = $2`,
        [error.message, exportId]
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

/**
 * Export logs for yesterday (to be run daily at 2 AM)
 */
async function exportYesterdayLogs() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = yesterday.toISOString().split('T')[0];

    logger.info(`Starting daily activity log export for ${targetDate}`);

    // Update scheduled job - last run
    await pool.query(
      `UPDATE scheduled_jobs
       SET last_run_at = CURRENT_TIMESTAMP, last_status = 'running'
       WHERE job_name = 'activity_log_daily_export'`
    );

    const result = await exportDailyLogs(targetDate);

    // Update scheduled job - success
    await pool.query(
      `UPDATE scheduled_jobs
       SET
         last_status = 'success',
         next_run_at = CURRENT_DATE + INTERVAL '1 day' + TIME '02:00:00',
         updated_at = CURRENT_TIMESTAMP
       WHERE job_name = 'activity_log_daily_export'`
    );

    logger.info(`Daily export completed: ${result.recordCount} records`);
    return result;

  } catch (error) {
    logger.error('Daily export job failed:', error);

    // Update scheduled job - failed
    await pool.query(
      `UPDATE scheduled_jobs
       SET
         last_status = 'failed',
         last_error = $1,
         next_run_at = CURRENT_DATE + INTERVAL '1 day' + TIME '02:00:00',
         updated_at = CURRENT_TIMESTAMP
       WHERE job_name = 'activity_log_daily_export'`,
      [error.message]
    );

    throw error;
  }
}

/**
 * Schedule daily exports (runs at 2 AM every day)
 */
function scheduleDailyExports() {
  // Cron format: minute hour day month weekday
  // 0 2 * * * = At 02:00 every day
  cron.schedule('0 2 * * *', async () => {
    logger.info('Running scheduled activity log export...');
    try {
      await exportYesterdayLogs();
    } catch (error) {
      logger.error('Scheduled export failed:', error);
    }
  });

  logger.info('Activity log export cron job scheduled (daily at 2:00 AM)');
}

/**
 * Generate presigned download URL for an export
 */
async function getExportDownloadUrl(exportId, expiresIn = 3600) {
  try {
    const result = await pool.query(
      'SELECT s3_key, s3_bucket FROM activity_log_exports WHERE id = $1',
      [exportId]
    );

    if (result.rows.length === 0) {
      throw new Error('Export not found');
    }

    const { s3_key, s3_bucket } = result.rows[0];

    if (!s3_key) {
      throw new Error('Export file not available');
    }

    const command = new GetObjectCommand({
      Bucket: s3_bucket,
      Key: s3_key
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });

    // Optionally store the URL in the database
    await pool.query(
      'UPDATE activity_log_exports SET s3_url = $1 WHERE id = $2',
      [url, exportId]
    );

    return url;
  } catch (error) {
    logger.error('Generate download URL error:', error);
    throw error;
  }
}

/**
 * Get export history
 */
async function getExportHistory(limit = 30) {
  const result = await pool.query(
    `SELECT
       id,
       export_date,
       s3_key,
       file_size,
       record_count,
       status,
       error_message,
       created_at,
       completed_at
     FROM activity_log_exports
     ORDER BY export_date DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
}

/**
 * Get export by ID
 */
async function getExportById(exportId) {
  const result = await pool.query(
    `SELECT
       id,
       export_date,
       s3_key,
       s3_bucket,
       file_size,
       record_count,
       status,
       error_message,
       created_at,
       completed_at
     FROM activity_log_exports
     WHERE id = $1`,
    [exportId]
  );

  return result.rows[0] || null;
}

/**
 * Manually trigger export for a specific date (admin function)
 */
async function manualExport(targetDate, userId = null) {
  try {
    logger.info(`Manual export triggered for ${targetDate} by user ${userId || 'system'}`);

    const result = await exportDailyLogs(targetDate);

    // Update created_by if userId provided
    if (userId) {
      await pool.query(
        'UPDATE activity_log_exports SET created_by = $1 WHERE id = $2',
        [userId, result.exportId]
      );
    }

    return result;
  } catch (error) {
    logger.error('Manual export failed:', error);
    throw error;
  }
}

/**
 * Get scheduled job status
 */
async function getJobStatus() {
  const result = await pool.query(
    `SELECT
       job_name,
       job_type,
       last_run_at,
       last_status,
       last_error,
       next_run_at,
       is_active
     FROM scheduled_jobs
     WHERE job_name = 'activity_log_daily_export'`
  );

  return result.rows[0] || null;
}

module.exports = {
  exportDailyLogs,
  exportYesterdayLogs,
  scheduleDailyExports,
  getExportDownloadUrl,
  getExportHistory,
  getExportById,
  manualExport,
  getJobStatus
};
