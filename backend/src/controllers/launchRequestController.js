/**
 * Launch Request Controller
 * Handles creative strategist → creative head + buyer head → media buyer flow
 */

const { pool } = require('../config/database');
const logger = require('../utils/logger');

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
      if (editor_distribution.length > 0) {
        for (const dist of editor_distribution) {
          await client.query(
            `INSERT INTO launch_request_editors (launch_request_id, editor_id, num_creatives_assigned)
             VALUES ($1, $2, $3)
             ON CONFLICT (launch_request_id, editor_id) DO UPDATE SET num_creatives_assigned = $3`,
            [requestId, dist.editor_id, dist.num_creatives]
          );
        }
      } else if (editor_ids.length > 0) {
        for (const editorId of editor_ids) {
          await client.query(
            `INSERT INTO launch_request_editors (launch_request_id, editor_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [requestId, editorId]
          );
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
          SELECT lre.*, e.name AS editor_name, e.display_name,
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

      return res.json({ success: true });

    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Assign buyers error:', err);
      return res.status(500).json({ success: false, error: err.message });
    } finally {
      client.release();
    }
  }

  async launch(req, res) {
    // buyer_assigned → launched
    return this._transition(req, res, 'launched', ['buyer_assigned'], { launched_at: new Date() });
  }

  async close(req, res) {
    // launched → closed
    return this._transition(req, res, 'closed', ['launched'], { closed_at: new Date() });
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

      if (editor_distribution.length > 0) {
        // Remove existing and re-assign with distribution
        await client.query(`DELETE FROM launch_request_editors WHERE launch_request_id = $1`, [id]);
        for (const dist of editor_distribution) {
          await client.query(
            `INSERT INTO launch_request_editors (launch_request_id, editor_id, num_creatives_assigned)
             VALUES ($1, $2, $3)`,
            [id, dist.editor_id, dist.num_creatives]
          );
        }
      } else if (editor_ids.length > 0) {
        await client.query(`DELETE FROM launch_request_editors WHERE launch_request_id = $1`, [id]);
        for (const editorId of editor_ids) {
          await client.query(
            `INSERT INTO launch_request_editors (launch_request_id, editor_id) VALUES ($1, $2)`,
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
}

module.exports = new LaunchRequestController();
