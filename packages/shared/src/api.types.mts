/**
 * Body returned by `GET /api/health` when the API server is up and able to answer requests.
 */
export interface HealthCheckResponse {
  status: 'ok';
}
