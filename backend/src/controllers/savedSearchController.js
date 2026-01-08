const pool = require('../config/database');
const logger = require('../utils/logger');
const { logActivity } = require('../middleware/activityLogger');

class SavedSearchController {
  /**
   * Create a new saved search/smart collection
   * POST /api/saved-searches
   * Body: { name, description, filters, color, icon }
   */
  async create(req, res, next) {
    try {
      const { name, description, filters, color, icon } = req.body;
      const userId = req.user.id;

      if (!name || !filters) {
        return res.status(400).json({
          success: false,
          error: 'Name and filters are required'
        });
      }

      const query = `
        INSERT INTO saved_searches (user_id, name, description, filters, color, icon)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await pool.query(query, [
        userId,
        name,
        description || null,
        JSON.stringify(filters),
        color || null,
        icon || 'Folder'
      ]);

      const savedSearch = result.rows[0];

      // Parse filters back to JSON with error handling
      try {
        savedSearch.filters = JSON.parse(savedSearch.filters);
      } catch (parseError) {
        logger.error('Invalid JSON in saved search filters', {
          searchId: savedSearch.id,
          error: parseError.message
        });
        savedSearch.filters = {}; // Default to empty filters if JSON is invalid
      }

      // Log activity
      await logActivity({
        req,
        actionType: 'saved_search_create',
        resourceType: 'saved_search',
        resourceId: savedSearch.id,
        resourceName: savedSearch.name,
        details: { filters: savedSearch.filters },
        status: 'success'
      });

      logger.info('Saved search created', {
        userId,
        searchId: savedSearch.id,
        name: savedSearch.name
      });

      res.status(201).json({
        success: true,
        data: savedSearch
      });
    } catch (error) {
      logger.error('Create saved search error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get all saved searches for current user
   * GET /api/saved-searches
   */
  async getAll(req, res, next) {
    try {
      const userId = req.user.id;

      const query = `
        SELECT
          ss.*,
          (
            SELECT COUNT(*)::int
            FROM media_files mf
            WHERE 1=1
            ${this.buildFilterConditions()}
          ) as file_count
        FROM saved_searches ss
        WHERE ss.user_id = $1
        ORDER BY ss.is_favorite DESC, ss.updated_at DESC
      `;

      const result = await pool.query(query, [userId]);

      // Parse filters for each saved search
      const savedSearches = result.rows.map(row => {
        let filters = {};
        try {
          filters = JSON.parse(row.filters);
        } catch (parseError) {
          logger.error('Invalid JSON in saved search filters', {
            searchId: row.id,
            error: parseError.message
          });
        }
        return {
          ...row,
          filters
        };
      });

      res.json({
        success: true,
        data: savedSearches
      });
    } catch (error) {
      logger.error('Get saved searches error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get single saved search
   * GET /api/saved-searches/:id
   */
  async getOne(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const query = `
        SELECT * FROM saved_searches
        WHERE id = $1 AND user_id = $2
      `;

      const result = await pool.query(query, [id, userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Saved search not found'
        });
      }

      const savedSearch = result.rows[0];
      try {
        savedSearch.filters = JSON.parse(savedSearch.filters);
      } catch (parseError) {
        logger.error('Invalid JSON in saved search filters', {
          searchId: savedSearch.id,
          error: parseError.message
        });
        savedSearch.filters = {};
      }

      res.json({
        success: true,
        data: savedSearch
      });
    } catch (error) {
      logger.error('Get saved search error', { error: error.message });
      next(error);
    }
  }

  /**
   * Execute saved search and get results
   * GET /api/saved-searches/:id/results
   * Query params: limit, offset
   */
  async getResults(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      const userRole = req.user.role;

      // Get saved search
      const searchQuery = `
        SELECT * FROM saved_searches
        WHERE id = $1 AND user_id = $2
      `;
      const searchResult = await pool.query(searchQuery, [id, userId]);

      if (searchResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Saved search not found'
        });
      }

      const savedSearch = searchResult.rows[0];
      let filters = {};
      try {
        filters = JSON.parse(savedSearch.filters);
      } catch (parseError) {
        logger.error('Invalid JSON in saved search filters', {
          searchId: savedSearch.id,
          error: parseError.message
        });
        return res.status(400).json({
          success: false,
          error: 'Invalid filter configuration for this collection'
        });
      }

      // Build query to fetch files based on filters
      const { query, params } = this.buildMediaQuery(filters, userId, userRole, limit, offset);

      const filesResult = await pool.query(query, params);
      const files = filesResult.rows;

      // Get total count
      const countQuery = this.buildCountQuery(filters, userId, userRole);
      const countResult = await pool.query(countQuery.query, countQuery.params);
      const totalCount = parseInt(countResult.rows[0].count);

      res.json({
        success: true,
        data: {
          collection: {
            ...savedSearch,
            filters: filters
          },
          files: files,
          pagination: {
            total: totalCount,
            limit,
            offset,
            hasMore: offset + files.length < totalCount
          }
        }
      });
    } catch (error) {
      logger.error('Get saved search results error', { error: error.message });
      next(error);
    }
  }

  /**
   * Update saved search
   * PATCH /api/saved-searches/:id
   * Body: { name, description, filters, color, icon }
   */
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { name, description, filters, color, icon } = req.body;

      // Build update fields
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(name);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(description);
      }
      if (filters !== undefined) {
        updates.push(`filters = $${paramCount++}`);
        values.push(JSON.stringify(filters));
      }
      if (color !== undefined) {
        updates.push(`color = $${paramCount++}`);
        values.push(color);
      }
      if (icon !== undefined) {
        updates.push(`icon = $${paramCount++}`);
        values.push(icon);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No fields to update'
        });
      }

      updates.push(`updated_at = NOW()`);
      values.push(id, userId);

      const query = `
        UPDATE saved_searches
        SET ${updates.join(', ')}
        WHERE id = $${paramCount++} AND user_id = $${paramCount++}
        RETURNING *
      `;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Saved search not found'
        });
      }

      const savedSearch = result.rows[0];
      try {
        savedSearch.filters = JSON.parse(savedSearch.filters);
      } catch (parseError) {
        logger.error('Invalid JSON in saved search filters', {
          searchId: savedSearch.id,
          error: parseError.message
        });
        savedSearch.filters = {};
      }

      // Log activity
      await logActivity({
        req,
        actionType: 'saved_search_update',
        resourceType: 'saved_search',
        resourceId: savedSearch.id,
        resourceName: savedSearch.name,
        details: { updated_fields: Object.keys(req.body) },
        status: 'success'
      });

      logger.info('Saved search updated', {
        userId,
        searchId: savedSearch.id
      });

      res.json({
        success: true,
        data: savedSearch
      });
    } catch (error) {
      logger.error('Update saved search error', { error: error.message });
      next(error);
    }
  }

  /**
   * Delete saved search
   * DELETE /api/saved-searches/:id
   */
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const query = `
        DELETE FROM saved_searches
        WHERE id = $1 AND user_id = $2
        RETURNING name
      `;

      const result = await pool.query(query, [id, userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Saved search not found'
        });
      }

      // Log activity
      await logActivity({
        req,
        actionType: 'saved_search_delete',
        resourceType: 'saved_search',
        resourceId: id,
        resourceName: result.rows[0].name,
        details: {},
        status: 'success'
      });

      logger.info('Saved search deleted', { userId, searchId: id });

      res.json({
        success: true,
        message: 'Saved search deleted successfully'
      });
    } catch (error) {
      logger.error('Delete saved search error', { error: error.message });
      next(error);
    }
  }

  /**
   * Toggle favorite status
   * POST /api/saved-searches/:id/favorite
   */
  async toggleFavorite(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const query = `
        UPDATE saved_searches
        SET is_favorite = NOT is_favorite, updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `;

      const result = await pool.query(query, [id, userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Saved search not found'
        });
      }

      const savedSearch = result.rows[0];
      try {
        savedSearch.filters = JSON.parse(savedSearch.filters);
      } catch (parseError) {
        logger.error('Invalid JSON in saved search filters', {
          searchId: savedSearch.id,
          error: parseError.message
        });
        savedSearch.filters = {};
      }

      logger.info('Saved search favorite toggled', {
        userId,
        searchId: id,
        isFavorite: savedSearch.is_favorite
      });

      res.json({
        success: true,
        data: savedSearch
      });
    } catch (error) {
      logger.error('Toggle favorite error', { error: error.message });
      next(error);
    }
  }

  /**
   * Helper: Build media query based on filters
   */
  buildMediaQuery(filters, userId, userRole, limit, offset) {
    let query = `
      SELECT
        mf.*,
        e.name as editor_name,
        e.display_name as editor_display_name,
        u.name as uploader_name,
        buyer.name as buyer_name,
        f.name as folder_name
      FROM media_files mf
      LEFT JOIN editors e ON mf.editor_id = e.id
      LEFT JOIN users u ON mf.uploaded_by = u.id
      LEFT JOIN users buyer ON mf.assigned_buyer_id = buyer.id
      LEFT JOIN folders f ON mf.folder_id = f.id
      WHERE mf.deleted_at IS NULL
    `;

    const params = [];
    let paramCount = 1;

    // Role-based access control
    if (userRole === 'creative') {
      query += ` AND mf.uploaded_by = $${paramCount++}`;
      params.push(userId);
    }

    // Apply filters
    if (filters.search_term) {
      query += ` AND (
        mf.original_filename ILIKE $${paramCount}
        OR mf.description ILIKE $${paramCount}
      )`;
      params.push(`%${filters.search_term}%`);
      paramCount++;
    }

    if (filters.media_types && filters.media_types.length > 0) {
      query += ` AND mf.media_type = ANY($${paramCount++})`;
      params.push(filters.media_types);
    }

    if (filters.editor_ids && filters.editor_ids.length > 0) {
      query += ` AND mf.editor_id = ANY($${paramCount++})`;
      params.push(filters.editor_ids);
    }

    if (filters.buyer_ids && filters.buyer_ids.length > 0) {
      query += ` AND mf.assigned_buyer_id = ANY($${paramCount++})`;
      params.push(filters.buyer_ids);
    }

    if (filters.folder_ids && filters.folder_ids.length > 0) {
      query += ` AND mf.folder_id = ANY($${paramCount++})`;
      params.push(filters.folder_ids);
    }

    if (filters.tags && filters.tags.length > 0) {
      query += ` AND mf.tags && $${paramCount++}`;
      params.push(filters.tags);
    }

    if (filters.date_from) {
      query += ` AND mf.created_at >= $${paramCount++}`;
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      query += ` AND mf.created_at <= $${paramCount++}`;
      params.push(filters.date_to);
    }

    if (filters.file_size_min) {
      query += ` AND mf.file_size >= $${paramCount++}`;
      params.push(filters.file_size_min);
    }

    if (filters.file_size_max) {
      query += ` AND mf.file_size <= $${paramCount++}`;
      params.push(filters.file_size_max);
    }

    if (filters.width_min) {
      query += ` AND mf.width >= $${paramCount++}`;
      params.push(filters.width_min);
    }

    if (filters.width_max) {
      query += ` AND mf.width <= $${paramCount++}`;
      params.push(filters.width_max);
    }

    if (filters.height_min) {
      query += ` AND mf.height >= $${paramCount++}`;
      params.push(filters.height_min);
    }

    if (filters.height_max) {
      query += ` AND mf.height <= $${paramCount++}`;
      params.push(filters.height_max);
    }

    if (filters.is_starred !== undefined) {
      query += ` AND mf.is_starred = $${paramCount++}`;
      params.push(filters.is_starred);
    }

    query += ` ORDER BY mf.created_at DESC`;
    query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    return { query, params };
  }

  /**
   * Helper: Build count query
   */
  buildCountQuery(filters, userId, userRole) {
    let query = `
      SELECT COUNT(*) as count
      FROM media_files mf
      WHERE mf.deleted_at IS NULL
    `;

    const params = [];
    let paramCount = 1;

    // Role-based access control
    if (userRole === 'creative') {
      query += ` AND mf.uploaded_by = $${paramCount++}`;
      params.push(userId);
    }

    // Apply same filters as media query
    if (filters.search_term) {
      query += ` AND (
        mf.original_filename ILIKE $${paramCount}
        OR mf.description ILIKE $${paramCount}
      )`;
      params.push(`%${filters.search_term}%`);
      paramCount++;
    }

    if (filters.media_types && filters.media_types.length > 0) {
      query += ` AND mf.media_type = ANY($${paramCount++})`;
      params.push(filters.media_types);
    }

    if (filters.editor_ids && filters.editor_ids.length > 0) {
      query += ` AND mf.editor_id = ANY($${paramCount++})`;
      params.push(filters.editor_ids);
    }

    if (filters.buyer_ids && filters.buyer_ids.length > 0) {
      query += ` AND mf.assigned_buyer_id = ANY($${paramCount++})`;
      params.push(filters.buyer_ids);
    }

    if (filters.folder_ids && filters.folder_ids.length > 0) {
      query += ` AND mf.folder_id = ANY($${paramCount++})`;
      params.push(filters.folder_ids);
    }

    if (filters.tags && filters.tags.length > 0) {
      query += ` AND mf.tags && $${paramCount++}`;
      params.push(filters.tags);
    }

    if (filters.date_from) {
      query += ` AND mf.created_at >= $${paramCount++}`;
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      query += ` AND mf.created_at <= $${paramCount++}`;
      params.push(filters.date_to);
    }

    if (filters.file_size_min) {
      query += ` AND mf.file_size >= $${paramCount++}`;
      params.push(filters.file_size_min);
    }

    if (filters.file_size_max) {
      query += ` AND mf.file_size <= $${paramCount++}`;
      params.push(filters.file_size_max);
    }

    if (filters.width_min) {
      query += ` AND mf.width >= $${paramCount++}`;
      params.push(filters.width_min);
    }

    if (filters.width_max) {
      query += ` AND mf.width <= $${paramCount++}`;
      params.push(filters.width_max);
    }

    if (filters.height_min) {
      query += ` AND mf.height >= $${paramCount++}`;
      params.push(filters.height_min);
    }

    if (filters.height_max) {
      query += ` AND mf.height <= $${paramCount++}`;
      params.push(filters.height_max);
    }

    if (filters.is_starred !== undefined) {
      query += ` AND mf.is_starred = $${paramCount++}`;
      params.push(filters.is_starred);
    }

    return { query, params };
  }

  /**
   * Helper: Build filter conditions (for COUNT in getAll)
   */
  buildFilterConditions() {
    // This is a simplified version for counting files
    // In production, you'd want to properly parse and apply ss.filters
    return '';
  }
}

module.exports = new SavedSearchController();
