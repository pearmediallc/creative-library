/**
 * Creative Asset Library - Main Server
 * Node.js + Express API Server
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const { connectDatabase } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const mediaRoutes = require('./routes/media');
const editorRoutes = require('./routes/editors');
const analyticsRoutes = require('./routes/analytics');
const adminRoutes = require('./routes/admin');
const facebookRoutes = require('./routes/facebook');
const activityLogRoutes = require('./routes/activityLogs');
const folderRoutes = require('./routes/folders');
const teamRoutes = require('./routes/teams');
const permissionRoutes = require('./routes/permissions');
const starredRoutes = require('./routes/starred');
const commentRoutes = require('./routes/comments');
const savedSearchRoutes = require('./routes/savedSearches');
const fileRequestRoutes = require('./routes/fileRequests');
const metadataTagRoutes = require('./routes/metadataTags');
const metadataRoutes = require('./routes/metadataRoutes');
const slackRoutes = require('./routes/slackRoutes');
const workloadRoutes = require('./routes/workload');
const notificationRoutes = require('./routes/notifications');
const rbacRoutes = require('./routes/rbac');
const accessRequestRoutes = require('./routes/accessRequests');

// Import error handler
const errorHandler = require('./middleware/errorHandler');

// Import cron jobs
const { initializeCronJobs } = require('./jobs');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// MIDDLEWARE
// ============================================

// Trust proxy (required for Render)
app.set('trust proxy', 1);

// Security
app.use(helmet());

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:3000'];
logger.info(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);

app.use(cors({
  origin: (origin, callback) => {
    // REMOVED: Excessive debug logging that clutters output
    // Only log blocked origins for security monitoring
    // This was logging every single request causing noise in logs

    // Allow requests with no origin (like mobile apps, Postman, or same-origin)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Log rejection
    logger.warn(`CORS blocked origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// REMOVED: Request logging middleware
// This was logging every single request (GET, POST, etc.) causing excessive log clutter
// Only important events (errors, security warnings, critical operations) are now logged
// For detailed debugging, enable via environment variable if needed

// ============================================
// ROUTES
// ============================================

app.get('/', (req, res) => {
  res.json({
    name: 'Creative Asset Library API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    database: 'connected', // TODO: actual health check
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/editors', editorRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/facebook', facebookRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/starred', starredRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/saved-searches', savedSearchRoutes);
app.use('/api/file-requests', fileRequestRoutes);
app.use('/api/metadata-tags', metadataTagRoutes);
app.use('/api/metadata', metadataRoutes);
app.use('/api/slack', slackRoutes);
app.use('/api/workload', workloadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/rbac', rbacRoutes);
app.use('/api/access-requests', accessRequestRoutes);

// Log registered routes
logger.info('API routes registered: /api/auth, /api/media, /api/editors, /api/analytics, /api/admin, /api/facebook, /api/activity-logs, /api/folders, /api/teams, /api/permissions, /api/starred, /api/comments, /api/saved-searches, /api/file-requests, /api/metadata-tags, /api/slack, /api/workload, /api/notifications, /api/rbac, /api/access-requests');

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Error handler (must be last)
app.use(errorHandler);

// ============================================
// SERVER STARTUP
// ============================================

async function startServer() {
  try {
    // Connect to database
    logger.info('Connecting to database...');
    await connectDatabase();
    logger.info('✅ Database connected');

    // Initialize cron jobs
    if (process.env.ENABLE_CRON_JOBS === 'true') {
      logger.info('Initializing cron jobs...');
      initializeCronJobs();
      logger.info('✅ Cron jobs initialized');
    }

    // Start server
    app.listen(PORT, () => {
      logger.info('='.repeat(70));
      logger.info('🚀 CREATIVE ASSET LIBRARY - SERVER RUNNING');
      logger.info('='.repeat(70));
      logger.info(`📍 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🌐 Server: http://localhost:${PORT}`);
      logger.info(`📊 API: http://localhost:${PORT}/api`);
      logger.info(`🔧 Health: http://localhost:${PORT}/health`);
      logger.info(`📘 Facebook API: Direct Graph API v18.0`);
      logger.info('='.repeat(70));
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;
