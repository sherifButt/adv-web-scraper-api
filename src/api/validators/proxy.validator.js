import Joi from 'joi';

export const validateProxyInput = data => {
  const schema = Joi.object({
    host: Joi.string().required(),
    port: Joi.number().required(),
    protocol: Joi.string().valid('http', 'https', 'socks', 'socks4', 'socks5').required(),
    username: Joi.string().optional(),
    password: Joi.string().optional(),
    country: Joi.string().optional(),
    sessionId: Joi.string().optional(),
  });

  return schema.validate(data);
};
