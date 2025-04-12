import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import { ProxyManager } from '../../core/proxy/proxy-manager.js';
import { ProxyOptions } from '../../types/index.js'; // Added import
const proxyManager = ProxyManager.getInstance();
import { validateProxyInput } from '../validators/proxy.validator.js';

const router = Router();

/**
 * @route   GET /api/v1/proxy/list
 * @desc    Get list of all available proxies with filtering/sorting
 * @query   type - Filter by protocol (http, https, socks4, socks5)
 * @query   country - Filter by country code
 * @query   city - Filter by city
 * @query   region - Filter by region
 * @query   asn - Filter by ASN
 * @query   anonymityLevel - Filter by anonymity level
 * @query   minSpeed - Filter by minimum speed
 * @query   maxLatency - Filter by maximum latency
 * @query   minUpTime - Filter by minimum uptime percentage
 * @query   minSuccessRate - Filter by minimum internal success rate
 * @access  Public
 */
router.get(
  '/list',
  asyncHandler(async (req, res) => {
    try {
      // Extract and cast query parameters safely
      const filters = {
        country: req.query.country as string | undefined,
        city: req.query.city as string | undefined,
        region: req.query.region as string | undefined,
        asn: req.query.asn as string | undefined,
        type: req.query.type as 'http' | 'https' | 'socks4' | 'socks5' | undefined,
        anonymityLevel: req.query.anonymityLevel as string | undefined,
        minSpeed: req.query.minSpeed ? Number(req.query.minSpeed) : undefined,
        maxLatency: req.query.maxLatency ? Number(req.query.maxLatency) : undefined,
        minUpTime: req.query.minUpTime ? Number(req.query.minUpTime) : undefined,
        minSuccessRate: req.query.minSuccessRate ? Number(req.query.minSuccessRate) : undefined,
      };

      // Remove undefined filters
      Object.keys(filters).forEach(
        key =>
          filters[key as keyof typeof filters] === undefined &&
          delete filters[key as keyof typeof filters]
      );

      const proxies = await proxyManager.listProxies(filters);
      res.status(200).json({
        success: true,
        count: proxies.length,
        proxies, // Return the full proxy info objects
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
 * @route   GET /api/v1/proxy/stats
 * @desc    Get statistics about available proxies
 * @access  Public
 */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    try {
      const stats = await proxyManager.getProxyStats();
      res.status(200).json({
        success: true,
        message: 'Proxy statistics retrieved successfully', // Added message
        data: {
          total: stats.total,
          healthy: stats.healthy, // Add healthy count
          byProtocol: stats.byProtocol, // Corrected property name
          byCountry: stats.byCountry,
          byAnonymity: stats.byAnonymity,
          avgLatency: stats.avgLatency,
          avgInternalResponseTime: stats.avgResponseTime, // Clarify this is internal EMA
          avgUpTime: stats.avgUpTime, // This is from source JSON
          // avgSpeed is not available in stats
        },
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
 * @desc    Rotate to a new proxy with optional targeting
 * @body    type - Preferred protocol (http, https, socks4, socks5)
 * @body    country - Target country code
 * @body    city - Target city
 * @body    region - Target region
 * @body    asn - Target ASN
 * @body    anonymityLevel - Target anonymity level
 * @body    minSpeed - Minimum speed requirement
 * @body    maxLatency - Maximum allowed latency (from source)
 * @body    minUpTime - Minimum uptime percentage (from source)
 * @body    minSuccessRate - Minimum internal success rate
 * @access  Public
 */
router.post(
  '/rotate',
  asyncHandler(async (req, res) => {
    try {
      // Construct options, ensuring correct types
      const options: ProxyOptions = {
        ...req.body, // Spread body first
        // Explicitly handle potential number conversions
        minSpeed: req.body.minSpeed ? Number(req.body.minSpeed) : undefined,
        maxLatency: req.body.maxLatency ? Number(req.body.maxLatency) : undefined,
        minUpTime: req.body.minUpTime ? Number(req.body.minUpTime) : undefined,
        minSuccessRate: req.body.minSuccessRate ? Number(req.body.minSuccessRate) : undefined,
        // Ensure type is correctly typed if provided
        type: req.body.type as 'http' | 'https' | 'socks4' | 'socks5' | undefined,
      };
      // Remove undefined options potentially spread from body
      Object.keys(options).forEach(
        key =>
          options[key as keyof typeof options] === undefined &&
          delete options[key as keyof typeof options]
      );

      const proxy = await proxyManager.rotateProxy(options);

      if (!proxy) {
        // Handle case where no suitable proxy is found
        return res.status(404).json({
          success: false,
          message: 'No suitable proxy found for the given criteria.',
          error: 'Proxy rotation failed',
        });
      }

      // Return relevant info from the selected proxy
      res.status(200).json({
        success: true,
        message: 'Proxy rotated successfully', // Added message
        data: {
          ip: proxy.ip,
          port: proxy.port,
          protocols: proxy.protocols,
          country: proxy.country,
          city: proxy.city,
          latency: proxy.latency, // Latency from source
          responseTime: proxy.responseTime, // Internal EMA response time
          upTime: proxy.upTime, // Uptime from source
          anonymityLevel: proxy.anonymityLevel,
          isp: proxy.isp,
        },
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
 * @route   POST /api/v1/proxy/clean
 * @desc    Clean the proxy list by removing invalid proxies based on internal success rate
 * @access  Public
 */
router.post(
  '/clean',
  asyncHandler(async (req, res) => {
    try {
      // Use correct property names from cleanProxyList result
      const { removedCount, remainingCount } = await proxyManager.cleanProxyList();
      res.status(200).json({
        success: true,
        message: 'Proxy list cleaned based on internal success rate', // Clarified message
        removedCount, // Use correct name
        remainingCount, // Use correct name
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
