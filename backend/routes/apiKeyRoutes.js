import express from 'express';
import { createApiKey, listApiKeys, revokeApiKey } from '../controllers/apiKeyController.js';

// Admin management of API keys. Mounted at /api/keys behind requireAdmin.
const router = express.Router();

router.get('/', listApiKeys);
router.post('/', createApiKey);
router.post('/:id/revoke', revokeApiKey);

export default router;
