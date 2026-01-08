# Database Migration Scripts

Shell scripts for managing PostgreSQL database migrations directly from the command line.

## Available Scripts

### 1. `run-migration.sh` - Run Database Migrations

Execute SQL migration files against your PostgreSQL database.

**Usage:**
```bash
# Run a specific migration file
./run-migration.sh -f ../migrations/COMPLETE_MIGRATION_SCRIPT.sql

# Run all migrations in the migrations directory
./run-migration.sh --all

# Use custom .env file
./run-migration.sh -f migration.sql -e /path/to/.env

# Show help
./run-migration.sh --help
```

**Options:**
- `-f, --file <file>` - Migration SQL file to run (required unless using --all)
- `-e, --env <file>` - Path to .env file (default: ../.env)
- `-a, --all` - Run all migrations in ../migrations/ directory
- `-h, --help` - Show help message

**Features:**
- Loads DATABASE_URL from .env file automatically
- Color-coded output (green for success, red for errors)
- Stops on first error (`ON_ERROR_STOP=1`)
- Summary report when running all migrations

### 2. `create-migration.sh` - Create New Migration

Generate a new timestamped migration file with template.

**Usage:**
```bash
# Create a new migration
./create-migration.sh add_user_roles

# This creates: migrations/20260108120000_add_user_roles.sql
```

**Features:**
- Auto-generates timestamp prefix
- Creates migration from template with examples
- Provides instructions for running the migration

### 3. `check-db.sh` - Database Connection Test

Test database connection and view database information.

**Usage:**
```bash
# Check database connection with default .env
./check-db.sh

# Use custom .env file
./check-db.sh -e /path/to/.env
```

**Shows:**
- Database connection status
- PostgreSQL version
- List of all tables with sizes
- Migration status (which key tables exist)

## Quick Start

### First Time Setup

1. **Make scripts executable** (already done):
   ```bash
   chmod +x *.sh
   ```

2. **Ensure .env file exists** with DATABASE_URL:
   ```bash
   # In backend/.env
   DATABASE_URL=postgresql://user:password@host:5432/database
   ```

3. **Test database connection**:
   ```bash
   cd backend/scripts
   ./check-db.sh
   ```

### Running the Initial Migration

```bash
cd backend/scripts
./run-migration.sh -f ../migrations/COMPLETE_MIGRATION_SCRIPT.sql
```

### Creating a New Migration

```bash
cd backend/scripts
./create-migration.sh add_new_feature
# Edit the generated file in migrations/
./run-migration.sh -f ../migrations/TIMESTAMP_add_new_feature.sql
```

## NPM Scripts Integration

You can also run these from the backend directory using npm:

```bash
# Run complete migration
npm run migrate

# Check database connection
npm run db:check

# Create new migration
npm run migration:create add_new_feature

# Run all migrations
npm run migration:run-all
```

## Requirements

- **PostgreSQL client tools** (`psql` command must be available)
  - macOS: `brew install postgresql`
  - Ubuntu/Debian: `apt-get install postgresql-client`
  - Windows: Install PostgreSQL or use WSL

- **Environment Variables** in `.env`:
  ```
  DATABASE_URL=postgresql://user:password@host:5432/database
  ```

## Troubleshooting

### "psql: command not found"

Install PostgreSQL client:
```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# Or use full path
/usr/local/bin/psql
```

### "DATABASE_URL not found in environment"

Make sure `.env` file exists in `backend/` directory with valid DATABASE_URL.

### Connection refused

1. Check if PostgreSQL is running
2. Verify connection details in DATABASE_URL
3. Check firewall/network settings
4. For Render/remote databases, ensure IP is whitelisted

### Migration fails partway through

Migrations use transactions (BEGIN/COMMIT), so failed migrations are rolled back. Fix the SQL and run again.

## Migration Best Practices

1. **Always use idempotent migrations**:
   ```sql
   CREATE TABLE IF NOT EXISTS ...

   DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM ...) THEN
       ALTER TABLE ...
     END IF;
   END $$;
   ```

2. **Test locally first** before running on production

3. **Backup database** before major migrations:
   ```bash
   pg_dump "$DATABASE_URL" > backup.sql
   ```

4. **Use descriptive migration names**:
   - Good: `add_user_roles_table`
   - Bad: `migration1`

5. **Keep migrations small and focused** - one feature per migration

## Examples

### Example 1: Run Initial Setup
```bash
cd backend/scripts
./check-db.sh                                    # Verify connection
./run-migration.sh -f ../migrations/COMPLETE_MIGRATION_SCRIPT.sql
./check-db.sh                                    # Verify tables created
```

### Example 2: Create Custom Migration
```bash
cd backend/scripts
./create-migration.sh add_user_preferences
# Edit migrations/TIMESTAMP_add_user_preferences.sql
./run-migration.sh -f ../migrations/TIMESTAMP_add_user_preferences.sql
```

### Example 3: Production Deployment
```bash
# Use production .env
./run-migration.sh -f ../migrations/COMPLETE_MIGRATION_SCRIPT.sql -e .env.production
```

## Security Notes

- Never commit `.env` files with real credentials
- Use environment-specific .env files for different environments
- Consider using connection pooling for production
- Review migration SQL before running on production databases

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review PostgreSQL logs
3. Verify .env file configuration
4. Test with `./check-db.sh` first
