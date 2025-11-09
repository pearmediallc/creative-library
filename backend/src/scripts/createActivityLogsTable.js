/**
 * Create activity_logs table
 * Tracks all important user actions in the system
 */

const { pool } = require('../config/database');

async function createActivityLogsTable() {
  try {
    console.log('🔨 Creating activity_logs table...');

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMP DEFAULT NOW(),

        -- User information
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        user_email VARCHAR(255),
        user_role VARCHAR(50),

        -- Action details
        action_type VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100),
        resource_id UUID,
        resource_name TEXT,

        -- Additional context
        details JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,

        -- Status
        status VARCHAR(50) DEFAULT 'success',
        error_message TEXT
      );

      -- Create indexes for common queries
      CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs(action_type);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_resource_type ON activity_logs(resource_type);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user_email ON activity_logs(user_email);
    `;

    await pool.query(createTableSQL);

    console.log('✅ activity_logs table created successfully');
    console.log('✅ Indexes created successfully');

    // Verify table was created
    const verifySQL = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'activity_logs'
      ORDER BY ordinal_position;
    `;

    const result = await pool.query(verifySQL);
    console.log('\n📋 Table structure:');
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating activity_logs table:', error);
    process.exit(1);
  }
}

createActivityLogsTable();
