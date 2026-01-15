/**
 * Media Share Controller
 * Handles sharing media files with teams
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Share media with a team
 * POST /api/media/share
 */
async function shareMediaWithTeam(req, res) {
  try {
    const { teamId, fileRequestUploadId, shareMessage } = req.body;
    const userId = req.user.id;

    if (!teamId || !fileRequestUploadId) {
      return res.status(400).json({ error: 'Team ID and file upload ID are required' });
    }

    // Check if user is a team member
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    // Check if file exists
    const fileCheck = await query(
      'SELECT * FROM file_request_uploads WHERE id = $1',
      [fileRequestUploadId]
    );

    if (fileCheck.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Share media with team (ON CONFLICT DO NOTHING handles duplicates)
    const result = await query(
      `INSERT INTO team_shared_media (team_id, file_request_upload_id, shared_by, share_message)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (team_id, file_request_upload_id) DO UPDATE
       SET share_message = EXCLUDED.share_message,
           shared_by = EXCLUDED.shared_by,
           created_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [teamId, fileRequestUploadId, userId, shareMessage || null]
    );

    // Log activity
    await query(
      `INSERT INTO team_activity (team_id, user_id, activity_type, activity_data)
       VALUES ($1, $2, 'media_shared', $3)`,
      [teamId, userId, JSON.stringify({ file_id: fileRequestUploadId, shared_by: userId, message: shareMessage })]
    );

    logger.info('Media shared with team', {
      team_id: teamId,
      file_id: fileRequestUploadId,
      shared_by: userId
    });

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Media shared with team successfully'
    });
  } catch (error) {
    logger.error('Share media with team failed', {
      error: error.message,
      user_id: req.user.id
    });
    res.status(500).json({ error: 'Failed to share media with team' });
  }
}

/**
 * Get shared media for a team
 * GET /api/teams/:teamId/shared-media
 */
async function getTeamSharedMedia(req, res) {
  try {
    const { teamId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const userId = req.user.id;

    // Check if user is a team member
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    const result = await query(
      `SELECT
        tsm.*,
        fru.file_name,
        fru.file_type,
        fru.media_type,
        fru.s3_key,
        fru.uploaded_at,
        e.display_name as uploader_name,
        u.name as shared_by_name
       FROM team_shared_media tsm
       JOIN file_request_uploads fru ON tsm.file_request_upload_id = fru.id
       LEFT JOIN editors e ON fru.editor_id = e.id
       LEFT JOIN users u ON tsm.shared_by = u.id
       WHERE tsm.team_id = $1
       ORDER BY tsm.created_at DESC
       LIMIT $2 OFFSET $3`,
      [teamId, parseInt(limit), parseInt(offset)]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Get team shared media failed', {
      error: error.message,
      team_id: req.params.teamId
    });
    res.status(500).json({ error: 'Failed to fetch shared media' });
  }
}

/**
 * Remove shared media from team
 * DELETE /api/teams/:teamId/shared-media/:fileId
 */
async function removeSharedMedia(req, res) {
  try {
    const { teamId, fileId } = req.params;
    const userId = req.user.id;

    // Check if user is a team member
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    // Get the shared media record
    const sharedMediaResult = await query(
      'SELECT * FROM team_shared_media WHERE team_id = $1 AND file_request_upload_id = $2',
      [teamId, fileId]
    );

    if (sharedMediaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shared media not found' });
    }

    const sharedMedia = sharedMediaResult.rows[0];

    // Only the person who shared it or team admin/lead can remove it
    const member = memberCheck.rows[0];
    const canRemove = sharedMedia.shared_by === userId ||
                      ['admin', 'lead'].includes(member.team_role) ||
                      member.can_delete_files;

    if (!canRemove) {
      return res.status(403).json({ error: 'You do not have permission to remove this shared media' });
    }

    await query(
      'DELETE FROM team_shared_media WHERE team_id = $1 AND file_request_upload_id = $2',
      [teamId, fileId]
    );

    // Log activity
    await query(
      `INSERT INTO team_activity (team_id, user_id, activity_type, activity_data)
       VALUES ($1, $2, 'media_unshared', $3)`,
      [teamId, userId, JSON.stringify({ file_id: fileId, removed_by: userId })]
    );

    logger.info('Shared media removed from team', {
      team_id: teamId,
      file_id: fileId,
      removed_by: userId
    });

    res.json({
      success: true,
      message: 'Shared media removed from team successfully'
    });
  } catch (error) {
    logger.error('Remove shared media failed', {
      error: error.message,
      team_id: req.params.teamId
    });
    res.status(500).json({ error: 'Failed to remove shared media' });
  }
}

/**
 * Share media with multiple teams
 * POST /api/media/share-multiple
 */
async function shareMediaWithMultipleTeams(req, res) {
  try {
    const { teamIds, fileRequestUploadId, shareMessage } = req.body;
    const userId = req.user.id;

    if (!teamIds || !Array.isArray(teamIds) || teamIds.length === 0) {
      return res.status(400).json({ error: 'At least one team ID is required' });
    }

    if (!fileRequestUploadId) {
      return res.status(400).json({ error: 'File upload ID is required' });
    }

    // Check if file exists
    const fileCheck = await query(
      'SELECT * FROM file_request_uploads WHERE id = $1',
      [fileRequestUploadId]
    );

    if (fileCheck.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const results = [];
    const errors = [];

    for (const teamId of teamIds) {
      try {
        // Check if user is a team member
        const memberCheck = await query(
          'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
          [teamId, userId]
        );

        if (memberCheck.rows.length === 0) {
          errors.push({ teamId, error: 'Not a member of this team' });
          continue;
        }

        // Share media with team
        const result = await query(
          `INSERT INTO team_shared_media (team_id, file_request_upload_id, shared_by, share_message)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (team_id, file_request_upload_id) DO UPDATE
           SET share_message = EXCLUDED.share_message,
               shared_by = EXCLUDED.shared_by,
               created_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [teamId, fileRequestUploadId, userId, shareMessage || null]
        );

        // Log activity
        await query(
          `INSERT INTO team_activity (team_id, user_id, activity_type, activity_data)
           VALUES ($1, $2, 'media_shared', $3)`,
          [teamId, userId, JSON.stringify({ file_id: fileRequestUploadId, shared_by: userId, message: shareMessage })]
        );

        results.push(result.rows[0]);
      } catch (error) {
        errors.push({ teamId, error: error.message });
      }
    }

    logger.info('Media shared with multiple teams', {
      file_id: fileRequestUploadId,
      shared_by: userId,
      success_count: results.length,
      error_count: errors.length
    });

    res.status(201).json({
      success: true,
      data: {
        shared: results,
        errors: errors
      },
      message: `Media shared with ${results.length} team(s) successfully`
    });
  } catch (error) {
    logger.error('Share media with multiple teams failed', {
      error: error.message,
      user_id: req.user.id
    });
    res.status(500).json({ error: 'Failed to share media with teams' });
  }
}

module.exports = {
  shareMediaWithTeam,
  getTeamSharedMedia,
  removeSharedMedia,
  shareMediaWithMultipleTeams
};
