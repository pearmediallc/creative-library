# Missing Environment Variables for Render

You've already added the Slack credentials (✅ SLACK_CLIENT_ID, ✅ SLACK_CLIENT_SECRET, ✅ SLACK_SIGNING_SECRET, ✅ SLACK_BOT_TOKEN).

## Additional Required Environment Variables

### 1. FRONTEND_URL
**Purpose:** Used for OAuth redirects back to your frontend after Slack authorization

**Value for Production:**
```
FRONTEND_URL=https://creative-library-frontend.onrender.com
```

**Where it's used:**
- Slack OAuth callback redirects users back to: `${FRONTEND_URL}/settings?slack_success=true`
- File share notification URLs: `${FRONTEND_URL}/media/${fileId}`
- All notification links in Slack messages

---

### 2. BACKEND_URL
**Purpose:** Used for OAuth callback URIs that external services call

**Value for Production:**
```
BACKEND_URL=https://creative-library.onrender.com
```

**Where it's used:**
- Slack OAuth redirect URI: `${BACKEND_URL}/api/slack/oauth/callback`
- This must match EXACTLY what's configured in your Slack app settings

---

## How to Add These in Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Select your **backend service** (creative-library-backend)
3. Click **Environment** tab
4. Click **Add Environment Variable** button
5. Add each variable:

### Add FRONTEND_URL:
```
Key: FRONTEND_URL
Value: https://creative-library-frontend.onrender.com
```

### Add BACKEND_URL:
```
Key: BACKEND_URL
Value: https://creative-library.onrender.com
```

6. Click **Save Changes**

**Important:** Render will automatically redeploy your service after saving environment variables. This takes ~3-5 minutes.

---

## Verification

After adding these environment variables and deployment completes:

1. **Check Logs** (Render Dashboard → Your Service → Logs):
   - Should NOT see "SLACK_CLIENT_ID not configured" error
   - Should see "Slack OAuth initiated" log when testing

2. **Test Slack Connection**:
   - Login to your app
   - Go to Settings → Slack tab
   - Click "Connect to Slack"
   - Should redirect to Slack authorization page (not error)

---

## Summary of ALL Required Environment Variables

Here's the complete list of what should be in your Render backend environment:

### Database
```
DATABASE_URL=[automatically set by Render]
DATABASE_POOL_SIZE=20
```

### Application URLs
```
FRONTEND_URL=https://creative-library-frontend.onrender.com
BACKEND_URL=https://creative-library.onrender.com
```

### JWT Authentication
```
JWT_SECRET=[your-production-jwt-secret]
JWT_EXPIRY=7d
```

### AWS S3
```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=[your-key]
AWS_SECRET_ACCESS_KEY=[your-secret]
AWS_S3_BUCKET=creative-library-media-pearmedia
AWS_CLOUDFRONT_URL=https://d1119rg1irtir1.cloudfront.net
```

### Slack Integration
```
SLACK_CLIENT_ID=993338752987910276035245237
SLACK_CLIENT_SECRET=e4f30d5db3bc9c90c94f85c661067161
SLACK_SIGNING_SECRET=f773706037954063c007d646c150b688
SLACK_BOT_TOKEN=xoxb-9933387529879-10283091144020-li35TAK2VaMmniNZtx10
```

### Facebook (if using)
```
FB_APP_ID=[your-fb-app-id]
FB_APP_SECRET=[your-fb-secret]
FB_API_VERSION=v18.0
ENCRYPTION_KEY=[your-64-char-hex-key]
```

### Misc
```
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Why This Wasn't an Issue Before

**Q:** "How were other things working without these URLs?"

**A:** Because most features don't need external redirects:
- ✅ File uploads/downloads - Direct S3 URLs
- ✅ API calls - Frontend has backend URL in build config
- ✅ Authentication - JWT tokens don't need external URLs
- ✅ Database operations - Direct connections
- ❌ **OAuth flows** - NEED these URLs for redirects

---

## After Adding Environment Variables

Once you add `FRONTEND_URL` and `BACKEND_URL`:

1. Wait for Render deployment (~3-5 minutes)
2. Test Slack OAuth again
3. Should successfully redirect to Slack
4. After authorizing, should redirect back to your app
5. Slack notifications will work with proper file URLs

---

## Troubleshooting

### Still getting "authUrl is undefined"
- Check Render logs for "SLACK_CLIENT_ID not configured"
- Verify env vars were saved (Render → Environment tab)
- Make sure service redeployed after saving

### OAuth redirect fails
- Verify `BACKEND_URL` matches your Slack app redirect URI setting
- Should be: `https://creative-library.onrender.com/api/slack/oauth/callback`
- Check Slack app settings at https://api.slack.com/apps/A0A8411776Z

### Slack doesn't redirect back to app
- Verify `FRONTEND_URL` is correct
- Check URL in browser after Slack authorization
- Should redirect to: `https://creative-library-frontend.onrender.com/settings?slack_success=true`
