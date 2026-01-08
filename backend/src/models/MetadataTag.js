const BaseModel = require('./BaseModel');

class MetadataTag extends BaseModel {
  constructor() {
    super('metadata_tags');
  }

  /**
   * Get all tags with usage counts
   * @param {Object} filters - Optional filters (category, search)
   * @returns {Promise<Array>} Tags with usage counts
   */
  async getAllWithUsage(filters = {}) {
    let sql = `
      SELECT
        mt.*,
        COUNT(DISTINCT mft.id) as usage_count,
        u.name as creator_name
      FROM ${this.tableName} mt
      LEFT JOIN media_file_tags mft ON mt.id = mft.tag_id
      LEFT JOIN users u ON mt.created_by = u.id
      WHERE mt.is_active = TRUE
    `;
    const params = [];
    let paramCount = 1;

    if (filters.category) {
      sql += ` AND mt.category = $${paramCount++}`;
      params.push(filters.category);
    }

    if (filters.search) {
      sql += ` AND mt.name ILIKE $${paramCount++}`;
      params.push(`%${filters.search}%`);
    }

    sql += `
      GROUP BY mt.id, u.name
      ORDER BY mt.name ASC
    `;

    const result = await this.raw(sql, params);
    return Array.isArray(result) ? result : result.rows || [];
  }

  /**
   * Create a new tag
   * @param {Object} data - Tag data
   * @returns {Promise<Object>} Created tag
   */
  async createTag(data) {
    const sql = `
      INSERT INTO ${this.tableName} (name, category, description, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await this.raw(sql, [
      data.name,
      data.category || 'general',
      data.description || null,
      data.created_by
    ]);
    return Array.isArray(result) ? result[0] : result.rows?.[0];
  }

  /**
   * Update tag
   * @param {string} tagId - Tag ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated tag
   */
  async updateTag(tagId, updates) {
    const sql = `
      UPDATE ${this.tableName}
      SET
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        description = COALESCE($3, description),
        updated_at = NOW()
      WHERE id = $4 AND is_active = TRUE
      RETURNING *
    `;
    const result = await this.raw(sql, [
      updates.name || null,
      updates.category || null,
      updates.description || null,
      tagId
    ]);
    return Array.isArray(result) ? result[0] : result.rows?.[0];
  }

  /**
   * Delete tag (soft delete)
   * @param {string} tagId - Tag ID
   * @returns {Promise<boolean>} Success
   */
  async deleteTag(tagId) {
    const sql = `
      UPDATE ${this.tableName}
      SET is_active = FALSE, updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `;
    const result = await this.raw(sql, [tagId]);
    return !!(Array.isArray(result) ? result[0] : result.rows?.[0]);
  }

  /**
   * Add tag to media file
   * @param {string} mediaFileId - Media file ID
   * @param {string} tagId - Tag ID
   * @param {string} userId - User adding the tag
   * @returns {Promise<Object>} Created association
   */
  async addTagToFile(mediaFileId, tagId, userId) {
    const sql = `
      INSERT INTO media_file_tags (media_file_id, tag_id, added_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (media_file_id, tag_id) DO NOTHING
      RETURNING *
    `;
    const result = await this.raw(sql, [mediaFileId, tagId, userId]);
    return Array.isArray(result) ? result[0] : result.rows?.[0];
  }

  /**
   * Remove tag from media file
   * @param {string} mediaFileId - Media file ID
   * @param {string} tagId - Tag ID
   * @returns {Promise<boolean>} Success
   */
  async removeTagFromFile(mediaFileId, tagId) {
    const sql = `
      DELETE FROM media_file_tags
      WHERE media_file_id = $1 AND tag_id = $2
      RETURNING id
    `;
    const result = await this.raw(sql, [mediaFileId, tagId]);
    return !!(Array.isArray(result) ? result[0] : result.rows?.[0]);
  }

  /**
   * Get tags for a media file
   * @param {string} mediaFileId - Media file ID
   * @returns {Promise<Array>} Tags
   */
  async getFileTagsFromFile(mediaFileId) {
    const sql = `
      SELECT
        mt.*,
        mft.added_at,
        u.name as added_by_name
      FROM media_file_tags mft
      JOIN ${this.tableName} mt ON mft.tag_id = mt.id
      LEFT JOIN users u ON mft.added_by = u.id
      WHERE mft.media_file_id = $1 AND mt.is_active = TRUE
      ORDER BY mft.added_at DESC
    `;
    const result = await this.raw(sql, [mediaFileId]);
    return Array.isArray(result) ? result : result.rows || [];
  }

  /**
   * Get files with a specific tag
   * @param {string} tagId - Tag ID
   * @returns {Promise<Array>} Media files
   */
  async getFilesWithTag(tagId) {
    const sql = `
      SELECT
        mf.*,
        mft.added_at as tag_added_at
      FROM media_file_tags mft
      JOIN media_files mf ON mft.media_file_id = mf.id
      WHERE mft.tag_id = $1 AND mf.is_deleted = FALSE
      ORDER BY mft.added_at DESC
    `;
    const result = await this.raw(sql, [tagId]);
    return Array.isArray(result) ? result : result.rows || [];
  }

  /**
   * Get all unique categories
   * @returns {Promise<Array>} Categories
   */
  async getCategories() {
    const sql = `
      SELECT DISTINCT category
      FROM ${this.tableName}
      WHERE is_active = TRUE AND category IS NOT NULL
      ORDER BY category ASC
    `;
    const result = await this.raw(sql);
    const rows = Array.isArray(result) ? result : result.rows || [];
    return rows.map(r => r.category);
  }

  /**
   * Bulk add tags to file
   * @param {string} mediaFileId - Media file ID
   * @param {Array<string>} tagIds - Array of tag IDs
   * @param {string} userId - User adding the tags
   * @returns {Promise<number>} Number of tags added
   */
  async bulkAddTagsToFile(mediaFileId, tagIds, userId) {
    if (!tagIds || tagIds.length === 0) return 0;

    const values = tagIds.map((_, i) => {
      const offset = i * 3;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
    }).join(', ');

    const params = tagIds.flatMap(tagId => [mediaFileId, tagId, userId]);

    const sql = `
      INSERT INTO media_file_tags (media_file_id, tag_id, added_by)
      VALUES ${values}
      ON CONFLICT (media_file_id, tag_id) DO NOTHING
      RETURNING id
    `;

    const result = await this.raw(sql, params);
    const rows = Array.isArray(result) ? result : result.rows || [];
    return rows.length;
  }
}

module.exports = new MetadataTag();
