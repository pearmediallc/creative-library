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
      LEFT JOIN media_files mf ON mf.editor_id = e.id AND mf.is_deleted = FALSE
      LEFT JOIN facebook_ads fa ON fa.editor_id = e.id
      WHERE e.id = $1
      GROUP BY e.id
    `;

    const result = await this.raw(sql, [editorId]);
    const rows = Array.isArray(result) ? result : (result.rows || []);
    return rows[0] || null;
  }

  /**
   * Get all editors with their stats
   * @returns {Promise<Array>} Editors with performance data
   */
  async getAllWithStats() {
    console.log('\n📊 ========== FETCHING EDITOR STATS ==========');

    const sql = `
      SELECT
        e.id,
        e.name,
        e.display_name,
        e.is_active,
        e.created_at,
        COUNT(DISTINCT mf.id) as media_file_count,
        COUNT(DISTINCT fa.id) as ad_count,
        COALESCE(SUM(fa.spend), 0) as total_spend,
        COALESCE(SUM(fa.impressions), 0) as total_impressions
      FROM editors e
      LEFT JOIN media_files mf ON mf.editor_id = e.id AND mf.is_deleted = FALSE
      LEFT JOIN facebook_ads fa ON fa.editor_id = e.id
      GROUP BY e.id, e.name, e.display_name, e.is_active, e.created_at
      ORDER BY e.display_name ASC
    `;

    console.log('🔍 SQL Query:', sql);
    const result = await this.raw(sql);

    // Handle both array response (Postgres) and object with rows property
    const rows = Array.isArray(result) ? result : (result.rows || []);

    console.log(`✅ Found ${rows.length} editors`);
    rows.forEach(row => {
      console.log(`  📋 ${row.display_name} (${row.name}):`);
      console.log(`      - Media files: ${row.media_file_count}`);
      console.log(`      - Ads: ${row.ad_count}`);
      console.log(`      - Total spend: $${row.total_spend}`);
      console.log(`      - Total impressions: ${row.total_impressions}`);
    });

    // Also check total ads in database for debugging
    const totalAdsSql = 'SELECT COUNT(*) as total FROM facebook_ads';
    const totalAdsResult = await this.raw(totalAdsSql);
    const totalAds = Array.isArray(totalAdsResult) ? totalAdsResult[0].total : (totalAdsResult.rows?.[0]?.total || 0);
    console.log(`\n📊 Total ads in database: ${totalAds}`);

    // Check how many ads have editor_id assigned
    const adsWithEditorSql = 'SELECT COUNT(*) as total FROM facebook_ads WHERE editor_id IS NOT NULL';
    const adsWithEditorResult = await this.raw(adsWithEditorSql);
    const adsWithEditor = Array.isArray(adsWithEditorResult) ? adsWithEditorResult[0].total : (adsWithEditorResult.rows?.[0]?.total || 0);
    console.log(`📊 Ads with editor_id assigned: ${adsWithEditor}`);

    console.log('================================================\n');

    return rows;
  }
}

module.exports = new Editor();
