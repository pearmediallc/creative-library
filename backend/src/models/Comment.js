const BaseModel = require('./BaseModel');

/**
 * Comment Model
 * Handles file comments with threading, mentions, and reactions
 */
class Comment extends BaseModel {
  constructor() {
    super('file_comments');
  }

  /**
   * Create a new comment
   * @param {Object} data - Comment data
   * @returns {Promise<Object>} Created comment
   */
  async createComment(data) {
    const comment = await this.create({
      file_id: data.file_id,
      user_id: data.user_id,
      parent_comment_id: data.parent_comment_id || null,
      content: data.content,
      mentions: JSON.stringify(data.mentions || []),
    });

    // Return with user info
    return this.getCommentById(comment.id);
  }

  /**
   * Get comment by ID with user info
   * @param {string} commentId - Comment ID
   * @returns {Promise<Object>} Comment with user details
   */
  async getCommentById(commentId) {
    const query = `
      SELECT
        c.*,
        u.name as user_name,
        u.email as user_email,
        ru.name as resolved_by_name,
        (
          SELECT json_agg(json_build_object(
            'type', cr.reaction_type,
            'user_id', cr.user_id,
            'user_name', ru.name
          ))
          FROM comment_reactions cr
          LEFT JOIN users ru ON ru.id = cr.user_id
          WHERE cr.comment_id = c.id
        ) as reactions
      FROM file_comments c
      INNER JOIN users u ON u.id = c.user_id
      LEFT JOIN users ru ON ru.id = c.resolved_by
      WHERE c.id = $1 AND c.deleted_at IS NULL
    `;

    const result = await this.query(query, [commentId]);
    return result.rows[0] || null;
  }

  /**
   * Get all comments for a file with threading
   * @param {string} fileId - File ID
   * @param {boolean} includeResolved - Include resolved comments
   * @returns {Promise<Array>} Comments with threading
   */
  async getFileComments(fileId, includeResolved = true) {
    const resolvedFilter = includeResolved ? '' : 'AND c.is_resolved = FALSE';

    const query = `
      SELECT
        c.*,
        u.name as user_name,
        u.email as user_email,
        ru.name as resolved_by_name,
        (
          SELECT json_agg(json_build_object(
            'type', cr.reaction_type,
            'user_id', cr.user_id,
            'user_name', cru.name
          ))
          FROM comment_reactions cr
          LEFT JOIN users cru ON cru.id = cr.user_id
          WHERE cr.comment_id = c.id
        ) as reactions,
        (
          SELECT COUNT(*)::int
          FROM file_comments replies
          WHERE replies.parent_comment_id = c.id AND replies.deleted_at IS NULL
        ) as reply_count
      FROM file_comments c
      INNER JOIN users u ON u.id = c.user_id
      LEFT JOIN users ru ON ru.id = c.resolved_by
      WHERE c.file_id = $1 AND c.deleted_at IS NULL ${resolvedFilter}
      ORDER BY
        CASE WHEN c.parent_comment_id IS NULL THEN c.created_at ELSE NULL END DESC,
        c.created_at ASC
    `;

    const result = await this.query(query, [fileId]);
    return result.rows;
  }

  /**
   * Update comment content
   * @param {string} commentId - Comment ID
   * @param {string} content - New content
   * @param {Array} mentions - Mentioned user IDs
   * @returns {Promise<Object>} Updated comment
   */
  async updateComment(commentId, content, mentions = []) {
    await this.update(commentId, {
      content,
      mentions: JSON.stringify(mentions),
      updated_at: new Date()
    });

    return this.getCommentById(commentId);
  }

  /**
   * Soft delete a comment
   * @param {string} commentId - Comment ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteComment(commentId) {
    await this.update(commentId, {
      deleted_at: new Date()
    });
    return true;
  }

  /**
   * Resolve a comment thread
   * @param {string} commentId - Comment ID
   * @param {string} userId - Resolving user ID
   * @returns {Promise<Object>} Updated comment
   */
  async resolveComment(commentId, userId) {
    await this.update(commentId, {
      is_resolved: true,
      resolved_by: userId,
      resolved_at: new Date()
    });

    return this.getCommentById(commentId);
  }

  /**
   * Unresolve a comment thread
   * @param {string} commentId - Comment ID
   * @returns {Promise<Object>} Updated comment
   */
  async unresolveComment(commentId) {
    await this.update(commentId, {
      is_resolved: false,
      resolved_by: null,
      resolved_at: null
    });

    return this.getCommentById(commentId);
  }

  /**
   * Add reaction to a comment
   * @param {string} commentId - Comment ID
   * @param {string} userId - User ID
   * @param {string} reactionType - Reaction emoji
   * @returns {Promise<Object>} Reaction record
   */
  async addReaction(commentId, userId, reactionType) {
    const query = `
      INSERT INTO comment_reactions (comment_id, user_id, reaction_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (comment_id, user_id, reaction_type) DO NOTHING
      RETURNING *
    `;

    const result = await this.query(query, [commentId, userId, reactionType]);
    return result.rows[0];
  }

  /**
   * Remove reaction from a comment
   * @param {string} commentId - Comment ID
   * @param {string} userId - User ID
   * @param {string} reactionType - Reaction emoji
   * @returns {Promise<boolean>} Success status
   */
  async removeReaction(commentId, userId, reactionType) {
    const query = `
      DELETE FROM comment_reactions
      WHERE comment_id = $1 AND user_id = $2 AND reaction_type = $3
    `;

    await this.query(query, [commentId, userId, reactionType]);
    return true;
  }

  /**
   * Get comment count for a file
   * @param {string} fileId - File ID
   * @returns {Promise<number>} Comment count
   */
  async getCommentCount(fileId) {
    const query = `
      SELECT COUNT(*)::int as count
      FROM file_comments
      WHERE file_id = $1 AND deleted_at IS NULL
    `;

    const result = await this.query(query, [fileId]);
    return result.rows[0].count;
  }

  /**
   * Get comments where user is mentioned
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Comments with mentions
   */
  async getUserMentions(userId) {
    const query = `
      SELECT
        c.*,
        u.name as user_name,
        u.email as user_email,
        mf.filename,
        mf.thumbnail_url
      FROM file_comments c
      INNER JOIN users u ON u.id = c.user_id
      INNER JOIN media_files mf ON mf.id = c.file_id
      WHERE c.mentions::jsonb @> $1::jsonb
        AND c.deleted_at IS NULL
      ORDER BY c.created_at DESC
    `;

    const result = await this.query(query, [JSON.stringify([userId])]);
    return result.rows;
  }
}

module.exports = new Comment();
