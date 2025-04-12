import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import { ProxyManager } from '../../core/proxy/proxy-manager.js';
const proxyManager = ProxyManager.getInstance();
import { validateProxyInput } from '../validators/proxy.validator.js';

const router = Router();

/**
 * @route   GET /api/v1/proxy/list
 * @desc    Get list of all available proxies
 * @access  Public
 */
router.get(
  '/list',
  asyncHandler(async (req, res) => {
    try {
      const proxies = await proxyManager.listProxies();
      res.status(200).json({
        success: true,
        count: proxies.length,
        proxies,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        message: 'Failed to get proxy list',
        error: errorMessage,
      });
    }
  })
);

/**
 * @route   GET /api/v1/proxy
 * @desc    Get proxy status and statistics
 * @access  Public
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    try {
      const stats = proxyManager.getProxyStats();
      res.status(200).json({
        success: true,
        message: 'Proxy statistics',
        data: stats,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        message: 'Failed to get proxy stats',
        error: errorMessage,
      });
    }
  })
);

/**
 * @route   POST /api/v1/proxy/test
 * @desc    Test a specific proxy
 * @access  Public
 */
router.post(
  '/test',
  asyncHandler(async (req, res) => {
    try {
      const { error } = validateProxyInput(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          error: error.details[0].message,
        });
      }

      const result = await proxyManager.testProxy(req.body);
      res.status(200).json({
        success: true,
        message: 'Proxy test completed',
        data: result,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        message: 'Failed to test proxy',
        error: errorMessage,
      });
    }
  })
);

/**
 * @route   POST /api/v1/proxy/rotate
 * @desc    Rotate to a new proxy
 * @access  Public
 */
router.post(
  '/rotate',
  asyncHandler(async (req, res) => {
    try {
      const proxy = await proxyManager.rotateProxy(req.body);
      res.status(200).json({
        success: true,
        message: 'Proxy rotated successfully',
        data: proxy,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        message: 'Failed to rotate proxy',
        error: errorMessage,
      });
    }
  })
);

/**
 * @route   POST /api/v1/proxy/validate
 * @desc    Validate all proxies in the list
 * @access  Public
 */
router.post(
  '/validate',
  asyncHandler(async (req, res) => {
    try {
      const results = await proxyManager.validateAllProxies();
      res.status(200).json({
        success: true,
        message: 'Proxy validation completed',
        results,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        message: 'Failed to validate proxies',
        error: errorMessage,
      });
    }
  })
);

/**
 * @route   POST /api/v1/proxy/clean
 * @desc    Clean the proxy list by removing invalid proxies
 * @access  Public
 */
router.post(
  '/clean',
  asyncHandler(async (req, res) => {
    try {
      const { removed, remaining } = await proxyManager.cleanProxyList();
      res.status(200).json({
        success: true,
        message: 'Proxy list cleaned',
        removed,
        remaining,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        message: 'Failed to clean proxies',
        error: errorMessage,
      });
    }
  })
);

export const proxyRoutes = router;
