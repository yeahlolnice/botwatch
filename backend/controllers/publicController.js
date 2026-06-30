import { query } from '../utilities/connectDB.js';
import {
    getPublicStatsQuery,
    getPublicRecentTrapsQuery,
    getPublicAttackBreakdownQuery,
    getPublicCountryStatsQuery,
    getPublicBotLeaderboardQuery,
    getPublicHoneypotBreakdownQuery,
} from '../utilities/sqlPublicQuerys.js';

export const getPublicStats = async (req, res) => {
    try {
        const result = await query(getPublicStatsQuery);
        return res.json(result.rows[0]);
    } catch (error) {
        console.error('Public stats error:', error);
        return res.status(500).json({ error: 'Failed to fetch stats' });
    }
};

export const getPublicRecentTraps = async (req, res) => {
    try {
        const result = await query(getPublicRecentTrapsQuery);
        return res.json(result.rows);
    } catch (error) {
        console.error('Public recent traps error:', error);
        return res.status(500).json({ error: 'Failed to fetch recent traps' });
    }
};

export const getPublicIntel = async (req, res) => {
    try {
        const [attacks, countries, honeypots] = await Promise.all([
            query(getPublicAttackBreakdownQuery),
            query(getPublicCountryStatsQuery),
            query(getPublicHoneypotBreakdownQuery),
        ]);
        return res.json({
            attacks: attacks.rows,
            countries: countries.rows,
            honeypots: honeypots.rows,
        });
    } catch (error) {
        console.error('Public intel error:', error);
        return res.status(500).json({ error: 'Failed to fetch intel' });
    }
};

export const getPublicLeaderboard = async (req, res) => {
    try {
        const result = await query(getPublicBotLeaderboardQuery);
        return res.json(result.rows);
    } catch (error) {
        console.error('Public leaderboard error:', error);
        return res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
};
