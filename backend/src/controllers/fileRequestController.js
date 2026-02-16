const { query, transaction } = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');
const mediaService = require('../services/mediaService');
const { logActivity } = require('../middleware/activityLogger');
const Notification = require('../models/Notification');
const Folder = require('../models/Folder');

class FileRequestController {
  /**
   * Cache for checking if platform/vertical tables exist
   */
  _platformVerticalTablesExist = null;

  /**
   * Check if file_request_platforms and file_request_verticals tables exist
   */
  async checkPlatformVerticalTables() {
    if (this._platformVerticalTablesExist !== null) {
      return this._platformVerticalTablesExist;
    }

    try {
      const result = await query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_name IN ('file_request_platforms', 'file_request_verticals')
      `);
      this._platformVerticalTablesExist = result.rows.length === 2;
      return this._platformVerticalTablesExist;
    } catch (error) {
      logger.warn('Failed to check platform/vertical tables', { error: error.message });
      return false;
    }
  }

  /**
   * Get platform/vertical query fragment
   */
  async getPlatformVerticalQuery() {
    const exists = await this.checkPlatformVerticalTables();

    if (exists) {
      return `
        COALESCE(
          (SELECT json_agg(DISTINCT frp.platform ORDER BY frp.platform)
           FROM file_request_platforms frp WHERE frp.file_request_id = fr.id),
          '[]'::json
        ) as platforms,
        COALESCE(
          (SELECT json_agg(DISTINCT frv.vertical ORDER BY CASE WHEN frv.is_primary THEN 0 ELSE 1 END, frv.vertical)
           FROM file_request_verticals frv WHERE frv.file_request_id = fr.id),
          '[]'::json
        ) as verticals
      `;
    } else {
      return `
        '[]'::json as platforms,
        '[]'::json as verticals
      `;
    }
  }

  /**
   * Generate unique token for file request
   */
  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create new file request
   * POST /api/file-requests
   */
  async create(req, res, next) {
    try {
      console.log('=== FILE REQUEST CREATE START ===');
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      console.log('User:', req.user);

      const userId = req.user.id;
      const userRole = req.user.role;

      // 🔒 SECURITY: Only admins and buyers can create file requests
      // Creatives/Editors should NOT be able to create requests
      if (userRole === 'creative' || userRole === 'editor') {
        console.log('ERROR: Creative/Editor attempted to create file request');
        return res.status(403).json({
          success: false,
          error: 'Only admins and buyers can create file requests'
        });
      }

      const {
        title,
        description,
        request_type,
        concept_notes,
        num_creatives = 1,
        platform,
        vertical,
        platforms, // 🆕 Array of platforms
        verticals, // 🆕 Array of verticals
        folder_id,
        deadline,
        allow_multiple_uploads = true,
        require_email = false,
        custom_message,
        editor_id,
        editor_ids,
        assigned_buyer_id,
        // New: deliverables progress (e.g. buyer asked for 20 videos)
        deliverables_required,
        deliverables_type
      } = req.body;

      // 🆕 Handle platform/vertical arrays (backward compatible with single values)
      const platformArray = platforms || (platform ? [platform] : []);
      const verticalArray = verticals || (vertical ? [vertical] : []);
      const primaryVertical = verticalArray[0] || vertical || null; // First vertical for auto-assignment

      console.log('Parsed values:', {
        userId,
        userRole,
        title,
        request_type,
        folder_id,
        editor_id,
        editor_ids,
        assigned_buyer_id
      });

      // Validation - either title OR request_type is required
      const requestTitle = request_type || title;
      if (!requestTitle || requestTitle.trim() === '') {
        console.log('ERROR: Missing title/request_type');
        return res.status(400).json({
          success: false,
          error: 'Title or request_type is required'
        });
      }

      // Validate num_creatives
      if (num_creatives && (num_creatives < 1 || !Number.isInteger(num_creatives))) {
        return res.status(400).json({
          success: false,
          error: 'num_creatives must be a positive integer'
        });
      }

      // Validate deadline if provided
      if (deadline) {
        const deadlineDate = new Date(deadline);
        if (isNaN(deadlineDate.getTime()) || deadlineDate < new Date()) {
          return res.status(400).json({
            success: false,
            error: 'Deadline must be a valid future date'
          });
        }
      }

      // 🆕 AUTO-CREATE NESTED FOLDER STRUCTURE if no folder specified
      // Structure: "UserName-YYYY-MM-DD" (parent) → "RequestType+Vertical" (child)
      let targetFolderId = folder_id;
      if (!targetFolderId) {
        try {
          // Create nested folder structure
          const requestFolder = await Folder.getOrCreateRequestFolder(
            userId,
            req.user.name,
            null, // Root level (dated folder)
            request_type || requestTitle, // Request type for nested folder
            primaryVertical // Vertical for nested folder name
          );
          targetFolderId = requestFolder.id;
          console.log('✅ Auto-created/reused request folder:', {
            folderId: targetFolderId,
            folderName: requestFolder.name
          });
        } catch (folderCreateError) {
          console.error('Failed to create request folder:', folderCreateError);
          return res.status(500).json({
            success: false,
            error: 'Failed to create file request folder'
          });
        }
      }

      // Verify folder exists
      if (targetFolderId) {
        console.log('Verifying folder_id:', targetFolderId);
        try {
          const folderResult = await query(
            'SELECT id, owner_id, name FROM folders WHERE id = $1 AND is_deleted = FALSE',
            [targetFolderId]
          );
          console.log('Folder query result:', folderResult.rows);
          if (folderResult.rows.length === 0) {
            console.log('ERROR: Folder not found');
            return res.status(404).json({
              success: false,
              error: 'Folder not found'
            });
          }
        } catch (folderError) {
          console.error('Folder verification error:', folderError);
          throw folderError;
        }
      }

      // Verify editor exists if provided
      if (editor_id) {
        console.log('Verifying editor_id:', editor_id);
        try {
          const editorResult = await query(
            'SELECT id, name, display_name FROM editors WHERE id = $1 AND is_active = TRUE',
            [editor_id]
          );
          console.log('Editor query result:', editorResult.rows);
          if (editorResult.rows.length === 0) {
            console.log('ERROR: Editor not found in editors table');
            return res.status(404).json({
              success: false,
              error: 'Editor not found'
            });
          }
        } catch (editorError) {
          console.error('Editor verification error:', editorError);
          throw editorError;
        }
      }

      // Verify all editors in editor_ids array
      if (editor_ids && Array.isArray(editor_ids) && editor_ids.length > 0) {
        console.log('Verifying editor_ids array:', editor_ids);
        for (const edId of editor_ids) {
          try {
            const editorResult = await query(
              'SELECT id, name, display_name FROM editors WHERE id = $1 AND is_active = TRUE',
              [edId]
            );
            console.log(`Editor ${edId} query result:`, editorResult.rows);
            if (editorResult.rows.length === 0) {
              console.log(`ERROR: Editor ${edId} not found in editors table`);
              return res.status(404).json({
                success: false,
                error: `Editor with ID ${edId} not found`
              });
            }
          } catch (editorError) {
            console.error(`Editor ${edId} verification error:`, editorError);
            throw editorError;
          }
        }
      }

      // Verify buyer exists if provided
      if (assigned_buyer_id) {
        const buyerResult = await query(
          'SELECT id FROM users WHERE id = $1 AND role = $2',
          [assigned_buyer_id, 'buyer']
        );
        if (buyerResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Buyer not found'
          });
        }
      }

      // 🆕 AUTO-ASSIGNMENT LOGIC: If vertical is provided, auto-assign to vertical head
      let autoAssignedHead = null;
      let autoAssignedEditors = [];

      if (primaryVertical && (!editor_ids || editor_ids.length === 0)) {
        console.log('🔍 Vertical provided, checking for vertical head:', primaryVertical);
        try {
          // Normalize vertical for lookup: lowercase, trim
          const normalizedVertical = primaryVertical.toLowerCase().trim();
          console.log('🔄 Normalized vertical for lookup:', normalizedVertical);

          // Strategy: Check if the input contains any of the stored vertical keywords
          // E.g., "Home Insurance" contains "home", "Auto Insurance" contains "auto"
          const verticalHeadResult = await query(
            `SELECT
              vh.*,
              u.id as editor_user_id,
              e.id as editor_id,
              CASE
                WHEN LOWER(vh.vertical) = $1 THEN 1                    -- Exact match
                WHEN $1 LIKE '%' || LOWER(vh.vertical) || '%' THEN 2  -- Input contains vertical keyword
                WHEN LOWER(vh.vertical) LIKE '%' || $1 || '%' THEN 3  -- Vertical contains input
                ELSE 4
              END as match_rank
             FROM vertical_heads vh
             LEFT JOIN users u ON vh.head_editor_id = u.id
             LEFT JOIN editors e ON e.user_id = u.id
             WHERE LOWER(vh.vertical) = $1
                OR $1 LIKE '%' || LOWER(vh.vertical) || '%'
                OR LOWER(vh.vertical) LIKE '%' || $1 || '%'
             ORDER BY match_rank ASC
             LIMIT 1`,
            [normalizedVertical]
          );

          if (verticalHeadResult.rows.length > 0 && verticalHeadResult.rows[0].editor_id) {
            // Vertical head found - auto-assign
            autoAssignedHead = verticalHeadResult.rows[0].head_editor_id;
            autoAssignedEditors = [verticalHeadResult.rows[0].editor_id];
            console.log('✅ Auto-assigned to vertical head:', {
              head_user_id: autoAssignedHead,
              editor_id: autoAssignedEditors[0]
            });
          } else {
            // No vertical head - use fallback editors (Parmeet and Ritu)
            console.log('⚠️ No vertical head found, using fallback editors');
            const fallbackResult = await query(
              `SELECT fallback_editor_ids FROM vertical_heads LIMIT 1`
            );

            if (fallbackResult.rows.length > 0 && fallbackResult.rows[0].fallback_editor_ids) {
              const fallbackUserIds = fallbackResult.rows[0].fallback_editor_ids;
              const fallbackEditorsResult = await query(
                `SELECT id FROM editors WHERE user_id = ANY($1::uuid[]) AND is_active = TRUE`,
                [fallbackUserIds]
              );

              autoAssignedEditors = fallbackEditorsResult.rows.map(r => r.id);
              console.log('✅ Auto-assigned to fallback editors:', autoAssignedEditors);
            }
          }
        } catch (autoAssignError) {
          console.error('Auto-assignment error (non-fatal):', autoAssignError);
          // Continue without auto-assignment if error occurs
        }
      }

      // Merge auto-assigned editors with manually selected editors
      const finalEditorIds = [...autoAssignedEditors, ...(editor_ids || [])];

      // Generate unique token
      const requestToken = this.generateToken();
      console.log('Generated request token:', requestToken);

      // Create file request
      console.log('About to insert file request with values:', {
        title: requestTitle.trim(),
        description: description || concept_notes || null,
        request_type: request_type || requestTitle.trim(),
        concept_notes: concept_notes || description || null,
        num_creatives,
        platform: platform || null,
        vertical: vertical || null,
        created_by: userId,
        folder_id: targetFolderId || null,
        request_token: requestToken,
        deadline: deadline || null,
        allow_multiple_uploads,
        require_email,
        custom_message: custom_message || null,
        assigned_buyer_id: assigned_buyer_id || null,
        auto_assigned_head: autoAssignedHead || null,
        assigned_at: (editor_id || finalEditorIds.length > 0) ? new Date() : null
      });

      let result;
      try {
        result = await query(
          `INSERT INTO file_requests
          (title, description, request_type, concept_notes, num_creatives, platform, vertical, created_by, folder_id, request_token, deadline,
           allow_multiple_uploads, require_email, custom_message, assigned_buyer_id, auto_assigned_head, assigned_at,
           deliverables_required, deliverables_type)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          RETURNING *`,
          [
            requestTitle.trim(),
            description || concept_notes || null,
            request_type || requestTitle.trim(),
            concept_notes || description || null,
            num_creatives,
            platform || null,
            vertical || null,
            userId,
            targetFolderId || null,
            requestToken,
            deadline || null,
            allow_multiple_uploads,
            require_email,
            custom_message || null,
            assigned_buyer_id || null,
            autoAssignedHead || null,
            (editor_id || finalEditorIds.length > 0) ? new Date() : null,
            deliverables_required || null,
            deliverables_type || 'file'
          ]
        );
        console.log('Insert successful, returned:', result.rows[0]);
      } catch (insertError) {
        console.error('INSERT ERROR:', insertError);
        console.error('Error details:', {
          message: insertError.message,
          code: insertError.code,
          detail: insertError.detail,
          hint: insertError.hint,
          table: insertError.table,
          column: insertError.column
        });
        throw insertError;
      }

      const fileRequest = result.rows[0];

      // ✨ Ensure each request gets its own sub-folder inside the buyer's dated folder
      // Desired structure: BuyerName-YYYY-MM-DD/<RequestTitle (or token)>/
      // We create the subfolder AFTER the request insert so we can include a stable unique suffix.
      if (targetFolderId) {
        try {
          const sanitizedTitle = (requestTitle || 'Request')
            .trim()
            .replace(/[\\/:*?"<>|]/g, '-')
            .replace(/\s+/g, ' ')
            .slice(0, 60);

          const shortToken = (fileRequest.request_token || '').slice(0, 8) || fileRequest.id.slice(0, 8);
          const subFolderName = `${sanitizedTitle}-${shortToken}`;

          // Avoid duplicates if request is retried
          const existingSub = await query(
            `SELECT id FROM folders
             WHERE parent_folder_id = $1
               AND owner_id = $2
               AND name = $3
               AND is_deleted = FALSE
             LIMIT 1`,
            [targetFolderId, userId, subFolderName]
          );

          let subFolderId;
          if (existingSub.rows.length > 0) {
            subFolderId = existingSub.rows[0].id;
          } else {
            const requestSubFolder = await Folder.create({
              name: subFolderName,
              owner_id: userId,
              parent_folder_id: targetFolderId,
              description: `Assets for request: ${fileRequest.title}`,
              color: '#10B981',
              is_auto_created: true,
              folder_type: 'file_request_item'
            });
            subFolderId = requestSubFolder.id;
          }

          // Point the request to the subfolder (uploads and browsing land here)
          await query(
            `UPDATE file_requests
             SET folder_id = $1, updated_at = NOW()
             WHERE id = $2`,
            [subFolderId, fileRequest.id]
          );

          fileRequest.folder_id = subFolderId;
        } catch (subFolderErr) {
          // Non-fatal: request still exists, but folder structure will be flatter
          logger.warn('Failed to create request subfolder (non-fatal)', {
            requestId: fileRequest.id,
            parentFolderId: targetFolderId,
            error: subFolderErr.message
          });
        }
      }

      // 🆕 INSERT PLATFORMS into junction table (if table exists)
      const hasPlatformVerticalTables = await this.checkPlatformVerticalTables();

      if (hasPlatformVerticalTables && platformArray && platformArray.length > 0) {
        console.log('📝 Inserting platforms:', platformArray);
        for (const plt of platformArray) {
          if (plt && plt.trim()) {
            await query(
              `INSERT INTO file_request_platforms (file_request_id, platform)
               VALUES ($1, $2)
               ON CONFLICT (file_request_id, platform) DO NOTHING`,
              [fileRequest.id, plt.trim()]
            );
          }
        }
      } else if (!hasPlatformVerticalTables && (platformArray && platformArray.length > 0)) {
        logger.warn('Platform/vertical tables not yet created. Run migration 20260217_01_multi_platform_vertical.sql');
      }

      // 🆕 INSERT VERTICALS into junction table (if table exists)
      if (hasPlatformVerticalTables && verticalArray && verticalArray.length > 0) {
        console.log('📝 Inserting verticals:', verticalArray);
        for (let i = 0; i < verticalArray.length; i++) {
          const vrt = verticalArray[i];
          if (vrt && vrt.trim()) {
            await query(
              `INSERT INTO file_request_verticals (file_request_id, vertical, is_primary)
               VALUES ($1, $2, $3)
               ON CONFLICT (file_request_id, vertical) DO NOTHING`,
              [fileRequest.id, vrt.trim(), i === 0] // First vertical is primary
            );
          }
        }
      }

      // Handle multi-editor assignment (includes auto-assigned + manually selected)
      const editorsToAssign = finalEditorIds.length > 0 ? finalEditorIds : (editor_id ? [editor_id] : []);
      if (editorsToAssign.length > 0) {
        console.log('📝 Assigning editors:', editorsToAssign);
        for (const edId of editorsToAssign) {
          await query(
            `INSERT INTO file_request_editors (request_id, editor_id, status)
             VALUES ($1, $2, 'pending')
             ON CONFLICT (request_id, editor_id) DO NOTHING`,
            [fileRequest.id, edId]
          );

          // Get editor's user_id to send notification
          const editorUserResult = await query(
            'SELECT user_id FROM editors WHERE id = $1',
            [edId]
          );

          if (editorUserResult.rows && editorUserResult.rows.length > 0) {
            const editorUserId = editorUserResult.rows[0].user_id;

            // Create notification for assigned editor
            await Notification.create({
              userId: editorUserId,
              type: 'file_request_assigned',
              title: 'New File Request Assigned',
              message: `You have been assigned to "${fileRequest.title}" by ${req.user.name || req.user.email}`,
              referenceType: 'file_request',
              referenceId: fileRequest.id,
              metadata: {
                request_title: fileRequest.title,
                deadline: fileRequest.deadline,
                assigned_by: req.user.name || req.user.email
              }
            });
          }
        }
      }

      // Log activity
      await logActivity({
        req,
        actionType: 'file_request_created',
        resourceType: 'file_request',
        resourceId: fileRequest.id,
        resourceName: fileRequest.title,
        details: {
          deadline: fileRequest.deadline,
          folder_id: fileRequest.folder_id,
          require_email: fileRequest.require_email
        },
        status: 'success'
      });

      logger.info('File request created', {
        fileRequestId: fileRequest.id,
        userId,
        title
      });

      res.status(201).json({
        success: true,
        message: 'File request created successfully',
        data: fileRequest
      });
    } catch (error) {
      console.error('=== FILE REQUEST CREATE ERROR ===');
      console.error('Error:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      logger.error('Create file request error', {
        error: error.message,
        stack: error.stack,
        code: error.code,
        detail: error.detail
      });
      next(error);
    }
  }

  /**
   * Get all file requests for current user
   * GET /api/file-requests
   */
  async getAll(req, res, next) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { status, date_from, date_to, editor_ids, media_type } = req.query;

      // Global reviewers: always see all requests (like admin) even if they are creatives
      const reviewerEmails = ['parmeet.singh@pearmediallc.com', 'ritu.singh@pearmediallc.com'];
      const isGlobalReviewer = reviewerEmails.includes(String(req.user.email || '').toLowerCase());

      // Check if user is an editor (creative role)
      const isEditor = userRole === 'creative' && !isGlobalReviewer;
      const isAdminOrBuyer = userRole === 'admin' || userRole === 'buyer';

      let whereClause;
      let params;

      if (isEditor) {
        // For editors: Find their editor_id and show requests assigned to them
        const editorResult = await query(
          'SELECT id FROM editors WHERE user_id = $1 AND is_active = TRUE',
          [userId]
        );

        if (editorResult.rows.length === 0) {
          // Editor profile doesn't exist, return empty array
          logger.warn('Editor profile not found for user', { userId });
          return res.json({
            success: true,
            data: []
          });
        }

        const editorId = editorResult.rows[0].id;
        whereClause = `WHERE fre.editor_id = $1`;
        // params[0]=editorId, params[1]=userId (used for my_uploaded_files_count)
        params = [editorId, userId];

        if (status === 'active') {
          whereClause += ' AND fr.is_active = TRUE';
        } else if (status === 'closed') {
          whereClause += ' AND fr.is_active = FALSE';
        }

        // Apply additional filters
        if (date_from) {
          whereClause += ` AND fr.created_at >= $${params.length + 1}`;
          params.push(date_from);
        }
        if (date_to) {
          whereClause += ` AND fr.created_at <= $${params.length + 1}`;
          params.push(date_to + ' 23:59:59');
        }
        if (editor_ids) {
          const editorIdsArray = editor_ids.split(',').map(id => id.trim());
          whereClause += ` AND EXISTS (
            SELECT 1 FROM file_request_editors fre_filter
            WHERE fre_filter.request_id = fr.id
            AND fre_filter.editor_id = ANY($${params.length + 1}::uuid[])
          )`;
          params.push(editorIdsArray);
        }
        if (media_type && media_type !== 'all') {
          whereClause += ` AND EXISTS (
            SELECT 1 FROM file_request_uploads fru_filter
            WHERE fru_filter.file_request_id = fr.id
            AND fru_filter.file_type LIKE $${params.length + 1}
          )`;
          params.push(`${media_type}/%`);
        }

        // Query for editor: show requests assigned to them via file_request_editors
        const platformVerticalQuery = await this.getPlatformVerticalQuery();

        const result = await query(
          `SELECT
            fr.*,
            f.name as folder_name,
            COUNT(DISTINCT fru.id) FILTER (WHERE COALESCE(fru.is_deleted, FALSE) = FALSE AND COALESCE(fru.file_count, 0) > 0) as upload_count,
            COUNT(mf.id) FILTER (WHERE COALESCE(fru.is_deleted, FALSE) = FALSE AND mf.is_deleted = FALSE) as uploaded_files_count,
            COUNT(mf.id) FILTER (WHERE COALESCE(fru.is_deleted, FALSE) = FALSE AND mf.is_deleted = FALSE AND fru.uploaded_by = $2) as my_uploaded_files_count,
            fre.status as my_assignment_status,
            fre.created_at as assigned_at,
            buyer.name as buyer_name,
            buyer.email as buyer_email,
            creator.name as created_by_name,
            (SELECT STRING_AGG(DISTINCT display_name, ', ' ORDER BY display_name)
             FROM (SELECT DISTINCT e2.display_name FROM file_request_editors fre2
                   JOIN editors e2 ON fre2.editor_id = e2.id
                   WHERE fre2.request_id = fr.id) AS editor_names) as assigned_editors,
            ${platformVerticalQuery}
          FROM file_request_editors fre
          JOIN file_requests fr ON fre.request_id = fr.id
          LEFT JOIN folders f ON fr.folder_id = f.id
          LEFT JOIN file_request_uploads fru ON fr.id = fru.file_request_id
          LEFT JOIN media_files mf ON mf.upload_session_id = fru.id
          LEFT JOIN users buyer ON fr.assigned_buyer_id = buyer.id
          LEFT JOIN users creator ON fr.created_by = creator.id
          LEFT JOIN file_request_editors fre_all ON fr.id = fre_all.request_id
          LEFT JOIN editors e ON fre_all.editor_id = e.id
          ${whereClause}
          GROUP BY fr.id, f.name, fre.status, fre.created_at, buyer.name, buyer.email, creator.name
          ORDER BY fre.created_at DESC`,
          params
        );

        logger.info('Editor file requests fetched', {
          userId,
          editorId,
          requestCount: result.rows.length
        });

        return res.json({
          success: true,
          data: result.rows
        });
      } else {
        // For non-editors: differentiate between admin and buyers/regular users
        if (userRole === 'admin' || isGlobalReviewer) {
          // Admins and global reviewers see ALL requests
          whereClause = 'WHERE 1=1';
          params = [];
          logger.info('Admin viewing all file requests', { userId, userRole });
        } else if (userRole === 'buyer') {
          // Buyers see requests they created OR requests assigned to them
          whereClause = 'WHERE (fr.created_by = $1 OR fr.assigned_buyer_id = $1)';
          params = [userId];
          logger.info('Buyer viewing own and assigned file requests', { userId, userRole });
        } else {
          // Regular users see only requests they created
          whereClause = 'WHERE fr.created_by = $1';
          params = [userId];
          logger.info('User viewing own file requests', { userId, userRole });
        }

        if (status === 'active') {
          whereClause += ' AND fr.is_active = TRUE';
        } else if (status === 'closed') {
          whereClause += ' AND fr.is_active = FALSE';
        }

        // Apply additional filters
        if (date_from) {
          whereClause += ` AND fr.created_at >= $${params.length + 1}`;
          params.push(date_from);
        }
        if (date_to) {
          whereClause += ` AND fr.created_at <= $${params.length + 1}`;
          params.push(date_to + ' 23:59:59');
        }
        if (editor_ids) {
          const editorIdsArray = editor_ids.split(',').map(id => id.trim());
          whereClause += ` AND EXISTS (
            SELECT 1 FROM file_request_editors fre_filter
            WHERE fre_filter.request_id = fr.id
            AND fre_filter.editor_id = ANY($${params.length + 1}::uuid[])
          )`;
          params.push(editorIdsArray);
        }
        if (media_type && media_type !== 'all') {
          whereClause += ` AND EXISTS (
            SELECT 1 FROM file_request_uploads fru_filter
            WHERE fru_filter.file_request_id = fr.id
            AND fru_filter.file_type LIKE $${params.length + 1}
          )`;
          params.push(`${media_type}/%`);
        }

        const platformVerticalQuery2 = await this.getPlatformVerticalQuery();

        const result = await query(
          `SELECT
            fr.*,
            f.name as folder_name,
            COUNT(DISTINCT fru.id) FILTER (WHERE COALESCE(fru.is_deleted, FALSE) = FALSE AND COALESCE(fru.file_count, 0) > 0) as upload_count,
            buyer.name as buyer_name,
            buyer.email as buyer_email,
            creator.name as created_by_name,
            (SELECT STRING_AGG(DISTINCT display_name, ', ' ORDER BY display_name)
             FROM (SELECT DISTINCT e2.display_name FROM file_request_editors fre2
                   JOIN editors e2 ON fre2.editor_id = e2.id
                   WHERE fre2.request_id = fr.id) AS editor_names) as assigned_editors,
            COUNT(DISTINCT fre.editor_id) as total_editors_count,
            COUNT(DISTINCT fre.editor_id) FILTER (WHERE fre.status = 'completed') as completed_editors_count,
            ${platformVerticalQuery2}
          FROM file_requests fr
          LEFT JOIN folders f ON fr.folder_id = f.id
          LEFT JOIN file_request_uploads fru ON fr.id = fru.file_request_id
          LEFT JOIN users buyer ON fr.assigned_buyer_id = buyer.id
          LEFT JOIN users creator ON fr.created_by = creator.id
          LEFT JOIN file_request_editors fre ON fr.id = fre.request_id
          LEFT JOIN editors e ON fre.editor_id = e.id
          ${whereClause}
          GROUP BY fr.id, f.id, f.name, buyer.id, buyer.name, buyer.email, creator.id, creator.name
          ORDER BY fr.created_at DESC`,
          params
        );

        return res.json({
          success: true,
          data: result.rows
        });
      }
    } catch (error) {
      logger.error('Get file requests error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get single file request details
   * GET /api/file-requests/:id
   */
  async getOne(req, res, next) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { id } = req.params;

      const reviewerEmails = ['parmeet.singh@pearmediallc.com', 'ritu.singh@pearmediallc.com'];
      const isGlobalReviewer = reviewerEmails.includes(String(req.user.email || '').toLowerCase());

      // Check if user is an editor
      const isEditor = userRole === 'creative' && !isGlobalReviewer;

      let result;
      if (isEditor) {
        // For editors: check if they're assigned to this request
        const editorResult = await query(
          'SELECT id FROM editors WHERE user_id = $1 AND is_active = TRUE',
          [userId]
        );

        if (editorResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Editor profile not found'
          });
        }

        const editorId = editorResult.rows[0].id;

        // Query with editor assignment check
        const pvQuery1 = await this.getPlatformVerticalQuery();
        result = await query(
          `SELECT
            fr.*,
            f.name as folder_name,
            COUNT(DISTINCT fru.id) FILTER (WHERE COALESCE(fru.is_deleted, FALSE) = FALSE AND COALESCE(fru.file_count, 0) > 0) as upload_count,
            u.name as creator_name,
            u.email as creator_email,
            ${pvQuery1}
          FROM file_request_editors fre
          JOIN file_requests fr ON fre.request_id = fr.id
          LEFT JOIN folders f ON fr.folder_id = f.id
          LEFT JOIN file_request_uploads fru ON fr.id = fru.file_request_id
          LEFT JOIN users u ON fr.created_by = u.id
          WHERE fr.id = $1 AND fre.editor_id = $2
          GROUP BY fr.id, f.name, u.name, u.email`,
          [id, editorId]
        );
      } else {
        // For non-editors: differentiate between admin and buyers/regular users
        const pvQuery2 = await this.getPlatformVerticalQuery();

        if (userRole === 'admin' || isGlobalReviewer) {
          // Admins and global reviewers can view any request
          result = await query(
            `SELECT
              fr.*,
              f.name as folder_name,
              COUNT(DISTINCT fru.id) FILTER (WHERE COALESCE(fru.is_deleted, FALSE) = FALSE AND COALESCE(fru.file_count, 0) > 0) as upload_count,
              u.name as creator_name,
              u.email as creator_email,
              ${pvQuery2}
            FROM file_requests fr
            LEFT JOIN folders f ON fr.folder_id = f.id
            LEFT JOIN file_request_uploads fru ON fr.id = fru.file_request_id
            LEFT JOIN users u ON fr.created_by = u.id
            WHERE fr.id = $1
            GROUP BY fr.id, f.name, u.name, u.email`,
            [id]
          );
        } else if (userRole === 'buyer') {
          // Buyers can view requests they created OR requests assigned to them
          result = await query(
            `SELECT
              fr.*,
              f.name as folder_name,
              COUNT(DISTINCT fru.id) FILTER (WHERE COALESCE(fru.is_deleted, FALSE) = FALSE AND COALESCE(fru.file_count, 0) > 0) as upload_count,
              u.name as creator_name,
              u.email as creator_email,
              ${pvQuery2}
            FROM file_requests fr
            LEFT JOIN folders f ON fr.folder_id = f.id
            LEFT JOIN file_request_uploads fru ON fr.id = fru.file_request_id
            LEFT JOIN users u ON fr.created_by = u.id
            WHERE fr.id = $1 AND (fr.created_by = $2 OR fr.assigned_buyer_id = $2)
            GROUP BY fr.id, f.name, u.name, u.email`,
            [id, userId]
          );
        } else {
          // Regular users can only view requests they created
          result = await query(
            `SELECT
              fr.*,
              f.name as folder_name,
              COUNT(DISTINCT fru.id) FILTER (WHERE COALESCE(fru.is_deleted, FALSE) = FALSE AND COALESCE(fru.file_count, 0) > 0) as upload_count,
              u.name as creator_name,
              u.email as creator_email,
              ${pvQuery2}
                '[]'::json
              ) as platforms,
              COALESCE(
                (SELECT json_agg(DISTINCT frv.vertical ORDER BY CASE WHEN frv.is_primary THEN 0 ELSE 1 END, frv.vertical)
                 FROM file_request_verticals frv WHERE frv.file_request_id = fr.id),
            FROM file_requests fr
            LEFT JOIN folders f ON fr.folder_id = f.id
            LEFT JOIN file_request_uploads fru ON fr.id = fru.file_request_id
            LEFT JOIN users u ON fr.created_by = u.id
            WHERE fr.id = $1 AND fr.created_by = $2
            GROUP BY fr.id, f.name, u.name, u.email`,
            [id, userId]
          );
        }
      }

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found or you do not have access'
        });
      }

      // Get uploaded files
      // 📝 LOGGING: Fetching file request uploads
      logger.info('Fetching uploaded files for file request', { file_request_id: id });

      // Uploads for a request are represented as upload sessions in file_request_uploads.
      // Media files are linked via media_files.upload_session_id.
      // NOTE: We also support legacy rows that used fru.file_id directly.
      const uploadsResult = await query(
        `SELECT DISTINCT ON (mf.id)
          mf.id as id,
          mf.id as file_id,
          mf.original_filename,
          mf.file_type,
          mf.file_size,
          mf.thumbnail_url,
          mf.s3_url,
          mf.created_at,
          fru.id as upload_session_id,
          fru.uploaded_by,
          fru.uploaded_by_email,
          fru.uploaded_by_name,
          fru.comments,
          fru.editor_id,
          fru.created_at as upload_created_at
        FROM media_files mf
        LEFT JOIN file_request_uploads fru
          ON (
            (mf.upload_session_id = fru.id)
            OR (fru.file_id IS NOT NULL AND fru.file_id = mf.id)
          )
        WHERE fru.file_request_id = $1
          AND COALESCE(fru.is_deleted, FALSE) = FALSE
          AND mf.is_deleted = FALSE
        ORDER BY mf.id, fru.created_at DESC`,
        [id]
      );

      // Add cloudfront_url to each upload (s3_url is already the CloudFront URL)
      uploadsResult.rows.forEach(upload => {
        upload.cloudfront_url = upload.s3_url;
      });

      logger.info('File request uploads fetched', { count: uploadsResult.rows.length });

      // Get assigned editors with assignment history
      let editorsResult = { rows: [] };
      try {
        editorsResult = await query(
          `SELECT
            e.id,
            e.name,
            e.display_name,
            fre.status,
            fre.num_creatives_assigned,
            fre.creatives_completed,
            fre.created_at,
            fre.accepted_at,
            fre.started_at,
            fre.completed_at,
            fre.deliverables_quota,
            fre.deliverables_uploaded,
            fre.deliverables_completed_at
          FROM file_request_editors fre
          JOIN editors e ON fre.editor_id = e.id
          WHERE fre.request_id = $1
          ORDER BY fre.created_at ASC`,
          [id]
        );
        logger.info('Assigned editors fetched', {
          requestId: id,
          count: editorsResult.rows.length,
          editors: editorsResult.rows.map(r => ({ id: r.id, name: r.name, status: r.status }))
        });
      } catch (editorError) {
        logger.error('Failed to fetch assigned editors', {
          requestId: id,
          error: editorError.message,
          stack: editorError.stack
        });
        // Continue without assigned editors data
      }

      const fileRequest = result.rows[0];
      fileRequest.uploads = uploadsResult.rows;
      fileRequest.assigned_editors = editorsResult.rows;

      // Deliverables progress (files uploaded vs buyer-required count)
      const deliverablesRequired = fileRequest.deliverables_required ? Number(fileRequest.deliverables_required) : null;
      const deliverablesUploaded = Array.isArray(uploadsResult.rows) ? uploadsResult.rows.length : 0;
      if (deliverablesRequired && deliverablesRequired > 0) {
        fileRequest.deliverables = {
          required: deliverablesRequired,
          uploaded: deliverablesUploaded,
          remaining: Math.max(0, deliverablesRequired - deliverablesUploaded),
          is_complete: deliverablesUploaded >= deliverablesRequired
        };
      }

      // Progress / fulfillment summary (how many assigned editors are done)
      const totalAssigned = Array.isArray(editorsResult.rows) ? editorsResult.rows.length : 0;
      const completedAssigned = editorsResult.rows.filter(r => r.status === 'completed').length;
      const inProgressAssigned = editorsResult.rows.filter(r => r.status === 'in_progress').length;
      const pendingAssigned = editorsResult.rows.filter(r => r.status === 'pending').length;

      fileRequest.fulfillment = {
        total_assigned: totalAssigned,
        completed: completedAssigned,
        in_progress: inProgressAssigned,
        pending: pendingAssigned,
        percent: totalAssigned > 0 ? Math.round((completedAssigned / totalAssigned) * 100) : 0,
        text: totalAssigned > 0 ? `${completedAssigned}/${totalAssigned}` : '0/0'
      };

      // ✨ Get reassignment history with notes
      let reassignmentsResult = { rows: [] };
      try {
        reassignmentsResult = await query(
          `SELECT
            rr.*,
            uf.name as from_name,
            uf.email as from_email,
            ut.name as to_name,
            ut.email as to_email
           FROM request_reassignments rr
           JOIN users uf ON rr.reassigned_from = uf.id
           JOIN users ut ON rr.reassigned_to = ut.id
           WHERE rr.file_request_id = $1
           ORDER BY rr.created_at DESC`,
          [id]
        );
        logger.info('Reassignment history fetched', {
          requestId: id,
          count: reassignmentsResult.rows.length
        });
      } catch (reassignError) {
        logger.error('Failed to fetch reassignment history', {
          requestId: id,
          error: reassignError.message
        });
        // Continue without reassignment data
      }
      fileRequest.reassignments = reassignmentsResult.rows;

      // Calculate num_creatives_requested (use from DB if available, fallback to editors count)
      fileRequest.num_creatives_requested = fileRequest.num_creatives || editorsResult.rows.length || 0;

      // Calculate total time to complete (in hours)
      if (fileRequest.created_at && fileRequest.completed_at) {
        const createdDate = new Date(fileRequest.created_at);
        const completedDate = new Date(fileRequest.completed_at);
        const diffMs = completedDate.getTime() - createdDate.getTime();
        fileRequest.time_to_complete_hours = (diffMs / (1000 * 60 * 60)).toFixed(2);
      }

      res.json({
        success: true,
        data: fileRequest
      });
    } catch (error) {
      logger.error('Get file request error', { error: error.message });
      next(error);
    }
  }

  /**
   * Update file request
   * PATCH /api/file-requests/:id
   */
  async update(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const {
        title,
        description,
        deadline,
        allow_multiple_uploads,
        require_email,
        custom_message
      } = req.body;

      // Verify ownership
      const checkResult = await query(
        'SELECT id, is_active FROM file_requests WHERE id = $1 AND created_by = $2',
        [id, userId]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      // Build update query
      const updates = [];
      const params = [];
      let paramCount = 1;

      if (title !== undefined) {
        updates.push(`title = $${paramCount++}`);
        params.push(title.trim());
      }
      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        params.push(description || null);
      }
      if (deadline !== undefined) {
        if (deadline && new Date(deadline) < new Date()) {
          return res.status(400).json({
            success: false,
            error: 'Deadline must be a future date'
          });
        }
        updates.push(`deadline = $${paramCount++}`);
        params.push(deadline || null);
      }
      if (allow_multiple_uploads !== undefined) {
        updates.push(`allow_multiple_uploads = $${paramCount++}`);
        params.push(allow_multiple_uploads);
      }
      if (require_email !== undefined) {
        updates.push(`require_email = $${paramCount++}`);
        params.push(require_email);
      }
      if (custom_message !== undefined) {
        updates.push(`custom_message = $${paramCount++}`);
        params.push(custom_message || null);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No fields to update'
        });
      }

      updates.push(`updated_at = NOW()`);
      params.push(id, userId);

      const result = await query(
        `UPDATE file_requests
        SET ${updates.join(', ')}
        WHERE id = $${paramCount} AND created_by = $${paramCount + 1}
        RETURNING *`,
        params
      );

      await logActivity({
        req,
        actionType: 'file_request_updated',
        resourceType: 'file_request',
        resourceId: id,
        resourceName: result.rows[0].title,
        status: 'success'
      });

      res.json({
        success: true,
        message: 'File request updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Update file request error', { error: error.message });
      next(error);
    }
  }

  /**
   * Close file request
   * POST /api/file-requests/:id/close
   */
  async close(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const result = await query(
        `UPDATE file_requests
        SET is_active = FALSE, closed_at = NOW(), closed_by = $2, updated_at = NOW()
        WHERE id = $1 AND created_by = $2 AND is_active = TRUE
        RETURNING *`,
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found or already closed'
        });
      }

      await logActivity({
        req,
        actionType: 'file_request_closed',
        resourceType: 'file_request',
        resourceId: id,
        resourceName: result.rows[0].title,
        status: 'success'
      });

      logger.info('File request closed', { fileRequestId: id, userId });

      res.json({
        success: true,
        message: 'File request closed successfully',
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Close file request error', { error: error.message });
      next(error);
    }
  }

  /**
   * Delete file request
   * DELETE /api/file-requests/:id
   */
  async delete(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Get file request details first
      const frResult = await query(
        'SELECT title FROM file_requests WHERE id = $1 AND created_by = $2',
        [id, userId]
      );

      if (frResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      // Delete file request (cascade will handle uploads)
      await query(
        'DELETE FROM file_requests WHERE id = $1 AND created_by = $2',
        [id, userId]
      );

      await logActivity({
        req,
        actionType: 'file_request_deleted',
        resourceType: 'file_request',
        resourceId: id,
        resourceName: frResult.rows[0].title,
        status: 'success'
      });

      logger.info('File request deleted', { fileRequestId: id, userId });

      res.json({
        success: true,
        message: 'File request deleted successfully'
      });
    } catch (error) {
      logger.error('Delete file request error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get public file request details (no auth)
   * GET /api/public/file-request/:token
   */
  async getPublic(req, res, next) {
    try {
      const { token } = req.params;

      const result = await query(
        `SELECT
          fr.id,
          fr.title,
          fr.description,
          fr.deadline,
          fr.allow_multiple_uploads,
          fr.require_email,
          fr.custom_message,
          fr.is_active,
          u.name as creator_name
        FROM file_requests fr
        JOIN users u ON fr.created_by = u.id
        WHERE fr.request_token = $1`,
        [token]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      const fileRequest = result.rows[0];

      // Check if expired
      if (fileRequest.deadline && new Date(fileRequest.deadline) < new Date()) {
        fileRequest.is_expired = true;
      }

      res.json({
        success: true,
        data: fileRequest
      });
    } catch (error) {
      logger.error('Get public file request error', { error: error.message });
      next(error);
    }
  }

  /**
   * Upload file to request (no auth required)
   * POST /api/public/file-request/:token/upload
   */
  async uploadToRequest(req, res, next) {
    try {
      const { token } = req.params;
      const { uploader_email, uploader_name, editor_id, comments } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided'
        });
      }

      // Get file request
      const frResult = await query(
        `SELECT fr.*, u.id as creator_id
        FROM file_requests fr
        JOIN users u ON fr.created_by = u.id
        WHERE fr.request_token = $1`,
        [token]
      );

      if (frResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      const fileRequest = frResult.rows[0];

      // Validate request is active
      if (!fileRequest.is_active) {
        return res.status(400).json({
          success: false,
          error: 'This file request is no longer accepting uploads'
        });
      }

      // Validate deadline
      if (fileRequest.deadline && new Date(fileRequest.deadline) < new Date()) {
        return res.status(400).json({
          success: false,
          error: 'This file request has expired'
        });
      }

      // Validate email if required
      if (fileRequest.require_email && !uploader_email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required for this file request'
        });
      }

      // Upload file to S3 (as the request creator)
      // Use editor_id from form submission or fall back to request's editor_id
      const uploadEditorId = editor_id || fileRequest.editor_id || null;

      console.log('📂 FILE REQUEST UPLOAD - Folder Targeting:');
      console.log('  └─ File Request ID:', fileRequest.id);
      console.log('  └─ Target folder_id from request:', fileRequest.folder_id);
      console.log('  └─ Assigned buyer:', fileRequest.assigned_buyer_id);

      const mediaFile = await mediaService.uploadMedia(
        req.file,
        fileRequest.creator_id,
        uploadEditorId,
        {
          tags: ['file-request-upload'],
          description: comments || `Uploaded via file request: ${fileRequest.title}`,
          folder_id: fileRequest.folder_id,
          assigned_buyer_id: fileRequest.assigned_buyer_id || null, // Assign to buyer if specified
          is_file_request_upload: true // Hide from media library by default
        }
      );

      console.log('✅ Upload complete - File ID:', mediaFile.id);
      console.log('  └─ Folder ID in database:', mediaFile.folder_id);

      // Track the upload as an upload session (public uploads may not have an authenticated user)
      const uploadSessionResult = await query(
        `INSERT INTO file_request_uploads
         (file_request_id, uploaded_by, uploaded_by_email, uploaded_by_name, upload_type, file_count, total_size_bytes, folder_path, comments, editor_id, files_metadata)
         VALUES ($1, NULL, $2, $3, 'file', 1, $4, NULL, $5, $6, $7)
         RETURNING id`,
        [
          fileRequest.id,
          uploader_email || null,
          uploader_name || null,
          mediaFile.file_size,
          comments || null,
          uploadEditorId,
          JSON.stringify([
            {
              file_id: mediaFile.id,
              original_filename: mediaFile.original_filename,
              file_size: mediaFile.file_size,
              file_type: mediaFile.file_type,
              mime_type: mediaFile.mime_type,
              thumbnail_url: mediaFile.thumbnail_url || null,
              s3_url: mediaFile.s3_url
            }
          ])
        ]
      );
      const uploadSessionId = uploadSessionResult.rows[0].id;

      // Link media file to its upload session
      await query(
        `UPDATE media_files SET upload_session_id = $1 WHERE id = $2`,
        [uploadSessionId, mediaFile.id]
      );

      logger.info('File uploaded via request', {
        fileRequestId: fileRequest.id,
        fileId: mediaFile.id,
        uploaderEmail: uploader_email,
        editorId: uploadEditorId,
        hasComments: !!comments
      });

      // Log activity for the file upload (log as request creator since this is public upload)
      await logActivity({
        userId: fileRequest.creator_id,
        action: 'file_request_upload',
        details: `File "${mediaFile.original_filename}" uploaded to file request "${fileRequest.title}"${uploader_email ? ` by ${uploader_email}` : ''}`,
        metadata: {
          file_request_id: fileRequest.id,
          file_id: mediaFile.id,
          file_name: mediaFile.original_filename,
          file_size: mediaFile.file_size,
          file_type: mediaFile.file_type,
          uploader_email: uploader_email || null,
          uploader_name: uploader_name || null,
          has_comments: !!comments,
          public_upload: true
        }
      });

      // Create notification for request creator
      await Notification.create({
        userId: fileRequest.creator_id,
        type: 'file_request_upload',
        title: 'New File Uploaded',
        message: `${uploader_name || uploader_email || 'Someone'} uploaded "${mediaFile.original_filename}" to your request "${fileRequest.title}"`,
        referenceType: 'file_request',
        referenceId: fileRequest.id,
        metadata: {
          file_id: mediaFile.id,
          file_name: mediaFile.original_filename,
          uploaded_by: uploader_name || uploader_email || 'Anonymous',
          public_upload: true
        }
      });

      res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          id: mediaFile.id,
          filename: mediaFile.original_filename,
          original_filename: mediaFile.original_filename,
          file_type: mediaFile.file_type,
          file_size: mediaFile.file_size,
          thumbnail_url: mediaFile.thumbnail_url || null,
          s3_url: mediaFile.s3_url,
          cloudfront_url: mediaFile.s3_url
        }
      });
    } catch (error) {
      logger.error('Public upload error', { error: error.message });
      next(error);
    }
  }

  /**
   * Upload file to request (authenticated - for editors)
   * POST /api/file-requests/:id/upload
   */
  async uploadToRequestAuth(req, res, next) {
    try {
      const { id } = req.params;
      const { comments, folder_path } = req.body;
      const userId = req.user.id;

      logger.info('🚀 ====== UPLOAD TO REQUEST (AUTH) - START ======', {
        requestId: id,
        userId,
        userEmail: req.user?.email,
        userName: req.user?.name,
        hasFile: !!req.file,
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
        fileType: req.file?.mimetype,
        comments: comments || 'none',
        headers: {
          contentType: req.headers['content-type'],
          authorization: req.headers['authorization'] ? 'present' : 'MISSING'
        }
      });

      if (!req.file) {
        logger.error('❌ No file provided in upload request', { requestId: id, userId });
        return res.status(400).json({
          success: false,
          error: 'No file provided'
        });
      }

      // Get file request
      const frResult = await query(
        `SELECT fr.*, u.id as creator_id, u.email as creator_email, u.name as creator_name
        FROM file_requests fr
        JOIN users u ON fr.created_by = u.id
        WHERE fr.id = $1`,
        [id]
      );

      if (frResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      const fileRequest = frResult.rows[0];

      // Validate request is active
      if (!fileRequest.is_active) {
        return res.status(400).json({
          success: false,
          error: 'This file request is no longer accepting uploads'
        });
      }

      // Validate deadline
      if (fileRequest.deadline && new Date(fileRequest.deadline) < new Date()) {
        return res.status(400).json({
          success: false,
          error: 'This file request has expired'
        });
      }

      // Get user's editor ID
      const editorResult = await query(
        'SELECT id FROM editors WHERE user_id = $1',
        [userId]
      );

      const editorId = editorResult.rows.length > 0 ? editorResult.rows[0].id : null;

      // Reflect that this assigned editor has started working as soon as they upload something
      if (editorId) {
        await query(
          `UPDATE file_request_editors
           SET status = CASE
             WHEN status IN ('completed','declined') THEN status
             WHEN status = 'pending' THEN 'in_progress'
             ELSE status
           END,
           started_at = COALESCE(started_at, NOW())
           WHERE request_id = $1 AND editor_id = $2`,
          [fileRequest.id, editorId]
        );

        // Heuristic for workload accuracy:
        // If the request's num_creatives matches the number of assigned editors, treat 1 upload as fulfillment for that editor.
        try {
          const assignedCountRes = await query(
            'SELECT COUNT(*)::int AS cnt FROM file_request_editors WHERE request_id = $1',
            [fileRequest.id]
          );
          const assignedCount = assignedCountRes.rows[0]?.cnt || 0;
          const numCreatives = fileRequest.num_creatives ? Number(fileRequest.num_creatives) : null;

          if (numCreatives && assignedCount === numCreatives) {
            await query(
              `UPDATE file_request_editors
               SET status = 'completed',
                   completed_at = COALESCE(completed_at, NOW())
               WHERE request_id = $1 AND editor_id = $2`,
              [fileRequest.id, editorId]
            );
          }
        } catch (e) {
          logger.warn('Auto-complete editor assignment heuristic failed (non-fatal)', { requestId: fileRequest.id, editorId, error: e.message });
        }
      }

      // Determine target folder for upload. If a folder_path is provided (folder upload),
      // create/find the hierarchy under the request folder so the structure is preserved.
      let targetFolderIdForUpload = fileRequest.folder_id;
      let s3FolderPathForUpload = null;

      if (folder_path && String(folder_path).trim()) {
        try {
          const mediaController = require('./mediaController');
          // Reuse the same hierarchy logic as media uploads (creates folders as needed)
          targetFolderIdForUpload = await mediaController.createFolderHierarchy(
            fileRequest.folder_id,
            String(folder_path).trim(),
            userId
          );

          const targetFolder = await Folder.findById(targetFolderIdForUpload);
          if (targetFolder) {
            s3FolderPathForUpload = targetFolder.s3_path;
          }
        } catch (hierErr) {
          logger.warn('Folder hierarchy creation failed for request upload (continuing without hierarchy)', {
            requestId: id,
            folder_path,
            error: hierErr.message
          });
        }
      }

      const uploadType = folder_path && String(folder_path).trim() ? 'folder' : 'file';

      // 🆕 Create upload session to track this upload (one session can contain 1+ files)
      const uploadSessionResult = await query(
        `INSERT INTO file_request_uploads
         (file_request_id, uploaded_by, upload_type, file_count, total_size_bytes, folder_path, comments, editor_id, files_metadata)
         VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          fileRequest.id,
          userId,
          uploadType,
          req.file.size,
          folder_path || null,
          comments || null,
          editorId,
          JSON.stringify([
            {
              file_id: null,
              original_filename: req.file.originalname,
              file_size: req.file.size,
              mime_type: req.file.mimetype
            }
          ])
        ]
      );
      const uploadSessionId = uploadSessionResult.rows[0].id;

      // Upload file to S3 (as the current user)
      const mediaFile = await mediaService.uploadMedia(
        req.file,
        userId, // Upload as current user
        editorId, // Link to editor if available
        {
          tags: ['file-request-upload'],
          description: comments || `Uploaded via file request: ${fileRequest.title}`,
          folder_id: targetFolderIdForUpload,
          assigned_buyer_id: fileRequest.assigned_buyer_id || null,
          request_creator_id: fileRequest.creator_id, // ✨ Pass request creator for permissions
          request_id: fileRequest.id,  // ✨ Pass request ID for proper S3 structure
          is_file_request_upload: true, // Hide from media library by default
          upload_session_id: uploadSessionId, // 🆕 Link to upload session
          s3_folder_path: s3FolderPathForUpload // preserve folder structure for folder uploads
        }
      );

      // 🆕 Link the uploaded file to the upload session
      await query(
        `UPDATE media_files SET upload_session_id = $1 WHERE id = $2`,
        [uploadSessionId, mediaFile.id]
      );

      // Update the session snapshot metadata now that we have the final media file record
      await query(
        `UPDATE file_request_uploads
         SET files_metadata = $1,
             file_count = 1,
             total_size_bytes = $2
         WHERE id = $3`,
        [
          JSON.stringify([
            {
              file_id: mediaFile.id,
              original_filename: mediaFile.original_filename,
              file_size: mediaFile.file_size,
              file_type: mediaFile.file_type,
              mime_type: mediaFile.mime_type,
              thumbnail_url: mediaFile.thumbnail_url || null,
              s3_url: mediaFile.s3_url
            }
          ]),
          mediaFile.file_size,
          uploadSessionId
        ]
      );

      logger.info('File uploaded via request (authenticated)', {
        fileRequestId: fileRequest.id,
        fileId: mediaFile.id,
        userId,
        editorId,
        hasComments: !!comments,
        uploadSessionId
      });

      // If an editor uploaded at least one file, reflect that in the request lifecycle
      // (This is what powers the "Uploaded" state in the UI)
      await query(
        `UPDATE file_requests
         SET status = CASE
           WHEN status IN ('launched','closed') THEN status
           ELSE 'uploaded'
         END,
         uploaded_at = COALESCE(uploaded_at, NOW()),
         uploaded_by = COALESCE(uploaded_by, $1),
         updated_at = NOW()
         WHERE id = $2`,
        [userId, fileRequest.id]
      );

      // Per-editor quota progress: increment and complete if quota reached
      try {
        if (editorId) {
          const upd = await query(
            `UPDATE file_request_editors
             SET deliverables_uploaded = COALESCE(deliverables_uploaded, 0) + 1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE request_id = $1 AND editor_id = $2
             RETURNING deliverables_quota, deliverables_uploaded`,
            [fileRequest.id, editorId]
          );

          const quota = upd.rows[0]?.deliverables_quota;
          const uploaded = upd.rows[0]?.deliverables_uploaded;
          if (quota && uploaded >= quota) {
            await query(
              `UPDATE file_request_editors
               SET status = 'completed',
                   completed_at = COALESCE(completed_at, NOW()),
                   deliverables_completed_at = COALESCE(deliverables_completed_at, NOW())
               WHERE request_id = $1 AND editor_id = $2`,
              [fileRequest.id, editorId]
            );
          }
        }
      } catch (e) {
        logger.warn('Per-editor quota progress update failed (non-fatal)', { requestId: fileRequest.id, editorId, error: e.message });
      }

      // Log activity for the file upload
      await logActivity({
        req,
        userId,
        actionType: 'file_request_upload',
        resourceType: 'file_request',
        resourceId: fileRequest.id,
        resourceName: fileRequest.title,
        details: {
          file_id: mediaFile.id,
          file_name: mediaFile.original_filename,
          file_size: mediaFile.file_size,
          file_type: mediaFile.file_type,
          has_comments: !!comments,
          request_creator: fileRequest.creator_id
        },
        status: 'success'
      });

      // Create notification for request creator (if uploader is not the creator)
      if (userId !== fileRequest.creator_id) {
        await Notification.create({
          userId: fileRequest.creator_id,
          type: 'file_request_upload',
          title: 'New File Uploaded',
          message: `${req.user.name || req.user.email} uploaded "${mediaFile.original_filename}" to your request "${fileRequest.title}"`,
          referenceType: 'file_request',
          referenceId: fileRequest.id,
          metadata: {
            file_id: mediaFile.id,
            file_name: mediaFile.original_filename,
            uploaded_by: req.user.name || req.user.email
          }
        });
      }

      // Deliverables counter + notify buyer when target reached
      try {
        if (fileRequest.deliverables_required && Number(fileRequest.deliverables_required) > 0) {
          const countResult = await query(
            `SELECT COUNT(*)::int AS cnt
             FROM media_files mf
             JOIN file_request_uploads fru ON mf.upload_session_id = fru.id
             WHERE fru.file_request_id = $1
               AND COALESCE(fru.is_deleted, FALSE) = FALSE
               AND mf.is_deleted = FALSE`,
            [fileRequest.id]
          );

          const uploadedCount = countResult.rows[0]?.cnt || 0;

          // Mark completed_at and send a one-time notification
          if (uploadedCount >= Number(fileRequest.deliverables_required)) {
            const updated = await query(
              `UPDATE file_requests
               SET deliverables_completed_at = COALESCE(deliverables_completed_at, NOW()),
                   deliverables_notified_at = COALESCE(deliverables_notified_at, NOW())
               WHERE id = $1
                 AND deliverables_notified_at IS NULL
               RETURNING deliverables_notified_at`,
              [fileRequest.id]
            );

            if ((updated.rows || []).length > 0) {
              // Notify creator (buyer)
              await Notification.create({
                userId: fileRequest.creator_id,
                type: 'file_request_fulfilled',
                title: 'Request Completed',
                message: `All deliverables have been uploaded for "${fileRequest.title}" (${uploadedCount}/${fileRequest.deliverables_required}).`,
                referenceType: 'file_request',
                referenceId: fileRequest.id,
                metadata: {
                  deliverables_required: fileRequest.deliverables_required,
                  uploaded_count: uploadedCount
                }
              });

              // Notify assigned buyer if different
              if (fileRequest.assigned_buyer_id && fileRequest.assigned_buyer_id !== fileRequest.creator_id) {
                await Notification.create({
                  userId: fileRequest.assigned_buyer_id,
                  type: 'file_request_fulfilled',
                  title: 'Request Completed',
                  message: `All deliverables have been uploaded for "${fileRequest.title}" (${uploadedCount}/${fileRequest.deliverables_required}).`,
                  referenceType: 'file_request',
                  referenceId: fileRequest.id,
                  metadata: {
                    deliverables_required: fileRequest.deliverables_required,
                    uploaded_count: uploadedCount
                  }
                });
              }
            }
          }
        }
      } catch (e) {
        logger.warn('Deliverables progress update failed (non-fatal)', { requestId: fileRequest.id, error: e.message });
      }

      logger.info('✅ ====== UPLOAD TO REQUEST (AUTH) - SUCCESS ======', {
        requestId: fileRequest.id,
        fileId: mediaFile.id,
        filename: mediaFile.original_filename,
        fileSize: mediaFile.file_size,
        userId,
        editorId,
        notificationSent: userId !== fileRequest.creator_id,
        hasThumbnail: !!mediaFile.thumbnail_url
      });

      res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          id: mediaFile.id,
          filename: mediaFile.original_filename,
          original_filename: mediaFile.original_filename,
          file_type: mediaFile.file_type,
          file_size: mediaFile.file_size,
          thumbnail_url: mediaFile.thumbnail_url || null,
          s3_url: mediaFile.s3_url,
          cloudfront_url: mediaFile.s3_url, // s3_url is already CloudFront URL
          uploaded_by_email: req.user.email,
          uploaded_by_name: req.user.name,
          editor_id: editorId,
          created_at: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('❌ ====== UPLOAD TO REQUEST (AUTH) - ERROR ======', {
        error: error.message,
        stack: error.stack,
        requestId: req.params.id,
        userId: req.user?.id
      });
      next(error);
    }
  }

  /**
   * Assign multiple editors to a file request
   * POST /api/file-requests/:id/assign-editors
   */
  async assignEditors(req, res, next) {
    try {
      const { id } = req.params;
      const { editor_ids } = req.body;
      const userId = req.user.id;

      logger.info('assignEditors called', {
        requestId: id,
        editor_ids,
        editor_ids_type: typeof editor_ids,
        editor_ids_isArray: Array.isArray(editor_ids),
        userId,
        body: req.body
      });

      if (!Array.isArray(editor_ids) || editor_ids.length === 0) {
        logger.error('Invalid editor_ids', { editor_ids, type: typeof editor_ids });
        return res.status(400).json({
          success: false,
          error: 'editor_ids must be a non-empty array'
        });
      }

      // Verify file request exists and user owns it
      const requestResult = await query(
        'SELECT * FROM file_requests WHERE id = $1 AND created_by = $2',
        [id, userId]
      );

      logger.info('File request query result', {
        found: requestResult.rows.length,
        requestId: id,
        userId
      });

      if (requestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      // Verify all editors exist
      const editorsResult = await query(
        'SELECT id FROM editors WHERE id = ANY($1) AND is_active = TRUE',
        [editor_ids]
      );

      logger.info('Editors verification', {
        requestedCount: editor_ids.length,
        foundCount: editorsResult.rows.length,
        requestedIds: editor_ids,
        foundIds: editorsResult.rows.map(r => r.id)
      });

      if (editorsResult.rows.length !== editor_ids.length) {
        return res.status(400).json({
          success: false,
          error: 'One or more editors not found or inactive',
          details: {
            requested: editor_ids,
            found: editorsResult.rows.map(r => r.id)
          }
        });
      }

      // Insert editor assignments (ON CONFLICT DO NOTHING for idempotency)
      for (const editorId of editor_ids) {
        await query(
          `INSERT INTO file_request_editors (request_id, editor_id, status)
           VALUES ($1, $2, 'pending')
           ON CONFLICT (request_id, editor_id) DO NOTHING`,
          [id, editorId]
        );
      }

      // Update assigned_at timestamp
      await query(
        'UPDATE file_requests SET assigned_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );

      logger.info('Editors assigned to file request', {
        requestId: id,
        editorIds: editor_ids,
        userId
      });

      res.json({
        success: true,
        message: 'Editors assigned successfully',
        assigned_count: editor_ids.length
      });
    } catch (error) {
      logger.error('Assign editors error', { error: error.message });
      next(error);
    }
  }

  /**
   * Create folder for file request (editor use)
   * POST /api/file-requests/:id/folders
   */
  async createRequestFolder(req, res, next) {
    try {
      const { id } = req.params;
      const { folder_name, description } = req.body;
      const userId = req.user.id;

      if (!folder_name || folder_name.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'folder_name is required'
        });
      }

      // Verify file request exists
      const requestResult = await query(
        'SELECT * FROM file_requests WHERE id = $1',
        [id]
      );

      if (requestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      // Create folder
      const result = await query(
        `INSERT INTO file_request_folders (request_id, folder_name, description, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [id, folder_name.trim(), description || null, userId]
      );

      const folder = result.rows[0];

      logger.info('File request folder created', {
        folderId: folder.id,
        requestId: id,
        userId
      });

      res.status(201).json({
        success: true,
        message: 'Folder created successfully',
        data: folder
      });
    } catch (error) {
      logger.error('Create request folder error', { error: error.message });
      next(error);
    }
  }

  /**
   * Complete a file request (mark as completed with optional delivery note)
   * POST /api/file-requests/:id/complete
   */
  async completeRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { delivery_note } = req.body;
      const userId = req.user.id;

      // Get file request with assignment details
      const requestResult = await query(
        `SELECT fr.*, fre.accepted_at, fre.editor_id
         FROM file_requests fr
         LEFT JOIN file_request_editors fre ON fr.id = fre.request_id
         LEFT JOIN editors e ON fre.editor_id = e.id
         WHERE fr.id = $2 AND (e.user_id = $1 OR $1 = fr.created_by)`,
        [userId, id]
      );

      if (requestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      const fileRequest = requestResult.rows[0];

      // Calculate time to complete
      let timeToComplete = null;
      if (fileRequest.assigned_at) {
        const now = new Date();
        const assigned = new Date(fileRequest.assigned_at);
        timeToComplete = Math.floor((now - assigned) / (1000 * 60)); // minutes
      }

      // Update file request
      await query(
        `UPDATE file_requests
         SET
           delivery_note = $1,
           completed_at = CURRENT_TIMESTAMP,
           time_to_complete_minutes = $2
         WHERE id = $3`,
        [delivery_note || null, timeToComplete, id]
      );

      logger.info('File request completed', {
        requestId: id,
        userId,
        timeToComplete
      });

      res.json({
        success: true,
        message: 'File request completed successfully',
        time_to_complete_minutes: timeToComplete
      });
    } catch (error) {
      logger.error('Complete request error', { error: error.message });
      next(error);
    }
  }

  /**
   * Admin bulk reassign (replace assigned editors)
   * POST /api/file-requests/:id/admin-reassign
   * Body: { new_editor_ids: uuid[] , reason?: string }
   */
  async adminReassignRequest(req, res, next) {
    try {
      const { id } = req.params;
      // Back-compat: some clients send editor_ids
      const { new_editor_ids, editor_ids, reason, editor_distribution } = req.body;
      const userId = req.user.id;

      if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Admin only' });
      }

      // Support both old format (array of IDs) and new format (array of {editor_id, num_creatives})
      let editorAssignments = [];

      if (editor_distribution && Array.isArray(editor_distribution)) {
        // New format with creative distribution
        editorAssignments = editor_distribution;
      } else if (Array.isArray(new_editor_ids) && new_editor_ids.length > 0) {
        // Old format - convert to new format with 0 creatives (unspecified)
        editorAssignments = new_editor_ids.map(editorId => ({
          editor_id: editorId,
          num_creatives: 0
        }));
      } else if (Array.isArray(editor_ids) && editor_ids.length > 0) {
        // Even older format - also support editor_ids
        editorAssignments = editor_ids.map(editorId => ({
          editor_id: editorId,
          num_creatives: 0
        }));
      } else {
        return res.status(400).json({
          success: false,
          error: 'Either new_editor_ids or editor_distribution must be provided'
        });
      }

      if (editorAssignments.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one editor must be assigned'
        });
      }

      // Verify file request exists and get num_creatives
      const requestResult = await query(
        'SELECT id, num_creatives, title FROM file_requests WHERE id = $1',
        [id]
      );
      if (requestResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'File request not found' });
      }

      const fileRequest = requestResult.rows[0];
      const totalCreativesRequested = fileRequest.num_creatives || 0;

      // Validate creative distribution if specified
      if (editor_distribution && totalCreativesRequested > 0) {
        const totalAssigned = editorAssignments.reduce(
          (sum, assignment) => sum + (assignment.num_creatives || 0),
          0
        );

        if (totalAssigned > totalCreativesRequested) {
          return res.status(400).json({
            success: false,
            error: `Total creatives assigned (${totalAssigned}) exceeds requested (${totalCreativesRequested})`
          });
        }
      }

      // Get current editor assignments to compare
      const currentEditorsResult = await query(
        'SELECT editor_id, num_creatives_assigned FROM file_request_editors WHERE request_id = $1',
        [id]
      );
      const currentEditorIds = currentEditorsResult.rows.map(row => row.editor_id);
      const newEditorIds = editorAssignments.map(a => a.editor_id);

      // Find which editors are actually new
      const newlyAssignedEditors = newEditorIds.filter(
        editorId => !currentEditorIds.includes(editorId)
      );

      // Remove old editor assignments
      await query(
        'DELETE FROM file_request_editors WHERE request_id = $1',
        [id]
      );

      // Add new editor assignments with creative distribution
      for (const assignment of editorAssignments) {
        await query(
          `INSERT INTO file_request_editors (request_id, editor_id, status, num_creatives_assigned)
           VALUES ($1, $2, 'pending', $3)`,
          [id, assignment.editor_id, assignment.num_creatives || 0]
        );
      }

      // Log reassignment in request_reassignments table if reason provided
      if (reason && reason.trim()) {
        for (const oldEditorId of currentEditorIds) {
          for (const newEditorId of newEditorIds) {
            if (oldEditorId !== newEditorId) {
              await query(
                `INSERT INTO request_reassignments (file_request_id, reassigned_from, reassigned_to, reassignment_note)
                 VALUES ($1, (SELECT user_id FROM editors WHERE id = $2), (SELECT user_id FROM editors WHERE id = $3), $4)`,
                [id, oldEditorId, newEditorId, reason]
              );
            }
          }
        }
      }

      // Increment reassignment count
      await query(
        'UPDATE file_requests SET reassignment_count = COALESCE(reassignment_count, 0) + 1 WHERE id = $1',
        [id]
      );

      // Log activity
      await logActivity({
        req,
        actionType: 'file_request_reassigned',
        resourceType: 'file_request',
        resourceId: id,
        resourceName: requestResult.rows[0].title,
        details: {
          mode: 'admin_replace',
          new_editor_assignments: editorAssignments,
          newly_assigned_editor_ids: newlyAssignedEditors,
          previous_editor_ids: currentEditorIds,
          reason,
          creative_distribution_used: !!editor_distribution
        },
        status: 'success'
      });

      logger.info('File request reassigned with creative distribution', {
        requestId: id,
        newEditorAssignments: editorAssignments,
        newlyAssignedEditors: newlyAssignedEditors,
        userId,
        reason
      });

      res.json({
        success: true,
        message: 'Request reassigned successfully (admin)',
        assigned_count: editorAssignments.length,
        newly_assigned_count: newlyAssignedEditors.length,
        total_creatives_distributed: editorAssignments.reduce((sum, a) => sum + (a.num_creatives || 0), 0)
      });
    } catch (error) {
      logger.error('Admin reassign request error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get folders for a file request
   * GET /api/file-requests/:id/folders
   */
  async getRequestFolders(req, res, next) {
    try {
      const { id } = req.params;

      const result = await query(
        `SELECT
           frf.*,
           u.name as created_by_name,
           COUNT(fru.id) as file_count
         FROM file_request_folders frf
         LEFT JOIN users u ON frf.created_by = u.id
         LEFT JOIN file_request_uploads fru ON fru.folder_id = frf.id
         WHERE frf.request_id = $1
         GROUP BY frf.id, u.name
         ORDER BY frf.created_at ASC`,
        [id]
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Get request folders error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get assigned editors for a file request
   * GET /api/file-requests/:id/editors
   */
  async getAssignedEditors(req, res, next) {
    try {
      const { id } = req.params;

      const result = await query(
        `SELECT
           fre.*,
           e.name as editor_name,
           e.display_name as editor_display_name,
           u.name as user_name,
           u.email as user_email
         FROM file_request_editors fre
         LEFT JOIN editors e ON fre.editor_id = e.id
         LEFT JOIN users u ON e.user_id = u.id
         WHERE fre.request_id = $1
         ORDER BY fre.created_at ASC`,
        [id]
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Get assigned editors error', { error: error.message });
      next(error);
    }
  }

  /**
   * Upload chunk for large file uploads
   * POST /api/file-requests/:id/upload-chunk
   */
  async uploadChunk(req, res, next) {
    const fs = require('fs');
    const path = require('path');

    try {
      const { id } = req.params;
      const { chunkIndex, totalChunks, fileName, fileSize } = req.body;
      const userId = req.user.id;

      logger.info('Uploading chunk', {
        requestId: id,
        chunkIndex,
        totalChunks,
        fileName,
        userId
      });

      // Verify request exists
      const requestCheck = await query(
        'SELECT id, is_active FROM file_requests WHERE id = $1',
        [id]
      );

      if (requestCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      if (!requestCheck.rows[0].is_active) {
        return res.status(400).json({
          success: false,
          error: 'File request is not active'
        });
      }

      // Create temp directory for chunks if it doesn't exist
      const tempDir = path.join(__dirname, '../../temp/chunks', id, fileName);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Save chunk to temp directory
      const chunkPath = path.join(tempDir, `chunk_${chunkIndex}`);

      if (req.file && req.file.buffer) {
        fs.writeFileSync(chunkPath, req.file.buffer);
      } else if (req.file && req.file.path) {
        fs.copyFileSync(req.file.path, chunkPath);
        fs.unlinkSync(req.file.path); // Delete original temp file
      } else {
        return res.status(400).json({
          success: false,
          error: 'No file chunk received'
        });
      }

      logger.info('Chunk saved successfully', {
        chunkIndex,
        chunkPath
      });

      res.json({
        success: true,
        message: `Chunk ${chunkIndex} uploaded successfully`,
        data: {
          chunkIndex,
          totalChunks
        }
      });
    } catch (error) {
      logger.error('Upload chunk error', { error: error.message, stack: error.stack });
      next(error);
    }
  }

  /**
   * Finalize chunked upload - merge chunks and upload to S3
   * POST /api/file-requests/:id/finalize-upload
   */
  async finalizeChunkedUpload(req, res, next) {
    const fs = require('fs');
    const path = require('path');

    try {
      const { id } = req.params;
      const { fileName, fileSize, totalChunks, comments, folder_path } = req.body;
      const userId = req.user.id;

      logger.info('Finalizing chunked upload', {
        requestId: id,
        fileName,
        fileSize,
        totalChunks,
        userId
      });

      // Verify request exists
      const requestResult = await query(
        'SELECT id, is_active, folder_id FROM file_requests WHERE id = $1',
        [id]
      );

      if (requestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      const request = requestResult.rows[0];

      if (!request.is_active) {
        return res.status(400).json({
          success: false,
          error: 'File request is not active'
        });
      }

      // Get chunks directory
      const tempDir = path.join(__dirname, '../../temp/chunks', id, fileName);

      if (!fs.existsSync(tempDir)) {
        return res.status(400).json({
          success: false,
          error: 'No chunks found for this file'
        });
      }

      // Verify all chunks exist
      const missingChunks = [];
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(tempDir, `chunk_${i}`);
        if (!fs.existsSync(chunkPath)) {
          missingChunks.push(i);
        }
      }

      if (missingChunks.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Missing chunks: ${missingChunks.join(', ')}`
        });
      }

      // Merge chunks into single file
      const mergedFilePath = path.join(__dirname, '../../temp', `${Date.now()}_${fileName}`);
      const writeStream = fs.createWriteStream(mergedFilePath);

      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(tempDir, `chunk_${i}`);
        const chunkBuffer = fs.readFileSync(chunkPath);
        writeStream.write(chunkBuffer);
      }

      writeStream.end();

      // Wait for write to complete
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      logger.info('Chunks merged successfully', { mergedFilePath });

      // Get user info for uploader name
      const userResult = await query('SELECT name FROM users WHERE id = $1', [userId]);
      const uploaderName = userResult.rows[0]?.name || 'Unknown';

      // Get user's editor ID
      const editorResult = await query('SELECT id FROM editors WHERE user_id = $1', [userId]);
      const editorId = editorResult.rows.length > 0 ? editorResult.rows[0].id : null;

      // If folder_path is provided, preserve hierarchy under the request folder (same behavior as normal uploads)
      let targetFolderIdForUpload = request.folder_id;
      let s3FolderPathForUpload = null;

      if (folder_path && String(folder_path).trim()) {
        try {
          const mediaController = require('./mediaController');
          targetFolderIdForUpload = await mediaController.createFolderHierarchy(
            request.folder_id,
            String(folder_path).trim(),
            userId
          );

          const targetFolder = await Folder.findById(targetFolderIdForUpload);
          if (targetFolder) {
            s3FolderPathForUpload = targetFolder.s3_path;
          }
        } catch (hierErr) {
          logger.warn('Folder hierarchy creation failed for chunked request upload (continuing without hierarchy)', {
            requestId: id,
            folder_path,
            error: hierErr.message
          });
        }
      }

      // Ensure the editor assignment reflects that work has started
      if (editorId) {
        await query(
          `UPDATE file_request_editors
           SET status = CASE
             WHEN status IN ('completed','declined') THEN status
             WHEN status = 'pending' THEN 'in_progress'
             ELSE status
           END,
           started_at = COALESCE(started_at, NOW())
           WHERE request_id = $1 AND editor_id = $2`,
          [id, editorId]
        );
      }

      // 🆕 Create upload session to track this chunked upload
      const uploadSessionResult = await query(
        `INSERT INTO file_request_uploads
         (file_request_id, uploaded_by, upload_type, file_count, total_size_bytes, folder_path, comments, editor_id, files_metadata)
         VALUES ($1, $2, 'file', 1, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          id,
          userId,
          fileSize,
          folder_path || null,
          comments || null,
          editorId,
          JSON.stringify([
            {
              file_id: null,
              original_filename: fileName,
              file_size: fileSize,
              mime_type: this.getMimeType(fileName)
            }
          ])
        ]
      );
      const uploadSessionId = uploadSessionResult.rows[0].id;

      // Upload merged file to S3 using mediaService
      const uploadResult = await mediaService.uploadMedia(
        {
          path: mergedFilePath,
          originalname: fileName,
          size: fileSize,
          mimetype: this.getMimeType(fileName)
        },
        userId,
        editorId,
        {
          tags: ['file-request-upload'],
          description: comments || `Uploaded via file request (chunked)`,
          folder_id: targetFolderIdForUpload,
          request_id: id,
          is_file_request_upload: true,
          upload_session_id: uploadSessionId,
          s3_folder_path: s3FolderPathForUpload
        }
      );

      // 🆕 Link the uploaded file to the upload session
      await query(
        `UPDATE media_files SET upload_session_id = $1 WHERE id = $2`,
        [uploadSessionId, uploadResult.id]
      );

      // Update session snapshot metadata with final file
      await query(
        `UPDATE file_request_uploads
         SET files_metadata = $1,
             file_count = 1,
             total_size_bytes = $2
         WHERE id = $3`,
        [
          JSON.stringify([
            {
              file_id: uploadResult.id,
              original_filename: uploadResult.original_filename || fileName,
              file_size: fileSize,
              file_type: uploadResult.file_type,
              mime_type: this.getMimeType(fileName),
              thumbnail_url: uploadResult.thumbnail_url || null,
              s3_url: uploadResult.s3_url
            }
          ]),
          fileSize,
          uploadSessionId
        ]
      );

      // Per-editor quota progress (chunked): increment and complete if quota reached
      try {
        if (editorId) {
          const upd = await query(
            `UPDATE file_request_editors
             SET deliverables_uploaded = COALESCE(deliverables_uploaded, 0) + 1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE request_id = $1 AND editor_id = $2
             RETURNING deliverables_quota, deliverables_uploaded`,
            [id, editorId]
          );

          const quota = upd.rows[0]?.deliverables_quota;
          const uploaded = upd.rows[0]?.deliverables_uploaded;
          if (quota && uploaded >= quota) {
            await query(
              `UPDATE file_request_editors
               SET status = 'completed',
                   completed_at = COALESCE(completed_at, NOW()),
                   deliverables_completed_at = COALESCE(deliverables_completed_at, NOW())
               WHERE request_id = $1 AND editor_id = $2`,
              [id, editorId]
            );
          }
        }
      } catch (e) {
        logger.warn('Per-editor quota progress update failed for chunked upload (non-fatal)', { requestId: id, editorId, error: e.message });
      }

      // Clean up temp files
      fs.unlinkSync(mergedFilePath);
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(tempDir, `chunk_${i}`);
        if (fs.existsSync(chunkPath)) {
          fs.unlinkSync(chunkPath);
        }
      }
      fs.rmdirSync(tempDir);

      // Log activity
      await logActivity({
        userId,
        action: 'file_request.upload',
        resourceType: 'file_request',
        resourceId: id,
        details: {
          fileName,
          fileSize,
          comments,
          uploadMethod: 'chunked'
        }
      });

      logger.info('Chunked upload completed successfully', {
        requestId: id,
        fileName,
        fileId: uploadResult.id
      });

      res.json({
        success: true,
        message: 'File uploaded successfully',
        data: uploadResult
      });
    } catch (error) {
      logger.error('Finalize chunked upload error', { error: error.message, stack: error.stack });
      next(error);
    }
  }

  /**
   * Get MIME type from filename
   */
  getMimeType(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes = {
      // Images
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      // Videos
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      webm: 'video/webm',
      mkv: 'video/x-matroska',
      // Documents
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      // Archives
      zip: 'application/zip',
      rar: 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Mark file request as uploaded (editor completes uploads)
   * POST /api/file-requests/:id/mark-uploaded
   */
  async markAsUploaded(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      // Get file request
      const requestResult = await query(
        'SELECT * FROM file_requests WHERE id = $1',
        [id]
      );

      if (requestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      const fileRequest = requestResult.rows[0];

      // Check permission: Only assigned editors (by editor profile) can mark as uploaded
      let isAssignedEditor = false;
      if (userRole !== 'admin') {
        const assignedEditorCheck = await query(
          `SELECT 1
           FROM file_request_editors fre
           JOIN editors e ON fre.editor_id = e.id
           WHERE fre.request_id = $1
             AND e.user_id = $2
           LIMIT 1`,
          [id, userId]
        );
        isAssignedEditor = assignedEditorCheck.rows.length > 0;
      }

      if (!isAssignedEditor && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Only assigned editors can mark request as uploaded'
        });
      }

      // Update status
      await query(
        `UPDATE file_requests
         SET status = 'uploaded',
             uploaded_at = NOW(),
             uploaded_by = $1
         WHERE id = $2`,
        [userId, id]
      );

      // Mark this editor assignment as completed/fulfilled
      try {
        const editorResult = await query('SELECT id FROM editors WHERE user_id = $1', [userId]);
        const editorId = editorResult.rows[0]?.id;
        if (editorId) {
          await query(
            `UPDATE file_request_editors
             SET status = 'completed',
                 completed_at = NOW()
             WHERE request_id = $1 AND editor_id = $2`,
            [id, editorId]
          );
        }
      } catch (e) {
        logger.warn('Failed to mark file_request_editors completed on mark-uploaded (non-fatal)', { requestId: id, userId, error: e.message });
      }


      // Log activity
      await logActivity({
        req,
        actionType: 'file_request_uploaded',
        resourceType: 'file_request',
        resourceId: id,
        resourceName: fileRequest.title,
        details: { uploaded_by_name: req.user.name },
        status: 'success'
      });

      // Notify request creator
      await Notification.create({
        user_id: fileRequest.created_by,
        type: 'file_request_uploaded',
        title: 'File Request Uploaded',
        message: `${req.user.name} has uploaded files for "${fileRequest.title}"`,
        reference_type: 'file_request',
        reference_id: id
      });

      res.json({
        success: true,
        message: 'File request marked as uploaded'
      });
    } catch (error) {
      logger.error('Mark as uploaded failed', { error: error.message });
      next(error);
    }
  }

  /**
   * Launch file request (buyer accepts and launches)
   * POST /api/file-requests/:id/launch
   */
  async launch(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      // Get file request
      const requestResult = await query(
        'SELECT * FROM file_requests WHERE id = $1',
        [id]
      );

      if (requestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      const fileRequest = requestResult.rows[0];

      // Check permission: Only creator, assigned buyer, or admin
      const canLaunch = fileRequest.created_by === userId ||
                        fileRequest.assigned_buyer_id === userId ||
                        userRole === 'admin';

      if (!canLaunch) {
        return res.status(403).json({
          success: false,
          error: 'Only request creator or assigned buyer can launch'
        });
      }

      // Launch is equivalent to close in your workflow
      await query(
        `UPDATE file_requests
         SET status = 'closed',
             is_active = FALSE,
             launched_at = NOW(),
             launched_by = $1,
             closed_at = NOW(),
             closed_by = $1,
             completed_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [userId, id]
      );

      // Mark all editor assignments completed (so workload drops immediately)
      await query(
        `UPDATE file_request_editors
         SET status = 'completed',
             completed_at = COALESCE(completed_at, NOW())
         WHERE request_id = $1
           AND status IN ('pending','accepted','in_progress','picked_up')`,
        [id]
      );

      // Log activity
      await logActivity({
        req,
        actionType: 'file_request_closed',
        resourceType: 'file_request',
        resourceId: id,
        resourceName: fileRequest.title,
        details: { launched_by_name: req.user.name },
        status: 'success'
      });

      res.json({
        success: true,
        message: 'File request launched and closed successfully'
      });
    } catch (error) {
      logger.error('Launch request failed', { error: error.message });
      next(error);
    }
  }

  /**
   * Close file request (buyer closes after launch)
   * POST /api/file-requests/:id/close
   */
  async closeRequest(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      // Get file request
      const requestResult = await query(
        'SELECT * FROM file_requests WHERE id = $1',
        [id]
      );

      if (requestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      const fileRequest = requestResult.rows[0];

      // Check permission
      const canClose = fileRequest.created_by === userId ||
                       fileRequest.assigned_buyer_id === userId ||
                       userRole === 'admin';

      if (!canClose) {
        return res.status(403).json({
          success: false,
          error: 'Only request creator or assigned buyer can close'
        });
      }

      // Update status
      await query(
        `UPDATE file_requests
         SET status = 'closed',
             is_active = FALSE,
             closed_at = NOW(),
             closed_by = $1,
             completed_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [userId, id]
      );

      // Log activity
      await logActivity({
        req,
        actionType: 'file_request_closed',
        resourceType: 'file_request',
        resourceId: id,
        resourceName: fileRequest.title,
        details: { closed_by_name: req.user.name },
        status: 'success'
      });

      res.json({
        success: true,
        message: 'File request closed successfully',
        note: 'Launch is the primary close action in this workflow.'
      });
    } catch (error) {
      logger.error('Close request failed', { error: error.message });
      next(error);
    }
  }

  /**
   * Reopen file request (buyer reopens closed request)
   * POST /api/file-requests/:id/reopen
   */
  async reopenRequest(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      // Get file request
      const requestResult = await query(
        'SELECT * FROM file_requests WHERE id = $1',
        [id]
      );

      if (requestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      const fileRequest = requestResult.rows[0];

      // Check permission
      const canReopen = fileRequest.created_by === userId ||
                        fileRequest.assigned_buyer_id === userId ||
                        userRole === 'admin';

      if (!canReopen) {
        return res.status(403).json({
          success: false,
          error: 'Only request creator or assigned buyer can reopen'
        });
      }

      // Update status
      await query(
        `UPDATE file_requests
         SET status = 'reopened',
             is_active = TRUE,
             reopened_at = NOW(),
             reopened_by = $1,
             reopen_count = reopen_count + 1,
             updated_at = NOW()
         WHERE id = $2`,
        [userId, id]
      );

      // Log activity
      await logActivity({
        req,
        actionType: 'file_request_reopened',
        resourceType: 'file_request',
        resourceId: id,
        resourceName: fileRequest.title,
        details: {
          reopened_by_name: req.user.name,
          reopen_count: (fileRequest.reopen_count || 0) + 1
        },
        status: 'success'
      });

      // Notify assigned editors
      if (fileRequest.assigned_editors && fileRequest.assigned_editors.length > 0) {
        for (const editorId of fileRequest.assigned_editors) {
          await Notification.create({
            user_id: editorId,
            type: 'file_request_reopened',
            title: 'File Request Reopened',
            message: `${req.user.name} has reopened "${fileRequest.title}"`,
            reference_type: 'file_request',
            reference_id: id
          });
        }
      }

      res.json({
        success: true,
        message: 'File request reopened successfully'
      });
    } catch (error) {
      logger.error('Reopen request failed', { error: error.message });
      next(error);
    }
  }

  /**
   * Get upload history for file request
   * GET /api/file-requests/:id/upload-history
   */
  async getUploadHistory(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Verify user has access to this request
      const requestResult = await query(
        'SELECT * FROM file_requests WHERE id = $1',
        [id]
      );

      if (requestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      const fileRequest = requestResult.rows[0];

      // Check access (creator, assigned buyer, assigned editor, admin)
      let isAssignedEditor = false;
      if (req.user.role !== 'admin') {
        const assignedEditorCheck = await query(
          `SELECT 1
           FROM file_request_editors fre
           JOIN editors e ON fre.editor_id = e.id
           WHERE fre.request_id = $1
             AND e.user_id = $2
           LIMIT 1`,
          [id, userId]
        );
        isAssignedEditor = assignedEditorCheck.rows.length > 0;
      }

      const hasAccess = req.user.role === 'admin' ||
                       fileRequest.created_by === userId ||
                       fileRequest.assigned_buyer_id === userId ||
                       isAssignedEditor;

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Get upload sessions with uploader details
      const uploadHistory = await query(
        `SELECT
          fru.*,
          u.name as uploader_name,
          u.email as uploader_email
         FROM file_request_uploads fru
         LEFT JOIN users u ON fru.uploaded_by = u.id
         WHERE fru.file_request_id = $1
           AND (COALESCE(fru.file_count, 0) > 0 OR COALESCE(fru.total_size_bytes, 0) > 0)
         ORDER BY fru.created_at DESC`,
        [id]
      );

      res.json({
        success: true,
        data: uploadHistory.rows
      });
    } catch (error) {
      logger.error('Get upload history failed', { error: error.message });
      next(error);
    }
  }

  /**
   * Delete (soft-remove) an upload session from a file request
   * DELETE /api/file-requests/:id/uploads/:uploadId
   */
  async deleteUploadSession(req, res, next) {
    try {
      const { id, uploadId } = req.params;
      const userId = req.user.id;

      // Fetch request
      const requestResult = await query('SELECT * FROM file_requests WHERE id = $1', [id]);
      if (requestResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'File request not found' });
      }
      const fileRequest = requestResult.rows[0];

      // Access check (creator, assigned buyer, assigned editor, admin)
      let isAssignedEditor = false;
      if (req.user.role !== 'admin') {
        const assignedEditorCheck = await query(
          `SELECT 1
           FROM file_request_editors fre
           JOIN editors e ON fre.editor_id = e.id
           WHERE fre.request_id = $1
             AND e.user_id = $2
           LIMIT 1`,
          [id, userId]
        );
        isAssignedEditor = assignedEditorCheck.rows.length > 0;
      }

      const hasAccess = req.user.role === 'admin' ||
        fileRequest.created_by === userId ||
        fileRequest.assigned_buyer_id === userId ||
        isAssignedEditor;

      if (!hasAccess) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      // Ensure upload session belongs to request
      const uploadResult = await query(
        `SELECT * FROM file_request_uploads WHERE id = $1 AND file_request_id = $2`,
        [uploadId, id]
      );
      if (uploadResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Upload session not found' });
      }

      // Soft-delete session
      await query(
        `UPDATE file_request_uploads
         SET is_deleted = TRUE,
             deleted_at = NOW(),
             deleted_by = $1
         WHERE id = $2`,
        [userId, uploadId]
      );

      // Soft-delete all linked media files (do NOT hard delete; keeps audit/history intact)
      await query(
        `UPDATE media_files
         SET is_deleted = TRUE
         WHERE upload_session_id = $1`,
        [uploadId]
      );

      await logActivity({
        req,
        actionType: 'file_request_upload_deleted',
        resourceType: 'file_request',
        resourceId: id,
        resourceName: fileRequest.title,
        details: { upload_session_id: uploadId },
        status: 'success'
      });

      return res.json({ success: true, message: 'Upload removed from request' });
    } catch (error) {
      logger.error('Delete upload session failed', { error: error.message });
      next(error);
    }
  }

  /**
   * Reassign file request to another editor
   * POST /api/file-requests/:id/reassign
   */
  async reassignRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { reassign_to, editor_ids, note } = req.body;
      const userId = req.user.id;

      const hasMultiple = Array.isArray(editor_ids) && editor_ids.length > 0;
      if (!hasMultiple && !reassign_to) {
        return res.status(400).json({
          success: false,
          error: 'reassign_to is required'
        });
      }

      // Get request details
      const requestResult = await query(
        'SELECT * FROM file_requests WHERE id = $1',
        [id]
      );

      if (requestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      const fileRequest = requestResult.rows[0];

      // RBAC: Only auto-assigned head, currently assigned editors, or admin can reassign
      let isAssignedEditor = false;
      try {
        const assignedEditorCheck = await query(
          `SELECT 1
           FROM file_request_editors fre
           JOIN editors e ON fre.editor_id = e.id
           WHERE fre.request_id = $1
             AND e.user_id = $2
           LIMIT 1`,
          [id, userId]
        );
        isAssignedEditor = assignedEditorCheck.rows.length > 0;
      } catch (rbacErr) {
        logger.warn('Reassign RBAC check failed (default deny)', { requestId: id, userId, error: rbacErr.message });
      }

      const canReassign = req.user.role === 'admin' || fileRequest.auto_assigned_head === userId || isAssignedEditor;

      if (!canReassign) {
        return res.status(403).json({
          success: false,
          error: 'Only assigned editors, vertical heads, or admin can reassign requests'
        });
      }

      // Resolve target editors. Supports:
      // - single: reassign_to (editor_id or user_id)
      // - multiple: editor_ids[] (editor_id or user_id entries)
      // Optional: editor_quotas map { [editor_id]: number }
      const { editor_quotas } = req.body;
      const targets = hasMultiple ? editor_ids : [reassign_to];

      const resolvedTargets = [];
      for (const t of targets) {
        const editorCheck = await query(
          `SELECT e.id as editor_id, e.user_id as user_id
           FROM editors e
           WHERE e.is_active = TRUE
             AND (e.id = $1 OR e.user_id = $1)
           LIMIT 1`,
          [t]
        );
        if (editorCheck.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Target editor not found', target: t });
        }
        resolvedTargets.push({ editor_id: editorCheck.rows[0].editor_id, user_id: editorCheck.rows[0].user_id });
      }

      const targetEditorIds = resolvedTargets.map(r => r.editor_id);

      // Create reassignment records (store reassigned_to as USER id)
      for (const r of resolvedTargets) {
        await query(
          `INSERT INTO request_reassignments
           (file_request_id, reassigned_from, reassigned_to, reassignment_note)
           VALUES ($1, $2, $3, $4)`,
          [id, userId, r.user_id, note || null]
        );
      }

      // Mark existing active/pending assignments as reassigned (keeps history)
      await query(
        `UPDATE file_request_editors
         SET status = 'reassigned', updated_at = CURRENT_TIMESTAMP
         WHERE request_id = $1
           AND status IN ('pending', 'accepted', 'in_progress', 'picked_up')`,
        [id]
      );

      // Ensure target editor assignments exist (set to pending) + optional quota
      for (const editorId of targetEditorIds) {
        const quota = editor_quotas && typeof editor_quotas === 'object'
          ? Number(editor_quotas[editorId])
          : null;
        const safeQuota = quota && !Number.isNaN(quota) && quota > 0 ? Math.floor(quota) : null;

        await query(
          `INSERT INTO file_request_editors (request_id, editor_id, status, deliverables_quota)
           VALUES ($1, $2, 'pending', $3)
           ON CONFLICT (request_id, editor_id) DO UPDATE
           SET status = 'pending',
               deliverables_quota = COALESCE($3, file_request_editors.deliverables_quota),
               updated_at = CURRENT_TIMESTAMP`,
          [id, editorId, safeQuota]
        );
      }

      // Update reassignment count
      await query(
        `UPDATE file_requests
         SET reassignment_count = reassignment_count + 1
         WHERE id = $1`,
        [id]
      );

      // Send notification(s) to reassigned editor(s) with note
      // (one per editor user)
      // NOTE: fileRequest variable is available above
      //
      // For multiple targets, notify all
      for (const r of resolvedTargets) {
        await Notification.create({
          userId: r.user_id,
          type: 'file_request_reassigned',
          title: 'File Request Reassigned to You',
          message: `"${fileRequest.title}" has been reassigned to you by ${req.user.name || req.user.email}${note ? ': ' + note : ''}`,
          referenceType: 'file_request',
          referenceId: id,
          metadata: {
            request_title: fileRequest.title,
            reassigned_from: req.user.name || req.user.email,
            reassignment_note: note,
            deadline: fileRequest.deadline,
            editor_id: r.editor_id
          }
        });
      }

      // Log activity
      await logActivity({
        req,
        actionType: 'file_request_reassigned',
        resourceType: 'file_request',
        resourceId: id,
        resourceName: fileRequest.title,
        details: {
          reassigned_to_user_ids: resolvedTargets.map(x => x.user_id),
          reassigned_to_editor_ids: resolvedTargets.map(x => x.editor_id),
          note
        },
        status: 'success'
      });

      logger.info('File request reassigned', {
        requestId: id,
        reassigned_from: userId,
        reassigned_to_user_ids: resolvedTargets.map(x => x.user_id),
        reassigned_to_editor_ids: resolvedTargets.map(x => x.editor_id),
        note
      });

      res.json({
        success: true,
        message: 'Request reassigned successfully',
        assigned_count: resolvedTargets.length
      });
    } catch (error) {
      logger.error('Reassign request failed', { error: error.message });
      next(error);
    }
  }

  /**
   * Get reassignment history for a request
   * GET /api/file-requests/:id/reassignments
   */
  async getReassignments(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Verify user has access to this request
      const requestResult = await query(
        'SELECT * FROM file_requests WHERE id = $1',
        [id]
      );

      if (requestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      const fileRequest = requestResult.rows[0];

      // Check access (creator, assigned buyer, assigned editor, admin)
      let isAssignedEditor = false;
      if (req.user.role !== 'admin') {
        const assignedEditorCheck = await query(
          `SELECT 1
           FROM file_request_editors fre
           JOIN editors e ON fre.editor_id = e.id
           WHERE fre.request_id = $1
             AND e.user_id = $2
           LIMIT 1`,
          [id, userId]
        );
        isAssignedEditor = assignedEditorCheck.rows.length > 0;
      }

      const hasAccess = req.user.role === 'admin' ||
                       fileRequest.created_by === userId ||
                       fileRequest.assigned_buyer_id === userId ||
                       isAssignedEditor;

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Get reassignment history
      const reassignments = await query(
        `SELECT
          rr.*,
          uf.name as from_name,
          uf.email as from_email,
          ut.name as to_name,
          ut.email as to_email
         FROM request_reassignments rr
         JOIN users uf ON rr.reassigned_from = uf.id
         JOIN users ut ON rr.reassigned_to = ut.id
         WHERE rr.file_request_id = $1
         ORDER BY rr.created_at DESC`,
        [id]
      );

      res.json({
        success: true,
        data: reassignments.rows
      });
    } catch (error) {
      logger.error('Get reassignments failed', { error: error.message });
      next(error);
    }
  }
}

module.exports = new FileRequestController();
