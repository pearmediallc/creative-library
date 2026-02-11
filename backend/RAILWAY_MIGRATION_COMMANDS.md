# Railway Production Migration Commands

## Quick Start - Run in Railway Shell

### Option 1: Using the Migration Script (Recommended)

1. Open Railway Project → Backend Service → Shell
2. Run:

```bash
node run-production-migrations.js
```

This will:
- ✅ Run all 4 migrations in sequence
- ✅ Verify changes after completion
- ✅ Show detailed summary
- ✅ Stop on first error
- ✅ Check editor records for creative users

---

### Option 2: Manual SQL Execution via Node

If you prefer to run migrations manually, use this inline Node.js script in Railway shell:

```bash
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting migrations...\n');

    // Migration 1: Fix file_request_uploads table
    console.log('📋 Migration 1: Fixing file_request_uploads table...');
    await client.query(\`
      DO \$\$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='file_id') THEN
          ALTER TABLE file_request_uploads ADD COLUMN file_id UUID REFERENCES media_files(id) ON DELETE CASCADE;
          RAISE NOTICE '✓ Added file_id column';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='uploaded_by') THEN
          ALTER TABLE file_request_uploads ADD COLUMN uploaded_by UUID REFERENCES users(id);
          RAISE NOTICE '✓ Added uploaded_by column';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='upload_type') THEN
          ALTER TABLE file_request_uploads ADD COLUMN upload_type VARCHAR(20) CHECK (upload_type IN ('file', 'folder', 'session'));
          RAISE NOTICE '✓ Added upload_type column';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='file_count') THEN
          ALTER TABLE file_request_uploads ADD COLUMN file_count INTEGER DEFAULT 0;
          RAISE NOTICE '✓ Added file_count column';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='total_size_bytes') THEN
          ALTER TABLE file_request_uploads ADD COLUMN total_size_bytes BIGINT DEFAULT 0;
          RAISE NOTICE '✓ Added total_size_bytes column';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='editor_id') THEN
          ALTER TABLE file_request_uploads ADD COLUMN editor_id UUID REFERENCES editors(id);
          RAISE NOTICE '✓ Added editor_id column';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='comments') THEN
          ALTER TABLE file_request_uploads ADD COLUMN comments TEXT;
          RAISE NOTICE '✓ Added comments column';
        END IF;

        RAISE NOTICE '✅ file_request_uploads table schema fixed';
      END \$\$;
    \`);
    console.log('✅ Migration 1 complete\n');

    // Migration 2: Create vertical_heads table if not exists
    console.log('📋 Migration 2: Creating vertical_heads table...');
    await client.query(\`
      CREATE TABLE IF NOT EXISTS vertical_heads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vertical VARCHAR(100) NOT NULL UNIQUE,
        head_editor_id UUID REFERENCES users(id),
        fallback_editor_ids UUID[],
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    \`);
    console.log('✅ Migration 2 complete\n');

    // Migration 3: Populate vertical heads
    console.log('📋 Migration 3: Populating vertical heads...');
    await client.query(\`
      DO \$\$
      DECLARE
        aditya_id UUID;
        priya_id UUID;
        baljeet_id UUID;
        pankaj_id UUID;
        karan_id UUID;
        ritu_id UUID;
        parmeet_id UUID;
        fallback_ids UUID[];
      BEGIN
        SELECT id INTO aditya_id FROM users WHERE email = 'aditya.nawal@pearmediallc.com';
        SELECT id INTO priya_id FROM users WHERE email = 'priya.mishra@pearmediallc.com';
        SELECT id INTO baljeet_id FROM users WHERE email = 'baljeet.singh@pearmediallc.com';
        SELECT id INTO pankaj_id FROM users WHERE email = 'pankaj.jain@pearmediallc.com';
        SELECT id INTO karan_id FROM users WHERE email = 'karan.singh@pearmediallc.com';
        SELECT id INTO ritu_id FROM users WHERE email = 'ritu@pearmediallc.com';
        SELECT id INTO parmeet_id FROM users WHERE email = 'parmeet@pearmediallc.com';

        fallback_ids := ARRAY[]::UUID[];
        IF ritu_id IS NOT NULL THEN fallback_ids := array_append(fallback_ids, ritu_id); END IF;
        IF parmeet_id IS NOT NULL THEN fallback_ids := array_append(fallback_ids, parmeet_id); END IF;

        IF aditya_id IS NOT NULL THEN
          INSERT INTO vertical_heads (vertical, head_editor_id, fallback_editor_ids)
          VALUES ('bizop', aditya_id, fallback_ids)
          ON CONFLICT (vertical) DO UPDATE SET head_editor_id = EXCLUDED.head_editor_id, fallback_editor_ids = EXCLUDED.fallback_editor_ids;
          RAISE NOTICE '✓ bizop → Aditya';
        END IF;

        IF priya_id IS NOT NULL THEN
          INSERT INTO vertical_heads (vertical, head_editor_id, fallback_editor_ids)
          VALUES ('auto', priya_id, fallback_ids)
          ON CONFLICT (vertical) DO UPDATE SET head_editor_id = EXCLUDED.head_editor_id, fallback_editor_ids = EXCLUDED.fallback_editor_ids;
          RAISE NOTICE '✓ auto → Priya';

          INSERT INTO vertical_heads (vertical, head_editor_id, fallback_editor_ids)
          VALUES ('medicare', priya_id, fallback_ids)
          ON CONFLICT (vertical) DO UPDATE SET head_editor_id = EXCLUDED.head_editor_id, fallback_editor_ids = EXCLUDED.fallback_editor_ids;
          RAISE NOTICE '✓ medicare → Priya';
        END IF;

        IF baljeet_id IS NOT NULL THEN
          INSERT INTO vertical_heads (vertical, head_editor_id, fallback_editor_ids)
          VALUES ('home', baljeet_id, fallback_ids)
          ON CONFLICT (vertical) DO UPDATE SET head_editor_id = EXCLUDED.head_editor_id, fallback_editor_ids = EXCLUDED.fallback_editor_ids;
          RAISE NOTICE '✓ home → Baljeet';
        END IF;

        IF pankaj_id IS NOT NULL THEN
          INSERT INTO vertical_heads (vertical, head_editor_id, fallback_editor_ids)
          VALUES ('guns', pankaj_id, fallback_ids)
          ON CONFLICT (vertical) DO UPDATE SET head_editor_id = EXCLUDED.head_editor_id, fallback_editor_ids = EXCLUDED.fallback_editor_ids;
          RAISE NOTICE '✓ guns → Pankaj';
        END IF;

        IF karan_id IS NOT NULL THEN
          INSERT INTO vertical_heads (vertical, head_editor_id, fallback_editor_ids)
          VALUES ('refi', karan_id, fallback_ids)
          ON CONFLICT (vertical) DO UPDATE SET head_editor_id = EXCLUDED.head_editor_id, fallback_editor_ids = EXCLUDED.fallback_editor_ids;
          RAISE NOTICE '✓ refi → Karan';
        END IF;

        RAISE NOTICE '✅ Vertical heads populated';
      END \$\$;
    \`);
    console.log('✅ Migration 3 complete\n');

    // Verification
    console.log('🔍 Verifying changes...');
    const vhResult = await client.query(\`
      SELECT vh.vertical, u.name, u.email
      FROM vertical_heads vh
      LEFT JOIN users u ON vh.head_editor_id = u.id
      ORDER BY vh.vertical
    \`);
    console.log('\n📋 Vertical Heads:');
    vhResult.rows.forEach(row => {
      console.log(\`  • \${row.vertical} → \${row.name || 'NOT ASSIGNED'} (\${row.email || 'N/A'})\`);
    });

    console.log('\n✅ ALL MIGRATIONS COMPLETED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
"
```

---

### Option 3: Using Railway PostgreSQL Plugin

If you have Railway PostgreSQL plugin installed:

1. Go to Railway Project → PostgreSQL → Data
2. Click "Query" tab
3. Run each migration SQL file content directly

---

## Verification Commands

After running migrations, verify with:

```bash
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await pool.connect();

  // Check columns
  const cols = await client.query(\`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'file_request_uploads'
    ORDER BY column_name
  \`);
  console.log('file_request_uploads columns:', cols.rows.map(r => r.column_name).join(', '));

  // Check vertical heads
  const vh = await client.query('SELECT COUNT(*) FROM vertical_heads');
  console.log('Vertical heads count:', vh.rows[0].count);

  client.release();
  await pool.end();
})();
"
```

---

## Expected Results

After successful migration:

✅ **file_request_uploads table** will have columns:
- `file_id` - Links to uploaded files
- `uploaded_by` - User who uploaded
- `upload_type` - Type: file/folder/session
- `editor_id` - Assigned editor
- `comments` - Upload comments
- `file_count` - Number of files
- `total_size_bytes` - Total size

✅ **vertical_heads table** will be populated:
- bizop → Aditya
- auto → Priya
- home → Baljeet
- guns → Pankaj
- refi → Karan
- medicare → Priya

✅ **editors table** will have records for all creative users:
- Each creative user will have an editor record
- `display_name` will match their user name
- `is_active` will be TRUE
- This enables vertical assignment to work correctly

---

## Troubleshooting

### If migration fails with "relation already exists":
This is normal - the migration script handles existing tables gracefully.

### If users not found:
Check user emails in database:
```bash
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  const client = await pool.connect();
  const users = await client.query('SELECT email FROM users ORDER BY email');
  console.log('Users:', users.rows.map(r => r.email).join('\n'));
  client.release();
  await pool.end();
})();
"
```

### If vertical_heads table doesn't exist:
Run migration 2 (008_vertical_based_assignment.sql) first.

---

## Post-Migration Steps

1. **Restart Railway Service**:
   - Go to Railway Project → Backend → Settings → Restart

2. **Test File Request Upload**:
   - Create new file request
   - Upload file as creative
   - Verify file appears in upload history

3. **Test Vertical Assignment**:
   - Create request with vertical = "home"
   - Verify auto-assigned to Baljeet

4. **Test Reassignment**:
   - Vertical head reassigns with note
   - Verify new editor sees note

---

**Need Help?** Check logs in Railway dashboard or contact support.
