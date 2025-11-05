/**
 * AWS S3 Configuration
 */

const { S3Client } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const S3_BUCKET = process.env.AWS_S3_BUCKET;
const CLOUDFRONT_URL = process.env.AWS_CLOUDFRONT_URL;

/**
 * Generate presigned URL for file download (1 hour expiry)
 */
async function getPresignedDownloadUrl(s3Key) {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
  return url;
}

/**
 * Generate presigned URL for file upload
 */
async function getPresignedUploadUrl(s3Key, contentType) {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    ContentType: contentType
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes
  return url;
}

/**
 * Get public URL (via CloudFront if configured)
 */
function getPublicUrl(s3Key) {
  if (CLOUDFRONT_URL) {
    return `${CLOUDFRONT_URL}/${s3Key}`;
  }
  return `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
}

/**
 * Generate S3 key for file
 */
function generateS3Key(filename, folder = 'originals') {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return `${folder}/${year}/${month}/${uniqueId}-${filename}`;
}

module.exports = {
  s3Client,
  S3_BUCKET,
  CLOUDFRONT_URL,
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
  getPublicUrl,
  generateS3Key
};
