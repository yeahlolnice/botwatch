import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const requiredEnvVars = ['PG_USER', 'PG_HOST', 'PG_DATABASE', 'PG_PASSWORD', 'PG_PORT'];
requiredEnvVars.forEach((varName) => {
    if (!process.env[varName]) {
        throw new Error(`Missing required environment variable: ${varName}`);
        process.exit(1);
    }
});

const db = new pg.Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});

db.connect().then(() => console.log('Connected to PostgreSQL database')).catch((err) => {
    console.error('Failed to connect to PostgreSQL database:', err);
    process.exit(1);
});

db.on('error', (err) => {
    console.error('Database error: ', err);
});

export const query = (text, params) => db.query(text, params);