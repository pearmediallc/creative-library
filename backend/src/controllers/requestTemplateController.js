/**
 * Request Template Controller
 * Handles team request templates
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Create request template
 * POST /api/teams/:teamId/templates
 */
async function createTemplate(req, res) {
  try {
    const { teamId } = req.params;
    const {
      name,
      description,
      defaultTitle,
      defaultRequestType,
      defaultInstructions,
      defaultPriority = 'normal',
      defaultDueDays,
      defaultPlatform,
      defaultVertical,
      defaultNumCreatives,
      defaultAllowMultipleUploads,
      defaultRequireEmail,
      defaultCustomMessage,
      requiredFields
    } = req.body;
    const userId = req.user.id;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    // Check if user has permission to create templates
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    if (!memberCheck.rows[0].can_manage_templates) {
      return res.status(403).json({ error: 'You do not have permission to manage templates' });
    }

    const result = await query(
      `INSERT INTO request_templates (
        team_id, created_by, name, description,
        default_title, default_request_type, default_instructions, default_priority,
        default_due_days, default_platform, default_vertical, default_num_creatives,
        default_allow_multiple_uploads, default_require_email, default_custom_message,
        required_fields
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        teamId,
        userId,
        name.trim(),
        description || null,
        defaultTitle || null,
        defaultRequestType || null,
        defaultInstructions || null,
        defaultPriority,
        defaultDueDays || null,
        defaultPlatform || null,
        defaultVertical || null,
        defaultNumCreatives || null,
        defaultAllowMultipleUploads !== undefined ? defaultAllowMultipleUploads : null,
        defaultRequireEmail !== undefined ? defaultRequireEmail : null,
        defaultCustomMessage || null,
        JSON.stringify(requiredFields || [])
      ]
    );

    logger.info('Template created', { template_id: result.rows[0].id, team_id: teamId });

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Template created successfully'
    });
  } catch (error) {
    logger.error('Create template failed', { error: error.message, team_id: req.params.teamId });
    res.status(500).json({ error: 'Failed to create template' });
  }
}

/**
 * Get team templates
 * GET /api/teams/:teamId/templates
 */
async function getTeamTemplates(req, res) {
  try {
    const { teamId } = req.params;
    const { active } = req.query;
    const userId = req.user.id;

    // Check if user is a team member
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    let whereClause = 'team_id = $1';
    const params = [teamId];

    if (active !== undefined) {
      whereClause += ' AND is_active = $2';
      params.push(active === 'true');
    }

    const result = await query(
      `SELECT
        rt.*,
        u.name as created_by_username
       FROM request_templates rt
       LEFT JOIN users u ON rt.created_by = u.id
       WHERE ${whereClause}
       ORDER BY rt.created_at DESC`,
      params
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Get team templates failed', { error: error.message, team_id: req.params.teamId });
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
}

/**
 * Get template by ID
 * GET /api/templates/:templateId
 */
async function getTemplate(req, res) {
  try {
    const { templateId } = req.params;
    const userId = req.user.id;

    const result = await query(
      `SELECT
        rt.*,
        u.username as created_by_username
       FROM request_templates rt
       LEFT JOIN users u ON rt.created_by = u.id
       WHERE rt.id = $1`,
      [templateId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = result.rows[0];

    // Check if user is a team member
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [template.team_id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this template' });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error('Get template failed', { error: error.message, template_id: req.params.templateId });
    res.status(500).json({ error: 'Failed to fetch template' });
  }
}

/**
 * Update template
 * PUT /api/templates/:templateId
 */
async function updateTemplate(req, res) {
  try {
    const { templateId } = req.params;
    const {
      name,
      description,
      default_title,
      default_request_type,
      default_instructions,
      default_priority,
      default_due_days,
      default_platform,
      default_vertical,
      default_num_creatives,
      default_allow_multiple_uploads,
      default_require_email,
      default_custom_message,
      requiredFields,
      is_active
    } = req.body;
    const userId = req.user.id;

    // Get template
    const templateResult = await query(
      'SELECT * FROM request_templates WHERE id = $1',
      [templateId]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = templateResult.rows[0];

    // Check if user has permission
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [template.team_id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    if (!memberCheck.rows[0].can_manage_templates) {
      return res.status(403).json({ error: 'You do not have permission to manage templates' });
    }

    const result = await query(
      `UPDATE request_templates
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           default_title = COALESCE($3, default_title),
           default_request_type = COALESCE($4, default_request_type),
           default_instructions = COALESCE($5, default_instructions),
           default_priority = COALESCE($6, default_priority),
           default_due_days = COALESCE($7, default_due_days),
           default_platform = COALESCE($8, default_platform),
           default_vertical = COALESCE($9, default_vertical),
           default_num_creatives = COALESCE($10, default_num_creatives),
           default_allow_multiple_uploads = COALESCE($11, default_allow_multiple_uploads),
           default_require_email = COALESCE($12, default_require_email),
           default_custom_message = COALESCE($13, default_custom_message),
           required_fields = COALESCE($14, required_fields),
           is_active = COALESCE($15, is_active)
       WHERE id = $16
       RETURNING *`,
      [
        name?.trim() || null,
        description !== undefined ? description : null,
        default_title !== undefined ? default_title : null,
        default_request_type !== undefined ? default_request_type : null,
        default_instructions !== undefined ? default_instructions : null,
        default_priority || null,
        default_due_days !== undefined ? default_due_days : null,
        default_platform !== undefined ? default_platform : null,
        default_vertical !== undefined ? default_vertical : null,
        default_num_creatives !== undefined ? default_num_creatives : null,
        default_allow_multiple_uploads !== undefined ? default_allow_multiple_uploads : null,
        default_require_email !== undefined ? default_require_email : null,
        default_custom_message !== undefined ? default_custom_message : null,
        requiredFields ? JSON.stringify(requiredFields) : null,
        is_active !== undefined ? is_active : null,
        templateId
      ]
    );

    logger.info('Template updated', { template_id: templateId, team_id: template.team_id });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Template updated successfully'
    });
  } catch (error) {
    logger.error('Update template failed', { error: error.message, template_id: req.params.templateId });
    res.status(500).json({ error: 'Failed to update template' });
  }
}

/**
 * Delete template
 * DELETE /api/templates/:templateId
 */
async function deleteTemplate(req, res) {
  try {
    const { templateId } = req.params;
    const userId = req.user.id;

    // Get template
    const templateResult = await query(
      'SELECT * FROM request_templates WHERE id = $1',
      [templateId]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = templateResult.rows[0];

    // Check if user has permission
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [template.team_id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    if (!memberCheck.rows[0].can_manage_templates) {
      return res.status(403).json({ error: 'You do not have permission to manage templates' });
    }

    await query('DELETE FROM request_templates WHERE id = $1', [templateId]);

    logger.info('Template deleted', { template_id: templateId, team_id: template.team_id });

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    logger.error('Delete template failed', { error: error.message, template_id: req.params.templateId });
    res.status(500).json({ error: 'Failed to delete template' });
  }
}

/**
 * Use template to create request
 * POST /api/templates/:templateId/use
 */
async function useTemplate(req, res) {
  try {
    const { templateId } = req.params;
    const overrides = req.body;
    const userId = req.user.id;

    // Get template
    const templateResult = await query(
      'SELECT * FROM request_templates WHERE id = $1',
      [templateId]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = templateResult.rows[0];

    // Check if user is a team member
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [template.team_id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this template' });
    }

    // Increment usage count
    await query(
      'UPDATE request_templates SET usage_count = usage_count + 1 WHERE id = $1',
      [templateId]
    );

    // Return template data merged with overrides
    const requestData = {
      title: overrides.title || template.default_title,
      instructions: overrides.instructions || template.default_instructions,
      priority: overrides.priority || template.default_priority,
      dueDate: overrides.dueDate || (template.default_due_days ?
        new Date(Date.now() + template.default_due_days * 24 * 60 * 60 * 1000).toISOString() : null),
      customFields: overrides.customFields || template.required_fields
    };

    res.json({
      success: true,
      data: requestData,
      message: 'Template applied successfully'
    });
  } catch (error) {
    logger.error('Use template failed', { error: error.message, template_id: req.params.templateId });
    res.status(500).json({ error: 'Failed to use template' });
  }
}

module.exports = {
  createTemplate,
  getTeamTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  useTemplate
};
