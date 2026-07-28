import { extractIpFeatureRows, FEATURE_NAMES } from '../model/featureExtraction.js';

// GET /api/model/dataset-stats — a preview of the training dataset the model
// will learn from: how many IPs, the malicious/benign balance, and a sample of
// labelled feature vectors. Admin-only (mounted behind requireAdmin).
export const getDatasetStats = async (req, res) => {
    try {
        const rows = await extractIpFeatureRows();
        const positives = rows.filter((r) => r.label === 1).length;

        // Round features for a readable preview.
        const round = (f) => Object.fromEntries(
            Object.entries(f).map(([k, v]) => [k, Math.round(v * 1000) / 1000])
        );

        const sample = rows.slice(0, 8).map((r) => ({
            ip: r.ip,
            label: r.label,
            requestCount: r.requestCount,
            features: round(r.features),
        }));

        return res.json({
            totalIps: rows.length,
            positives,
            negatives: rows.length - positives,
            featureNames: FEATURE_NAMES,
            sample,
        });
    } catch (error) {
        console.error('Dataset stats error:', error);
        return res.status(500).json({ error: 'Failed to build feature dataset' });
    }
};
