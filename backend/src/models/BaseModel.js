/**
 * Base Model - Reusable Database Operations
 * All models extend this for consistent CRUD operations
 */

const { query } = require('../config/database');

class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
  }

  /**
   * Find one record by ID
   */
  async findById(id) {
    const result = await query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find one record by field
   */
  async findOne(field, value) {
    const result = await query(
      `SELECT * FROM ${this.tableName} WHERE ${field} = $1`,
      [value]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all with optional conditions
   */
  async findAll(conditions = {}, orderBy = 'created_at DESC', limit = null, offset = 0) {
    const whereClauses = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(conditions).forEach(([key, value]) => {
      whereClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    });

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const limitClause = limit ? `LIMIT ${limit} OFFSET ${offset}` : '';

    const sql = `
      SELECT * FROM ${this.tableName}
      ${whereClause}
      ORDER BY ${orderBy}
      ${limitClause}
    `;

    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * Count records with conditions
   */
  async count(conditions = {}) {
    const whereClauses = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(conditions).forEach(([key, value]) => {
      whereClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    });

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const result = await query(
      `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`,
      values
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Create new record
   */
  async create(data) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map((_, i) => `$${i + 1}`);

    const result = await query(
      `INSERT INTO ${this.tableName} (${fields.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  /**
   * Update record by ID
   */
  async update(id, data) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');

    const result = await query(
      `UPDATE ${this.tableName}
       SET ${setClause}, updated_at = NOW()
       WHERE id = $${fields.length + 1}
       RETURNING *`,
      [...values, id]
    );
    return result.rows[0];
  }

  /**
   * Soft delete (if table has is_deleted column)
   */
  async softDelete(id, deletedBy = null) {
    const result = await query(
      `UPDATE ${this.tableName}
       SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $2
       WHERE id = $1
       RETURNING *`,
      [id, deletedBy]
    );
    return result.rows[0];
  }

  /**
   * Hard delete
   */
  async delete(id) {
    const result = await query(
      `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  /**
   * Custom query helper
   */
  async raw(sql, params = []) {
    const result = await query(sql, params);
    return result.rows;
  }
}

module.exports = BaseModel;
