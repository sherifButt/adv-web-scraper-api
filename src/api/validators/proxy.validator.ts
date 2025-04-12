import Joi from 'joi';
import { ProxyOptions } from '../../types/index.js';

export const validateProxyInput = (data: ProxyOptions) => {
  const schema = Joi.object({
    host: Joi.string().required(),
    port: Joi.number().required(),
    type: Joi.string().valid('http', 'https', 'socks4', 'socks5').required(),
    username: Joi.string().optional(),
    password: Joi.string().optional(),
    country: Joi.string().optional(),
    sessionId: Joi.string().optional(),
  });

  return schema.validate(data);
};
