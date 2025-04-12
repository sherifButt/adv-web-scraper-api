interface Config {
  redis: {
    host: string;
    port: number;
  };
}

const config: Config = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
};

export default config;
