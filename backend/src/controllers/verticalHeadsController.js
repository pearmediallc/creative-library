/**
 * Vertical Heads Controller
 * Manages vertical-to-editor head mappings for auto-assignment
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get all vertical heads mappings
 * GET /api/vertical-heads
 */
async function getVerticalHeads(req, res) {
  try {
    const result = await query(
      `SELECT
        vh.*,
        u.name as head_editor_name,
        u.email as head_editor_email,
        u.display_name as head_editor_display_name
       FROM vertical_heads vh
       LEFT JOIN users u ON vh.head_editor_id = u.id
       ORDER BY vh.vertical ASC`
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Get vertical heads failed', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch vertical heads' });
  }
}

/**
 * Get vertical head for specific vertical
 * GET /api/vertical-heads/:vertical
 */
async function getVerticalHead(req, res) {
  try {
    const { vertical } = req.params;

    const result = await query(
      `SELECT
        vh.*,
        u.name as head_editor_name,
        u.email as head_editor_email,
        u.display_name as head_editor_display_name
       FROM vertical_heads vh
       LEFT JOIN users u ON vh.head_editor_id = u.id
       WHERE vh.vertical = $1`,
      [vertical]
    );

    if (result.rows.length === 0) {
      // If no head found, return fallback editors
      const fallbackResult = await query(
        `SELECT fallback_editor_ids FROM vertical_heads LIMIT 1`
      );

      if (fallbackResult.rows.length > 0 && fallbackResult.rows[0].fallback_editor_ids) {
        const fallbackIds = fallbackResult.rows[0].fallback_editor_ids;
        const fallbackUsers = await query(
          `SELECT id, name, email, display_name FROM users WHERE id = ANY($1::uuid[])`,
          [fallbackIds]
        );

        return res.json({
          success: true,
          data: null,
          fallback_editors: fallbackUsers.rows
        });
      }

      return res.status(404).json({ error: 'Vertical head not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Get vertical head failed', { error: error.message, vertical: req.params.vertical });
    res.status(500).json({ error: 'Failed to fetch vertical head' });
  }
}

/**
 * Update vertical head mapping (Admin only)
 * PUT /api/vertical-heads/:vertical
 */
async function updateVerticalHead(req, res) {
  try {
    const { vertical } = req.params;
    const { head_editor_id, fallback_editor_ids } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Only admins can update vertical heads
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update vertical heads' });
    }

    // Verify editor exists
    if (head_editor_id) {
      const editorCheck = await query(
        'SELECT id FROM users WHERE id = $1',
        [head_editor_id]
      );

      if (editorCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Editor not found' });
      }
    }

    // Update or insert vertical head
    const result = await query(
      `INSERT INTO vertical_heads (vertical, head_editor_id, fallback_editor_ids, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (vertical)
       DO UPDATE SET
         head_editor_id = COALESCE($2, vertical_heads.head_editor_id),
         fallback_editor_ids = COALESCE($3, vertical_heads.fallback_editor_ids),
         updated_at = NOW()
       RETURNING *`,
      [
        vertical,
        head_editor_id || null,
        fallback_editor_ids || null
      ]
    );

    logger.info('Vertical head updated', {
      vertical,
      head_editor_id,
      updated_by: userId
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Vertical head updated successfully'
    });
  } catch (error) {
    logger.error('Update vertical head failed', { error: error.message, vertical: req.params.vertical });
    res.status(500).json({ error: 'Failed to update vertical head' });
  }
}

/**
 * Get auto-assigned editor for vertical (used during file request creation)
 * POST /api/vertical-heads/get-assignment
 */
async function getAssignmentForVertical(req, res) {
  try {
    const { vertical } = req.body;

    if (!vertical) {
      return res.status(400).json({ error: 'Vertical is required' });
    }

    const result = await query(
      `SELECT
        vh.*,
        u.id as editor_id,
        u.name as editor_name,
        u.email as editor_email,
        u.display_name as editor_display_name
       FROM vertical_heads vh
       LEFT JOIN users u ON vh.head_editor_id = u.id
       WHERE vh.vertical = $1`,
      [vertical]
    );

    if (result.rows.length === 0 || !result.rows[0].editor_id) {
      // No head found, use fallback editors
      const fallbackResult = await query(
        `SELECT fallback_editor_ids FROM vertical_heads LIMIT 1`
      );

      if (fallbackResult.rows.length > 0 && fallbackResult.rows[0].fallback_editor_ids) {
        const fallbackIds = fallbackResult.rows[0].fallback_editor_ids;
        const fallbackUsers = await query(
          `SELECT id, name, email, display_name FROM users WHERE id = ANY($1::uuid[])`,
          [fallbackIds]
        );

        return res.json({
          success: true,
          data: {
            vertical,
            head_editor: null,
            fallback_editors: fallbackUsers.rows,
            assigned_editors: fallbackUsers.rows.map(u => u.id)
          }
        });
      }

      return res.status(404).json({ error: 'No vertical head or fallback editors found' });
    }

    res.json({
      success: true,
      data: {
        vertical,
        head_editor: {
          id: result.rows[0].editor_id,
          name: result.rows[0].editor_name,
          email: result.rows[0].editor_email,
          display_name: result.rows[0].editor_display_name
        },
        assigned_editors: [result.rows[0].editor_id]
      }
    });
  } catch (error) {
    logger.error('Get assignment for vertical failed', { error: error.message });
    res.status(500).json({ error: 'Failed to get assignment for vertical' });
  }
}

module.exports = {
  getVerticalHeads,
  getVerticalHead,
  updateVerticalHead,
  getAssignmentForVertical
};
