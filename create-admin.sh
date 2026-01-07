#!/bin/bash

# Create Admin User Script
# This script creates an admin user directly via the registration endpoint

echo "======================================"
echo "Creating Admin User"
echo "======================================"

# Production URL
API_URL="https://creative-library.onrender.com/api"

# Admin credentials
ADMIN_NAME="Admin User"
ADMIN_EMAIL="admin@creative-library.com"
ADMIN_PASSWORD="Admin@123"

echo ""
echo "Attempting to create admin user..."
echo "Email: $ADMIN_EMAIL"
echo "Password: $ADMIN_PASSWORD"
echo ""

# Try to register the admin user
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$ADMIN_NAME\",
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\",
    \"role\": \"admin\"
  }")

# Extract status code
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

echo "Response Code: $http_code"
echo "Response Body: $body"
echo ""

if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
    echo "✅ Admin user created successfully!"
    echo ""
    echo "Login credentials:"
    echo "  Email: $ADMIN_EMAIL"
    echo "  Password: $ADMIN_PASSWORD"
    echo ""
    echo "You can now login at: https://creative-library-frontend.onrender.com/login"
elif echo "$body" | grep -q "already exists"; then
    echo "⚠️  Admin user already exists. Try logging in with:"
    echo "  Email: $ADMIN_EMAIL"
    echo "  Password: $ADMIN_PASSWORD"
elif echo "$body" | grep -q "not on whitelist"; then
    echo "⚠️  Email not whitelisted. Trying to create anyway..."
    echo ""
    echo "NOTE: If registration fails, you may need to:"
    echo "1. Disable email whitelist temporarily"
    echo "2. Or add the email to whitelist via database"
else
    echo "❌ Failed to create admin user"
    echo "You may need to create it manually via database or disable approval workflow"
fi

echo ""
echo "======================================"
