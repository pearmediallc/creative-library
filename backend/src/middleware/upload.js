const multer = require('multer');

/**
 * Multer configuration for file uploads
 * Uses memory storage to allow processing before S3 upload
 */
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max
    files: 1 // Single file upload
  },
  fileFilter: (req, file, cb) => {
    // Basic MIME type check (detailed validation in service layer)
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
      'application/octet-stream' // Allow generic binary for folder uploads
    ];

    // Check MIME type
    if (allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      // Check file extension as fallback for octet-stream files
      const ext = file.originalname.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|webm)$/);
      if (ext) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type: ${file.mimetype}`));
      }
    }
  }
});

module.exports = { upload };
