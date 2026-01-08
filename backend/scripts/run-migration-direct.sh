#!/bin/bash

# ============================================
# DIRECT DATABASE MIGRATION RUNNER
# Runs migration using DATABASE_URL directly from environment
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MIGRATION_FILE="$1"

if [ -z "$MIGRATION_FILE" ]; then
  echo -e "${RED}Usage: $0 <migration-file>${NC}"
  echo "Example: $0 ../migrations/COMPLETE_MIGRATION_SCRIPT.sql"
  exit 1
fi

if [ ! -f "$MIGRATION_FILE" ]; then
  echo -e "${RED}Error: Migration file not found: $MIGRATION_FILE${NC}"
  exit 1
fi

# Check if DATABASE_URL is set in environment
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
  echo "Please set it with: export DATABASE_URL=your_database_url"
  exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Running Migration${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}File: $MIGRATION_FILE${NC}"
echo -e "${BLUE}Database: $(echo $DATABASE_URL | sed 's/:.*/:[HIDDEN]/')${NC}"
echo ""

# Run migration
echo -e "${YELLOW}Executing migration...${NC}"
if psql "$DATABASE_URL" -f "$MIGRATION_FILE" -v ON_ERROR_STOP=1; then
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}✓ Migration completed successfully!${NC}"
  echo -e "${GREEN}========================================${NC}"
  exit 0
else
  echo ""
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}✗ Migration failed${NC}"
  echo -e "${RED}========================================${NC}"
  exit 1
fi
