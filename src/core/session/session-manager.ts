import { BrowserContext, Cookie } from 'playwright';
import { logger } from '../../utils/logger.js';
import { StorageService } from '../../storage/index.js';
import { StorageAdapterType } from '../../storage/storage-factory.js';
import { config } from '../../config/index.js';
import crypto from 'crypto';

/**
 * Session data structure
 */
export interface SessionData {
  id: string;
  domain: string;
  cookies: Cookie[];
  localStorage?: Record<string, string>;
  userAgent?: string;
  createdAt: string;
  lastUsedAt: string;
  captchaSolved: boolean;
  expiresAt: string;
}

/**
 * Options for creating or retrieving a session
 */
export interface SessionOptions {
  domain: string;
  userAgent?: string;
  ttl?: number; // Time to live in milliseconds
  version?: number;
  cookies?: Cookie[];
}

/**
 * Manages browser sessions for reuse
 */
export class SessionManager {
  private static instance: SessionManager;
  private storageService: StorageService;
  private sessions: Map<string, SessionData> = new Map();
  private initialized = false;

  private constructor() {
    this.storageService = StorageService.getInstance({
      primaryAdapter: config.environment === 'production' ? 'redis' : 'memory',
    });
  }

  /**
   * Get the singleton instance of SessionManager
   */
  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Initialize the session manager
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.storageService.initialize();

      // Load existing sessions from storage
      const sessions = await this.storageService.list({
        // Filter to only include session data
        // This assumes session IDs start with 'session_'
      });

      for (const session of sessions) {
        if (session.id.startsWith('session_')) {
          const sessionData = session as unknown as SessionData;

          // Skip expired sessions
          if (new Date(sessionData.expiresAt) < new Date()) {
            await this.storageService.delete(sessionData.id);
            continue;
          }

          this.sessions.set(sessionData.id, sessionData);
        }
      }

      logger.info(`Loaded ${this.sessions.size} sessions from storage`);
      this.initialized = true;
    } catch (error: any) {
      logger.error(`Error initializing session manager: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a random session ID
   */
  private createSessionId(): string {
    return `session_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return url;
    }
  }

  /**
   * Save a session for later reuse
   */
  public async saveSession(context: BrowserContext, options: SessionOptions): Promise<SessionData> {
    if (!this.initialized) await this.initialize();

    const domain = options.domain;
    const sessionId = this.createSessionId();

    // Get cookies from the browser context
    const cookies = await context.cookies();

    // Get localStorage if possible (this requires a page)
    let localStorage: Record<string, string> | undefined;
    try {
      const pages = context.pages();
      if (pages.length > 0) {
        localStorage = await pages[0].evaluate(() => {
          const items: Record<string, string> = {};
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key) {
              items[key] = window.localStorage.getItem(key) || '';
            }
          }
          return items;
        });
      }
    } catch (error) {
      logger.debug('Could not extract localStorage');
    }

    // Create session data
    const now = new Date();
    const ttl = options.ttl || config.browser.session?.ttl || 24 * 60 * 60 * 1000; // Default 24 hours
    const expiresAt = new Date(now.getTime() + ttl);

    const sessionData: SessionData = {
      id: sessionId,
      domain,
      cookies,
      localStorage,
      userAgent: options.userAgent,
      createdAt: now.toISOString(),
      lastUsedAt: now.toISOString(),
      captchaSolved: true, // Assume the session has solved CAPTCHAs if we're saving it
      expiresAt: expiresAt.toISOString(),
    };

    // Save to memory and storage
    this.sessions.set(sessionId, sessionData);
    await this.storageService.store(sessionData as any);

    logger.info(`Saved session for domain: ${domain}`);
    return sessionData;
  }

  /**
   * Get a session by ID (alias for getSession)
   */
  public async getSessionById(sessionId: string): Promise<SessionData | null> {
    return this.getSession(sessionId);
  }

  /**
   * Get a session by ID
   */
  public async getSession(sessionId: string): Promise<SessionData | null> {
    if (!this.initialized) await this.initialize();

    // Check if session exists in memory
    let sessionData = this.sessions.get(sessionId);

    // If not in memory, try to get from storage
    if (!sessionData) {
      const storedSession = await this.storageService.retrieve(sessionId);
      if (storedSession) {
        sessionData = storedSession as unknown as SessionData;
        this.sessions.set(sessionId, sessionData);
      }
    }

    // Check if session is expired
    if (sessionData && new Date(sessionData.expiresAt) < new Date()) {
      logger.info(`Session ${sessionId} has expired`);
      await this.deleteSession(sessionId);
      return null;
    }

    if (sessionData) {
      // Update last used timestamp
      sessionData.lastUsedAt = new Date().toISOString();
      await this.storageService.update(sessionId, sessionData as any);

      logger.info(`Retrieved session: ${sessionId}`);
    }

    return sessionData || null;
  }

  /**
   * Apply a session to a browser context
   */
  public async applySession(context: BrowserContext, sessionData: SessionData): Promise<void> {
    // Set cookies
    await context.addCookies(sessionData.cookies);

    // Set localStorage if available
    if (sessionData.localStorage) {
      const pages = context.pages();
      if (pages.length > 0) {
        await pages[0].evaluate(storageData => {
          for (const [key, value] of Object.entries(storageData)) {
            window.localStorage.setItem(key, value);
          }
        }, sessionData.localStorage);
      }
    }

    logger.info(`Applied session for domain: ${sessionData.domain}`);
  }

  /**
   * Mark a session as having solved CAPTCHAs
   */
  public async markCaptchaSolved(sessionId: string): Promise<void> {
    if (!this.initialized) await this.initialize();

    const sessionData = this.sessions.get(sessionId);
    if (sessionData) {
      sessionData.captchaSolved = true;
      sessionData.lastUsedAt = new Date().toISOString();
      await this.storageService.update(sessionId, sessionData as any);
      logger.info(`Marked session ${sessionId} as having solved CAPTCHAs`);
    }
  }

  /**
   * Delete a session
   */
  public async deleteSession(sessionId: string): Promise<void> {
    if (!this.initialized) await this.initialize();

    this.sessions.delete(sessionId);
    await this.storageService.delete(sessionId);
    logger.info(`Deleted session: ${sessionId}`);
  }

  /**
   * Clear all sessions
   */
  public async clearSessions(): Promise<void> {
    if (!this.initialized) await this.initialize();

    for (const sessionId of this.sessions.keys()) {
      await this.storageService.delete(sessionId);
    }

    this.sessions.clear();
    logger.info('Cleared all sessions');
  }

  /**
   * Get all sessions
   */
  public async getAllSessions(): Promise<SessionData[]> {
    if (!this.initialized) await this.initialize();
    return Array.from(this.sessions.values());
  }

  /**
   * Create a new session with specified options
   */
  public async createSession(options: {
    adapter: string;
    ttl: number;
    browserOptions?: {
      userAgent?: string;
      viewport?: { width: number; height: number };
    };
  }): Promise<SessionData> {
    if (!this.initialized) await this.initialize();

    const now = new Date();
    const expiresAt = new Date(now.getTime() + options.ttl);

    const sessionData: SessionData = {
      id: `session_${crypto.randomBytes(16).toString('hex')}`,
      domain: 'new_session',
      cookies: [],
      userAgent: options.browserOptions?.userAgent,
      createdAt: now.toISOString(),
      lastUsedAt: now.toISOString(),
      captchaSolved: false,
      expiresAt: expiresAt.toISOString(),
    };

    // Set storage adapter if specified
    if (options.adapter) {
      const validAdapters = ['memory', 'file', 'mongodb', 'redis', 'api'];
      if (!validAdapters.includes(options.adapter)) {
        throw new Error(
          `Invalid storage adapter: ${options.adapter}. Must be one of: ${validAdapters.join(', ')}`
        );
      }
      await this.storageService.changePrimaryAdapter(options.adapter as StorageAdapterType);
    }

    // Save to memory and storage
    this.sessions.set(sessionData.id, sessionData);
    await this.storageService.store(sessionData as any);

    logger.info(`Created new session with ID: ${sessionData.id}`);
    return sessionData;
  }
}
