import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface ServerConfig {
  port: number;
  host: string;
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

interface MongoDBConfig {
  uri: string;
}

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  tlsEnabled?: boolean;
}

interface BrowserConfig {
  pool: {
    min: number;
    max: number;
    idleTimeoutMs: number;
  };
  defaultOptions: {
    headless: boolean;
    args: string[];
    defaultViewport: {
      width: number;
      height: number;
    };
    defaultReferer?: string;
  };
  session?: {
    ttl: number; // Time to live in milliseconds
    enabled: boolean;
  };
}

interface CaptchaConfig {
  services: {
    twoCaptcha: {
      enabled: boolean;
      apiKey: string | null;
    };
    antiCaptcha: {
      enabled: boolean;
      apiKey: string | null;
    };
  };
  solveTimeout: number;
}

interface ProxyConfig {
  enabled: boolean;
  sources: {
    type: string;
    path?: string;
    url?: string;
    apiKey?: string | null;
    refreshInterval?: number;
  }[];
  testUrl: string;
  healthCheckInterval: number;
  useForHtmlFetch?: boolean;
}

interface LoggingConfig {
  level: string;
  file: string | null;
}

// Updated AiConfig interface to include openRouter as optional
interface AiConfig {
  openai?: {
    apiKey: string;
  };
  deepseek?: {
    apiKey: string;
  };
  anthropic?: {
    apiKey: string;
  };
  openRouter?: {
    // Make openRouter optional here as well
    apiKey: string;
  };
}

interface Config {
  environment: string;
  server: ServerConfig;
  rateLimit: RateLimitConfig;
  mongodb: MongoDBConfig;
  redis: RedisConfig;
  browser: BrowserConfig;
  captcha: CaptchaConfig;
  proxy: ProxyConfig;
  logging: LoggingConfig;
  ai?: AiConfig; // ai itself is optional
  jobs: {
    retentionPeriodDays: number;
    cleanupIntervalHours: number;
  };
}

export const config: Config = {
  environment: process.env.NODE_ENV || 'development',
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || 'localhost',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/web-scraper',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    tlsEnabled: process.env.REDIS_TLS_ENABLED === 'true',
  },
  browser: {
    pool: {
      min: parseInt(process.env.BROWSER_POOL_MIN || '1', 10),
      max: parseInt(process.env.BROWSER_POOL_MAX || '5', 10),
      idleTimeoutMs: parseInt(process.env.BROWSER_IDLE_TIMEOUT || '30000', 10),
    },
    defaultOptions: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
      defaultReferer: process.env.DEFAULT_REFERER || 'https://www.google.com/',
    },
    session: {
      ttl: parseInt(process.env.SESSION_TTL || '86400000', 10),
      enabled: process.env.SESSION_ENABLED !== 'false',
    },
  },
  captcha: {
    services: {
      twoCaptcha: {
        enabled: !!process.env.TWOCAPTCHA_API_KEY,
        apiKey: process.env.TWOCAPTCHA_API_KEY || null,
      },
      antiCaptcha: {
        enabled: !!process.env.ANTICAPTCHA_API_KEY,
        apiKey: process.env.ANTICAPTCHA_API_KEY || null,
      },
    },
    solveTimeout: 120000,
  },
  proxy: {
    enabled: true,
    sources: [
      {
        type: 'file',
        path: './proxies.json',
      },
      {
        type: 'api',
        url: process.env.PROXY_API_URL,
        apiKey: process.env.PROXY_API_KEY || null,
        refreshInterval: 3600000,
      },
    ],
    testUrl: 'https://httpbin.org/ip',
    healthCheckInterval: 300000,
    useForHtmlFetch: process.env.PROXY_USE_FOR_HTML_FETCH === 'true',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || null,
  },
  // Correctly structured ai block
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || '',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    },
    openRouter: {
      // openRouter inside the ai block
      apiKey: process.env.OPENROUTER_API_KEY || '',
    },
  },
  // Correctly placed jobs block
  jobs: {
    retentionPeriodDays: parseInt(process.env.JOB_RETENTION_DAYS || '10', 10),
    cleanupIntervalHours: parseInt(process.env.JOB_CLEANUP_INTERVAL_HOURS || '24', 10),
  },
};

export default config;
