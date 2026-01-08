#!/bin/bash

# ============================================
# DATABASE MIGRATION RUNNER
# Run PostgreSQL migrations from the command line
# ============================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
MIGRATION_FILE=""
ENV_FILE="../.env"

# Help function
show_help() {
  echo "Usage: ./run-migration.sh [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  -f, --file <file>      Migration SQL file to run (required)"
  echo "  -e, --env <file>       Path to .env file (default: ../.env)"
  echo "  -a, --all              Run all migrations in ../migrations/ directory"
  echo "  -h, --help             Show this help message"
  echo ""
  echo "Examples:"
  echo "  ./run-migration.sh -f ../migrations/COMPLETE_MIGRATION_SCRIPT.sql"
  echo "  ./run-migration.sh --all"
  echo "  ./run-migration.sh -f migration.sql -e /path/to/.env"
  echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -f|--file)
      MIGRATION_FILE="$2"
      shift 2
      ;;
    -e|--env)
      ENV_FILE="$2"
      shift 2
      ;;
    -a|--all)
      RUN_ALL=true
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo -e "${RED}Error: Unknown option $1${NC}"
      show_help
      exit 1
      ;;
  esac
done

# Load environment variables
if [ -f "$ENV_FILE" ]; then
  echo -e "${BLUE}Loading environment from $ENV_FILE${NC}"
  set -a
  source "$ENV_FILE"
  set +a
else
  echo -e "${RED}Error: Environment file not found at $ENV_FILE${NC}"
  exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}Error: DATABASE_URL not found in environment${NC}"
  exit 1
fi

# Function to run a single migration
run_migration() {
  local file=$1
  echo -e "${YELLOW}Running migration: $file${NC}"

  if [ ! -f "$file" ]; then
    echo -e "${RED}Error: Migration file not found: $file${NC}"
    return 1
  fi

  # Run the migration using psql
  psql "$DATABASE_URL" -f "$file" -v ON_ERROR_STOP=1

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Migration completed successfully: $file${NC}"
    return 0
  else
    echo -e "${RED}✗ Migration failed: $file${NC}"
    return 1
  fi
}

# Main execution
if [ "$RUN_ALL" = true ]; then
  # Run all migrations in the migrations directory
  MIGRATIONS_DIR="../migrations"

  if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo -e "${RED}Error: Migrations directory not found at $MIGRATIONS_DIR${NC}"
    exit 1
  fi

  echo -e "${BLUE}Running all migrations from $MIGRATIONS_DIR${NC}"

  # Find all .sql files and run them
  migration_count=0
  success_count=0

  for migration in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$migration" ]; then
      ((migration_count++))
      if run_migration "$migration"; then
        ((success_count++))
      fi
    fi
  done

  echo ""
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}Migration Summary:${NC}"
  echo -e "${BLUE}  Total: $migration_count${NC}"
  echo -e "${GREEN}  Success: $success_count${NC}"
  echo -e "${RED}  Failed: $((migration_count - success_count))${NC}"
  echo -e "${BLUE}========================================${NC}"

  if [ $success_count -eq $migration_count ]; then
    exit 0
  else
    exit 1
  fi

elif [ -n "$MIGRATION_FILE" ]; then
  # Run single migration file
  run_migration "$MIGRATION_FILE"
  exit $?
else
  echo -e "${RED}Error: No migration file specified${NC}"
  echo ""
  show_help
  exit 1
fi
