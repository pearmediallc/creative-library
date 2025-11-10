/**
 * AllowedEmail Model
 * Manages email whitelist for registration
 */

const BaseModel = require('./BaseModel');

class AllowedEmail extends BaseModel {
  constructor() {
    super('allowed_emails');
  }

  /**
   * Add email to whitelist
   */
  async addEmail({ email, department, job_title, notes, added_by }) {
    return this.create({
      email: email.toLowerCase(),
      department,
      job_title,
      notes,
      added_by,
      is_active: true
    });
  }

  /**
   * Find email in whitelist
   */
  async findByEmail(email) {
    return this.findOne('LOWER(email)', email.toLowerCase());
  }

  /**
   * Get all active whitelisted emails
   */
  async getActiveEmails(limit = 100, offset = 0) {
    return this.findAll({ is_active: true }, 'email ASC', limit, offset);
  }

  /**
   * Deactivate email (soft delete)
   */
  async deactivateEmail(id) {
    return this.update(id, { is_active: false });
  }

  /**
   * Reactivate email
   */
  async reactivateEmail(id) {
    return this.update(id, { is_active: true });
  }

  /**
   * Bulk import emails
   */
  async bulkImport(emails, added_by) {
    const results = {
      success: [],
      failed: [],
      duplicates: []
    };

    for (const emailData of emails) {
      try {
        const existing = await this.findByEmail(emailData.email);

        if (existing) {
          results.duplicates.push(emailData.email);
          continue;
        }

        await this.addEmail({
          email: emailData.email,
          department: emailData.department || null,
          job_title: emailData.job_title || null,
          notes: emailData.notes || null,
          added_by
        });

        results.success.push(emailData.email);
      } catch (error) {
        results.failed.push({
          email: emailData.email,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = new AllowedEmail();
