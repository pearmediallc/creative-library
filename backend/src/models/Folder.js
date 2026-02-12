/**
 * Folder Model
 * Handles hierarchical folder structure with permissions
 */

const BaseModel = require('./BaseModel');
const { query } = require('../config/database');
const logger = require('../utils/logger');

class Folder extends BaseModel {
  constructor() {
    super('folders');
  }

  /**
   * Create folder with S3 path generation
   */
  async create(data) {
    try {
      // Generate S3 path based on parent
      let s3Path = '';
      if (data.parent_folder_id) {
        const parent = await this.findById(data.parent_folder_id);
        if (!parent) {
          throw new Error('Parent folder not found');
        }
        s3Path = `${parent.s3_path}${data.name}/`;
      } else {
        // Root level folder
        s3Path = `${data.name}/`;
      }

      const folderData = {
        ...data,
        s3_path: s3Path
      };

      const result = await super.create(folderData);
      return result;
    } catch (error) {
      logger.error('Folder creation failed', { error: error.message, data });
      throw error;
    }
  }

  /**
   * Get folder tree for user (with permissions)
   * Returns hierarchical structure
   */
  async getTree(userId, options = {}) {
    const { parent_id = null, include_deleted = false } = options;

    try {
      const sql = `
        WITH RECURSIVE folder_tree AS (
          -- Base case: root folders or specified parent
          SELECT
            f.*,
            0 as depth,
            ARRAY[f.id] as path
          FROM folders f
          WHERE f.parent_folder_id ${parent_id ? '= $1' : 'IS NULL'}
            AND f.is_deleted = $${parent_id ? 2 : 1}
            AND (
              -- Owner
              f.owner_id = $${parent_id ? 3 : 2}
              -- Has explicit permission
              OR EXISTS (
                SELECT 1 FROM file_permissions fp
                WHERE fp.resource_type = 'folder'
                  AND fp.resource_id = f.id
                  AND fp.grantee_type = 'user'
                  AND fp.grantee_id = $${parent_id ? 3 : 2}
                  AND (fp.expires_at IS NULL OR fp.expires_at > NOW())
              )
              -- Member of team with access
              OR EXISTS (
                SELECT 1
                FROM file_permissions fp
                JOIN team_members tm ON fp.grantee_id = tm.team_id
                WHERE fp.resource_type = 'folder'
                  AND fp.resource_id = f.id
                  AND fp.grantee_type = 'team'
                  AND tm.user_id = $${parent_id ? 3 : 2}
                  AND (fp.expires_at IS NULL OR fp.expires_at > NOW())
              )
            )

          UNION ALL

          -- Recursive case: child folders
          SELECT
            f.*,
            ft.depth + 1,
            ft.path || f.id
          FROM folders f
          INNER JOIN folder_tree ft ON f.parent_folder_id = ft.id
          WHERE f.is_deleted = $${parent_id ? 2 : 1}
        )
        SELECT * FROM folder_tree
        ORDER BY depth, name;
      `;

      const params = parent_id
        ? [parent_id, include_deleted, userId]
        : [include_deleted, userId];

      const result = await query(sql, params);
      return result.rows || result;
    } catch (error) {
      logger.error('Get folder tree failed', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Check if user can access folder
   */
  async canAccess(userId, folderId, permissionType = 'view') {
    try {
      const sql = `
        SELECT 1
        FROM folders f
        WHERE f.id = $1
          AND (
            -- Owner
            f.owner_id = $2
            -- Team member (for team-owned folders)
            OR (
              f.team_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM team_members tm
                WHERE tm.team_id = f.team_id AND tm.user_id = $2
              )
            )
            -- Has explicit permission
            OR EXISTS (
              SELECT 1 FROM file_permissions fp
              WHERE fp.resource_type = 'folder'
                AND fp.resource_id = f.id
                AND fp.grantee_type = 'user'
                AND fp.grantee_id = $2
                AND fp.permission_type = $3
                AND (fp.expires_at IS NULL OR fp.expires_at > NOW())
            )
            -- File request folders: creator/assigned buyer can access any folder under the request folder
            OR EXISTS (
              WITH RECURSIVE ancestors AS (
                SELECT f2.id, f2.parent_folder_id
                FROM folders f2
                WHERE f2.id = f.id

                UNION ALL

                SELECT f3.id, f3.parent_folder_id
                FROM folders f3
                JOIN ancestors a ON a.parent_folder_id = f3.id
              )
              SELECT 1
              FROM file_requests fr
              WHERE fr.folder_id IN (SELECT id FROM ancestors)
                AND (fr.created_by = $2 OR fr.assigned_buyer_id = $2)
              LIMIT 1
            )
            -- Member of team with access
            OR EXISTS (
              SELECT 1
              FROM file_permissions fp
              JOIN team_members tm ON fp.grantee_id = tm.team_id
              WHERE fp.resource_type = 'folder'
                AND fp.resource_id = f.id
                AND fp.grantee_type = 'team'
                AND tm.user_id = $2
                AND fp.permission_type = $3
                AND (fp.expires_at IS NULL OR fp.expires_at > NOW())
            )
          )
        LIMIT 1;
      `;

      const result = await query(sql, [folderId, userId, permissionType]);
      return (result.rows || result).length > 0;
    } catch (error) {
      logger.error('Check folder access failed', {
        error: error.message,
        userId,
        folderId
      });
      return false;
    }
  }

  /**
   * Get folder breadcrumb path (for UI navigation)
   */
  async getBreadcrumb(folderId) {
    try {
      const sql = `
        WITH RECURSIVE breadcrumb AS (
          SELECT id, name, parent_folder_id, 1 as level
          FROM folders
          WHERE id = $1

          UNION ALL

          SELECT f.id, f.name, f.parent_folder_id, b.level + 1
          FROM folders f
          INNER JOIN breadcrumb b ON f.id = b.parent_folder_id
        )
        SELECT id, name, level
        FROM breadcrumb
        ORDER BY level DESC;
      `;

      const result = await query(sql, [folderId]);
      return result.rows || result;
    } catch (error) {
      logger.error('Get breadcrumb failed', { error: error.message, folderId });
      throw error;
    }
  }

  /**
   * Get sibling folders (folders at same level as current folder)
   */
  async getSiblings(folderId, userId, parentFolderId) {
    try {
      const sql = `
        SELECT
          f.id,
          f.name,
          f.created_at,
          f.color,
          f.description,
          COUNT(mf.id) as file_count
        FROM folders f
        LEFT JOIN media_files mf ON mf.folder_id = f.id AND mf.is_deleted = FALSE
        WHERE f.parent_folder_id ${parentFolderId ? '= $1' : 'IS NULL'}
          AND f.is_deleted = FALSE
          AND (
            -- Owner
            f.owner_id = $${parentFolderId ? 2 : 1}
            -- Has explicit permission
            OR EXISTS (
              SELECT 1 FROM file_permissions fp
              WHERE fp.resource_type = 'folder'
                AND fp.resource_id = f.id
                AND fp.grantee_type = 'user'
                AND fp.grantee_id = $${parentFolderId ? 2 : 1}
                AND (fp.expires_at IS NULL OR fp.expires_at > NOW())
            )
            -- Member of team with access
            OR EXISTS (
              SELECT 1
              FROM file_permissions fp
              JOIN team_members tm ON fp.grantee_id = tm.team_id
              WHERE fp.resource_type = 'folder'
                AND fp.resource_id = f.id
                AND fp.grantee_type = 'team'
                AND tm.user_id = $${parentFolderId ? 2 : 1}
                AND (fp.expires_at IS NULL OR fp.expires_at > NOW())
            )
          )
        GROUP BY f.id, f.name, f.created_at, f.color, f.description
        ORDER BY f.name ASC;
      `;

      const params = parentFolderId ? [parentFolderId, userId] : [userId];
      const result = await query(sql, params);
      return result.rows || result;
    } catch (error) {
      logger.error('Get siblings failed', {
        error: error.message,
        folderId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get folder contents (subfolders + files)
   */
  async getContents(folderId, userId, options = {}) {
    const { page = 1, limit = 50, file_type = null } = options;

    try {
      // Get subfolders
      const foldersResult = await query(
        `SELECT * FROM folders
         WHERE parent_folder_id = $1 AND is_deleted = FALSE
         ORDER BY name`,
        [folderId]
      );

      // Get files with permissions check
      let filesQuery = `
        SELECT mf.*,
               e.name as editor_name,
               u.name as uploaded_by_name
        FROM media_files mf
        LEFT JOIN editors e ON mf.editor_id = e.id
        LEFT JOIN users u ON mf.uploaded_by = u.id
        WHERE mf.folder_id = $1
          AND mf.is_deleted = FALSE
          AND (
            -- Owner
            mf.uploaded_by = $2
            -- Assigned buyer
            OR mf.assigned_buyer_id = $2
            -- Has explicit permission
            OR EXISTS (
              SELECT 1 FROM file_permissions fp
              WHERE fp.resource_type = 'file'
                AND fp.resource_id = mf.id
                AND fp.grantee_type = 'user'
                AND fp.grantee_id = $2
                AND (fp.expires_at IS NULL OR fp.expires_at > NOW())
            )
            -- Team member
            OR EXISTS (
              SELECT 1
              FROM file_permissions fp
              JOIN team_members tm ON fp.grantee_id = tm.team_id
              WHERE fp.resource_type = 'file'
                AND fp.resource_id = mf.id
                AND fp.grantee_type = 'team'
                AND tm.user_id = $2
                AND (fp.expires_at IS NULL OR fp.expires_at > NOW())
            )
            -- Buyer has access via file request folder
            OR EXISTS (
              SELECT 1 FROM file_requests fr
              WHERE fr.folder_id = mf.folder_id
                AND fr.created_by = $2
                AND mf.folder_id IS NOT NULL
            )
          )
      `;

      const params = [folderId, userId];
      if (file_type) {
        filesQuery += ` AND mf.file_type = $3`;
        params.push(file_type);
      }

      filesQuery += ` ORDER BY mf.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, (page - 1) * limit);

      const filesResult = await query(filesQuery, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total
        FROM media_files mf
        WHERE mf.folder_id = $1
          AND mf.is_deleted = FALSE
      `;
      const countParams = [folderId];
      if (file_type) {
        countQuery += ` AND mf.file_type = $2`;
        countParams.push(file_type);
      }

      const countResult = await query(countQuery, countParams);
      const total = parseInt((countResult.rows || countResult)[0].total);

      return {
        folders: foldersResult.rows || foldersResult,
        files: filesResult.rows || filesResult,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Get folder contents failed', {
        error: error.message,
        folderId
      });
      throw error;
    }
  }

  /**
   * Move files to target folder
   */
  async moveFiles(fileIds, targetFolderId, userId) {
    try {
      // Verify target folder access (skip check if root/null)
      if (targetFolderId) {
        const hasAccess = await this.canAccess(userId, targetFolderId, 'edit');
        if (!hasAccess) {
          throw new Error('No permission to target folder');
        }
      }

      const result = await query(
        `UPDATE media_files
         SET folder_id = $1, updated_at = NOW()
         WHERE id = ANY($2::uuid[])
           AND (uploaded_by = $3 OR EXISTS (
             SELECT 1 FROM users WHERE id = $3 AND role = 'admin'
           ))
         RETURNING id`,
        [targetFolderId, fileIds, userId]
      );

      return result.rows || result;
    } catch (error) {
      logger.error('Move files failed', {
        error: error.message,
        fileIds,
        targetFolderId
      });
      throw error;
    }
  }

  /**
   * Copy files to target folder
   */
  async copyFiles(fileIds, targetFolderId, userId) {
    try {
      // Check access to target folder (skip check if root/null)
      if (targetFolderId) {
        const hasAccess = await this.canAccess(userId, targetFolderId, 'edit');
        if (!hasAccess) {
          throw new Error('No permission to target folder');
        }
      }

      // Get original files
      const originalFiles = await query(
        `SELECT * FROM media_files
         WHERE id = ANY($1::uuid[])`,
        [fileIds]
      );

      const copiedFiles = [];

      for (const file of (originalFiles.rows || originalFiles)) {
        // Create copy with new ID
        const result = await query(
          `INSERT INTO media_files (
            filename, original_filename, s3_url, s3_key, thumbnail_url,
            file_type, mime_type, file_size, width, height, duration,
            editor_id, editor_name, uploaded_by, folder_id,
            tags, description, campaign_hint
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
          ) RETURNING *`,
          [
            file.filename,
            file.original_filename + ' (copy)',
            file.s3_url,
            file.s3_key,
            file.thumbnail_url,
            file.file_type,
            file.mime_type,
            file.file_size,
            file.width,
            file.height,
            file.duration,
            file.editor_id,
            file.editor_name,
            userId, // New uploader
            targetFolderId,
            file.tags,
            file.description,
            file.campaign_hint
          ]
        );

        copiedFiles.push((result.rows || result)[0]);
      }

      return copiedFiles;
    } catch (error) {
      logger.error('Copy files failed', {
        error: error.message,
        fileIds,
        targetFolderId
      });
      throw error;
    }
  }

  /**
   * Update folder (rename, change description, etc.)
   */
  async updateFolder(folderId, updates, userId, userRole = null) {
    try {
      // Verify ownership or admin
      const folder = await this.findById(folderId);
      if (!folder) {
        throw new Error('Folder not found');
      }

      const isAdmin = userRole === 'admin' || userRole === 'super_admin';
      const hasPermission = folder.owner_id === userId || await this.canAccess(userId, folderId, 'edit') || isAdmin;
      if (!hasPermission) {
        throw new Error('No permission to update folder');
      }

      // If name changed, update S3 path for this folder and all descendants
      if (updates.name && updates.name !== folder.name) {
        // Update S3 path
        const oldPath = folder.s3_path;
        const newPath = folder.s3_path.replace(
          new RegExp(`${folder.name}/$`),
          `${updates.name}/`
        );

        // Update this folder
        await super.update(folderId, {
          ...updates,
          s3_path: newPath
        });

        // Update all descendant folders
        await query(
          `UPDATE folders
           SET s3_path = REPLACE(s3_path, $1, $2)
           WHERE s3_path LIKE $3`,
          [oldPath, newPath, `${oldPath}%`]
        );

        return { ...folder, ...updates, s3_path: newPath };
      }

      // Regular update
      return await super.update(folderId, updates);
    } catch (error) {
      logger.error('Update folder failed', {
        error: error.message,
        folderId,
        updates
      });
      throw error;
    }
  }

  /**
   * Soft delete folder (and optionally all contents)
   */
  async deleteFolder(folderId, userId, deleteContents = false, userRole = null) {
    try {
      const folder = await this.findById(folderId);
      if (!folder) {
        throw new Error('Folder not found');
      }

      const isAdmin = userRole === 'admin' || userRole === 'super_admin';
      const hasPermission = folder.owner_id === userId || await this.canAccess(userId, folderId, 'delete') || isAdmin;
      if (!hasPermission) {
        throw new Error('No permission to delete folder');
      }

      // Check if folder has contents
      const contents = await this.getContents(folderId, userId);
      if ((contents.folders.length > 0 || contents.files.length > 0) && !deleteContents) {
        throw new Error('Folder is not empty. Set deleteContents=true to delete recursively.');
      }

      // Soft delete
      if (deleteContents) {
        // Delete all files in folder
        await query(
          `UPDATE media_files
           SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $1
           WHERE folder_id = $2`,
          [userId, folderId]
        );

        // Delete all subfolders recursively
        await query(
          `WITH RECURSIVE folder_tree AS (
            SELECT id FROM folders WHERE id = $1
            UNION ALL
            SELECT f.id FROM folders f
            INNER JOIN folder_tree ft ON f.parent_folder_id = ft.id
          )
          UPDATE folders
          SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $2
          WHERE id IN (SELECT id FROM folder_tree)`,
          [folderId, userId]
        );
      } else {
        // Just delete the folder
        await super.update(folderId, {
          is_deleted: true,
          deleted_at: new Date(),
          deleted_by: userId
        });
      }

      return { success: true };
    } catch (error) {
      logger.error('Delete folder failed', {
        error: error.message,
        folderId
      });
      throw error;
    }
  }

  /**
   * Get or create file request folder with user name + date format
   * Format: "UserName-YYYY-MM-DD" (e.g., "Jaun-2026-01-24")
   * Reuses same folder if multiple requests created on same day by same user
   *
   * @param {string} userId - User ID creating the request
   * @param {string} userName - User's display name
   * @param {string} parentFolderId - Optional parent folder ID (defaults to root)
   * @returns {Promise<Object>} Folder object
   */
  async getOrCreateRequestFolder(userId, userName, parentFolderId = null) {
    try {
      // Fetch user name from database if not provided
      if (!userName) {
        const userResult = await query(
          'SELECT name, email FROM users WHERE id = $1',
          [userId]
        );
        if (userResult.rows.length > 0) {
          userName = userResult.rows[0].name || userResult.rows[0].email.split('@')[0];
        } else {
          userName = 'User';
        }
      }

      // Generate folder name with format: UserName-YYYY-MM-DD
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
      const sanitizedName = userName.trim().replace(/\s+/g, '-'); // Replace spaces with hyphens
      const folderName = `${sanitizedName}-${dateStr}`;

      // Check if folder already exists for this user + date combination
      const existing = await query(
        `SELECT * FROM folders
         WHERE name = $1
           AND owner_id = $2
           AND parent_folder_id ${parentFolderId ? '= $3' : 'IS NULL'}
           AND is_deleted = FALSE
         LIMIT 1`,
        parentFolderId ? [folderName, userId, parentFolderId] : [folderName, userId]
      );

      if (existing.rows && existing.rows.length > 0) {
        logger.info('Reusing existing file request folder', {
          folderId: existing.rows[0].id,
          folderName,
          userId
        });
        return existing.rows[0];
      }

      // Create new folder
      const newFolder = await this.create({
        name: folderName,
        owner_id: userId,
        parent_folder_id: parentFolderId,
        description: `File requests for ${userName} on ${dateStr}`,
        color: '#3B82F6', // Blue color for file request folders
        is_auto_created: true,
        folder_type: 'file_request'
      });

      logger.info('Created new file request folder', {
        folderId: newFolder.id,
        folderName,
        userId
      });

      return newFolder;
    } catch (error) {
      logger.error('Get or create request folder failed', {
        error: error.message,
        userId,
        userName
      });
      throw error;
    }
  }
}

module.exports = new Folder();
