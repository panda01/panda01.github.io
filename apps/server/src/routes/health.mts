import { Router } from 'express';
import type { Request, Response } from 'express';
import type { HealthCheckResponse } from '@khalah/shared';

/**
 * GET /api/health — reports that the API server is running and able to answer requests.
 * Used by `npm run dev:check`, the Playwright E2E tests, and (later) container health checks.
 * @param _incomingRequest - The incoming request; it carries no parameters and is not read.
 * @param healthResponse - The response, always sent as `200 { "status": "ok" }`.
 */
export function handleHealthCheckRequest(
  _incomingRequest: Request,
  healthResponse: Response<HealthCheckResponse>,
): void {
  healthResponse.status(200).json({ status: 'ok' });
}

/**
 * Creates the router that serves the health-check endpoint.
 * @returns A router exposing `GET /api/health`.
 */
export function createHealthRouter(): Router {
  const healthRouter = Router();
  healthRouter.get('/api/health', handleHealthCheckRequest);
  return healthRouter;
}
