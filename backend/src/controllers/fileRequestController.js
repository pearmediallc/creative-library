const { query, transaction } = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');
const mediaService = require('../services/mediaService');
const { logActivity } = require('../middleware/activityLogger');
const Notification = require('../models/Notification');
const Folder = require('../models/Folder');

class FileRequestController {
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
        assigned_buyer_id
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
           allow_multiple_uploads, require_email, custom_message, assigned_buyer_id, auto_assigned_head, assigned_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
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
            (editor_id || finalEditorIds.length > 0) ? new Date() : null
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

      // 🆕 INSERT PLATFORMS into junction table
      if (platformArray && platformArray.length > 0) {
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
      }

      // 🆕 INSERT VERTICALS into junction table
      if (verticalArray && verticalArray.length > 0) {
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

      // Check if user is an editor (creative role)
      const isEditor = userRole === 'creative';
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
        params = [editorId];

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
        const result = await query(
          `SELECT
            fr.*,
            f.name as folder_name,
            COUNT(DISTINCT fru.id) as upload_count,
            fre.status as my_assignment_status,
            fre.created_at as assigned_at,
            buyer.name as buyer_name,
            buyer.email as buyer_email,
            creator.name as created_by_name,
            STRING_AGG(DISTINCT e.display_name, ', ' ORDER BY e.display_name) as assigned_editors,
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
          FROM file_request_editors fre
          JOIN file_requests fr ON fre.request_id = fr.id
          LEFT JOIN folders f ON fr.folder_id = f.id
          LEFT JOIN file_request_uploads fru ON fr.id = fru.file_request_id
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
        if (userRole === 'admin') {
          // Only admins see ALL requests
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

        const result = await query(
          `SELECT
            fr.*,
            f.name as folder_name,
            COUNT(DISTINCT fru.id) as upload_count,
            buyer.name as buyer_name,
            buyer.email as buyer_email,
            creator.name as created_by_name,
            STRING_AGG(DISTINCT e.display_name, ', ') as assigned_editors,
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

      // Check if user is an editor
      const isEditor = userRole === 'creative';

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
        result = await query(
          `SELECT
            fr.*,
            f.name as folder_name,
            COUNT(DISTINCT fru.id) as upload_count,
            u.name as creator_name,
            u.email as creator_email,
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
        if (userRole === 'admin') {
          // Only admins can view any request
          result = await query(
            `SELECT
              fr.*,
              f.name as folder_name,
              COUNT(DISTINCT fru.id) as upload_count,
              u.name as creator_name,
              u.email as creator_email,
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
              COUNT(DISTINCT fru.id) as upload_count,
              u.name as creator_name,
              u.email as creator_email,
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
              COUNT(DISTINCT fru.id) as upload_count,
              u.name as creator_name,
              u.email as creator_email,
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

      const uploadsResult = await query(
        `SELECT
          fru.*,
          mf.original_filename,
          mf.file_type,
          mf.file_size,
          mf.thumbnail_url,
          mf.s3_url
        FROM file_request_uploads fru
        JOIN media_files mf ON fru.file_id = mf.id
        WHERE fru.file_request_id = $1
        ORDER BY fru.created_at DESC`,
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
            fre.completed_at
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

      // Track the upload with comments and editor
      await query(
        `INSERT INTO file_request_uploads
        (file_request_id, file_id, uploaded_by_email, uploaded_by_name, editor_id, comments)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          fileRequest.id,
          mediaFile.id,
          uploader_email || null,
          uploader_name || null,
          uploadEditorId,
          comments || null
        ]
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
      const { comments } = req.body;
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

      // 🆕 Create upload session to track this upload
      const uploadSessionResult = await query(
        `INSERT INTO file_request_uploads
        (file_request_id, uploaded_by, upload_type, file_count, total_size_bytes)
        VALUES ($1, $2, 'file', 1, $3)
        RETURNING id`,
        [fileRequest.id, userId, req.file.size]
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
          folder_id: fileRequest.folder_id,
          assigned_buyer_id: fileRequest.assigned_buyer_id || null,
          request_creator_id: fileRequest.creator_id, // ✨ Pass request creator for permissions
          request_id: fileRequest.id,  // ✨ Pass request ID for proper S3 structure
          is_file_request_upload: true, // Hide from media library by default
          upload_session_id: uploadSessionId // 🆕 Link to upload session
        }
      );

      // 🆕 Link the uploaded file to the upload session
      await query(
        `UPDATE media_files SET upload_session_id = $1 WHERE id = $2`,
        [uploadSessionId, mediaFile.id]
      );

      // ✨ CRITICAL: Also create a file_request_uploads record linking the file
      // This is what makes the file show up in the upload history!
      await query(
        `INSERT INTO file_request_uploads
        (file_request_id, file_id, uploaded_by, upload_type, editor_id, comments)
        VALUES ($1, $2, $3, 'file', $4, $5)`,
        [fileRequest.id, mediaFile.id, userId, editorId, comments || null]
      );

      logger.info('File uploaded via request (authenticated)', {
        fileRequestId: fileRequest.id,
        fileId: mediaFile.id,
        userId,
        editorId,
        hasComments: !!comments
      });

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
         LEFT JOIN file_request_editors fre ON fr.id = fre.request_id AND fre.user_id = $1
         WHERE fr.id = $2`,
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
   * Reassign file request to different editors (admin only)
   * POST /api/file-requests/:id/reassign
   */
  async reassignRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { new_editor_ids, reason, editor_distribution } = req.body;
      const userId = req.user.id;

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
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
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
        details: {
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
        message: 'File request reassigned successfully',
        assigned_count: editorAssignments.length,
        newly_assigned_count: newlyAssignedEditors.length,
        total_creatives_distributed: editorAssignments.reduce((sum, a) => sum + (a.num_creatives || 0), 0)
      });
    } catch (error) {
      logger.error('Reassign request error', { error: error.message });
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
           u.full_name as created_by_name,
           COUNT(fru.id) as file_count
         FROM file_request_folders frf
         LEFT JOIN users u ON frf.created_by = u.id
         LEFT JOIN file_request_uploads fru ON fru.folder_id = frf.id
         WHERE frf.request_id = $1
         GROUP BY frf.id, u.full_name
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
           u.full_name as user_name,
           u.email as user_email
         FROM file_request_editors fre
         LEFT JOIN editors e ON fre.editor_id = e.id
         LEFT JOIN users u ON fre.user_id = u.id
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
      const { fileName, fileSize, totalChunks, comments } = req.body;
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

      // 🆕 Create upload session to track this chunked upload
      const uploadSessionResult = await query(
        `INSERT INTO file_request_uploads
        (file_request_id, uploaded_by, upload_type, file_count, total_size_bytes)
        VALUES ($1, $2, 'file', 1, $3)
        RETURNING id`,
        [id, userId, fileSize]
      );
      const uploadSessionId = uploadSessionResult.rows[0].id;

      // Get user's editor ID
      const editorResult = await query('SELECT id FROM editors WHERE user_id = $1', [userId]);
      const editorId = editorResult.rows.length > 0 ? editorResult.rows[0].id : null;

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
          folder_id: request.folder_id,
          request_id: id,
          is_file_request_upload: true,
          upload_session_id: uploadSessionId
        }
      );

      // 🆕 Link the uploaded file to the upload session
      await query(
        `UPDATE media_files SET upload_session_id = $1 WHERE id = $2`,
        [uploadSessionId, uploadResult.id]
      );

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

      // Check permission: Only assigned editors can mark as uploaded
      const isAssignedEditor = fileRequest.assigned_editors && fileRequest.assigned_editors.includes(userId);
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

      // Update status
      await query(
        `UPDATE file_requests
         SET status = 'launched',
             launched_at = NOW(),
             launched_by = $1
         WHERE id = $2`,
        [userId, id]
      );

      // Log activity
      await logActivity({
        req,
        actionType: 'file_request_launched',
        resourceType: 'file_request',
        resourceId: id,
        resourceName: fileRequest.title,
        details: { launched_by_name: req.user.name },
        status: 'success'
      });

      res.json({
        success: true,
        message: 'File request launched successfully'
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
             closed_at = NOW(),
             closed_by = $1,
             completed_at = NOW()
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
        message: 'File request closed successfully'
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
             reopened_at = NOW(),
             reopened_by = $1,
             reopen_count = reopen_count + 1
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

      // Check access
      const hasAccess = fileRequest.created_by === userId ||
                       fileRequest.assigned_buyer_id === userId ||
                       (fileRequest.assigned_editors && fileRequest.assigned_editors.includes(userId)) ||
                       req.user.role === 'admin';

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
   * Reassign file request to another editor
   * POST /api/file-requests/:id/reassign
   */
  async reassignRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { reassign_to, note } = req.body;
      const userId = req.user.id;

      if (!reassign_to) {
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

      // RBAC: Only auto-assigned head, current assignees, or admin can reassign
      const canReassign = fileRequest.auto_assigned_head === userId ||
                         (fileRequest.assigned_editors && fileRequest.assigned_editors.includes(userId)) ||
                         req.user.role === 'admin';

      if (!canReassign) {
        return res.status(403).json({
          success: false,
          error: 'Only assigned editors or vertical heads can reassign requests'
        });
      }

      // Verify reassign_to editor exists
      const editorCheck = await query(
        'SELECT e.id, e.user_id FROM editors e WHERE e.user_id = $1 AND e.is_active = TRUE',
        [reassign_to]
      );

      if (editorCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Target editor not found'
        });
      }

      const targetEditorId = editorCheck.rows[0].id;

      // Create reassignment record
      await query(
        `INSERT INTO request_reassignments
         (file_request_id, reassigned_from, reassigned_to, reassignment_note)
         VALUES ($1, $2, $3, $4)`,
        [id, userId, reassign_to, note || null]
      );

      // Add new editor to file_request_editors
      await query(
        `INSERT INTO file_request_editors (request_id, editor_id, status)
         VALUES ($1, $2, 'pending')
         ON CONFLICT (request_id, editor_id) DO NOTHING`,
        [id, targetEditorId]
      );

      // Update reassignment count
      await query(
        `UPDATE file_requests
         SET reassignment_count = reassignment_count + 1
         WHERE id = $1`,
        [id]
      );

      // Send notification to reassigned editor with note
      await Notification.create({
        userId: reassign_to,
        type: 'file_request_reassigned',
        title: 'File Request Reassigned to You',
        message: `"${fileRequest.title}" has been reassigned to you by ${req.user.name || req.user.email}${note ? ': ' + note : ''}`,
        referenceType: 'file_request',
        referenceId: id,
        metadata: {
          request_title: fileRequest.title,
          reassigned_from: req.user.name || req.user.email,
          reassignment_note: note,
          deadline: fileRequest.deadline
        }
      });

      // Log activity
      await logActivity({
        req,
        actionType: 'file_request_reassigned',
        resourceType: 'file_request',
        resourceId: id,
        resourceName: fileRequest.title,
        details: {
          reassigned_to,
          note
        },
        status: 'success'
      });

      logger.info('File request reassigned', {
        requestId: id,
        reassigned_from: userId,
        reassigned_to,
        note
      });

      res.json({
        success: true,
        message: 'Request reassigned successfully'
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

      // Check access
      const hasAccess = fileRequest.created_by === userId ||
                       fileRequest.assigned_buyer_id === userId ||
                       (fileRequest.assigned_editors && fileRequest.assigned_editors.includes(userId)) ||
                       req.user.role === 'admin';

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
