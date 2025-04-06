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
   * Private constructor for singleton pattern
   */
  private constructor() {
    // Start health checking
    this.healthCheckInterval = setInterval(() => {
      this.checkProxyHealth();
    }, config.proxy.healthCheckInterval);
    
    // Load proxies from configured sources
    this.loadProxies().catch(err => {
      logger.error('Error loading proxies:', err);
    });
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): ProxyManager {
    if (!ProxyManager.instance) {
      ProxyManager.instance = new ProxyManager();
    }
    return ProxyManager.instance;
  }
  
  /**
   * Get a proxy based on the provided options
   */
  public async getProxy(options: ProxyOptions = {}): Promise<ProxyInfo | null> {
    // If proxies are not enabled, return null
    if (!config.proxy.enabled) {
      return null;
    }
    
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
        return sessionProxy;
      }
    }
    
    // Filter proxies based on options
    let availableProxies = this.proxies.filter(proxy => {
      // Filter by country if specified
      if (options.country && proxy.country !== options.country) {
        return false;
      }
      
      // Filter by type if specified
      if (options.type && proxy.type !== options.type) {
        return false;
      }
      
      // Only use proxies with good success rate
      if (proxy.successRate !== undefined && proxy.successRate < 0.5) {
        return false;
      }
      
      return true;
    });
    
    // If no proxies match the criteria, use any available proxy
    if (availableProxies.length === 0) {
      availableProxies = this.proxies;
    }
    
    // Sort by success rate and response time
    availableProxies.sort((a, b) => {
      // Prioritize success rate
      const successDiff = (b.successRate || 0) - (a.successRate || 0);
      if (Math.abs(successDiff) > 0.1) {
        return successDiff;
      }
      
      // Then prioritize response time
      return (a.responseTime || 1000) - (b.responseTime || 1000);
    });
    
    // Get the next proxy in rotation
    this.lastProxyIndex = (this.lastProxyIndex + 1) % availableProxies.length;
    const proxy = availableProxies[this.lastProxyIndex];
    
    // If a session is specified, store the proxy for it
    if (options.session) {
      this.sessionProxies.set(options.session, proxy);
    }
    
    // Update last used timestamp
    proxy.lastUsed = new Date().toISOString();
    
    logger.info(`Using proxy ${proxy.host}:${proxy.port} (${proxy.type})`);
    return proxy;
  }
  
  /**
   * Report the result of using a proxy
   */
  public reportProxyResult(proxy: ProxyInfo, success: boolean, responseTime?: number): void {
    const index = this.proxies.findIndex(p => 
      p.host === proxy.host && p.port === proxy.port
    );
    
    if (index === -1) {
      return;
    }
    
    const currentProxy = this.proxies[index];
    
    // Update success rate
    currentProxy.successRate = currentProxy.successRate === undefined
      ? (success ? 1 : 0)
      : currentProxy.successRate * 0.9 + (success ? 0.1 : 0);
    
    // Update response time if provided
    if (responseTime) {
      currentProxy.responseTime = currentProxy.responseTime === undefined
        ? responseTime
        : currentProxy.responseTime * 0.9 + responseTime * 0.1;
    }
    
    logger.debug(`Updated proxy ${proxy.host}:${proxy.port} - Success rate: ${currentProxy.successRate?.toFixed(2)}, Response time: ${currentProxy.responseTime}ms`);
  }
  
  /**
   * Get the total number of proxies
   */
  public getProxyCount(): number {
    return this.proxies.length;
  }
  
  /**
   * Get the number of healthy proxies
   */
  public getHealthyProxyCount(): number {
    return this.proxies.filter(p => p.successRate === undefined || p.successRate >= 0.5).length;
  }
  
  /**
   * Get proxy statistics
   */
  public getProxyStats(): {
    total: number;
    healthy: number;
    countries: string[];
    types: string[];
  } {
    const countries = new Set<string>();
    const types = new Set<string>();
    
    this.proxies.forEach(proxy => {
      if (proxy.country) {
        countries.add(proxy.country);
      }
      types.add(proxy.type);
    });
    
    return {
      total: this.proxies.length,
      healthy: this.getHealthyProxyCount(),
      countries: Array.from(countries),
      types: Array.from(types),
    };
  }
  
  /**
   * Load proxies from configured sources
   */
  private async loadProxies(): Promise<void> {
    logger.info('Loading proxies from configured sources');
    
    const newProxies: ProxyInfo[] = [];
    
    // Load from each configured source
    for (const source of config.proxy.sources) {
      try {
        if (source.type === 'file' && source.path) {
          // Load from file
          const fileProxies = await this.loadProxiesFromFile(source.path);
          newProxies.push(...fileProxies);
          logger.info(`Loaded ${fileProxies.length} proxies from file ${source.path}`);
        } else if (source.type === 'api' && source.url) {
          // Load from API
          const apiProxies = await this.loadProxiesFromApi(source.url, source.apiKey);
          newProxies.push(...apiProxies);
          logger.info(`Loaded ${apiProxies.length} proxies from API ${source.url}`);
        }
      } catch (error) {
        logger.error(`Error loading proxies from ${source.type} source:`, error);
      }
    }
    
    // Merge with existing proxies, preserving metadata
    this.mergeProxies(newProxies);
    
    logger.info(`Total proxies available: ${this.proxies.length}`);
  }
  
  /**
   * Load proxies from a file
   */
  private async loadProxiesFromFile(filePath: string): Promise<ProxyInfo[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      
      return lines.map(line => {
        const parts = line.trim().split(':');
        
        if (parts.length < 2) {
          logger.warn(`Invalid proxy format in file: ${line}`);
          return null;
        }
        
        const proxy: ProxyInfo = {
          host: parts[0],
          port: parseInt(parts[1], 10),
          type: 'http', // Default type
        };
        
        // Check for type
        if (parts.length > 2) {
          proxy.type = parts[2] as 'http' | 'https' | 'socks4' | 'socks5';
        }
        
        // Check for username/password
        if (parts.length > 4) {
          proxy.username = parts[3];
          proxy.password = parts[4];
        }
        
        return proxy;
      }).filter((proxy): proxy is ProxyInfo => proxy !== null);
    } catch (error) {
      logger.error(`Error reading proxy file ${filePath}:`, error);
      return [];
    }
  }
  
  /**
   * Load proxies from an API
   */
  private async loadProxiesFromApi(url: string, apiKey?: string | null): Promise<ProxyInfo[]> {
    try {
      // This is a placeholder implementation
      // In a real implementation, you would make an API call to your proxy provider
      
      // Simulate API call
      logger.info(`Making API call to ${url} for proxies (placeholder)`);
      
      // Return empty array for now
      return [];
    } catch (error) {
      logger.error(`Error fetching proxies from API ${url}:`, error);
      return [];
    }
  }
  
  /**
   * Merge new proxies with existing ones, preserving metadata
   */
  private mergeProxies(newProxies: ProxyInfo[]): void {
    // Create a map of existing proxies for quick lookup
    const existingProxiesMap = new Map<string, ProxyInfo>();
    this.proxies.forEach(proxy => {
      const key = `${proxy.host}:${proxy.port}`;
      existingProxiesMap.set(key, proxy);
    });
    
    // Merge new proxies, preserving metadata from existing ones
    const mergedProxies: ProxyInfo[] = [];
    
    newProxies.forEach(newProxy => {
      const key = `${newProxy.host}:${newProxy.port}`;
      const existingProxy = existingProxiesMap.get(key);
      
      if (existingProxy) {
        // Preserve metadata from existing proxy
        mergedProxies.push({
          ...newProxy,
          successRate: existingProxy.successRate,
          responseTime: existingProxy.responseTime,
          lastUsed: existingProxy.lastUsed,
        });
        
        // Remove from map to track which ones were processed
        existingProxiesMap.delete(key);
      } else {
        // Add new proxy
        mergedProxies.push(newProxy);
      }
    });
    
    // Add any remaining existing proxies that weren't in the new list
    existingProxiesMap.forEach(proxy => {
      mergedProxies.push(proxy);
    });
    
    this.proxies = mergedProxies;
  }
  
  /**
   * Check the health of proxies
   */
  private async checkProxyHealth(): Promise<void> {
    logger.debug('Starting proxy health check');
    
    // Only check a subset of proxies each time to avoid overloading
    const proxiesToCheck = this.proxies
      .filter(proxy => !proxy.lastUsed || new Date(proxy.lastUsed).getTime() < Date.now() - 3600000)
      .slice(0, 10);
    
    if (proxiesToCheck.length === 0) {
      return;
    }
    
    logger.debug(`Checking health of ${proxiesToCheck.length} proxies`);
    
    // Check each proxy
    const checkPromises = proxiesToCheck.map(proxy => this.checkProxy(proxy));
    
    // Wait for all checks to complete
    await Promise.allSettled(checkPromises);
    
    logger.debug('Proxy health check completed');
  }
  
  /**
   * Check the health of a single proxy
   */
  private async checkProxy(proxy: ProxyInfo): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Make a request to the test URL through the proxy
      const response = await axios.get(config.proxy.testUrl, {
        proxy: {
          host: proxy.host,
          port: proxy.port,
          protocol: proxy.type,
          auth: proxy.username && proxy.password
            ? { username: proxy.username, password: proxy.password }
            : undefined,
        },
        timeout: 10000, // 10 second timeout
      });
      
      const responseTime = Date.now() - startTime;
      
      // Update proxy metadata
      this.reportProxyResult(proxy, response.status === 200, responseTime);
      
      // Try to determine country from response if not already known
      if (!proxy.country && response.data && response.data.origin) {
        // This assumes the test URL returns the IP in a field called 'origin'
        // You might need to adjust this based on the actual response format
        proxy.country = response.data.origin.split(',')[0].trim();
      }
    } catch (error) {
      // Mark proxy as failed
      this.reportProxyResult(proxy, false);
    }
  }
  
  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}
