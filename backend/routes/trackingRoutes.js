import express from 'express';
import { trackRequest, createTrackingTable } from '../controllers/trackingControllers.js';

const router = express.Router();

router.post('/addRequest', trackRequest);
router.get('/db-init', createTrackingTable);
export default router;