const BaseModel = require('./BaseModel');

/**
 * Editor Model
 * Manages creative team members (DEEP, DEEPA, DEEPANSHU, DEEPANSHUVERMA)
 */
class Editor extends BaseModel {
  constructor() {
    super('editors');
  }

  /**
   * Create a new editor
   * @param {Object} data - Editor data
   * @param {string} data.name - Editor name (uppercase, used in ad names)
   * @param {string} data.display_name - Display name (friendly)
   * @returns {Promise<Object>} Created editor
   */
  async createEditor({ name, display_name }) {
    return this.create({
      name: name.toUpperCase(),
      display_name: display_name || name,
      is_active: true
    });
  }

  /**
   * Find editor by name (case-insensitive)
   * @param {string} name - Editor name
   * @returns {Promise<Object|null>} Editor or null
   */
  async findByName(name) {
    return this.findOne('UPPER(name)', name.toUpperCase());
  }

  /**
   * Get all active editors
   * @returns {Promise<Array>} Active editors
   */
  async getActiveEditors() {
    return this.findAll({ is_active: true }, 'display_name ASC');
  }

  /**
   * Get editor performance stats
   * @param {string} editorId - Editor ID
   * @returns {Promise<Object>} Performance stats
   */
  async getPerformanceStats(editorId) {
    const sql = `
      SELECT
        COUNT(DISTINCT mf.id) as total_media_files,
        COUNT(DISTINCT fa.id) as total_ads,
        COALESCE(SUM(fa.spend), 0) as total_spend,
        COALESCE(AVG(fa.cpm), 0) as avg_cpm,
        COALESCE(AVG(fa.cpc), 0) as avg_cpc,
        COALESCE(AVG(fa.cost_per_result), 0) as avg_cost_per_result
      FROM editors e
      LEFT JOIN media_files mf ON mf.editor_id = e.id AND mf.deleted_at IS NULL
      LEFT JOIN facebook_ads fa ON fa.editor_id = e.id
      WHERE e.id = $1
      GROUP BY e.id
    `;

    const result = await this.raw(sql, [editorId]);
    return result.rows[0] || null;
  }

  /**
   * Get all editors with their stats
   * @returns {Promise<Array>} Editors with performance data
   */
  async getAllWithStats() {
    const sql = `
      SELECT
        e.id,
        e.name,
        e.display_name,
        e.is_active,
        e.created_at,
        COUNT(DISTINCT mf.id) as media_file_count,
        COUNT(DISTINCT fa.id) as ad_count,
        COALESCE(SUM(fa.spend), 0) as total_spend
      FROM editors e
      LEFT JOIN media_files mf ON mf.editor_id = e.id AND mf.deleted_at IS NULL
      LEFT JOIN facebook_ads fa ON fa.editor_id = e.id
      GROUP BY e.id, e.name, e.display_name, e.is_active, e.created_at
      ORDER BY e.display_name ASC
    `;

    const result = await this.raw(sql);
    return result.rows;
  }
}

module.exports = new Editor();
