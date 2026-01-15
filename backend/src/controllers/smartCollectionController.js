/**
 * Smart Collection Controller
 * Handles smart collections and manual media collections
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Create a collection
 * POST /api/collections
 */
async function createCollection(req, res) {
  try {
    const {
      name,
      description,
      teamId,
      collectionType = 'manual',
      smartRules = [],
      isPublic = false
    } = req.body;
    const userId = req.user.id;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Collection name is required' });
    }

    // If team collection, verify membership
    if (teamId) {
      const memberCheck = await query(
        'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
        [teamId, userId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: 'You are not a member of this team' });
      }
    }

    const result = await query(
      `INSERT INTO smart_collections (
        name, description, owner_id, team_id,
        collection_type, smart_rules, is_public
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        name.trim(),
        description || null,
        userId,
        teamId || null,
        collectionType,
        JSON.stringify(smartRules),
        isPublic
      ]
    );

    logger.info('Collection created', { collection_id: result.rows[0].id, owner_id: userId });

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Collection created successfully'
    });
  } catch (error) {
    logger.error('Create collection failed', { error: error.message, user_id: req.user.id });
    res.status(500).json({ error: 'Failed to create collection' });
  }
}

/**
 * Get user collections
 * GET /api/collections
 */
async function getCollections(req, res) {
  try {
    const { teamId, collectionType } = req.query;
    const userId = req.user.id;

    let whereClause = '(sc.owner_id = $1 OR sc.is_public = true)';
    const params = [userId];

    if (teamId) {
      whereClause += ' AND sc.team_id = $2';
      params.push(teamId);
    }

    if (collectionType) {
      whereClause += ` AND sc.collection_type = $${params.length + 1}`;
      params.push(collectionType);
    }

    const result = await query(
      `SELECT
        sc.*,
        u.name as owner_name,
        t.name as team_name,
        COUNT(ci.id) as item_count
       FROM smart_collections sc
       LEFT JOIN users u ON sc.owner_id = u.id
       LEFT JOIN teams t ON sc.team_id = t.id
       LEFT JOIN collection_items ci ON sc.id = ci.collection_id
       WHERE ${whereClause}
       GROUP BY sc.id, u.name, t.name
       ORDER BY sc.created_at DESC`,
      params
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Get collections failed', { error: error.message, user_id: req.user.id });
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
}

/**
 * Get collection by ID with items
 * GET /api/collections/:collectionId
 */
async function getCollection(req, res) {
  try {
    const { collectionId } = req.params;
    const userId = req.user.id;

    const collectionResult = await query(
      `SELECT
        sc.*,
        u.name as owner_name,
        t.name as team_name
       FROM smart_collections sc
       LEFT JOIN users u ON sc.owner_id = u.id
       LEFT JOIN teams t ON sc.team_id = t.id
       WHERE sc.id = $1`,
      [collectionId]
    );

    if (collectionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const collection = collectionResult.rows[0];

    // Check access
    if (!collection.is_public && collection.owner_id !== userId) {
      // Check if user is in the same team
      if (collection.team_id) {
        const memberCheck = await query(
          'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
          [collection.team_id, userId]
        );

        if (memberCheck.rows.length === 0) {
          return res.status(403).json({ error: 'You do not have access to this collection' });
        }
      } else {
        return res.status(403).json({ error: 'You do not have access to this collection' });
      }
    }

    // Get collection items
    const itemsResult = await query(
      `SELECT
        ci.*,
        fru.file_name,
        fru.file_type,
        fru.media_type,
        fru.s3_key,
        fru.uploaded_at,
        e.display_name as uploader_name,
        u.name as added_by_name
       FROM collection_items ci
       JOIN file_request_uploads fru ON ci.file_request_upload_id = fru.id
       LEFT JOIN editors e ON fru.editor_id = e.id
       LEFT JOIN users u ON ci.added_by = u.id
       WHERE ci.collection_id = $1
       ORDER BY ci.added_at DESC`,
      [collectionId]
    );

    res.json({
      success: true,
      data: {
        ...collection,
        items: itemsResult.rows
      }
    });
  } catch (error) {
    logger.error('Get collection failed', { error: error.message, collection_id: req.params.collectionId });
    res.status(500).json({ error: 'Failed to fetch collection' });
  }
}

/**
 * Add item to collection
 * POST /api/collections/:collectionId/items
 */
async function addItemToCollection(req, res) {
  try {
    const { collectionId } = req.params;
    const { fileRequestUploadId } = req.body;
    const userId = req.user.id;

    if (!fileRequestUploadId) {
      return res.status(400).json({ error: 'File upload ID is required' });
    }

    // Check collection exists and user has access
    const collectionResult = await query(
      'SELECT * FROM smart_collections WHERE id = $1',
      [collectionId]
    );

    if (collectionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const collection = collectionResult.rows[0];

    // Check if user owns collection or is team member
    if (collection.owner_id !== userId) {
      if (collection.team_id) {
        const memberCheck = await query(
          'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
          [collection.team_id, userId]
        );

        if (memberCheck.rows.length === 0) {
          return res.status(403).json({ error: 'You do not have permission to modify this collection' });
        }
      } else {
        return res.status(403).json({ error: 'You do not have permission to modify this collection' });
      }
    }

    // Check if file exists
    const fileCheck = await query(
      'SELECT * FROM file_request_uploads WHERE id = $1',
      [fileRequestUploadId]
    );

    if (fileCheck.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Add item (ON CONFLICT DO NOTHING handles duplicates)
    const result = await query(
      `INSERT INTO collection_items (collection_id, file_request_upload_id, added_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (collection_id, file_request_upload_id) DO NOTHING
       RETURNING *`,
      [collectionId, fileRequestUploadId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Item already exists in collection' });
    }

    logger.info('Item added to collection', { collection_id: collectionId, file_id: fileRequestUploadId });

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Item added to collection successfully'
    });
  } catch (error) {
    logger.error('Add item to collection failed', { error: error.message, collection_id: req.params.collectionId });
    res.status(500).json({ error: 'Failed to add item to collection' });
  }
}

/**
 * Remove item from collection
 * DELETE /api/collections/:collectionId/items/:itemId
 */
async function removeItemFromCollection(req, res) {
  try {
    const { collectionId, itemId } = req.params;
    const userId = req.user.id;

    // Check collection ownership
    const collectionResult = await query(
      'SELECT * FROM smart_collections WHERE id = $1',
      [collectionId]
    );

    if (collectionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const collection = collectionResult.rows[0];

    if (collection.owner_id !== userId) {
      if (collection.team_id) {
        const memberCheck = await query(
          'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
          [collection.team_id, userId]
        );

        if (memberCheck.rows.length === 0) {
          return res.status(403).json({ error: 'You do not have permission to modify this collection' });
        }
      } else {
        return res.status(403).json({ error: 'You do not have permission to modify this collection' });
      }
    }

    await query(
      'DELETE FROM collection_items WHERE id = $1 AND collection_id = $2',
      [itemId, collectionId]
    );

    logger.info('Item removed from collection', { collection_id: collectionId, item_id: itemId });

    res.json({
      success: true,
      message: 'Item removed from collection successfully'
    });
  } catch (error) {
    logger.error('Remove item from collection failed', { error: error.message, collection_id: req.params.collectionId });
    res.status(500).json({ error: 'Failed to remove item from collection' });
  }
}

/**
 * Update collection
 * PUT /api/collections/:collectionId
 */
async function updateCollection(req, res) {
  try {
    const { collectionId } = req.params;
    const { name, description, smartRules, isPublic } = req.body;
    const userId = req.user.id;

    // Check ownership
    const collectionResult = await query(
      'SELECT * FROM smart_collections WHERE id = $1',
      [collectionId]
    );

    if (collectionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const collection = collectionResult.rows[0];

    if (collection.owner_id !== userId) {
      return res.status(403).json({ error: 'You do not have permission to modify this collection' });
    }

    const result = await query(
      `UPDATE smart_collections
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           smart_rules = COALESCE($3, smart_rules),
           is_public = COALESCE($4, is_public),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [
        name?.trim() || null,
        description !== undefined ? description : null,
        smartRules ? JSON.stringify(smartRules) : null,
        isPublic !== undefined ? isPublic : null,
        collectionId
      ]
    );

    logger.info('Collection updated', { collection_id: collectionId });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Collection updated successfully'
    });
  } catch (error) {
    logger.error('Update collection failed', { error: error.message, collection_id: req.params.collectionId });
    res.status(500).json({ error: 'Failed to update collection' });
  }
}

/**
 * Delete collection
 * DELETE /api/collections/:collectionId
 */
async function deleteCollection(req, res) {
  try {
    const { collectionId } = req.params;
    const userId = req.user.id;

    // Check ownership
    const collectionResult = await query(
      'SELECT * FROM smart_collections WHERE id = $1',
      [collectionId]
    );

    if (collectionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const collection = collectionResult.rows[0];

    if (collection.owner_id !== userId) {
      return res.status(403).json({ error: 'You do not have permission to delete this collection' });
    }

    await query('DELETE FROM smart_collections WHERE id = $1', [collectionId]);

    logger.info('Collection deleted', { collection_id: collectionId });

    res.json({
      success: true,
      message: 'Collection deleted successfully'
    });
  } catch (error) {
    logger.error('Delete collection failed', { error: error.message, collection_id: req.params.collectionId });
    res.status(500).json({ error: 'Failed to delete collection' });
  }
}

module.exports = {
  createCollection,
  getCollections,
  getCollection,
  addItemToCollection,
  removeItemFromCollection,
  updateCollection,
  deleteCollection
};
