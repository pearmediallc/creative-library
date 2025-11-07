const BaseModel = require('./BaseModel');

class FacebookAuth extends BaseModel {
  constructor() {
    super('facebook_auth');
  }

  /**
   * Create table if not exists
   */
  async createTable() {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        access_token TEXT NOT NULL,
        token_type VARCHAR(50) DEFAULT 'Bearer',
        expires_at TIMESTAMP,
        ad_account_id VARCHAR(255),
        ad_account_name VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `;

    const createIndexSql = `
      CREATE INDEX IF NOT EXISTS idx_facebook_auth_user_id ON ${this.tableName}(user_id);
      CREATE INDEX IF NOT EXISTS idx_facebook_auth_is_active ON ${this.tableName}(is_active)
    `;

    await this.raw(createTableSql);
    await this.raw(createIndexSql);
  }

  /**
   * Store or update Facebook auth tokens
   */
  async upsertAuth(userId, authData) {
    const sql = `
      INSERT INTO ${this.tableName} (
        user_id, access_token, token_type, expires_at,
        ad_account_id, ad_account_name, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        token_type = EXCLUDED.token_type,
        expires_at = EXCLUDED.expires_at,
        ad_account_id = EXCLUDED.ad_account_id,
        ad_account_name = EXCLUDED.ad_account_name,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await this.raw(sql, [
      userId,
      authData.access_token,
      authData.token_type || 'Bearer',
      authData.expires_at || null,
      authData.ad_account_id || null,
      authData.ad_account_name || null,
      true
    ]);

    return result[0];
  }

  /**
   * Get active Facebook auth for user
   */
  async getByUserId(userId) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = $1 AND is_active = TRUE
      LIMIT 1
    `;

    const result = await this.raw(sql, [userId]);
    return result[0] || null;
  }

  /**
   * Deactivate auth
   */
  async deactivate(userId) {
    const sql = `
      UPDATE ${this.tableName}
      SET is_active = FALSE, updated_at = NOW()
      WHERE user_id = $1
      RETURNING *
    `;

    const result = await this.raw(sql, [userId]);
    return result[0];
  }
}

module.exports = new FacebookAuth();
