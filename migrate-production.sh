#!/bin/bash
# ============================================
# PRODUCTION DATABASE MIGRATION SCRIPT
# ============================================

echo "🚀 Creative Library - Production Database Migration"
echo "===================================================="
echo ""

# Check if DATABASE_URL is provided
if [ -z "$1" ]; then
    echo "❌ ERROR: No database URL provided"
    echo ""
    echo "Usage: ./migrate-production.sh <PRODUCTION_DATABASE_URL>"
    echo ""
    echo "Example:"
    echo "  ./migrate-production.sh postgresql://user:pass@host:5432/dbname"
    echo ""
    echo "Get your production database URL from:"
    echo "  - Render Dashboard → Database → Connect → External Database URL"
    echo ""
    exit 1
fi

PRODUCTION_DB_URL="$1"
MIGRATION_FILE="backend/migrations/MASTER_MIGRATION_ALL_FEATURES_NO_TRANSACTION.sql"

echo "📋 Migration Details:"
echo "  Database: $(echo $PRODUCTION_DB_URL | sed 's/:\/\/.*@/:\/\/***:***@/')"
echo "  Migration File: $MIGRATION_FILE"
echo ""

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ ERROR: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "⚠️  WARNING: This will modify your PRODUCTION database!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Migration cancelled"
    exit 0
fi

echo ""
echo "🔄 Running migration on production database..."
echo ""

# Run migration
psql "$PRODUCTION_DB_URL" -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "📝 Verifying tables..."
    echo ""

    # Verify key tables exist
    psql "$PRODUCTION_DB_URL" -c "
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('folders', 'saved_searches', 'file_comments', 'file_requests')
        ORDER BY table_name;
    "

    echo ""
    echo "🎉 Production database is ready!"
    echo ""
    echo "Next steps:"
    echo "  1. Restart your Render backend service"
    echo "  2. Test the application at https://creative-library-frontend.onrender.com"
    echo ""
else
    echo ""
    echo "❌ Migration failed! Check the error messages above."
    echo ""
    echo "Common issues:"
    echo "  - Wrong database URL"
    echo "  - Network connection issues"
    echo "  - Insufficient database permissions"
    echo ""
    exit 1
fi
