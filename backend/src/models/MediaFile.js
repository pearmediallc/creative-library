const BaseModel = require('./BaseModel');

/**
 * MediaFile Model
 * Extends BaseModel with media-specific operations
 */
class MediaFile extends BaseModel {
  constructor() {
    super('media_files');
  }

  /**
   * Create a new media file record
   * @param {Object} data - Media file data
   * @param {string} data.uploaded_by - Uploader user ID
   * @param {string} data.editor_id - Selected editor ID
   * @param {string} data.editor_name - Editor name (denormalized)
   * @param {string} data.filename - Generated filename
   * @param {string} data.original_filename - Original file name
   * @param {string} data.file_type - File type (image/video)
   * @param {string} data.mime_type - File MIME type
   * @param {number} data.file_size - File size in bytes
   * @param {string} data.s3_key - S3 object key
   * @param {string} data.s3_url - S3 URL
   * @param {number} data.width - Image/video width
   * @param {number} data.height - Image/video height
   * @param {number} data.duration - Duration in seconds for videos
   * @param {string} data.thumbnail_url - Thumbnail URL
   * @param {Array<string>} data.tags - Tags array
   * @param {string} data.description - Description
   * @returns {Promise<Object>} Created media file record
   */
  async createMediaFile(data) {
    return this.create({
      uploaded_by: data.uploaded_by,
      editor_id: data.editor_id,
      editor_name: data.editor_name,
      filename: data.filename,
      original_filename: data.original_filename,
      file_type: data.file_type,
      mime_type: data.mime_type,
      file_size: data.file_size,
      s3_key: data.s3_key,
      s3_url: data.s3_url,
      width: data.width || null,
      height: data.height || null,
      duration: data.duration || null,
      thumbnail_url: data.thumbnail_url || null,
      tags: data.tags || [],
      description: data.description || null
    });
  }

  /**
   * Find media files with filters
   * @param {Object} filters
   * @param {string} filters.uploaded_by - Filter by uploader
   * @param {string} filters.editor_id - Filter by editor
   * @param {string} filters.media_type - Filter by type (image, video, other)
   * @param {Array<string>} filters.tags - Filter by tags (contains any)
   * @param {string} filters.search - Search in filename/description
   * @param {number} filters.limit - Limit results
   * @param {number} filters.offset - Offset for pagination
   * @returns {Promise<Array>} Media files
   */
  async findWithFilters(filters = {}) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Only active files
    conditions.push(`deleted_at IS NULL`);

    if (filters.uploaded_by) {
      conditions.push(`uploaded_by = $${paramIndex++}`);
      params.push(filters.uploaded_by);
    }

    if (filters.editor_id) {
      conditions.push(`editor_id = $${paramIndex++}`);
      params.push(filters.editor_id);
    }

    if (filters.media_type) {
      conditions.push(`file_type = $${paramIndex++}`);
      params.push(filters.media_type);
    }

    if (filters.tags && filters.tags.length > 0) {
      conditions.push(`tags && $${paramIndex++}`);
      params.push(filters.tags);
    }

    if (filters.search) {
      conditions.push(`(
        original_filename ILIKE $${paramIndex} OR
        description ILIKE $${paramIndex}
      )`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const sql = `
      SELECT
        mf.*,
        u.name as uploader_name,
        u.email as uploader_email,
        e.display_name as editor_display_name
      FROM ${this.tableName} mf
      LEFT JOIN users u ON u.id = mf.uploaded_by
      LEFT JOIN editors e ON e.id = mf.editor_id
      ${whereClause}
      ORDER BY mf.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    params.push(limit, offset);

    const result = await this.raw(sql, params);
    return result.rows;
  }

  /**
   * Get media file with presigned download URL
   * @param {string} id - Media file ID
   * @returns {Promise<Object>} Media file with download_url
   */
  async findByIdWithUrl(id) {
    const mediaFile = await this.findById(id);
    if (!mediaFile) return null;

    // URL generation will be handled by the service layer
    return mediaFile;
  }

  /**
   * Get user's upload count for current month
   * @param {string} userId - User ID
   * @returns {Promise<number>} Upload count
   */
  async getUserMonthlyUploadCount(userId) {
    const sql = `
      SELECT COUNT(*) as count
      FROM ${this.tableName}
      WHERE uploaded_by = $1
        AND deleted_at IS NULL
        AND created_at >= date_trunc('month', CURRENT_DATE)
    `;

    const result = await this.raw(sql, [userId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Get media files by S3 keys (bulk)
   * @param {Array<string>} s3Keys - Array of S3 keys
   * @returns {Promise<Array>} Media files
   */
  async findByS3Keys(s3Keys) {
    if (!s3Keys || s3Keys.length === 0) return [];

    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE s3_key = ANY($1)
        AND deleted_at IS NULL
    `;

    const result = await this.raw(sql, [s3Keys]);
    return result.rows;
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Storage stats
   */
  async getStorageStats() {
    const sql = `
      SELECT
        COUNT(*) as total_files,
        COALESCE(SUM(file_size), 0) as total_size_bytes,
        SUM(CASE WHEN file_type = 'image' THEN 1 ELSE 0 END) as image_count,
        SUM(CASE WHEN file_type = 'video' THEN 1 ELSE 0 END) as video_count,
        SUM(CASE WHEN file_type NOT IN ('image', 'video') THEN 1 ELSE 0 END) as other_count
      FROM ${this.tableName}
      WHERE is_deleted = FALSE
    `;

    const result = await this.raw(sql);
    if (!result || !result.rows || result.rows.length === 0) {
      return {
        total_files: 0,
        total_size_bytes: 0,
        image_count: 0,
        video_count: 0,
        other_count: 0
      };
    }
    return result.rows[0];
  }
}

module.exports = new MediaFile();
