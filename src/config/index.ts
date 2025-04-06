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
}

interface LoggingConfig {
  level: string;
  file: string | null;
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
}

export const config: Config = {
  environment: process.env.NODE_ENV || 'development',
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || 'localhost',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/web-scraper',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
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
    solveTimeout: 120000, // 2 minutes
  },
  proxy: {
    enabled: true,
    sources: [
      {
        type: 'file',
        path: './proxies.txt',
      },
      {
        type: 'api',
        url: process.env.PROXY_API_URL,
        apiKey: process.env.PROXY_API_KEY || null,
        refreshInterval: 3600000, // 1 hour
      },
    ],
    testUrl: 'https://httpbin.org/ip',
    healthCheckInterval: 300000, // 5 minutes
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || null,
  },
};
