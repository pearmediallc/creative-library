const Comment = require('../models/Comment');
const MediaFile = require('../models/MediaFile');
const User = require('../models/User');
const logger = require('../utils/logger');

class CommentController {
  /**
   * Create a new comment
   * POST /api/comments
   */
  async createComment(req, res, next) {
    try {
      const { file_id, content, parent_comment_id } = req.body;
      const userId = req.user.id;

      // Validation
      if (!file_id || !content?.trim()) {
        return res.status(400).json({
          success: false,
          error: 'File ID and content are required'
        });
      }

      // Verify file exists
      const file = await MediaFile.findById(file_id);
      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      // If it's a reply, verify parent comment exists
      if (parent_comment_id) {
        const parentComment = await Comment.findById(parent_comment_id);
        if (!parentComment) {
          return res.status(404).json({
            success: false,
            error: 'Parent comment not found'
          });
        }
      }

      // Extract mentions from content (@username or @email)
      const mentions = await this.extractMentions(content);

      // Create comment
      const comment = await Comment.createComment({
        file_id,
        user_id: userId,
        parent_comment_id,
        content,
        mentions
      });

      // TODO: Create notifications for mentioned users
      // This would be implemented when notification system is added

      logger.info('Comment created', {
        commentId: comment.id,
        fileId: file_id,
        userId,
        mentionCount: mentions.length
      });

      res.status(201).json({
        success: true,
        data: comment
      });
    } catch (error) {
      logger.error('Create comment failed', {
        error: error.message,
        userId: req.user?.id
      });
      next(error);
    }
  }

  /**
   * Get comments for a file
   * GET /api/comments?file_id=xxx&include_resolved=true
   */
  async getComments(req, res, next) {
    try {
      const { file_id, include_resolved = 'true' } = req.query;

      if (!file_id) {
        return res.status(400).json({
          success: false,
          error: 'File ID is required'
        });
      }

      // Verify file exists
      const file = await MediaFile.findById(file_id);
      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      const includeResolved = include_resolved === 'true';
      const comments = await Comment.getFileComments(file_id, includeResolved);

      // Organize into threads (parent comments with their replies)
      const threads = this.organizeThreads(comments);

      res.json({
        success: true,
        data: threads,
        count: comments.length
      });
    } catch (error) {
      logger.error('Get comments failed', {
        error: error.message,
        fileId: req.query.file_id
      });
      next(error);
    }
  }

  /**
   * Update a comment
   * PATCH /api/comments/:id
   */
  async updateComment(req, res, next) {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = req.user.id;

      if (!content?.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Content is required'
        });
      }

      // Get comment
      const comment = await Comment.findById(id);
      if (!comment) {
        return res.status(404).json({
          success: false,
          error: 'Comment not found'
        });
      }

      // Check permission (only author or admin can edit)
      if (comment.user_id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'You can only edit your own comments'
        });
      }

      // Extract new mentions
      const mentions = await this.extractMentions(content);

      // Update comment
      const updatedComment = await Comment.updateComment(id, content, mentions);

      logger.info('Comment updated', {
        commentId: id,
        userId
      });

      res.json({
        success: true,
        data: updatedComment
      });
    } catch (error) {
      logger.error('Update comment failed', {
        error: error.message,
        commentId: req.params.id
      });
      next(error);
    }
  }

  /**
   * Delete a comment (soft delete)
   * DELETE /api/comments/:id
   */
  async deleteComment(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Get comment
      const comment = await Comment.findById(id);
      if (!comment) {
        return res.status(404).json({
          success: false,
          error: 'Comment not found'
        });
      }

      // Check permission (only author or admin can delete)
      if (comment.user_id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'You can only delete your own comments'
        });
      }

      await Comment.deleteComment(id);

      logger.info('Comment deleted', {
        commentId: id,
        userId
      });

      res.json({
        success: true,
        message: 'Comment deleted successfully'
      });
    } catch (error) {
      logger.error('Delete comment failed', {
        error: error.message,
        commentId: req.params.id
      });
      next(error);
    }
  }

  /**
   * Toggle comment resolution
   * POST /api/comments/:id/resolve
   */
  async toggleResolve(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Get comment
      const comment = await Comment.findById(id);
      if (!comment) {
        return res.status(404).json({
          success: false,
          error: 'Comment not found'
        });
      }

      // Toggle resolution
      let updatedComment;
      if (comment.is_resolved) {
        updatedComment = await Comment.unresolveComment(id);
      } else {
        updatedComment = await Comment.resolveComment(id, userId);
      }

      logger.info('Comment resolution toggled', {
        commentId: id,
        userId,
        resolved: !comment.is_resolved
      });

      res.json({
        success: true,
        data: updatedComment
      });
    } catch (error) {
      logger.error('Toggle resolve failed', {
        error: error.message,
        commentId: req.params.id
      });
      next(error);
    }
  }

  /**
   * Add reaction to a comment
   * POST /api/comments/:id/reactions
   */
  async addReaction(req, res, next) {
    try {
      const { id } = req.params;
      const { reaction_type } = req.body;
      const userId = req.user.id;

      // Validate reaction type
      const validReactions = ['👍', '❤️', '😂', '😮', '👏'];
      if (!validReactions.includes(reaction_type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid reaction type'
        });
      }

      // Verify comment exists
      const comment = await Comment.findById(id);
      if (!comment) {
        return res.status(404).json({
          success: false,
          error: 'Comment not found'
        });
      }

      await Comment.addReaction(id, userId, reaction_type);

      // Get updated comment with reactions
      const updatedComment = await Comment.getCommentById(id);

      logger.info('Reaction added', {
        commentId: id,
        userId,
        reactionType: reaction_type
      });

      res.json({
        success: true,
        data: updatedComment
      });
    } catch (error) {
      logger.error('Add reaction failed', {
        error: error.message,
        commentId: req.params.id
      });
      next(error);
    }
  }

  /**
   * Remove reaction from a comment
   * DELETE /api/comments/:id/reactions/:type
   */
  async removeReaction(req, res, next) {
    try {
      const { id, type } = req.params;
      const userId = req.user.id;

      // Verify comment exists
      const comment = await Comment.findById(id);
      if (!comment) {
        return res.status(404).json({
          success: false,
          error: 'Comment not found'
        });
      }

      await Comment.removeReaction(id, userId, type);

      // Get updated comment with reactions
      const updatedComment = await Comment.getCommentById(id);

      logger.info('Reaction removed', {
        commentId: id,
        userId,
        reactionType: type
      });

      res.json({
        success: true,
        data: updatedComment
      });
    } catch (error) {
      logger.error('Remove reaction failed', {
        error: error.message,
        commentId: req.params.id
      });
      next(error);
    }
  }

  /**
   * Extract @mentions from comment content
   * @param {string} content - Comment content
   * @returns {Promise<Array>} Array of mentioned user IDs
   */
  async extractMentions(content) {
    // Match @username or @email patterns
    const mentionPattern = /@(\w+(?:\.\w+)*@?\w*\.?\w*)/g;
    const matches = [...content.matchAll(mentionPattern)];

    if (matches.length === 0) return [];

    const mentionIdentifiers = matches.map(m => m[1]);
    const mentions = [];

    // Look up users by name or email
    for (const identifier of mentionIdentifiers) {
      try {
        let user;
        if (identifier.includes('@')) {
          // Email mention
          user = await User.findByEmail(identifier);
        } else {
          // Name mention - search users
          const users = await User.searchByName(identifier);
          user = users.length > 0 ? users[0] : null;
        }

        if (user && !mentions.includes(user.id)) {
          mentions.push(user.id);
        }
      } catch (err) {
        logger.warn('Failed to resolve mention', { identifier, error: err.message });
      }
    }

    return mentions;
  }

  /**
   * Organize flat comments into threaded structure
   * @param {Array} comments - Flat array of comments
   * @returns {Array} Threaded comments
   */
  organizeThreads(comments) {
    const threads = [];
    const repliesMap = {};

    // Separate parent comments and replies
    comments.forEach(comment => {
      if (!comment.parent_comment_id) {
        threads.push({
          ...comment,
          replies: []
        });
      } else {
        if (!repliesMap[comment.parent_comment_id]) {
          repliesMap[comment.parent_comment_id] = [];
        }
        repliesMap[comment.parent_comment_id].push(comment);
      }
    });

    // Attach replies to parent comments
    threads.forEach(thread => {
      if (repliesMap[thread.id]) {
        thread.replies = repliesMap[thread.id];
      }
    });

    return threads;
  }
}

module.exports = new CommentController();
