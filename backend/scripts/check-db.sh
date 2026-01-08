#!/bin/bash

# ============================================
# DATABASE CONNECTION CHECKER
# Test PostgreSQL connection and show database info
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ENV_FILE="../.env"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -e|--env)
      ENV_FILE="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Load environment variables
if [ -f "$ENV_FILE" ]; then
  echo -e "${BLUE}Loading environment from $ENV_FILE${NC}"
  export $(grep -v '^#' "$ENV_FILE" | xargs)
else
  echo -e "${RED}Error: Environment file not found at $ENV_FILE${NC}"
  exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}Error: DATABASE_URL not found in environment${NC}"
  exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Database Connection Test${NC}"
echo -e "${BLUE}========================================${NC}"

# Test connection
if psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Database connection successful${NC}"
else
  echo -e "${RED}✗ Database connection failed${NC}"
  exit 1
fi

# Get database info
echo ""
echo -e "${BLUE}Database Information:${NC}"
psql "$DATABASE_URL" << 'EOF'
SELECT
  current_database() as database,
  current_user as user,
  version() as version;
EOF

# List all tables
echo ""
echo -e "${BLUE}Tables in database:${NC}"
psql "$DATABASE_URL" << 'EOF'
SELECT
  schemaname as schema,
  tablename as table,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename;
EOF

# Check for migration-related tables
echo ""
echo -e "${BLUE}Migration Status Check:${NC}"
psql "$DATABASE_URL" << 'EOF'
-- Check if key tables exist
SELECT
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
    THEN '✓' ELSE '✗' END || ' users',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'media_files')
    THEN '✓' ELSE '✗' END || ' media_files',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'metadata_tags')
    THEN '✓' ELSE '✗' END || ' metadata_tags',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'media_file_tags')
    THEN '✓' ELSE '✗' END || ' media_file_tags',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'file_requests')
    THEN '✓' ELSE '✗' END || ' file_requests';
EOF

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Database check complete${NC}"
echo -e "${BLUE}========================================${NC}"
