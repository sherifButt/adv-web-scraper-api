import Joi from 'joi';
import { ProxyOptions } from '../../types/index.js';

const proxySchema = Joi.object({
  host: Joi.string().optional(),
  ip: Joi.string().optional(),
  port: Joi.number().required(),
  type: Joi.string().valid('http', 'https', 'socks4', 'socks5').optional(),
  username: Joi.string().optional(),
  password: Joi.string().optional(),
  country: Joi.string().optional(),
  sessionId: Joi.string().optional(),
})
  .or('host', 'ip')
  .messages({
    'object.missing': 'Either "host" or "ip" is required',
  });

export const validateProxyInput = (data: ProxyOptions | ProxyOptions[]) => {
  if (Array.isArray(data)) {
    return Joi.array().items(proxySchema).validate(data);
  }
  return proxySchema.validate(data);
};
