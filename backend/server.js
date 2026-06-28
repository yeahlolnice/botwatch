import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes.js';
import trackingRoutes from './routes/trackingRoutes.js';
import honeypotRoutes from './routes/honeypotRoutes.js';
import { trackRequest } from './controllers/trackingControllers.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
// Parse bodies before tracking so payload analysis has access to req.body
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
// Accept raw text/XML bodies too (useful for XXE attempt capture)
app.use(bodyParser.text({ type: ['text/xml', 'application/xml'], limit: '10mb' }));

// Track every request — registers res.finish listener, runs payload analysis
app.use(trackRequest);

// Honeypot routes — must be registered before the catch-all 404
app.use(honeypotRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'Botwatch API is running' });
});

app.use('/api/users', userRoutes);
app.use('/api/traffic', trackingRoutes);

// 404 — still tracked (scanning for non-existent paths is itself a signal)
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
    console.log(`Botwatch Server running on port ${PORT}`);
});
