const { query } = require('../config/database');

class Canvas {
  /**
   * Create or update canvas for a file request
   */
  static async upsertCanvas(fileRequestId, content, attachments = []) {
    const sql = `
      INSERT INTO file_request_canvas (file_request_id, content, attachments)
      VALUES ($1, $2, $3)
      ON CONFLICT (file_request_id)
      DO UPDATE SET
        content = EXCLUDED.content,
        attachments = EXCLUDED.attachments,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await query(sql, [
      fileRequestId,
      JSON.stringify(content),
      JSON.stringify(attachments)
    ]);

    return result.rows ? result.rows[0] : result[0];
  }

  /**
   * Get canvas by file request ID
   */
  static async getByRequestId(fileRequestId) {
    const sql = `
      SELECT * FROM file_request_canvas
      WHERE file_request_id = $1
    `;

    const result = await query(sql, [fileRequestId]);
    return result.rows ? result.rows[0] : result[0];
  }

  /**
   * Delete canvas for a file request
   */
  static async deleteByRequestId(fileRequestId) {
    const sql = `
      DELETE FROM file_request_canvas
      WHERE file_request_id = $1
      RETURNING *
    `;

    const result = await query(sql, [fileRequestId]);
    return result.rows ? result.rows[0] : result[0];
  }

  /**
   * Add attachment to canvas
   */
  static async addAttachment(fileRequestId, attachment) {
    const sql = `
      UPDATE file_request_canvas
      SET attachments = attachments || $1::jsonb,
          updated_at = NOW()
      WHERE file_request_id = $2
      RETURNING *
    `;

    const result = await query(sql, [
      JSON.stringify([attachment]),
      fileRequestId
    ]);

    return result.rows ? result.rows[0] : result[0];
  }

  /**
   * Remove attachment from canvas
   */
  static async removeAttachment(fileRequestId, fileId) {
    const sql = `
      UPDATE file_request_canvas
      SET attachments = (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(attachments) elem
        WHERE elem->>'file_id' != $1
      ),
      updated_at = NOW()
      WHERE file_request_id = $2
      RETURNING *
    `;

    const result = await query(sql, [fileId, fileRequestId]);
    return result.rows ? result.rows[0] : result[0];
  }

  /**
   * Check if canvas exists for request
   */
  static async exists(fileRequestId) {
    const sql = `
      SELECT EXISTS(
        SELECT 1 FROM file_request_canvas
        WHERE file_request_id = $1
      )
    `;

    const result = await query(sql, [fileRequestId]);
    return result.rows ? result.rows[0].exists : result[0].exists;
  }
}

module.exports = Canvas;
