/**
 * User Model
 * Handles user-specific database operations
 */

const BaseModel = require('./BaseModel');
const bcrypt = require('bcryptjs');

class User extends BaseModel {
  constructor() {
    super('users');
  }

  /**
   * Find user by email
   */
  async findByEmail(email) {
    return this.findOne('email', email);
  }

  /**
   * Create user with hashed password
   */
  async createUser({ name, email, password, role = 'creative' }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    return this.create({
      name,
      email: email.toLowerCase(),
      password_hash: hashedPassword,
      role,
      is_active: true
    });
  }

  /**
   * Verify password
   */
  async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Get active users only
   */
  async getActiveUsers(limit = 50, offset = 0) {
    return this.findAll({ is_active: true }, 'created_at DESC', limit, offset);
  }

  /**
   * Get user with safe fields (no password)
   */
  async getSafeUser(id) {
    const result = await this.raw(
      `SELECT id, name, email, role, upload_limit_monthly, is_active, created_at
       FROM ${this.tableName}
       WHERE id = $1`,
      [id]
    );
    return result[0] || null;
  }

  /**
   * Update user role (admin only)
   */
  async updateRole(id, role) {
    return this.update(id, { role });
  }

  /**
   * Check monthly upload limit
   */
  async hasReachedUploadLimit(userId) {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    const result = await this.raw(
      `SELECT COUNT(*) as count
       FROM upload_tracking
       WHERE user_id = $1 AND upload_month = $2`,
      [userId, currentMonth]
    );

    const user = await this.findById(userId);
    const uploadCount = parseInt(result[0].count);

    return uploadCount >= user.upload_limit_monthly;
  }

  /**
   * Search users by name (for @mentions autocomplete)
   */
  async searchByName(searchTerm) {
    const result = await this.raw(
      `SELECT id, name, email
       FROM ${this.tableName}
       WHERE is_active = true
         AND (name ILIKE $1 OR email ILIKE $1)
       LIMIT 10`,
      [`%${searchTerm}%`]
    );
    return result;
  }
}

module.exports = new User();
