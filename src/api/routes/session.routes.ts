import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import { SessionManager } from '../../core/session/session-manager.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import { validateCreateSession } from '../validators/session.validator.js';

const router = Router();
const sessionManager = SessionManager.getInstance();

/**
 * @route   POST /api/v1/sessions
 * @desc    Create a new session
 * @access  Public
 */
router.post(
  '/',
  validateCreateSession,
  asyncHandler(async (req, res) => {
    try {
      // Check if sessions are enabled
      if (!config.browser.session?.enabled) {
        return res.status(400).json({
          success: false,
          message: 'Session management is disabled',
          error: 'Sessions are not enabled in the configuration',
          timestamp: new Date().toISOString(),
        });
      }

      const { adapter, ttl, browser } = req.body;

      // Create new session
      const session = await sessionManager.createSession({
        adapter,
        ttl,
        browserOptions: browser,
      });

      // Return the created session
      return res.status(201).json({
        success: true,
        message: 'Session created successfully',
        data: session,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error(`Error creating session: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to create session',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  })
);

// Initialize session manager
(async () => {
  try {
    await sessionManager.initialize();
    logger.info('Session manager initialized for session routes');
  } catch (error: any) {
    logger.error(`Error initializing session manager: ${error.message}`);
  }
})();

/**
 * @route   GET /api/v1/sessions
 * @desc    Get all sessions
 * @access  Public
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    try {
      // Check if sessions are enabled
      if (!config.browser.session?.enabled) {
        return res.status(400).json({
          success: false,
          message: 'Session management is disabled',
          error: 'Sessions are not enabled in the configuration',
          timestamp: new Date().toISOString(),
        });
      }

      // Get all sessions
      const sessions = await sessionManager.getAllSessions();

      // Return the sessions
      return res.status(200).json({
        success: true,
        message: 'Sessions retrieved successfully',
        data: sessions,
        count: sessions.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error(`Error retrieving sessions: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve sessions',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  })
);

/**
 * @route   GET /api/v1/sessions/:id
 * @desc    Get a session by ID
 * @access  Public
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    try {
      const sessionId = req.params.id;

      // Check if sessions are enabled
      if (!config.browser.session?.enabled) {
        return res.status(400).json({
          success: false,
          message: 'Session management is disabled',
          error: 'Sessions are not enabled in the configuration',
          timestamp: new Date().toISOString(),
        });
      }

      // Get the session by ID
      const session = await sessionManager.getSession(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found',
          error: `Session ${sessionId} does not exist`,
          timestamp: new Date().toISOString(),
        });
      }

      // Return the session
      return res.status(200).json({
        success: true,
        message: 'Session retrieved successfully',
        data: session,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error(`Error retrieving session: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve session',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  })
);

/**
 * @route   DELETE /api/v1/sessions/:id
 * @desc    Delete a session by ID
 * @access  Public
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    try {
      const sessionId = req.params.id;

      // Check if sessions are enabled
      if (!config.browser.session?.enabled) {
        return res.status(400).json({
          success: false,
          message: 'Session management is disabled',
          error: 'Sessions are not enabled in the configuration',
          timestamp: new Date().toISOString(),
        });
      }

      // Delete the session
      await sessionManager.deleteSession(sessionId);

      // Return success
      return res.status(200).json({
        success: true,
        message: `Session ${sessionId} deleted successfully`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error(`Error deleting session: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete session',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  })
);

/**
 * @route   DELETE /api/v1/sessions
 * @desc    Clear all sessions
 * @access  Public
 */
router.delete(
  '/',
  asyncHandler(async (req, res) => {
    try {
      // Check if sessions are enabled
      if (!config.browser.session?.enabled) {
        return res.status(400).json({
          success: false,
          message: 'Session management is disabled',
          error: 'Sessions are not enabled in the configuration',
          timestamp: new Date().toISOString(),
        });
      }

      // Clear all sessions
      await sessionManager.clearSessions();

      // Return success
      return res.status(200).json({
        success: true,
        message: 'All sessions cleared successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error(`Error clearing sessions: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to clear sessions',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  })
);

export const sessionRoutes = router;
