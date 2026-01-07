/**
 * Folder Controller
 * Handles folder CRUD operations and file organization
 */

const Folder = require('../models/Folder');
const MediaFile = require('../models/MediaFile');
const logger = require('../utils/logger');

class FolderController {
  /**
   * Create new folder
   * POST /api/folders
   */
  async createFolder(req, res, next) {
    try {
      const { name, parent_folder_id, description, color } = req.body;

      // Validate name
      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Folder name is required'
        });
      }

      // If parent specified, verify access
      if (parent_folder_id) {
        const parent = await Folder.findById(parent_folder_id);
        if (!parent) {
          return res.status(404).json({
            success: false,
            error: 'Parent folder not found'
          });
        }

        const hasAccess = await Folder.canAccess(req.user.id, parent_folder_id, 'edit');
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            error: 'No permission to create folder here'
          });
        }
      }

      // Create folder
      const folder = await Folder.create({
        name: name.trim(),
        parent_folder_id: parent_folder_id || null,
        owner_id: req.user.id,
        description,
        color,
        folder_type: 'user' // User-created folder
      });

      logger.info('Folder created', {
        folder_id: folder.id,
        name: folder.name,
        user_id: req.user.id
      });

      res.status(201).json({
        success: true,
        data: folder
      });
    } catch (error) {
      logger.error('Create folder failed', {
        error: error.message,
        user_id: req.user.id
      });
      next(error);
    }
  }

  /**
   * Get folder tree (hierarchical structure)
   * GET /api/folders/tree
   */
  async getFolderTree(req, res, next) {
    try {
      const { parent_id, include_deleted } = req.query;

      const folders = await Folder.getTree(req.user.id, {
        parent_id: parent_id || null,
        include_deleted: req.user.role === 'admin' && include_deleted === 'true'
      });

      res.json({
        success: true,
        data: folders
      });
    } catch (error) {
      logger.error('Get folder tree failed', {
        error: error.message,
        user_id: req.user.id
      });
      next(error);
    }
  }

  /**
   * Get single folder details
   * GET /api/folders/:id
   */
  async getFolder(req, res, next) {
    try {
      const { id } = req.params;

      const folder = await Folder.findById(id);
      if (!folder) {
        return res.status(404).json({
          success: false,
          error: 'Folder not found'
        });
      }

      // Check access
      const hasAccess = await Folder.canAccess(req.user.id, id, 'view');
      if (!hasAccess && folder.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      res.json({
        success: true,
        data: folder
      });
    } catch (error) {
      logger.error('Get folder failed', {
        error: error.message,
        folder_id: req.params.id
      });
      next(error);
    }
  }

  /**
   * Get folder contents (subfolders + files)
   * GET /api/folders/:id/contents
   */
  async getFolderContents(req, res, next) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 50, file_type } = req.query;

      // Check access
      const hasAccess = await Folder.canAccess(req.user.id, id, 'view');
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const contents = await Folder.getContents(id, req.user.id, {
        page: parseInt(page),
        limit: parseInt(limit),
        file_type
      });

      res.json({
        success: true,
        data: contents
      });
    } catch (error) {
      logger.error('Get folder contents failed', {
        error: error.message,
        folder_id: req.params.id
      });
      next(error);
    }
  }

  /**
   * Get folder breadcrumb (navigation path)
   * GET /api/folders/:id/breadcrumb
   */
  async getBreadcrumb(req, res, next) {
    try {
      const { id } = req.params;

      const breadcrumb = await Folder.getBreadcrumb(id);

      res.json({
        success: true,
        data: breadcrumb
      });
    } catch (error) {
      logger.error('Get breadcrumb failed', {
        error: error.message,
        folder_id: req.params.id
      });
      next(error);
    }
  }

  /**
   * Update folder (rename, change description, color)
   * PATCH /api/folders/:id
   */
  async updateFolder(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description, color } = req.body;

      const updates = {};
      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = description;
      if (color !== undefined) updates.color = color;

      const folder = await Folder.updateFolder(id, updates, req.user.id);

      logger.info('Folder updated', {
        folder_id: id,
        updates,
        user_id: req.user.id
      });

      res.json({
        success: true,
        data: folder
      });
    } catch (error) {
      logger.error('Update folder failed', {
        error: error.message,
        folder_id: req.params.id
      });

      if (error.message.includes('No permission')) {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }

      next(error);
    }
  }

  /**
   * Delete folder
   * DELETE /api/folders/:id
   */
  async deleteFolder(req, res, next) {
    try {
      const { id } = req.params;
      const { delete_contents = false } = req.query;

      await Folder.deleteFolder(
        id,
        req.user.id,
        delete_contents === 'true'
      );

      logger.info('Folder deleted', {
        folder_id: id,
        delete_contents,
        user_id: req.user.id
      });

      res.json({
        success: true,
        message: 'Folder deleted successfully'
      });
    } catch (error) {
      logger.error('Delete folder failed', {
        error: error.message,
        folder_id: req.params.id
      });

      if (error.message.includes('not empty')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      if (error.message.includes('No permission')) {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }

      next(error);
    }
  }

  /**
   * Move files to target folder
   * POST /api/folders/move-files
   */
  async moveFiles(req, res, next) {
    try {
      const { file_ids, target_folder_id } = req.body;

      if (!Array.isArray(file_ids) || file_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'file_ids must be a non-empty array'
        });
      }

      const movedFiles = await Folder.moveFiles(
        file_ids,
        target_folder_id,
        req.user.id
      );

      // Log operation
      await this.logOperation({
        user_id: req.user.id,
        operation_type: 'file_move',
        target_folder_id,
        file_ids: movedFiles.map(f => f.id),
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      logger.info('Files moved', {
        count: movedFiles.length,
        target_folder_id,
        user_id: req.user.id
      });

      res.json({
        success: true,
        data: {
          moved_count: movedFiles.length,
          files: movedFiles
        }
      });
    } catch (error) {
      logger.error('Move files failed', {
        error: error.message,
        user_id: req.user.id
      });

      if (error.message.includes('No permission')) {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }

      next(error);
    }
  }

  /**
   * Copy files to target folder
   * POST /api/folders/copy-files
   */
  async copyFiles(req, res, next) {
    try {
      const { file_ids, target_folder_id } = req.body;

      if (!Array.isArray(file_ids) || file_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'file_ids must be a non-empty array'
        });
      }

      const copiedFiles = await Folder.copyFiles(
        file_ids,
        target_folder_id,
        req.user.id
      );

      // Log operation
      await this.logOperation({
        user_id: req.user.id,
        operation_type: 'file_copy',
        target_folder_id,
        file_ids: copiedFiles.map(f => f.id),
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      logger.info('Files copied', {
        count: copiedFiles.length,
        target_folder_id,
        user_id: req.user.id
      });

      res.json({
        success: true,
        data: {
          copied_count: copiedFiles.length,
          files: copiedFiles
        }
      });
    } catch (error) {
      logger.error('Copy files failed', {
        error: error.message,
        user_id: req.user.id
      });

      if (error.message.includes('No permission')) {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }

      next(error);
    }
  }

  /**
   * Create or get date-based folder structure
   * POST /api/folders/date-folder
   * Body: { date: '2024-01-15', parent_folder_id?: uuid }
   * Creates: jan2024/15-jan/
   */
  async createDateFolder(req, res, next) {
    try {
      const { date, parent_folder_id } = req.body;
      const uploadDate = date ? new Date(date) : new Date();

      // Create month folder (e.g., "jan2024")
      const monthName = uploadDate.toLocaleString('en-US', { month: 'short' }).toLowerCase();
      const year = uploadDate.getFullYear();
      const monthFolderName = `${monthName}${year}`;

      let monthFolder = await this.findOrCreateFolder(
        monthFolderName,
        parent_folder_id,
        req.user.id,
        'date'
      );

      // Create day folder (e.g., "01-jan")
      const day = String(uploadDate.getDate()).padStart(2, '0');
      const dayFolderName = `${day}-${monthName}`;

      let dayFolder = await this.findOrCreateFolder(
        dayFolderName,
        monthFolder.id,
        req.user.id,
        'date'
      );

      res.json({
        success: true,
        data: {
          month_folder: monthFolder,
          day_folder: dayFolder
        }
      });
    } catch (error) {
      logger.error('Create date folder failed', {
        error: error.message,
        user_id: req.user.id
      });
      next(error);
    }
  }

  /**
   * Helper: Find or create folder
   */
  async findOrCreateFolder(name, parentId, ownerId, folderType = 'user') {
    const { query } = require('../config/database');

    // Try to find existing
    const existing = await query(
      `SELECT * FROM folders
       WHERE name = $1
         AND parent_folder_id ${parentId ? '= $2' : 'IS NULL'}
         AND owner_id = $${parentId ? 3 : 2}
         AND is_deleted = FALSE
       LIMIT 1`,
      parentId ? [name, parentId, ownerId] : [name, ownerId]
    );

    if ((existing.rows || existing).length > 0) {
      return (existing.rows || existing)[0];
    }

    // Create new
    return await Folder.create({
      name,
      parent_folder_id: parentId,
      owner_id: ownerId,
      folder_type: folderType,
      is_auto_created: folderType === 'date'
    });
  }

  /**
   * Rename folder
   * PATCH /api/folders/:id/rename
   */
  async renameFolder(req, res, next) {
    try {
      const { id } = req.params;
      const { new_name } = req.body;

      // Validate name
      if (!new_name || new_name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'new_name is required'
        });
      }

      // Get folder
      const folder = await Folder.findById(id);
      if (!folder) {
        return res.status(404).json({
          success: false,
          error: 'Folder not found'
        });
      }

      // Check permissions
      const hasAccess = await Folder.canAccess(req.user.id, id, 'edit');
      if (!hasAccess && folder.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'No permission to rename this folder'
        });
      }

      const oldName = folder.name;
      const newName = new_name.trim();

      // If name hasn't changed, no need to do anything
      if (oldName === newName) {
        return res.json({
          success: true,
          message: 'Folder name unchanged',
          data: folder
        });
      }

      // Update folder name
      const updatedFolder = await Folder.update(id, { name: newName });

      logger.info('Folder renamed', {
        folder_id: id,
        old_name: oldName,
        new_name: newName,
        user_id: req.user.id
      });

      res.json({
        success: true,
        message: 'Folder renamed successfully',
        data: updatedFolder
      });
    } catch (error) {
      logger.error('Rename folder failed', {
        error: error.message,
        folder_id: req.params.id
      });
      next(error);
    }
  }

  /**
   * Download folder as ZIP
   * GET /api/folders/:id/download
   */
  async downloadFolder(req, res, next) {
    try {
      const { id } = req.params;
      const archiver = require('archiver');
      const axios = require('axios');
      const { query } = require('../config/database');

      // Check folder access
      const folder = await Folder.findById(id);
      if (!folder) {
        return res.status(404).json({
          success: false,
          error: 'Folder not found'
        });
      }

      const hasAccess = await Folder.canAccess(req.user.id, id, 'view');
      if (!hasAccess && folder.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Get all files in folder and subfolders recursively
      const sql = `
        WITH RECURSIVE folder_tree AS (
          -- Base case: starting folder
          SELECT id, name, parent_folder_id, s3_path,
                 CAST(name AS TEXT) as full_path
          FROM folders
          WHERE id = $1

          UNION ALL

          -- Recursive case: child folders
          SELECT f.id, f.name, f.parent_folder_id, f.s3_path,
                 CAST(ft.full_path || '/' || f.name AS TEXT) as full_path
          FROM folders f
          INNER JOIN folder_tree ft ON f.parent_folder_id = ft.id
          WHERE f.is_deleted = FALSE
        )
        SELECT
          mf.id,
          mf.original_filename,
          mf.s3_url,
          mf.download_url,
          mf.file_size,
          COALESCE(ft.full_path, '') as folder_path
        FROM media_files mf
        LEFT JOIN folder_tree ft ON mf.folder_id = ft.id
        WHERE mf.folder_id IN (SELECT id FROM folder_tree)
          AND mf.is_deleted = FALSE
        ORDER BY folder_path, mf.original_filename;
      `;

      const result = await query(sql, [id]);
      const files = result.rows || result;

      if (files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Folder contains no files'
        });
      }

      // Generate ZIP filename with date
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const zipFilename = `${folder.name}-${date}.zip`;

      // Set response headers
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

      // Create ZIP archive
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      // Handle archive errors
      archive.on('error', (err) => {
        logger.error('Archive error', { error: err.message, folder_id: id });
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Failed to create ZIP archive'
          });
        }
      });

      // Pipe archive to response
      archive.pipe(res);

      // Add files to archive
      for (const file of files) {
        try {
          const fileUrl = file.s3_url || file.download_url;
          if (!fileUrl) continue;

          // Download file from S3
          const response = await axios({
            method: 'get',
            url: fileUrl,
            responseType: 'stream'
          });

          // Determine file path in ZIP
          let zipPath = file.original_filename;
          if (file.folder_path && file.folder_path !== folder.name) {
            // Remove the root folder name from path to avoid duplication
            const relativePath = file.folder_path.replace(folder.name, '').replace(/^\//, '');
            if (relativePath) {
              zipPath = `${relativePath}/${file.original_filename}`;
            }
          }

          // Add file to archive
          archive.append(response.data, { name: zipPath });

        } catch (error) {
          logger.error('Failed to add file to archive', {
            error: error.message,
            file_id: file.id,
            filename: file.original_filename
          });
          // Continue with other files
        }
      }

      // Finalize archive
      await archive.finalize();

      logger.info('Folder downloaded as ZIP', {
        folder_id: id,
        folder_name: folder.name,
        file_count: files.length,
        user_id: req.user.id
      });

    } catch (error) {
      logger.error('Download folder failed', {
        error: error.message,
        folder_id: req.params.id
      });

      if (!res.headersSent) {
        next(error);
      }
    }
  }

  /**
   * Get sibling folders (folders at same level as current folder)
   * GET /api/folders/:id/siblings
   */
  async getSiblings(req, res, next) {
    try {
      const { id } = req.params;

      // Get current folder
      const folder = await Folder.findById(id);
      if (!folder) {
        return res.status(404).json({
          success: false,
          error: 'Folder not found'
        });
      }

      // Check access to current folder
      const hasAccess = await Folder.canAccess(req.user.id, id, 'view');
      if (!hasAccess && folder.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Get siblings (folders with same parent)
      const siblings = await Folder.getSiblings(id, req.user.id, folder.parent_folder_id);

      res.json({
        success: true,
        data: {
          siblings,
          current_folder_id: id
        }
      });
    } catch (error) {
      logger.error('Get siblings failed', {
        error: error.message,
        folder_id: req.params.id
      });
      next(error);
    }
  }

  /**
   * Helper: Log file operation
   */
  async logOperation(data) {
    const { query } = require('../config/database');

    try {
      await query(
        `INSERT INTO file_operations_log (
          user_id, operation_type, source_folder_id, target_folder_id,
          file_ids, metadata, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          data.user_id,
          data.operation_type,
          data.source_folder_id || null,
          data.target_folder_id || null,
          JSON.stringify(data.file_ids || []),
          JSON.stringify(data.metadata || {}),
          data.ip_address,
          data.user_agent
        ]
      );
    } catch (error) {
      logger.error('Log operation failed', { error: error.message });
      // Don't throw - logging failure shouldn't break the operation
    }
  }
}

module.exports = new FolderController();
