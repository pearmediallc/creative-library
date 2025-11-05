# 🚀 QUICK SETUP GUIDE

## What We Built

A complete creative asset library with:
- ✅ **Media Upload** - S3 storage with manual editor selection
- ✅ **Browse/Filter** - Fast search by editor, date, file type
- ✅ **Facebook Analytics** - Performance tracking via ad name parsing
- ✅ **Ad Name Tracking** - Detect changes in Facebook ad names
- ✅ **Admin Dashboard** - User & editor management
- ✅ **Campaign Launcher Integration** - Reuse library assets

---

## 📦 What's Ready

### ✅ COMPLETE
1. **Database Schema** - PostgreSQL with all tables
2. **Backend Structure** - Node.js + Express skeleton
3. **Configuration Files** - .env templates, Docker Compose
4. **Documentation** - README, this guide

### ⏳ TODO (Next Steps)
1. **Backend Implementation** - Controllers, services
2. **Frontend Implementation** - React components
3. **Python Integration** - Copy metadata tagger files
4. **Testing** - End-to-end testing
5. **Deployment** - Push to Render

---

## 🎯 IMMEDIATE NEXT STEPS

### Step 1: Setup Local Environment (5 minutes)

```bash
cd /Users/mac/Desktop/creative-library

# 1. Copy environment file
cp backend/.env.example backend/.env

# 2. Edit backend/.env - ADD YOUR CREDENTIALS:
#    - AWS_ACCESS_KEY_ID
#    - AWS_SECRET_ACCESS_KEY
#    - AWS_S3_BUCKET
#    - FB_APP_SECRET
#    - JWT_SECRET (generate random string)

# 3. Install backend dependencies
cd backend
npm install
```

### Step 2: Setup Database (5 minutes)

**Option A: Docker (Easiest)**
```bash
# From project root
docker-compose up -d postgres

# Wait 10 seconds for PostgreSQL to start
sleep 10

# Run migrations
docker exec -i creative-library-db psql -U postgres creative_library < database/schema.sql
docker exec -i creative-library-db psql -U postgres creative_library < database/seeds/01_initial_data.sql
```

**Option B: Local PostgreSQL**
```bash
createdb creative_library
psql creative_library < database/schema.sql
psql creative_library < database/seeds/01_initial_data.sql
```

### Step 3: Setup Python Service (5 minutes)

```bash
cd /Users/mac/Desktop/creative-library/python-service

# Copy files from metadata tagger
cp "/Users/mac/Desktop/metadata tagger/facebook_integration.py" .
cp "/Users/mac/Desktop/metadata tagger/facebook_api.py" .
cp "/Users/mac/Desktop/metadata tagger/editor_manager.py" .
cp "/Users/mac/Desktop/metadata tagger/.env" .

# Create simple Flask app
cat > app.py << 'EOF'
from flask import Flask
from facebook_integration import facebook_auth
from facebook_api import FacebookGraphAPI
import os

app = Flask(__name__)
app.secret_key = os.getenv('SESSION_SECRET', 'dev-secret')

@app.route('/health')
def health():
    return {'status': 'healthy'}

# Import existing endpoints from metadata tagger
# ... (will add in next iteration)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(debug=True, host='0.0.0.0', port=port)
EOF

# Install dependencies
pip3 install flask flask-cors requests cryptography

# Start Flask
python3 app.py
```

### Step 4: Start Backend (2 minutes)

```bash
cd /Users/mac/Desktop/creative-library/backend

# Start development server
npm run dev

# You should see:
# 🚀 CREATIVE ASSET LIBRARY - SERVER RUNNING
# 🌐 Server: http://localhost:3001
```

### Step 5: Test (1 minute)

```bash
# Test backend
curl http://localhost:3001/health

# Expected: {"status":"healthy",...}

# Test Python service
curl http://localhost:5001/health

# Expected: {"status":"healthy"}
```

---

## 📋 Current Progress

| Component | Status | Next Action |
|-----------|--------|-------------|
| Database Schema | ✅ Complete | None |
| Backend Structure | ✅ Complete | Implement controllers |
| Frontend Structure | ⏳ TODO | Create React app |
| Python Integration | ⏳ TODO | Copy metadata tagger files |
| S3 Upload | ⏳ TODO | Implement multer-s3 |
| Authentication | ⏳ TODO | Implement JWT auth |
| Analytics | ⏳ TODO | Implement ad name parsing |
| Deployment | ⏳ TODO | Deploy to Render |

---

## 🔧 Development Workflow

### Daily Development

```bash
# Terminal 1: PostgreSQL (Docker)
docker-compose up postgres

# Terminal 2: Python Flask
cd python-service && python3 app.py

# Terminal 3: Node.js Backend
cd backend && npm run dev

# Terminal 4: React Frontend (when ready)
cd frontend && npm start
```

### Making Changes

1. **Backend API Changes**: Edit `backend/src/routes/*.js`
2. **Database Changes**: Create new migration in `database/migrations/`
3. **Frontend Changes**: Edit `frontend/src/components/*.tsx`
4. **Python Changes**: Edit `python-service/*.py`

---

## 📝 Key Files to Complete

### High Priority (Week 1)

1. **Backend Controllers**
   - `backend/src/controllers/authController.js` - Register, login, JWT
   - `backend/src/controllers/mediaController.js` - Upload, browse, delete
   - `backend/src/services/s3Service.js` - S3 upload/download

2. **Frontend Components**
   - `frontend/src/components/Library/UploadModal.tsx`
   - `frontend/src/components/Library/MediaGrid.tsx`
   - `frontend/src/components/Auth/Login.tsx`

3. **Python Integration**
   - Copy all Facebook files from metadata tagger
   - Add Flask routes for analytics

### Medium Priority (Week 2)

4. **Admin Features**
   - `backend/src/controllers/adminController.js`
   - `frontend/src/components/Admin/UserManagement.tsx`
   - `frontend/src/components/Admin/EditorManagement.tsx`

5. **Analytics**
   - `backend/src/services/adNameParser.js`
   - `backend/src/services/editorMatcher.js`
   - `frontend/src/components/Analytics/Dashboard.tsx`

### Low Priority (Week 3+)

6. **Ad Name Change Tracking**
   - `backend/src/services/adNameChangeDetector.js`
   - `backend/src/jobs/adNameChecker.js`
   - `frontend/src/components/Analytics/ChangeLog.tsx`

---

## 🐛 Common Issues

### "Cannot connect to database"
```bash
# Check if PostgreSQL is running
docker-compose ps

# Check connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL
```

### "S3 upload fails"
```bash
# Verify credentials
aws s3 ls s3://your-bucket-name

# Check bucket name in .env
cat backend/.env | grep AWS_S3_BUCKET
```

### "Python service not responding"
```bash
# Check if Flask is running
curl http://localhost:5001/health

# Check Python logs
cd python-service && python3 app.py
```

---

## 📞 Need Help?

1. **Check Logs**
   - Backend: Look at terminal output
   - Database: `docker-compose logs postgres`
   - Python: Look at Flask terminal output

2. **Verify Environment**
   ```bash
   # Check if all env vars are set
   cat backend/.env | grep -v '^#' | grep '='
   ```

3. **Database Issues**
   ```bash
   # Reset database
   docker-compose down -v
   docker-compose up -d postgres
   # Wait 10 seconds
   # Run migrations again
   ```

---

## ✅ Checklist Before Deployment

- [ ] All environment variables set in Render
- [ ] Database migrations run on production DB
- [ ] S3 bucket created and configured
- [ ] Facebook app redirect URI updated
- [ ] Admin password changed from default
- [ ] CORS origins set to production URLs
- [ ] Rate limiting enabled
- [ ] Logs monitored
- [ ] Health checks working

---

## 🎉 Success Criteria

You'll know it's working when:

1. ✅ You can register/login via API
2. ✅ You can upload a file to S3 with editor selection
3. ✅ You can browse files filtered by editor
4. ✅ Python service connects to Facebook OAuth
5. ✅ Analytics parse ad names and show editor performance
6. ✅ Admin can create users and editors

---

**Ready to continue? Let me know which part you want to build next:**

1. **Authentication & User Management**
2. **Media Upload (S3 Integration)**
3. **Frontend React Setup**
4. **Python Service Integration**
5. **Analytics Implementation**

Choose a number and I'll build it!
