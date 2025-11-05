# Deployment Checklist

## Pre-Deployment

### 1. Environment Variables

Create `.env` file with all required variables:

```bash
# Node.js Backend
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/creative_library
JWT_SECRET=your-secure-secret-key-min-32-chars
JWT_EXPIRY=7d

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET=your-bucket-name
AWS_CLOUDFRONT_URL=https://your-cloudfront-domain.com

# Facebook App
FB_APP_ID=735375959485927
FB_APP_SECRET=your-app-secret
FB_REDIRECT_URI=https://your-domain.com/api/facebook/callback
FB_API_VERSION=v18.0

# Python Service
PYTHON_SERVICE_URL=http://localhost:5001
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# CORS
FRONTEND_URL=https://your-frontend-domain.com
```

### 2. Database Setup

```bash
# Connect to PostgreSQL
psql $DATABASE_URL

# Run schema
\i database/schema.sql

# Run initial data
\i database/seeds/01_initial_data.sql
```

### 3. AWS S3 Bucket Configuration

- Create S3 bucket
- Enable versioning
- Configure CORS:
  ```json
  [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedOrigins": ["https://your-frontend-domain.com"],
      "ExposeHeaders": ["ETag"]
    }
  ]
  ```
- Set up CloudFront distribution (optional)

### 4. Facebook App Configuration

- Go to Facebook Developer Console
- Update OAuth redirect URIs
- Verify app permissions:
  - ads_management
  - ads_read
  - business_management
  - pages_show_list
  - pages_read_engagement

## Render Deployment

### 1. Create PostgreSQL Database

```bash
# In Render Dashboard
1. New PostgreSQL instance
2. Name: creative-library-db
3. Plan: Starter ($7/month) or Free
4. Save connection string
```

### 2. Create Web Service

```yaml
# render.yaml (already in repo)
services:
  - type: web
    name: creative-library-backend
    env: node
    region: oregon
    plan: starter
    buildCommand: |
      cd backend && npm install
      cd ../python-service && pip install -r requirements.txt
    startCommand: |
      cd backend && npm start &
      cd ../python-service && python app.py
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: creative-library-db
          property: connectionString
      # Add all other env vars from step 1
```

### 3. Deploy

```bash
# Connect GitHub repo to Render
# Or manual deploy:
git push origin main

# Render will auto-deploy from render.yaml
```

## AWS S3 + CloudFront for React Frontend

### 1. Build React App

```bash
cd frontend
npm run build
```

### 2. Create S3 Bucket for Static Hosting

```bash
aws s3 mb s3://your-frontend-bucket
aws s3 website s3://your-frontend-bucket \
  --index-document index.html \
  --error-document index.html
```

### 3. Upload Build Files

```bash
aws s3 sync build/ s3://your-frontend-bucket --delete
```

### 4. Create CloudFront Distribution

```bash
# In AWS Console:
1. Create CloudFront distribution
2. Origin: S3 bucket
3. Viewer Protocol Policy: Redirect HTTP to HTTPS
4. Alternate Domain Names: your-domain.com
5. SSL Certificate: Request/import certificate
6. Default Root Object: index.html
7. Error Pages: Custom Error Response 404 -> /index.html (200)
```

### 5. Update DNS

```bash
# Add CNAME or Alias record:
your-domain.com -> CloudFront distribution domain
```

## Post-Deployment

### 1. Health Checks

```bash
# Backend health
curl https://your-backend.onrender.com/health

# Python service health
curl https://your-backend.onrender.com:5001/health

# Frontend
curl https://your-frontend-domain.com
```

### 2. Create Admin User

```bash
# Via psql or database client
INSERT INTO users (
  id, name, email, password_hash, role, is_active
) VALUES (
  gen_random_uuid(),
  'Admin User',
  'admin@yourdomain.com',
  '$2a$10$...',  -- bcrypt hash of your password
  'admin',
  true
);
```

Or use registration endpoint:

```bash
curl -X POST https://your-backend.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@yourdomain.com",
    "password": "your-secure-password",
    "role": "admin"
  }'
```

### 3. Seed Initial Editors

Already done via `database/seeds/01_initial_data.sql`:
- DEEP
- DEEPA
- DEEPANSHU
- DEEPANSHUVERMA

### 4. Test All Endpoints

Use [API_TEST_GUIDE.md](./API_TEST_GUIDE.md) to verify:
- ✅ Authentication works
- ✅ File upload works
- ✅ S3 presigned URLs work
- ✅ Facebook OAuth flow works
- ✅ Analytics sync works

### 5. Enable Monitoring

```bash
# Add application monitoring (optional)
# - New Relic
# - Datadog
# - Sentry for error tracking
```

### 6. Set up Cron Jobs (Ad Name Change Detection)

If deploying on a platform that supports cron:

```bash
# Add to backend/src/cron/adNameChangeDetector.js
const cron = require('node-cron');

// Run every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('Running ad name change detection...');
  // Call analytics service to re-sync ads
});
```

Or use external cron service (cron-job.org, EasyCron):

```bash
# Hit this endpoint every 6 hours
POST https://your-backend.onrender.com/api/analytics/sync
Authorization: Bearer SERVICE_ACCOUNT_TOKEN
```

## Security Checklist

- [ ] JWT_SECRET is strong (min 32 characters)
- [ ] Database uses SSL connection
- [ ] S3 bucket is NOT publicly accessible
- [ ] CORS is configured correctly
- [ ] Environment variables are not committed to Git
- [ ] Rate limiting is enabled
- [ ] Helmet.js is configured
- [ ] Facebook App Secret is secure
- [ ] Encryption key for tokens is secure

## Troubleshooting

### Backend won't start
- Check DATABASE_URL is correct
- Verify all environment variables are set
- Check Render logs

### File upload fails
- Verify AWS credentials
- Check S3 bucket exists and permissions
- Test presigned URL generation

### Facebook OAuth fails
- Verify FB_APP_ID and FB_APP_SECRET
- Check redirect URI matches Facebook app settings
- Ensure app is in production mode

### Database connection fails
- Check DATABASE_URL format
- Verify PostgreSQL is running
- Check network/firewall rules

## Rollback Plan

```bash
# If deployment fails:
1. Revert to previous Git commit
2. Redeploy via Render dashboard
3. Or use Render's rollback feature
```

## Maintenance

### Database Backups
```bash
# Render provides automatic backups
# Or manual backup:
pg_dump $DATABASE_URL > backup.sql
```

### Update Dependencies
```bash
# Backend
cd backend && npm update

# Python
cd python-service && pip install -r requirements.txt --upgrade
```

### Monitor Storage Usage
```bash
# Check S3 bucket size
aws s3 ls s3://your-bucket --recursive --summarize

# Check database size
SELECT pg_size_pretty(pg_database_size('creative_library'));
```
