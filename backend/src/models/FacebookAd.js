const BaseModel = require('./BaseModel');

class FacebookAd extends BaseModel {
  constructor() {
    super('facebook_ads');
  }

  /**
   * Create table if not exists
   */
  async createTable() {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fb_ad_id VARCHAR(255) UNIQUE NOT NULL,
        ad_name TEXT NOT NULL,
        ad_account_id VARCHAR(255) NOT NULL,
        campaign_id VARCHAR(255),
        campaign_name TEXT,
        editor_id UUID REFERENCES editors(id) ON DELETE SET NULL,
        editor_name VARCHAR(255),
        spend DECIMAL(12, 2) DEFAULT 0,
        cpm DECIMAL(12, 2) DEFAULT 0,
        cpc DECIMAL(12, 2) DEFAULT 0,
        cost_per_result DECIMAL(12, 2) DEFAULT 0,
        impressions BIGINT DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        last_synced_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    const createIndexSql = `
      CREATE INDEX IF NOT EXISTS idx_facebook_ads_fb_ad_id ON ${this.tableName}(fb_ad_id);
      CREATE INDEX IF NOT EXISTS idx_facebook_ads_editor_id ON ${this.tableName}(editor_id);
      CREATE INDEX IF NOT EXISTS idx_facebook_ads_ad_account_id ON ${this.tableName}(ad_account_id);
      CREATE INDEX IF NOT EXISTS idx_facebook_ads_campaign_id ON ${this.tableName}(campaign_id)
    `;

    await this.raw(createTableSql);
    await this.raw(createIndexSql);
  }

  /**
   * Create ad name changes table
   */
  async createAdNameChangesTable() {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS ad_name_changes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fb_ad_id VARCHAR(255) NOT NULL,
        old_ad_name TEXT,
        new_ad_name TEXT,
        old_editor_name VARCHAR(255),
        new_editor_name VARCHAR(255),
        editor_changed BOOLEAN DEFAULT FALSE,
        detected_at TIMESTAMP DEFAULT NOW()
      )
    `;

    const createIndexSql = `
      CREATE INDEX IF NOT EXISTS idx_ad_name_changes_fb_ad_id ON ad_name_changes(fb_ad_id);
      CREATE INDEX IF NOT EXISTS idx_ad_name_changes_editor_changed ON ad_name_changes(editor_changed)
    `;

    await this.raw(createTableSql);
    await this.raw(createIndexSql);
  }
}

module.exports = new FacebookAd();
