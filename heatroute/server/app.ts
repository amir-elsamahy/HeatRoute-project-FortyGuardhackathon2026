/**
 * HeatRoute Express App Definition.
 * Shared application instance used by local dev server and Vercel serverless deployment.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import analyzeRouter from './routes/analyze';
import geocodeRouter from './routes/geocode';

export const app = express();

// ---------------------------------------------------------------------------
// Security Middleware & Headers
// ---------------------------------------------------------------------------

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow all same-origin, local development, and preview origins
      if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('vercel.app')) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
  }),
);

app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

app.use('/api/analyze', analyzeRouter);
app.use('/api/geocode', geocodeRouter);

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'HeatRoute API',
    version: '1.0.0',
    fortyguardConfigured: Boolean(process.env.FORTYGUARD_API_KEY),
    time: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Error Handling Middleware
// ---------------------------------------------------------------------------

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    error: true,
    message: 'An unexpected internal server error occurred.',
  });
});

export default app;
