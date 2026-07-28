import express from 'express';
import { getDatasetStats } from '../controllers/modelController.js';

const router = express.Router();

// Phase 2: malicious-IP model. More endpoints (train, score, feed) land here.
router.get('/dataset-stats', getDatasetStats);

export default router;
