#!/bin/bash

# ============================================
# CREATE NEW MIGRATION SCRIPT
# Generate a new timestamped migration file
# ============================================

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get migration name from argument
MIGRATION_NAME=$1

if [ -z "$MIGRATION_NAME" ]; then
  echo "Usage: ./create-migration.sh <migration_name>"
  echo "Example: ./create-migration.sh add_user_roles"
  exit 1
fi

# Create migrations directory if it doesn't exist
MIGRATIONS_DIR="../migrations"
mkdir -p "$MIGRATIONS_DIR"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d%H%M%S)

# Create migration filename
FILENAME="${MIGRATIONS_DIR}/${TIMESTAMP}_${MIGRATION_NAME}.sql"

# Create migration template
cat > "$FILENAME" << 'EOF'
-- ============================================
-- Migration: MIGRATION_NAME
-- Created: TIMESTAMP
-- ============================================

BEGIN;

-- Your migration SQL here

-- Example: Create a new table
-- CREATE TABLE IF NOT EXISTS example_table (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   name VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- Example: Add a column
-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM information_schema.columns
--     WHERE table_name='your_table' AND column_name='new_column'
--   ) THEN
--     ALTER TABLE your_table ADD COLUMN new_column VARCHAR(255);
--   END IF;
-- END $$;

-- Example: Create an index
-- CREATE INDEX IF NOT EXISTS idx_table_column ON table_name(column_name);

COMMIT;

-- Verification query
SELECT 'Migration completed successfully!' as status;
EOF

# Replace placeholders
sed -i '' "s/MIGRATION_NAME/$MIGRATION_NAME/g" "$FILENAME"
sed -i '' "s/TIMESTAMP/$(date)/g" "$FILENAME"

echo -e "${GREEN}✓ Migration file created:${NC} $FILENAME"
echo -e "${BLUE}Edit the file to add your migration SQL, then run:${NC}"
echo -e "  ./run-migration.sh -f $FILENAME"
