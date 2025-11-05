/**
 * Validation Middleware
 * Reusable validation using Joi
 */

const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Generic validation middleware
 */
function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Validation failed', { errors, path: req.path });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }

    // Replace req[property] with validated & sanitized value
    req[property] = value;
    next();
  };
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

const schemas = {
  // Auth
  register: Joi.object({
    name: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(100).required(),
    role: Joi.string().valid('admin', 'creative', 'buyer').default('creative')
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  // Media Upload
  mediaUpload: Joi.object({
    editor_id: Joi.string().uuid().required(),
    tags: Joi.alternatives().try(
      Joi.array().items(Joi.string().max(50)).max(10),
      Joi.string().allow('', null)
    ).default([]),
    description: Joi.string().max(500).allow('', null),
    campaign_hint: Joi.string().max(255).allow('', null)
  }),

  // Media Filter
  mediaFilter: Joi.object({
    editor_id: Joi.string().uuid(),
    editor_name: Joi.string().max(255),
    date_from: Joi.date().iso(),
    date_to: Joi.date().iso(),
    file_type: Joi.string().valid('image', 'video'),
    tags: Joi.string(), // Comma-separated
    search: Joi.string().max(255),
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0)
  }),

  // Update Media
  mediaUpdate: Joi.object({
    tags: Joi.array().items(Joi.string().max(50)).max(10),
    description: Joi.string().max(500).allow('', null),
    editor_id: Joi.string().uuid()
  }),

  // User Management (Admin)
  createUser: Joi.object({
    name: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(100).required(),
    role: Joi.string().valid('admin', 'creative', 'buyer').required(),
    upload_limit_monthly: Joi.number().integer().min(0).max(10000).default(100)
  }),

  updateUser: Joi.object({
    name: Joi.string().min(2).max(255),
    role: Joi.string().valid('admin', 'creative', 'buyer'),
    upload_limit_monthly: Joi.number().integer().min(0).max(10000),
    is_active: Joi.boolean()
  }),

  // Editor Management
  createEditor: Joi.object({
    name: Joi.string().min(2).max(255).required(),
    display_name: Joi.string().max(255).allow('', null)
  }),

  updateEditor: Joi.object({
    name: Joi.string().min(2).max(255),
    display_name: Joi.string().max(255).allow('', null),
    is_active: Joi.boolean()
  })
};

module.exports = {
  validate,
  schemas
};
