import { Router } from 'express';
import { scrapeRoutes } from './scrape.routes.js';
import { captchaRoutes } from './captcha.routes.js';
import { proxyRoutes } from './proxy.routes.js';
import { navigationRoutes } from './navigation.routes.js';

// Create router
const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Mount route groups
router.use('/scrape', scrapeRoutes);
router.use('/captcha', captchaRoutes);
router.use('/proxy', proxyRoutes);
router.use('/navigate', navigationRoutes);

export const apiRoutes = router;
