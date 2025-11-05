# API Testing Guide

Complete guide to test all backend endpoints.

## Prerequisites

1. Backend running on `http://localhost:3001`
2. Python service running on `http://localhost:5001`
3. PostgreSQL database initialized with schema
4. Environment variables configured

## Authentication Endpoints

### 1. Register User

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "role": "creative"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": { "id": "uuid", "name": "Test User", ... },
    "token": "jwt.token.here"
  }
}
```

### 2. Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 3. Get Current User

```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Editor Endpoints

### 4. Get All Editors

```bash
curl -X GET http://localhost:3001/api/editors \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 5. Get Editors with Stats

```bash
curl -X GET "http://localhost:3001/api/editors?includeStats=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 6. Get Single Editor

```bash
curl -X GET http://localhost:3001/api/editors/EDITOR_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 7. Create Editor (Admin Only)

```bash
curl -X POST http://localhost:3001/api/editors \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TESTUSER",
    "display_name": "Test User"
  }'
```

## Media Endpoints

### 8. Upload Media File

```bash
curl -X POST http://localhost:3001/api/media/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/image.jpg" \
  -F "editor_id=EDITOR_UUID" \
  -F "tags=[\"brand-a\",\"product\"]" \
  -F "description=Test upload"
```

### 9. Get Media Files

```bash
# All files
curl -X GET http://localhost:3001/api/media \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# With filters
curl -X GET "http://localhost:3001/api/media?editor_id=EDITOR_ID&media_type=image&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Search
curl -X GET "http://localhost:3001/api/media?search=campaign" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 10. Get Single Media File

```bash
curl -X GET http://localhost:3001/api/media/MEDIA_FILE_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 11. Update Media File

```bash
curl -X PATCH http://localhost:3001/api/media/MEDIA_FILE_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "editor_id": "NEW_EDITOR_ID",
    "tags": ["updated", "tags"],
    "description": "Updated description"
  }'
```

### 12. Delete Media File

```bash
curl -X DELETE http://localhost:3001/api/media/MEDIA_FILE_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 13. Get Storage Stats

```bash
curl -X GET http://localhost:3001/api/media/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Analytics Endpoints

### 14. Sync Facebook Ads

```bash
curl -X POST http://localhost:3001/api/analytics/sync \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ad_account_id": "act_123456789"
  }'
```

### 15. Get Editor Performance

```bash
# All editors
curl -X GET http://localhost:3001/api/analytics/editor-performance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Single editor
curl -X GET "http://localhost:3001/api/analytics/editor-performance?editor_id=EDITOR_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Date range
curl -X GET "http://localhost:3001/api/analytics/editor-performance?date_from=2024-01-01&date_to=2024-12-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 16. Get Ads Without Editor

```bash
curl -X GET http://localhost:3001/api/analytics/ads-without-editor \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 17. Get Ad Name Changes

```bash
# All changes
curl -X GET http://localhost:3001/api/analytics/ad-name-changes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Only editor changes
curl -X GET "http://localhost:3001/api/analytics/ad-name-changes?editor_changed=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Admin Endpoints

### 18. Get All Users (Admin Only)

```bash
curl -X GET http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

### 19. Create User (Admin Only)

```bash
curl -X POST http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New User",
    "email": "newuser@example.com",
    "password": "password123",
    "role": "creative",
    "upload_limit_monthly": 100
  }'
```

### 20. Update User (Admin Only)

```bash
curl -X PATCH http://localhost:3001/api/admin/users/USER_ID \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "role": "buyer",
    "upload_limit_monthly": 200,
    "is_active": true
  }'
```

### 21. Get System Stats (Admin Only)

```bash
curl -X GET http://localhost:3001/api/admin/stats \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

## Python Service Endpoints

### 22. Health Check

```bash
curl -X GET http://localhost:5001/health
```

### 23. Get Facebook Login URL

```bash
curl -X POST http://localhost:5001/api/facebook/login-url \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER_UUID"
  }'
```

### 24. Handle Facebook Callback

```bash
curl -X POST http://localhost:5001/api/facebook/callback \
  -H "Content-Type: application/json" \
  -d '{
    "code": "FACEBOOK_AUTH_CODE",
    "state": "STATE_FROM_LOGIN_URL"
  }'
```

## Testing Workflow

### Complete End-to-End Test

1. **Register and Login**
   ```bash
   # Register
   REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","email":"test@test.com","password":"pass1234","role":"creative"}')

   # Extract token
   TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.data.token')
   ```

2. **Get Editors**
   ```bash
   curl -X GET http://localhost:3001/api/editors \
     -H "Authorization: Bearer $TOKEN"
   ```

3. **Upload File**
   ```bash
   # Get first editor ID from previous response
   EDITOR_ID="paste-editor-id-here"

   curl -X POST http://localhost:3001/api/media/upload \
     -H "Authorization: Bearer $TOKEN" \
     -F "file=@test.jpg" \
     -F "editor_id=$EDITOR_ID" \
     -F "tags=[\"test\"]"
   ```

4. **Sync Facebook Ads**
   ```bash
   curl -X POST http://localhost:3001/api/analytics/sync \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"ad_account_id":"act_123456"}'
   ```

5. **View Analytics**
   ```bash
   curl -X GET http://localhost:3001/api/analytics/editor-performance \
     -H "Authorization: Bearer $TOKEN"
   ```

## Error Testing

### Invalid Token
```bash
curl -X GET http://localhost:3001/api/media \
  -H "Authorization: Bearer invalid_token"
# Expected: 401 Unauthorized
```

### Missing Required Field
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}'
# Expected: 400 Validation Error
```

### Insufficient Permissions
```bash
# Try to create editor as non-admin
curl -X POST http://localhost:3001/api/editors \
  -H "Authorization: Bearer $NON_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"TEST","display_name":"Test"}'
# Expected: 403 Forbidden
```

## Notes

- Replace `YOUR_JWT_TOKEN` with actual token from login/register
- Replace `EDITOR_ID`, `MEDIA_FILE_ID`, etc. with actual UUIDs
- All file paths in upload commands should be absolute or relative to current directory
- Python service must be running for analytics endpoints to work
