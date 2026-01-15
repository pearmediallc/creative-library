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
 * Generate S3 key for file with YYYY/MM/DD date structure
 * NEW STRUCTURE:
 * - Media Library: media-library/{uploader}/{YYYY}/{MM}/{DD}/{media-type}/file
 * - File Requests: file-requests/{request-id}/uploads/{uploader}/{YYYY}/{MM}/{DD}/{media-type}/file
 * - Thumbnails: thumbnails/{YYYY}/{MM}/{DD}/file
 * - Deleted: deleted/{YYYY}/{MM}/{DD}/{deleted-by}/original-path/file
 *
 * @param {string} filename - Original filename
 * @param {string} folder - Folder type ('originals', 'thumbnails', 'file-requests', 'deleted')
 * @param {string|null} uploaderName - Uploader/editor name (REQUIRED for new structure)
 * @param {string|null} mediaType - Media type ('image', 'video', optional)
 * @param {Object} options - Additional options
 * @param {string|null} options.requestId - File request ID (for file-request uploads)
 * @param {string|null} options.folderPath - Legacy folder path support
 * @param {string|null} options.deletedBy - Name of person who deleted (for deleted folder)
 * @param {string|null} options.originalPath - Original S3 path (for deleted folder)
 * @returns {string} S3 key path
 */
function generateS3Key(filename, folder = 'originals', uploaderName = null, mediaType = null, options = {}) {
  const { requestId, folderPath, deletedBy, originalPath } = options;

  const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const uniqueFilename = `${uniqueId}-${filename}`;

  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // DELETED FILES STRUCTURE
  // deleted/YYYY/MM/DD/deleted-by-name/original-path/file
  if (folder === 'deleted' && deletedBy && originalPath) {
    const sanitizedDeleter = sanitizeEditorName(deletedBy);
    if (sanitizedDeleter) {
      const deletedPath = `deleted/${year}/${month}/${day}/${sanitizedDeleter}/${originalPath}`;
      console.log(`🗑️ DELETED FILE STRUCTURE: ${deletedPath}`);
      console.log(`  └─ Deleted by: ${deletedBy} (sanitized: ${sanitizedDeleter})`);
      console.log(`  └─ Original path: ${originalPath}`);
      return deletedPath;
    }
  }

  // THUMBNAILS STRUCTURE
  // thumbnails/YYYY/MM/DD/file
  if (folder === 'thumbnails') {
    const thumbPath = `thumbnails/${year}/${month}/${day}/${uniqueFilename}`;
    console.log(`🖼️ THUMBNAIL STRUCTURE: ${thumbPath}`);
    return thumbPath;
  }

  // FILE REQUEST UPLOADS STRUCTURE
  // file-requests/{request-id}/uploads/{uploader}/{YYYY}/{MM}/{DD}/{media-type}/file
  if (requestId && uploaderName && mediaType) {
    const sanitizedUploader = sanitizeEditorName(uploaderName);
    if (sanitizedUploader) {
      const mediaFolder = mediaType === 'image' ? 'images' : 'videos';
      const requestPath = `file-requests/${requestId}/uploads/${sanitizedUploader}/${year}/${month}/${day}/${mediaFolder}/${uniqueFilename}`;
      console.log(`📋 FILE REQUEST UPLOAD STRUCTURE: ${requestPath}`);
      console.log(`  └─ Request ID: ${requestId}`);
      console.log(`  └─ Uploader: ${uploaderName} (sanitized: ${sanitizedUploader})`);
      console.log(`  └─ Date: ${year}/${month}/${day}`);
      console.log(`  └─ Media Type: ${mediaType}`);
      return requestPath;
    }
  }

  // MEDIA LIBRARY STRUCTURE (with uploader)
  // media-library/{uploader}/{YYYY}/{MM}/{DD}/{media-type}/file
  if (uploaderName && mediaType) {
    const sanitizedUploader = sanitizeEditorName(uploaderName);
    if (sanitizedUploader) {
      const mediaFolder = mediaType === 'image' ? 'images' : 'videos';
      const mediaPath = `media-library/${sanitizedUploader}/${year}/${month}/${day}/${mediaFolder}/${uniqueFilename}`;
      console.log(`📚 MEDIA LIBRARY STRUCTURE: ${mediaPath}`);
      console.log(`  └─ Uploader: ${uploaderName} (sanitized: ${sanitizedUploader})`);
      console.log(`  └─ Date: ${year}/${month}/${day}`);
      console.log(`  └─ Media Type: ${mediaType}`);
      return mediaPath;
    }
  }

  // LEGACY FALLBACK (for backward compatibility)
  // originals/YYYY/MM/file
  const oldPath = `${folder}/${year}/${month}/${uniqueFilename}`;
  console.log(`🔙 LEGACY FALLBACK STRUCTURE: ${oldPath}`);
  console.log(`  └─ Reason: ${!uploaderName ? 'No uploader name' : !mediaType ? 'No media type' : 'Sanitization failed'}`);

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
