/**
 * Request Comments Controller
 * Handles CRUD operations for file request comments
 */

const { query } = require('../config/database');

/**
 * Get all comments for a specific file request
 * Accessible by: Request creator, Assigned editor, Admins, Watchers
 */
async function getRequestComments(req, res) {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // First, check if user has access to this request
    const requestCheck = await query(
      `SELECT
        fr.id,
        fr.requester_id,
        fr.editor_id,
        EXISTS(
          SELECT 1 FROM access_request_watchers arw
          WHERE arw.request_id = fr.id AND arw.user_id = $2
        ) as is_watcher
      FROM file_requests fr
      WHERE fr.id = $1`,
      [requestId, userId]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = requestCheck.rows[0];
    const isRequester = request.requester_id === userId;
    const isEditor = request.editor_id === userId;
    const isWatcher = request.is_watcher;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    // Check if user has access to view comments
    if (!isRequester && !isEditor && !isWatcher && !isAdmin) {
      return res.status(403).json({
        error: 'You do not have permission to view comments for this request'
      });
    }

    // Get all comments with user details
    const result = await query(
      `SELECT
        frc.id,
        frc.request_id,
        frc.user_id,
        frc.comment,
        frc.created_at,
        frc.updated_at,
        u.username,
        u.email,
        u.role as user_role
      FROM file_request_comments frc
      JOIN users u ON frc.user_id = u.id
      WHERE frc.request_id = $1
      ORDER BY frc.created_at ASC`,
      [requestId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching request comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
}

/**
 * Add a new comment to a file request
 * Accessible by: Request creator, Assigned editor, Admins, Watchers
 */
async function addRequestComment(req, res) {
  try {
    const { requestId } = req.params;
    const { comment } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validation
    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    if (comment.length > 5000) {
      return res.status(400).json({ error: 'Comment is too long (max 5000 characters)' });
    }

    // Check if user has access to this request
    const requestCheck = await query(
      `SELECT
        fr.id,
        fr.requester_id,
        fr.editor_id,
        fr.status,
        EXISTS(
          SELECT 1 FROM access_request_watchers arw
          WHERE arw.request_id = fr.id AND arw.user_id = $2
        ) as is_watcher
      FROM file_requests fr
      WHERE fr.id = $1`,
      [requestId, userId]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = requestCheck.rows[0];
    const isRequester = request.requester_id === userId;
    const isEditor = request.editor_id === userId;
    const isWatcher = request.is_watcher;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    // Check if user has access to add comments
    if (!isRequester && !isEditor && !isWatcher && !isAdmin) {
      return res.status(403).json({
        error: 'You do not have permission to comment on this request'
      });
    }

    // Insert the comment
    const result = await query(
      `INSERT INTO file_request_comments (request_id, user_id, comment)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [requestId, userId, comment.trim()]
    );

    // Get user details for the response
    const userDetails = await query(
      `SELECT username, email, role as user_role FROM users WHERE id = $1`,
      [userId]
    );

    const commentWithUser = {
      ...result.rows[0],
      username: userDetails.rows[0].username,
      email: userDetails.rows[0].email,
      user_role: userDetails.rows[0].user_role
    };

    res.status(201).json({
      success: true,
      data: commentWithUser,
      message: 'Comment added successfully'
    });
  } catch (error) {
    console.error('Error adding request comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
}

/**
 * Update a comment (user can only update their own comments)
 */
async function updateRequestComment(req, res) {
  try {
    const { commentId } = req.params;
    const { comment } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validation
    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    if (comment.length > 5000) {
      return res.status(400).json({ error: 'Comment is too long (max 5000 characters)' });
    }

    // Check if comment exists and user owns it
    const commentCheck = await query(
      `SELECT user_id FROM file_request_comments WHERE id = $1`,
      [commentId]
    );

    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const isOwner = commentCheck.rows[0].user_id === userId;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    // Only comment owner or admin can update
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: 'You can only update your own comments'
      });
    }

    // Update the comment
    const result = await query(
      `UPDATE file_request_comments
       SET comment = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [comment.trim(), commentId]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Comment updated successfully'
    });
  } catch (error) {
    console.error('Error updating request comment:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
}

/**
 * Delete a comment (user can only delete their own comments)
 */
async function deleteRequestComment(req, res) {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if comment exists and user owns it
    const commentCheck = await query(
      `SELECT user_id FROM file_request_comments WHERE id = $1`,
      [commentId]
    );

    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const isOwner = commentCheck.rows[0].user_id === userId;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    // Only comment owner or admin can delete
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: 'You can only delete your own comments'
      });
    }

    // Delete the comment
    await query(
      `DELETE FROM file_request_comments WHERE id = $1`,
      [commentId]
    );

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting request comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
}

/**
 * Get comment count for a request (used for badges)
 */
async function getCommentCount(req, res) {
  try {
    const { requestId } = req.params;

    const result = await query(
      `SELECT COUNT(*) as count FROM file_request_comments WHERE request_id = $1`,
      [requestId]
    );

    res.json({
      success: true,
      data: { count: parseInt(result.rows[0].count) }
    });
  } catch (error) {
    console.error('Error fetching comment count:', error);
    res.status(500).json({ error: 'Failed to fetch comment count' });
  }
}

module.exports = {
  getRequestComments,
  addRequestComment,
  updateRequestComment,
  deleteRequestComment,
  getCommentCount
};
