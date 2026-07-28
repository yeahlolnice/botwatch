import express from 'express';
import {
    getDatasetStats,
    trainIpModel,
    scoreAllIps,
    getScores,
} from '../controllers/modelController.js';

const router = express.Router();

// Phase 2: malicious-IP model.
router.get('/dataset-stats', getDatasetStats);
router.post('/train', trainIpModel);
router.post('/score-all', scoreAllIps);
router.get('/scores', getScores);

export default router;
