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
   * @param {boolean} data.metadata_stripped - Whether metadata was removed
   * @param {Object} data.metadata_embedded - Embedded metadata details
   * @param {Array<string>} data.metadata_operations - Metadata operations performed
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
      description: data.description || null,
      metadata_stripped: data.metadata_stripped || false,
      metadata_embedded: data.metadata_embedded || null,
      metadata_operations: data.metadata_operations || []
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

    // Only active files (use is_deleted column)
    conditions.push(`is_deleted = FALSE`);

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
    return result; // raw() already returns rows array, not result object
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
    console.log('\n📊 ========== DASHBOARD STORAGE STATS SYNC ==========');

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

    console.log('📋 Executing query to get storage stats from database...');
    console.log(`   Table: ${this.tableName}`);
    console.log(`   Filter: is_deleted = FALSE`);
    console.log(`   Full SQL: ${sql}`);

    const result = await this.raw(sql);

    console.log('📦 Raw database result:', JSON.stringify(result, null, 2));
    console.log('📦 Result type:', typeof result);
    console.log('📦 Result is array:', Array.isArray(result));

    // Handle both array response (Postgres returns array) and object with rows property
    let rows;
    if (Array.isArray(result)) {
      console.log('📦 Result is array, using directly');
      rows = result;
    } else if (result && result.rows) {
      console.log('📦 Result has rows property, extracting');
      rows = result.rows;
    } else {
      console.log('📦 Result format unknown, treating as empty');
      rows = [];
    }

    console.log('📦 Extracted rows:', JSON.stringify(rows, null, 2));

    if (!rows || rows.length === 0) {
      console.log('⚠️  No results returned from database query');
      console.log('📋 Checking if table exists and has any rows...');

      const tableCheckSql = `SELECT COUNT(*) as all_files FROM ${this.tableName}`;
      const tableCheck = await this.raw(tableCheckSql);
      const tableRows = Array.isArray(tableCheck) ? tableCheck : (tableCheck.rows || []);
      console.log(`   Total rows in table (including deleted): ${tableRows[0]?.all_files || 0}`);

      const deletedCheckSql = `SELECT COUNT(*) as deleted_files FROM ${this.tableName} WHERE is_deleted = TRUE`;
      const deletedCheck = await this.raw(deletedCheckSql);
      const deletedRows = Array.isArray(deletedCheck) ? deletedCheck : (deletedCheck.rows || []);
      console.log(`   Deleted rows: ${deletedRows[0]?.deleted_files || 0}`);

      console.log('✅ Returning default zero stats\n');
      return {
        total_files: 0,
        total_size_bytes: 0,
        image_count: 0,
        video_count: 0,
        other_count: 0
      };
    }

    const stats = rows[0];

    // Convert string counts to integers
    const finalStats = {
      total_files: parseInt(stats.total_files) || 0,
      total_size_bytes: parseInt(stats.total_size_bytes) || 0,
      image_count: parseInt(stats.image_count) || 0,
      video_count: parseInt(stats.video_count) || 0,
      other_count: parseInt(stats.other_count) || 0
    };

    console.log('\n✅ Database stats retrieved successfully:');
    console.log(`   📁 Total Files: ${finalStats.total_files}`);
    console.log(`   💾 Total Size: ${(finalStats.total_size_bytes / (1024 * 1024)).toFixed(2)} MB (${finalStats.total_size_bytes} bytes)`);
    console.log(`   🖼️  Images: ${finalStats.image_count}`);
    console.log(`   🎥 Videos: ${finalStats.video_count}`);
    console.log(`   📄 Other: ${finalStats.other_count}`);
    console.log('================================================\n');

    return finalStats;
  }
}

module.exports = new MediaFile();
