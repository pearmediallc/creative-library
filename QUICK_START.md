# Quick Start Guide

## Complete System Overview

You now have a **full-stack Creative Asset Library** with:

### Backend (Node.js + Express)
- User authentication with JWT
- Media file upload to S3
- Editor management
- Facebook ad analytics
- Admin panel
- PostgreSQL database

### Python Service (Flask)
- Facebook OAuth integration
- Graph API client
- Reuses code from metadata tagger

### Frontend (React + TypeScript)
- Modern UI with custom theme
- Dashboard with stats
- Media library with upload
- Authentication pages
- Responsive design

---

## 🚀 Start Everything

### Option 1: Docker (Recommended for Quick Start)

```bash
# From project root
docker-compose up
```

This starts:
- PostgreSQL on port 5432
- Backend on port 3001
- Python service on port 5001
- Frontend on port 3000

Then open: **http://localhost:3000**

### Option 2: Manual Start (For Development)

**Terminal 1 - Database:**
```bash
docker-compose up postgres
```

**Terminal 2 - Backend:**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

**Terminal 3 - Python Service:**
```bash
cd python-service
pip install -r requirements.txt
python app.py
```

**Terminal 4 - Frontend:**
```bash
cd frontend
npm install
npm start
```

Then open: **http://localhost:3000**

---

## ✅ First Time Setup

### 1. Database Setup

```bash
# Make sure PostgreSQL is running
docker-compose up -d postgres

# Run migrations
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/creative_library"
psql $DATABASE_URL < database/schema.sql
psql $DATABASE_URL < database/seeds/01_initial_data.sql
```

### 2. Environment Variables

**Backend (.env):**
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/creative_library
JWT_SECRET=your-secret-key-at-least-32-characters-long
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_S3_BUCKET=your-bucket-name
FB_APP_ID=735375959485927
FB_APP_SECRET=your-facebook-app-secret
PYTHON_SERVICE_URL=http://localhost:5001
```

**Frontend (.env):**
```env
REACT_APP_API_URL=http://localhost:3001/api
```

### 3. AWS S3 Setup

1. Create an S3 bucket
2. Add IAM credentials with S3 access
3. Update `.env` with credentials

---

## 📱 Using the Application

### 1. Register an Account

1. Open http://localhost:3000
2. Click "Sign up"
3. Fill in your details
4. You'll be logged in automatically

### 2. Upload Your First File

1. Go to "Media Library" from sidebar
2. Click "Upload File"
3. Select an image or video
4. Choose an editor from dropdown (DEEP, DEEPA, etc.)
5. Add tags (optional)
6. Click "Upload"

### 3. View Analytics

1. Click "Dashboard" in sidebar
2. See storage stats and editor performance
3. (Optional) Sync Facebook ads via Analytics page

---

## 🎨 Theme

Your custom theme is applied with:
- **Primary**: Purple/indigo
- **Secondary**: Yellow/gold
- **Accent**: Blue-gray
- Light and dark mode support

To toggle dark mode, add this button to any component:
```tsx
<button onClick={() => document.documentElement.classList.toggle('dark')}>
  Toggle Dark Mode
</button>
```

---

## 📚 Documentation

- [README.md](./README.md) - Project overview
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Detailed setup
- [API_TEST_GUIDE.md](./API_TEST_GUIDE.md) - API testing
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - Production deployment
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - What was built

---

## 🔥 Quick Commands

```bash
# Install all dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd python-service && pip install -r requirements.txt && cd ..

# Start all services (separate terminals)
docker-compose up postgres
cd backend && npm run dev
cd python-service && python app.py
cd frontend && npm start

# Build for production
cd frontend && npm run build

# Run database migrations
psql $DATABASE_URL < database/schema.sql
```

---

## 🐛 Troubleshooting

### Backend won't start
- Check DATABASE_URL is correct
- Make sure PostgreSQL is running
- Check port 3001 is available

### Frontend won't connect to backend
- Check REACT_APP_API_URL in frontend/.env
- Make sure backend is running on port 3001
- Check browser console for CORS errors

### File upload fails
- Verify AWS credentials in backend/.env
- Check S3 bucket exists and is accessible
- Look at backend logs for errors

### Database errors
- Make sure schema.sql ran successfully
- Check PostgreSQL is running
- Verify connection string

---

## 🎯 Next Steps

### Essential (to complete the app)
- [ ] Build Analytics page with charts
- [ ] Build Editors page (view/create/edit)
- [ ] Build Admin page for user management
- [ ] Add Ad Name Changes view
- [ ] Implement Facebook OAuth flow in frontend

### Nice to Have
- [ ] Add video thumbnail generation
- [ ] Implement bulk upload
- [ ] Add export to CSV functionality
- [ ] Create mobile-responsive navigation
- [ ] Add notification system
- [ ] Implement cron job for ad sync

### Deployment
- [ ] Deploy backend to Render
- [ ] Deploy frontend to AWS S3
- [ ] Configure CloudFront CDN
- [ ] Set up domain and SSL
- [ ] Configure production Facebook app

---

## ✨ You're All Set!

Your Creative Library is ready to use. If you run into any issues, check the documentation or backend logs.

**Happy creating! 🎨**
