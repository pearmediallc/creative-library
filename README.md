# 🎨 Creative Asset Library

A production-ready media library system with integrated Facebook campaign analytics.

## 📋 Project Overview

**Purpose:** Centralized creative asset storage with performance tracking by editor/creative team member.

**Key Features:**
- ✅ Media upload with manual editor assignment
- ✅ S3 storage with thumbnails
- ✅ Browse/filter by editor, date, file type
- ✅ Facebook campaign analytics via ad name parsing
- ✅ Ad name change tracking
- ✅ Role-based access control (Admin, Creative, Buyer)
- ✅ Integration with existing Campaign Launcher

---

## 🏗️ Architecture

```
Frontend (React)     → AWS S3 + CloudFront
Backend (Node.js)    → Render Web Service
Python Flask         → Render Web Service (same instance)
PostgreSQL           → Render Managed Database
Media Storage        → AWS S3
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- Node.js 18+
- Python 3.9+
- PostgreSQL 14+
- Docker & Docker Compose (optional but recommended)
- AWS S3 credentials

### Option 1: Docker Compose (Recommended)

```bash
# 1. Clone/navigate to project
cd /Users/mac/Desktop/creative-library

# 2. Copy environment files
cp backend/.env.example backend/.env
cp python-service/.env.example python-service/.env

# 3. Edit backend/.env with your credentials
# - Add AWS S3 credentials
# - Add Facebook app credentials
# - Keep DATABASE_URL as is for Docker

# 4. Start all services
docker-compose up -d

# 5. Check status
docker-compose ps

# 6. View logs
docker-compose logs -f backend
```

**Services will be available at:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Python Service: http://localhost:5001
- PostgreSQL: localhost:5432

### Option 2: Manual Setup

#### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Create database
createdb creative_library

# Run migrations
psql creative_library < ../database/schema.sql
psql creative_library < ../database/seeds/01_initial_data.sql

# Start server
npm run dev
```

#### Python Service Setup

```bash
cd python-service

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy metadata tagger files
cp /Users/mac/Desktop/metadata\ tagger/facebook_integration.py .
cp /Users/mac/Desktop/metadata\ tagger/facebook_api.py .
cp /Users/mac/Desktop/metadata\ tagger/.env .

# Start Flask server
python app.py
```

#### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

---

## 📁 Project Structure

```
creative-library/
├── backend/                      # Node.js + Express API
│   ├── src/
│   │   ├── config/              # Database, AWS S3 config
│   │   ├── middleware/          # Auth, error handling
│   │   ├── routes/              # API endpoints
│   │   ├── services/            # Business logic
│   │   ├── models/              # Database models
│   │   ├── utils/               # Helpers
│   │   ├── jobs/                # Cron jobs
│   │   └── server.js            # Entry point
│   ├── package.json
│   └── .env.example
│
├── frontend/                     # React + TypeScript
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── pages/               # Page components
│   │   ├── hooks/               # Custom hooks
│   │   ├── services/            # API client
│   │   └── types/               # TypeScript types
│   ├── package.json
│   └── .env.example
│
├── python-service/               # Python Flask (Facebook integration)
│   ├── facebook_integration.py  # OAuth & token management
│   ├── facebook_api.py          # Graph API client
│   ├── app.py                   # Flask server
│   └── requirements.txt
│
├── database/
│   ├── schema.sql               # PostgreSQL schema
│   └── seeds/                   # Initial data
│
├── docs/                         # Documentation
├── docker-compose.yml           # Local development
└── README.md
```

---

## 🔧 Configuration

### Backend Environment Variables

```env
# Server
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# Database (Render provides this)
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRY=7d

# AWS S3 (YOU PROVIDE)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET=your-bucket-name

# Facebook (from metadata tagger)
FB_APP_ID=735375959485927
FB_APP_SECRET=your-secret
FB_API_VERSION=v18.0
FB_REDIRECT_URI=http://localhost:3001/api/analytics/facebook/callback

# Python Service
PYTHON_SERVICE_URL=http://localhost:5001
```

### Python Service Environment

```env
# Same as metadata tagger
FB_APP_ID=735375959485927
FB_APP_SECRET=your-secret
FB_API_VERSION=v18.0
FB_REDIRECT_URI=http://localhost:5001/api/facebook/callback
ENCRYPTION_KEY=your-64-char-hex-key
```

---

## 📊 Database Setup

### Initial Migration

```bash
# Connect to your database
psql $DATABASE_URL

# Run schema
\i database/schema.sql

# Run seeds
\i database/seeds/01_initial_data.sql
```

### Seed Data

The initial seed includes:
- 4 editors: DEEP, DEEPA, DEEPANSHU, DEEPANSHUVERMA
- 1 admin user: `admin@creative-library.com` / `Admin@123` (CHANGE THIS!)

---

## 🚀 Deployment to Render

### Step 1: PostgreSQL Database

1. Go to Render Dashboard → New → PostgreSQL
2. Name: `creative-library-db`
3. Plan: Free or Starter
4. Click "Create Database"
5. Copy the "Internal Database URL" (starts with `postgresql://`)
6. Run migrations:
   ```bash
   psql <INTERNAL_DATABASE_URL> < database/schema.sql
   psql <INTERNAL_DATABASE_URL> < database/seeds/01_initial_data.sql
   ```

### Step 2: Backend + Python Service

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Settings:
   - **Name:** `creative-library-backend`
   - **Environment:** Node
   - **Build Command:** `cd backend && npm install && cd ../python-service && pip install -r requirements.txt`
   - **Start Command:** `cd backend && npm start & cd ../python-service && python app.py`
   - **Plan:** Starter ($7/month)

4. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=3001
   DATABASE_URL=<from Step 1>
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=<your-key>
   AWS_SECRET_ACCESS_KEY=<your-secret>
   AWS_S3_BUCKET=<your-bucket>
   FB_APP_ID=735375959485927
   FB_APP_SECRET=<your-secret>
   JWT_SECRET=<generate-random-string>
   ENCRYPTION_KEY=<64-char-hex-key>
   PYTHON_SERVICE_URL=http://localhost:5001
   ```

5. Click "Create Web Service"

### Step 3: Frontend (React on S3)

```bash
# Build React app
cd frontend
npm run build

# Upload to S3
aws s3 sync build/ s3://your-bucket-name/

# Setup CloudFront (optional but recommended)
# Follow AWS CloudFront documentation
```

### Step 4: Update Facebook Redirect URI

1. Go to Facebook Developers Console
2. Update OAuth Redirect URIs:
   - `https://your-backend-url.onrender.com/api/analytics/facebook/callback`

---

## 🔐 Security Checklist

- [ ] Change default admin password
- [ ] Generate strong JWT_SECRET
- [ ] Enable HTTPS on Render (automatic)
- [ ] Setup S3 bucket policies (private files)
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Setup database backups (Render auto-backups)
- [ ] Monitor logs regularly

---

## 📝 API Documentation

### Authentication

```bash
# Register
POST /api/auth/register
Body: { name, email, password }

# Login
POST /api/auth/login
Body: { email, password }
Response: { token, user }

# Get current user
GET /api/auth/me
Headers: Authorization: Bearer <token>
```

### Media Library

```bash
# Upload file
POST /api/media/upload
Headers:
  Authorization: Bearer <token>
  Content-Type: multipart/form-data
Body: { file, editor_id, tags, description }

# Browse files
GET /api/media?editor_name=DEEP&date_from=2024-01-01
Headers: Authorization: Bearer <token>

# Get file details
GET /api/media/:id
Headers: Authorization: Bearer <token>
```

### Analytics

```bash
# Analyze campaigns
POST /api/analytics/analyze
Headers: Authorization: Bearer <token>
Body: { ad_account_id, campaign_ids, date_range }

# Get ad name changes
GET /api/analytics/ad-name-changes
Headers: Authorization: Bearer <token>
```

---

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# Integration tests
npm run test:integration
```

---

## 📊 Monitoring & Logs

### View Logs on Render

1. Go to your service dashboard
2. Click "Logs" tab
3. Real-time log streaming available

### Health Check Endpoints

- Backend: `http://your-backend-url/health`
- Python: `http://your-backend-url:5001/health`

---

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Test connection
psql $DATABASE_URL

# Check if schema exists
\dt
```

### S3 Upload Fails

```bash
# Verify AWS credentials
aws s3 ls s3://your-bucket-name

# Check IAM permissions
# Ensure your IAM user has: s3:PutObject, s3:GetObject, s3:DeleteObject
```

### Facebook OAuth Fails

- Verify FB_APP_ID and FB_APP_SECRET
- Check redirect URI matches Facebook app settings
- Ensure app is in "Live" mode (not Development)

---

## 📚 Additional Resources

- [Render Deployment Guide](https://render.com/docs)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [Facebook Graph API](https://developers.facebook.com/docs/graph-api)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

## 👥 Team

- Backend: Node.js + Express
- Frontend: React + TypeScript
- Database: PostgreSQL 14
- Storage: AWS S3
- Deployment: Render + AWS

---

## 📄 License

MIT License

---

## 🆘 Support

For issues or questions:
1. Check this README
2. Check `docs/` folder
3. Review logs in Render dashboard
4. Contact system administrator

---

**Built with ❤️ for Creative Teams**
