import { query } from '../utilities/connectDB.js';
import { extractIpFeatureRows, FEATURE_NAMES } from '../model/featureExtraction.js';
import { trainModel, scoreFeatures } from '../model/logisticRegression.js';
import { explainScore } from '../model/explain.js';
import {
    upsertModelQuery,
    getModelQuery,
    upsertIpScoreQuery,
    getTopIpScoresQuery,
    getEnrichedFeedQuery,
    upsertIpVerdictQuery,
    deleteIpVerdictQuery,
} from '../utilities/sqlModelQuerys.js';

const MODEL_NAME = 'ip_risk';

// GET /api/model/dataset-stats — preview of the training dataset.
export const getDatasetStats = async (req, res) => {
    try {
        const rows = await extractIpFeatureRows();
        const positives = rows.filter((r) => r.label === 1).length;
        const round = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));
        const sample = rows.slice(0, 8).map((r) => ({ ip: r.ip, label: r.label, requestCount: r.requestCount, features: round(r.features) }));
        return res.json({ totalIps: rows.length, positives, negatives: rows.length - positives, featureNames: FEATURE_NAMES, sample });
    } catch (error) {
        console.error('Dataset stats error:', error);
        return res.status(500).json({ error: 'Failed to build feature dataset' });
    }
};

// POST /api/model/train — build the dataset, train the logistic model, store it.
export const trainIpModel = async (req, res) => {
    try {
        const rows = await extractIpFeatureRows();
        const positives = rows.filter((r) => r.label === 1).length;

        if (rows.length < 10 || positives === 0 || positives === rows.length) {
            return res.status(400).json({
                error: 'Not enough labelled data to train yet',
                totalIps: rows.length, positives, negatives: rows.length - positives,
            });
        }

        const model = trainModel(rows);
        const stored = await query(upsertModelQuery, [
            MODEL_NAME, JSON.stringify(model), JSON.stringify(model.metrics),
        ]);

        return res.json({
            trainedAt: stored.rows[0].trained_at,
            counts: model.counts,
            metrics: model.metrics,
            weights: model.featureNames.map((f, i) => ({ feature: f, weight: Math.round(model.weights[i] * 1000) / 1000 })),
        });
    } catch (error) {
        console.error('Model train error:', error);
        return res.status(500).json({ error: 'Failed to train model' });
    }
};

// POST /api/model/score-all — score every IP with the stored model and persist.
export const scoreAllIps = async (req, res) => {
    try {
        const stored = await query(getModelQuery, [MODEL_NAME]);
        if (!stored.rows[0]) return res.status(400).json({ error: 'No trained model — POST /api/model/train first' });

        const model = stored.rows[0].model;
        const rows = await extractIpFeatureRows();

        let high = 0;
        for (const r of rows) {
            const { score, factors } = scoreFeatures(model, r.features);
            if (score >= 70) high++;
            const explanation = explainScore(score, factors);
            const topFactors = factors.slice(0, 3).map((f) => ({ feature: f.feature, impact: Math.round(f.impact * 1000) / 1000 }));
            await query(upsertIpScoreQuery, [r.ip, score, r.label, r.requestCount, JSON.stringify(topFactors), explanation]);
        }

        return res.json({ scored: rows.length, highRisk: high });
    } catch (error) {
        console.error('Score-all error:', error);
        return res.status(500).json({ error: 'Failed to score IPs' });
    }
};

// GET /api/model/scores?limit=50 — highest-risk IPs (with analyst verdicts).
export const getScores = async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
        const result = await query(getTopIpScoresQuery, [limit]);
        return res.json({ scores: result.rows });
    } catch (error) {
        console.error('Get scores error:', error);
        return res.status(500).json({ error: 'Failed to fetch scores' });
    }
};

const csvEscape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const iso = (v) => v?.toISOString?.() || v || '';
const list = (a) => (Array.isArray(a) ? a.filter(Boolean).join(';') : '');

// GET /api/model/feed?minScore=70&format=json|csv — the scored bad-IP feed,
// enriched into IOCs (observed activity + AbuseIPDB context per IP).
export const getFeed = async (req, res) => {
    try {
        const minScore = Math.min(Math.max(parseInt(req.query.minScore, 10) || 70, 0), 100);
        const format = req.query.format === 'csv' ? 'csv' : 'json';
        const rows = (await query(getEnrichedFeedQuery, [minScore])).rows;

        if (format === 'csv') {
            const header = 'ip,score,request_count,first_seen,last_seen,honeypot_hits,threat_requests,intents,cves,countries,abuse_confidence,isp,usage_type,is_tor,abuse_country,reason';
            const body = rows.map((r) => [
                r.ip, r.score, r.request_count,
                iso(r.first_seen), iso(r.last_seen), r.honeypot_hits ?? 0, r.threat_requests ?? 0,
                list(r.intents), list(r.cves), list(r.countries),
                r.abuse_confidence_score ?? '', r.abuse_isp ?? '', r.abuse_usage_type ?? '',
                r.abuse_is_tor == null ? '' : r.abuse_is_tor, r.abuse_country_code ?? '', r.explanation,
            ].map(csvEscape).join(',')).join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="botwatch-threat-feed.csv"');
            return res.send(`${header}\n${body}\n`);
        }

        return res.json({
            generatedAt: new Date().toISOString(),
            minScore,
            count: rows.length,
            feed: rows.map((r) => ({
                ip: r.ip,
                score: r.score,
                requestCount: r.request_count,
                reason: r.explanation,
                scoredAt: r.scored_at,
                firstSeen: r.first_seen,
                lastSeen: r.last_seen,
                honeypotHits: r.honeypot_hits ?? 0,
                threatRequests: r.threat_requests ?? 0,
                intents: r.intents || [],
                cves: r.cves || [],
                countries: r.countries || [],
                abuse: (r.abuse_confidence_score != null || r.abuse_isp || r.abuse_usage_type) ? {
                    confidence: r.abuse_confidence_score,
                    isp: r.abuse_isp,
                    usageType: r.abuse_usage_type,
                    isTor: r.abuse_is_tor,
                    country: r.abuse_country_code,
                    rdns: r.rdns,
                } : null,
            })),
        });
    } catch (error) {
        console.error('Feed error:', error);
        return res.status(500).json({ error: 'Failed to build feed' });
    }
};

// POST /api/model/verdict { ip, verdict } — analyst confirm/deny. verdict is
// 'malicious', 'benign', or 'clear' (removes the override). Feeds next training.
export const setVerdict = async (req, res) => {
    const ip = (req.body?.ip || '').trim();
    const verdict = (req.body?.verdict || '').trim();
    if (!ip) return res.status(400).json({ error: 'ip is required' });
    if (!['malicious', 'benign', 'clear'].includes(verdict)) {
        return res.status(400).json({ error: "verdict must be 'malicious', 'benign', or 'clear'" });
    }

    try {
        if (verdict === 'clear') await query(deleteIpVerdictQuery, [ip]);
        else await query(upsertIpVerdictQuery, [ip, verdict]);
        return res.json({ ok: true, ip, verdict });
    } catch (error) {
        console.error('Set verdict error:', error);
        return res.status(500).json({ error: 'Failed to set verdict' });
    }
};
