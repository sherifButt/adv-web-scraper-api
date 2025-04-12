import axios from 'axios';
import fs from 'fs/promises';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import { ProxyInfo, ProxyOptions } from '../../types/index.js';

/**
 * Manages a pool of proxies with health checking and rotation
 */
export class ProxyManager {
  private static instance: ProxyManager;
  private proxies: ProxyInfo[] = [];
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastProxyIndex = -1;
  private sessionProxies: Map<string, ProxyInfo> = new Map();

  /**
   * List all available proxies with optional filtering
   */
  public listProxies(filters?: {
    country?: string;
    city?: string;
    region?: string;
    asn?: string;
    type?: 'http' | 'https' | 'socks4' | 'socks5';
    anonymityLevel?: string;
    minSpeed?: number;
    maxLatency?: number;
    minUpTime?: number;
    minSuccessRate?: number;
  }): ProxyInfo[] {
    let filteredProxies = [...this.proxies];

    if (filters) {
      filteredProxies = filteredProxies.filter(proxy => {
        if (filters.country && proxy.country !== filters.country) return false;
        if (filters.city && proxy.city !== filters.city) return false;
        if (filters.region && proxy.region !== filters.region) return false;
        if (filters.asn && proxy.asn !== filters.asn) return false;
        if (filters.type && !proxy.protocols?.includes(filters.type)) return false;
        if (filters.anonymityLevel && proxy.anonymityLevel !== filters.anonymityLevel) return false;
        if (filters.minSpeed && (proxy.speed || 0) < filters.minSpeed) return false;
        if (filters.maxLatency && (proxy.latency || Infinity) > filters.maxLatency) return false;
        if (filters.minUpTime && (proxy.upTime || 0) < filters.minUpTime) return false;
        if (filters.minSuccessRate && (proxy.successRate || 0) < filters.minSuccessRate)
          return false;
        return true;
      });
    }

    return filteredProxies;
  }

  /**
   * Get detailed proxy statistics
   */
  public getProxyStats(): {
    total: number;
    healthy?: number; // Make healthy optional as it depends on getHealthyProxyCount
    byProtocol: Record<string, number>;
    byCountry: Record<string, number>;
    byAnonymity: Record<string, number>;
    avgLatency: number;
    avgResponseTime: number; // This is the internal EMA response time
    avgUpTime: number; // This is the average uptime from the source JSON
  } {
    const byProtocol: Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    const byAnonymity: Record<string, number> = {};
    let totalLatency = 0;
    let totalResponseTime = 0;
    let totalUpTime = 0;
    let count = 0;

    this.proxies.forEach(proxy => {
      // Count by protocol
      proxy.protocols?.forEach(protocol => {
        byProtocol[protocol] = (byProtocol[protocol] || 0) + 1;
      });

      // Count by country
      if (proxy.country) {
        byCountry[proxy.country] = (byCountry[proxy.country] || 0) + 1;
      }

      // Count by anonymity
      if (proxy.anonymityLevel) {
        byAnonymity[proxy.anonymityLevel] = (byAnonymity[proxy.anonymityLevel] || 0) + 1;
      }

      // Sum metrics
      if (proxy.latency) totalLatency += proxy.latency;
      if (proxy.responseTime) totalResponseTime += proxy.responseTime;
      if (proxy.upTime) totalUpTime += proxy.upTime;
      count++;
    });

    // Calculate healthy count based on internal success rate
    const healthyCount = this.getHealthyProxyCount();

    return {
      total: this.proxies.length,
      healthy: healthyCount,
      byProtocol,
      byCountry,
      byAnonymity,
      avgLatency: count > 0 ? totalLatency / count : 0,
      avgResponseTime: count > 0 ? totalResponseTime / count : 0,
      avgUpTime: count > 0 ? totalUpTime / count : 0,
    };
  }

  /**
   * Get the next available proxy based on options and rotation strategy
   */
  public async getProxy(options: ProxyOptions = {}): Promise<ProxyInfo | null> {
    // If no proxies are available, try to load them
    if (this.proxies.length === 0) {
      await this.loadProxies();
      if (this.proxies.length === 0) {
        logger.warn('No proxies available');
        return null;
      }
    }

    // If a session is specified, check if we have a proxy for it
    if (options.session) {
      const sessionProxy = this.sessionProxies.get(options.session);
      if (sessionProxy) {
        // Optionally re-validate session proxy health here if needed
        logger.debug(
          `Reusing proxy ${sessionProxy.ip}:${sessionProxy.port} for session ${options.session}`
        );
        return sessionProxy;
      }
    }

    // Filter proxies based on options
    let availableProxies = this.proxies.filter(proxy => {
      // Filter by country if specified
      if (options.country && proxy.country !== options.country) {
        return false;
      }
      // Filter by city
      if (options.city && proxy.city !== options.city) {
        return false;
      }
      // Filter by region
      if (options.region && proxy.region !== options.region) {
        return false;
      }
      // Filter by ASN
      if (options.asn && proxy.asn !== options.asn) {
        return false;
      }
      // Filter by protocol type if specified
      if (options.type && !proxy.protocols?.includes(options.type)) {
        return false;
      }
      // Filter by anonymity level
      if (options.anonymityLevel && proxy.anonymityLevel !== options.anonymityLevel) {
        return false;
      }
      // Filter by min speed
      if (options.minSpeed && (proxy.speed || 0) < options.minSpeed) {
        return false;
      }
      // Filter by max latency
      if (options.maxLatency && (proxy.latency || Infinity) > options.maxLatency) {
        return false;
      }
      // Filter by min uptime
      if (options.minUpTime && (proxy.upTime || 0) < options.minUpTime) {
        return false;
      }
      // Filter by min success rate (internal metric)
      if (options.minSuccessRate && (proxy.successRate || 0) < options.minSuccessRate) {
        return false;
      }
      // Only use proxies with a reasonable internal success rate (e.g., > 50%)
      if (proxy.successRate !== undefined && proxy.successRate < 0.5) {
        // Keep internal check
        return false;
      }

      return true;
    });

    // If no proxies match the criteria, log a warning but continue with the full list
    if (availableProxies.length === 0) {
      logger.warn(
        `No proxies matched the specified criteria: ${JSON.stringify(
          options
        )}. Falling back to all available proxies.`
      );
      availableProxies = this.proxies;
      // Avoid infinite loop if proxies list is empty after load attempt
      if (availableProxies.length === 0) {
        logger.error('No proxies available even after fallback.');
        return null;
      }
    }

    // Sort by success rate (internal) and then maybe latency or uptime from JSON
    availableProxies.sort((a, b) => {
      // Prioritize internal success rate
      const successDiff = (b.successRate || 0) - (a.successRate || 0);
      if (Math.abs(successDiff) > 0.1) {
        // Only prioritize if significant difference
        return successDiff;
      }

      // Then prioritize low latency from JSON data
      const latencyDiff = (a.latency || Infinity) - (b.latency || Infinity);
      if (latencyDiff !== 0) {
        return latencyDiff;
      }

      // Then prioritize high uptime from JSON data
      return (b.upTime || 0) - (a.upTime || 0);
    });

    // Get the next proxy in rotation using round-robin on the filtered & sorted list
    this.lastProxyIndex = (this.lastProxyIndex + 1) % availableProxies.length;
    const selectedProxy = availableProxies[this.lastProxyIndex];

    // If a session is specified, store the proxy for it
    if (options.session) {
      this.sessionProxies.set(options.session, selectedProxy);
      logger.debug(
        `Assigned proxy ${selectedProxy.ip}:${selectedProxy.port} to session ${options.session}`
      );
    }

    // Update last used timestamp (internal metric)
    selectedProxy.lastUsed = new Date().toISOString();

    // Use first protocol as the 'type' for logging/axios compatibility
    const protocolType = selectedProxy.protocols?.[0] || 'http';
    logger.info(
      `Using proxy ${selectedProxy.ip}:${selectedProxy.port} (Protocols: ${
        selectedProxy.protocols?.join(',') || 'N/A'
      })`
    );
    return selectedProxy;
  }

  /**
   * Report the result of using a proxy (updates internal metrics like successRate)
   */
  public reportProxyResult(proxy: ProxyInfo, success: boolean, responseTime?: number): void {
    // Find proxy by IP and Port
    const index = this.proxies.findIndex(p => p.ip === proxy.ip && p.port === proxy.port);

    if (index === -1) {
      logger.warn(`Attempted to report result for unknown proxy: ${proxy.ip}:${proxy.port}`);
      return;
    }

    const currentProxy = this.proxies[index];

    // Update internal success rate (using exponential moving average)
    const alpha = 0.1; // Smoothing factor for EMA
    const currentSuccessRate = currentProxy.successRate ?? (success ? 1 : 0); // Initialize if undefined
    currentProxy.successRate = currentSuccessRate * (1 - alpha) + (success ? 1 : 0) * alpha;

    // Update internal response time (using EMA) if provided
    // This is the internally tracked response time, not the one from the JSON source
    if (responseTime !== undefined) {
      const currentInternalResponseTime = currentProxy.responseTime ?? responseTime; // Initialize if undefined
      currentProxy.responseTime = currentInternalResponseTime * (1 - alpha) + responseTime * alpha;
    }

    // Note: We are updating internal metrics (successRate, internal responseTime).
    // The metrics from proxies.json (latency, upTime, source responseTime etc.) are treated as static info from the source.
    logger.debug(
      `Updated proxy ${proxy.ip}:${
        proxy.port
      } internal stats - Success: ${success}, Reported Response Time: ${responseTime}ms -> EMA Success Rate: ${currentProxy.successRate?.toFixed(
        2
      )}, EMA Internal Response Time: ${currentProxy.responseTime?.toFixed(0)}ms`
    );
  }

  /**
   * Load proxies from configured sources
   */
  public async loadProxies(): Promise<void> {
    // Make public for potential manual reload via API
    logger.info('Loading proxies from configured sources');
    this.proxies = []; // Clear existing proxies before loading

    const loadedProxies: ProxyInfo[] = [];

    // Load from each configured source
    for (const source of config.proxy.sources) {
      try {
        if (source.type === 'file' && source.path) {
          // Load from file (assuming JSON now)
          const fileProxies = await this.loadProxiesFromJsonFile(source.path);
          loadedProxies.push(...fileProxies);
          logger.info(`Loaded ${fileProxies.length} proxies from file ${source.path}`);
        } else if (source.type === 'api' && source.url) {
          // Load from API
          const apiProxies = await this.loadProxiesFromApi(source.url, source.apiKey);
          loadedProxies.push(...apiProxies);
          logger.info(`Loaded ${apiProxies.length} proxies from API ${source.url}`);
        }
      } catch (error) {
        logger.error(`Error loading proxies from ${source.type} source:`, error);
      }
    }

    // No need to merge if we clear first, just assign
    this.proxies = loadedProxies;
    this.lastProxyIndex = -1; // Reset rotation index
    this.sessionProxies.clear(); // Clear session assignments

    logger.info(`Total proxies loaded: ${this.proxies.length}`);

    // Optionally trigger an initial health check after loading
    // await this.checkProxyHealth();
  }

  /**
   * Load proxies from a JSON file
   */
  private async loadProxiesFromJsonFile(filePath: string): Promise<ProxyInfo[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const jsonData = JSON.parse(content);

      if (!Array.isArray(jsonData)) {
        logger.error(`Invalid JSON format in proxy file ${filePath}: Expected an array.`);
        return [];
      }

      // Validate and map the data to ProxyInfo, converting port to number
      return jsonData
        .map((item: any): ProxyInfo | null => {
          if (!item || typeof item.ip !== 'string' || typeof item.port !== 'string') {
            logger.warn(`Skipping invalid proxy item in ${filePath}: ${JSON.stringify(item)}`);
            return null;
          }
          // Basic validation and type conversion
          const portNumber = parseInt(item.port, 10);
          if (isNaN(portNumber)) {
            logger.warn(
              `Skipping proxy item with invalid port in ${filePath}: ${JSON.stringify(item)}`
            );
            return null;
          }

          // Map JSON fields to ProxyInfo structure
          const proxy: ProxyInfo = {
            ...item, // Spread all properties from JSON
            ip: item.ip,
            port: portNumber,
            // Ensure protocols is an array of valid types if it exists
            protocols: Array.isArray(item.protocols)
              ? item.protocols.filter((p: any) => ['http', 'https', 'socks4', 'socks5'].includes(p))
              : undefined,
          };
          // Remove host if it exists from JSON to avoid confusion with ip
          // delete (proxy as any).host;
          return proxy;
        })
        .filter((proxy): proxy is ProxyInfo => proxy !== null);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.warn(`Proxy file not found: ${filePath}`);
      } else {
        logger.error(`Error reading or parsing proxy file ${filePath}:`, error);
      }
      return [];
    }
  }

  /**
   * Load proxies from an API
   */
  private async loadProxiesFromApi(url: string, apiKey?: string | null): Promise<ProxyInfo[]> {
    try {
      const headers: Record<string, string> = {};
      if (apiKey) {
        // Assuming API key is passed via Authorization header, adjust as needed
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      const response = await axios.get(url, { headers, timeout: 15000 });

      if (response.status === 200 && Array.isArray(response.data)) {
        // Similar validation and mapping as loadProxiesFromJsonFile
        return response.data
          .map((item: any): ProxyInfo | null => {
            if (!item || typeof item.ip !== 'string' || typeof item.port !== 'string') {
              // Basic check
              logger.warn(`Skipping invalid proxy item from API ${url}: ${JSON.stringify(item)}`);
              return null;
            }
            const portNumber = parseInt(item.port, 10);
            if (isNaN(portNumber)) {
              logger.warn(
                `Skipping proxy item with invalid port from API ${url}: ${JSON.stringify(item)}`
              );
              return null;
            }
            const proxy: ProxyInfo = {
              ...item,
              ip: item.ip,
              port: portNumber,
              protocols: Array.isArray(item.protocols)
                ? item.protocols.filter((p: any) =>
                    ['http', 'https', 'socks4', 'socks5'].includes(p)
                  )
                : undefined,
            };
            // delete (proxy as any).host;
            return proxy;
          })
          .filter((proxy): proxy is ProxyInfo => proxy !== null);
      } else {
        logger.error(`Failed to fetch proxies from API ${url}. Status: ${response.status}`);
        return [];
      }
    } catch (error) {
      logger.error(`Error fetching proxies from API ${url}:`, error);
      return [];
    }
  }

  // mergeProxies is removed as we now clear proxies before loading

  /**
   * Check the health of proxies
   */
  public async checkProxyHealth(limit = 10): Promise<void> {
    // Make public, add limit, remove redundant type annotation
    logger.debug('Starting proxy health check');

    // Check proxies that haven't been checked recently or have low success rate
    const now = Date.now();
    const oneHourAgo = now - 3600000; // 1 hour

    const proxiesToCheck = this.proxies
      .filter(
        proxy =>
          !proxy.lastChecked || // Never checked
          proxy.lastChecked < oneHourAgo || // Checked over an hour ago
          (proxy.successRate !== undefined && proxy.successRate < 0.6) // Low success rate
      )
      .sort((a, b) => (a.lastChecked || 0) - (b.lastChecked || 0)) // Prioritize oldest checks
      .slice(0, limit); // Limit the number checked per run

    if (proxiesToCheck.length === 0) {
      logger.debug('No proxies need health check currently.');
      return;
    }

    logger.info(`Checking health of ${proxiesToCheck.length} proxies`);

    // Check each proxy
    const checkPromises = proxiesToCheck.map(proxy => this.checkSingleProxy(proxy));

    // Wait for all checks to complete
    await Promise.allSettled(checkPromises);

    logger.info('Proxy health check completed');
  }

  /**
   * Check the health of a single proxy
   */
  private async checkSingleProxy(proxy: ProxyInfo): Promise<void> {
    const startTime = Date.now();
    // Use the first protocol for testing, default to http if none specified
    const protocol = proxy.protocols?.[0] || 'http';

    try {
      // Make a request to the test URL through the proxy
      const response = await axios.get(config.proxy.testUrl, {
        // Axios proxy config expects host, not ip
        proxy: {
          host: proxy.ip, // Use ip here for the connection
          port: proxy.port,
          protocol: protocol,
          auth:
            proxy.username && proxy.password
              ? { username: proxy.username, password: proxy.password }
              : undefined,
        },
        timeout: 10000, // Use a default timeout, config.proxy.timeout doesn't exist
      });

      const responseTime = Date.now() - startTime;
      proxy.lastChecked = Date.now(); // Update last checked time

      // Update proxy internal metadata
      this.reportProxyResult(proxy, response.status === 200, responseTime);
    } catch (error: any) {
      proxy.lastChecked = Date.now(); // Update last checked time even on failure
      // Mark proxy as failed internally
      this.reportProxyResult(proxy, false);
      logger.warn(
        `Proxy health check failed for ${proxy.ip}:${proxy.port} (${protocol}): ${error.message}`
      );
    }
  }

  /**
   * Get the count of proxies considered healthy (e.g., success rate > 0.7)
   * Note: This is based on internal metrics, not the static JSON data.
   */
  public getHealthyProxyCount(): number {
    return this.proxies.filter(p => (p.successRate ?? 0) >= 0.7).length;
  }

  /**
   * Clean up resources
   */
  // public dispose(): void { // Keep if healthCheckInterval is used
  //   if (this.healthCheckInterval) {
  //     clearInterval(this.healthCheckInterval);
  //     this.healthCheckInterval = null;
  //   }
  // }

  // listProxies is already defined correctly earlier

  /**
   * Test a specific proxy
   */
  public async testProxy(
    options: ProxyOptions
  ): Promise<{ success: boolean; responseTime?: number; error?: string }> {
    // Find the specific proxy if ip and port are provided, otherwise get one based on criteria
    let proxyToTest: ProxyInfo | null = null;
    if (options.ip && options.port) {
      proxyToTest = this.proxies.find(p => p.ip === options.ip && p.port === options.port) || null;
      if (!proxyToTest) {
        throw new Error(`Proxy ${options.ip}:${options.port} not found in the current list.`);
      }
    } else {
      proxyToTest = await this.getProxy(options);
    }

    if (!proxyToTest) {
      throw new Error('No suitable proxy found or available for testing.');
    }

    const startTime = Date.now();
    const protocol = proxyToTest.protocols?.[0] || 'http'; // Use first protocol

    try {
      const response = await axios.get(config.proxy.testUrl, {
        proxy: {
          host: proxyToTest.ip, // Use ip for connection
          port: proxyToTest.port,
          protocol: protocol,
          auth:
            proxyToTest.username && proxyToTest.password
              ? { username: proxyToTest.username, password: proxyToTest.password }
              : undefined,
        },
        timeout: 10000, // Use a default timeout
      });
      const responseTime = Date.now() - startTime;
      // Report result to update internal stats
      this.reportProxyResult(proxyToTest, true, responseTime);
      return { success: true, responseTime };
    } catch (error: any) {
      // Report result to update internal stats
      this.reportProxyResult(proxyToTest, false);
      return { success: false, error: error.message };
    }
  }

  /**
   * Rotate to a new proxy
   */
  public async rotateProxy(options: ProxyOptions): Promise<ProxyInfo | null> {
    // Return null if none available
    // Simply get the next proxy based on criteria
    const proxy = await this.getProxy(options);
    // No error throwing here, let caller handle null
    // if (!proxy) {
    //   throw new Error('No proxy available for rotation.');
    // }
    return proxy;
  }

  /**
   * Validate all proxies
   */
  public async validateAllProxies(): Promise<
    Array<{ proxy: ProxyInfo; success: boolean; responseTime?: number; error?: string }>
  > {
    logger.info(`Starting validation for all ${this.proxies.length} proxies...`);
    const results: Array<{
      proxy: ProxyInfo;
      success: boolean;
      responseTime?: number;
      error?: string;
    }> = []; // Explicit type
    // Use Promise.allSettled for concurrency
    const validationPromises = this.proxies.map(async proxy => {
      // Test each proxy specifically by its IP and Port
      const result = await this.testProxy({ ip: proxy.ip, port: proxy.port });
      return {
        proxy, // Return the original proxy info
        success: result.success,
        responseTime: result.responseTime,
        error: result.error,
      };
    });

    const settledResults = await Promise.allSettled(validationPromises);

    settledResults.forEach(result => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        // This case should ideally not happen often if testProxy catches errors
        logger.error('Unexpected error during proxy validation:', result.reason);
        // Optionally push a failure result here if needed, depending on desired behavior
      }
    });

    logger.info(
      `Validation completed. ${results.filter(r => r.success).length} proxies are healthy.`
    );
    return results;
  }

  /**
   * Clean proxy list by removing invalid proxies
   */
  public async cleanProxyList(
    minSuccessRate = 0.1
  ): Promise<{ removedCount: number; remainingCount: number }> {
    // Remove redundant type annotation
    logger.info(
      `Cleaning proxy list. Current count: ${this.proxies.length}. Minimum internal success rate: ${minSuccessRate}`
    );
    // Option 1: Re-validate all (can be slow)
    // const validationResults = await this.validateAllProxies();
    // const validProxies = validationResults
    //   .filter(result => result.success)
    //   .map(result => result.proxy);

    // Option 2: Filter based on existing internal successRate (faster)
    const initialCount = this.proxies.length;
    const validProxies = this.proxies.filter(p => (p.successRate ?? 0) >= minSuccessRate);

    const removedCount = initialCount - validProxies.length;
    this.proxies = validProxies; // Update the internal list

    logger.info(`Proxy list cleaned. Removed: ${removedCount}, Remaining: ${validProxies.length}`);
    return {
      removedCount,
      remainingCount: validProxies.length,
    };
  }

  // --- Singleton Pattern ---
  public static getInstance(): ProxyManager {
    if (!ProxyManager.instance) {
      ProxyManager.instance = new ProxyManager();
      // Load proxies on first instantiation
      ProxyManager.instance.loadProxies().catch(err => {
        logger.error('Failed initial proxy load:', err);
      });
      // Setup periodic health checks if configured
      if (config.proxy.healthCheckInterval && config.proxy.healthCheckInterval > 0) {
        const intervalMinutes = config.proxy.healthCheckInterval;
        logger.info(`Setting up periodic proxy health check every ${intervalMinutes} minutes.`);
        ProxyManager.instance.healthCheckInterval = setInterval(() => {
          ProxyManager.instance.checkProxyHealth().catch(err => {
            logger.error('Error during periodic health check:', err);
          });
        }, intervalMinutes * 60 * 1000); // Convert minutes to ms
      }
    }
    return ProxyManager.instance;
  }

  // Private constructor for singleton
  private constructor() {
    // Private constructor needed for singleton pattern
  }

  // Dispose method to clear intervals if needed
  public dispose(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Cleared proxy health check interval.');
    }
  }
}
