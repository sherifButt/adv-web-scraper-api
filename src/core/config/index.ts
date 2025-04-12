interface Config {
  redis: {
    host: string;
    port: number;
    password?: string; // Make password optional
    tlsEnabled: boolean;
  };
}

const config: Config = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined, // Read password from env
    tlsEnabled: process.env.REDIS_TLS_ENABLED === 'true', // Read TLS flag from env
  },
};

export default config;
