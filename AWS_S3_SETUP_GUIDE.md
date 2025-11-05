# AWS S3 Setup Guide for Creative Library

This guide will walk you through setting up AWS S3 storage for the Creative Asset Library application.

## Prerequisites
- AWS Root account email and password
- Access to AWS Console

---

## Step 1: Log into AWS Console

1. Go to [https://aws.amazon.com/console/](https://aws.amazon.com/console/)
2. Click **Sign In to the Console**
3. Select **Root user** and enter your root email
4. Enter your password and sign in

---

## Step 2: Create an IAM User (Best Practice - Don't Use Root)

Using root credentials in your application is dangerous. Create an IAM user instead:

1. In AWS Console, search for **IAM** in the top search bar
2. Click **IAM** service
3. In the left sidebar, click **Users**
4. Click **Create user** button
5. Enter User name: `creative-library-app`
6. Click **Next**

### Set Permissions:
7. Select **Attach policies directly**
8. Search for and select these policies:
   - `AmazonS3FullAccess` (for S3 operations)
9. Click **Next**
10. Review and click **Create user**

### Create Access Keys:
11. Click on the newly created user `creative-library-app`
12. Go to **Security credentials** tab
13. Scroll down to **Access keys** section
14. Click **Create access key**
15. Select **Application running outside AWS**
16. Click **Next**
17. (Optional) Add description: "Creative Library App"
18. Click **Create access key**

**⚠️ IMPORTANT:**
- Copy the **Access key ID** - you'll need this for `AWS_ACCESS_KEY_ID`
- Click **Show** and copy the **Secret access key** - you'll need this for `AWS_SECRET_ACCESS_KEY`
- **Download the .csv file** and store it securely
- You can only see the secret key once!

---

## Step 3: Create S3 Bucket

1. In AWS Console search bar, type **S3** and click on S3 service
2. Click **Create bucket** button

### Bucket Settings:
3. **Bucket name**: Choose a globally unique name (e.g., `creative-library-media-[your-company-name]`)
   - ⚠️ Write down this name - you'll need it for `AWS_S3_BUCKET`
   - Must be lowercase, no spaces, only hyphens allowed

4. **AWS Region**: Select **US East (N. Virginia)** `us-east-1`
   - ⚠️ Write down this region - you'll need it for `AWS_REGION`

5. **Object Ownership**: Keep default (**ACLs disabled**)

6. **Block Public Access settings**:
   - ✅ Keep all checkboxes CHECKED (Block all public access)
   - This is correct - you'll use presigned URLs for secure access

7. **Bucket Versioning**: Enable (recommended for backup/recovery)

8. **Default encryption**:
   - Select **Server-side encryption with Amazon S3 managed keys (SSE-S3)**

9. Click **Create bucket**

---

## Step 4: Configure CORS for S3 Bucket

CORS is needed for direct browser uploads (future feature):

1. Click on your newly created bucket name
2. Go to **Permissions** tab
3. Scroll down to **Cross-origin resource sharing (CORS)**
4. Click **Edit**
5. Paste this configuration:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE"
        ],
        "AllowedOrigins": [
            "http://localhost:3000",
            "http://localhost:3001",
            "https://your-production-domain.com"
        ],
        "ExposeHeaders": [
            "ETag"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

6. Replace `https://your-production-domain.com` with your actual production domain
7. Click **Save changes**

---

## Step 5: Update Application Environment Variables

Now update your `/Users/mac/Desktop/creative-library/backend/.env` file:

```env
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE     # ← Paste your Access Key ID here
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY  # ← Paste your Secret Key here
AWS_S3_BUCKET=creative-library-media-yourcompany  # ← Paste your bucket name here
```

**Replace with your actual values:**
- `AWS_REGION`: The region you selected (e.g., `us-east-1`)
- `AWS_ACCESS_KEY_ID`: From Step 2
- `AWS_SECRET_ACCESS_KEY`: From Step 2
- `AWS_S3_BUCKET`: From Step 3

---

## Step 6: (Optional) Set Up CloudFront CDN

CloudFront provides faster global delivery and reduced S3 costs:

1. In AWS Console, search for **CloudFront**
2. Click **Create distribution**
3. **Origin domain**: Select your S3 bucket from dropdown
4. **Origin access**: Select **Origin access control settings (recommended)**
5. Click **Create control setting**
   - Name: `creative-library-oac`
   - Click **Create**
6. Scroll down and click **Create distribution**

### Update S3 Bucket Policy:
7. After creation, you'll see a blue banner saying "S3 bucket policy needs to be updated"
8. Click **Copy policy**
9. Go back to your S3 bucket → **Permissions** tab
10. Scroll to **Bucket policy** → Click **Edit**
11. Paste the copied policy
12. Click **Save changes**

### Get CloudFront URL:
13. Go back to CloudFront distributions list
14. Copy your distribution's **Domain name** (e.g., `d111111abcdef8.cloudfront.net`)
15. Update your `.env` file:

```env
AWS_CLOUDFRONT_URL=https://d111111abcdef8.cloudfront.net
```

---

## Step 7: Restart Backend Server

After updating `.env`:

```bash
cd /Users/mac/Desktop/creative-library/backend
# Stop the current server (Ctrl+C if running in terminal)
npm start
```

---

## Step 8: Test Upload

1. Log into your application: `http://localhost:3000`
2. Go to **Media Library**
3. Click **Upload File**
4. Select an image/video
5. Choose an editor
6. Click **Upload**
7. Check AWS S3 Console to verify file was uploaded

---

## Cost Estimate

With typical usage for a small team:

- **S3 Storage**: ~$0.023 per GB/month
  - 100 GB of media = ~$2.30/month

- **S3 Data Transfer OUT**: $0.09 per GB
  - First 100 GB/month is free

- **S3 Requests**: $0.005 per 1,000 PUT requests
  - Very minimal cost

- **CloudFront** (optional):
  - First 1 TB/month = $0.085 per GB
  - Cheaper than S3 direct transfer after ~10 GB

**Estimated Monthly Cost for Small Team**: $5-15/month

---

## Security Best Practices

✅ **DO:**
- Use IAM user credentials (not root)
- Keep secret keys in `.env` file only (never commit to git)
- Enable S3 bucket versioning for backup
- Use presigned URLs for temporary access
- Set appropriate expiry times on presigned URLs

❌ **DON'T:**
- Don't make S3 bucket public
- Don't commit `.env` file to GitHub
- Don't share AWS secret keys
- Don't use root account credentials in the app

---

## Troubleshooting

### Error: "Access Denied" when uploading
- Check IAM user has `AmazonS3FullAccess` policy
- Verify AWS credentials in `.env` are correct
- Ensure bucket name matches exactly (case-sensitive)

### Error: "Bucket not found"
- Verify bucket name in `.env` matches exactly
- Check you're using the correct AWS region
- Ensure bucket exists in AWS Console

### Files upload but can't download
- Check CORS configuration is correct
- Verify presigned URL expiry time isn't too short
- Check CloudFront distribution is deployed (if using)

---

## Support

If you encounter issues:
1. Check backend logs: `tail -f /tmp/backend.log`
2. Verify AWS credentials: `aws s3 ls` (if AWS CLI installed)
3. Check AWS CloudWatch logs for detailed errors

---

## Next Steps

After S3 is set up:
1. ✅ Test file uploads from application
2. ✅ Verify files appear in S3 Console
3. ✅ Test file downloads/viewing
4. Consider setting up S3 lifecycle policies to auto-delete old files
5. Set up CloudWatch alerts for storage costs
