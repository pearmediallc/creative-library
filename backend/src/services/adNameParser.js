const Editor = require('../models/Editor');
const logger = require('../utils/logger');

/**
 * Ad Name Parser Service
 * Extracts editor name from Facebook ad names
 * Format: [REVIEW] Campaign - EDITOR - Ad 1
 */
class AdNameParser {
  constructor() {
    // Cache of editor names for fast lookup
    this.editorNamesCache = null;
    this.cacheLastUpdated = null;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Load editor names into cache
   * @private
   */
  async _loadEditorCache() {
    const now = Date.now();

    // Check if cache is still valid
    if (this.editorNamesCache && this.cacheLastUpdated &&
        (now - this.cacheLastUpdated) < this.CACHE_DURATION) {
      return;
    }

    try {
      const editors = await Editor.getActiveEditors();
      this.editorNamesCache = editors.map(e => ({
        id: e.id,
        name: e.name.toUpperCase(),
        display_name: e.display_name
      }));
      this.cacheLastUpdated = now;

      logger.info('Editor cache refreshed', { count: this.editorNamesCache.length });
    } catch (error) {
      logger.error('Failed to load editor cache', { error: error.message });
      // Keep old cache if refresh fails
    }
  }

  /**
   * Extract editor name from ad name
   * @param {string} adName - Facebook ad name
   * @returns {Promise<Object|null>} { editor_id, editor_name } or null
   */
  async extractEditorFromAdName(adName) {
    if (!adName || typeof adName !== 'string') {
      return null;
    }

    // Load/refresh editor cache
    await this._loadEditorCache();

    if (!this.editorNamesCache || this.editorNamesCache.length === 0) {
      logger.warn('Editor cache is empty');
      return null;
    }

    // Clean ad name: uppercase and trim
    const cleanAdName = adName.toUpperCase().trim();

    // Try multiple patterns
    const patterns = [
      // Pattern 1: [REVIEW] Campaign - EDITOR - Ad 1
      /\s-\s([A-Z]+(?:VERMA)?)\s-\s/,

      // Pattern 2: Campaign - EDITOR - Ad 1 (without [REVIEW])
      /-\s([A-Z]+(?:VERMA)?)\s-/,

      // Pattern 3: EDITOR in parentheses: Campaign (EDITOR)
      /\(([A-Z]+(?:VERMA)?)\)/,

      // Pattern 4: EDITOR at the end: Campaign - EDITOR
      /-\s([A-Z]+(?:VERMA)?)$/,

      // Pattern 5: EDITOR at the start: EDITOR - Campaign
      /^([A-Z]+(?:VERMA)?)\s-/
    ];

    for (const pattern of patterns) {
      const match = cleanAdName.match(pattern);
      if (match && match[1]) {
        const extractedName = match[1].trim();

        // Find matching editor in cache
        const editor = this.editorNamesCache.find(e =>
          e.name === extractedName
        );

        if (editor) {
          logger.debug('Editor extracted from ad name', {
            adName,
            extractedName,
            editorId: editor.id
          });

          return {
            editor_id: editor.id,
            editor_name: editor.name
          };
        }
      }
    }

    // No match found
    logger.debug('No editor found in ad name', { adName });
    return null;
  }

  /**
   * Extract editor from multiple ad names (batch)
   * @param {Array<string>} adNames - Array of ad names
   * @returns {Promise<Map>} Map of adName -> { editor_id, editor_name }
   */
  async extractEditorsFromAdNames(adNames) {
    const results = new Map();

    for (const adName of adNames) {
      const result = await this.extractEditorFromAdName(adName);
      results.set(adName, result);
    }

    return results;
  }

  /**
   * Validate ad name format
   * @param {string} adName - Ad name to validate
   * @returns {Object} { valid: boolean, suggestions?: string[] }
   */
  validateAdNameFormat(adName) {
    if (!adName || typeof adName !== 'string') {
      return {
        valid: false,
        suggestions: ['Ad name is required']
      };
    }

    const suggestions = [];

    // Check for hyphen separators
    if (!adName.includes('-')) {
      suggestions.push('Use hyphens (-) to separate sections');
    }

    // Check for editor name presence
    const hasEditorPattern = /[A-Z]{4,}/i.test(adName);
    if (!hasEditorPattern) {
      suggestions.push('Include editor name in UPPERCASE (e.g., DEEP, DEEPA, DEEPANSHU)');
    }

    // Check recommended format
    const recommendedPattern = /\[.+\].+-.+-.+/;
    if (!recommendedPattern.test(adName)) {
      suggestions.push('Recommended format: [REVIEW] Campaign - EDITOR - Ad 1');
    }

    return {
      valid: suggestions.length === 0,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
  }

  /**
   * Get all available editor names
   * @returns {Promise<Array>} Array of editor names
   */
  async getAvailableEditorNames() {
    await this._loadEditorCache();
    return this.editorNamesCache.map(e => ({
      id: e.id,
      name: e.name,
      display_name: e.display_name
    }));
  }

  /**
   * Clear editor cache (for testing or manual refresh)
   */
  clearCache() {
    this.editorNamesCache = null;
    this.cacheLastUpdated = null;
    logger.info('Editor cache cleared');
  }
}

module.exports = new AdNameParser();
