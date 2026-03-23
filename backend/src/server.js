import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import timerRoutes from './routes/timer.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const frontendOrigins = (
  process.env.FRONTEND_ORIGINS
  || process.env.FRONTEND_ORIGIN
  || 'http://127.0.0.1:5500,http://localhost:5500'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || frontendOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/timer', timerRoutes);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});
