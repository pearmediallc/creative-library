/**
 * Launch Request Controller
 * Handles creative strategist → creative head + buyer head → media buyer flow
 */

const { pool } = require('../config/database');
const logger = require('../utils/logger');
const Folder = require('../models/Folder');
const mediaService = require('../services/mediaService');

class LaunchRequestController {

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  async _getPlatformsAndVerticals(launchRequestId) {
    const [plat, vert] = await Promise.all([
      pool.query(
        `SELECT platform FROM launch_request_platforms WHERE launch_request_id = $1 ORDER BY created_at`,
        [launchRequestId]
      ),
      pool.query(
        `SELECT vertical, is_primary FROM launch_request_verticals WHERE launch_request_id = $1 ORDER BY is_primary DESC, created_at`,
        [launchRequestId]
      )
    ]);
    return {
      platforms: plat.rows.map(r => r.platform),
      verticals: vert.rows.map(r => r.vertical)
    };
  }

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────

  async create(req, res) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userId = req.user.id;
      const userRole = req.user.role;
      const userName = req.user.name || '';

      // Only admin/strategist can create launch requests
      if (userRole !== 'admin' && userRole !== 'buyer') {
        return res.status(403).json({ success: false, error: 'Only admins and buyers can create launch requests' });
      }

      const {
        request_type,
        concept_notes,
        num_creatives = 1,
        suggested_run_qty,
        notes_to_creative,
        notes_to_buyer,
        platforms = [],
        verticals = [],
        delivery_deadline,
        test_deadline,
        folder_id,
        creative_head_id,
        buyer_head_id,
        editor_ids = [],
        editor_distribution = [],
        buyer_ids = [],
        // template
        save_as_template = false,
        template_name,
        status = 'draft'  // 'draft' or 'pending_review' on submit
      } = req.body;

      const primaryVertical = verticals[0] || null;
      const title = request_type || 'Launch Request';

      // Insert core record
      const insertResult = await client.query(
        `INSERT INTO launch_requests (
          title, request_type, concept_notes, num_creatives, suggested_run_qty,
          notes_to_creative, notes_to_buyer, primary_vertical,
          delivery_deadline, test_deadline, folder_id,
          creative_head_id, buyer_head_id,
          created_by, created_by_name, status,
          submitted_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING *`,
        [
          title, request_type, concept_notes, num_creatives, suggested_run_qty || null,
          notes_to_creative || null, notes_to_buyer || null, primaryVertical,
          delivery_deadline || null, test_deadline || null, folder_id || null,
          creative_head_id || null, buyer_head_id || null,
          userId, userName, status,
          status === 'pending_review' ? new Date() : null
        ]
      );

      const request = insertResult.rows[0];
      const requestId = request.id;

      // Insert platforms
      for (const platform of platforms) {
        await client.query(
          `INSERT INTO launch_request_platforms (launch_request_id, platform) VALUES ($1, $2)`,
          [requestId, platform]
        );
      }

      // Insert verticals
      for (let i = 0; i < verticals.length; i++) {
        await client.query(
          `INSERT INTO launch_request_verticals (launch_request_id, vertical, is_primary) VALUES ($1, $2, $3)`,
          [requestId, verticals[i], i === 0]
        );
      }

      // Assign editors (creative side)
      const assignedEditorUserIds = []; // Track for notifications
      if (editor_distribution.length > 0) {
        for (const dist of editor_distribution) {
          await client.query(
            `INSERT INTO launch_request_editors (launch_request_id, editor_id, num_creatives_assigned)
             VALUES ($1, $2, $3)
             ON CONFLICT (launch_request_id, editor_id) DO UPDATE SET num_creatives_assigned = $3`,
            [requestId, dist.editor_id, dist.num_creatives]
          );

          // Get editor's user_id for notification
          const editorUserResult = await client.query(
            'SELECT user_id FROM editors WHERE id = $1',
            [dist.editor_id]
          );
          if (editorUserResult.rows.length > 0) {
            assignedEditorUserIds.push(editorUserResult.rows[0].user_id);
          }
        }
      } else if (editor_ids.length > 0) {
        for (const editorId of editor_ids) {
          await client.query(
            `INSERT INTO launch_request_editors (launch_request_id, editor_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [requestId, editorId]
          );

          // Get editor's user_id for notification
          const editorUserResult = await client.query(
            'SELECT user_id FROM editors WHERE id = $1',
            [editorId]
          );
          if (editorUserResult.rows.length > 0) {
            assignedEditorUserIds.push(editorUserResult.rows[0].user_id);
          }
        }
      }

      // Assign buyers (buyer side)
      for (const buyerId of buyer_ids) {
        await client.query(
          `INSERT INTO launch_request_buyers (launch_request_id, buyer_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [requestId, buyerId]
        );
      }

      // Save as template
      if (save_as_template && template_name) {
        await client.query(
          `INSERT INTO launch_request_templates (
            created_by, name, default_request_type, default_platforms, default_verticals,
            default_num_creatives, default_suggested_run_qty,
            default_concept_notes, default_notes_to_creative, default_notes_to_buyer
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            userId, template_name, request_type,
            platforms, verticals,
            num_creatives, suggested_run_qty || null,
            concept_notes || null, notes_to_creative || null, notes_to_buyer || null
          ]
        );
      }

      await client.query('COMMIT');

      logger.info(`Launch request created: ${requestId} by ${userId}`);

      // After commit: Send Slack notifications to assigned editors (non-blocking)
      if (assignedEditorUserIds.length > 0) {
        const slackService = require('../services/slackService');
        const Notification = require('../models/Notification');
        const frontendUrl = process.env.FRONTEND_URL || 'https://creative-library.onrender.com';
        const requestUrl = `${frontendUrl}/launch-requests?openRequestId=${requestId}`;

        for (const editorUserId of assignedEditorUserIds) {
          // Create in-app notification
          Notification.create({
            userId: editorUserId,
            type: 'launch_request_assigned',
            title: 'New Launch Request Assigned',
            message: `You have been assigned to "${title}" by ${userName || req.user.email}`,
            referenceType: 'launch_request',
            referenceId: requestId,
            metadata: {
              request_title: title,
              delivery_deadline: delivery_deadline,
              assigned_by: userName || req.user.email
            }
          }).catch(err => logger.error('Failed to create notification', { error: err.message }));

          // Send Slack notification with comprehensive details
          slackService.notifyLaunchRequestCreated(editorUserId, {
            requestTitle: title,
            requestType: request_type,
            vertical: primaryVertical,
            platform: platforms[0] || null,
            numCreatives: num_creatives,
            deadline: delivery_deadline,
            briefNotes: notes_to_creative || concept_notes,
            createdByName: userName || req.user.email,
            requestUrl
          }).catch(err => {
            // Non-blocking: log error but don't fail request creation
            logger.error('Failed to send Slack notification for launch request', {
              error: err.message,
              editorUserId,
              requestId
            });
          });
        }
      }

      // After commit: provision media library folders for buyer_head + any pre-assigned buyers (non-blocking)
      const buyersToProvision = [];
      if (buyer_head_id) buyersToProvision.push(buyer_head_id);
      for (const bId of buyer_ids) {
        if (bId && bId !== buyer_head_id) buyersToProvision.push(bId);
      }
      if (buyersToProvision.length > 0) {
        Promise.all(
          buyersToProvision.map(bId =>
            this._provisionFolderForBuyer(requestId, bId, userId).catch(err =>
              logger.error('Failed to provision buyer folder on create', { launchRequestId: requestId, buyerId: bId, error: err.message, stack: err.stack })
            )
          )
        );
      }

      return res.status(201).json({
        success: true,
        data: { ...request, platforms, verticals }
      });

    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Launch request create error:', err);
      return res.status(500).json({ success: false, error: err.message });
    } finally {
      client.release();
    }
  }

  // ─────────────────────────────────────────────
  // GET ALL
  // ─────────────────────────────────────────────

  async getAll(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { status, vertical, platform, search, date_from, date_to } = req.query;

      let whereConditions = [];
      let params = [];
      let paramIdx = 1;

      // Role-based visibility
      if (userRole === 'admin') {
        // Admin/strategist sees all
      } else if (userRole === 'buyer') {
        // Buyers see requests where they are buyer_head OR assigned as a buyer
        whereConditions.push(`(
          lr.buyer_head_id = $${paramIdx}
          OR EXISTS (SELECT 1 FROM launch_request_buyers lrb WHERE lrb.launch_request_id = lr.id AND lrb.buyer_id = $${paramIdx})
        )`);
        params.push(userId);
        paramIdx++;
      } else if (userRole === 'creative') {
        // Creatives see requests where they are creative_head OR assigned as editor
        whereConditions.push(`(
          lr.creative_head_id = $${paramIdx}
          OR EXISTS (SELECT 1 FROM launch_request_editors lre
            JOIN editors e ON lre.editor_id = e.id
            WHERE lre.launch_request_id = lr.id AND e.user_id = $${paramIdx})
        )`);
        params.push(userId);
        paramIdx++;
      }

      if (status && status !== 'all') {
        whereConditions.push(`lr.status = $${paramIdx}`);
        params.push(status);
        paramIdx++;
      }

      if (search) {
        whereConditions.push(`(lr.title ILIKE $${paramIdx} OR lr.concept_notes ILIKE $${paramIdx} OR lr.created_by_name ILIKE $${paramIdx})`);
        params.push(`%${search}%`);
        paramIdx++;
      }

      if (date_from) {
        whereConditions.push(`lr.created_at >= $${paramIdx}`);
        params.push(date_from);
        paramIdx++;
      }

      if (date_to) {
        whereConditions.push(`lr.created_at <= $${paramIdx}`);
        params.push(date_to);
        paramIdx++;
      }

      if (vertical) {
        whereConditions.push(`EXISTS (SELECT 1 FROM launch_request_verticals lrv WHERE lrv.launch_request_id = lr.id AND lrv.vertical = $${paramIdx})`);
        params.push(vertical);
        paramIdx++;
      }

      if (platform) {
        whereConditions.push(`EXISTS (SELECT 1 FROM launch_request_platforms lrp WHERE lrp.launch_request_id = lr.id AND lrp.platform = $${paramIdx})`);
        params.push(platform);
        paramIdx++;
      }

      const where = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const query = `
        SELECT
          lr.*,
          -- platforms as array
          COALESCE((
            SELECT json_agg(lrp.platform ORDER BY lrp.created_at)
            FROM launch_request_platforms lrp
            WHERE lrp.launch_request_id = lr.id
          ), '[]') AS platforms,
          -- verticals as array
          COALESCE((
            SELECT json_agg(lrv.vertical ORDER BY lrv.is_primary DESC, lrv.created_at)
            FROM launch_request_verticals lrv
            WHERE lrv.launch_request_id = lr.id
          ), '[]') AS verticals,
          -- assigned editors (display names)
          COALESCE((
            SELECT STRING_AGG(COALESCE(e.display_name, e.name), ', ' ORDER BY e.name)
            FROM launch_request_editors lre
            JOIN editors e ON lre.editor_id = e.id
            WHERE lre.launch_request_id = lr.id
          ), '') AS assigned_editors,
          -- upload count
          (SELECT COUNT(*) FROM launch_request_uploads lru WHERE lru.launch_request_id = lr.id) AS upload_count,
          -- creative head name
          (SELECT u.name FROM users u WHERE u.id = lr.creative_head_id) AS creative_head_name,
          -- buyer head name
          (SELECT u.name FROM users u WHERE u.id = lr.buyer_head_id) AS buyer_head_name,
          -- assigned buyers
          COALESCE((
            SELECT STRING_AGG(u.name, ', ' ORDER BY u.name)
            FROM launch_request_buyers lrb
            JOIN users u ON lrb.buyer_id = u.id
            WHERE lrb.launch_request_id = lr.id
          ), '') AS assigned_buyers
        FROM launch_requests lr
        ${where}
        ORDER BY lr.created_at DESC
      `;

      const result = await pool.query(query, params);

      return res.json({ success: true, data: result.rows });

    } catch (err) {
      logger.error('Launch request getAll error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─────────────────────────────────────────────
  // GET ONE
  // ─────────────────────────────────────────────

  async getOne(req, res) {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `SELECT lr.*,
          (SELECT u.name FROM users u WHERE u.id = lr.creative_head_id) AS creative_head_name,
          (SELECT u.name FROM users u WHERE u.id = lr.buyer_head_id) AS buyer_head_name,
          (SELECT u.name FROM users u WHERE u.id = lr.created_by) AS strategist_name
         FROM launch_requests lr WHERE lr.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Launch request not found' });
      }

      const request = result.rows[0];

      // Fetch related data in parallel
      const [platforms, verticals, editors, buyers, uploads, reassignments] = await Promise.all([
        pool.query(`SELECT platform FROM launch_request_platforms WHERE launch_request_id = $1 ORDER BY created_at`, [id]),
        pool.query(`SELECT vertical, is_primary FROM launch_request_verticals WHERE launch_request_id = $1 ORDER BY is_primary DESC, created_at`, [id]),
        pool.query(`
          SELECT lre.*, e.name AS editor_name, e.display_name, e.user_id AS editor_user_id,
                 lre.num_creatives_assigned, lre.creatives_completed, lre.status AS editor_status
          FROM launch_request_editors lre
          JOIN editors e ON lre.editor_id = e.id
          WHERE lre.launch_request_id = $1
          ORDER BY e.name
        `, [id]),
        pool.query(`
          SELECT lrb.*, u.name AS buyer_name, u.email AS buyer_email
          FROM launch_request_buyers lrb
          JOIN users u ON lrb.buyer_id = u.id
          WHERE lrb.launch_request_id = $1
          ORDER BY u.name
        `, [id]),
        pool.query(`
          SELECT lru.*, u.name AS uploader_name
          FROM launch_request_uploads lru
          LEFT JOIN users u ON lru.uploaded_by = u.id
          WHERE lru.launch_request_id = $1
          ORDER BY lru.created_at DESC
        `, [id]),
        pool.query(`
          SELECT * FROM launch_request_reassignments
          WHERE launch_request_id = $1
          ORDER BY created_at DESC
          LIMIT 20
        `, [id])
      ]);

      return res.json({
        success: true,
        data: {
          ...request,
          platforms: platforms.rows.map(r => r.platform),
          verticals: verticals.rows.map(r => r.vertical),
          editors: editors.rows,
          buyers: buyers.rows,
          uploads: uploads.rows,
          reassignments: reassignments.rows
        }
      });

    } catch (err) {
      logger.error('Launch request getOne error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────

  async update(req, res) {
    try {
      const { id } = req.params;
      const {
        concept_notes, delivery_deadline, test_deadline,
        committed_run_qty, committed_test_deadline, notes_to_creative, notes_to_buyer
      } = req.body;

      const result = await pool.query(
        `UPDATE launch_requests SET
          concept_notes = COALESCE($1, concept_notes),
          delivery_deadline = COALESCE($2, delivery_deadline),
          test_deadline = COALESCE($3, test_deadline),
          committed_run_qty = COALESCE($4, committed_run_qty),
          committed_test_deadline = COALESCE($5, committed_test_deadline),
          notes_to_creative = COALESCE($6, notes_to_creative),
          notes_to_buyer = COALESCE($7, notes_to_buyer),
          updated_at = NOW()
         WHERE id = $8 RETURNING *`,
        [concept_notes, delivery_deadline, test_deadline,
         committed_run_qty, committed_test_deadline, notes_to_creative, notes_to_buyer, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Launch request not found' });
      }

      return res.json({ success: true, data: result.rows[0] });

    } catch (err) {
      logger.error('Launch request update error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────

  async delete(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      const existing = await pool.query(`SELECT created_by FROM launch_requests WHERE id = $1`, [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }

      if (userRole !== 'admin' && existing.rows[0].created_by !== userId) {
        return res.status(403).json({ success: false, error: 'Not authorised' });
      }

      await pool.query(`DELETE FROM launch_requests WHERE id = $1`, [id]);

      return res.json({ success: true });

    } catch (err) {
      logger.error('Launch request delete error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─────────────────────────────────────────────
  // STATUS TRANSITIONS
  // ─────────────────────────────────────────────

  async submit(req, res) {
    // draft → pending_review
    return this._transition(req, res, 'pending_review', ['draft', 'reopened'], { submitted_at: new Date() });
  }

  async acceptByCreativeHead(req, res) {
    // pending_review → in_production (creative head accepts)
    return this._transition(req, res, 'in_production', ['pending_review'], { accepted_at: new Date() });
  }

  async markReadyToLaunch(req, res) {
    // in_production → ready_to_launch (creative head marks files uploaded)
    return this._transition(req, res, 'ready_to_launch', ['in_production'], { ready_at: new Date() });
  }

  async assignBuyers(req, res) {
    // ready_to_launch → buyer_assigned (buyer head assigns files to buyers)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { id } = req.params;
      const assignerId = req.user.id;
      const { buyer_assignments = [], committed_run_qty, committed_test_deadline } = req.body;
      // buyer_assignments: [{ buyer_id, file_ids, run_qty, test_deadline }]

      // Update each buyer assignment
      for (const assignment of buyer_assignments) {
        await client.query(
          `INSERT INTO launch_request_buyers (launch_request_id, buyer_id, assigned_file_ids, run_qty, test_deadline)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (launch_request_id, buyer_id) DO UPDATE SET
             assigned_file_ids = $3, run_qty = $4, test_deadline = $5`,
          [id, assignment.buyer_id, assignment.file_ids || [], assignment.run_qty || null, assignment.test_deadline || null]
        );
      }

      // Update main record
      await client.query(
        `UPDATE launch_requests SET
           status = 'buyer_assigned',
           committed_run_qty = COALESCE($1, committed_run_qty),
           committed_test_deadline = COALESCE($2, committed_test_deadline),
           buyer_assigned_at = NOW(),
           updated_at = NOW()
         WHERE id = $3`,
        [committed_run_qty || null, committed_test_deadline || null, id]
      );

      await client.query('COMMIT');

      // After commit: provision folder for each buyer (creates folder if not exists, pushes assigned files) (non-blocking)
      Promise.all(
        buyer_assignments.map(a => {
          if (!a.buyer_id) return Promise.resolve();
          return this._provisionFolderForBuyer(id, a.buyer_id, assignerId, a.file_ids || []).catch(err =>
            logger.error('Failed to provision buyer folder on assignBuyers', {
              launchRequestId: id, buyerId: a.buyer_id, error: err.message, stack: err.stack
            })
          );
        })
      );

      return res.json({ success: true });

    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Assign buyers error:', err);
      return res.status(500).json({ success: false, error: err.message });
    } finally {
      client.release();
    }
  }

  // ─────────────────────────────────────────────
  // MEDIA LIBRARY FOLDER PROVISIONING
  // ─────────────────────────────────────────────

  /**
   * Shared name sanitizer
   */
  _sanitizeName(str) {
    return (str || '').replace(/[^a-zA-Z0-9\s\-_]/g, '').trim().replace(/\s+/g, '-');
  }

  /**
   * Provision a media library folder for one buyer on one launch request.
   * Creates:
   *   {BuyerName}-{YYYY-MM-DD}            ← root dated folder (owned by buyer)
   *     └─ {ProvisionerName}-{RequestTitle} ← request subfolder
   *
   * Stores the subfolder ID back on launch_request_buyers.media_folder_id.
   * If fileIds are provided, copies those upload records into the subfolder.
   * Safe to call multiple times — idempotent (folder reuse + dedup on insert).
   *
   * @param {string} launchRequestId
   * @param {string} buyerId
   * @param {string} provisionerId  — user performing the action (admin/buyer head)
   * @param {string[]} fileIds      — launch_request_uploads IDs to copy (optional)
   */
  async _provisionFolderForBuyer(launchRequestId, buyerId, provisionerId, fileIds = []) {
    const FilePermission = require('../models/FilePermission');

    // Load launch request + provisioner name
    const lrResult = await pool.query(
      `SELECT lr.title, lr.request_type, u.name AS provisioner_name
       FROM launch_requests lr
       JOIN users u ON u.id = $2
       WHERE lr.id = $1`,
      [launchRequestId, provisionerId]
    );
    if (lrResult.rowCount === 0) return;
    const lr = lrResult.rows[0];

    // Load buyer info
    const buyerResult = await pool.query(
      `SELECT id, name, email FROM users WHERE id = $1`,
      [buyerId]
    );
    if (buyerResult.rowCount === 0) return;
    const buyer = buyerResult.rows[0];

    const san = this._sanitizeName.bind(this);
    const dateStr = new Date().toISOString().split('T')[0];
    const buyerLabel    = san(buyer.name || buyer.email.split('@')[0]).slice(0, 40);
    const provLabel     = san(lr.provisioner_name || 'Admin').slice(0, 30);
    const requestLabel  = san(lr.title || lr.request_type || 'Launch-Request').slice(0, 50);

    const datedFolderName = `${buyerLabel}-${dateStr}`;
    const subfolderName   = `${provLabel}-${requestLabel}`;

    // ── "Launch Requests" category root ────────────────────────────────────
    const categoryRoot = await Folder.getOrCreateCategoryRootFolder(
      buyer.id, 'Launch Requests', '#6366F1', 'launch_requests_root'
    );

    // ── dated folder inside category root ──────────────────────────────────
    const existingDated = await pool.query(
      `SELECT * FROM folders
       WHERE name = $1 AND owner_id = $2 AND parent_folder_id = $3 AND is_deleted = FALSE
       LIMIT 1`,
      [datedFolderName, buyer.id, categoryRoot.id]
    );
    const datedFolder = existingDated.rowCount > 0
      ? existingDated.rows[0]
      : await Folder.create({
          name: datedFolderName,
          owner_id: buyer.id,
          parent_folder_id: categoryRoot.id,
          description: `Launch requests for ${buyer.name || 'buyer'} on ${dateStr}`,
          color: '#6366F1',
          is_auto_created: true,
          folder_type: 'launch_request'
        });

    // ── request subfolder ──────────────────────────────────────────────────
    // Check launch_request_buyers for an already-stored folder first
    const lrbRow = await pool.query(
      `SELECT media_folder_id FROM launch_request_buyers
       WHERE launch_request_id = $1 AND buyer_id = $2 LIMIT 1`,
      [launchRequestId, buyerId]
    );
    let reqFolder = null;
    if (lrbRow.rowCount > 0 && lrbRow.rows[0].media_folder_id) {
      const existing = await pool.query(
        `SELECT * FROM folders WHERE id = $1 AND is_deleted = FALSE LIMIT 1`,
        [lrbRow.rows[0].media_folder_id]
      );
      if (existing.rowCount > 0) reqFolder = existing.rows[0];
    }
    if (!reqFolder) {
      // Fall back to name-based lookup
      const existingReq = await pool.query(
        `SELECT * FROM folders
         WHERE name = $1 AND owner_id = $2 AND parent_folder_id = $3 AND is_deleted = FALSE
         LIMIT 1`,
        [subfolderName, buyer.id, datedFolder.id]
      );
      reqFolder = existingReq.rowCount > 0
        ? existingReq.rows[0]
        : await Folder.create({
            name: subfolderName,
            owner_id: buyer.id,
            parent_folder_id: datedFolder.id,
            description: `Files from ${provLabel} for ${requestLabel}`,
            color: '#8B5CF6',
            is_auto_created: true,
            folder_type: 'launch_request_assigned'
          });
    }

    // Store subfolder ID on launch_request_buyers (upsert)
    await pool.query(
      `INSERT INTO launch_request_buyers (launch_request_id, buyer_id, media_folder_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (launch_request_id, buyer_id) DO UPDATE SET media_folder_id = $3`,
      [launchRequestId, buyerId, reqFolder.id]
    );

    // ── grant permissions on all three folders (category root → dated → request subfolder) ─
    for (const folderId of [categoryRoot.id, datedFolder.id, reqFolder.id]) {
      for (const permType of ['view', 'download']) {
        await FilePermission.grantPermission({
          resource_type: 'folder',
          resource_id: folderId,
          grantee_type: 'user',
          grantee_id: buyer.id,
          permission_type: permType,
          granted_by: provisionerId,
          expires_at: null
        });
      }
    }

    // ── copy upload records into media_files ───────────────────────────────
    if (fileIds.length > 0) {
      const uploadsResult = await pool.query(
        `SELECT lru.*, u.name AS uploader_name
         FROM launch_request_uploads lru
         LEFT JOIN users u ON u.id = lru.uploaded_by
         WHERE lru.id = ANY($1::uuid[]) AND lru.launch_request_id = $2`,
        [fileIds, launchRequestId]
      );
      for (const upload of uploadsResult.rows) {
        await this._insertUploadIntoFolder(upload, reqFolder.id, buyer.id, provisionerId, lr.provisioner_name);
      }
    }

    logger.info('Provisioned media library folder for buyer', {
      buyerId: buyer.id, buyerName: buyer.name, launchRequestId,
      datedFolder: datedFolderName, subfolder: subfolderName
    });

    return reqFolder;
  }

  /**
   * When a new file is uploaded to a launch request, push it into every
   * buyer folder that has already been provisioned (media_folder_id is set).
   *
   * @param {string} launchRequestId
   * @param {object} upload  — row from launch_request_uploads
   * @param {string} uploaderId
   */
  async _pushUploadToBuyerFolders(launchRequestId, upload, uploaderId) {
    // Find all buyers with a provisioned folder for this request
    const buyers = await pool.query(
      `SELECT lrb.buyer_id, lrb.media_folder_id, u.name AS provisioner_name
       FROM launch_request_buyers lrb
       JOIN users u ON u.id = $2
       WHERE lrb.launch_request_id = $1 AND lrb.media_folder_id IS NOT NULL`,
      [launchRequestId, uploaderId]
    );
    if (buyers.rowCount === 0) return;

    const FilePermission = require('../models/FilePermission');
    for (const row of buyers.rows) {
      const mfId = await this._insertUploadIntoFolder(
        upload, row.media_folder_id, row.buyer_id, uploaderId, row.provisioner_name
      );
      if (mfId) {
        for (const permType of ['view', 'download']) {
          await FilePermission.grantPermission({
            resource_type: 'file',
            resource_id: mfId,
            grantee_type: 'user',
            grantee_id: row.buyer_id,
            permission_type: permType,
            granted_by: uploaderId,
            expires_at: null
          });
        }
      }
    }
  }

  /**
   * Insert a launch_request_uploads row into media_files for a specific folder.
   * Idempotent — skips if already present (checks launch_request_upload_id + folder_id).
   *
   * @returns {string|null} the new media_files.id, or null if skipped/failed
   */
  async _insertUploadIntoFolder(upload, folderId, buyerId, uploaderId, uploaderName) {
    // Dedup check
    try {
      const chk = await pool.query(
        `SELECT id FROM media_files
         WHERE launch_request_upload_id = $1 AND folder_id = $2 AND is_deleted = FALSE
         LIMIT 1`,
        [upload.id, folderId]
      );
      if (chk.rowCount > 0) return null; // already there
    } catch (_) { /* column may not exist yet — proceed */ }

    const fileType = (upload.mime_type || '').startsWith('video') ? 'video'
      : (upload.mime_type || '').startsWith('image') ? 'image'
      : 'document';
    const editorName = upload.uploader_name || uploaderName || 'Launch Request';

    try {
      const res = await pool.query(
        `INSERT INTO media_files
           (filename, original_filename, file_type, mime_type, file_size, s3_key, s3_url,
            uploaded_by, editor_name, folder_id, is_deleted, launch_request_upload_id, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,FALSE,$11,$12)
         RETURNING id`,
        [
          upload.original_filename, upload.original_filename,
          fileType, upload.mime_type || 'application/octet-stream',
          upload.file_size || 0, upload.s3_key || '', upload.s3_url || '',
          uploaderId, editorName, folderId, upload.id,
          ['launch-request-upload']
        ]
      );
      return res.rows[0]?.id || null;
    } catch (err) {
      logger.error('_insertUploadIntoFolder failed', { error: err.message, folderId, uploadId: upload.id });
      return null;
    }
  }

  // ─────────────────────────────────────────────
  // REVOKE BUYER ACCESS
  // ─────────────────────────────────────────────

  /**
   * Revoke a buyer's access to a launch request:
   * - Soft-deletes all media_files in their provisioned folder
   * - Removes file_permissions for their folder + files
   * - Clears media_folder_id from launch_request_buyers
   *
   * The buyer's dated root folder is left intact (may contain other requests).
   */
  async revokeAccess(req, res) {
    try {
      const { id, buyerId } = req.params;
      const revokerId = req.user.id;

      // Get the provisioned folder
      const lrbRow = await pool.query(
        `SELECT media_folder_id FROM launch_request_buyers
         WHERE launch_request_id = $1 AND buyer_id = $2`,
        [id, buyerId]
      );
      if (lrbRow.rowCount === 0) {
        return res.status(404).json({ success: false, error: 'Buyer assignment not found' });
      }
      const mediaFolderId = lrbRow.rows[0].media_folder_id;

      if (mediaFolderId) {
        // Soft-delete all media_files in this folder
        await pool.query(
          `UPDATE media_files
           SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $1
           WHERE folder_id = $2 AND is_deleted = FALSE`,
          [revokerId, mediaFolderId]
        );

        // Remove file_permissions for folder
        await pool.query(
          `DELETE FROM file_permissions
           WHERE resource_type = 'folder' AND resource_id = $1 AND grantee_id = $2`,
          [mediaFolderId, buyerId]
        );

        // Remove file_permissions for all files in the folder
        await pool.query(
          `DELETE FROM file_permissions fp
           USING media_files mf
           WHERE fp.resource_type = 'file' AND fp.resource_id = mf.id
             AND mf.folder_id = $1 AND fp.grantee_id = $2`,
          [mediaFolderId, buyerId]
        );

        // Soft-delete the subfolder itself
        await pool.query(
          `UPDATE folders SET is_deleted = TRUE, deleted_at = NOW() WHERE id = $1`,
          [mediaFolderId]
        );
      }

      // Clear media_folder_id
      await pool.query(
        `UPDATE launch_request_buyers
         SET media_folder_id = NULL
         WHERE launch_request_id = $1 AND buyer_id = $2`,
        [id, buyerId]
      );

      logger.info('Revoked buyer access to launch request media folder', {
        launchRequestId: id, buyerId, revokerId, mediaFolderId
      });

      return res.json({ success: true });
    } catch (err) {
      logger.error('revokeAccess error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async launch(req, res) {
    // buyer_assigned → launched
    return this._transition(req, res, 'launched', ['buyer_assigned'], { launched_at: new Date() });
  }

  async close(req, res) {
    // launched → closed
    try {
      const { id } = req.params;

      // Validate creative distribution before closing
      const requestResult = await pool.query(
        'SELECT num_creatives FROM launch_requests WHERE id = $1',
        [id]
      );

      if (requestResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Launch request not found' });
      }

      const totalCreativesRequested = requestResult.rows[0].num_creatives || 0;
      if (totalCreativesRequested > 0) {
        const assignmentsResult = await pool.query(
          'SELECT SUM(num_creatives_assigned) as total_assigned FROM launch_request_editors WHERE launch_request_id = $1',
          [id]
        );
        const totalAssigned = parseInt(assignmentsResult.rows[0]?.total_assigned || 0, 10);

        if (totalAssigned !== totalCreativesRequested) {
          return res.status(400).json({
            success: false,
            error: `Cannot close request. Total creatives assigned (${totalAssigned}) must equal requested (${totalCreativesRequested}). Please reassign editors to match the exact creative count.`
          });
        }
      }

      // Proceed with transition if validation passes
      return this._transition(req, res, 'closed', ['launched'], { closed_at: new Date() });

    } catch (err) {
      logger.error('Close launch request error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async reopen(req, res) {
    // closed → reopened
    return this._transition(req, res, 'reopened', ['closed'], {});
  }

  async _transition(req, res, newStatus, allowedFromStatuses, extraFields) {
    try {
      const { id } = req.params;

      const existing = await pool.query(`SELECT status FROM launch_requests WHERE id = $1`, [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }

      const currentStatus = existing.rows[0].status;
      if (!allowedFromStatuses.includes(currentStatus)) {
        return res.status(400).json({
          success: false,
          error: `Cannot transition from '${currentStatus}' to '${newStatus}'`
        });
      }

      const extraKeys = Object.keys(extraFields);
      const setClause = extraKeys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const extraValues = extraKeys.map(k => extraFields[k]);

      await pool.query(
        `UPDATE launch_requests SET status = $1${setClause ? ', ' + setClause : ''}, updated_at = NOW() WHERE id = $${extraValues.length + 2}`,
        [newStatus, ...extraValues, id]
      );

      return res.json({ success: true, status: newStatus });

    } catch (err) {
      logger.error(`Transition to ${newStatus} error:`, err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─────────────────────────────────────────────
  // REASSIGN (creative or buyer side)
  // ─────────────────────────────────────────────

  async reassignCreativeHead(req, res) {
    try {
      const { id } = req.params;
      const { new_creative_head_id, reason } = req.body;
      const userId = req.user.id;

      const existing = await pool.query(`SELECT creative_head_id FROM launch_requests WHERE id = $1`, [id]);
      if (existing.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });

      const fromResult = await pool.query(`SELECT name FROM users WHERE id = $1`, [existing.rows[0].creative_head_id]);
      const toResult = await pool.query(`SELECT name FROM users WHERE id = $1`, [new_creative_head_id]);

      await pool.query(
        `UPDATE launch_requests SET creative_head_id = $1, updated_at = NOW() WHERE id = $2`,
        [new_creative_head_id, id]
      );

      await pool.query(
        `INSERT INTO launch_request_reassignments (launch_request_id, reassigned_by, reassign_type, from_name, to_name, reason)
         VALUES ($1, $2, 'creative', $3, $4, $5)`,
        [id, userId, fromResult.rows[0]?.name || '', toResult.rows[0]?.name || '', reason || '']
      );

      return res.json({ success: true });

    } catch (err) {
      logger.error('Reassign creative head error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async reassignBuyerHead(req, res) {
    try {
      const { id } = req.params;
      const { new_buyer_head_id, reason } = req.body;
      const userId = req.user.id;

      const existing = await pool.query(`SELECT buyer_head_id FROM launch_requests WHERE id = $1`, [id]);
      if (existing.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });

      const fromResult = await pool.query(`SELECT name FROM users WHERE id = $1`, [existing.rows[0].buyer_head_id]);
      const toResult = await pool.query(`SELECT name FROM users WHERE id = $1`, [new_buyer_head_id]);

      await pool.query(
        `UPDATE launch_requests SET buyer_head_id = $1, updated_at = NOW() WHERE id = $2`,
        [new_buyer_head_id, id]
      );

      await pool.query(
        `INSERT INTO launch_request_reassignments (launch_request_id, reassigned_by, reassign_type, from_name, to_name, reason)
         VALUES ($1, $2, 'buyer', $3, $4, $5)`,
        [id, userId, fromResult.rows[0]?.name || '', toResult.rows[0]?.name || '', reason || '']
      );

      return res.json({ success: true });

    } catch (err) {
      logger.error('Reassign buyer head error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─────────────────────────────────────────────
  // ASSIGN EDITORS (creative side)
  // ─────────────────────────────────────────────

  async assignEditors(req, res) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { id } = req.params;
      const { editor_distribution = [], editor_ids = [] } = req.body;

      // Validate creative distribution before assignment
      if (editor_distribution.length > 0) {
        const requestResult = await client.query(
          'SELECT num_creatives FROM launch_requests WHERE id = $1',
          [id]
        );

        if (requestResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ success: false, error: 'Launch request not found' });
        }

        const totalCreativesRequested = requestResult.rows[0].num_creatives || 0;
        if (totalCreativesRequested > 0) {
          const totalAssigned = editor_distribution.reduce(
            (sum, dist) => sum + (dist.num_creatives || 0),
            0
          );

          if (totalAssigned > totalCreativesRequested) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              success: false,
              error: `Cannot assign more creatives than requested. Total assigned (${totalAssigned}) exceeds requested (${totalCreativesRequested})`
            });
          }

          if (totalAssigned < totalCreativesRequested) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              success: false,
              error: `Cannot assign fewer creatives than requested. Total assigned (${totalAssigned}) is less than requested (${totalCreativesRequested}). You must assign exactly ${totalCreativesRequested} creatives.`
            });
          }
        }
      }

      if (editor_distribution.length > 0) {
        // Mark existing editors not in the new distribution as 'reassigned' (preserve history)
        const newEditorIds = editor_distribution.map(d => d.editor_id);
        await client.query(
          `UPDATE launch_request_editors
           SET status = 'reassigned', updated_at = NOW()
           WHERE launch_request_id = $1
             AND editor_id != ALL($2::uuid[])
             AND status IN ('pending', 'in_progress')`,
          [id, newEditorIds]
        );

        // Upsert each editor assignment (add new or update existing)
        for (const dist of editor_distribution) {
          await client.query(
            `INSERT INTO launch_request_editors (launch_request_id, editor_id, num_creatives_assigned, status, assigned_at)
             VALUES ($1, $2, $3, 'pending', NOW())
             ON CONFLICT (launch_request_id, editor_id) DO UPDATE
             SET num_creatives_assigned = $3,
                 status = CASE WHEN launch_request_editors.status = 'reassigned' THEN 'pending' ELSE launch_request_editors.status END,
                 updated_at = NOW()`,
            [id, dist.editor_id, dist.num_creatives]
          );
        }
      } else if (editor_ids.length > 0) {
        // Mark existing editors not in the new list as 'reassigned'
        await client.query(
          `UPDATE launch_request_editors
           SET status = 'reassigned', updated_at = NOW()
           WHERE launch_request_id = $1
             AND editor_id != ALL($2::uuid[])
             AND status IN ('pending', 'in_progress')`,
          [id, editor_ids]
        );

        // Upsert each editor (add new or reactivate existing)
        for (const editorId of editor_ids) {
          await client.query(
            `INSERT INTO launch_request_editors (launch_request_id, editor_id, status, assigned_at)
             VALUES ($1, $2, 'pending', NOW())
             ON CONFLICT (launch_request_id, editor_id) DO UPDATE
             SET status = CASE WHEN launch_request_editors.status = 'reassigned' THEN 'pending' ELSE launch_request_editors.status END,
                 updated_at = NOW()`,
            [id, editorId]
          );
        }
      }

      await client.query('COMMIT');
      return res.json({ success: true });

    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Assign editors error:', err);
      return res.status(500).json({ success: false, error: err.message });
    } finally {
      client.release();
    }
  }

  // ─────────────────────────────────────────────
  // UPLOAD (creative side delivers files)
  // ─────────────────────────────────────────────

  async upload(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { comments } = req.body;

      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file provided' });
      }

      const { originalname, mimetype, size, location, key } = req.file;

      const result = await pool.query(
        `INSERT INTO launch_request_uploads
           (launch_request_id, uploaded_by, original_filename, s3_key, s3_url, file_size, mime_type, comments)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [id, userId, originalname, key || '', location || '', size || 0, mimetype, comments || null]
      );

      // Move to in_production if still pending_review
      await pool.query(
        `UPDATE launch_requests SET status = CASE WHEN status = 'pending_review' THEN 'in_production' ELSE status END,
          updated_at = NOW() WHERE id = $1`,
        [id]
      );

      // Increment creatives_completed for the uploading editor (if they are assigned).
      // If the uploader is not themselves an editor (e.g. admin / creative head uploading on behalf),
      // AND there is exactly one editor assigned, credit that single editor instead.
      const editorUpdateResult = await pool.query(
        `UPDATE launch_request_editors lre
         SET creatives_completed = LEAST(creatives_completed + 1, COALESCE(num_creatives_assigned, creatives_completed + 1)),
             status = CASE
               WHEN LEAST(creatives_completed + 1, COALESCE(num_creatives_assigned, creatives_completed + 1)) >= COALESCE(num_creatives_assigned, 1)
               THEN 'completed'
               ELSE 'in_progress'
             END
         FROM editors e
         WHERE lre.editor_id = e.id
           AND lre.launch_request_id = $1
           AND e.user_id = $2`,
        [id, userId]
      );

      // Fallback: if uploader was not matched as an editor (e.g. admin/creative-head upload)
      // credit the sole assigned editor so the progress bar advances
      if (editorUpdateResult.rowCount === 0) {
        const singleEditorCheck = await pool.query(
          `SELECT lre.id FROM launch_request_editors lre
           WHERE lre.launch_request_id = $1`,
          [id]
        );
        if (singleEditorCheck.rowCount === 1) {
          await pool.query(
            `UPDATE launch_request_editors
             SET creatives_completed = LEAST(creatives_completed + 1, COALESCE(num_creatives_assigned, creatives_completed + 1)),
                 status = CASE
                   WHEN LEAST(creatives_completed + 1, COALESCE(num_creatives_assigned, creatives_completed + 1)) >= COALESCE(num_creatives_assigned, 1)
                   THEN 'completed'
                   ELSE 'in_progress'
                 END
             WHERE id = $1`,
            [singleEditorCheck.rows[0].id]
          );
        }
      }

      // After inserting upload record, push file into all pre-provisioned buyer folders (non-blocking)
      this._pushUploadToBuyerFolders(id, result.rows[0], userId).catch(err =>
        logger.error('Failed to push upload to buyer folders', { launchRequestId: id, error: err.message, stack: err.stack })
      );

      return res.json({ success: true, data: result.rows[0] });

    } catch (err) {
      logger.error('Launch request upload error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─────────────────────────────────────────────
  // TEMPLATES
  // ─────────────────────────────────────────────

  async getTemplates(req, res) {
    try {
      const userId = req.user.id;
      const result = await pool.query(
        `SELECT * FROM launch_request_templates WHERE created_by = $1 AND is_active = TRUE ORDER BY name`,
        [userId]
      );
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      logger.error('Get launch templates error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async saveTemplate(req, res) {
    try {
      const userId = req.user.id;
      const {
        name, default_request_type, default_platforms, default_verticals,
        default_num_creatives, default_suggested_run_qty,
        default_concept_notes, default_notes_to_creative, default_notes_to_buyer
      } = req.body;

      const result = await pool.query(
        `INSERT INTO launch_request_templates
           (created_by, name, default_request_type, default_platforms, default_verticals,
            default_num_creatives, default_suggested_run_qty,
            default_concept_notes, default_notes_to_creative, default_notes_to_buyer)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [userId, name, default_request_type, default_platforms || [], default_verticals || [],
         default_num_creatives || null, default_suggested_run_qty || null,
         default_concept_notes || null, default_notes_to_creative || null, default_notes_to_buyer || null]
      );

      return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      logger.error('Save launch template error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async deleteTemplate(req, res) {
    try {
      const { templateId } = req.params;
      const userId = req.user.id;

      await pool.query(
        `UPDATE launch_request_templates SET is_active = FALSE WHERE id = $1 AND created_by = $2`,
        [templateId, userId]
      );

      return res.json({ success: true });
    } catch (err) {
      logger.error('Delete launch template error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─────────────────────────────────────────────
  // CANVAS BRIEF (for launch requests)
  // ─────────────────────────────────────────────

  async getCanvas(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `SELECT * FROM launch_request_canvas WHERE launch_request_id = $1`,
        [id]
      );
      const canvas = result.rows[0] || null;
      return res.json({ success: true, canvas });
    } catch (err) {
      logger.error('Get launch canvas error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async upsertCanvas(req, res) {
    try {
      const { id } = req.params;
      const { content, attachments = [] } = req.body;

      const result = await pool.query(
        `INSERT INTO launch_request_canvas (launch_request_id, content, attachments)
         VALUES ($1, $2, $3)
         ON CONFLICT (launch_request_id)
         DO UPDATE SET content = $2, attachments = $3, updated_at = NOW()
         RETURNING *`,
        [id, JSON.stringify(content), JSON.stringify(attachments)]
      );
      return res.json({ success: true, canvas: result.rows[0] });
    } catch (err) {
      logger.error('Upsert launch canvas error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async uploadCanvasAttachment(req, res) {
    try {
      const { id } = req.params;
      if (!req.file) return res.status(400).json({ success: false, error: 'No file provided' });

      const { originalname, mimetype, size, location, key } = req.file;
      const crypto = require('crypto');

      // Ensure canvas row exists
      await pool.query(
        `INSERT INTO launch_request_canvas (launch_request_id, content, attachments)
         VALUES ($1, '[]', '[]')
         ON CONFLICT (launch_request_id) DO NOTHING`,
        [id]
      );

      const attachment = {
        file_id: crypto.randomUUID(),
        file_name: originalname,
        mime_type: mimetype,
        file_size: size || 0,
        thumbnail_url: location || '',
        s3_key: key || '',
        created_at: new Date().toISOString()
      };

      const result = await pool.query(
        `UPDATE launch_request_canvas
         SET attachments = attachments || $1::jsonb, updated_at = NOW()
         WHERE launch_request_id = $2
         RETURNING *`,
        [JSON.stringify(attachment), id]
      );

      return res.json({ success: true, canvas: result.rows[0], attachment });
    } catch (err) {
      logger.error('Upload launch canvas attachment error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async removeCanvasAttachment(req, res) {
    try {
      const { id, fileId } = req.params;

      const result = await pool.query(
        `UPDATE launch_request_canvas
         SET attachments = (
           SELECT COALESCE(jsonb_agg(a), '[]'::jsonb)
           FROM jsonb_array_elements(attachments) a
           WHERE a->>'file_id' != $1
         ),
         updated_at = NOW()
         WHERE launch_request_id = $2
         RETURNING *`,
        [fileId, id]
      );

      return res.json({ success: true, canvas: result.rows[0] });
    } catch (err) {
      logger.error('Remove launch canvas attachment error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new LaunchRequestController();
