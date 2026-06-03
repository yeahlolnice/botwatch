import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const corsOptions = {
    origin: "*",
};

app.use(cors());
app.use(bodyParser.json());

app.use(( err, req, res, next) => {
    console.error(err.stack);
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    return err.status(statusCode).json({ error: message });
});


app.get('/', (req, res) => {
    res.send('Botwatch API is running');
});


app.listen(PORT, () => {
  console.log(`Botwatch Server is running on port ${PORT}`);
});