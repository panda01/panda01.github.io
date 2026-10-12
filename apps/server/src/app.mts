import express from 'express';
import type { Express } from 'express';
import { createHealthRouter } from './routes/health.mts';

/**
 * Builds the Express application with all of its middleware and API routes, without binding it to a
 * port, so tests can exercise it directly with supertest.
 * @returns The configured Express application, not yet listening.
 */
export function createApp(): Express {
  const application = express();
  application.disable('x-powered-by');
  application.use(createHealthRouter());
  return application;
}
