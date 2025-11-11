# RedTrack Integration Guide

## Overview

This system integrates **Facebook Ads** traffic data with **RedTrack** conversion/revenue data to provide unified analytics showing each editor's complete ad performance including spend, revenue, and profit.

## How It Works

### 1. **Ad ID Tracking**
When campaigns are created in `campaignLauncherMulti`, the tracking URL includes the Facebook ad ID in the `sub1` parameter:

```
https://track.demuretrend.com/690f9ef50ae431eeb6d5f03e?sub1={{ad.id}}&sub2={{adset.id}}&sub3={{campaign.id}}&sub4={{ad.name}}&utm_source=facebook&utm_medium=paid
```

- `sub1={{ad.id}}` - **This is the key linkage** - Facebook Ad ID passed to RedTrack
- RedTrack logs all clicks, conversions, and revenue against this `sub1` value

### 2. **Facebook Ad Sync**
The `creative-library` backend syncs Facebook ads:
- Fetches campaigns, ad sets, and ads from Facebook Graph API
- Extracts editor names from ad names (e.g., "Campaign - EDITORNAME")
- Stores Facebook metrics: spend, impressions, clicks, CPM, CPC
- Maps editor info to each ad

### 3. **RedTrack Data Fetch**
Using the stored Facebook ad IDs:
- Queries RedTrack API with `sub1` parameter (the ad ID)
- Fetches conversion data: revenue, conversions, ROI, EPC
- Returns data grouped by ad ID

### 4. **Data Merging**
Combines both data sources:
- Links Facebook spend → RedTrack revenue using ad ID
- Calculates profit = revenue - spend
- Aggregates by editor name
- Provides unified analytics with complete ROI picture

---

## Setup Instructions

### Step 1: Get RedTrack API Key

1. Log in to your RedTrack dashboard
2. Go to **Settings** → **API**
3. Generate or copy your API key
4. Save it securely

### Step 2: Configure Environment Variables

Edit `/Users/mac/Desktop/creative-library/backend/.env` and add:

```bash
# RedTrack API Configuration
REDTRACK_API_URL=https://api.redtrack.io
REDTRACK_API_KEY=your-actual-api-key-here
REDTRACK_TRACKING_DOMAIN=track.demuretrend.com
```

**Important:** Replace `your-actual-api-key-here` with your real RedTrack API key.

### Step 3: Restart Backend Server

```bash
cd /Users/mac/Desktop/creative-library/backend
npm restart
```

Or if using PM2:
```bash
pm2 restart creative-library-backend
```

### Step 4: Test Connection

Test the RedTrack API connection:

```bash
curl -X GET "https://api.redtrack.io/report?api_key=YOUR_API_KEY&group=sub1&date_from=2024-01-01&date_to=2024-12-31&per=1"
```

You should receive a JSON response with data.

---

## API Endpoints

### 1. Sync Facebook Ads (Required First)

**Endpoint:** `POST /api/analytics/sync`

**Purpose:** Fetches latest ad data from Facebook and stores in database

**Request:**
```json
{
  "ad_account_id": "act_123456789",
  "date_from": "2024-01-01",
  "date_to": "2024-12-31"
}
```

**Response:**
```json
{
  "success": true,
  "totalAdsProcessed": 150,
  "adsWithEditor": 120,
  "adsWithoutEditor": 30
}
```

**Authentication:** Admin only

---

### 2. Get Unified Analytics (Facebook + RedTrack)

**Endpoint:** `GET /api/analytics/unified`

**Purpose:** Fetches and merges Facebook + RedTrack data

**Query Parameters:**
- `ad_account_id` (required) - Facebook ad account ID
- `date_from` (optional) - Start date (YYYY-MM-DD)
- `date_to` (optional) - End date (YYYY-MM-DD)
- `bulk_fetch` (optional) - `true`, `false`, or omit for auto

**Example Request:**
```bash
curl -X GET "http://localhost:3001/api/analytics/unified?ad_account_id=act_123456789&date_from=2024-11-01&date_to=2024-11-30" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response Structure:**
```json
{
  "success": true,
  "message": "Unified analytics generated successfully",
  "data": {
    "ads": [
      {
        "fb_ad_id": "120212345678901234",
        "ad_name": "[Launcher] Campaign Name - Ad 11/08/2024 - EDITORNAME",
        "campaign_id": "120212345678901235",
        "campaign_name": "My Campaign",
        "editor_id": "uuid-here",
        "editor_name": "EDITORNAME",

        // Facebook Metrics
        "spend": 1250.50,
        "impressions": 50000,
        "clicks": 1500,
        "cpm": 25.01,
        "cpc": 0.83,
        "fb_ctr": 3.0,

        // RedTrack Metrics
        "revenue": 4500.00,
        "conversions": 45,
        "approved_conversions": 42,
        "pending_conversions": 3,
        "rt_clicks": 1400,
        "lp_views": 1500,
        "cr": 3.21,
        "epc": 3.21,

        // Calculated
        "profit": 3249.50,
        "roas": 3.60,
        "cost_per_conversion": 27.79,

        "has_redtrack_data": true,
        "redtrack_error": null
      }
    ],

    "editor_performance": [
      {
        "editor_name": "EDITORNAME",
        "editor_id": "uuid-here",
        "total_ads": 25,
        "ads_with_redtrack_data": 23,

        "total_spend": 15000.00,
        "total_impressions": 600000,
        "total_clicks": 18000,
        "avg_cpm": 25.00,
        "avg_cpc": 0.83,
        "avg_ctr": 3.0,

        "total_revenue": 52000.00,
        "total_conversions": 520,
        "total_approved_conversions": 500,
        "total_rt_clicks": 17500,
        "avg_cr": 2.97,
        "avg_epc": 2.97,

        "total_profit": 37000.00,
        "roas": 3.47,
        "avg_cost_per_conversion": 28.85
      }
    ],

    "summary": {
      "total_ads": 150,
      "ads_with_editor": 120,
      "ads_without_editor": 30,
      "ads_with_redtrack_data": 110,
      "ads_without_redtrack_data": 40,

      "total_spend": 125000.00,
      "total_revenue": 425000.00,
      "total_profit": 300000.00,
      "total_impressions": 5000000,
      "total_clicks": 150000,
      "total_conversions": 4250,

      "overall_cpm": 25.00,
      "overall_cpc": 0.83,
      "overall_ctr": 3.0,
      "overall_cr": 2.83,
      "overall_epc": 2.83,
      "overall_roas": 3.40,
      "overall_roi": 240.00,
      "overall_cost_per_conversion": 29.41
    },

    "meta": {
      "date_from": "2024-11-01",
      "date_to": "2024-11-30",
      "ad_account_id": "act_123456789",
      "fetch_method": "bulk",
      "generated_at": "2024-11-11T10:30:00.000Z"
    }
  }
}
```

**Authentication:** Admin only

---

## Data Flow Diagram

```
┌─────────────────────┐
│ Campaign Launcher   │
│ (campaignLauncherMulti)│
└──────────┬──────────┘
           │
           │ Creates ads with tracking URL:
           │ sub1={{ad.id}}
           │
           ▼
┌─────────────────────┐
│   Facebook Ads      │
│  (Traffic Source)   │
└──────────┬──────────┘
           │
           │ Clicks recorded
           │
           ▼
┌─────────────────────┐
│     RedTrack        │
│ (Tracking Platform) │
│  Logs: sub1=ad_id   │
│  + conversions      │
│  + revenue          │
└──────────┬──────────┘
           │
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐ ┌──────────┐
│Facebook │ │ RedTrack │
│Graph API│ │   API    │
└────┬────┘ └─────┬────┘
     │            │
     │            │
     └────┬───────┘
          │
          ▼
┌─────────────────────┐
│  Creative Library   │
│  Analytics Service  │
│                     │
│  Merges:            │
│  - Spend (FB)       │
│  - Revenue (RT)     │
│  - Profit           │
│  - ROI              │
│  Grouped by Editor  │
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│  Unified Analytics  │
│  Dashboard/API      │
└─────────────────────┘
```

---

## RedTrack API Details

### Base URL
```
https://api.redtrack.io
```

### Authentication
API key passed as query parameter:
```
?api_key=YOUR_API_KEY
```

### Traffic Report Endpoint
```
GET /report
```

### Key Parameters
- `group=sub1` - Groups data by sub1 (ad ID)
- `sub1=AD_ID` - Filters to specific ad ID
- `date_from=YYYY-MM-DD` - Start date
- `date_to=YYYY-MM-DD` - End date
- `per=1000` - Results per page (max 1000)
- `total=true` - Include total stats

### Rate Limits
- **20 requests per minute (RPM)**
- System auto-adds 3-second delay between requests
- Use bulk fetch (`bulk_fetch=true`) for >10 ads

### Response Fields
- `revenue` - Total revenue
- `cost` - Traffic cost (if tracked)
- `profit` - Revenue - cost
- `conversions` - Total conversions
- `approved_conversions` - Approved conversions
- `rejected_conversions` - Rejected conversions
- `pending_conversions` - Pending conversions
- `clicks` - Total clicks
- `lp_clicks` - Landing page clicks
- `lp_views` - Landing page views
- `cr` - Conversion rate (%)
- `epc` - Earnings per click
- `roi` - Return on investment (%)
- `lp_ctr` - Landing page CTR (%)

---

## Editor Name Detection

The system automatically extracts editor names from ad names using these patterns:

1. `[Launcher] Campaign - Ad Date - EDITORNAME`
2. `Campaign - EDITORNAME - Ad`
3. `(EDITORNAME)`
4. `- EDITORNAME$` (at end)
5. `^EDITORNAME -` (at start)

**Example Ad Names:**
- `[Launcher] My Campaign - Ad 11/08/2024 - SHUBH` → Editor: SHUBH
- `Campaign Name - DEEPA - Ad 1` → Editor: DEEPA
- `Test Ad (DEEP)` → Editor: DEEP

**Supported Editors:**
- DEEP
- DEEPA
- DEEPANSHU
- DEEPANSHUVERMA
- SHUBH
- (any editor in `editors` table)

---

## Troubleshooting

### Issue: No RedTrack data returned

**Possible Causes:**
1. **API key not set** - Check `.env` file
2. **Wrong API URL** - Should be `https://api.redtrack.io`
3. **No data in RedTrack** - Ads haven't sent traffic yet
4. **sub1 not matching** - Check ad IDs match between Facebook and RedTrack

**Solution:**
```bash
# Test RedTrack connection
curl -X GET "https://api.redtrack.io/report?api_key=YOUR_KEY&group=sub1&date_from=2024-01-01&date_to=2024-12-31&per=1"
```

Check logs:
```bash
tail -f /Users/mac/Desktop/creative-library/backend/logs/app.log | grep -i redtrack
```

---

### Issue: Rate limit errors

**Error Message:** `429 Too Many Requests`

**Solution:**
- Use bulk fetch: `?bulk_fetch=true`
- Reduce date range
- Wait 60 seconds between requests

---

### Issue: Editor not detected in ad

**Problem:** Ad shows `editor_name: null`

**Solution:**
1. Check ad name format includes editor name
2. Verify editor exists in `editors` table
3. Ad name must match one of the patterns listed above

**Example Fix:**
```sql
-- Add missing editor
INSERT INTO editors (name, display_name, is_active)
VALUES ('NEWEDITOR', 'NewEditor', true);
```

---

## Performance Optimization

### Bulk Fetch vs Individual Fetch

**Individual Fetch** (default for ≤10 ads):
- One API call per ad
- Better for small datasets
- More accurate filtering

**Bulk Fetch** (default for >10 ads):
- Single API call for all ads
- Much faster for large datasets
- Recommended for >10 ads

**Force bulk fetch:**
```bash
GET /api/analytics/unified?ad_account_id=act_123&bulk_fetch=true
```

### Caching Strategy

- Facebook ad data cached in `facebook_ads` table
- Synced on-demand via `/api/analytics/sync`
- RedTrack data fetched fresh each request (not cached)

---

## Database Schema

### `facebook_ads` Table
```sql
CREATE TABLE facebook_ads (
  id UUID PRIMARY KEY,
  fb_ad_id VARCHAR(255) UNIQUE NOT NULL,
  ad_name TEXT NOT NULL,
  campaign_id VARCHAR(255),
  campaign_name TEXT,
  ad_account_id VARCHAR(255) NOT NULL,

  editor_id UUID REFERENCES editors(id),
  editor_name VARCHAR(255),

  spend DECIMAL(12, 2),
  cpm DECIMAL(12, 2),
  cpc DECIMAL(12, 2),
  cost_per_result DECIMAL(12, 2),
  impressions BIGINT,
  clicks INTEGER,

  last_synced_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### `editors` Table
```sql
CREATE TABLE editors (
  id UUID PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## Example Usage Workflow

### 1. Sync Facebook Ads
```bash
curl -X POST "http://localhost:3001/api/analytics/sync" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ad_account_id": "act_123456789",
    "date_from": "2024-11-01",
    "date_to": "2024-11-30"
  }'
```

### 2. Get Unified Analytics
```bash
curl -X GET "http://localhost:3001/api/analytics/unified?ad_account_id=act_123456789&date_from=2024-11-01&date_to=2024-11-30" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Analyze Results
- View total spend vs revenue
- Check editor-level ROAS
- Identify profitable ads
- Find ads with low ROI

---

## Security Considerations

1. **Admin Only Access** - All analytics endpoints require admin authentication
2. **API Key Security** - Store RedTrack API key in `.env`, never commit to git
3. **Rate Limiting** - Built-in 3-second delays to respect API limits
4. **Error Handling** - Graceful degradation if RedTrack unavailable

---

## Future Enhancements

Potential improvements:
- [ ] Real-time webhook integration from RedTrack
- [ ] Automated daily sync cron jobs
- [ ] Historical trend analysis
- [ ] Editor performance alerts
- [ ] Export to CSV/Excel
- [ ] Custom date range presets (last 7 days, last 30 days, etc.)
- [ ] Campaign-level aggregation
- [ ] Ad set-level aggregation

---

## Support

For issues or questions:
1. Check logs: `backend/logs/app.log`
2. Verify environment variables are set
3. Test RedTrack API connection independently
4. Ensure Facebook ads have editor names in correct format

---

## Summary

This integration provides a **complete ROI picture** by linking:
- **Facebook traffic costs** (what you spend)
- **RedTrack conversion revenue** (what you earn)
- **Editor attribution** (who created the ad)

Result: Know exactly which editors and ads are profitable.
