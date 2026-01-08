# Backend Setup & Connection Guide

Complete guide to set up and connect your Creative Library backend.

---

## 📋 Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **PostgreSQL**: Database (local or cloud like Render, Supabase, etc.)
- **AWS Account**: For S3 file storage (optional but recommended)

---

## 🚀 Quick Setup (5 Minutes)

### Step 1: Install Dependencies

```bash
cd /Users/mac/Desktop/creative-library/backend
npm install
```

### Step 2: Configure Environment Variables

Create a `.env` file in the backend directory:

```bash
cp .env.example .env
```

Then edit `.env` with your actual values:

```env
# ============================================
# REQUIRED - DATABASE CONNECTION
# ============================================
DATABASE_URL=postgresql://username:password@localhost:5432/creative_library

# Or if using Render/Cloud PostgreSQL:
# DATABASE_URL=postgresql://user:pass@dpg-xxxxx.oregon-postgres.render.com/dbname

# ============================================
# REQUIRED - JWT AUTHENTICATION
# ============================================
JWT_SECRET=your-super-secret-key-change-this-to-something-random

# ============================================
# REQUIRED - AWS S3 STORAGE
# ============================================
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_S3_BUCKET=your-bucket-name
AWS_CLOUDFRONT_URL=https://dxxxxx.cloudfront.net

# ============================================
# OPTIONAL - Advanced Features
# ============================================
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
REDTRACK_API_KEY=your-redtrack-api-key
REDTRACK_TRACKING_DOMAIN=track.yourdomain.com
```

### Step 3: Set Up Database

**Option A: Using pgAdmin (GUI)**
1. Open pgAdmin
2. Connect to your PostgreSQL server
3. Right-click on your database → **Query Tool**
4. Open and run: `/Users/mac/Desktop/creative-library/backend/migrations/COMPLETE_MIGRATION_SCRIPT.sql`
5. Verify: Look for ✓ success messages

**Option B: Using psql (Command Line)**
```bash
psql -h localhost -U your_username -d creative_library -f backend/migrations/COMPLETE_MIGRATION_SCRIPT.sql
```

### Step 4: Start the Backend

```bash
npm run dev
```

You should see:
```
INFO: Server running on port 3001
INFO: Database connection pool initialized
INFO: API routes registered
```

### Step 5: Verify Connection

Open your browser: http://localhost:3001

You should see:
```json
{
  "name": "Creative Asset Library API",
  "version": "1.0.0",
  "status": "running",
  "timestamp": "2024-01-16T..."
}
```

---

## 🗄️ Database Setup Details

### Option 1: Local PostgreSQL

**Install PostgreSQL:**
```bash
# macOS
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb creative_library
```

**Connection String:**
```env
DATABASE_URL=postgresql://localhost:5432/creative_library
```

### Option 2: Render PostgreSQL (Recommended for Cloud)

1. Go to [render.com](https://render.com)
2. Create new PostgreSQL database
3. Copy the **External Database URL**
4. Paste into `.env` as `DATABASE_URL`

### Option 3: Supabase PostgreSQL

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Go to **Settings** → **Database** → **Connection string**
4. Copy **Direct connection** URL
5. Paste into `.env` as `DATABASE_URL`

---

## ☁️ AWS S3 Setup (File Storage)

### Step 1: Create S3 Bucket

1. Go to [AWS S3 Console](https://s3.console.aws.amazon.com/)
2. Click **Create bucket**
3. Bucket name: `your-creative-library` (must be globally unique)
4. Region: `us-east-1` (or your preferred region)
5. **Block Public Access**: Keep enabled (we'll use signed URLs)
6. Click **Create bucket**

### Step 2: Configure CORS

1. Go to your bucket → **Permissions** → **CORS**
2. Add this configuration:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["http://localhost:3000", "http://localhost:3001"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### Step 3: Create IAM User

1. Go to [IAM Console](https://console.aws.amazon.com/iam/)
2. Click **Users** → **Create user**
3. Username: `creative-library-uploader`
4. Click **Next** → **Attach policies directly**
5. Click **Create policy** → **JSON** tab:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-creative-library/*",
        "arn:aws:s3:::your-creative-library"
      ]
    }
  ]
}
```

6. Name: `CreativeLibraryS3Access`
7. Attach this policy to your user
8. Go to **Security credentials** → **Create access key**
9. Choose **Application running on AWS compute service**
10. Copy `Access Key ID` and `Secret Access Key` to your `.env`

### Step 4: (Optional) CloudFront CDN

1. Go to [CloudFront Console](https://console.aws.amazon.com/cloudfront/)
2. Click **Create distribution**
3. Origin domain: Select your S3 bucket
4. Origin access: **Origin access control settings**
5. Create OAC → Default settings
6. Copy distribution domain: `dxxxxx.cloudfront.net`
7. Add to `.env` as `AWS_CLOUDFRONT_URL`

---

## 🔐 Environment Variables Explained

### Critical Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secret key for JWT tokens (use a random string) | `my-super-secret-key-123` |
| `AWS_ACCESS_KEY_ID` | AWS IAM access key | `AKIAXXXXXXXXXXXXXXXX` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key | `wJalrXUtnFEMI/K7MDENG/...` |
| `AWS_S3_BUCKET` | Your S3 bucket name | `creative-library-media` |
| `AWS_REGION` | AWS region | `us-east-1` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | `3001` |
| `NODE_ENV` | Environment mode | `development` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `AWS_CLOUDFRONT_URL` | CloudFront CDN URL | (empty) |
| `FACEBOOK_APP_ID` | Facebook app ID for ads | (empty) |
| `FACEBOOK_APP_SECRET` | Facebook app secret | (empty) |
| `REDTRACK_API_KEY` | RedTrack analytics key | (empty) |

---

## 🧪 Testing Your Setup

### 1. Test Database Connection

```bash
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()').then(res => {
  console.log('✓ Database connected:', res.rows[0].now);
  process.exit(0);
}).catch(err => {
  console.error('✗ Database error:', err.message);
  process.exit(1);
});
"
```

### 2. Test API Endpoints

```bash
# Health check
curl http://localhost:3001/health

# Register test user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "role": "buyer"
  }'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 3. Test File Upload

```bash
# Get auth token from login response
TOKEN="your-jwt-token-here"

# Upload test file
curl -X POST http://localhost:3001/api/media/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/test-image.jpg"
```

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.js          # Database connection pool
│   ├── controllers/             # Request handlers
│   │   ├── authController.js
│   │   ├── mediaController.js
│   │   ├── metadataTagController.js
│   │   └── ...
│   ├── models/                  # Database models
│   │   ├── User.js
│   │   ├── MediaFile.js
│   │   ├── MetadataTag.js
│   │   └── ...
│   ├── routes/                  # API routes
│   │   ├── auth.js
│   │   ├── media.js
│   │   ├── metadataTags.js
│   │   └── ...
│   ├── middleware/              # Express middleware
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── services/                # Business logic
│   │   ├── mediaService.js
│   │   └── metadataService.js
│   ├── utils/                   # Utilities
│   │   └── logger.js
│   └── server.js               # Main entry point
├── migrations/                  # Database migrations
│   └── COMPLETE_MIGRATION_SCRIPT.sql
├── .env                        # Your environment variables
├── .env.example               # Template
└── package.json
```

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to database"

**Solution:**
```bash
# Check PostgreSQL is running
brew services list | grep postgresql

# Or for system PostgreSQL
pg_ctl status

# Test connection manually
psql -h localhost -U postgres -d creative_library
```

### Issue: "AWS credentials error"

**Solution:**
1. Verify IAM user has S3 permissions
2. Check access key is correct in `.env`
3. Test AWS CLI: `aws s3 ls s3://your-bucket-name`

### Issue: "Port 3001 already in use"

**Solution:**
```bash
# Find and kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or change port in .env
PORT=3002
```

### Issue: "Module not found"

**Solution:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: "JWT token invalid"

**Solution:**
- Make sure `JWT_SECRET` in backend `.env` is set
- Frontend and backend must use same secret
- Clear browser localStorage and login again

---

## 🔄 Development Workflow

### Running Backend in Development

```bash
# Start with auto-reload
npm run dev

# Start without auto-reload
npm start
```

### Running Database Migrations

```bash
# Using pgAdmin: Open COMPLETE_MIGRATION_SCRIPT.sql and execute

# Using psql:
psql -h localhost -U postgres -d creative_library \
  -f backend/migrations/COMPLETE_MIGRATION_SCRIPT.sql
```

### Checking Logs

```bash
# View logs
tail -f logs/app.log

# Or check console output when running npm run dev
```

---

## 🌐 Connecting Frontend to Backend

### Frontend Configuration

Edit `frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:3001/api
```

### CORS Configuration

Backend automatically allows `http://localhost:3000` for development.

For production, add your domain to `.env`:

```env
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

---

## 🚢 Production Deployment

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@production-host:5432/db
JWT_SECRET=super-random-secret-key-production
FRONTEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com
AWS_CLOUDFRONT_URL=https://dxxxxx.cloudfront.net
```

### Deployment Platforms

**Render:**
1. Connect GitHub repo
2. Add environment variables in dashboard
3. Deploy automatically on push

**Railway:**
1. Connect GitHub repo
2. Add PostgreSQL plugin
3. Set environment variables
4. Deploy

**AWS EC2:**
1. Install Node.js and PM2
2. Clone repo
3. Set environment variables
4. Run with PM2: `pm2 start src/server.js`

---

## 📞 Support

If you encounter issues:

1. Check logs: `tail -f logs/app.log`
2. Verify `.env` variables are set correctly
3. Test database connection with `psql`
4. Check AWS credentials with AWS CLI
5. Review error messages in console

---

## ✅ Checklist

- [ ] Node.js v18+ installed
- [ ] PostgreSQL database created
- [ ] `.env` file configured
- [ ] Database migration executed successfully
- [ ] AWS S3 bucket created and configured
- [ ] IAM user with S3 permissions created
- [ ] Backend starts without errors (`npm run dev`)
- [ ] Health endpoint returns 200 (`curl http://localhost:3001/health`)
- [ ] Can register and login user
- [ ] Frontend `.env` points to correct backend URL

---

**Your backend should now be fully connected and operational! 🎉**
