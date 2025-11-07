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
 * Sanitize editor name for use in S3 paths
 * Removes special characters, converts to lowercase, replaces spaces with hyphens
 * @param {string} editorName - Raw editor name
 * @returns {string} Sanitized editor name safe for S3 paths
 */
function sanitizeEditorName(editorName) {
  if (!editorName || typeof editorName !== 'string') {
    console.warn('⚠️ Invalid editor name provided, using fallback');
    return null;
  }

  // Convert to lowercase, replace spaces with hyphens, remove special chars
  let sanitized = editorName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/[^a-z0-9-_]/g, '')    // Remove special characters except hyphens and underscores
    .replace(/-+/g, '-')            // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '');       // Remove leading/trailing hyphens

  // Limit length to 50 characters
  if (sanitized.length > 50) {
    sanitized = sanitized.substring(0, 50);
    console.log(`📏 Editor name truncated to 50 chars: ${sanitized}`);
  }

  // Validate result
  if (sanitized.length === 0) {
    console.warn('⚠️ Editor name sanitization resulted in empty string, using fallback');
    return null;
  }

  console.log(`✅ Editor name sanitized: "${editorName}" → "${sanitized}"`);
  return sanitized;
}

/**
 * Generate S3 key for file with hybrid structure support
 * NEW: Supports editor-based organization (editor-name/media-type/file)
 * OLD: Falls back to date-based organization (folder/year/month/file)
 *
 * @param {string} filename - Original filename
 * @param {string} folder - Folder type ('originals', 'thumbnails')
 * @param {string|null} editorName - Editor name (optional, for new structure)
 * @param {string|null} mediaType - Media type ('image', 'video', optional)
 * @returns {string} S3 key path
 */
function generateS3Key(filename, folder = 'originals', editorName = null, mediaType = null) {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const uniqueFilename = `${uniqueId}-${filename}`;

  // NEW HYBRID STRUCTURE: editor-name/media-type/uniqueid-filename
  if (editorName && mediaType) {
    const sanitizedEditor = sanitizeEditorName(editorName);

    if (sanitizedEditor) {
      let subFolder;

      // Determine subfolder based on folder type and media type
      if (folder === 'thumbnails') {
        subFolder = 'thumbnails';
      } else {
        subFolder = mediaType === 'image' ? 'images' : 'videos';
      }

      const newPath = `${sanitizedEditor}/${subFolder}/${uniqueFilename}`;
      console.log(`🆕 NEW S3 STRUCTURE: ${newPath}`);
      console.log(`  └─ Editor: ${editorName} (sanitized: ${sanitizedEditor})`);
      console.log(`  └─ Media Type: ${mediaType}`);
      console.log(`  └─ Folder: ${subFolder}`);

      return newPath;
    }
  }

  // OLD STRUCTURE FALLBACK: folder/year/month/uniqueid-filename
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  const oldPath = `${folder}/${year}/${month}/${uniqueFilename}`;
  console.log(`🔙 OLD S3 STRUCTURE (fallback): ${oldPath}`);
  console.log(`  └─ Reason: ${!editorName ? 'No editor name' : !mediaType ? 'No media type' : 'Sanitization failed'}`);

  return oldPath;
}

module.exports = {
  s3Client,
  S3_BUCKET,
  CLOUDFRONT_URL,
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
  getPublicUrl,
  generateS3Key,
  sanitizeEditorName
};
