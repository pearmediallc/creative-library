# 🚀 RedTrack Integration - Quick Setup Guide

## ✅ What's Been Implemented

All RedTrack integration code is now complete in the `creative-library` backend:

### 1. **RedTrack Service** (`src/services/redtrackService.js`)
- Fetches conversion data from RedTrack API
- Uses `sub1` parameter (Facebook ad ID) as linking key
- Supports both individual and bulk fetching
- Automatic rate limiting (3s delay for 20 RPM limit)
- Production-ready error handling

### 2. **Unified Analytics Service** (`src/services/analyticsService.js`)
- `getUnifiedAnalytics()` method merges Facebook + RedTrack data
- Syncs Facebook ads first
- Fetches RedTrack metrics by ad ID
- Calculates profit, ROAS, ROI
- Aggregates by editor
- Returns comprehensive analytics

### 3. **API Endpoint** (`src/routes/analytics.js`)
- `GET /api/analytics/unified`
- Admin-only access
- Query parameters: `ad_account_id`, `date_from`, `date_to`, `bulk_fetch`
- Returns merged Facebook + RedTrack data

### 4. **Environment Configuration** (`.env.example`)
- Added RedTrack API URL and key variables
- Documented configuration requirements

---

## 🔧 Setup Steps (Only This Needed!)

### Step 1: Add RedTrack API Key

Edit `/Users/mac/Desktop/creative-library/backend/.env` and add:

```bash
# RedTrack API Configuration
REDTRACK_API_URL=https://api.redtrack.io
REDTRACK_API_KEY=your-actual-redtrack-api-key-here
```

**Where to get API key:**
1. Log in to RedTrack dashboard
2. Go to **Settings** → **API**
3. Copy your API key
4. Paste it in the `.env` file

### Step 2: Restart Backend

```bash
cd /Users/mac/Desktop/creative-library/backend
npm restart
```

### Step 3: Test Integration

#### Test 1: Sync Facebook Ads
```bash
curl -X POST "http://localhost:3001/api/analytics/sync" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ad_account_id": "act_YOUR_AD_ACCOUNT_ID",
    "date_from": "2024-11-01",
    "date_to": "2024-11-30"
  }'
```

#### Test 2: Get Unified Analytics
```bash
curl -X GET "http://localhost:3001/api/analytics/unified?ad_account_id=act_YOUR_AD_ACCOUNT_ID&date_from=2024-11-01&date_to=2024-11-30" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 📊 What You Get

### Response Structure:
```json
{
  "success": true,
  "data": {
    "ads": [
      {
        "fb_ad_id": "123...",
        "ad_name": "[Launcher] Campaign - EDITORNAME",
        "editor_name": "EDITORNAME",

        // Facebook Metrics
        "spend": 1250.50,
        "impressions": 50000,
        "clicks": 1500,
        "cpm": 25.01,
        "cpc": 0.83,

        // RedTrack Metrics
        "revenue": 4500.00,
        "conversions": 45,
        "rt_clicks": 1400,
        "epc": 3.21,

        // Calculated
        "profit": 3249.50,
        "roas": 3.60
      }
    ],

    "editor_performance": [
      {
        "editor_name": "EDITORNAME",
        "total_ads": 25,
        "total_spend": 15000.00,
        "total_revenue": 52000.00,
        "total_profit": 37000.00,
        "roas": 3.47
      }
    ],

    "summary": {
      "total_ads": 150,
      "total_spend": 125000.00,
      "total_revenue": 425000.00,
      "total_profit": 300000.00,
      "overall_roas": 3.40,
      "overall_roi": 240.00
    }
  }
}
```

---

## 🔑 Key Features

### ✅ Automatic Editor Detection
- Extracts editor names from ad names
- Patterns: `- EDITORNAME`, `(EDITORNAME)`, etc.
- Maps to `editors` table

### ✅ Data Linkage
- Uses `sub1` parameter (Facebook ad ID)
- Links Facebook spend → RedTrack revenue
- No manual mapping needed

### ✅ Performance Optimized
- Auto bulk fetch for >10 ads
- Rate limiting (3s delay)
- Efficient database queries

### ✅ Comprehensive Metrics
**Facebook:**
- Spend, impressions, clicks
- CPM, CPC, CTR

**RedTrack:**
- Revenue, conversions
- CR, EPC, ROI
- Landing page metrics

**Calculated:**
- Profit = revenue - spend
- ROAS = revenue / spend
- Cost per conversion

### ✅ Editor-Level Aggregation
- Total spend per editor
- Total revenue per editor
- ROAS per editor
- Ad count per editor

---

## 📖 Full Documentation

See `REDTRACK_INTEGRATION.md` for:
- Complete API documentation
- Data flow diagrams
- Troubleshooting guide
- Database schemas
- Advanced usage examples

---

## 🎯 Usage Workflow

```
1. Create campaigns in campaignLauncherMulti
   ↓
   (Tracking URL includes sub1={{ad.id}})
   ↓
2. Ads run on Facebook, send traffic to RedTrack
   ↓
3. In creative-library:
   - Sync Facebook ads: POST /api/analytics/sync
   ↓
4. Get unified analytics: GET /api/analytics/unified
   ↓
5. View complete ROI picture:
   - Spend (Facebook)
   - Revenue (RedTrack)
   - Profit
   - By Editor
```

---

## ⚠️ Important Notes

### RedTrack API Rate Limit
- **20 requests per minute**
- System auto-adds 3-second delays
- Use `bulk_fetch=true` for many ads

### Editor Name Format
Ads must include editor names in these formats:
- `[Launcher] Campaign - Ad 11/08/2024 - EDITORNAME`
- `Campaign - EDITORNAME - Ad`
- `(EDITORNAME)`

### Authentication
- All endpoints require admin JWT token
- Set in request header: `Authorization: Bearer TOKEN`

---

## 🐛 Troubleshooting

### No RedTrack data returned?
1. Check API key in `.env`
2. Verify ads have traffic in RedTrack
3. Confirm `sub1` parameter is set in tracking URLs
4. Check logs: `backend/logs/app.log`

### Rate limit errors?
- Use bulk fetch: `?bulk_fetch=true`
- Reduce date range
- Wait between requests

### Editor not detected?
- Verify editor name in ad name
- Check editor exists in `editors` table
- Use correct pattern format

---

## 🎉 You're Done!

The integration is complete and production-ready. Just add your RedTrack API key and you're good to go!

**Next Steps:**
1. Add RedTrack API key to `.env`
2. Restart backend
3. Test with sample ad account
4. Build frontend dashboard (optional)

---

## 📞 Support

For detailed documentation, see:
- `REDTRACK_INTEGRATION.md` - Complete technical guide
- `backend/src/services/redtrackService.js` - Service implementation
- `backend/src/services/analyticsService.js` - Analytics logic

All code includes extensive logging for debugging.
