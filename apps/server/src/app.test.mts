import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.mts';

describe('createApp', () => {
  it('serves the health check route', async () => {
    const healthResponse = await supertest(createApp()).get('/api/health');

    expect(healthResponse.status).toBe(200);
    expect(healthResponse.body).toEqual({ status: 'ok' });
  });

  it('does not advertise the framework in an X-Powered-By header', async () => {
    const healthResponse = await supertest(createApp()).get('/api/health');

    expect(healthResponse.headers['x-powered-by']).toBeUndefined();
  });

  it('answers unknown API paths with 404', async () => {
    const unknownPathResponse = await supertest(createApp()).get('/api/does-not-exist');

    expect(unknownPathResponse.status).toBe(404);
  });
});
