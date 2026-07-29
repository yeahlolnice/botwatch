import { query } from '../utilities/connectDB.js';
import { generateApiKey, VALID_TIERS } from '../utilities/apiKey.js';
import {
    insertApiKeyQuery,
    listApiKeysQuery,
    revokeApiKeyQuery,
} from '../utilities/sqlApiKeyQuerys.js';

// POST /api/keys { label, tier } — mint a key. The plaintext is returned ONCE
// and never stored; only its hash is kept. Admin-only.
export const createApiKey = async (req, res) => {
    const label = (req.body?.label || '').trim() || null;
    const tier = (req.body?.tier || 'free').trim();
    if (!VALID_TIERS.includes(tier)) {
        return res.status(400).json({ error: `tier must be one of: ${VALID_TIERS.join(', ')}` });
    }

    try {
        const { key, hash, prefix } = generateApiKey();
        const row = (await query(insertApiKeyQuery, [hash, prefix, label, tier])).rows[0];
        // key is shown exactly once — the client must copy it now.
        return res.status(201).json({ ...row, key });
    } catch (error) {
        console.error('Create API key error:', error);
        return res.status(500).json({ error: 'Failed to create API key' });
    }
};

// GET /api/keys — list keys (never the plaintext). Admin-only.
export const listApiKeys = async (req, res) => {
    try {
        const result = await query(listApiKeysQuery);
        return res.json({ keys: result.rows });
    } catch (error) {
        console.error('List API keys error:', error);
        return res.status(500).json({ error: 'Failed to list API keys' });
    }
};

// POST /api/keys/:id/revoke — deactivate a key. Admin-only.
export const revokeApiKey = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Invalid key id' });

    try {
        const result = await query(revokeApiKeyQuery, [id]);
        if (!result.rows[0]) return res.status(404).json({ error: 'Key not found' });
        return res.json({ ok: true, id });
    } catch (error) {
        console.error('Revoke API key error:', error);
        return res.status(500).json({ error: 'Failed to revoke API key' });
    }
};

// GET /api/v1/status — key-authenticated: confirms the key works and reports plan
// + usage. The first public API endpoint (behind apiKeyAuth).
export const apiStatus = (req, res) => {
    return res.json({
        ok: true,
        keyPrefix: req.apiKey.key_prefix,
        tier: req.apiKey.tier,
        requestCount: Number(req.apiKey.request_count),
    });
};
