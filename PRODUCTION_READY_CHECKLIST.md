# 🚀 Production Ready Checklist

## ✅ Issue Resolved

**Problem**: Frontend getting 404 errors when calling API
**Root Cause**: Backend wasn't loading .env file properly, causing database connection issues
**Solution**: Fixed `.env` file path loading in `server.js` and explicit database configuration

Now everything is working:
- ✅ Backend API: http://localhost:3001
- ✅ Python Service: http://localhost:5001
- ✅ Frontend: http://localhost:3000
- ✅ Database: PostgreSQL connected
- ✅ Login/Register working

---

## 📋 Production Deployment Requirements

### 1. **Environment Configuration** (CRITICAL)

#### Backend Environment Variables
Update `backend/.env` for production:

```env
# Server
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-frontend-domain.com

# Database (Render PostgreSQL or AWS RDS)
DATABASE_URL=postgresql://user:password@host:5432/creative_library
DATABASE_POOL_SIZE=20

# JWT (MUST CHANGE!)
JWT_SECRET=<GENERATE-STRONG-SECRET-64-CHARS>
JWT_EXPIRY=7d

# AWS S3 (REQUIRED for file uploads)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<YOUR-KEY>
AWS_SECRET_ACCESS_KEY=<YOUR-SECRET>
AWS_S3_BUCKET=creative-library-prod
AWS_CLOUDFRONT_URL=https://your-cloudfront.cloudfront.net

# Facebook (for Analytics)
FB_APP_ID=735375959485927
FB_APP_SECRET=<YOUR-FACEBOOK-APP-SECRET>
FB_API_VERSION=v18.0
FB_REDIRECT_URI=https://your-backend-domain.com/api/analytics/facebook/callback

# Python Service
PYTHON_SERVICE_URL=https://your-backend-domain.com:5001

# Security
ENCRYPTION_KEY=<GENERATE-64-HEX-CHARS>
ALLOWED_ORIGINS=https://your-frontend-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Frontend Environment Variables
Update `frontend/.env`:

```env
REACT_APP_API_URL=https://your-backend-domain.com/api
```

---

### 2. **AWS S3 Setup** (REQUIRED)

#### Create S3 Bucket
```bash
# Via AWS Console or CLI
aws s3 mb s3://creative-library-prod
```

#### Configure Bucket CORS
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

#### Create IAM User
Create IAM user with permissions:
- `s3:PutObject`
- `s3:GetObject`
- `s3:DeleteObject`
- `s3:ListBucket`

Get Access Key ID and Secret Access Key for backend `.env`

#### Optional: CloudFront CDN
- Create CloudFront distribution pointing to S3 bucket
- Update `AWS_CLOUDFRONT_URL` in `.env`
- Benefits: Faster file delivery, HTTPS, caching

---

### 3. **Database Setup**

#### Option A: Render PostgreSQL (Recommended - Easy)
1. Go to Render.com → New → PostgreSQL
2. Choose plan (Free, Starter $7/mo, or Standard)
3. Copy `Internal Database URL` to `DATABASE_URL` in `.env`
4. Run migrations:
   ```bash
   psql $DATABASE_URL < database/schema.sql
   psql $DATABASE_URL < database/seeds/01_initial_data.sql
   ```

#### Option B: AWS RDS PostgreSQL
1. Create RDS PostgreSQL instance
2. Configure security group (allow backend IP)
3. Update `DATABASE_URL` in `.env`
4. Run migrations (same as above)

---

### 4. **Backend Deployment** (Render.com)

#### Automatic Deploy via render.yaml
Already configured in `render.yaml`

1. Push code to GitHub
2. Connect repository to Render
3. Render will auto-detect `render.yaml`
4. Add environment variables in Render dashboard
5. Deploy!

#### Manual Deploy Steps
```bash
# 1. Create Web Service on Render
# 2. Connect GitHub repo
# 3. Build command:
cd backend && npm install
cd ../python-service && pip install -r requirements.txt

# 4. Start command:
cd backend && npm start &
cd ../python-service && python app.py

# 5. Add ALL environment variables
```

**URL**: `https://creative-library-backend.onrender.com`

---

### 5. **Frontend Deployment** (AWS S3 + CloudFront)

#### Build React App
```bash
cd frontend
npm run build
```

#### Deploy to S3
```bash
# Create bucket for static hosting
aws s3 mb s3://creative-library-frontend

# Enable static website hosting
aws s3 website s3://creative-library-frontend \
  --index-document index.html \
  --error-document index.html

# Upload build files
aws s3 sync build/ s3://creative-library-frontend --delete

# Make public (or use CloudFront)
aws s3api put-bucket-policy --bucket creative-library-frontend --policy file://bucket-policy.json
```

#### Bucket Policy (bucket-policy.json)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::creative-library-frontend/*"
    }
  ]
}
```

#### CloudFront Setup (Recommended)
1. Create CloudFront distribution
2. Origin: S3 bucket
3. Viewer Protocol Policy: Redirect HTTP to HTTPS
4. Custom Error Response: 404 → /index.html (200)
5. Add custom domain (optional)
6. Get distribution URL: `https://d12345.cloudfront.net`

**Update frontend/.env**:
```env
REACT_APP_API_URL=https://creative-library-backend.onrender.com/api
```

Rebuild and redeploy after changing .env!

---

### 6. **Facebook App Configuration** (For Analytics)

1. Go to Facebook Developers Console
2. Update OAuth Redirect URIs:
   - `https://your-backend-domain.com/api/analytics/facebook/callback`
3. Update App Domain
4. Get App Secret → Add to `FB_APP_SECRET` in backend `.env`
5. Set app to **Live** mode

---

### 7. **Security Hardening** ⚠️

#### Generate Secure Secrets
```bash
# JWT Secret (64 chars)
openssl rand -hex 32

# Encryption Key (64 hex chars)
openssl rand -hex 32
```

Update in backend `.env`:
```env
JWT_SECRET=<generated-64-char-secret>
ENCRYPTION_KEY=<generated-64-hex-secret>
```

#### Additional Security
- [ ] Enable HTTPS everywhere
- [ ] Set secure CORS origins
- [ ] Configure rate limiting appropriately
- [ ] Review and minimize IAM permissions
- [ ] Enable database backups
- [ ] Set up monitoring/logging

---

### 8. **Testing Before Go-Live**

#### Backend API Tests
```bash
# Health check
curl https://your-backend-domain.com/health

# Register user
curl -X POST https://your-backend-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"password123"}'

# Login
curl -X POST https://your-backend-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Get editors (with token)
curl https://your-backend-domain.com/api/editors \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Frontend Tests
1. Open `https://your-frontend-domain.com`
2. Register new account
3. Login
4. Upload a test file
5. View dashboard
6. Check media library

#### File Upload Test
- Upload image (< 10MB)
- Upload video (< 500MB)
- Check S3 bucket for files
- Verify thumbnails generated
- Check presigned URLs work

---

### 9. **Monitoring & Logging**

#### Render Logs
- Access via Render dashboard
- Set up log retention
- Monitor error rates

#### Optional: Add APM Tool
- New Relic
- Datadog
- Sentry (for error tracking)

Update backend to send logs:
```bash
npm install @sentry/node
```

---

### 10. **Database Backups**

#### Render PostgreSQL
- Automatic backups included
- Can restore via dashboard

#### Manual Backup
```bash
# Backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup-20251105.sql
```

Set up cron job for daily backups if using custom DB.

---

## 🎯 Minimum Viable Production Setup

**Fastest path to production:**

### Step 1: AWS S3 (15 mins)
- Create S3 bucket
- Add IAM user with S3 access
- Configure CORS
- Update backend `.env` with AWS credentials

### Step 2: Render Backend (10 mins)
- Push code to GitHub
- Connect to Render
- Add PostgreSQL database
- Add all environment variables
- Deploy

### Step 3: Frontend (10 mins)
- Update `.env` with backend URL
- Run `npm run build`
- Upload to S3 bucket
- Access via S3 website URL

**Total**: ~35 minutes to go live!

---

## 📊 Production Checklist Summary

### Critical (MUST DO)
- [ ] Generate secure JWT_SECRET (64 chars)
- [ ] Generate secure ENCRYPTION_KEY (64 hex chars)
- [ ] Create AWS S3 bucket
- [ ] Configure S3 CORS
- [ ] Create IAM user for S3 access
- [ ] Deploy PostgreSQL (Render or AWS RDS)
- [ ] Run database migrations
- [ ] Update all environment variables
- [ ] Deploy backend to Render
- [ ] Build and deploy frontend
- [ ] Test login/register
- [ ] Test file upload

### Important (SHOULD DO)
- [ ] Set up CloudFront for frontend
- [ ] Configure Facebook app for production
- [ ] Set up custom domain
- [ ] Configure SSL certificates
- [ ] Set up database backups
- [ ] Configure monitoring
- [ ] Test all API endpoints
- [ ] Load test with realistic data

### Optional (NICE TO HAVE)
- [ ] Set up CI/CD pipeline
- [ ] Add error tracking (Sentry)
- [ ] Add analytics (Google Analytics)
- [ ] Set up email notifications
- [ ] Create admin dashboard
- [ ] Add video thumbnail generation
- [ ] Implement bulk upload
- [ ] Add export to CSV feature

---

## 💰 Estimated Monthly Cost

### Minimum Setup
- Render PostgreSQL (Free tier): **$0**
- Render Web Service (Free tier): **$0**
- AWS S3 (< 5GB): **$0.12**
- **Total**: **~$1/month**

### Recommended Setup
- Render PostgreSQL (Starter): **$7**
- Render Web Service (Starter): **$7**
- AWS S3 (50GB): **$1.15**
- CloudFront (100GB transfer): **$8.50**
- **Total**: **~$24/month**

### Scale-Up Setup
- Render PostgreSQL (Standard): **$50**
- Render Web Service (Standard): **$25**
- AWS S3 (500GB): **$11.50**
- CloudFront (1TB transfer): **$85**
- **Total**: **~$172/month**

---

## 🎉 You're Ready!

Your Creative Asset Library is **production-ready** with:

✅ Secure authentication with JWT
✅ File upload to S3 with thumbnails
✅ PostgreSQL database with proper schema
✅ Facebook ad analytics integration
✅ Ad name change tracking
✅ Clean, maintainable codebase
✅ Complete API with 21+ endpoints
✅ Modern React frontend
✅ Full documentation

**Next**: Follow the checklist above to deploy to production!

Good luck! 🚀
