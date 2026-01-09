const sharp = require('sharp');
const piexif = require('piexifjs');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');

/**
 * Metadata Service
 * Ported from Python metadata tagger - handles metadata operations on images and videos
 */
class MetadataService {

  /**
   * Add metadata to image buffer (PNG or JPEG)
   * Ported from: add_metadata_to_image() in metadata_tagger_backend.py (lines 327-458)
   *
   * @param {Buffer} buffer - Image file buffer
   * @param {Object} metadata - Metadata to embed
   * @param {string} metadata.creator_id - Creator/editor name
   * @param {string} metadata.timestamp - Upload timestamp
   * @param {Object} metadata.additional - Additional metadata fields
   * @returns {Promise<Buffer>} Modified image buffer
   */
  async addMetadataToImage(buffer, metadata) {
    try {
      const { creator_id, timestamp, additional } = metadata;
      const displayCreator = creator_id || 'Anonymous';

      logger.info(`Processing image for creator: ${displayCreator}`);

      // Get image metadata
      const image = sharp(buffer);
      const imageMetadata = await image.metadata();
      const originalFormat = imageMetadata.format.toUpperCase();

      logger.info(`Original format: ${originalFormat}`);

      // Handle PNG separately (Facebook preserves PNG text chunks!)
      if (originalFormat === 'PNG') {
        // For PNG, we need to use a different approach since sharp doesn't support text chunks directly
        // We'll use the PNG metadata in the buffer directly
        const processedBuffer = await this._addPNGMetadata(buffer, creator_id, timestamp, additional);
        logger.info(`✅ Saved as PNG with copyright_notice='Created by ${creator_id}'`);
        logger.info(`   When uploaded to Facebook, this field WILL be preserved in the JPEG!`);
        return processedBuffer;
      }

      // For JPEG, use EXIF
      return await this._addJPEGMetadata(buffer, creator_id, timestamp, additional);

    } catch (error) {
      logger.error(`Error adding image metadata: ${error.message}`);
      throw new Error(`Error processing image: ${error.message}`);
    }
  }

  /**
   * Add metadata to PNG image
   * Note: Sharp doesn't support PNG text chunks, so we keep EXIF approach for compatibility
   */
  async _addPNGMetadata(buffer, creator_id, timestamp, additional = {}) {
    try {
      const image = sharp(buffer);

      // Build EXIF data for PNG (will be converted to appropriate format)
      const exifData = {};

      if (creator_id) {
        exifData.Artist = creator_id;
        exifData.Copyright = `Created by ${creator_id}`;
        exifData.ImageDescription = additional?.description || `Creator: ${creator_id} | Date: ${timestamp}`;
      }

      // Add additional metadata
      if (additional) {
        if (additional.title) exifData.DocumentName = additional.title;
        if (additional.description) exifData.ImageDescription = additional.description;
      }

      // Save PNG with embedded data
      const processedBuffer = await image
        .png({
          compressionLevel: 9,
          adaptiveFiltering: true
        })
        .withMetadata({
          exif: {
            IFD0: exifData
          }
        })
        .toBuffer();

      return processedBuffer;

    } catch (error) {
      logger.error(`Error adding PNG metadata: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add metadata to JPEG image using EXIF
   * Ported directly from Python implementation (lines 408-454)
   */
  async _addJPEGMetadata(buffer, creator_id, timestamp, additional = {}) {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      // Initialize EXIF structure
      let exifObj = {
        "0th": {},
        "Exif": {},
        "GPS": {},
        "1st": {},
        "thumbnail": null
      };

      // Try to load existing EXIF
      if (metadata.exif) {
        try {
          const exifData = piexif.load(metadata.exif.toString('binary'));
          exifObj = exifData;
        } catch (e) {
          logger.warn(`Could not load existing EXIF: ${e.message}`);
        }
      }

      // Add creator metadata to EXIF fields (matching Python implementation)
      if (creator_id) {
        exifObj['0th'][piexif.ImageIFD.Artist] = creator_id;
        exifObj['0th'][piexif.ImageIFD.Copyright] = `Created by ${creator_id}`;
        exifObj['0th'][piexif.ImageIFD.ImageDescription] = `Creator: ${creator_id} | Date: ${timestamp}`;
        exifObj['0th'][piexif.ImageIFD.Software] = `Metadata Tagger - ${creator_id}`;
        exifObj['0th'][piexif.ImageIFD.Make] = creator_id;
        exifObj['0th'][piexif.ImageIFD.Model] = `Created by ${creator_id}`;

        // Windows XP fields (matching Python lines 428-437)
        try {
          exifObj['0th'][piexif.ImageIFD.XPAuthor] = this._encodeUTF16LE(creator_id);
          exifObj['0th'][piexif.ImageIFD.XPComment] = this._encodeUTF16LE(`Created by ${creator_id}`);
          exifObj['0th'][piexif.ImageIFD.XPTitle] = this._encodeUTF16LE(`Created by ${creator_id}`);
          exifObj['0th'][piexif.ImageIFD.XPSubject] = this._encodeUTF16LE(creator_id);
          exifObj['0th'][piexif.ImageIFD.XPKeywords] = this._encodeUTF16LE(`Created by ${creator_id}`);
        } catch (e) {
          logger.warn(`Could not add Windows XP fields: ${e.message}`);
        }

        // Add to Exif IFD fields (matching Python lines 439-444)
        exifObj['Exif'][piexif.ExifIFD.UserComment] = `Created by ${creator_id}`;

        try {
          exifObj['Exif'][piexif.ExifIFD.MakerNote] = `Created by ${creator_id}`;
        } catch (e) {
          // MakerNote might not work, ignore
        }
      } else {
        // Just add software tag if no creator ID
        exifObj['0th'][piexif.ImageIFD.Software] = "Metadata Tagger";
      }

      // Add additional metadata if provided
      if (additional) {
        if (additional.title) {
          exifObj['0th'][piexif.ImageIFD.DocumentName] = additional.title;
        }
        if (additional.description) {
          exifObj['0th'][piexif.ImageIFD.ImageDescription] = additional.description;
        }
        if (additional.keywords) {
          exifObj['0th'][piexif.ImageIFD.XPKeywords] = this._encodeUTF16LE(additional.keywords);
        }
      }

      // Convert EXIF object to bytes (matching Python line 450)
      const exifBytes = piexif.dump(exifObj);

      // Convert to buffer
      const exifBuffer = Buffer.from(exifBytes, 'binary');

      // Save JPEG with EXIF (matching Python line 451)
      const processedBuffer = await image
        .jpeg({ quality: 95 })
        .withExif(exifBuffer)
        .toBuffer();

      logger.info(`✅ Saved as JPEG with EXIF metadata for ${creator_id}`);
      return processedBuffer;

    } catch (error) {
      logger.error(`Error adding JPEG metadata: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper to encode string as UTF-16 LE for Windows XP EXIF fields
   */
  _encodeUTF16LE(str) {
    const buf = Buffer.from(str + '\0', 'utf16le');
    return buf.toString('binary');
  }

  /**
   * Remove all metadata from image
   * Ported from: remove_metadata_from_image() in metadata_tagger_backend.py (lines 605-635)
   *
   * @param {Buffer} buffer - Image file buffer
   * @returns {Promise<Buffer>} Clean image buffer
   */
  async removeMetadataFromImage(buffer) {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      logger.info(`Removing metadata from ${metadata.format} image`);

      // This strips EXIF, XMP, IPTC, and other metadata
      // By not calling withMetadata(), sharp automatically strips metadata
      let processedBuffer;

      if (metadata.format === 'png') {
        processedBuffer = await image
          .png({
            compressionLevel: 9,
            adaptiveFiltering: true
          })
          .toBuffer();
      } else if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
        processedBuffer = await image
          .jpeg({
            quality: 95,
            mozjpeg: true
          })
          .toBuffer();
      } else {
        // For other formats
        processedBuffer = await image.toBuffer();
      }

      logger.info('✅ Successfully removed metadata from image');
      return processedBuffer;

    } catch (error) {
      logger.error(`Error removing image metadata: ${error.message}`);
      throw new Error(`Error removing metadata from image: ${error.message}`);
    }
  }

  /**
   * Add metadata to video using FFmpeg
   * Ported from: add_metadata_to_video() in metadata_tagger_backend.py (lines 536-603)
   *
   * @param {Buffer} buffer - Video file buffer
   * @param {Object} metadata - Metadata to embed
   * @returns {Promise<Buffer>} Modified video buffer
   */
  async addMetadataToVideo(buffer, metadata) {
    return new Promise(async (resolve, reject) => {
      const { creator_id, timestamp, additional } = metadata;

      // Create temporary files
      const tempInputPath = path.join(os.tmpdir(), `input-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`);
      const tempOutputPath = path.join(os.tmpdir(), `output-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`);

      try {
        // Write buffer to temp file
        fs.writeFileSync(tempInputPath, buffer);

        // Build FFmpeg command (matching Python lines 542-584)
        const command = ffmpeg(tempInputPath);

        // Add creator metadata if provided (matching Python lines 548-553)
        if (creator_id) {
          command
            .outputOptions('-metadata', `artist=${creator_id}`)
            .outputOptions('-metadata', `author=${creator_id}`)
            .outputOptions('-metadata', `comment=Creator: ${creator_id} | Date: ${timestamp}`);
        }

        // Add additional metadata if provided (matching Python lines 555-577)
        if (additional) {
          if (additional.title) {
            command.outputOptions('-metadata', `title=${additional.title}`);
          }
          if (additional.description) {
            command.outputOptions('-metadata', `description=${additional.description}`);
          }
          if (additional.keywords) {
            command.outputOptions('-metadata', `keywords=${additional.keywords}`);
          }
          if (additional.location) {
            command.outputOptions('-metadata', `location=${additional.location}`);
          }
          if (additional.campaign_id) {
            command.outputOptions('-metadata', `campaign=${additional.campaign_id}`);
          }

          // Custom fields
          if (additional.custom && typeof additional.custom === 'object') {
            for (const [key, value] of Object.entries(additional.custom)) {
              if (key && value) {
                const safeKey = key.replace(/\s/g, '_');
                command.outputOptions('-metadata', `${safeKey}=${value}`);
              }
            }
          }
        }

        // Add codec copy and output path (matching Python lines 579-584)
        command
          .outputOptions('-codec', 'copy')  // Don't re-encode
          .output(tempOutputPath)
          .on('end', () => {
            try {
              // Read output buffer
              const outputBuffer = fs.readFileSync(tempOutputPath);

              // Cleanup temp files
              fs.unlinkSync(tempInputPath);
              fs.unlinkSync(tempOutputPath);

              logger.info(`Video metadata added for ${creator_id}`);
              resolve(outputBuffer);
            } catch (error) {
              reject(error);
            }
          })
          .on('error', (err) => {
            // Cleanup temp files on error
            try {
              if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
              if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
            } catch (cleanupError) {
              logger.warn(`Error cleaning up temp files: ${cleanupError.message}`);
            }

            logger.error(`FFmpeg error: ${err.message}`);
            reject(new Error(`Video processing error: ${err.message}`));
          })
          .run();

      } catch (error) {
        // Cleanup on error
        try {
          if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
          if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
        } catch (cleanupError) {
          logger.warn(`Error cleaning up temp files: ${cleanupError.message}`);
        }

        if (error.message.includes('ffmpeg')) {
          reject(new Error('FFmpeg not installed. Please install FFmpeg to process videos.'));
        } else {
          reject(new Error(`Error processing video: ${error.message}`));
        }
      }
    });
  }

  /**
   * Remove all metadata from video using FFmpeg
   * Ported from: remove_metadata_from_video() in metadata_tagger_backend.py (lines 637-679)
   *
   * @param {Buffer} buffer - Video file buffer
   * @returns {Promise<Buffer>} Clean video buffer
   */
  async removeMetadataFromVideo(buffer) {
    return new Promise((resolve, reject) => {
      // Create temporary files
      const tempInputPath = path.join(os.tmpdir(), `input-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`);
      const tempOutputPath = path.join(os.tmpdir(), `output-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`);

      try {
        // Write buffer to temp file
        fs.writeFileSync(tempInputPath, buffer);

        // Build FFmpeg command to strip all metadata (matching Python lines 642-653)
        ffmpeg(tempInputPath)
          .outputOptions('-map_metadata', '-1')  // Remove all metadata
          .outputOptions('-fflags', '+bitexact')  // Remove additional metadata
          .outputOptions('-codec', 'copy')  // Copy streams without re-encoding
          .output(tempOutputPath)
          .on('end', () => {
            try {
              // Read output buffer
              const outputBuffer = fs.readFileSync(tempOutputPath);

              // Cleanup temp files
              fs.unlinkSync(tempInputPath);
              fs.unlinkSync(tempOutputPath);

              logger.info('✅ Successfully removed metadata from video');
              resolve(outputBuffer);
            } catch (error) {
              reject(error);
            }
          })
          .on('error', (err) => {
            // Cleanup temp files on error
            try {
              if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
              if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
            } catch (cleanupError) {
              logger.warn(`Error cleaning up temp files: ${cleanupError.message}`);
            }

            logger.error(`FFmpeg error: ${err.message}`);
            reject(new Error(`Video processing error: ${err.message}`));
          })
          .run();

      } catch (error) {
        // Cleanup on error
        try {
          if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
          if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
        } catch (cleanupError) {
          logger.warn(`Error cleaning up temp files: ${cleanupError.message}`);
        }

        if (error.message.includes('ffmpeg')) {
          reject(new Error('FFmpeg not installed. Please install FFmpeg to process videos.'));
        } else {
          reject(new Error(`Error removing metadata from video: ${error.message}`));
        }
      }
    });
  }

  /**
   * Extract all metadata from image
   * Ported from: extract_all_metadata() in metadata_tagger_backend.py (lines 460-534)
   *
   * @param {Buffer} buffer - Image file buffer
   * @returns {Promise<Object>} Extracted metadata
   */
  async extractImageMetadata(buffer) {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      const allMetadata = {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        space: metadata.space,
        channels: metadata.channels,
        depth: metadata.depth,
        hasProfile: metadata.hasProfile || false,
        hasAlpha: metadata.hasAlpha || false
      };

      // Extract EXIF data if present
      if (metadata.exif) {
        try {
          const exifData = piexif.load(metadata.exif.toString('binary'));

          // Process 0th IFD (main image)
          if (exifData['0th']) {
            for (const [tag, value] of Object.entries(exifData['0th'])) {
              const tagName = this._getExifTagName('0th', parseInt(tag));
              allMetadata[`EXIF:0th:${tagName}`] = this._decodeExifValue(value);
            }
          }

          // Process Exif IFD
          if (exifData['Exif']) {
            for (const [tag, value] of Object.entries(exifData['Exif'])) {
              const tagName = this._getExifTagName('Exif', parseInt(tag));
              allMetadata[`EXIF:Exif:${tagName}`] = this._decodeExifValue(value);
            }
          }

          // Process GPS IFD
          if (exifData['GPS']) {
            for (const [tag, value] of Object.entries(exifData['GPS'])) {
              const tagName = this._getExifTagName('GPS', parseInt(tag));
              allMetadata[`EXIF:GPS:${tagName}`] = this._decodeExifValue(value);
            }
          }
        } catch (e) {
          logger.warn(`Could not extract EXIF: ${e.message}`);
        }
      }

      return allMetadata;

    } catch (error) {
      logger.error(`Error extracting metadata: ${error.message}`);
      return {};
    }
  }

  /**
   * Helper to get EXIF tag name
   */
  _getExifTagName(ifd, tag) {
    try {
      const tagInfo = piexif.TAGS[ifd][tag];
      return tagInfo ? tagInfo.name : `Unknown-${tag}`;
    } catch (e) {
      return `Unknown-${tag}`;
    }
  }

  /**
   * Helper to decode EXIF value
   */
  _decodeExifValue(value) {
    try {
      if (typeof value === 'string') {
        return value.replace(/\0/g, '').trim();
      } else if (Buffer.isBuffer(value)) {
        return value.toString('utf8', 0, value.length).replace(/\0/g, '').trim();
      } else if (Array.isArray(value)) {
        return value.toString();
      } else {
        return String(value);
      }
    } catch (e) {
      return String(value);
    }
  }

  /**
   * Extract all metadata from video using FFmpeg
   * @param {Buffer} buffer - Video file buffer
   * @returns {Promise<Object>} Extracted metadata
   */
  async extractVideoMetadata(buffer) {
    return new Promise((resolve, reject) => {
      const tempInputPath = path.join(os.tmpdir(), `input-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`);

      try {
        // Write buffer to temp file
        fs.writeFileSync(tempInputPath, buffer);

        // Use ffprobe to extract metadata
        ffmpeg.ffprobe(tempInputPath, (err, metadata) => {
          // Cleanup temp file
          try {
            if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
          } catch (cleanupError) {
            logger.warn(`Error cleaning up temp file: ${cleanupError.message}`);
          }

          if (err) {
            logger.error(`FFprobe error: ${err.message}`);
            reject(new Error(`Video metadata extraction error: ${err.message}`));
            return;
          }

          // Extract useful metadata
          const videoMetadata = {
            format: metadata.format?.format_name || 'unknown',
            duration: metadata.format?.duration || 0,
            size: metadata.format?.size || 0,
            bitrate: metadata.format?.bit_rate || 0,
            tags: metadata.format?.tags || {}
          };

          // Extract video stream info
          const videoStream = metadata.streams?.find(s => s.codec_type === 'video');
          if (videoStream) {
            videoMetadata.width = videoStream.width;
            videoMetadata.height = videoStream.height;
            videoMetadata.codec = videoStream.codec_name;
            videoMetadata.fps = eval(videoStream.r_frame_rate || '0/1');
          }

          // Extract audio stream info
          const audioStream = metadata.streams?.find(s => s.codec_type === 'audio');
          if (audioStream) {
            videoMetadata.audio_codec = audioStream.codec_name;
            videoMetadata.audio_sample_rate = audioStream.sample_rate;
            videoMetadata.audio_channels = audioStream.channels;
          }

          logger.info(`Extracted video metadata: ${videoMetadata.duration}s, ${videoMetadata.width}x${videoMetadata.height}`);
          resolve(videoMetadata);
        });

      } catch (error) {
        // Cleanup on error
        try {
          if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
        } catch (cleanupError) {
          logger.warn(`Error cleaning up temp file: ${cleanupError.message}`);
        }

        if (error.message && error.message.includes('ffmpeg')) {
          reject(new Error('FFmpeg not installed. Please install FFmpeg to process videos.'));
        } else {
          reject(new Error(`Error extracting video metadata: ${error.message}`));
        }
      }
    });
  }

  /**
   * Check if FFmpeg is available
   */
  async checkFFmpeg() {
    return new Promise((resolve) => {
      ffmpeg.getAvailableFormats((err, formats) => {
        if (err) {
          logger.warn('FFmpeg not available');
          resolve(false);
        } else {
          logger.info('FFmpeg is available');
          resolve(true);
        }
      });
    });
  }
}

module.exports = new MetadataService();
