import express from 'express';
import {
    initCrawlerTables,
    seedDomains,
    runCrawlBatch,
    processSitemaps,
    getCrawlerStatus,
} from '../controllers/crawlerController.js';

const router = express.Router();

router.post('/init', initCrawlerTables);
router.post('/domains/seed', seedDomains);
router.post('/run', runCrawlBatch);
router.post('/sitemaps/process', processSitemaps);
router.get('/status', getCrawlerStatus);

export default router;
