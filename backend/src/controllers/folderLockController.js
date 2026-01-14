const { query } = require('../config/database');

/**
 * Toggle folder lock status
 * POST /api/folders/:id/toggle-lock
 */
async function toggleFolderLock(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    // Get current folder state
    const folderResult = await query(
      'SELECT is_locked, locked_by, owner_id FROM folders WHERE id = $1',
      [id]
    );

    if (folderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Folder not found'
      });
    }

    const folder = folderResult.rows[0];

    // Check if user is owner or admin
    if (folder.owner_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only folder owner or admin can lock/unlock folders'
      });
    }

    // If folder is locked by someone else (and user is not admin), deny
    if (folder.is_locked && folder.locked_by !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Folder is locked by another user'
      });
    }

    // Toggle lock
    const newLockState = !folder.is_locked;

    const updateResult = await query(
      `UPDATE folders
       SET is_locked = $1,
           locked_by = $2,
           locked_at = $3,
           lock_reason = $4
       WHERE id = $5
       RETURNING *`,
      [
        newLockState,
        newLockState ? userId : null,
        newLockState ? new Date() : null,
        newLockState ? reason : null,
        id
      ]
    );

    res.json({
      success: true,
      message: newLockState ? 'Folder locked successfully' : 'Folder unlocked successfully',
      data: updateResult.rows[0]
    });
  } catch (error) {
    console.error('Error toggling folder lock:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle folder lock'
    });
  }
}

/**
 * Get folder lock status
 * GET /api/folders/:id/lock-status
 */
async function getFolderLockStatus(req, res) {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT f.is_locked, f.locked_by, f.locked_at, f.lock_reason, u.name as locked_by_name
       FROM folders f
       LEFT JOIN users u ON f.locked_by = u.id
       WHERE f.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Folder not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting folder lock status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get folder lock status'
    });
  }
}

module.exports = {
  toggleFolderLock,
  getFolderLockStatus
};
